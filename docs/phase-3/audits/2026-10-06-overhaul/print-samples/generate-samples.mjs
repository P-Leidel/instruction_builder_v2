/* global process, Buffer */
// Uses the shipped planner/exporters through the existing isolated browser adapter.
import { createServer } from "vite";
import preact from "@preact/preset-vite";
import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import assert from "node:assert/strict";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../../../../..");
const adapter = path.join(directory, "../export-proof");
const runtime = process.env.CODEX_PROOF_RUNTIME ?? "C:/Users/Patrick/.cache/codex-runtimes/codex-primary-runtime/dependencies";
const sharp = createRequire(path.join(runtime, "node/package.json"))("sharp");
const poppler = process.env.CODEX_PROOF_PDFTOPPM ?? path.join(runtime, "native/poppler/Library/bin/pdftoppm.exe");
const workplace = JSON.parse(await readFile(path.join(directory, "../editor-proof/workplace-prototype.json"), "utf8"));
const routine = JSON.parse(await readFile(path.join(directory, "../editor-proof/routine-prototype.json"), "utf8"));
// The sample warning is illustrative; participants choose their real procedure.
workplace.steps[1].tokens[0].warning = { iconId: "warning.sharp", label: "Sharp blade" };
const formats = [
  ["label", { preset: "label", metadata: { documentTitle: false, groupTitles: false, stepNumbers: false, totalTime: false } }, 50, 30],
  ["a6", { preset: "card" }, 105, 148],
  ["a4", { preset: "sheet" }, 210, 297],
  ["a3", { preset: "large" }, 297, 420],
  ["custom", { preset: "custom", customSize: { widthMm: 180, heightMm: 250 } }, 180, 250],
];
const records = [], errors = [], thumbnails = [];
let server, browser;
try {
  await mkdir(directory, { recursive: true });
  server = await createServer({ configFile: false, root: adapter, publicDir: path.join(root, "public"), plugins: [preact()],
    server: { host: "127.0.0.1", port: 0, open: false, fs: { allow: [root] } } });
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
  await page.waitForFunction(() => document.documentElement.dataset.proofReady === "true");
  for (const [name, source] of [["workplace", workplace], ["routine", routine]]) {
    await writeFile(path.join(directory, `${name}.json`), JSON.stringify(source, null, 2) + "\n");
    for (const [format, options, widthMm, heightMm] of formats) {
      const document = structuredClone(source);
      if (format === "label") document.steps = [{ ...document.steps[0], tokens: [document.steps[0].tokens.at(-1)] }];
      const result = await page.evaluate(([source, options]) => window.prepareOutputProof(source, options), [document, { ...options, locale: "en" }]);
      assert.equal(result.ok, true, `${name}-${format}: ${JSON.stringify(result.issues)}`);
      assert.ok(result.plan.pages.length > 0);
      for (const page of result.plan.pages) assert.deepEqual(page.size, { widthMm, heightMm });
      const stem = `${name}-${format}`;
      const pdf = Buffer.from(await page.evaluate(() => window.outputProofArtifact("pdf")));
      assert.equal(/\/Subtype\s*\/Image/.test(pdf.toString("latin1")), false, "PDF stays vector");
      await writeFile(path.join(directory, `${stem}.pdf`), pdf);
      const pages = [];
      for (let index = 0; index < result.plan.pages.length; index++) {
        const pageStem = `${stem}-page-${index + 1}`;
        const svg = Buffer.from(await page.evaluate(index => window.outputProofArtifact("svg", index), index));
        await writeFile(path.join(directory, `${pageStem}.svg`), svg);
        execFileSync(poppler, ["-png", "-r", "100", "-f", String(index + 1), "-l", String(index + 1), "-singlefile", path.join(directory, `${stem}.pdf`), path.join(directory, pageStem)]);
        const rendered = await sharp(path.join(directory, `${pageStem}.png`)).metadata();
        assert.ok(Math.abs(rendered.width - widthMm / 25.4 * 100) <= 1);
        assert.ok(Math.abs(rendered.height - heightMm / 25.4 * 100) <= 1);
        pages.push({ svg: `${pageStem}.svg`, rendered: `${pageStem}.png` });
        const image = await sharp(path.join(directory, `${pageStem}.png`)).resize({ width: 350, height: Math.floor(510 / result.plan.pages.length), fit: "contain", background: "white" }).png().toBuffer();
        thumbnails.push({ input: image, left: 10 + (records.length % 5) * 370, top: 45 + Math.floor(records.length / 5) * 560 + index * Math.floor(510 / result.plan.pages.length) });
      }
      const label = Buffer.from(`<svg width="370" height="40"><rect width="370" height="40" fill="white"/><text x="10" y="25" font-size="17">${name} / ${format} / ${widthMm} x ${heightMm} mm</text></svg>`);
      thumbnails.push({ input: label, left: (records.length % 5) * 370, top: Math.floor(records.length / 5) * 560 });
      records.push({ name: stem, widthMm, heightMm, pageCount: result.plan.pages.length, pages, mainPictures: document.steps.flatMap(group => group.tokens).length,
        mode: result.plan.options.mode, pdf: `${stem}.pdf`, options: result.plan.options });
    }
  }
  assert.deepEqual(errors, []);
  await sharp({ create: { width: 1850, height: 1120, channels: 3, background: "white" } }).composite(thumbnails).png().toFile(path.join(directory, "sample-inspection.png"));
  await writeFile(path.join(directory, "sample-results.json"), JSON.stringify({ runAt: new Date().toISOString(), browser: browser.version(),
    status: "Digitally generated and reopened; physical/participant acceptance pending", errors, records }, null, 2) + "\n");
  console.log(JSON.stringify({ result: "PASS", samples: records.length, physicalAcceptance: "Pending" }));
} finally {
  try { await browser?.close(); } finally { await server?.close(); }
}
