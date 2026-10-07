import process from "node:process";
import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createServer } from "vite";
import preact from "@preact/preset-vite";
import { chromium } from "playwright";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../../../../..");
const adapter = path.resolve(directory, "../export-proof");
const runtime = process.env.CODEX_PROOF_RUNTIME ?? "C:/Users/Patrick/.cache/codex-runtimes/codex-primary-runtime/dependencies";
const sharp = createRequire(path.join(runtime, "node/package.json"))("sharp");
const poppler = process.env.CODEX_PROOF_PDFTOPPM ?? path.join(runtime, "native/poppler/Library/bin/pdftoppm.exe");
const python = process.env.CODEX_PROOF_PYTHON ?? path.join(runtime, "python/python.exe");
const catalog = [["action.chop", "action", "Chop"], ["routines.action.wash-hands", "action", "Wash hands"], ["learning.action.count", "action", "Count"]];
const source = { schemaVersion: 2, meta: { title: "85-picture A3 sequence", presentation: "sequence", domain: "proof", createdAt: "2026-10-06T00:00:00Z" }, steps: [{ id: "a3-group", title: "Repeat the familiar action", time: { iconId: "time.duration", label: "5m", seconds: 300 }, tokens: Array.from({ length: 85 }, (_, index) => {
  const [iconId, category, meaning] = catalog[index % catalog.length];
  return { id: `a3-main-${String(index + 1).padStart(3, "0")}`, iconId, category, label: `${meaning} ${index + 1}`,
    quantity: { iconId: "quantity.amount", amount: 2, unit: "pieces", label: "2 pieces" }, warning: { iconId: "warning.sharp", label: "Sharp edge" }, time: { iconId: "time.duration", label: "1m", seconds: 60 } };
}) }] };
const checks = {}, errors = []; let server, browser, plan, failure, temporary;
function check(name, condition) { checks[name] = condition === true; assert.equal(condition, true, name); }
function validateCleanup() {
  if (path.dirname(path.resolve(temporary)) !== path.resolve(os.tmpdir()) || !path.basename(temporary).startsWith("instruction-a3-proof-")) throw new Error("Unsafe A3 proof cleanup path");
}
try {
  await mkdir(directory, { recursive: true });
  temporary = await mkdtemp(path.join(os.tmpdir(), "instruction-a3-proof-"));
  await writeFile(path.join(directory, "source.json"), JSON.stringify(source, null, 2) + "\n");
  server = await createServer({ configFile: false, root: adapter, cacheDir: temporary, publicDir: path.join(root, "public"), plugins: [preact()], server: { host: "127.0.0.1", port: 0, open: false, fs: { allow: [root] } } });
  await server.listen(); browser = await chromium.launch(); const context = await browser.newContext();
  try {
    const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message)); page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`); await page.waitForFunction(() => document.documentElement.dataset.proofReady === "true");
    const canonical = await page.evaluate(async ([source, moduleUrl]) => { const { getCatalogEntry } = await import(moduleUrl); return source.steps[0].tokens.every(token => getCatalogEntry(token.iconId)?.category === token.category) && ["quantity.amount", "warning.sharp", "time.duration"].every(id => !!getCatalogEntry(id)); }, [source, `/@fs/${root.replaceAll("\\", "/")}/src/lib/library-catalog.ts`]);
    check("canonical_85_main_ids_and_attachment_artwork", canonical);
    const result = await page.evaluate(source => window.prepareOutputProof(source, { preset: "large", locale: "en" }), source);
    check("unchanged_large_preset_plans_successfully", result.ok); plan = result.plan;
    await writeFile(path.join(directory, "plan.json"), JSON.stringify(plan, null, 2) + "\n");
    const main = plan.pages.flatMap(page => page.fragments).filter(fragment => fragment.kind === "symbol" && fragment.role === "token");
    check("every_main_exactly_once_in_source_order", JSON.stringify(main.map(fragment => fragment.source.tokenId)) === JSON.stringify(source.steps[0].tokens.map(token => token.id)));
    check("default_25mm_main_picture_size", main.every(fragment => fragment.box.widthMm === 25 && fragment.box.heightMm === 25));
    check("explicit_group_time_and_sequence_total", plan.pages[0].fragments.some(fragment => fragment.kind === "text" && fragment.role === "time" && fragment.source.stepId === "a3-group" && !fragment.source.tokenId && fragment.text === "5m") && plan.pages[0].fragments.some(fragment => fragment.kind === "text" && fragment.role === "time" && fragment.text === "Total time: 5m"));
    const required = source.steps[0].tokens.filter(token => token.warning);
    for (const token of required) for (const [role, label] of [["quantity", "2 pieces"], ["warning", "Warning: Sharp edge"], ["time", "1m"]]) check(`${token.id}_${role}_text_and_symbol`, plan.pages.flatMap(page => page.fragments).some(fragment => fragment.kind === "text" && fragment.source.tokenId === token.id && fragment.role === role && fragment.text === label) && plan.pages.flatMap(page => page.fragments).some(fragment => fragment.kind === "symbol" && fragment.source.tokenId === token.id && fragment.role === role));
    for (const [index, outputPage] of plan.pages.entries()) {
      check(`page_${index + 1}_A3_mm`, outputPage.size.widthMm === 297 && outputPage.size.heightMm === 420);
      check(`page_${index + 1}_physical_bounds`, outputPage.fragments.every(fragment => fragment.kind === "connector" ? [fragment.from, fragment.to].every(point => point.xMm >= 10 && point.xMm <= 287 && point.yMm >= 10 && point.yMm <= 410) : fragment.box.xMm >= 10 - 1e-7 && fragment.box.yMm >= 10 - 1e-7 && fragment.box.xMm + fragment.box.widthMm <= 287 + 1e-7 && fragment.box.yMm + fragment.box.heightMm <= 410 + 1e-7));
      check(`page_${index + 1}_sequence_context`, outputPage.fragments.some(fragment => fragment.kind === "text" && fragment.source.stepId === "a3-group" && fragment.role === (index ? "context" : "heading") && fragment.text === (index ? "Step 1: Repeat the familiar action (continued)" : "Step 1: Repeat the familiar action")));
      const stem = `continuation-a3-page-${String(index + 1).padStart(2, "0")}`;
      const svg = Buffer.from(await page.evaluate(index => window.outputProofArtifact("svg", index), index));
      const png = Buffer.from(await page.evaluate(index => window.outputProofArtifact("png", index, 150), index));
      await writeFile(path.join(directory, `${stem}.svg`), svg); await writeFile(path.join(directory, `${stem}.png`), png);
      const svgSource = svg.toString("utf8"); check(`page_${index + 1}_portable_vectors`, !/<image\b|<text\b|<script\b|<foreignObject\b|https?:\/\/(?!www\.w3\.org)/.test(svgSource));
      check(`page_${index + 1}_SVG_physical_units`, /<svg\b[^>]*width="297mm"[^>]*height="420mm"/.test(svgSource));
      const painted = await page.evaluate(svg => { const tree = new DOMParser().parseFromString(svg, "image/svg+xml"); return [...tree.querySelectorAll('[data-output-role="token"]')].map(node => node.getAttribute("data-token-id")); }, svgSource);
      check(`page_${index + 1}_painted_main_order`, JSON.stringify(painted) === JSON.stringify(outputPage.fragments.filter(fragment => fragment.kind === "symbol" && fragment.role === "token").map(fragment => fragment.source.tokenId)));
      const image = await sharp(png).metadata(); check(`page_${index + 1}_actual_150dpi_png`, image.width === Math.round(297 / 25.4 * 150) && image.height === Math.round(420 / 25.4 * 150));
      await sharp(svg, { density: 150 }).resize(Math.round(297 / 25.4 * 150), Math.round(420 / 25.4 * 150)).png().toFile(path.join(directory, `${stem}-svg-independent.png`));
    }
    const pdf = Buffer.from(await page.evaluate(() => window.outputProofArtifact("pdf"))); await writeFile(path.join(directory, "continuation-a3.pdf"), pdf); check("vector_PDF_no_image_subtype", !/\/Subtype\s*\/Image\b/.test(pdf.toString("latin1")));
    execFileSync(poppler, ["-png", "-r", "150", path.join(directory, "continuation-a3.pdf"), path.join(directory, "continuation-a3-pdf-independent")]);
    check("zero_console_or_page_errors", errors.length === 0);
  } finally { await context.close(); }
  execFileSync(python, [path.join(directory, "compare-pages.py")], { stdio: "inherit" });
  const independent = JSON.parse(await readFile(path.join(directory, "independent-results.json"), "utf8")); check("independent_full_page_symbol_and_text_comparisons", independent.status === "PASS" && independent.pages.length === plan.pages.length);
} catch (error) { failure = String(error); throw error; }
finally {
  try { await browser?.close(); } finally {
    try { await server?.close(); } finally {
      if (temporary) {
        validateCleanup();
        await rm(temporary, { recursive: true, force: true });
      }
      checks.browser_closed = !browser || !browser.isConnected();
      checks.ephemeral_server_closed = !server?.httpServer?.listening;
      checks.temporary_cache_removed = !temporary || await stat(temporary).then(() => false, error => error.code === "ENOENT");
      await writeFile(path.join(directory, "results.json"), JSON.stringify({ runAt: new Date().toISOString(), checks, errors, failure, pageCount: plan?.pages.length, mainPictures: 85, physicalAndParticipantAcceptance: "Pending" }, null, 2) + "\n");
      assert.equal(checks.browser_closed && checks.ephemeral_server_closed && checks.temporary_cache_removed, true, "Owned proof resources are closed and removed");
    }
  }
}
console.log(JSON.stringify({ status: "PASS", checks: Object.keys(checks).length, pages: plan.pages.length, mainPictures: 85 }));
