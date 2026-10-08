import assert from "node:assert/strict";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { boot, fixture, records, openActions, groupEditControl } from "./editor-browser-helpers.mjs";

// Missing success feedback, global/inert announcements, or clipboard-only
// success detection must fail these native panel and keyboard checks.
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = path.resolve(process.argv[2] ?? path.join(root, "artifacts", "p3-remediation", "copy"));
const checks = [], errors = []; let server, browser, failure;
const check = (label, ok, detail) => checks.push({ label, ok, ...(detail === undefined ? {} : { detail }) });
async function settled(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function copyState(page) { return page.evaluate(async () => {
  const { documentSession: session } = await import("/src/state/document.ts");
  const { saveState } = await import("/src/state/guides.ts"); const { toast } = await import("/src/state/ui.ts");
  return { document: session.document.peek(), past: session.past.peek(), future: session.future.peek(), copied: session.copiedToken.peek(), save: saveState.peek(), toast: toast.peek() };
}); }
async function copy(page, button) { await button.focus(); await page.keyboard.press("Enter"); await settled(page); }
async function feedback(page, label, expected, mobile) {
  const status = page.locator(".token-details [role=status]");
  const text = await status.count() ? await status.textContent() : null;
  check(label, text === expected, { expected, actual: text });
  if (await status.count()) {
    check(`${label}: polite announcement in active panel`, await status.evaluate((node, mobile) => node.getAttribute("aria-live") === "polite" && node.getAttribute("aria-atomic") === "true" && (mobile ? !!node.closest("dialog:modal") : !!node.closest(".authoring-panel")), mobile));
    check(`${label}: feedback is readable without another scroll`, await status.evaluate(node => {
      const rect = node.getBoundingClientRect();
      const panel = node.closest(".context-sheet__body, .authoring-panel").getBoundingClientRect();
      return rect.top >= Math.max(0, panel.top) && rect.bottom <= Math.min(window.innerHeight, panel.bottom);
    }));
  }
}

try {
  let url = process.argv[3];
  if (!url || url === "-") {
    server = await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false, watch: { ignored: ["**/artifacts/**"] } } });
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}/`;
  }
  await mkdir(output, { recursive: true }); browser = await chromium.launch();
  for (const locale of ["en", "de"]) for (const mobile of [false, true]) {
    const tag = `${locale}-${mobile ? "mobile" : "desktop"}`;
    const doc = fixture([3, 0]); const source = doc.steps[0].tokens[0]; source.label = locale === "en" ? "Wash before cooking" : "Vor dem Kochen waschen";
    source.note = "Source note";
    source.quantity = { amount: 2, unit: "scoops", iconId: "quantity.amount", label: "Two scoops", extra: { retained: true } };
    source.time = { seconds: 65, iconId: "time.duration", label: "Authored minute" };
    source.warning = { iconId: "warning.sharp", label: "Authored warning" };
    doc.steps[0].tokens[1] = { id: "catalog-copy", iconId: "object.onion", category: "object", label: "   " };
    doc.steps[0].tokens[2] = { id: "unknown-copy", iconId: "unknown.copy-test", category: "object" };
    const pref = { version: 1, preferences: { uiLocale: locale, labelLocale: locale, activeLibraryId: "kitchen", theme: "light", lastGuideId: "copy-fixture" } };
    const guide = { id: "copy-fixture", revision: 1, createdAt: doc.meta.createdAt, updatedAt: doc.meta.createdAt, document: doc };
    const { page, context } = await boot(browser, url, errors, mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, [["instruction-builder:guide:copy-fixture", guide], ["instruction-builder:preferences:v1", pref]]);
    try {
      await page.locator(`[data-editor-picture="${source.id}"]`).first().click();
      const details = page.locator(".token-details"); await details.waitFor();
      check(`${tag}: native authoring surface`, mobile ? await page.locator("dialog:modal .token-details").count() === 1 : await page.locator(".authoring-panel .token-details").count() === 1);
      await details.getByLabel(locale === "en" ? "Amount" : "Anzahl", { exact: true }).fill("11");
      await details.getByLabel(locale === "en" ? "Unit" : "Einheit", { exact: true }).fill("unsaved cup");
      await details.getByLabel(locale === "en" ? "Minutes" : "Minuten", { exact: true }).fill("9");
      await openActions(page);
      const button = details.getByRole("button", { name: locale === "en" ? "Copy picture" : "Bild kopieren", exact: true });
      await page.evaluate(async () => {
        (await import("/src/state/guides.ts")).saveState.value = "conflict";
        (await import("/src/state/ui.ts")).toast.value = { text: "Keep existing protection", tone: "error" };
      });
      const before = await copyState(page), stored = await records(page);
      await copy(page, button);
      const expected = locale === "en" ? "Copied Wash before cooking" : "Vor dem Kochen waschen kopiert";
      await feedback(page, `${tag}: authored copy feedback`, expected, mobile);
      check(`${tag}: Copy retains focus and panel`, await button.evaluate(node => document.activeElement === node) && await details.isVisible());
      check(`${tag}: unsaved quantity and time survive copy`, await details.getByLabel(locale === "en" ? "Amount" : "Anzahl", { exact: true }).inputValue() === "11" && await details.getByLabel(locale === "en" ? "Unit" : "Einheit", { exact: true }).inputValue() === "unsaved cup" && await details.getByLabel(locale === "en" ? "Minutes" : "Minuten", { exact: true }).inputValue() === "9");
      const after = await copyState(page);
      const { id: copiedId, ...copiedContents } = after.copied;
      const { id: sourceId, ...sourceContents } = source;
      check(`${tag}: clipboard includes full committed attachments and note`, JSON.stringify(copiedContents) === JSON.stringify(sourceContents) && copiedId !== sourceId);
      check(`${tag}: copy leaves document history and protection unchanged`, JSON.stringify({ ...after, copied: null }) === JSON.stringify({ ...before, copied: null }));
      check(`${tag}: copy leaves persistence unchanged`, JSON.stringify(await records(page)) === JSON.stringify(stored));
      await page.evaluate(() => {
        window.__copyStatusChanges = 0;
        const status = document.querySelector(".token-details [role=status]");
        if (status) { const observer = new MutationObserver(() => { window.__copyStatusChanges++; }); observer.observe(status, { childList: true, characterData: true, subtree: true }); window.__copyObserver = observer; }
      });
      await page.keyboard.press("Enter"); await settled(page);
      await feedback(page, `${tag}: repeated copy feedback`, expected, mobile);
      check(`${tag}: repeated copy produces a new live-region update`, await page.evaluate(() => window.__copyStatusChanges > 0));
      const repeated = await copyState(page);
      check(`${tag}: repeated copy leaves document history and protection unchanged`, JSON.stringify({ ...repeated, copied: null }) === JSON.stringify({ ...before, copied: null }));
      await page.screenshot({ path: path.join(output, `${tag}-copy-feedback.png`), fullPage: true });
      await page.keyboard.press("Escape"); await settled(page);
      await (await groupEditControl(page, "group-1")).click(); await openActions(page);
      await copy(page, page.getByRole("button", { name: locale === "en" ? "Paste picture" : "Bild einfügen", exact: true }));
      const pasted = (await copyState(page)).document.steps[1].tokens[0];
      const { id: pastedId, ...pastedContents } = pasted;
      check(`${tag}: paste has fresh ID and full copied contents`, pastedId !== sourceId && pastedId !== repeated.copied.id && JSON.stringify(pastedContents) === JSON.stringify(sourceContents));
      for (const [id, wanted] of [["catalog-copy", locale === "en" ? "Copied Onion" : "Zwiebel kopiert"], ["unknown-copy", locale === "en" ? "Copied Unknown picture (unknown.copy-test)" : "Unbekanntes Bild (unknown.copy-test) kopiert"]]) {
        await page.locator(`[data-editor-picture="${id}"]`).first().click(); await details.waitFor(); await settled(page);
        const prior = details.getByRole("status");
        check(`${tag}: ${id} opens without stale feedback`, !await prior.count() || await prior.textContent() === "");
        await openActions(page); const nextCopy = details.getByRole("button", { name: locale === "en" ? "Copy picture" : "Bild kopieren", exact: true });
        await copy(page, nextCopy); await feedback(page, `${tag}: ${id} fallback feedback`, wanted, mobile);
        check(`${tag}: ${id} replaced single-slot clipboard`, (await copyState(page)).copied.iconId === (id === "catalog-copy" ? "object.onion" : "unknown.copy-test"));
        await page.keyboard.press("Escape"); await settled(page);
      }
    } finally { await context.close(); }
  }
  assert.deepEqual(errors, [], "Browser console/page errors");
  assert.deepEqual(checks.filter(item => !item.ok), [], "Copy must announce success inside the active panel without losing state");
} catch (error) { failure = error; }
finally {
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "copy-feedback-results.json"), JSON.stringify({ checks, errors, failure: failure ? String(failure) : null }, null, 2));
  await browser?.close(); await server?.close();
}
console.log(JSON.stringify({ checks: checks.length, failed: checks.filter(item => !item.ok), errors }, null, 2));
if (failure) throw failure;
