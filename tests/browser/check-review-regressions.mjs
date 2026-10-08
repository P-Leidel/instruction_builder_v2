import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { boot, createBlank, fixture, importDocument, records, snapshot } from "./editor-browser-helpers.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));

const output = path.resolve(process.argv[2] ?? path.join(root, "artifacts", "review-regressions"));
let url = process.argv[3], server;
if (!url) {
  server = await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false } });
  await server.listen();
  url = `http://127.0.0.1:${server.httpServer.address().port}/`;
}
const errors = [], checks = {};
const browser = await chromium.launch();
await mkdir(output, { recursive: true });
try {
  const { page, context } = await boot(browser, url, errors);
  try {
    await createBlank(page);
    await importDocument(page, fixture([1]));
    await page.getByLabel("Guide title", { exact: true }).fill("Committed guide change");
    await page.locator("[data-editor-picture]").first().click();
    const unit = page.getByRole("group", { name: "Quantity", exact: true }).getByLabel("Unit", { exact: true });
    const before = JSON.stringify(await snapshot(page));
    const initialUnit = await unit.inputValue();
    await unit.press("Control+a");
    await unit.pressSequentially("draft unit");
    await unit.press("Control+z");
    checks.FIELD_UNDO_RESTORES_NATIVE_DRAFT = await unit.inputValue() === initialUnit;
    checks.FIELD_UNDO_PRESERVES_GUIDE_HISTORY = JSON.stringify(await snapshot(page)) === before;
    // The shortcut still belongs to guide history when focus is on a picture.
    await page.getByRole("button", { name: "Close", exact: true }).last().click();
    await page.locator("[data-editor-picture]").first().focus();
    await page.keyboard.press("Control+z");
    checks.PICTURE_UNDO_CHANGES_GUIDE_HISTORY = (await snapshot(page)).meta.title === "Workplace guide";
    await page.keyboard.press("Control+y");
    checks.PICTURE_REDO_CHANGES_GUIDE_HISTORY = (await snapshot(page)).meta.title === "Committed guide change";

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("combobox", { name: "App language", exact: true }).selectOption("de");
    checks.GERMAN_UI_SETS_DOCUMENT_LANGUAGE = await page.locator("html").getAttribute("lang") === "de";
    await page.getByRole("combobox", { name: "App-Sprache", exact: true }).selectOption("en");
    checks.ENGLISH_UI_SETS_DOCUMENT_LANGUAGE = await page.locator("html").getAttribute("lang") === "en";
    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
    await page.evaluate(async () => {
      const result = await (await import("/src/state/guide-bootstrap.ts")).guideBootstrap.controller().flushActiveGuide();
      if (!result.ok) throw new Error(result.reason);
    });
    const beforeCount = (await records(page)).filter(([key]) => key.startsWith("instruction-builder:guide:")).length;
    await page.getByLabel("Choose a JSON guide file", { exact: true }).setInputFiles({ name: "review.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture([1]))) });
    await page.getByRole("dialog").waitFor();
    // A real outstanding IndexedDB writer models slow local storage. Keep the
    // transaction alive with requests so both clicks arrive before commit.
    await page.evaluate(() => new Promise((resolve, reject) => {
      window.__releaseReviewWriter = false;
      const request = indexedDB.open("keyval-store", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction("keyval", "readwrite");
        const store = tx.objectStore("keyval");
        let started = false;
        const hold = () => {
          const read = store.get("review-lock");
          read.onsuccess = () => { if (!started) { started = true; resolve(); } if (!window.__releaseReviewWriter) hold(); };
        };
        tx.oncomplete = () => db.close();
        tx.onabort = () => reject(tx.error);
        hold();
      };
    }));
    try {
      await page.getByRole("dialog").getByRole("button", { name: "Confirm", exact: true }).evaluate(node => { node.click(); node.click(); });
      // Escape while the commit is in flight must not silently dismiss it.
      await page.keyboard.press("Escape");
      checks.PENDING_IMPORT_REMAINS_VISIBLE = await page.getByRole("dialog").count() === 1;
    } finally { await page.evaluate(() => { window.__releaseReviewWriter = true; }); }
    await page.evaluate(async () => {
      const result = await (await import("/src/state/guide-bootstrap.ts")).guideBootstrap.controller().flushActiveGuide();
      if (!result.ok) throw new Error(result.reason);
    });
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    const afterCount = (await records(page)).filter(([key]) => key.startsWith("instruction-builder:guide:")).length;
    checks.REPEATED_IMPORT_CREATES_ONE_GUIDE = afterCount === beforeCount + 1;
    await page.screenshot({ path: path.join(output, "editor-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, "editor-mobile.png"), fullPage: true });
    checks.NO_CONSOLE_OR_PAGE_ERRORS = errors.length === 0;
  } catch (error) {
    await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true });
    await writeFile(path.join(output, "failure.html"), await page.content());
    await writeFile(path.join(output, "results.json"), JSON.stringify({ checks, errors, failure: String(error) }, null, 2));
    throw error;
  } finally { await context.close(); }
  await writeFile(path.join(output, "results.json"), JSON.stringify({ checks, errors }, null, 2));
  const failed = Object.entries(checks).filter(([, passed]) => passed !== true).map(([name]) => name);
  assert.deepEqual(failed, [], `Review regressions failed: ${failed.join(", ")}`);
  console.log(`REVIEW_REGRESSION_CHECKS=${Object.keys(checks).length}`);
} finally { await browser.close(); await server?.close(); }
