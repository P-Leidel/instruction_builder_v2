/* global process, Buffer */
import { build } from "vite";
import preact from "@preact/preset-vite";
import { chromium } from "playwright";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { prepareOfflineAssets } from "../../../../../scripts/offline-assets.mjs";

function boardPolicyHolds(plan) {
  const fragments = plan.pages.flatMap(page => page.fragments);
  const generated = plan.options.locale === "de" ? /^(Schritt\s+\d+\b|Gesamtzeit:)/ : /^(Step\s+\d+\b|Total time:)/;
  return plan.options.metadata.stepNumbers === false && plan.options.metadata.totalTime === false &&
    !fragments.some(fragment => fragment.kind === "connector" || (fragment.kind === "text" && generated.test(fragment.text)));
}
if (process.argv.includes("--board-predicate-probe")) {
  const valid = { options: { locale: "de", metadata: { stepNumbers: false, totalTime: false } }, pages: [{ fragments: [{ kind: "text", role: "time", text: "1m" }] }] };
  for (const [role, text] of [["context", "Schritt 1: Größe prüfen"], ["heading", "Gesamtzeit: 2m"]]) {
    assert.equal(boardPolicyHolds({ ...valid, pages: [{ fragments: [...valid.pages[0].fragments, { kind: "text", role, text }] }] }), false, `Canonical ${role} procedural text must be rejected`);
  }
  assert.equal(boardPolicyHolds(valid), true, "Explicit duration remains allowed");
  for (const key of ["stepNumbers", "totalTime"]) assert.equal(boardPolicyHolds({ ...valid, options: { ...valid.options, metadata: { ...valid.options.metadata, [key]: true } } }), false, `Normalized ${key} must be false`);
  console.log("BOARD_PREDICATE_CANONICAL_COUNTEREXAMPLES=PASS"); process.exit(0);
}

const directory = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(directory, "../../../../..");
const output = path.resolve(process.argv[2] ?? directory), temporary = await mkdtemp(path.join(os.tmpdir(), "instruction-task5-proof-"));
const runtime = process.env.CODEX_PROOF_RUNTIME ?? "C:/Users/Patrick/.cache/codex-runtimes/codex-primary-runtime/dependencies";
const sharp = createRequire(path.join(runtime, "node/package.json"))("sharp");
const poppler = process.env.CODEX_PROOF_PDFTOPPM ?? path.join(runtime, "native/poppler/Library/bin/pdftoppm.exe");
const requests = [], errors = [], records = [], plans = {}, cold = [], negative = [];
function validateCleanup() { if (!temporary.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(temporary).startsWith("instruction-task5-proof-")) throw new Error("Unsafe proof cleanup path"); }
let server, browser;
const workplace = JSON.parse(await readFile(path.join(root, "docs/phase-3/audits/2026-10-06-overhaul/editor-proof/workplace-prototype.json"), "utf8"));
const routine = JSON.parse(await readFile(path.join(root, "docs/phase-3/audits/2026-10-06-overhaul/editor-proof/routine-prototype.json"), "utf8"));
const base = { schemaVersion: 2, meta: { title: "Äpfel, Öl und Straße — Crème brûlée", presentation: "sequence", domain: "proof", createdAt: "2026-10-06T00:00:00Z" }, steps: [{ id: "required-group", title: "Größe prüfen", description: "Diese Beschreibung bleibt in Detailed.", time: { iconId: "time.clock", label: "  ", seconds: 60 }, tokens: [{ id: "required-token", iconId: "object.onion", category: "object", label: "Zwiebel <script> & Öl", note: "Vorsichtig schneiden.", quantity: { iconId: "quantity.kg", label: "  ", amount: 2, unit: "kg" }, time: { iconId: "time.clock", label: "", seconds: 60 }, warning: { iconId: "unknown-warning", label: "Scharfes Messer" } }, { id: "unknown-warning-token", category: "tool", iconId: "tool.knife", label: "Messer", warning: { iconId: "constructor", label: "" } }] }] };
const continuation = structuredClone(base); continuation.meta.title = "Eighty five pictures"; continuation.steps[0].tokens = Array.from({ length: 85 }, (_, index) => ({ id: `continuation-${index}`, iconId: "action.chop", category: "action", label: "Chop" }));
const sheet = structuredClone(base); sheet.meta.title = "Twenty five label cells"; sheet.steps = Array.from({ length: 25 }, (_, index) => ({ id: `cell-${index}`, tokens: [{ id: `cell-token-${index}`, category: "object", iconId: "object.onion", label: "" }] }));
const board = structuredClone(base); board.meta.presentation = "board";
const fixtures = [
  ["workplace", workplace, {}], ["routine", routine, {}],
  ...["labels", "pictures", "detailed"].map(mode => [`required-${mode}`, base, { mode }]),
  ["board", board, { mode: "pictures", metadata: { documentTitle: true, groupTitles: true, stepNumbers: true, totalTime: true } }],
  ["selected", workplace, { selectedStepIds: ["group-2", "group-0"] }],
  ["continuation", continuation, {}],
  ["label-sheet", sheet, { preset: "label", labelSheet: { pageSize: { widthMm: 210, heightMm: 297 }, marginMm: 10, gapMm: 2, columns: 3, rows: 8 } }],
  ["label", { ...base, steps: [sheet.steps[0]] }, { preset: "label" }],
  ["transparent", base, { background: "transparent" }],
  ["long-heading", { ...workplace, meta: { ...workplace.meta, title: "W".repeat(50) } }, {}],
];
try {
  await mkdir(output, { recursive: true });
  await build({ configFile: false, root: directory, publicDir: path.join(root, "public"), plugins: [preact()], logLevel: "warn", build: { outDir: temporary, emptyOutDir: true, target: "es2020" } });
  const manifest = await prepareOfflineAssets(temporary);
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://proof.test").pathname; requests.push(pathname);
    const file = path.resolve(temporary, pathname === "/" ? "index.html" : pathname.slice(1));
    if (!file.startsWith(temporary + path.sep)) { response.writeHead(403).end(); return; }
    try { response.writeHead(200, { "Content-Type": ({ ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".ttf": "font/ttf" })[path.extname(file)] ?? "application/octet-stream", "Vary": "Origin" }); response.end(await readFile(file)); }
    catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/`; browser = await chromium.launch();
  for (const format of ["svg", "png", "pdf"]) {
    const context = await browser.newContext(), page = await context.newPage(), loaded = [];
    page.on("pageerror", error => errors.push(error.message)); page.on("console", message => { if (message.type() === "error") errors.push(message.text()); }); page.on("request", request => loaded.push(new URL(request.url()).pathname));
    await page.goto(url); await page.waitForFunction(() => document.documentElement.dataset.offlineReady === "true");
    assert.equal(loaded.some(value => /\.ttf$|jspdf|svg2pdf/.test(value)), false, "No font or converter output warmup");
    await context.setOffline(true); const before = requests.length;
    for (const [name, source, options] of fixtures) {
      const result = await page.evaluate(([source, options]) => window.prepareOutputProof(source, options), [source, options]);
      assert.equal(result.ok, true, `${name} must produce a complete physical plan: ${JSON.stringify(result.issues)}`);
      const plan = result.plan; plans[name] = plan;
      const main = plan.pages.flatMap(page => page.fragments).filter(fragment => fragment.kind === "symbol" && fragment.role === "token");
      const selected = new Set(plan.options.selectedStepIds), expected = source.steps.filter(group => selected.has(group.id)).flatMap(group => group.tokens.map(token => token.id));
      assert.deepEqual(main.map(fragment => fragment.source.tokenId), expected, `${name} complete source order`);
      if (name.startsWith("required-") || name === "board") {
        const texts = plan.pages.flatMap(page => page.fragments).filter(fragment => fragment.kind === "text").map(fragment => fragment.text).join(" ");
        assert.match(texts, /2 kg/); assert.match(texts, /1m/); assert.match(texts, /Scharfes Messer/); assert.match(texts, /Unbekannte Warnung/);
        if (name === "board") assert.equal(boardPolicyHolds(plan), true, "Normalized board excludes procedural numbering/totals while retaining explicit times");
      }
      const count = format === "pdf" ? 1 : plan.pages.length;
      for (let index = 0; index < count; index++) {
        const bytes = Buffer.from(await page.evaluate(([format, index]) => window.outputProofArtifact(format, index, 150), [format, index]));
        const stem = `${name}-page-${String(index + 1).padStart(2, "0")}`, file = path.join(output, `${format === "pdf" ? name : stem}.${format}`); await writeFile(file, bytes);
        if (format === "svg") {
          const svg = bytes.toString("utf8"), size = plan.pages[index].size;
          assert.match(svg, new RegExp(`width="${size.widthMm}mm"`)); assert.match(svg, new RegExp(`height="${size.heightMm}mm"`)); assert.equal(/<text\b|<image\b|<script\b|https?:\/\/(?!www\.w3\.org)/.test(svg), false);
          if (name === "board") { assert.equal(/data-output-text="(?:Schritt\s+\d+\b|Gesamtzeit:)/.test(svg), false); assert.equal([...svg.matchAll(/data-output-role="time"[^>]*data-output-text|data-output-text="1m"/g)].length >= 2, true, "Exported board retains both explicit duration labels"); }
          const paintedMain = [...svg.matchAll(/data-output-role="token"/g)].length; assert.equal(paintedMain, plan.pages[index].fragments.filter(fragment => fragment.kind === "symbol" && fragment.role === "token").length);
          await sharp(bytes, { density: 150 }).resize(Math.round(size.widthMm / 25.4 * 150), Math.round(size.heightMm / 25.4 * 150)).png().toFile(path.join(output, `${stem}-independent.png`));
        } else if (format === "png") {
          const image = await sharp(bytes).metadata(), size = plan.pages[index].size;
          assert.equal(image.width, Math.round(size.widthMm / 25.4 * 150)); assert.equal(image.height, Math.round(size.heightMm / 25.4 * 150));
          const pixel = await sharp(bytes).ensureAlpha().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer(); assert.equal(pixel[3], plan.options.background === "transparent" ? 0 : 255);
        } else {
          assert.equal(/\/Subtype\s*\/Image/.test(bytes.toString("latin1")), false, "Vector PDF has no image XObjects");
          execFileSync(poppler, ["-png", "-r", "150", file, path.join(output, `${name}-pdf`)]);
        }
        records.push({ fixture: name, format, index, pages: plan.pages.length, file: path.basename(file), bytes: bytes.length, size: plan.pages[index].size, mainTokens: main.length });
      }
      if (format === "png" && name === "label") {
        const bytes = Buffer.from(await page.evaluate(() => window.outputProofArtifact("png", 0, 300))), size = plan.pages[0].size, image = await sharp(bytes).metadata();
        assert.equal(image.width, Math.round(size.widthMm / 25.4 * 300)); assert.equal(image.height, Math.round(size.heightMm / 25.4 * 300));
        const filename = "label-page-01-300dpi.png"; await writeFile(path.join(output, filename), bytes);
        records.push({ fixture: name, format, index: 0, pages: 1, file: filename, bytes: bytes.length, size, dpi: 300, raster: { width: image.width, height: image.height } });
      }
    }
    const japanese = structuredClone(base); japanese.meta.title = "日本語";
    assert.equal((await page.evaluate(source => window.prepareOutputProof(source), japanese)).ok, false);
    const noteOnly = structuredClone(base); noteOnly.steps[0].tokens[0].note = "日本語";
    assert.equal((await page.evaluate(source => window.prepareOutputProof(source, { mode: "pictures" }), noteOnly)).ok, true);
    const detailedNegative = await page.evaluate(source => window.prepareOutputProof(source, { mode: "detailed" }), noteOnly); assert.equal(detailedNegative.ok, false); assert.equal(detailedNegative.issues[0].code, "unsupported-glyph");
    const oversized = structuredClone(base); oversized.meta.title = "W".repeat(3000); assert.equal((await page.evaluate(source => window.prepareOutputProof(source), oversized)).ok, false);
    if (format === "png") {
      assert.equal((await page.evaluate(source => window.prepareOutputProof(source, { preset: "custom", customSize: { widthMm: 1000, heightMm: 1000 } }), base)).ok, true);
      const rasterError = await page.evaluate(() => window.outputProofArtifact("png", 0, 300).then(() => "unexpected success", error => error.message)); assert.equal(rasterError, "raster-limit");
    }
    negative.push({ format, visibleJapaneseBlocked: true, omittedJapaneseNotePicturesAllowed: true, detailedJapaneseNoteBlocked: true, oversizedHeadingBlocked: true, ...(format === "png" ? { rasterLimitBlocked: true } : {}) });
    assert.equal(requests.length, before, "Cold output formats must use no server requests"); cold.push({ format, noOutputWarmup: true, serverRequestsDuringOutput: requests.length - before, loaded }); await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, "artifact-plans.json"), JSON.stringify(plans, null, 2) + "\n");
  await writeFile(path.join(output, "artifact-proof-results.json"), JSON.stringify({ runAt: new Date().toISOString(), browser: browser.version(), cold, manifest, errors, negative, records, renderer: { sharp: sharp.versions, pdf: poppler } }, null, 2) + "\n");
  console.log(JSON.stringify({ result: "PASS", coldFormats: cold.length, fixtures: fixtures.length, artifacts: records.length, output }));
} finally {
  try { await browser?.close(); } finally { if (server) await new Promise(resolve => server.close(resolve)); }
  // The owned mkdtemp path is the only cleanup target; validate before delete.
  validateCleanup();
  await rm(temporary, { recursive: true, force: true });
}
