import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { prepareOfflineAssets } from "./offline-assets.mjs";

async function fixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "instruction-offline-"));
  try {
    await mkdir(path.join(directory, "assets"));
    await mkdir(path.join(directory, "icons"));
    await mkdir(path.join(directory, "fonts", "source-sans-3"), { recursive: true });
    await writeFile(path.join(directory, "index.html"), "<html>App</html>");
    await writeFile(path.join(directory, "sw.js"), 'const CACHE_NAME = "instruction-builder-v1";');
    await writeFile(path.join(directory, "assets", "main.js"), "main();");
    await writeFile(path.join(directory, "assets", "lazy-pdf.js"), "pdf();");
    await writeFile(path.join(directory, "assets", "style.css"), "body{}");
    await writeFile(path.join(directory, "assets", "main.js.map"), "{}");
    await writeFile(path.join(directory, "manifest.webmanifest"), "{}");
    await writeFile(path.join(directory, "icons", "icon.png"), "PNG");
    await writeFile(path.join(directory, "fonts", "source-sans-3", "SourceSans3-Regular.ttf"), "TTF");
    await writeFile(path.join(directory, "fonts", "source-sans-3", "LICENSE.md"), "OFL");
    await run(directory);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test("production offline manifest includes lazily loaded export assets and the navigation shell", async () => {
  await fixture(async (directory) => {
    await prepareOfflineAssets(directory);
    const manifest = JSON.parse(await readFile(path.join(directory, "offline-assets.json"), "utf8"));
    assert.deepEqual(manifest.assets, ["/", "/assets/lazy-pdf.js", "/assets/main.js", "/assets/style.css", "/fonts/source-sans-3/LICENSE.md", "/fonts/source-sans-3/SourceSans3-Regular.ttf", "/icons/icon.png", "/manifest.webmanifest"]);
    const cacheName = vm.runInNewContext(`${await readFile(path.join(directory, "sw.js"), "utf8")}; CACHE_NAME`);
    assert.equal(cacheName, manifest.cacheName);
  });
});

test("changed build content uses a different offline cache, while an unchanged build stays stable", async () => {
  await fixture(async (directory) => {
    await prepareOfflineAssets(directory);
    const first = JSON.parse(await readFile(path.join(directory, "offline-assets.json"), "utf8"));
    await prepareOfflineAssets(directory);
    const same = JSON.parse(await readFile(path.join(directory, "offline-assets.json"), "utf8"));
    assert.equal(same.cacheName, first.cacheName);
    await writeFile(path.join(directory, "assets", "lazy-pdf.js"), "changedPdf();");
    await prepareOfflineAssets(directory);
    const changed = JSON.parse(await readFile(path.join(directory, "offline-assets.json"), "utf8"));
    assert.notEqual(changed.cacheName, first.cacheName);
    await writeFile(path.join(directory, "fonts", "source-sans-3", "SourceSans3-Regular.ttf"), "changedTTF");
    await prepareOfflineAssets(directory);
    const changedFont = JSON.parse(await readFile(path.join(directory, "offline-assets.json"), "utf8"));
    assert.notEqual(changedFont.cacheName, changed.cacheName);
  });
});
