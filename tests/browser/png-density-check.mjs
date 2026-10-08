import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";
import { chromium } from "playwright";
import { createServer } from "vite";

// Standalone native-canvas/export regression: node png-density-check.mjs <output> [url].
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = path.resolve(process.argv[2] ?? path.join(root, "artifacts/functional-remediation/png"));
const results = [];
function chunks(bytes) {
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const parsed = [];
  let offset = 8;
  while (offset < bytes.length) {
    assert.ok(offset + 12 <= bytes.length, "Complete chunk header/trailer");
    const length = bytes.readUInt32BE(offset), end = offset + length + 12;
    assert.ok(end <= bytes.length, "Complete chunk payload");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    assert.equal(crc32(bytes.subarray(offset + 4, end - 4)), bytes.readUInt32BE(end - 4), `${type} CRC`);
    parsed.push({ type, data: bytes.subarray(offset + 8, end - 4), raw: bytes.subarray(offset, end) });
    offset = end;
  }
  assert.equal(parsed[0].type, "IHDR"); assert.equal(parsed.at(-1).type, "IEND");
  return parsed;
}
// Check the independent Node CRC implementation against a published CRC-32 check value.
assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
let server, browser;
try {
  await mkdir(output, { recursive: true });
  let url = process.argv[3];
  if (!url || url === "-") {
    server = await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false, watch: { ignored: ["**/artifacts/**"] } } });
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}/`;
  }
  browser = await chromium.launch();
  const page = await browser.newPage({ locale: "en-US", acceptDownloads: true, serviceWorkers: "block" });
  await page.goto(url); await page.locator(".app-brand").waitFor();
  const native = await page.evaluate(async () => {
    const canvas = document.createElement("canvas"); canvas.width = 295; canvas.height = 177;
    return [...new Uint8Array(await (await new Promise(resolve => canvas.toBlob(resolve, "image/png"))).arrayBuffer())];
  });
  const nativeChunks = chunks(Buffer.from(native));
  const density = nativeChunks.find(chunk => chunk.type === "pHYs");
  results.push({ native: nativeChunks.map(chunk => chunk.type), density: density ? [...density.data] : null });
  await writeFile(path.join(output, "native-canvas.png"), Buffer.from(native));
  await writeFile(path.join(output, "results.json"), JSON.stringify(results, null, 2));
  console.log("Native canvas:", JSON.stringify(results[0]));

  const cases = [
    { name: "label-portrait-150", dpi: 150, index: 0, width: 295, height: 177, ppm: 5906, alpha: 0 },
    { name: "label-portrait-300", dpi: 300, index: 0, width: 591, height: 354, ppm: 11811, alpha: 0 },
    { name: "a4-portrait-150", dpi: 150, index: 1, width: 1240, height: 1754, ppm: 5906, alpha: 255 },
    { name: "a4-portrait-300", dpi: 300, index: 1, width: 2480, height: 3508, ppm: 11811, alpha: 255 },
    { name: "a4-landscape-150", dpi: 150, index: 2, width: 1754, height: 1240, ppm: 5906, alpha: 255 },
    { name: "a4-landscape-300", dpi: 300, index: 2, width: 3508, height: 2480, ppm: 11811, alpha: 255 },
  ];
  for (const item of cases) {
    const actual = await page.evaluate(async ({ dpi, index }) => {
      const { createPngFile } = await import("/src/lib/output-export.ts");
      const fragments = [{ kind: "symbol", role: "token", source: { stepId: "group", tokenId: "token" }, iconId: "action.chop",
        box: { xMm: 5, yMm: 5, widthMm: 12, heightMm: 12 } }];
      const plan = { documentTitle: "Density", presentation: "sequence", options: { preset: "label", locale: "en", orientation: "portrait", mode: "pictures",
        selectedStepIds: ["group"], background: "transparent", metadata: { documentTitle: false, groupTitles: false, stepNumbers: false, totalTime: false } }, notices: [], pages: [
        { index: 0, size: { widthMm: 50, heightMm: 30 }, background: "transparent", fragments },
        { index: 1, size: { widthMm: 210, heightMm: 297 }, background: "white", fragments },
        { index: 2, size: { widthMm: 297, heightMm: 210 }, background: "white", fragments },
      ] };
      let captured;
      const original = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
        return original.call(this, blob => { captured = blob; callback(blob); }, ...args);
      };
      try {
        const blob = await createPngFile(plan, index, dpi);
        const decode = async input => {
          const image = await createImageBitmap(input); const canvas = document.createElement("canvas");
          canvas.width = image.width; canvas.height = image.height; const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0); const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          const dimensions = [image.width, image.height]; image.close(); return { pixels, dimensions };
        };
        const [before, after] = await Promise.all([decode(captured), decode(blob)]);
        return { bytes: [...new Uint8Array(await blob.arrayBuffer())], native: [...new Uint8Array(await captured.arrayBuffer())],
          dimensions: after.dimensions, alpha: after.pixels[3], hasPicturePixels: after.pixels.some((value, i) => i % 4 === 0 && value < 100 && after.pixels[i + 3] > 0),
          samePixels: before.pixels.length === after.pixels.length && before.pixels.every((value, i) => value === after.pixels[i]) };
      } finally { HTMLCanvasElement.prototype.toBlob = original; }
    }, item);
    const bytes = Buffer.from(actual.bytes), parsed = chunks(bytes), physical = parsed.filter(chunk => chunk.type === "pHYs");
    assert.equal(physical.length, 1, `${item.name}: exactly one physical-density chunk`);
    assert.ok(parsed.findIndex(chunk => chunk.type === "pHYs") < parsed.findIndex(chunk => chunk.type === "IDAT"));
    assert.equal(physical[0].data.length, 9);
    assert.deepEqual([physical[0].data.readUInt32BE(0), physical[0].data.readUInt32BE(4), physical[0].data[8]], [item.ppm, item.ppm, 1]);
    assert.deepEqual(actual.dimensions, [item.width, item.height]); assert.equal(actual.alpha, item.alpha); assert.equal(actual.samePixels, true);
    assert.equal(actual.hasPicturePixels, true, "Real symbol artwork remains visible");
    assert.deepEqual(parsed.filter(chunk => chunk.type !== "pHYs").map(chunk => chunk.raw), chunks(Buffer.from(actual.native)).filter(chunk => chunk.type !== "pHYs").map(chunk => chunk.raw));
    await writeFile(path.join(output, `${item.name}.png`), bytes);
    results.push({ ...item, samePixels: actual.samePixels, hasPicturePixels: actual.hasPicturePixels, bytes: bytes.length });
  }
  // Exercise the actual dialog -> selected DPI -> downloadable artifact path too.
  const guide = { schemaVersion: 2, meta: { title: "PNG density", presentation: "sequence", domain: "proof", createdAt: "2026-10-08T00:00:00Z" },
    steps: [{ id: "group", title: "Group", tokens: [{ id: "token", category: "action", iconId: "action.chop", label: "Chop" }] }] };
  await page.getByLabel("Choose a JSON guide file", { exact: true }).setInputFiles({ name: "density.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(guide)) });
  await page.getByRole("dialog").getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByLabel("Guide title", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Print / Download", exact: true }).click();
  await page.waitForSelector('[data-output-status="ready"]');
  for (const [dpi, ppm, width, height] of [[150, 5906, 1240, 1754], [300, 11811, 2480, 3508]]) {
    await page.getByLabel("Resolution (dpi)", { exact: true }).selectOption(String(dpi));
    await page.waitForSelector('[data-output-status="ready"]');
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: `Download PNG page 1 of 1 at ${dpi} dpi`, exact: true }).click();
    const download = await pending; assert.equal(await download.failure(), null);
    const bytes = await readFile(await download.path()), parsed = chunks(bytes), physical = parsed.filter(chunk => chunk.type === "pHYs");
    assert.equal(physical.length, 1); assert.deepEqual([...physical[0].data], [...Buffer.from(dpi === 150 ? "000017120000171201" : "00002e2300002e2301", "hex")]);
    assert.equal(parsed[0].data.readUInt32BE(0), width); assert.equal(parsed[0].data.readUInt32BE(4), height);
    await download.saveAs(path.join(output, `dialog-${dpi}.png`)); results.push({ dialogDpi: dpi, ppm, width, height });
  }
  console.log("PNG density native export cases passed:", cases.length, "; dialog downloads passed: 2");
} finally {
  await writeFile(path.join(output, "results.json"), JSON.stringify(results, null, 2));
  await browser?.close(); await server?.close();
}
