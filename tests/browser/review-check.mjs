import { fileURLToPath } from "node:url";
// Semantic/locale/history/focus review checks for the print-faithful editor.
import assert from "node:assert/strict";
import process from "node:process";
import { chromium } from "playwright";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { boot, createBlank, fixture, importDocument, snapshot } from "./editor-browser-helpers.mjs";
import { assertChecks } from "../../scripts/check-results.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const out = path.resolve(process.argv[2] ?? path.join(root, "artifacts", "browser")); const url = process.argv[3] ?? "http://localhost:5173/"; const checks = {}; const errors = []; const browser = await chromium.launch();
try {
  await mkdir(out, { recursive: true }); const { page, context } = await boot(browser, url, errors, { width: 390, height: 900 });
  try {
    await createBlank(page); const doc = fixture([3, 1], "board"); doc.meta.title = "Choices";
    doc.steps[0].time = { iconId: "time.duration", seconds: 120, label: " " };
    for (const token of doc.steps[0].tokens) { token.quantity = { iconId: "quantity.amount", amount: 4, unit: "custom units", label: "" }; token.time = { iconId: "time.duration", seconds: 90, label: " " }; }
    doc.steps[0].tokens[0].warning = { iconId: "unknown-warning", label: "Stay clear" }; doc.steps[0].tokens[1].warning = { iconId: "unknown-warning" }; doc.steps[0].tokens[2].warning = { iconId: "object.onion" };
    doc.steps[1].tokens[0].iconId = "unknown-main"; doc.steps[1].tokens[0].label = "Authored unknown meaning"; doc.steps[1].description = "Optional group text"; doc.steps[1].tokens[0].note = "Optional note text";
    await importDocument(page, doc); const before = await snapshot(page); const history = await page.evaluate(async () => (await import("/src/state/document.ts")).documentSession.past.peek().length);
    await page.getByRole("button", { name: "Settings", exact: true }).click(); await page.getByLabel("App language").selectOption("de"); await page.getByLabel("Sprache für neue Bildbeschriftungen").selectOption("de");
    checks.PREFERENCES_PRESERVE_AUTHORED_CONTENT_AND_HISTORY = JSON.stringify(before) === JSON.stringify(await snapshot(page)) && history === await page.evaluate(async () => (await import("/src/state/document.ts")).documentSession.past.peek().length);
    await page.getByLabel("App-Sprache").selectOption("en"); await page.getByRole("button", { name: "Close", exact: true }).last().click(); await page.getByRole("button", { name: "Read", exact: true }).click();
    for (const mode of ["labels", "pictures", "detailed"]) {
      await page.getByLabel("Reading content").selectOption(mode); const content = page.locator(".reading-content");
      const text = await content.innerText(); checks[`REQUIRED_WARNING_VALUES_${mode}`] = text.includes("Warning: Stay clear") && text.includes("Unknown warning (unknown-warning)") && text.includes("Unknown warning (object.onion)") && text.includes("4 custom units") && text.includes("1m 30s") && text.includes("2m");
      checks[`OPTIONAL_POLICY_${mode}`] = text.includes("Optional note text") === (mode === "detailed") && text.includes("Optional group text") === (mode === "detailed");
      checks[`ONE_ACCESSIBLE_MAIN_ITEM_${mode}`] = await content.getByRole("img").count() === 4 && await content.getByRole("img", { name: "Authored unknown meaning", exact: true }).count() === 1;
      checks[`BOARD_NO_PROCEDURAL_MEANING_${mode}`] = await content.locator("ol").count() === 0 && !text.includes("Total time") && !text.includes("Step ") && await content.locator('[data-reading-presentation="board"]').count() === 1;
      const order = await content.locator("[data-reading-picture]").first().evaluate((node) => [...node.querySelectorAll("p")].map((child) => child.className)); checks[`QUANTITY_WARNING_TIME_ORDER_${mode}`] = order.indexOf("picture__quantity") < order.indexOf("picture__warning") && order.indexOf("picture__warning") < order.indexOf("picture__time");
    }
    await page.getByRole("button", { name: "Back to editing", exact: true }).click(); await page.locator("[data-add-picture]").first().click(); const dialog = page.getByRole("dialog");
    const beforeModal = await snapshot(page); await page.keyboard.press("Control+z"); await page.keyboard.press("Control+v"); checks.MODAL_SHORTCUTS_SUSPENDED = JSON.stringify(beforeModal) === JSON.stringify(await snapshot(page));
    await page.getByRole("searchbox").fill("Buch"); await page.getByLabel("Picture library").selectOption("learning"); await dialog.getByRole("button", { name: "Buch", exact: true }).click(); checks.DEFAULT_LABEL_LANGUAGE_INDEPENDENT = (await snapshot(page)).steps[0].tokens.at(-1).label === "Buch";
    await page.locator("[data-add-picture]").first().click(); await page.evaluate(async () => { const { documentSession, sessionActions } = await import("/src/state/document.ts"); sessionActions.selectStep(documentSession, documentSession.document.peek().steps[1].id); });
    await page.getByRole("searchbox").fill("Stift"); await page.locator(".token-picker").getByRole("button", { name: "Bleistift", exact: true }).click(); checks.CAPTURED_TARGET_IGNORES_AMBIENT_SELECTION = (await snapshot(page)).steps[0].tokens.at(-1).iconId === "learning.tool.pencil";
    await page.locator("[data-add-picture]").first().click(); await page.evaluate(async () => { const { documentSession, sessionActions } = await import("/src/state/document.ts"); sessionActions.removeStep(documentSession, documentSession.document.peek().steps[0].id); });
    await page.waitForFunction(() => !document.querySelector(".token-picker")); await page.getByRole("status").filter({ hasText: "This group was removed" }).waitFor(); checks.DELETED_TARGET_CLOSES_WITH_NOTICE = await page.getByRole("status").filter({ hasText: "This group was removed" }).count() === 1;
    const axe = await readFile(path.join(root, "node_modules/axe-core/axe.min.js"), "utf8"); await page.addScriptTag({ content: axe }); const results = await page.evaluate(() => window.axe.run(document, { resultTypes: ["violations"] })); checks.EDITOR_AXE_ZERO = results.violations.length === 0;
    await page.screenshot({ path: path.join(out, "semantic-editor-review.png"), fullPage: true }); checks.NO_CONSOLE_OR_PAGE_ERRORS = errors.length === 0;
    await writeFile(path.join(out, "review-checks.json"), JSON.stringify({ checks, errors, axe: results.violations }, null, 2)); assertChecks(checks); assert.deepEqual(errors, []);
  } finally { await context.close(); }
} finally { await browser.close(); }
