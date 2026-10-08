import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";
import { createBlank, fixture, importDocument, snapshot } from "./editor-browser-helpers.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = path.resolve(process.argv[2] ?? path.join(root, "artifacts/p3-remediation/reading-browser"));
const suppliedUrl = process.argv[3] === "-" ? undefined : process.argv[3];
const quantityId = "vendor.quantity.<raw>-$&", timeId = "vendor.time.<raw>-$&", groupTimeId = "vendor.group.<raw>-$&";
const wording = {
  en: { read: "Read", back: "Back to editing", readingMode: "Reading content", output: "Print / Download", mode: "Content mode", semantic: "Selected content", quantity: "Review quantity reference: ", time: "Review picture time reference: ", group: "Review group time reference: ", groupLabel: "Group time", total: "Total time", warning: "Warning: Stay clear" },
  de: { read: "Lesen", back: "Zurück zur Bearbeitung", readingMode: "Leseinhalt", output: "Drucken / Herunterladen", mode: "Inhaltsmodus", semantic: "Ausgewählter Inhalt", quantity: "Mengenverweis prüfen: ", time: "Bildzeitverweis prüfen: ", group: "Gruppenzeitverweis prüfen: ", groupLabel: "Gruppenzeit", total: "Gesamtzeit", warning: "Warnung: Stay clear" },
};
const checks = [], errors = [], contexts = new Set();
let browser, server, failure;

async function inspect(content, doc, locale, mode, surface) {
  const words = wording[locale];
  const pictures = content.locator("[data-reading-picture]");
  assert.deepEqual(await pictures.evaluateAll(nodes => nodes.map(node => node.getAttribute("data-reading-picture"))), doc.steps.flatMap(group => group.tokens.map(token => token.id)));
  const unknown = pictures.nth(0), known = pictures.nth(1), mixed = pictures.nth(2);
  assert.equal(await unknown.getByRole("img", { name: "Authored unknown picture", exact: true }).count(), 1);
  assert.ok((await unknown.innerText()).includes(words.warning));
  assert.ok((await unknown.innerText()).includes("4 cups"));
  assert.ok((await unknown.innerText()).includes("1m 30s"));
  assert.ok((await unknown.locator(".review-notice").allTextContents()).includes(words.quantity + quantityId), `${surface} ${locale} ${mode}: full quantity reference notice`);
  assert.ok((await unknown.locator(".review-notice").allTextContents()).includes(words.time + timeId), `${surface} ${locale} ${mode}: full picture-time reference notice`);
  assert.equal(await known.locator(".review-notice").count(), 0, "Known attachments do not gain notices");
  assert.equal(await mixed.locator(".review-notice").count(), 1, "Mixed attachments flag only the unknown picture time");
  assert.equal(await mixed.locator(".review-notice").innerText(), words.time + "vendor.mixed.time");
  assert.ok((await known.innerText()).includes("2 kg")); assert.ok((await known.innerText()).includes("1m"));
  assert.ok((await mixed.innerText()).includes("3 cups")); assert.ok((await mixed.innerText()).includes("30s"));
  const groups = content.locator(".reader__group");
  assert.equal(await groups.nth(0).locator(":scope > .review-notice").innerText(), words.group + groupTimeId);
  assert.equal(await groups.nth(1).locator(":scope > .review-notice").count(), 0, "Derived timing has no explicit group reference");
  assert.ok((await groups.nth(0).innerText()).includes("Authored group interval"));
  const derivedText = await groups.nth(1).innerText();
  assert.equal(derivedText.includes(words.groupLabel + ": 45s"), doc.meta.presentation === "sequence");
  assert.equal((await content.innerText()).includes(words.total), doc.meta.presentation === "sequence");
  assert.equal(await content.locator("[data-reading-presentation]").getAttribute("data-reading-presentation"), doc.meta.presentation);
  assert.equal((await unknown.locator("p").allTextContents()).includes("Authored unknown picture"), mode !== "pictures");
  assert.equal((await content.innerText()).includes("Optional group description"), mode === "detailed");
  assert.equal((await content.innerText()).includes("Extra note"), mode === "detailed");
  checks.push(`${surface}_${doc.meta.presentation}_${locale}_${mode}`);
}

try {
  await mkdir(output, { recursive: true });
  if (!suppliedUrl) {
    server = await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false, watch: { ignored: ["**/artifacts/**"] } } });
    await server.listen();
  }
  browser = await chromium.launch();
  const url = suppliedUrl ?? `http://127.0.0.1:${server.httpServer.address().port}/`;
  for (const presentation of ["sequence", "board"]) for (const locale of ["en", "de"]) {
    const context = await browser.newContext({ locale: "en-US", serviceWorkers: "block", viewport: { width: 1440, height: 1000 } });
    contexts.add(context);
    try {
      const page = await context.newPage();
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
      await page.goto(url); await page.locator(".app-brand").waitFor(); await createBlank(page, presentation);
      const doc = fixture([3, 1], presentation);
      doc.steps[0].description = "Optional group description";
      doc.steps[0].time = { iconId: groupTimeId, seconds: 180, label: "Authored group interval" };
      doc.steps[0].tokens = [
        { id: "unknown", iconId: "x", category: "object", label: "Authored unknown picture", note: "Extra note", quantity: { iconId: quantityId, amount: 4, unit: "cups", label: "4 cups" }, time: { iconId: timeId, seconds: 90, label: "1m 30s" }, warning: { iconId: "w", label: "Stay clear" } },
        { id: "known", iconId: "action.chop", category: "action", label: "Chop", quantity: { iconId: "quantity.amount", amount: 2, unit: "kg", label: "" }, time: { iconId: "time.duration", seconds: 60, label: "" } },
        { id: "mixed", iconId: "object.onion", category: "object", label: "Onion", quantity: { iconId: "object.onion", amount: 3, unit: "cups", label: "3 cups" }, time: { iconId: "vendor.mixed.time", seconds: 30, label: "" } },
      ];
      doc.steps[1].tokens[0].time = { iconId: "object.onion", seconds: 45, label: "" };
      await importDocument(page, doc);
      const before = await snapshot(page); assert.deepEqual(before, doc, "Import preserves the full authored source");
      await page.evaluate(async locale => (await import("/src/state/preferences.ts")).updatePreferences({ uiLocale: locale, labelLocale: locale }), locale);
      const words = wording[locale];
      await page.getByRole("button", { name: words.read, exact: true }).click();
      for (const mode of ["labels", "pictures", "detailed"]) {
        await page.locator(".reader__controls select").selectOption(mode);
        await inspect(page.locator(".reader .reading-content"), doc, locale, mode, "reader");
        assert.deepEqual(await snapshot(page), before, "Reader mode changes preserve source");
      }
      await page.screenshot({ path: path.join(output, `reader-${presentation}-${locale}.png`), fullPage: true });
      await page.getByRole("button", { name: words.back, exact: true }).click();
      await page.getByRole("button", { name: words.output, exact: true }).click();
      const dialog = page.locator(".output-dialog");
      for (const mode of ["labels", "pictures", "detailed"]) {
        await dialog.getByLabel(words.mode, { exact: true }).selectOption(mode);
        await page.waitForFunction(() => ["ready", "blocked"].includes(document.querySelector(".output-dialog")?.getAttribute("data-output-status")));
        assert.equal(await dialog.getAttribute("data-output-status"), "ready", `Preview must prepare successfully: ${(await dialog.locator('[role="alert"]').allTextContents()).join("; ")}`);
        const semantic = dialog.locator(".output-preview__semantic");
        if (!await semantic.evaluate(node => node.open)) await semantic.getByText(words.semantic, { exact: true }).click();
        await inspect(semantic.locator(".reading-content"), doc, locale, mode, "preview");
        assert.deepEqual(await snapshot(page), before, "Output mode changes preserve source");
      }
      await page.screenshot({ path: path.join(output, `preview-${presentation}-${locale}.png`), fullPage: true });
    } finally { await context.close(); contexts.delete(context); }
  }
  assert.deepEqual(errors, [], "No browser console or page errors");
  console.log(`READING_REFERENCE_CHECKS=PASS (${checks.length} reader/preview cases)`);
} catch (error) { failure = String(error); throw error; }
finally {
  try {
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, "reading-reference-result.json"), JSON.stringify({ runAt: new Date().toISOString(), checks, errors, failure }, null, 2));
  } finally {
    try { await Promise.all([...contexts].map(context => context.close())); }
    finally { try { await browser?.close(); } finally { await server?.close(); } }
  }
}
