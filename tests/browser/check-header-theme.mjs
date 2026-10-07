import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { createServer } from "vite";
import { boot } from "./editor-browser-helpers.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));

const output = path.resolve(process.argv[2] ?? path.join(root, "artifacts", "header-theme"));
const checks = {}, errors = []; let browser, server, failure;
function check(name, value) { checks[name] = value === true; assert.equal(value, true, name); }
async function settings(page, settingsName = "Settings") {
  await page.getByRole("button", { name: settingsName, exact: true }).click();
  await page.getByRole("dialog", { name: settingsName, exact: true }).waitFor();
}
async function backup(page) {
  await settings(page);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON backup", exact: true }).click();
  const file = await pending; assert.equal(await file.failure(), null);
  const chunks = []; for await (const chunk of await file.createReadStream()) chunks.push(chunk);
  await page.keyboard.press("Escape");
  return JSON.parse(Buffer.concat(chunks).toString());
}
async function svgDownload(page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download SVG page 1 of 1", exact: true }).click();
  const file = await pending; assert.equal(await file.failure(), null);
  const chunks = []; for await (const chunk of await file.createReadStream()) chunks.push(chunk);
  return Buffer.concat(chunks);
}
try {
  await mkdir(output, { recursive: true });
  let url = process.argv[3];
  if (!url) { server = await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false } }); await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}/`; }
  browser = await chromium.launch();
  const { page, context } = await boot(browser, url, errors);
  try {
    await page.getByRole("button", { name: "New guide", exact: true }).click();
    await page.getByRole("button", { name: "Create example guide", exact: true }).click();
    await page.getByLabel("Guide title", { exact: true }).waitFor();
    await page.locator(".save-status--saved").waitFor();
    const settingsButton = page.getByRole("button", { name: "Settings", exact: true });
    check("file_actions_hidden_until_settings_opened", await page.getByRole("button", { name: "Import JSON", exact: true }).count() === 0 && await page.getByRole("button", { name: "Download JSON backup", exact: true }).count() === 0);
    await settings(page);
    const settingsControls = { theme: await page.getByRole("combobox", { name: "Theme", exact: true }).isVisible(), import: await page.getByRole("button", { name: "Import JSON", exact: true }).isVisible(), backup: await page.getByRole("button", { name: "Download JSON backup", exact: true }).isVisible() };
    check("settings_exposes_theme_import_backup", Object.values(settingsControls).every(Boolean));
    await page.keyboard.press("Escape");
    check("escape_closes_settings_and_restores_trigger", await page.getByRole("dialog").count() === 0 && await settingsButton.evaluate(node => node === document.activeElement));
    const source = await backup(page);
    await page.getByLabel("Guide title", { exact: true }).fill("Theme proof");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    check("undo_remains_directly_available", await page.getByLabel("Guide title", { exact: true }).inputValue() === source.meta.title);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    check("redo_remains_directly_available", await page.getByLabel("Guide title", { exact: true }).inputValue() === "Theme proof");
    const authored = await backup(page);
    await page.getByRole("button", { name: "Print / Download", exact: true }).click(); await page.waitForSelector('[data-output-status="ready"]');
    const lightSvg = await svgDownload(page); await page.keyboard.press("Escape");
    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const documentColors = await page.locator(".editor-group").first().evaluate(node => ({ background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color }));
    const pictureColors = await page.locator(".editor-picture__button").first().evaluate(node => ({ background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color }));
    await settings(page); await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption("dark");
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    check("dark_theme_changes_page_and_native_controls", lightBg !== await page.evaluate(() => getComputedStyle(document.body).backgroundColor) && await page.getByRole("combobox", { name: "Theme", exact: true }).evaluate(node => getComputedStyle(node).colorScheme === "dark"));
    await page.keyboard.press("Escape");
    check("settings_returns_to_visible_trigger", await settingsButton.evaluate(node => node === document.activeElement));
    assert.deepEqual(await page.locator(".editor-group").first().evaluate(node => ({ background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color })), documentColors); check("theme_keeps_document_canvas_colors", true);
    assert.deepEqual(await page.locator(".editor-picture__button").first().evaluate(node => ({ background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color })), pictureColors); check("theme_keeps_picture_colors", true);
    assert.deepEqual(await backup(page), authored); check("theme_preserves_authored_document", true);
    await page.reload(); await page.getByLabel("Guide title", { exact: true }).waitFor();
    check("dark_theme_and_guide_survive_reload", await page.evaluate(() => document.documentElement.dataset.theme === "dark") && await page.getByLabel("Guide title", { exact: true }).inputValue() === "Theme proof");
    await page.screenshot({ path: path.join(output, "desktop-dark.png"), fullPage: true });
    await page.getByRole("button", { name: "Read", exact: true }).click();
    check("reader_inherits_dark_theme", await page.locator(".reader-app").isVisible() && await page.evaluate(() => document.documentElement.dataset.theme === "dark"));
    await page.getByRole("button", { name: "Back to editing", exact: true }).click();
    await page.getByRole("button", { name: "Print / Download", exact: true }).click(); await page.waitForSelector('[data-output-status="ready"]');
    check("dark_output_chrome_keeps_white_paper", await page.locator(".output-dialog").evaluate(node => getComputedStyle(node).backgroundColor !== "rgb(255, 255, 255)") && await page.locator(".output-preview__image svg > rect").first().getAttribute("fill") === "#ffffff");
    const darkSvg = await svgDownload(page); check("light_and_dark_export_identical_svg", lightSvg.equals(darkSvg));
    await writeFile(path.join(output, "light-output.svg"), lightSvg); await writeFile(path.join(output, "dark-output.svg"), darkSvg);
    await page.screenshot({ path: path.join(output, "dark-print-preview.png"), fullPage: true }); await page.keyboard.press("Escape");
    for (const theme of ["light", "dark"]) {
      await settings(page); await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption(theme); await page.keyboard.press("Escape");
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        check(`${theme}_${width}_no_horizontal_overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        check(`${theme}_${width}_compact_save_status`, await page.locator("header .save-status--saved").evaluate(node => { const box = node.getBoundingClientRect(); return box.height <= 30 && box.width < innerWidth / 2; }));
        if (width === 390 || width === 1440) await page.screenshot({ path: path.join(output, `${width === 390 ? "mobile" : "desktop"}-${theme}.png`), fullPage: true });
      }
    }
    await settings(page);
    const chosen = page.waitForEvent("filechooser"); await page.getByRole("button", { name: "Import JSON", exact: true }).click();
    const imported = structuredClone(authored); imported.meta.title = "Imported from Settings";
    await (await chosen).setFiles({ name: "guide.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(imported)) });
    await page.getByRole("dialog").getByRole("button", { name: "Confirm", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.guide-title input')?.value === "Imported from Settings");
    check("settings_import_creates_another_guide", true);
    await page.getByRole("button", { name: "My guides", exact: true }).click();
    const previousGuide = page.getByRole("button", { name: "Open Theme proof", exact: true }); await previousGuide.waitFor();
    check("settings_import_preserves_previous_guide", await previousGuide.isVisible());
    await page.getByRole("button", { name: "Open Imported from Settings", exact: true }).click();
    await settings(page); await page.getByRole("combobox", { name: "App language", exact: true }).selectOption("de");
    const germanTheme = page.getByRole("dialog", { name: "Einstellungen", exact: true }).getByRole("combobox", { name: "Farbschema", exact: true }); await germanTheme.waitFor();
    check("german_theme_controls", await germanTheme.isVisible() && await germanTheme.locator("option").allTextContents().then(labels => labels.includes("Hell") && labels.includes("Dunkel")));
    await page.keyboard.press("Escape"); await settings(page, "Einstellungen");
    check("german_settings_file_actions", await page.getByRole("button", { name: "JSON importieren", exact: true }).isVisible());
    check("no_console_or_page_errors", errors.length === 0);
  } catch (error) { await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true }); await writeFile(path.join(output, "failure-page.txt"), await page.locator("body").innerText()); throw error; }
  finally { await context.close(); }
} catch (error) { failure = String(error); process.exitCode = 1; }
finally { await mkdir(output, { recursive: true }); await writeFile(path.join(output, "results.json"), JSON.stringify({ runAt: new Date().toISOString(), checks, errors, failure }, null, 2)); await browser?.close(); await server?.close(); }
if (failure) throw new Error(failure);
console.log(`HEADER_THEME_CHECKS=${Object.keys(checks).length}; OUTPUT_DIR=${output}`);
