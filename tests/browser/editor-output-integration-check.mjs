import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import process from "node:process";
import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { boot, createBlank, fixture, importDocument, snapshot } from "./editor-browser-helpers.mjs";
import { assertChecks } from "../../scripts/check-results.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = path.resolve(process.argv[2] ?? path.join(root, "artifacts", "browser"));
const checks = {}; const errors = []; let browser; let server; let failure;
const equal = (name, actual, expected) => { checks[name] = actual === expected; assert.equal(actual, expected, name); };
async function download(page, button, name) {
  const [file] = await Promise.all([page.waitForEvent("download"), button.click()]); assert.equal(await file.failure(), null);
  const stream = await file.createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const bytes = Buffer.concat(chunks); await writeFile(path.join(output, name), bytes); return bytes;
}
try {
  let url = process.argv[3]; if (!url || url === "-") { server = await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false } }); await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}/`; }
  await mkdir(output, { recursive: true }); browser = await chromium.launch(); const { page, context } = await boot(browser, url, errors, { width: 1440, height: 900 });
  try {
    await createBlank(page); const doc = fixture([1, 1], "board"); doc.meta.title = "Output integration";
    doc.steps[0].tokens[0].quantity = { iconId: "quantity.amount", amount: 4, unit: "cups", label: " " };
    doc.steps[0].tokens[0].time = { iconId: "time.duration", seconds: 90, label: "" };
    doc.steps[0].tokens[0].warning = { iconId: "custom-warning", label: "Stay clear" };
    doc.steps[0].time = { iconId: "time.duration", seconds: 120, label: " " };
    doc.steps[1].tokens[0] = { id: "book", iconId: "learning.object.book", category: "object", label: "Full authored book meaning" };
    await importDocument(page, doc); await page.getByLabel("Guide title", { exact: true }).fill("Output integration current");
    await page.locator("[data-editor-picture]").first().click(); await page.getByLabel("Amount", { exact: true }).fill("11");
    const before = JSON.stringify(await snapshot(page)); const opener = page.getByRole("button", { name: "Print / Download", exact: true });
    await opener.evaluate((node) => { window.__appOutputOpener = node; }); await opener.click(); await page.getByRole("dialog").waitFor();
    equal("APP_MOUNTS_REVIEWED_OUTPUT_DIALOG", await page.locator(".output-dialog").count(), 1);
    equal("APP_REMOVES_LEGACY_CANVAS", await page.locator(".app__export-canvas,.instruction-canvas").count(), 0);
    const dialog = page.locator(".output-dialog"); await page.waitForFunction(() => document.querySelector(".output-dialog")?.getAttribute("data-output-status") === "ready");
    equal("OUTPUT_CHECKBOX_ROWS_KEEP_COMPONENT_LAYOUT", await dialog.locator(".output-dialog__check").first().evaluate((node) => getComputedStyle(node).display), "flex");
    for (let index = 0; index < 12; index++) { await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => !!document.activeElement.closest(".output-dialog")), true); } checks.OUTPUT_TAB_STAYS_MODAL = true;
    await page.keyboard.press("Control+z"); await page.keyboard.press("Control+v"); equal("OUTPUT_SUSPENDS_DOCUMENT_SHORTCUTS", JSON.stringify(await snapshot(page)), before);
    await dialog.getByLabel("Content mode", { exact: true }).selectOption("pictures"); await page.waitForFunction(() => document.querySelector(".output-dialog")?.getAttribute("data-output-status") === "ready");
    await dialog.getByText("Selected content", { exact: true }).click(); const semantic = dialog.locator(".reading-content");
    equal("OUTPUT_REUSES_ACCESSIBLE_READING_CONTENT", await semantic.getByRole("img").count(), 2);
    equal("PICTURES_ONLY_FULL_AUTHORED_NAME", await semantic.getByRole("img", { name: "Full authored book meaning", exact: true }).count(), 1);
    const text = await semantic.innerText(); checks.REQUIRED_BLANK_LABEL_VALUES_AND_WARNING = text.includes("4 cups") && text.includes("1m 30s") && text.includes("2m") && text.includes("Warning: Stay clear");
    equal("BOARD_SEMANTICS_NO_ORDER_OR_TOTAL", await semantic.locator("ol").count() === 0 && !text.includes("Total time") && !text.includes("Step "), true);
    await dialog.getByRole("group", { name: "Select groups", exact: true }).getByLabel("Group 2", { exact: true }).uncheck(); await page.waitForFunction(() => document.querySelector(".output-dialog")?.getAttribute("data-output-status") === "ready");
    if (await dialog.locator(".output-preview__semantic").getAttribute("open") === null) await dialog.getByText("Selected content", { exact: true }).click();
    equal("OUTPUT_SUBSET_SEMANTIC_CONTENT", await semantic.getByRole("img").count(), 1);
    await page.evaluate(async () => { const { documentSession, sessionActions } = await import("/src/state/document.ts"); const group = documentSession.document.peek().steps[0]; sessionActions.updateTokenLabel(documentSession, group.id, group.tokens[0].id, "Updated authored meaning"); });
    await page.waitForFunction(() => document.querySelector(".output-dialog")?.getAttribute("data-output-status") === "stale"); equal("LIVE_SOURCE_INVALIDATES_OUTPUT", await dialog.getByRole("button", { name: "Download PDF", exact: true }).isDisabled(), true);
    await dialog.getByRole("button", { name: "Refresh preview", exact: true }).click(); await page.waitForFunction(() => document.querySelector(".output-dialog")?.getAttribute("data-output-status") === "ready");
    if (await dialog.locator(".output-preview__semantic").getAttribute("open") === null) await dialog.getByText("Selected content", { exact: true }).click();
    equal("REFRESH_ADOPTS_CURRENT_SOURCE", await semantic.getByRole("img", { name: "Updated authored meaning", exact: true }).count(), 1);
    equal("REFRESH_RETAINS_INTENTIONAL_SUBSET", await semantic.getByRole("img").count(), 1);
    const svg = await download(page, dialog.getByRole("button", { name: "Download SVG page 1 of 1", exact: true }), "app-output-page.svg");
    equal("APP_SVG_ACTUAL_A4_FILE", /width="210mm"/.test(svg.toString()) && /height="297mm"/.test(svg.toString()), true);
    const png = await download(page, dialog.getByRole("button", { name: "Download PNG page 1 of 1 at 150 dpi", exact: true }), "app-output-page.png");
    equal("APP_PNG_ACTUAL_SIGNATURE", png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a"); equal("APP_PNG_A4_WIDTH", png.readUInt32BE(16), 1240); equal("APP_PNG_A4_HEIGHT", png.readUInt32BE(20), 1754);
    const pdf = await download(page, dialog.getByRole("button", { name: "Download PDF", exact: true }), "app-output.pdf"); equal("APP_PDF_ACTUAL_SIGNATURE", pdf.subarray(0, 5).toString(), "%PDF-");
    const backup = await download(page, dialog.getByRole("button", { name: "Download JSON backup", exact: true }), "app-output-backup.json"); equal("OUTPUT_BACKUP_FULL_CAPTURED_DOCUMENT", JSON.stringify(JSON.parse(backup.toString())), JSON.stringify(await snapshot(page)));
    await page.evaluate(async () => (await import("/src/state/preferences.ts")).updatePreferences({ uiLocale: "de" }));
    equal("OPENING_LOCALE_REMAINS_CAPTURED", await dialog.getByLabel("Output size", { exact: true }).count(), 1);
    await dialog.evaluate((node) => { node.scrollTop = 0; }); await page.screenshot({ path: path.join(output, "app-output-modal.png"), fullPage: false }); await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.querySelector("dialog[open]")); await page.waitForFunction(() => document.activeElement === window.__appOutputOpener);
    equal("ACTUAL_OUTPUT_RESTORES_OPENER", await page.evaluate(() => document.activeElement === window.__appOutputOpener), true); equal("ACTUAL_OUTPUT_PRESERVES_DESKTOP_DRAFT", await page.getByLabel("Anzahl", { exact: true }).inputValue(), "11");
    await page.evaluate(async () => (await import("/src/state/preferences.ts")).updatePreferences({ uiLocale: "en" }));
    await opener.click(); await page.locator(".output-dialog").waitFor(); await page.setViewportSize({ width: 320, height: 900 });
    await page.waitForFunction(() => matchMedia("(max-width: 767px)").matches && !document.querySelector(".authoring-panel"));
    equal("OUTPUT_RESIZE_KEEPS_SINGLE_NATIVE_MODAL", await page.locator("dialog:modal").count(), 1);
    await page.evaluate(async () => { const { createGuide } = await import("/src/state/guides.ts"); const { createEmptyDocument } = await import("/src/model/instruction.ts"); const result = await createGuide(createEmptyDocument("board")); if (!result.ok) throw new Error(result.reason); });
    await page.waitForFunction(() => !document.querySelector(".output-dialog")); checks.GUIDE_SWITCH_UNMOUNTS_PENDING_OUTPUT = true;
    await page.getByRole("button", { name: "Read", exact: true }).click(); equal("READER_HAS_NO_OUTPUT_OR_EDITOR", await page.locator(".output-dialog,.app__export-canvas,.app-toolbar,[data-editor-picture]").count(), 0);
    checks.NO_CONSOLE_OR_PAGE_ERRORS = errors.length === 0; assertChecks(checks);
  } finally { await context.close(); }
} catch (error) { failure = String(error); throw error; }
finally { await mkdir(output, { recursive: true }); await writeFile(path.join(output, "app-output-integration.json"), JSON.stringify({ runAt: new Date().toISOString(), checks, errors, failure }, null, 2)); await browser?.close(); await server?.close(); }
