import { fileURLToPath } from "node:url";
// Full-app output audit: node export-review.mjs <output-dir> <url> ("-" owns a dev server).
import process from "node:process";
import { Buffer } from "node:buffer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";
import { assertChecks } from "../../scripts/check-results.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));


const output = path.resolve(process.argv[2] ?? path.join(root, "artifacts", "browser", "export-review")), checks = {}, errors = [], files = [];
let browser, server, failure;
function check(name, value) { checks[name] = value === true; assert.equal(value, true, name); }
const mixed = title => ({ schemaVersion: 2, meta: { title, presentation: "sequence", domain: "proof", createdAt: "2026-10-06T00:00:00Z" }, steps: [
  { id: "kitchen-group", title: "Kitchen group", tokens: [{ id: "kitchen-token", category: "action", iconId: "action.chop", label: "Chop" }] },
  { id: "routine-group", title: "Routine group", tokens: [{ id: "routine-token", category: "action", iconId: "routines.action.wash-hands", label: "Wash hands" }] },
  { id: "learning-group", title: "Learning group", tokens: [{ id: "learning-token", category: "action", iconId: "learning.action.count", label: "Count" }] },
] });
async function importGuide(page, doc) {
  await page.getByLabel("Choose a JSON guide file", { exact: true }).setInputFiles({ name: "output-fixture.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(doc)) });
  await page.getByRole("dialog").getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByLabel("Guide title", { exact: true }).waitFor();
  await page.waitForFunction(title => document.querySelector(".guide-title input")?.value === title, doc.meta.title);
}
async function openOutput(page) {
  await page.getByRole("button", { name: "Print / Download", exact: true }).click();
  await page.getByLabel("Output size", { exact: true }).waitFor({ timeout: 5000 });
}
async function ready(page) { await page.waitForSelector('[data-output-status="ready"]'); }
async function inspectSvg(page, bytes) {
  return page.evaluate(xml => {
    const svg = new DOMParser().parseFromString(xml, "image/svg+xml").documentElement;
    if (svg.localName !== "svg" || svg.querySelector("parsererror")) throw new Error("Corrupt SVG");
    return { width: svg.getAttribute("width"), height: svg.getAttribute("height"), viewBox: svg.getAttribute("viewBox"),
      ids: [...svg.querySelectorAll('[data-output-role="token"]')].map(node => node.getAttribute("data-token-id")),
      texts: [...svg.querySelectorAll("[data-output-text]")].map(node => node.getAttribute("data-output-text")),
      textRuns: [...svg.querySelectorAll("[data-output-text]")].map(node => ({ text: node.getAttribute("data-output-text"), role: node.getAttribute("data-output-role"), tokenId: node.getAttribute("data-token-id") })),
      white: [...svg.querySelectorAll(":scope > rect")].some(node => node.getAttribute("fill") === "#ffffff"),
      forbidden: svg.querySelectorAll("text,image,script,foreignObject").length,
      external: [...svg.querySelectorAll("*")].some(node => [...node.attributes].some(attribute => /(?:https?:|url\()/i.test(attribute.value))) };
  }, bytes.toString("utf8"));
}
async function inspectPng(page, bytes) {
  assert.equal(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), true, "Valid PNG signature");
  return page.evaluate(async data => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)], { type: "image/png" }));
    const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext("2d"); if (!context) throw new Error("PNG inspection unavailable"); context.drawImage(bitmap, 0, 0);
    const result = { width: bitmap.width, height: bitmap.height, cornerAlpha: context.getImageData(0, 0, 1, 1).data[3] }; bitmap.close(); return result;
  }, [...bytes]);
}
function inspectPdf(bytes, pages, widthMm = 210, heightMm = 297) {
  const raw = bytes.toString("latin1"); assert.match(raw, /^%PDF-/);
  assert.equal([...raw.matchAll(/\/Type\s*\/Page\b/g)].length, pages, "Complete PDF page count");
  assert.equal(/\/Subtype\s*\/Image\b/.test(raw), false, "PDF stays vector");
  const boxes = [...raw.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)]; assert.equal(boxes.length, pages);
  for (const box of boxes) { assert.ok(Math.abs(Number(box[1]) * 25.4 / 72 - widthMm) < .001); assert.ok(Math.abs(Number(box[2]) * 25.4 / 72 - heightMm) < .001); }
}
async function download(page, button, filename) {
  const before = await page.evaluate(() => window.outputAuditDownloads.length);
  const pending = page.waitForEvent("download"); await button.click(); const artifact = await pending;
  assert.equal(await artifact.failure(), null); const bytes = await readFile(await artifact.path()); assert.ok(bytes.length > 0);
  if (filename) assert.equal(artifact.suggestedFilename(), filename);
  // Preserve the actual captured filename in evidence. The audit's Windows
  // artifact path must also accommodate deliberately unbounded authored titles.
  const suggested = artifact.suggestedFilename(), extension = path.extname(suggested);
  const localName = `${String(files.length + 1).padStart(2, "0")}-${path.basename(suggested, extension).slice(0, 96)}${extension}`; await artifact.saveAs(path.join(output, localName));
  await page.waitForFunction(count => window.outputAuditDownloads.length === count + 1 && window.outputAuditDownloads.at(-1).afterTask !== undefined, before);
  const evidence = await page.evaluate(() => window.outputAuditDownloads.at(-1));
  check(`attached_delayed_${files.length}`, evidence.connected && !evidence.revokedAtClick && !evidence.afterTask);
  files.push({ file: localName, filename: artifact.suggestedFilename(), bytes: bytes.length, downloadEvidence: evidence }); return bytes;
}
async function noPhysicalDownload(page, count, name) { await page.waitForTimeout(100); check(name, (await page.evaluate(() => window.outputAuditDownloads.length)) === count); }
async function caseRun(name, run) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "en-US", acceptDownloads: true, serviceWorkers: "block" });
  try {
    await context.addInitScript(() => {
      window.outputAuditDownloads = []; const revoked = new Set(), click = HTMLAnchorElement.prototype.click, revoke = URL.revokeObjectURL;
      URL.revokeObjectURL = function (url) { revoked.add(url); return revoke.call(this, url); };
      HTMLAnchorElement.prototype.click = function () { if (this.download) { const record = { filename: this.download, connected: this.isConnected, url: this.href, revokedAtClick: revoked.has(this.href) }; window.outputAuditDownloads.push(record); setTimeout(() => { record.afterTask = revoked.has(record.url); }, 0); } return click.call(this); };
    });
    const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message)); page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(url); await page.locator(".app-brand").waitFor(); await run(page);
    await page.screenshot({ path: path.join(output, `${name}-output.png`), fullPage: true });
  } finally { await context.close(); }
}
let url = process.argv[3];
try {
  await mkdir(output, { recursive: true });
  if (!url || url === "-") { server = await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false } }); await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}/`; }
  browser = await chromium.launch();
  await caseRun("long-heading", async page => {
    const doc = mixed("W".repeat(50)); doc.steps[0].time = { iconId: "time.duration", seconds: 99 * 86400, label: "99d" };
    await importGuide(page, doc); await openOutput(page); await ready(page);
    const svg = await inspectSvg(page, await download(page, page.getByRole("button", { name: "Download SVG page 1 of 1", exact: true }), `${"w".repeat(50)}-page-01-of-01.svg`));
    check("long_heading_once_and_complete", svg.texts.filter(text => /^W+$/.test(text)).join("") === doc.meta.title && svg.texts.some(text => text.includes("99d")) && JSON.stringify(svg.ids) === JSON.stringify(["kitchen-token", "routine-token", "learning-token"]));
    check("physical_portable_svg", svg.width === "210mm" && svg.height === "297mm" && svg.viewBox === "0 0 210 297" && !svg.forbidden && !svg.external && svg.white);
    inspectPdf(await download(page, page.getByRole("button", { name: "Download PDF", exact: true })), 1);
    for (const [dpi, width, height] of [[150, 1240, 1754], [300, 2480, 3508]]) {
      await page.getByLabel("Resolution (dpi)", { exact: true }).selectOption(String(dpi)); await ready(page);
      const png = await inspectPng(page, await download(page, page.getByRole("button", { name: `Download PNG page 1 of 1 at ${dpi} dpi`, exact: true })));
      check(`png_${dpi}_physical_opaque`, png.width === width && png.height === height && png.cornerAlpha === 255);
    }
    check("print_actual_size_explained", (await page.locator("dialog").innerText()).includes("Print at 100% or actual size"));
  });
  await caseRun("all-libraries-selected", async page => {
    const doc = mixed("Three libraries"); await importGuide(page, doc);
    for (const library of ["kitchen", "routines", "learning"]) {
      await page.locator("[data-add-picture]").first().click(); await page.locator(".token-picker select").first().selectOption(library);
      await page.locator(".authoring-panel > header").getByRole("button", { name: "Close", exact: true }).click();
      await openOutput(page); await ready(page);
      check(`global_artwork_survives_${library}`, await page.locator('.output-preview__image [data-output-role="token"]').count() === 3);
      const svg = await inspectSvg(page, await download(page, page.getByRole("button", { name: "Download SVG page 1 of 1", exact: true })));
      check(`global_sources_${library}`, JSON.stringify(svg.ids) === JSON.stringify(["kitchen-token", "routine-token", "learning-token"]));
      await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
    }
    await openOutput(page); await ready(page); await page.getByLabel("Routine group", { exact: true }).uncheck(); await ready(page);
    await page.getByLabel("Kitchen group", { exact: true }).uncheck(); await ready(page); await page.getByLabel("Kitchen group", { exact: true }).check(); await ready(page);
    const svg = await inspectSvg(page, await download(page, page.getByRole("button", { name: "Download SVG page 1 of 1", exact: true })));
    check("selection_retains_source_order", JSON.stringify(svg.ids) === JSON.stringify(["kitchen-token", "learning-token"]));
    check("semantic_selection_matches", JSON.stringify(await page.locator(".reading-content [data-reading-picture]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-reading-picture")))) === JSON.stringify(svg.ids));
  });
  await caseRun("required-and-optional", async page => {
    const doc = mixed("Required meanings"); doc.steps = [doc.steps[0]]; const token = doc.steps[0].tokens[0];
    doc.steps[0].time = { iconId: "time.duration", label: "  ", seconds: 60 }; doc.steps[0].description = "日本語"; token.note = "日本語";
    token.quantity = { iconId: "quantity.amount", label: "  ", amount: 2, unit: "kg" }; token.time = { iconId: "time.duration", label: "", seconds: 60 }; token.warning = { iconId: "constructor", label: "Keep hands clear" };
    await importGuide(page, doc); await openOutput(page); await ready(page);
    for (const mode of ["labels", "pictures"]) {
      await page.getByLabel("Content mode", { exact: true }).selectOption(mode); await ready(page);
      const svg = await inspectSvg(page, await download(page, page.getByRole("button", { name: "Download SVG page 1 of 1", exact: true })));
      const warning = svg.textRuns.filter(run => run.role === "warning" && run.tokenId === token.id).map(run => run.text).join("");
      check(`required_values_${mode}`, svg.texts.includes("2 kg") && svg.texts.filter(text => text === "1m").length >= 2 && warning === "Warning: Keep hands clear" && !svg.texts.some(text => text.includes("日本語")));
    }
    const before = await page.evaluate(() => window.outputAuditDownloads.length);
    await page.getByLabel("Content mode", { exact: true }).selectOption("detailed"); await page.waitForSelector('[data-output-status="blocked"]');
    check("detailed_optional_japanese_blocks", (await page.locator("dialog [role=alert]").allTextContents()).join(" ").includes("print font cannot render") && await page.getByRole("button", { name: "Download PDF", exact: true }).isDisabled());
    await noPhysicalDownload(page, before, "glyph_preflight_no_download");
    const json = JSON.parse((await download(page, page.getByRole("dialog").getByRole("button", { name: "Download JSON backup", exact: true }))).toString("utf8")); check("blocked_json_full_and_unchanged", JSON.stringify(json) === JSON.stringify(doc));
  });
  for (const [name, title] of [["visible-japanese", "日本語"], ["overflow-heading", "W".repeat(3000)]]) await caseRun(name, async page => {
    const doc = mixed(title); await importGuide(page, doc); await openOutput(page); await page.waitForSelector('[data-output-status="blocked"]');
    check(`${name}_preflight_disabled`, await page.getByRole("button", { name: "Download PDF", exact: true }).isDisabled()); await noPhysicalDownload(page, 0, `${name}_no_partial_download`);
    const json = JSON.parse((await download(page, page.getByRole("dialog").getByRole("button", { name: "Download JSON backup", exact: true }))).toString("utf8")); check(`${name}_json_preserved`, JSON.stringify(json) === JSON.stringify(doc));
  });
  await caseRun("continuation", async page => {
    const doc = mixed("Eighty five pictures"); doc.steps = [{ id: "continuation-group", title: "Complete all pictures", tokens: Array.from({ length: 85 }, (_, index) => ({ id: `picture-${index}`, category: "action", iconId: ["action.chop", "routines.action.wash-hands", "learning.action.count"][index % 3], label: "Picture" })) }];
    await importGuide(page, doc); await openOutput(page); await ready(page);
    const actions = page.getByRole("button", { name: /^Download SVG page \d+ of \d+$/ }), count = await actions.count(); check("continuation_has_all_numbered_actions", count > 1);
    const ids = [];
    for (let index = 0; index < count; index++) { const svg = await inspectSvg(page, await download(page, page.getByRole("button", { name: `Download SVG page ${index + 1} of ${count}`, exact: true }))); ids.push(...svg.ids); }
    check("85_main_tokens_exactly_once", JSON.stringify(ids) === JSON.stringify(doc.steps[0].tokens.map(token => token.id)) && new Set(ids).size === 85);
    inspectPdf(await download(page, page.getByRole("button", { name: "Download PDF", exact: true })), count);
    await page.getByRole("button", { name: "Next page", exact: true }).click(); check("page_navigation", (await page.locator(".output-preview").innerText()).includes(`Page 2 of ${count}`));
  });
  await caseRun("transparent-and-guards", async page => {
    await importGuide(page, mixed("Transparent page")); await openOutput(page); await ready(page);
    await page.getByLabel("Background", { exact: true }).selectOption("transparent"); await ready(page);
    const svg = await inspectSvg(page, await download(page, page.getByRole("button", { name: "Download SVG page 1 of 1", exact: true }))); check("transparent_svg_background", !svg.white);
    const png = await inspectPng(page, await download(page, page.getByRole("button", { name: "Download PNG page 1 of 1 at 150 dpi", exact: true }))); check("transparent_png_background", png.cornerAlpha === 0);
    inspectPdf(await download(page, page.getByRole("button", { name: "Download PDF", exact: true })), 1); check("transparent_pdf_paper_explained", (await page.locator("dialog").innerText()).includes("printing uses the paper's background"));
    await page.getByLabel("Output size", { exact: true }).selectOption("custom"); await ready(page); await page.locator(".output-dialog").getByLabel("Width (mm)", { exact: true }).fill("1000"); await page.locator(".output-dialog").getByLabel("Height (mm)", { exact: true }).fill("1000"); await ready(page);
    const before = await page.evaluate(() => window.outputAuditDownloads.length); await page.getByRole("button", { name: "Download PNG page 1 of 1 at 150 dpi", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "PNG pixel limit" }).waitFor(); await noPhysicalDownload(page, before, "raster_limit_no_download");
    await page.getByLabel("Output size", { exact: true }).selectOption("sheet"); await ready(page);
    await page.evaluate(() => { window.outputAuditContext = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = () => null; });
    await page.getByRole("button", { name: "Download PNG page 1 of 1 at 150 dpi", exact: true }).click(); await page.getByRole("alert").filter({ hasText: "browser could not render" }).waitFor(); await noPhysicalDownload(page, before, "failed_canvas_no_download");
    await page.evaluate(() => { HTMLCanvasElement.prototype.getContext = window.outputAuditContext; });
    await download(page, page.getByRole("button", { name: "Download SVG page 1 of 1", exact: true })); check("vector_recovery_after_png_failure", true);
  });
  check("no_console_or_page_errors", errors.length === 0); assertChecks(checks); console.log(`OUTPUT_AUDIT_FILES=${files.length}; OUTPUT_DIR=${output}`);
} catch (error) { failure = String(error); throw error; }
finally {
  try { await mkdir(output, { recursive: true }); await writeFile(path.join(output, "export-review-results.json"), JSON.stringify({ runAt: new Date().toISOString(), checks, errors, files, failure }, null, 2) + "\n"); }
  finally { try { await browser?.close(); } finally { await server?.close(); } }
}
