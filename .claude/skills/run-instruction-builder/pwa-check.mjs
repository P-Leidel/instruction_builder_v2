// Production: node pwa-check.mjs <url> <output-dir>. Each format has its own cold install/context.
import process from "node:process";
import { Buffer } from "node:buffer";
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { assertChecks } from "../../../scripts/check-results.mjs";

const url = process.argv[2] ?? "http://127.0.0.1:4173/", output = path.resolve(process.argv[3] ?? "docs/phase-3/audits/2026-10-06-overhaul/export-integration-proof/pwa");
const checks = {}, errors = [], runs = []; let browser, failure;
function check(name, value) { checks[name] = value === true; assert.equal(value, true, name); }
function fixture(format) { return { schemaVersion: 2, meta: { title: `Cold ${format} guide`, domain: "proof", presentation: "sequence", createdAt: "2026-10-06T00:00:00Z" }, steps: [{ id: "cold-group", title: "Three libraries", time: { iconId: "time.duration", label: "1m", seconds: 60 }, tokens: [
  { id: "cold-kitchen", category: "action", iconId: "action.chop", label: "Chop", quantity: { iconId: "quantity.amount", amount: 2, unit: "kg", label: "2 kg" }, warning: { iconId: "warning.sharp", label: "Sharp" } },
  { id: "cold-routines", category: "action", iconId: "routines.action.wash-hands", label: "Wash hands" },
  { id: "cold-learning", category: "action", iconId: "learning.action.count", label: "Count", ...(format === "JSON" ? { note: "日本語 remains editable in JSON" } : {}) },
] }] }; }
try {
  await mkdir(output, { recursive: true }); browser = await chromium.launch();
  for (const format of ["PDF", "PNG", "SVG", "JSON"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "en-US", acceptDownloads: true });
    try {
      const page = await context.newPage(), loaded = [], requestFailures = [], downloads = [], fontResponses = []; let offlinePhase = false; const doc = fixture(format), run = { format, loaded, requestFailures, fontResponses }; runs.push(run);
      page.on("response", response => { if (/\.ttf$/.test(new URL(response.url()).pathname)) fontResponses.push({ offline: offlinePhase, fromServiceWorker: response.fromServiceWorker(), status: response.status() }); });
      page.on("request", request => { if (/^https?:/.test(request.url())) loaded.push(new URL(request.url()).pathname); });
      page.on("requestfailed", request => requestFailures.push(`${request.url()}: ${request.failure()?.errorText}`));
      page.on("pageerror", error => errors.push(error.message)); page.on("console", message => { if (message.type() === "error") errors.push(message.text()); }); page.on("download", download => downloads.push(download.suggestedFilename()));
      await page.goto(url); await page.locator(".app-brand").waitFor();
      const response = await page.request.get(new URL("offline-assets.json", url).href); check(`${format}_manifest_reachable`, response.ok()); const manifest = await response.json(); run.manifest = manifest;
      const reachable = await Promise.all(["manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"].map(async name => (await page.request.get(new URL(name, url).href)).ok())); check(`${format}_icons_and_manifest`, reachable.every(Boolean));
      check(`${format}_font_and_converter_manifest`, manifest.assets.includes("/fonts/SourceSans3-Regular-3.052.ttf") && manifest.assets.includes("/fonts/SourceSans3-LICENSE.md") && manifest.assets.some(name => /jspdf.*\.js$/.test(name)) && manifest.assets.some(name => /svg2pdf.*\.js$/.test(name)));
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 30000 });
      const cached = await page.evaluate(async name => (await (await caches.open(name)).keys()).map(request => new URL(request.url).pathname), manifest.cacheName); run.cachedUrls = cached;
      check(`${format}_complete_cache_before_control`, manifest.assets.every(name => cached.includes(name)));
      await page.getByLabel("Choose a JSON guide file", { exact: true }).setInputFiles({ name: "cold-guide.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(doc)) });
      await page.getByRole("dialog").getByRole("button", { name: "Confirm", exact: true }).click(); await page.getByLabel("Guide title", { exact: true }).waitFor();
      await page.waitForFunction(title => document.querySelector(".guide-title input")?.value === title, doc.meta.title); await page.locator(".save-status--saved").waitFor();
      run.beforeOffline = { loaded: [...loaded], fontFaces: await page.evaluate(() => document.fonts.size), downloads: [...downloads] };
      check(`${format}_no_online_output_converter_warmup`, !loaded.some(name => /jspdf|svg2pdf/.test(name)) && downloads.length === 0);
      // The physical editor prepares its font online. Reload discards the JS
      // font state; clear HTTP cache as well, so this next preparation proves
      // the installed service-worker assets are sufficient on their own.
      const cdp = await context.newCDPSession(page); await cdp.send("Network.clearBrowserCache"); await cdp.detach();
      offlinePhase = true; await context.setOffline(true); await page.reload(); await page.getByLabel("Guide title", { exact: true }).waitFor({ timeout: 10000 });
      await page.waitForSelector('[data-editor-layout="ready"]');
      check(`${format}_offline_editor_font_from_installed_cache`, fontResponses.some(response => response.offline && response.fromServiceWorker && response.status === 200));
      check(`${format}_guide_survives_offline_reload`, await page.getByLabel("Guide title", { exact: true }).inputValue() === doc.meta.title && await page.locator("[data-editor-picture]").count() === 3);
      let button; const fontRequestsBeforeExport = loaded.filter(name => /\.ttf$/.test(name)).length;
      if (format === "JSON") { await page.getByRole("button", { name: "Settings", exact: true }).click(); button = page.getByRole("button", { name: "Download JSON backup", exact: true }); }
      else {
        await page.getByRole("button", { name: "Print / Download", exact: true }).click(); await page.getByLabel("Output size", { exact: true }).waitFor({ timeout: 5000 }); await page.waitForSelector('[data-output-status="ready"]');
        check(`${format}_same_selected_preview_sources`, JSON.stringify(await page.locator('.output-preview__image [data-output-role="token"]').evaluateAll(nodes => nodes.map(node => node.getAttribute("data-token-id")))) === JSON.stringify(doc.steps[0].tokens.map(token => token.id)));
        check(`${format}_same_selected_semantic_sources`, JSON.stringify(await page.locator(".reading-content [data-reading-picture]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-reading-picture")))) === JSON.stringify(doc.steps[0].tokens.map(token => token.id)));
        button = page.getByRole("button", { name: format === "PDF" ? "Download PDF" : format === "PNG" ? "Download PNG page 1 of 1 at 150 dpi" : "Download SVG page 1 of 1", exact: true });
      }
      const pending = page.waitForEvent("download"); await button.click(); const artifact = await pending; assert.equal(await artifact.failure(), null); const bytes = await readFile(await artifact.path()); assert.ok(bytes.length);
      const expected = `cold-${format.toLowerCase()}-guide${format === "PNG" || format === "SVG" ? "-page-01-of-01" : ""}.${format.toLowerCase()}`; check(`${format}_captured_filename_one_download`, artifact.suggestedFilename() === expected && downloads.length === 1); await artifact.saveAs(path.join(output, expected)); run.file = expected; run.bytes = bytes.length;
      if (format === "JSON") { assert.deepEqual(JSON.parse(bytes.toString("utf8")), doc); check("JSON_full_editable_independent", true); check("JSON_backup_prepares_no_font_or_converter", !loaded.some(name => /jspdf|svg2pdf/.test(name)) && loaded.filter(name => /\.ttf$/.test(name)).length === fontRequestsBeforeExport); }
      else if (format === "SVG") {
        const inspection = await page.evaluate(xml => { const svg = new DOMParser().parseFromString(xml, "image/svg+xml").documentElement; return { width: svg.getAttribute("width"), height: svg.getAttribute("height"), ids: [...svg.querySelectorAll('[data-output-role="token"]')].map(node => node.getAttribute("data-token-id")), texts: [...svg.querySelectorAll("[data-output-text]")].map(node => node.getAttribute("data-output-text")), forbidden: svg.querySelectorAll("parsererror,text,image,script,foreignObject").length }; }, bytes.toString("utf8")); run.inspection = inspection;
        check("SVG_portable_exact_content", inspection.width === "210mm" && inspection.height === "297mm" && !inspection.forbidden && JSON.stringify(inspection.ids) === JSON.stringify(doc.steps[0].tokens.map(token => token.id)) && inspection.texts.includes("2 kg") && inspection.texts.some(text => text.includes("Sharp")) && inspection.texts.includes("1m"));
      } else if (format === "PNG") {
        check("PNG_signature_exact_150dpi", bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.readUInt32BE(16) === 1240 && bytes.readUInt32BE(20) === 1754);
        const inspection = await page.evaluate(async data => { const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)], { type: "image/png" })); const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height; const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Cannot reopen PNG"); ctx.drawImage(bitmap, 0, 0); const result = { width: bitmap.width, height: bitmap.height, alpha: ctx.getImageData(0, 0, 1, 1).data[3] }; bitmap.close(); return result; }, [...bytes]); run.inspection = inspection; check("PNG_independently_decodes_opaque", inspection.width === 1240 && inspection.height === 1754 && inspection.alpha === 255);
      } else {
        const raw = bytes.toString("latin1"), boxes = [...raw.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
        check("PDF_complete_vector_A4", raw.startsWith("%PDF-") && [...raw.matchAll(/\/Type\s*\/Page\b/g)].length === 1 && !/\/Subtype\s*\/Image\b/.test(raw) && boxes.length === 1 && Math.abs(Number(boxes[0][1]) * 25.4 / 72 - 210) < .001 && Math.abs(Number(boxes[0][2]) * 25.4 / 72 - 297) < .001);
      }
      check(`${format}_no_failed_requests`, requestFailures.length === 0); await page.screenshot({ path: path.join(output, `cold-${format.toLowerCase()}-output.png`), fullPage: true });
    } finally { await context.close(); }
  }
  check("no_console_or_page_errors", errors.length === 0); assertChecks(checks); console.log(`COLD_INSTALLED_FORMATS=4; OUTPUT_DIR=${output}`);
} catch (error) { failure = String(error); throw error; }
finally { try { await mkdir(output, { recursive: true }); await writeFile(path.join(output, "pwa-check-results.json"), JSON.stringify({ runAt: new Date().toISOString(), checks, errors, runs, failure }, null, 2) + "\n"); } finally { await browser?.close(); } }
