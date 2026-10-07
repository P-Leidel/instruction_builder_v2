import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { fixture, importDocument, downloadJson } from "../../../../../tests/browser/editor-browser-helpers.mjs";

const output = path.dirname(fileURLToPath(import.meta.url));
const results = [];
const server = await createServer({ server: { host: "127.0.0.1", port: 0, open: false } });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await chromium.launch({ headless: true });

async function state(page) {
  return page.evaluate(async () => ({
    events: window.touchDiagnosisEvents,
    calls: window.touchDiagnosisCalls,
    scrollY, innerHeight,
    dialog: document.querySelector("dialog[open]")?.getBoundingClientRect().toJSON(),
    pickerOpen: !!document.querySelector(".token-picker"),
    apple: document.querySelector('.token-picker button[aria-label="Apple"]')?.getBoundingClientRect().toJSON(),
    tokens: (await import("/src/state/document.ts")).documentSession.document.peek().steps.map(group => group.tokens.map(token => ({ id: token.id, label: token.label }))),
    drag: (await import("/src/state/editor-drag.ts")).editorDrag.peek(),
  }));
}

async function run(name, sequence, tapDriver = "playwright") {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: "en-US", isMobile: true, hasTouch: true, acceptDownloads: true, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const result = { name, sequence, tapDriver, errors };
  try {
    await page.goto(url); await page.locator(".app-brand").waitFor();
    const doc = fixture([8, 0]); doc.meta.title = "Touch diagnosis";
    await importDocument(page, doc);
    const cdp = await context.newCDPSession(page);
    const touch = (type, x, y, id = 1) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" || type === "touchCancel" ? [] : [{ x, y, id }] });
    await page.evaluate(() => {
      window.touchDiagnosisEvents = []; window.touchDiagnosisCalls = [];
      for (const [label, target] of [["window", window], ["document", document]]) {
        for (const capture of [true, false]) for (const type of ["pointerdown", "pointerup", "pointercancel", "touchstart", "touchend", "touchcancel", "click"]) {
          target.addEventListener(type, event => window.touchDiagnosisEvents.push({
            type, listener: `${label}-${capture ? "capture" : "bubble"}`,
            target: event.target.closest?.("button")?.getAttribute("aria-label") ?? event.target.tagName,
            x: event.clientX ?? event.changedTouches?.[0]?.clientX,
            y: event.clientY ?? event.changedTouches?.[0]?.clientY,
            pointer: event.pointerType, id: event.pointerId, detail: event.detail,
            prevented: event.defaultPrevented, trusted: event.isTrusted,
          }), { capture, passive: type.startsWith("touch") });
        }
      }
      for (const method of ["preventDefault", "stopPropagation", "stopImmediatePropagation"]) {
        const original = Event.prototype[method];
        Event.prototype[method] = function (...args) {
          window.touchDiagnosisCalls.push({ method, type: this.type, target: this.target?.closest?.("button")?.getAttribute("aria-label"), stack: new Error().stack });
          return original.apply(this, args);
        };
      }
    });
    if (sequence.includes("drag")) {
      await page.evaluate(() => scrollTo(0, 0));
      const handle = page.locator('[data-picture-drag="picture-0-0"]');
      await handle.scrollIntoViewIfNeeded(); const from = await handle.boundingBox();
      const to = await page.locator('[data-editor-picture="picture-0-3"]').boundingBox();
      await touch("touchStart", from.x + from.width / 2, from.y + from.height / 2);
      await touch("touchMove", to.x + to.width - 12, to.y + 40);
      await page.locator(".editor-drag-ghost").waitFor();
      if (sequence.includes("screenshot")) await page.screenshot({ path: path.join(output, `${name}-drag.png`), fullPage: true });
      await touch("touchEnd");
      if (sequence.includes("exact")) await downloadJson(page);
    }
    if (sequence.includes("cancel")) {
      await page.evaluate(() => scrollTo(0, 0));
      const handle = page.locator('[data-picture-drag="picture-0-1"]');
      await handle.scrollIntoViewIfNeeded(); const from = await handle.boundingBox();
      await touch("touchStart", from.x + 20, from.y + 20);
      await touch("touchMove", from.x + 50, from.y - 50);
      await touch("touchCancel");
      if (sequence.includes("exact")) await downloadJson(page);
    }
    if (sequence.includes("scroll")) {
      await page.evaluate(() => scrollTo(0, 0));
      const tile = await page.locator("[data-editor-picture]").first().boundingBox();
      await touch("touchStart", tile.x + 25, tile.y + 50);
      await touch("touchMove", tile.x + 25, tile.y - 140);
      await touch("touchEnd");
      await page.waitForFunction(() => scrollY > 0);
      await page.evaluate(() => new Promise(resolve => {
        let last = scrollY, stable = 0;
        function frame() { if (scrollY === last) stable++; else stable = 0; last = scrollY; if (stable >= 5) resolve(); else requestAnimationFrame(frame); }
        requestAnimationFrame(frame);
      }));
    }
    await page.locator('[data-add-picture="group-1"]').click();
    await page.getByRole("searchbox", { name: "Search pictures", exact: true }).fill("Apple");
    result.beforeTap = await state(page);
    await page.evaluate(() => { window.touchDiagnosisEvents = []; window.touchDiagnosisCalls = []; });
    const apple = page.locator(".token-picker").getByRole("button", { name: "Apple", exact: true });
    if (tapDriver === "playwright") await apple.tap();
    else {
      const box = await apple.boundingBox();
      await touch("touchStart", box.x + box.width / 2, box.y + box.height / 2, tapDriver === "cdp-new-id" ? 8 : 1);
      await touch("touchEnd");
    }
    await page.waitForTimeout(600);
    result.afterTap = await state(page);
    result.inserted = result.afterTap.tokens[1].some(token => token.label === "Apple");
    result.listeners = (await cdp.send("Runtime.evaluate", {
      expression: `JSON.stringify([window,document,document.querySelector('.token-picker button[aria-label="Apple"]')].filter(Boolean).map(node => ({ target: node === window ? 'window' : node === document ? 'document' : 'apple', listeners: Object.fromEntries(Object.entries(getEventListeners(node)).map(([type,list]) => [type,list.map(item => ({ capture:item.useCapture,passive:item.passive,listener:String(item.listener) }))])) })))`,
      includeCommandLineAPI: true, returnByValue: true,
    })).result.value;
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
  } catch (error) { result.failure = String(error); }
  finally { await context.close(); }
  results.push(result);
  await writeFile(path.join(output, "touch-picker-results.json"), JSON.stringify(results, null, 2));
  console.log(`${name}: inserted=${result.inserted}; failure=${result.failure ?? "none"}`);
}

try {
  await run("fresh-playwright", []);
  await run("fresh-cdp", [], "cdp");
  await run("drag-playwright", ["drag"]);
  await run("drag-cancel-playwright", ["drag", "cancel"]);
  await run("scroll-playwright", ["scroll"]);
  await run("exact-playwright", ["drag", "screenshot", "cancel", "scroll", "exact"]);
  await run("exact-cdp", ["drag", "screenshot", "cancel", "scroll", "exact"], "cdp");
  await run("exact-cdp-new-id", ["drag", "screenshot", "cancel", "scroll", "exact"], "cdp-new-id");
} finally { await browser.close(); await server.close(); }
