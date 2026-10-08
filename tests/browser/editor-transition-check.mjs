import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import process from "node:process";
import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { boot, createBlank, fixture, importDocument, snapshot, openGroup, fillDuration, durationInputTotal } from "./editor-browser-helpers.mjs";
import { assertChecks } from "../../scripts/check-results.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));

const output = path.resolve(process.argv[2] ?? path.join(root, "artifacts", "browser"));
const selectedCase = process.argv[4] ?? "all";
const evidenceTag = process.argv[5] ?? selectedCase;
const checks = {}; const errors = []; let failure; let browser; let server;
function equal(name, actual, expected) { checks[name] = actual === expected; assert.equal(actual, expected, name); }
async function inputEquals(name, input, expected) { equal(name, await input.inputValue(), expected); }
async function durationEquals(name, group, expected) { equal(name, await durationInputTotal(group), expected); }
function testDocument() {
  const doc = fixture([1, 0, 0]);
  doc.steps[0].tokens[0].quantity = { iconId: "quantity.amount", amount: 2, unit: "unfamiliar scoops", label: "Two authored scoops", extra: { retain: true } };
  doc.steps[0].tokens[0].time = { iconId: "time.duration", seconds: 60, label: "A full authored minute" };
  doc.steps[0].time = { iconId: "time.duration", seconds: 120, label: "An authored group time" };
  return doc;
}
try {
  let url = process.argv[3];
  if (!url || url === "-") { server = await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false } }); await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}/`; }
  await mkdir(output, { recursive: true }); browser = await chromium.launch();
  for (const kind of ["attachments", "modal", "focus"].filter((kind) => selectedCase === "all" || selectedCase === kind)) {
    const { page, context } = await boot(browser, url, errors, { width: 1440, height: 900 });
    try {
      await createBlank(page); const doc = testDocument(); await importDocument(page, doc);
      if (kind === "focus") {
        await openGroup(page, "group-2");
        await page.getByRole("button", { name: "Close", exact: true }).last().click();
        await page.getByRole("button", { name: "Read", exact: true }).click(); await page.getByRole("button", { name: "Back to editing", exact: true }).click();
        // Long authored attachment labels may block printing, while current
        // physical repair pages and focus targets must remain available.
        await page.waitForSelector('[data-editor-page]'); await page.waitForFunction(() => document.activeElement?.getAttribute("data-add-picture") === "group-2");
        equal("EMPTY_THIRD_GROUP_READ_RETURN", await page.evaluate(() => document.activeElement.getAttribute("data-add-picture")), "group-2");
        equal("EMPTY_GROUP_SELECTION_RETAINED", await page.evaluate(async () => (await import("/src/state/document.ts")).documentSession.selectedStepId.peek()), "group-2");
        await page.getByRole("button", { name: "Read", exact: true }).click();
        await page.evaluate(async () => { const { documentSession, sessionActions } = await import("/src/state/document.ts"); for (const group of [...documentSession.document.peek().steps]) sessionActions.removeStep(documentSession, group.id); });
        await page.getByRole("button", { name: "Back to editing", exact: true }).click();
        await page.waitForFunction(() => document.activeElement?.hasAttribute("data-add-group")); checks.DELETED_GROUP_SAFE_ADD_FALLBACK = true;
      } else {
        await page.locator("[data-editor-picture]").first().click();
        const quantity = page.getByRole("group", { name: "Quantity", exact: true }); const amount = quantity.getByLabel("Amount", { exact: true }); const unit = quantity.getByLabel("Unit", { exact: true });
        const time = page.getByRole("group", { name: "Time", exact: true });
        if (kind === "attachments") {
          const original = JSON.stringify((await snapshot(page)).steps[0]);
          await quantity.getByRole("button", { name: "Save", exact: true }).click(); await time.getByRole("button", { name: "Save", exact: true }).click();
          equal("UNCHANGED_AUTHORED_LABELS_AND_CUSTOM_UNIT", JSON.stringify((await snapshot(page)).steps[0]), original);
          await amount.fill("7"); await quantity.getByRole("button", { name: "Save", exact: true }).click(); await page.getByRole("button", { name: "Undo", exact: true }).click();
          await inputEquals("TOKEN_QUANTITY_UNDO", amount, "2"); await page.getByRole("button", { name: "Redo", exact: true }).click(); await inputEquals("TOKEN_QUANTITY_REDO", amount, "7");
          await fillDuration(time, 90); await time.getByRole("button", { name: "Save", exact: true }).click(); await page.getByRole("button", { name: "Undo", exact: true }).click();
          await durationEquals("TOKEN_TIME_UNDO", time, 60); await page.getByRole("button", { name: "Redo", exact: true }).click(); await durationEquals("TOKEN_TIME_REDO", time, 90);
          await quantity.getByRole("button", { name: "Remove quantity", exact: true }).click(); await inputEquals("QUANTITY_REMOVAL_RESETS", amount, "1"); await inputEquals("QUANTITY_REMOVAL_UNIT_RESETS", unit, "pcs");
          await page.getByRole("button", { name: "Undo", exact: true }).click(); await inputEquals("QUANTITY_REMOVAL_UNDO", amount, "7"); await inputEquals("CUSTOM_UNIT_REMOVAL_UNDO", unit, "unfamiliar scoops");
          await time.getByRole("button", { name: "Remove time", exact: true }).click(); await durationEquals("TOKEN_TIME_REMOVAL_RESETS", time, 60);
          await page.getByRole("button", { name: "Undo", exact: true }).click(); await durationEquals("TOKEN_TIME_REMOVAL_UNDO", time, 90);
          await amount.fill("11"); await unit.fill("typed unsaved unit"); await fillDuration(time, 135); await page.getByLabel("Guide title", { exact: true }).fill("Unrelated title change");
          await inputEquals("UNRELATED_DOCUMENT_RENDER_PRESERVES_AMOUNT", amount, "11"); await inputEquals("UNRELATED_DOCUMENT_RENDER_PRESERVES_UNIT", unit, "typed unsaved unit"); await durationEquals("UNRELATED_DOCUMENT_RENDER_PRESERVES_TIME", time, 135);
          await page.getByRole("button", { name: "Settings", exact: true }).click(); await page.getByLabel("Default picture label language").selectOption("de"); await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
          await inputEquals("PREFERENCE_RENDER_PRESERVES_AMOUNT", amount, "11"); await inputEquals("PREFERENCE_RENDER_PRESERVES_UNIT", unit, "typed unsaved unit"); await durationEquals("PREFERENCE_RENDER_PRESERVES_TIME", time, 135);
          await page.getByRole("button", { name: "Close", exact: true }).last().click(); await openGroup(page, "group-0");
          const groupTime = page.getByRole("group", { name: "Time", exact: true });
          await groupTime.getByRole("button", { name: "Save", exact: true }).click(); equal("UNCHANGED_GROUP_AUTHORED_TIME_LABEL", (await snapshot(page)).steps[0].time.label, "An authored group time");
          await fillDuration(groupTime, 180); await groupTime.getByRole("button", { name: "Save", exact: true }).click(); await page.getByRole("button", { name: "Undo", exact: true }).click(); await durationEquals("GROUP_TIME_UNDO", groupTime, 120);
          await page.getByRole("button", { name: "Redo", exact: true }).click(); await durationEquals("GROUP_TIME_REDO", groupTime, 180);
          await groupTime.getByRole("button", { name: "Remove time", exact: true }).click(); await durationEquals("GROUP_TIME_REMOVAL_RESETS", groupTime, 60); await page.getByRole("button", { name: "Undo", exact: true }).click(); await durationEquals("GROUP_TIME_REMOVAL_UNDO", groupTime, 180);
          // A real second tab commits a winning revision. Reload adopts it with this panel still mounted.
          await page.evaluate(async () => { const result = await (await import("/src/state/guide-bootstrap.ts")).guideBootstrap.controller().flushActiveGuide(); if (!result.ok) throw new Error(result.reason); });
          const peer = await context.newPage(); peer.on("pageerror", (error) => errors.push(error.message)); peer.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); }); await peer.goto(url); await peer.getByLabel("Guide title", { exact: true }).waitFor();
          await peer.evaluate(async () => { const { documentSession: session, sessionActions: actions } = await import("/src/state/document.ts"); const step = session.document.peek().steps[0]; actions.attachToToken(session, step.id, step.tokens[0].id, { kind: "quantity", value: { iconId: "quantity.amount", amount: 4, unit: "reload custom unit", label: "Four authored reload units" } }); actions.setTokenTime(session, step.id, step.tokens[0].id, { iconId: "time.duration", seconds: 150, label: "Authored token reload time" }); actions.setStepTime(session, step.id, { iconId: "time.duration", seconds: 240, label: "Authored group reload time" }); const result = await (await import("/src/state/guide-bootstrap.ts")).guideBootstrap.controller().flushActiveGuide(); if (!result.ok) throw new Error(result.reason); });
          await fillDuration(groupTime, 999); await page.getByLabel("Guide title", { exact: true }).fill("Losing local title"); await page.locator(".save-status--conflict").waitFor();
          await page.getByRole("button", { name: "Reload saved guide", exact: true }).click(); await page.getByRole("dialog").getByRole("button", { name: "Reload saved guide", exact: true }).click(); await page.waitForFunction(() => !document.querySelector("dialog"));
          await durationEquals("MOUNTED_GROUP_RELOAD", groupTime, 240);
          await page.getByRole("button", { name: "Close", exact: true }).last().click(); await page.locator("[data-editor-picture]").first().click();
          await amount.fill("888"); await fillDuration(time, 777);
          await peer.evaluate(async () => { const { documentSession: session, sessionActions: actions } = await import("/src/state/document.ts"); const step = session.document.peek().steps[0]; actions.attachToToken(session, step.id, step.tokens[0].id, { kind: "quantity", value: { iconId: "quantity.amount", amount: 5, unit: "next custom unit", label: "Five authored reload units" } }); actions.setTokenTime(session, step.id, step.tokens[0].id, { iconId: "time.duration", seconds: 300, label: "Five authored minutes" }); const result = await (await import("/src/state/guide-bootstrap.ts")).guideBootstrap.controller().flushActiveGuide(); if (!result.ok) throw new Error(result.reason); });
          await page.getByLabel("Guide title", { exact: true }).fill("Another losing local title"); await page.locator(".save-status--conflict").waitFor(); await page.getByRole("button", { name: "Reload saved guide", exact: true }).click(); await page.getByRole("dialog").getByRole("button", { name: "Reload saved guide", exact: true }).click(); await page.waitForFunction(() => !document.querySelector("dialog"));
          await inputEquals("MOUNTED_TOKEN_QUANTITY_RELOAD", amount, "5"); await inputEquals("MOUNTED_TOKEN_UNIT_RELOAD", unit, "next custom unit"); await durationEquals("MOUNTED_TOKEN_TIME_RELOAD", time, 300);
          await quantity.getByRole("button", { name: "Save", exact: true }).click(); await time.getByRole("button", { name: "Save", exact: true }).click(); const reloaded = (await snapshot(page)).steps[0].tokens[0]; equal("RELOAD_UNCHANGED_QUANTITY_LABEL", reloaded.quantity.label, "Five authored reload units"); equal("RELOAD_UNCHANGED_TIME_LABEL", reloaded.time.label, "Five authored minutes");
        } else {
          await amount.fill("11"); await fillDuration(time, 135); const before = JSON.stringify(await snapshot(page));
          const assertDraft = async (prefix) => { equal(`${prefix}_BACKGROUND_PANEL`, await page.locator(".authoring-panel").count(), 1); await inputEquals(`${prefix}_AMOUNT_DRAFT`, amount, "11"); await durationEquals(`${prefix}_TIME_DRAFT`, time, 135); equal(`${prefix}_CONTENT_UNCHANGED`, JSON.stringify(await snapshot(page)), before); };
          const settings = page.getByRole("button", { name: "Settings", exact: true }); await settings.click(); await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.querySelector("dialog[open]")); await assertDraft("SETTINGS_ESCAPE"); equal("SETTINGS_OPENER_FOCUS", await settings.evaluate((node) => node === document.activeElement), true);
          const importOpener = page.getByRole("button", { name: "Settings", exact: true }); await importOpener.focus(); await page.getByLabel("Choose a JSON guide file", { exact: true }).setInputFiles({ name: "pending.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(doc)) }); await page.getByRole("dialog").waitFor(); await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.querySelector("dialog[open]")); await assertDraft("IMPORT_ESCAPE"); equal("IMPORT_OPENER_FOCUS", await importOpener.evaluate((node) => node === document.activeElement), true);
          const outputOpener = page.getByRole("button", { name: "Print / Download", exact: true }); await outputOpener.click(); await page.getByRole("dialog").waitFor(); await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.querySelector("dialog[open]")); await assertDraft("OUTPUT_ESCAPE"); await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Print / Download"); equal("OUTPUT_OPENER_FOCUS", await outputOpener.evaluate((node) => node === document.activeElement), true);
          await amount.evaluate((node) => node.addEventListener("keydown", (event) => event.preventDefault(), { once: true })); await amount.focus(); await page.keyboard.press("Escape"); await assertDraft("CONSUMED_ESCAPE");
          await page.setViewportSize({ width: 390, height: 900 }); await page.locator("dialog:modal").waitFor(); await inputEquals("VIEWPORT_TRANSITION_KEEPS_AMOUNT_DRAFT", amount, "11"); await durationEquals("VIEWPORT_TRANSITION_KEEPS_TIME_DRAFT", time, 135); await outputOpener.evaluate((node) => node.click()); await page.waitForFunction(() => document.querySelectorAll("dialog:modal").length === 1 && !document.querySelector(".token-details")); checks.MOBILE_OUTPUT_HAS_SINGLE_MODAL = true;
          await page.keyboard.press("Escape"); await page.setViewportSize({ width: 1440, height: 900 }); await page.locator("[data-editor-picture]").first().click(); await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.querySelector(".authoring-panel")); checks.NORMAL_DESKTOP_ESCAPE_STILL_CLOSES = true;
        }
      }
      await page.screenshot({ path: path.join(output, `editor-transition-${kind}.png`), fullPage: true });
    } finally { await context.close(); }
  }
  checks.NO_CONSOLE_OR_PAGE_ERRORS = errors.length === 0; assertChecks(checks);
} catch (error) { failure = String(error); throw error; }
finally { await mkdir(output, { recursive: true }); await writeFile(path.join(output, `editor-transition-${evidenceTag}.json`), JSON.stringify({ runAt: new Date().toISOString(), checks, errors, failure }, null, 2)); await browser?.close(); await server?.close(); }
