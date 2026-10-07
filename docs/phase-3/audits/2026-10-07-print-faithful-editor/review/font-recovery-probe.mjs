import { createServer } from "vite";
import { chromium } from "playwright";
import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import { boot, fixture, importDocument } from "../../../../../.claude/skills/run-instruction-builder/editor-browser-helpers.mjs";

let server, browser;
const evidence = {};
try {
  server = await createServer({ server: { host: "127.0.0.1", port: 0, open: false } });
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
  const { page, context } = await boot(browser, url, []);
  await page.route("**/fonts/**", route => route.fulfill({ status: 200, contentType: "font/ttf", body: Buffer.from([0, 1, 2, 3]) }));
  await importDocument(page, fixture([1]));
  await page.locator(".instruction-editor [role=alert]").waitFor();
  evidence.initialEditor = await page.locator(".instruction-editor").getAttribute("data-editor-layout");
  await page.unroute("**/fonts/**");
  await page.getByRole("button", { name: "Print / Download", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".output-dialog")?.getAttribute("data-output-status") === "ready");
  evidence.recoveredOutput = await page.locator(".output-dialog").getAttribute("data-output-status");
  await page.locator(".output-dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.getByLabel("Guide title", { exact: true }).fill("Title changed after successful font preparation");
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  evidence.editorAfterRecoveryAndEdit = await page.locator(".instruction-editor").getAttribute("data-editor-layout");
  evidence.editorSvgCount = await page.locator("[data-editor-page] svg").count();
  evidence.editorAlert = await page.locator(".instruction-editor [role=alert]").allTextContents();
  const out = new URL("./font-recovery.json", import.meta.url);
  await mkdir(new URL("./", import.meta.url), { recursive: true });
  await writeFile(out, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
  await context.close();
} finally {
  await browser?.close();
  await server?.close();
}
