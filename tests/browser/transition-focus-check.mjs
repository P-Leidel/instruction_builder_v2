import assert from "node:assert/strict";
import process from "node:process";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { boot, createBlank, fixture, importDocument, snapshot } from "./editor-browser-helpers.mjs";

// Removing successful navigation's destination focus must fail these checks.
// Keyboard activation and the next Tab exercise the actual browser focus order.
const root = fileURLToPath(new URL("../../", import.meta.url));
const server = process.argv[2] ? undefined : await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false } });
await server?.listen();
const url = process.argv[2] ?? `http://127.0.0.1:${server.httpServer.address().port}/`;
const evidence = path.join(root, "artifacts", "functional-remediation", "focus");
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch();
const errors = [], checks = [];

async function settled(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function keyboardActivate(page, control) {
  await control.waitFor({ state: "visible" });
  for (let count = 0; count < 100; count++) {
    if (await control.evaluate(node => node === document.activeElement)) { await page.keyboard.press("Enter"); return; }
    await page.keyboard.press("Tab");
  }
  throw new Error(`Keyboard could not reach ${await control.textContent()}`);
}
async function expectFocus(page, label, target) {
  await settled(page);
  const active = await page.evaluate(() => ({ tag: document.activeElement.tagName, text: document.activeElement.textContent?.trim().slice(0, 80), label: document.activeElement.getAttribute("aria-label") }));
  const ok = await target.evaluate(node => node === document.activeElement);
  checks.push({ label, ok, active });
}
async function library(page) {
  await keyboardActivate(page, page.getByRole("button", { name: "My guides", exact: true }));
  await page.locator(".my-guides").waitFor();
}

// Font arrival moves repair controls into the physical layout. Losing the
// focused control, or restoring it after the user moved away, breaks navigation.
async function fontArrivalFocus(kind, moveFocus) {
  const { page, context } = await boot(browser, url, errors);
  let release, requested;
  const gate = new Promise(resolve => { release = resolve; });
  const fontRequested = new Promise(resolve => { requested = resolve; });
  try {
    await page.route("**/fonts/*.ttf", async route => { requested(); await gate; await route.continue(); });
    let target;
    if (kind === "group") {
      await createBlank(page);
      const groupId = (await snapshot(page)).steps[0].id;
      const escaped = await page.evaluate(id => CSS.escape(id), groupId);
      target = page.locator(`[data-add-picture="${escaped}"]`).first();
    } else {
      await importDocument(page, fixture([1]));
      target = page.locator('[data-editor-picture="picture-0-0"]').first();
      await target.click(); await page.keyboard.press("Escape");
    }
    await fontRequested;
    await page.getByRole("button", { name: "Read", exact: true }).click();
    await page.getByRole("button", { name: "Back to editing", exact: true }).click();
    await target.waitFor();
    await page.waitForFunction(({ kind, id }) => document.activeElement?.getAttribute(kind === "group" ? "data-add-picture" : "data-editor-picture") === id,
      { kind, id: await target.getAttribute(kind === "group" ? "data-add-picture" : "data-editor-picture") });
    const original = await target.elementHandle();
    let expected = target;
    if (moveFocus === "external") {
      expected = page.getByLabel("Guide title", { exact: true }); await expected.focus();
    } else if (moveFocus === "modal") {
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      expected = page.getByRole("dialog", { name: "Settings", exact: true }).getByRole("button", { name: "Close", exact: true });
      await page.waitForFunction(() => document.activeElement?.closest('dialog[open]') !== null);
    }
    release();
    await page.waitForFunction(() => document.querySelector(".instruction-editor")?.getAttribute("data-editor-layout") === "ready");
    await expectFocus(page, `font arrival: ${kind} return ${moveFocus ? `preserves ${moveFocus} focus` : "retains its relocated control"}`, expected);
    checks.at(-1).originalDisconnected = !await original.evaluate(node => node.isConnected);
    await original.dispose();
  } finally { release(); await context.close(); }
}

try {
  for (const [kind, moveFocus] of [["group", null], ["picture", null], ["group", "external"], ["picture", "modal"]]) {
    await fontArrivalFocus(kind, moveFocus);
  }
  for (const [name, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
    const { page, context } = await boot(browser, url, errors, viewport);
    await settled(page);
    checks.push({ label: `${name}: startup does not steal focus`, ok: await page.evaluate(() => document.activeElement === document.body) });
    await keyboardActivate(page, page.getByRole("button", { name: "New guide", exact: true }));
    await keyboardActivate(page, page.getByRole("button", { name: "Start blank", exact: true }));
    const title = page.getByLabel("Guide title", { exact: true }); await title.waitFor();
    await expectFocus(page, `${name}: new blank enters title`, title);
    await title.fill("Keyboard guide");
    await settled(page);
    await expectFocus(page, `${name}: typing retains title focus`, title);

    await keyboardActivate(page, page.getByRole("button", { name: "Read", exact: true }));
    await page.locator(".reader").waitFor();
    const back = page.getByRole("button", { name: "Back to editing", exact: true });
    await expectFocus(page, `${name}: Read enters reader control`, back);
    await page.keyboard.press("Tab");
    await expectFocus(page, `${name}: reader Tab reaches content mode`, page.locator(".reader__controls select"));
    await keyboardActivate(page, back);
    await title.waitFor();
    await expectFocus(page, `${name}: reader exit retains selected group policy`, page.locator("[data-add-picture], [data-add-group]").first());

    await library(page);
    await expectFocus(page, `${name}: My guides enters library heading`, page.locator(".my-guides > h1"));
    await page.keyboard.press("Tab");
    await expectFocus(page, `${name}: library Tab reaches New guide`, page.getByRole("button", { name: "New guide", exact: true }));
    await keyboardActivate(page, page.getByRole("button", { name: "Open Keyboard guide", exact: true }));
    await title.waitFor(); await expectFocus(page, `${name}: Open enters title`, title);
    await library(page);
    await keyboardActivate(page, page.getByRole("button", { name: "Duplicate Keyboard guide", exact: true }));
    await title.waitFor(); await expectFocus(page, `${name}: Duplicate enters title`, title);
    await library(page);
    await keyboardActivate(page, page.getByRole("button", { name: "New guide", exact: true }));
    await keyboardActivate(page, page.getByRole("button", { name: "Create example guide", exact: true }));
    await title.waitFor(); await expectFocus(page, `${name}: example enters title`, title);

    const imported = fixture([1]); imported.meta.title = "Imported keyboard guide";
    await page.getByLabel("Choose a JSON guide file", { exact: true }).setInputFiles({ name: "focus.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(imported)) });
    await keyboardActivate(page, page.getByRole("dialog").getByRole("button", { name: "Confirm", exact: true }));
    await page.waitForFunction(() => document.querySelector(".guide-title input")?.value === "Imported keyboard guide");
    await expectFocus(page, `${name}: import enters title after modal closes`, title);
    const picture = page.locator('[data-editor-picture="picture-0-0"]').first();
    await keyboardActivate(page, picture);
    await page.keyboard.press("Escape"); await settled(page);
    await keyboardActivate(page, page.getByRole("button", { name: "Read", exact: true }));
    await back.waitFor(); await keyboardActivate(page, back); await title.waitFor();
    await expectFocus(page, `${name}: reader exit retains selected picture policy`, picture);

    // The same real destinations exercise the helper's two safety boundaries.
    await keyboardActivate(page, page.getByRole("button", { name: "Settings", exact: true }));
    const settings = page.getByRole("dialog", { name: "Settings", exact: true });
    await settled(page);
    checks.push({ label: `${name}: settings retains modal focus`, ok: await settings.evaluate(node => node.contains(document.activeElement)) });
    await page.evaluate(async () => { (await import("/src/lib/view-entry-focus.ts")).shellFocus.enter("editor", () => true); });
    await settled(page);
    checks.push({ label: `${name}: pending entry cannot take focus from an open modal`, ok: await settings.evaluate(node => node.contains(document.activeElement)) });
    await page.keyboard.press("Escape"); await settled(page);
    await expectFocus(page, `${name}: settings returns focus to opener`, page.getByRole("button", { name: "Settings", exact: true }));
    await page.evaluate(async () => { (await import("/src/lib/view-entry-focus.ts")).shellFocus.enter("editor", () => false); });
    await expectFocus(page, `${name}: stale entry request leaves current control focused`, page.getByRole("button", { name: "Settings", exact: true }));
    const retainedScroll = await page.evaluate(async () => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      const before = window.scrollY;
      (await import("/src/lib/view-entry-focus.ts")).shellFocus.enter("editor", () => true);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { before, after: window.scrollY };
    });
    checks.push({ label: `${name}: entry focus preserves scroll position`, ok: retainedScroll.before === retainedScroll.after });

    const draft = await snapshot(page);
    await title.fill("Unsaved keyboard draft");
    await page.evaluate(() => { IDBObjectStore.prototype.put = function () { throw new DOMException("Focus check blocked write", "QuotaExceededError"); }; });
    await keyboardActivate(page, page.getByRole("button", { name: "My guides", exact: true }));
    await page.getByRole("alert").first().waitFor();
    await expectFocus(page, `${name}: failed navigation keeps trigger focus`, page.getByRole("button", { name: "My guides", exact: true }));
    checks.push({ label: `${name}: failed navigation preserves edited draft`, ok: (await snapshot(page)).meta.title === "Unsaved keyboard draft" && (await snapshot(page)).steps[0].id === draft.steps[0].id && await title.isVisible() });
    await page.screenshot({ path: path.join(evidence, `${name}-failed-navigation.png`), fullPage: true });
    await context.close();
  }
  await writeFile(path.join(evidence, "results.json"), JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ passed: checks.filter(check => check.ok).length, failed: checks.filter(check => !check.ok), errors }, null, 2));
  assert.deepEqual(errors, []);
  assert.deepEqual(checks.filter(check => !check.ok), [], "Successful navigation must focus its destination and preserve keyboard order");
} finally { await browser.close(); await server?.close(); }
