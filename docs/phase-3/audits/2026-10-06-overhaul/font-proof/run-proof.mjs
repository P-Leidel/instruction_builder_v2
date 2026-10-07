/* global process, Buffer */
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import opentype from "opentype.js";
import { build } from "vite";
import { chromium } from "playwright";
import { prepareOfflineAssets } from "../../../../../scripts/offline-assets.mjs";

const proofDir = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(proofDir, "../../../../..");
const dist = path.join(os.tmpdir(), `instruction-builder-task-4-font-proof-${process.pid}`);
const runtime = process.env.CODEX_PROOF_RUNTIME ?? "C:/Users/Patrick/.cache/codex-runtimes/codex-primary-runtime/dependencies";
const sharp = createRequire(path.join(runtime, "node/package.json"))("sharp");
const poppler = process.env.CODEX_PROOF_PDFTOPPM ?? path.join(runtime, "native/poppler/Library/bin/pdftoppm.exe");
const binary = await readFile(path.join(root, "public/fonts/SourceSans3-Regular-3.052.ttf"));
const face = opentype.parse(binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength));
const fontMetadata = { bytes: binary.length, sha256: createHash("sha256").update(binary).digest("hex"), revision: face.tables.head.fontRevision, unitsPerEm: face.unitsPerEm, ascender: face.ascender, descender: face.descender, head: face.tables.head, cmapCount: Object.keys(face.tables.cmap.glyphIndexMap).length };
await build({ configFile: false, root: proofDir, publicDir: path.join(root, "public"), base: "/", logLevel: "warn", build: { outDir: dist, emptyOutDir: true, target: "es2020" } });
const manifest = await prepareOfflineAssets(dist);
const requests = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost").pathname; requests.push(url);
  const relative = url === "/" ? "index.html" : url.slice(1), file = path.resolve(dist, relative);
  if (!file.startsWith(dist + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const extension = path.extname(file), types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".ttf": "font/ttf", ".svg": "image/svg+xml", ".png": "image/png" };
    res.setHeader("Content-Type", types[extension] ?? "application/octet-stream");
    res.setHeader("Vary", "Origin"); res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext(), page = await context.newPage(), loaded = [], errors = [];
  page.on("request", req => loaded.push(req.url().slice(origin.length))); page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin); await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
  const before = await page.evaluate(async () => ({ fontFaceCount: document.fonts.size, cached: (await Promise.all((await caches.keys()).map(async name => ({ name, urls: (await (await caches.open(name)).keys()).map(req => new URL(req.url).pathname) })))), controller: !!navigator.serviceWorker.controller }));
  if (before.fontFaceCount !== 0 || loaded.some(url => /jspdf|svg2pdf|\.ttf$/.test(url))) throw new Error("Proof was warmed before offline first use");
  await context.setOffline(true); const requestCount = requests.length;
  const result = await page.evaluate(() => window.runFontProof());
  const offlineNetworkRequests = requests.length - requestCount;
  if (requests.length !== requestCount || errors.length) throw new Error(`Offline output used the network or errored: ${JSON.stringify(errors)}`);
  await mkdir(proofDir, { recursive: true });
  const metrics = [];
  for (const artifact of result.artifacts) {
    const stem = path.join(proofDir, artifact.name), width = Math.round(artifact.size.widthMm / 25.4 * 150), height = Math.round(artifact.size.heightMm / 25.4 * 150);
    await writeFile(stem + ".svg", artifact.svg); await writeFile(stem + "-image.png", Buffer.from(artifact.png, "base64")); await writeFile(stem + ".pdf", Buffer.from(artifact.pdf, "base64"));
    await writeFile(path.join(dist, artifact.name + ".svg"), artifact.svg);
    await sharp(Buffer.from(artifact.svg), { density: 150 }).resize(width, height).png().toFile(stem + "-independent.png");
    execFileSync(poppler, ["-png", "-r", "150", "-singlefile", stem + ".pdf", stem + "-pdf"]);
    const pdfBytes = await readFile(stem + ".pdf");
    if (/\/Subtype\s*\/Image/.test(pdfBytes.toString("latin1"))) throw new Error("PDF text or artwork was rasterized");
    // Fresh document/context cannot inherit the prepared app font.
    const independent = await browser.newContext({ viewport: { width: Math.ceil(width * 96 / 150), height: Math.ceil(height * 96 / 150) }, deviceScaleFactor: 150 / 96 }), tab = await independent.newPage();
    await tab.goto(origin + "/" + artifact.name + ".svg");
    await tab.screenshot({ path: stem + "-browser.png", clip: { x: 0, y: 0, width: width * 96 / 150, height: height * 96 / 150 } }); await independent.close();
    metrics.push({ name: artifact.name, size: artifact.size, raster: { width, height }, painted: artifact.painted, pdfVector: true });
  }
  await writeFile(path.join(proofDir, "fixture-plans.json"), JSON.stringify(result.plans, null, 2) + "\n");
  await writeFile(path.join(proofDir, "proof-results.json"), JSON.stringify({ strategy: "same-font-vector-outlines", fontMetadata, manifest, beforeFirstOutput: before, firstUseOffline: true, serverRequestsDuringOutput: offlineNetworkRequests, coldBrowserRequests: loaded, coverage: result.coverage, afterFontFaceCount: result.fontFaceCount, runtimes: { chromium: browser.version(), sharp: sharp.versions }, artifacts: metrics }, null, 2) + "\n");
  console.log(JSON.stringify({ firstUseOffline: true, artifacts: result.artifacts.map(a => a.name), plans: Object.fromEntries(Object.entries(result.plans).map(([name, plan]) => [name, { pages: plan.pages.length, mainPictures: plan.pages.flatMap(p => p.fragments).filter(f => f.kind === "symbol" && f.role === "token").length }])) }));
  await context.close();
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
