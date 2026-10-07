import process from "node:process";
// Exercise the actual worker across a deployment while an old app remains open.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { build as buildApp } from "vite";
import { prepareOfflineAssets } from "../../scripts/offline-assets.mjs";
import { Buffer } from "node:buffer";
const root = fileURLToPath(new URL("../../", import.meta.url));

const source = await readFile(new URL("../../public/sw.js", import.meta.url), "utf8");
const font = await readFile(new URL("../../public/fonts/SourceSans3-Regular-3.052.ttf", import.meta.url));
const output = path.resolve(process.argv[2] ?? path.join(root, "artifacts", "pwa-update"));
const cacheName = (build) => `instruction-builder-v2-update-fixture-${build}`;
let build = "old";
const server = createServer((request, response) => {
  const pathname = new URL(request.url, "http://fixture.test").pathname;
  const assets = ["/", `/assets/main-${build}.js`, `/assets/lazy-${build}.js`, `/fonts/proof-${build}.ttf`];
  let content;
  let type;
  if (pathname === "/sw.js") {
    content = source.replace(/const CACHE_NAME = "[^"]+";/, `const CACHE_NAME = "${cacheName(build)}";`);
    type = "text/javascript";
  } else if (pathname === "/offline-assets.json") {
    content = JSON.stringify({ cacheName: cacheName(build), assets });
    type = "application/json";
  } else if (pathname === "/") {
    content = `<h1>Update fixture</h1><script type="module" crossorigin src="/assets/main-${build}.js"></script>`;
    type = "text/html";
  } else if (pathname === `/assets/main-${build}.js`) {
    content = `window.fixtureBuild = "${build}"; window.loadLazy = () => import("/assets/lazy-${build}.js").then(module => module.build); window.loadFont = async () => { const face = new FontFace("Proof", 'url("/fonts/proof-${build}.ttf")'); await face.load(); document.fonts.add(face); document.body.style.fontFamily = "Proof"; document.querySelector("h1").textContent = "Äpfel, Öl, Größe, Straße — ${build}"; return face.status; }; navigator.serviceWorker.register("/sw.js");`;
    type = "text/javascript";
  } else if (pathname === `/assets/lazy-${build}.js`) {
    content = `export const build = "${build}";`;
    type = "text/javascript";
  } else if (pathname === `/fonts/proof-${build}.ttf`) {
    content = font;
    type = "font/ttf";
  } else {
    response.writeHead(404);
    response.end("The old build is no longer served");
    return;
  }
  // Preview/CDN hosts may vary static responses by Origin even though the
  // body is identical; crossorigin page loads must still match the precache.
  response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store", "Vary": "Origin" });
  response.end(content);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
let browser;
const errors = [];
const observe = page => { page.on("pageerror", error => errors.push(error.message)); page.on("console", message => { if (message.type() === "error") errors.push(message.text()); }); };
try {
  browser = await chromium.launch();
  const context = await browser.newContext();
  const oldPage = await context.newPage();
  observe(oldPage);
  await oldPage.goto(url);
  await oldPage.waitForFunction(() => window.fixtureBuild === "old" && navigator.serviceWorker.controller !== null);
  assert.deepEqual(await oldPage.evaluate(() => caches.keys()), [cacheName("old")]);
  await oldPage.evaluate(() => caches.open("other-product-fixture"));

  build = "new";
  await oldPage.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await oldPage.waitForFunction(async () => (await navigator.serviceWorker.getRegistration()).waiting?.state === "installed");
  // A forced skipWaiting can briefly expose an installed waiting worker
  // before activation. Observe across that transition so the test cannot
  // accidentally exercise the old export before its cache is deleted.
  await oldPage.waitForTimeout(500);
  assert.equal(await oldPage.evaluate(async () => (await navigator.serviceWorker.getRegistration()).waiting?.state), "installed",
    "The updated worker must remain waiting while the old app is still open");
  const pendingCaches = await oldPage.evaluate(() => caches.keys());
  assert.ok(pendingCaches.includes(cacheName("old")), "The old build cache must survive while its client remains open");
  assert.ok(pendingCaches.includes(cacheName("new")), "The waiting worker must completely precache the new build");

  // The lazy module was never requested by the page while online. The server
  // also no longer serves its URL, so only the retained old cache can work.
  await context.setOffline(true);
  assert.equal(await oldPage.evaluate(() => window.loadLazy()), "old", "An open old app must still load its first lazy export after an update");
  assert.equal(await oldPage.evaluate(() => window.loadFont()), "loaded", "The old client's never-used font must load from its retained Vary: Origin cache");
  await mkdir(output, { recursive: true });
  await oldPage.screenshot({ path: path.join(output, "old-first-font-offline.png") });
  await oldPage.close();
  await context.setOffline(false);

  const newPage = await context.newPage();
  observe(newPage);
  await newPage.goto(url);
  await newPage.waitForFunction(() => window.fixtureBuild === "new" && navigator.serviceWorker.controller !== null);
  await newPage.waitForFunction(async (oldCache) => !(await caches.keys()).includes(oldCache), cacheName("old"));
  const activeCaches = await newPage.evaluate(() => caches.keys());
  assert.ok(activeCaches.includes(cacheName("new")), "The new worker must retain its complete build cache");
  assert.ok(activeCaches.includes("other-product-fixture"), "Activation must retain caches owned by other products");

  await context.setOffline(true);
  await newPage.reload();
  await newPage.waitForFunction(() => window.fixtureBuild === "new");
  assert.equal(await newPage.evaluate(() => window.loadLazy()), "new", "The replacement app must load its first lazy export offline");
  assert.equal(await newPage.evaluate(() => window.loadFont()), "loaded", "The new client's never-used font must load offline with Vary: Origin");
  await newPage.screenshot({ path: path.join(output, "new-first-font-offline.png") });
  assert.deepEqual(errors, [], "An update must not cause uncaught errors in either app version");
  console.log("PWA_UPDATE_RETAINS_OLD_CLIENT_EXPORT_AND_ACTIVATES_NEW_BUILD=PASS");
  await writeFile(path.join(output, "pwa-update-results.json"), JSON.stringify({ runAt: new Date().toISOString(), browser: browser.version(), waitingAcrossObservation: true, oldColdLazyAndFontOffline: true, newColdLazyAndFontOffline: true, otherProductCacheRetained: true, pendingCaches, activeCaches, errors }, null, 2) + "\n");
  await context.close();
} finally {
  try { await browser?.close(); }
  finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

// Use two real production Apps as well as the focused worker fixture above.
// Build-only side effects distinguish main/converter identities without
// changing authored data, persistence, schemas, or output geometry.
await actualAppUpdate();
async function actualAppUpdate() {

  const temporary = await mkdtemp(path.join(os.tmpdir(), "instruction-output-update-"));
  const artifacts = path.join(output, "actual-app"), manifests = {}, requests = [], failures = [], errors = [], runs = [];
  let current = "old", server, browser, context, failure;
  const directories = { old: path.join(temporary, "old"), new: path.join(temporary, "new") };
  function validateCleanup() {
    if (!temporary.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(temporary).startsWith("instruction-output-update-")) throw new Error("Unsafe update proof cleanup path");
  }
  const doc = { schemaVersion: 2, meta: { title: "Waiting update guide", domain: "proof", presentation: "sequence", createdAt: "2026-10-06T00:00:00Z" }, steps: [{ id: "update-group", title: "Äpfel, Öl, Größe und Straße", time: { iconId: "time.duration", seconds: 60, label: "1m" }, tokens: [
    { id: "update-kitchen", category: "action", iconId: "action.chop", label: "Chop", quantity: { iconId: "quantity.amount", amount: 2, unit: "kg", label: "2 kg" }, warning: { iconId: "warning.sharp", label: "Sharp" } },
    { id: "update-routine", category: "action", iconId: "routines.action.wash-hands", label: "Wash hands" },
    { id: "update-learning", category: "action", iconId: "learning.action.count", label: "Count" },
  ] }] };
  async function cacheComplete(page, manifest) {
    await page.waitForFunction(async manifest => {
      if (navigator.serviceWorker.controller === null) return false;
      const cached = (await (await caches.open(manifest.cacheName)).keys()).map(request => new URL(request.url).pathname);
      return manifest.assets.every(name => cached.includes(name));
    }, manifest);
  }
  async function firstPdf(page, version, loaded) {
    await page.waitForSelector('[data-editor-layout="ready"]');
    const run = { version, beforeOutput: { loaded: [...loaded], fontFaces: await page.evaluate(() => document.fonts.size) } }; runs.push(run);
    assert.equal(run.beforeOutput.fontFaces, 1, `${version}: physical editor prepared its font`);
    assert.equal(loaded.some(name => /jspdf|svg2pdf/.test(name)), false, `${version}: output converters have never warmed online`);
    const serverRequests = requests.length;
    await context.setOffline(true);
    await page.getByRole("button", { name: "Print / Download", exact: true }).click();
    await page.getByLabel("Output size", { exact: true }).waitFor(); await page.waitForSelector('[data-output-status="ready"]');
    const ids = doc.steps[0].tokens.map(token => token.id);
    assert.deepEqual(await page.locator('.output-preview__image [data-output-role="token"]').evaluateAll(nodes => nodes.map(node => node.getAttribute("data-token-id"))), ids);
    assert.deepEqual(await page.locator('.reading-content [data-reading-picture]').evaluateAll(nodes => nodes.map(node => node.getAttribute("data-reading-picture"))), ids);
    // The equivalent recipient view is inside a collapsed disclosure by default.
    const semanticText = await page.locator(".reading-content").textContent(); assert.match(semanticText, /2 kg/); assert.match(semanticText, /Sharp/); assert.match(semanticText, /1m/);
    const paintedText = await page.locator('.output-preview__image [data-output-text]').evaluateAll(nodes => nodes.map(node => node.getAttribute("data-output-text")));
    assert.ok(paintedText.includes("2 kg") && paintedText.some(text => text.includes("Sharp")) && paintedText.includes("1m"));
    const pending = page.waitForEvent("download"); await page.getByRole("button", { name: "Download PDF", exact: true }).click(); const download = await pending;
    assert.equal(await download.failure(), null); assert.equal(download.suggestedFilename(), "waiting-update-guide.pdf");
    const bytes = await readFile(await download.path()), raw = bytes.toString("latin1"), boxes = [...raw.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
    assert.match(raw, /^%PDF-/); assert.equal([...raw.matchAll(/\/Type\s*\/Page\b/g)].length, 1); assert.equal(/\/Subtype\s*\/Image\b/.test(raw), false); assert.equal(boxes.length, 1);
    assert.ok(Math.abs(Number(boxes[0][1]) * 25.4 / 72 - 210) < .001 && Math.abs(Number(boxes[0][2]) * 25.4 / 72 - 297) < .001);
    assert.equal(await page.evaluate(() => globalThis.__updatePdfBuild), version); assert.equal(await page.evaluate(() => globalThis.__updateSvg2pdfBuild), version);
    assert.equal(requests.length, serverRequests, `${version}: first output makes no server request`);
    await download.saveAs(path.join(artifacts, `${version}-first-output.pdf`)); await page.screenshot({ path: path.join(artifacts, `${version}-first-output-offline.png`), fullPage: true });
    run.filename = download.suggestedFilename(); run.bytes = bytes.length; run.sourceIds = ids; run.vectorPages = 1; run.noServerRequests = true; run.afterOutputLoaded = [...loaded];
  }
  try {
    await mkdir(artifacts, { recursive: true });
    for (const version of ["old", "new"]) {
      await buildApp({ root, logLevel: "warn", build: { outDir: directories[version], emptyOutDir: true }, plugins: [{ name: `actual-update-${version}`, transform(code, id) {
        const clean = id.replaceAll("\\", "/").split("?")[0];
        const key = clean.endsWith("/src/main.tsx") ? "__updateAppBuild" : /\/node_modules\/jspdf\/.*\.js$/.test(clean) ? "__updatePdfBuild" : /\/node_modules\/svg2pdf\.js\/.*\.js$/.test(clean) ? "__updateSvg2pdfBuild" : null;
        return key ? { code: `${code}\n;globalThis.${key} = ${JSON.stringify(version)};`, map: null } : null;
      } }] });
      manifests[version] = await prepareOfflineAssets(directories[version]);
    }
    assert.notEqual(manifests.old.cacheName, manifests.new.cacheName);
    for (const library of ["jspdf", "svg2pdf"]) {
      const oldUrl = manifests.old.assets.find(name => name.includes(library)), newUrl = manifests.new.assets.find(name => name.includes(library));
      assert.ok(oldUrl && newUrl); assert.notEqual(oldUrl, newUrl, `${library}: old client genuinely needs a retained old converter identity`);
    }
    server = createServer(async (request, response) => {
      const pathname = new URL(request.url, "http://proof.test").pathname; requests.push({ version: current, pathname });
      const directory = directories[current], file = path.resolve(directory, pathname === "/" ? "index.html" : pathname.slice(1));
      if (!file.startsWith(directory + path.sep)) { response.writeHead(403).end(); return; }
      try { const bytes = await readFile(file); response.writeHead(200, { "Content-Type": ({ ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".ttf": "font/ttf", ".webmanifest": "application/manifest+json" })[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store", "Vary": "Origin" }); response.end(bytes); }
      catch { response.writeHead(404).end("Only the current build is served"); }
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); const url = `http://127.0.0.1:${server.address().port}/`;
    browser = await chromium.launch(); context = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    function observe(page) { const loaded = []; page.on("request", request => { if (/^https?:/.test(request.url())) loaded.push(new URL(request.url()).pathname); }); page.on("requestfailed", request => failures.push(`${request.url()}: ${request.failure()?.errorText}`)); page.on("pageerror", error => errors.push(error.message)); page.on("console", message => { if (message.type() === "error") errors.push(message.text()); }); return loaded; }
    const oldPage = await context.newPage(), oldLoaded = observe(oldPage); await oldPage.goto(url); await oldPage.locator(".app-brand").waitFor(); await cacheComplete(oldPage, manifests.old);
    assert.equal(await oldPage.evaluate(() => globalThis.__updateAppBuild), "old");
    await oldPage.getByLabel("Choose a JSON guide file", { exact: true }).setInputFiles({ name: "update-guide.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(doc)) });
    await oldPage.getByRole("dialog").getByRole("button", { name: "Confirm", exact: true }).click(); await oldPage.getByLabel("Guide title", { exact: true }).waitFor(); await oldPage.locator(".save-status--saved").waitFor();
    await oldPage.evaluate(async () => { await caches.open("other-product-actual-update"); window.__originalController = navigator.serviceWorker.controller; });
    current = "new";
    const obsolete = manifests.old.assets.find(name => name.includes("jspdf")); assert.equal((await oldPage.request.get(new URL(obsolete, url).href)).status(), 404, "Server no longer has the old converter");
    await oldPage.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await oldPage.waitForFunction(async () => (await navigator.serviceWorker.getRegistration()).waiting?.state === "installed");
    const waitingStart = Date.now(); await oldPage.waitForTimeout(500); const waitingObservationMs = Date.now() - waitingStart;
    const waiting = await oldPage.evaluate(async () => ({ state: (await navigator.serviceWorker.getRegistration()).waiting?.state, sameController: navigator.serviceWorker.controller === window.__originalController, caches: await caches.keys() }));
    assert.equal(waiting.state, "installed"); assert.equal(waiting.sameController, true); assert.ok(waiting.caches.includes(manifests.old.cacheName) && waiting.caches.includes(manifests.new.cacheName));
    await firstPdf(oldPage, "old", oldLoaded); await oldPage.close(); await context.setOffline(false);
    const newPage = await context.newPage(), newLoaded = observe(newPage); await newPage.goto(url); await newPage.getByLabel("Guide title", { exact: true }).waitFor();
    await newPage.waitForFunction(async oldCache => navigator.serviceWorker.controller !== null && !(await caches.keys()).includes(oldCache), manifests.old.cacheName);
    assert.equal(await newPage.evaluate(() => globalThis.__updateAppBuild), "new"); await cacheComplete(newPage, manifests.new);
    const activeCaches = await newPage.evaluate(() => caches.keys()); assert.ok(activeCaches.includes(manifests.new.cacheName) && activeCaches.includes("other-product-actual-update"));
    assert.equal(await newPage.getByLabel("Guide title", { exact: true }).inputValue(), doc.meta.title);
    await firstPdf(newPage, "new", newLoaded); assert.deepEqual(failures, []); assert.deepEqual(errors, []);
    await writeFile(path.join(artifacts, "actual-app-update-results.json"), JSON.stringify({ runAt: new Date().toISOString(), browser: browser.version(), manifests, waitingObservationMs, waiting, activeCaches, requests, runs, failures, errors, oldConverterUnavailableAtServer: true, oldCacheRemovedOnlyAfterLastClientClosed: true }, null, 2) + "\n");
    await rm(path.join(artifacts, "actual-app-update-failure.json"), { force: true });
    console.log("ACTUAL_APP_FIRST_PDF_OLD_AND_NEW_OFFLINE_ACROSS_WAITING_UPDATE=PASS");
  } catch (error) { failure = String(error); throw error; }
  finally {
    try { if (failure) await writeFile(path.join(artifacts, "actual-app-update-failure.json"), JSON.stringify({ failure, manifests, requests, runs, failures, errors }, null, 2) + "\n"); }
    finally { try { try { await context?.close(); } finally { await browser?.close(); } } finally { try { if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); } finally {
      validateCleanup(); await rm(temporary, { recursive: true, force: true });
    } } }
  }
}
