import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const { boot } = await import(pathToFileURL(path.resolve(".claude/skills/run-instruction-builder/editor-browser-helpers.mjs")));
const stage = process.argv[2] ?? "before", output = path.resolve("docs/phase-3/audits/2026-10-07-drag-design/design", stage);
if (stage === "compare") {
  const root = path.resolve("docs/phase-3/audits/2026-10-07-drag-design/design");
  const before = JSON.parse(await readFile(path.join(root, "before/results.json"), "utf8"));
  const after = JSON.parse(await readFile(path.join(root, "after/results.json"), "utf8"));
  assert.equal(before.entries.length, 80); assert.equal(after.entries.length, 80);
  let svgMatches = 0;
  for (const entry of after.entries) {
    const prior = before.entries.find(item => item.name === entry.name && item.state === entry.state);
    assert.ok(prior, `${entry.name}-${entry.state} has baseline evidence`);
    for (const key of ["documentColors", "pictureColors", "readingColors"]) assert.deepEqual(entry[key], prior[key], `${entry.name}-${entry.state} ${key}`);
    if (entry.state === "output") { assert.equal(entry.svgHash, prior.svgHash, `${entry.name} physical SVG unchanged`); svgMatches++; }
  }
  assert.equal(svgMatches, 16);
  await writeFile(path.join(root, "comparison.json"), JSON.stringify({ runAt: new Date().toISOString(), colorCasesEqual: 80, physicalSvgHashesEqual: svgMatches }, null, 2));
  console.log("DOCUMENT_COLOR_CASES_EQUAL=80; PHYSICAL_SVG_HASHES_EQUAL=16"); process.exit(0);
}
const fixture = JSON.parse(await readFile("docs/phase-3/audits/2026-10-06-overhaul/editor-proof/workplace-prototype.json", "utf8"));
fixture.steps[0].tokens.push(
  { id: "design-banana", iconId: "object.banana", category: "object", label: "Banana", quantity: { iconId: "quantity.amount", label: "5435 g", amount: 5435, unit: "g" }, time: { iconId: "time.duration", label: "9m 3s", seconds: 543 }, warning: { iconId: "warning.sharp", label: "Sharp!" } },
  { id: "design-onion", iconId: "object.onion", category: "object", label: "Onion" },
  { id: "design-container", iconId: "tool.container", category: "tool", label: "Food container" },
  { id: "design-chop", iconId: "action.chop", category: "action", label: "Chop onion" }
);
const errors = [], entries = [], designChecks = [];
let server, browser, failure;
const names = { en: { settings: "Settings", output: "Print / Download", details: "More details", close: "Close" }, de: { settings: "Einstellungen", output: "Drucken / Herunterladen", details: "Mehr Details", close: "Schließen" } };
async function capture(page, name, state) {
  const measured = await page.evaluate(() => {
    const visible = node => { const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== "hidden"; };
    const modal = document.querySelector("dialog[open]"), panel = document.querySelector(".authoring-panel"), surface = modal ?? panel ?? document.querySelector(".app");
    const controls = [...surface.querySelectorAll("button,input:not([type=hidden]):not(.visually-hidden),select,textarea")].filter(visible).map(node => {
      const box = node.getBoundingClientRect(); return { name: node.getAttribute("aria-label") ?? node.textContent?.trim() ?? node.tagName, width: box.width, height: box.height, minHeight: getComputedStyle(node).minHeight };
    });
    const pictures = [...document.querySelectorAll(".editor-pictures")][0];
    const columns = pictures ? new Set([...pictures.children].map(node => Math.round(node.getBoundingClientRect().x))).size : 0;
    const colors = selector => { const node = document.querySelector(selector); return node ? { background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color } : null; };
    const box = surface.getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth > innerWidth, surfaceOverflow: surface.scrollWidth > surface.clientWidth + 1, controls, columns, surface: { x: box.x, y: box.y, width: box.width, height: box.height }, documentColors: colors(".editor-group"), pictureColors: colors(".editor-picture__button"), readingColors: colors(".reading-content"), paperFill: document.querySelector(".output-preview__image svg > rect")?.getAttribute("fill") };
  });
  assert.equal(measured.overflow, false, `${name}-${state} page overflow`);
  assert.equal(measured.surfaceOverflow, false, `${name}-${state} surface overflow`);
  assert.equal(measured.controls.every(control => control.width >= 43.99 && control.height >= 43.99), true, `${name}-${state} minimum controls`);
  if (["390-en-light", "1440-en-light", "320-de-dark", "768-de-dark"].includes(name)) {
    await page.screenshot({ path: path.join(output, `${name}-${state}.png`), fullPage: state === "editor" });
  }
  const svg = state === "output" ? await page.locator(".output-preview__image svg").evaluate(node => node.outerHTML) : undefined;
  entries.push({ name, state, ...measured, ...(svg ? { svgHash: createHash("sha256").update(svg).digest("hex") } : {}) });
  if (state === "editor" && Number(name.split("-")[0]) <= 390) designChecks.push({ name: `${name} two picture columns`, pass: measured.columns >= 2 });
}
try {
  await mkdir(output, { recursive: true });
  server = await createServer({ server: { host: "127.0.0.1", port: 0, open: false } }); await server.listen();
  const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
  browser = await chromium.launch();
  for (const locale of ["en", "de"]) for (const theme of ["light", "dark"]) for (const width of [320, 390, 768, 1440]) {
    const name = `${width}-${locale}-${theme}`, n = names[locale], id = "isolated-design-guide", now = "2026-10-07T00:00:00Z";
    const seed = [["instruction-builder:preferences:v1", { version: 1, preferences: { uiLocale: locale, labelLocale: locale, theme, activeLibraryId: "kitchen", lastGuideId: id } }], ["instruction-builder:guide:" + id, { id, revision: 1, createdAt: now, updatedAt: now, document: fixture }]];
    const { page, context } = await boot(browser, url, errors, { width, height: 1000 }, seed);
    try {
      await page.locator(".editor-group").first().waitFor(); await capture(page, name, "editor");
      await page.locator("[data-add-picture]").first().click(); await page.locator(".token-picker").waitFor(); await capture(page, name, "picker"); await page.keyboard.press("Escape");
      await page.locator(".editor-picture__button").first().click(); await page.locator(".token-details").waitFor(); await page.locator(".token-details").getByRole("button", { name: n.details, exact: true }).click(); await capture(page, name, "details"); await page.keyboard.press("Escape");
      await page.getByRole("button", { name: n.settings, exact: true }).click(); await page.getByRole("dialog", { name: n.settings, exact: true }).waitFor(); await capture(page, name, "settings"); await page.keyboard.press("Escape");
      await page.getByRole("button", { name: n.output, exact: true }).click(); await page.waitForSelector('[data-output-status="ready"]'); await capture(page, name, "output"); await page.keyboard.press("Escape");
    } finally { await context.close(); }
  }
  assert.equal(errors.length, 0, "no console/page errors");
  assert.equal(designChecks.every(check => check.pass), true, "two picture columns in phone widths");
} catch (error) { failure = String(error); process.exitCode = 1; }
finally {
  await mkdir(output, { recursive: true }); await writeFile(path.join(output, "results.json"), JSON.stringify({ runAt: new Date().toISOString(), stage, entries, designChecks, errors, failure }, null, 2));
  await browser?.close(); await server?.close();
}
if (failure) throw new Error(failure);
console.log(`DESIGN_CASES=${entries.length}; DESIGN_CHECKS=${designChecks.filter(check => check.pass).length}/${designChecks.length}; OUTPUT_DIR=${output}`);
