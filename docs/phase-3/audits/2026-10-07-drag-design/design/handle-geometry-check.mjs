import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
const { boot } = await import(pathToFileURL(path.resolve(".claude/skills/run-instruction-builder/editor-browser-helpers.mjs")));
const stage = process.argv[2] ?? "after", output = path.resolve("docs/phase-3/audits/2026-10-07-drag-design/design", `handle-${stage}`);
const source = JSON.parse(await readFile("docs/phase-3/audits/2026-10-06-overhaul/editor-proof/workplace-prototype.json", "utf8"));
const checks = [], errors = []; let browser, server, failure;
try {
  await mkdir(output, { recursive: true });
  server = await createServer({ server: { host: "127.0.0.1", port: 0, open: false } }); await server.listen(); browser = await chromium.launch();
  const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
  for (const width of [320, 1440]) for (const kind of ["known", "unknown-picture", "unknown-warning"]) {
    const fixture = structuredClone(source), token = fixture.steps[0].tokens[0], id = "handle-geometry", now = "2026-10-07T00:00:00Z";
    if (kind === "unknown-picture") token.iconId = "future.motion";
    if (kind === "unknown-warning") token.warning = { iconId: "future.warning", label: "Authored warning" };
    const seed = [["instruction-builder:preferences:v1", { version: 1, preferences: { uiLocale: "en", labelLocale: "en", theme: "dark", activeLibraryId: "kitchen", lastGuideId: id } }], ["instruction-builder:guide:" + id, { id, revision: 1, createdAt: now, updatedAt: now, document: fixture }]];
    const { page, context } = await boot(browser, url, errors, { width, height: 1000 }, seed);
    try {
      await page.locator(".editor-picture__drag").first().waitFor();
      const result = await page.locator(".editor-picture").first().evaluate(node => {
        const button = node.querySelector(".editor-picture__button"), handle = node.querySelector(".editor-picture__drag");
        const b = button.getBoundingClientRect(), h = handle.getBoundingClientRect(), content = [...button.children].map(child => child.getBoundingClientRect());
        return { width: h.width, height: h.height, insidePicture: h.left >= b.left && h.right <= b.right && h.top >= b.top && h.bottom <= b.bottom,
          avoidsContent: content.every(c => h.right <= c.left || h.left >= c.right || h.bottom <= c.top || h.top >= c.bottom),
          handleTouchAction: getComputedStyle(handle).touchAction, pictureTouchAction: getComputedStyle(button).touchAction };
      });
      checks.push({ viewportWidth: width, kind, ...result });
      if (!result.insidePicture || !result.avoidsContent) await page.screenshot({ path: path.join(output, `${width}-${kind}.png`), fullPage: false });
      assert.equal(result.insidePicture, true, `${width}-${kind} handle stays within the picture button`);
      assert.equal(result.avoidsContent, true, `${width}-${kind} handle avoids picture content`);
      assert.equal(result.width, 44); assert.equal(result.height, 44);
      assert.equal(result.handleTouchAction, "none"); assert.equal(result.pictureTouchAction, "auto");
    } finally { await context.close(); }
  }
  assert.equal(errors.length, 0);
} catch (error) { failure = String(error); process.exitCode = 1; }
finally { await writeFile(path.join(output, "results.json"), JSON.stringify({ runAt: new Date().toISOString(), checks, errors, failure }, null, 2)); await browser?.close(); await server?.close(); }
if (failure) throw new Error(failure);
console.log(`HANDLE_GEOMETRY_CASES=${checks.length}`);
