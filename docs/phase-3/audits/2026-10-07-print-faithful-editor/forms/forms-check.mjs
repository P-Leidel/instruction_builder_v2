import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";
import { createServer } from "vite";

import { boot, fixture, snapshot } from "../../../../../tests/browser/editor-browser-helpers.mjs";
const stage = process.argv[2] ?? "after", isolated = process.argv.includes("--isolated");
const output = path.resolve("docs/phase-3/audits/2026-10-07-print-faithful-editor/forms", stage);
const checks = {}, errors = []; let browser, server, failure;
function check(name, condition) { checks[name] = condition === true; assert.equal(condition, true, name); }
async function message(page, key) { return page.evaluate(async key => { const { t } = await import("/src/i18n/messages.ts"); const { preferences } = await import("/src/state/preferences.ts"); return t(preferences.peek().uiLocale, key); }, key); }
async function label(page, key) { return key === "warning.title" ? (await section(page, key)).locator("select") : key === "editor.moveToGroup" ? page.locator(".editor-actions select") : page.getByLabel(await message(page, key), { exact: true }); }
async function section(page, key) { return page.locator("fieldset").filter({ has: page.locator("legend", { hasText: new RegExp(`^${await message(page, key)}$`) }) }); }
async function open(page, kind, group = "group-0", token = "picture-0-0") {
  await page.evaluate(async ({ kind, group, token }) => {
    const { authoring, capturePanelOpener } = await import("/src/state/ui.ts");
    document.querySelector(`[data-editor-picture="${token}"]`)?.focus(); capturePanelOpener();
    if (kind === "picture") authoring.openPicture(group, token); else authoring.openGroup(group);
  }, { kind, group, token });
  await (await label(page, kind === "picture" ? "editor.pictureLabel" : "editor.groupTitle")).waitFor();
}
async function close(page) { await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.querySelector(".authoring-panel,dialog.context-sheet[open]")); }
async function actions(page) { return page.locator("summary", { hasText: await message(page, "editor.actions") }); }
async function save(page, key) { await (await section(page, key)).getByRole("button", { name: await message(page, "dialog.save"), exact: true }).click(); }
function token(document) { return document.steps.flatMap(group => group.tokens).find(picture => picture.id === "picture-0-0"); }

try {
  await mkdir(output, { recursive: true });
  server = await createServer({ server: { host: "127.0.0.1", port: 0, open: false, watch: isolated ? null : undefined } }); await server.listen();
  browser = await chromium.launch(); const url = `http://127.0.0.1:${server.httpServer.address().port}/${isolated ? "docs/phase-3/audits/2026-10-07-print-faithful-editor/forms/harness.html" : ""}`;
  for (const locale of ["en", "de"]) {
    const source = fixture([2, 1]); source.meta.title = "Compact form proof";
    source.steps[0].description = "Preserved group description";
    source.steps[0].time = { iconId: "future.group-clock", seconds: 90061, label: "Authored group time" };
    Object.assign(source.steps[0].tokens[0], { label: "Banana", note: "Preserved optional note",
      quantity: { iconId: "future.quantity", amount: 5435, unit: "custom trays", label: "Authored quantity" },
      time: { iconId: "future.clock", seconds: 543, label: "Authored picture time" },
      warning: { iconId: "future.warning", label: "Authored warning" }, metadata: { imported: true } });
    const id = `compact-forms-${locale}`, now = "2026-10-07T00:00:00Z";
    const seed = [["instruction-builder:preferences:v1", { version: 1, preferences: { uiLocale: locale, labelLocale: locale, theme: locale === "en" ? "light" : "dark", activeLibraryId: "kitchen", lastGuideId: id } }],
      [`instruction-builder:guide:${id}`, { id, revision: 1, createdAt: now, updatedAt: now, document: source }]];
    const { page, context } = await boot(browser, url, errors, { width: 1440, height: 1000 }, seed);
    try {
      if (isolated) await page.evaluate(async ({ source, locale }) => {
        const { documentSession } = await import("/src/state/document.ts"); const { preferences } = await import("/src/state/preferences.ts");
        documentSession.document.value = source; preferences.value = { ...preferences.peek(), uiLocale: locale, labelLocale: locale, theme: locale === "en" ? "light" : "dark" };
      }, { source, locale });
      await open(page, "picture"); await page.screenshot({ path: path.join(output, `${locale}-desktop-picture.png`), fullPage: false });
      check(`${locale}_quantity_immediately_visible`, await (await label(page, "quantity.amount")).isVisible());
      check(`${locale}_warning_immediately_visible`, await (await label(page, "warning.label")).isVisible());
      check(`${locale}_readable_duration_parts`, await (await label(page, "time.days")).inputValue() === "0" && await (await label(page, "time.hours")).inputValue() === "0" && await (await label(page, "time.minutes")).inputValue() === "9" && await (await label(page, "time.remainingSeconds")).inputValue() === "3");
      check(`${locale}_quiet_actions_closed`, !await (await label(page, "editor.note")).isVisible() && !await page.getByRole("button", { name: await message(page, "editor.copyPicture"), exact: true }).isVisible());
      check(`${locale}_native_disclosure`, await (await actions(page)).evaluate(node => node.parentElement.tagName === "DETAILS" && !node.parentElement.open));
      check(`${locale}_unknown_warning_label_visible`, await (await label(page, "warning.label")).inputValue() === "Authored warning" && await (await label(page, "warning.title")).inputValue() === "future.warning");
      await save(page, "quantity.title"); await save(page, "time.title");
      assert.deepEqual(await snapshot(page), source); check(`${locale}_opening_and_unchanged_saves_preserve_imported_data`, true);
      const amount = await label(page, "quantity.amount"), unit = await label(page, "quantity.unit"), minutes = await label(page, "time.minutes"), seconds = await label(page, "time.remainingSeconds");
      await amount.fill("17"); await unit.fill("unsaved custom unit"); await minutes.fill("12"); await seconds.fill("4");
      await (await label(page, "editor.pictureLabel")).fill("Renamed banana");
      check(`${locale}_unrelated_commit_keeps_drafts`, await amount.inputValue() === "17" && await unit.inputValue() === "unsaved custom unit" && await minutes.inputValue() === "12" && await seconds.inputValue() === "4");
      await page.setViewportSize({ width: 390, height: 1000 }); await page.locator("dialog.context-sheet[open]").waitFor();
      check(`${locale}_resize_keeps_drafts`, await (await label(page, "quantity.amount")).inputValue() === "17" && await (await label(page, "quantity.unit")).inputValue() === "unsaved custom unit" && await (await label(page, "time.minutes")).inputValue() === "12" && await (await label(page, "time.remainingSeconds")).inputValue() === "4");
      const summary = await actions(page); await summary.focus(); await page.keyboard.press("Enter");
      check(`${locale}_keyboard_actions`, await (await label(page, "editor.note")).isVisible());
      await page.getByRole("button", { name: await message(page, "editor.copyPicture"), exact: true }).click();
      const copied = await page.evaluate(async () => (await import("/src/state/document.ts")).documentSession.copiedToken.peek());
      const original = token(await snapshot(page));
      assert.deepEqual({ ...copied, id: original.id }, original); check(`${locale}_quiet_copy_keeps_authored_data`, copied.id !== original.id);
      await summary.click(); await summary.focus(); await page.keyboard.press("Tab");
      await writeFile(path.join(output, `${locale}-focus-diagnostic.json`), JSON.stringify(await page.evaluate(() => ({ active: document.activeElement.outerHTML, nodes: [...document.querySelector('dialog.context-sheet')?.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]') ?? []].map(node => ({ html: node.outerHTML, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, hiddenDisclosure: !!node.closest('details:not([open])') })) })), null, 2));
      check(`${locale}_closed_actions_summary_is_last_tab_stop`, await page.getByRole("button", { name: await message(page, "dialog.close"), exact: true }).evaluate(node => node === document.activeElement));
      await page.screenshot({ path: path.join(output, `${locale}-mobile-picture.png`), fullPage: false });
      const unchanged = token(await snapshot(page)).time;
      for (const [part, value, name] of [["time.minutes", "1.5", "fractional"], ["time.remainingSeconds", "-1", "negative"], ["time.hours", "", "blank"], ["time.days", "100", "over_maximum"]]) {
        await (await label(page, part)).fill(value); await save(page, "time.title");
        assert.deepEqual(token(await snapshot(page)).time, unchanged); check(`${locale}_${name}_duration_rejected`, await (await section(page, "time.title")).getByRole("alert").isVisible());
        await (await label(page, "time.days")).fill("0"); await (await label(page, "time.hours")).fill("0"); await (await label(page, "time.minutes")).fill("12"); await (await label(page, "time.remainingSeconds")).fill("4");
      }
      await save(page, "time.title"); check(`${locale}_structured_duration_save`, token(await snapshot(page)).time.seconds === 724 && token(await snapshot(page)).time.label === "12m 4s");
      await page.evaluate(async () => { const { sessionActions, documentSession } = await import("/src/state/document.ts"); sessionActions.undo(documentSession); });
      await page.waitForFunction(() => [...document.querySelectorAll("input")].some(input => input.value === "9"));
      check(`${locale}_undo_reconciles_duration`, await (await label(page, "time.minutes")).inputValue() === "9" && await (await label(page, "time.remainingSeconds")).inputValue() === "3");
      await save(page, "quantity.title"); check(`${locale}_quantity_custom_unit_save`, token(await snapshot(page)).quantity.amount === 17 && token(await snapshot(page)).quantity.unit === "unsaved custom unit");
      const quantity = token(await snapshot(page)).quantity;
      for (const invalidAmount of ["0", "1.5", "100000"]) {
        await (await label(page, "quantity.amount")).fill(invalidAmount); await save(page, "quantity.title");
        assert.deepEqual(token(await snapshot(page)).quantity, quantity); check(`${locale}_invalid_quantity_${invalidAmount}_preserves_data`, await (await section(page, "quantity.title")).getByRole("alert").isVisible());
      }
      await (await label(page, "quantity.amount")).fill("17"); await save(page, "quantity.title");
      await (await section(page, "quantity.title")).getByRole("button", { name: await message(page, "quantity.remove"), exact: true }).click();
      check(`${locale}_quantity_remove`, token(await snapshot(page)).quantity === undefined);
      await page.evaluate(async () => { const { sessionActions, documentSession } = await import("/src/state/document.ts"); sessionActions.undo(documentSession); });
      check(`${locale}_quantity_undo_reconciles_draft`, await (await label(page, "quantity.amount")).inputValue() === "17" && await (await label(page, "quantity.unit")).inputValue() === "unsaved custom unit");
      await page.evaluate(async () => { const { sessionActions, documentSession } = await import("/src/state/document.ts"); sessionActions.redo(documentSession); });
      check(`${locale}_quantity_redo_reconciles_draft`, await (await label(page, "quantity.amount")).inputValue() === "1" && await (await label(page, "quantity.unit")).inputValue() === "pcs");
      await page.evaluate(async () => { const { sessionActions, documentSession } = await import("/src/state/document.ts"); sessionActions.undo(documentSession); });
      await (await label(page, "time.days")).fill("99"); await (await label(page, "time.hours")).fill("0"); await (await label(page, "time.minutes")).fill("0"); await (await label(page, "time.remainingSeconds")).fill("0"); await save(page, "time.title");
      check(`${locale}_duration_maximum_accepted`, token(await snapshot(page)).time.seconds === 99 * 86400);
      await (await label(page, "time.remainingSeconds")).fill("1"); await save(page, "time.title");
      check(`${locale}_duration_maximum_plus_one_rejected`, token(await snapshot(page)).time.seconds === 99 * 86400 && await (await section(page, "time.title")).getByRole("alert").isVisible());
      await page.evaluate(async () => { const { sessionActions, documentSession } = await import("/src/state/document.ts"); sessionActions.undo(documentSession); });
      await (await label(page, "time.days")).fill("0"); await (await label(page, "time.minutes")).fill("0"); await (await label(page, "time.remainingSeconds")).fill("0"); await save(page, "time.title");
      check(`${locale}_zero_duration_rejected`, token(await snapshot(page)).time.seconds === 543 && await (await section(page, "time.title")).getByRole("alert").isVisible());
      await (await label(page, "time.minutes")).fill("9"); await (await label(page, "time.remainingSeconds")).fill("63"); await save(page, "time.title");
      check(`${locale}_duration_carry_normalizes_after_real_change`, token(await snapshot(page)).time.seconds === 603 && await (await label(page, "time.minutes")).inputValue() === "10" && await (await label(page, "time.remainingSeconds")).inputValue() === "3");
      await page.evaluate(async () => { const { sessionActions, documentSession } = await import("/src/state/document.ts"); sessionActions.undo(documentSession); });
      await close(page); await open(page, "group");
      check(`${locale}_group_primary_name_time`, await (await label(page, "editor.groupTitle")).isVisible() && await (await label(page, "time.days")).inputValue() === "1" && await (await label(page, "time.hours")).inputValue() === "1" && await (await label(page, "time.minutes")).inputValue() === "1" && await (await label(page, "time.remainingSeconds")).inputValue() === "1");
      check(`${locale}_group_description_and_moves_quiet`, !await (await label(page, "editor.description")).isVisible() && !await page.getByRole("button", { name: await message(page, "editor.moveGroupLater"), exact: true }).isVisible());
      await save(page, "time.title"); assert.deepEqual((await snapshot(page)).steps[0].time, source.steps[0].time); check(`${locale}_unchanged_group_time_keeps_custom_label`, true);
      await (await actions(page)).click(); await page.getByRole("button", { name: await message(page, "editor.moveGroupLater"), exact: true }).click();
      check(`${locale}_accessible_group_move`, (await snapshot(page)).steps[1].id === "group-0");
      await page.screenshot({ path: path.join(output, `${locale}-mobile-group-actions.png`), fullPage: false }); await close(page);
      await open(page, "picture"); await (await actions(page)).click();
      await (await label(page, "editor.moveToGroup")).selectOption("group-1");
      const moved = await snapshot(page); check(`${locale}_accessible_picture_move_keeps_data`, moved.steps.find(group => group.id === "group-1").tokens.at(-1).id === "picture-0-0" && token(moved).warning.label === "Authored warning" && token(moved).note === source.steps[0].tokens[0].note && token(moved).metadata.imported === true);
      await open(page, "picture", "group-1"); await (await actions(page)).click();
      await page.getByRole("button", { name: await message(page, "editor.movePicture"), exact: true }).click();
      check(`${locale}_touch_move_closes_modal`, await page.locator("dialog.context-sheet[open]").count() === 0);
      await open(page, "picture", "group-1");
      await page.evaluate(async () => { const { sessionActions, documentSession } = await import("/src/state/document.ts"); sessionActions.removeTokenFromStep(documentSession, "group-1", "picture-0-0"); });
      await page.waitForFunction(() => !document.querySelector(".authoring-panel,dialog.context-sheet[open]"));
      await page.waitForFunction(() => document.activeElement?.matches("[data-add-picture],[data-add-group]"));
      check(`${locale}_removed_target_closes_and_returns_focus`, await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.isConnected && document.activeElement.matches("[data-add-picture],[data-add-group]")));
    } catch (error) { await page.screenshot({ path: path.join(output, `${locale}-failure.png`), fullPage: false }); await writeFile(path.join(output, `${locale}-failure-page.txt`), await page.locator("body").innerText()); throw error; }
    finally { await context.close(); }
  }
  check("zero_browser_errors", errors.length === 0);
} catch (error) { failure = String(error); process.exitCode = 1; }
finally { await mkdir(output, { recursive: true }); await writeFile(path.join(output, "results.json"), JSON.stringify({ runAt: new Date().toISOString(), isolated, checks, errors, failure }, null, 2)); await browser?.close(); await server?.close(); }
if (failure) throw new Error(failure);
console.log(`COMPACT_FORM_CHECKS=${Object.keys(checks).length}; OUTPUT_DIR=${output}`);
