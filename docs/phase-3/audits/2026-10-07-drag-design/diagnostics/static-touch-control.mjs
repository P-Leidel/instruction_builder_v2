import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const output = path.dirname(fileURLToPath(import.meta.url));
const results = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, scroll, delay] of [["fresh", false, 0], ["after-cdp-scroll", true, 0], ["after-cdp-scroll-500ms", true, 500], ["after-cdp-scroll-1000ms", true, 1000]]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: "en-US", isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}main{height:2400px;background:linear-gradient(#fafafa,#aaa)}#open{position:fixed;bottom:25px;left:20px;padding:20px}dialog{width:300px;padding:20px}#apple{width:200px;height:90px}</style><main></main><button id="open">Add picture</button><dialog><input aria-label="Search pictures"><button id="apple">Apple</button></dialog><script>window.events=[];window.inserted=false;document.querySelector('#open').onclick=()=>document.querySelector('dialog').showModal();document.querySelector('#apple').onclick=()=>{window.inserted=true;document.querySelector('dialog').close()};for(const type of ['pointerdown','pointerup','pointercancel','touchstart','touchend','click'])document.addEventListener(type,event=>events.push({type,target:event.target.id,prevented:event.defaultPrevented,time:event.timeStamp}),{capture:true,passive:true});</script>`);
    const cdp = await context.newCDPSession(page);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (scroll) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 100, y: 500, id: 1 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 100, y: 200, id: 1 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForFunction(() => scrollY > 0, null, { timeout: 2000 }).catch(async () => {
        console.log(`SCROLL_NOT_STARTED=${JSON.stringify(await page.evaluate(() => ({ events: window.events, scrollY, innerHeight, height: document.body.scrollHeight })))}`);
        throw new Error("Static control scroll did not begin");
      });
      await page.evaluate(() => new Promise(resolve => {
        let last = scrollY, stable = 0;
        function frame() { if (scrollY === last) stable++; else stable = 0; last = scrollY; if (stable >= 5) resolve(); else requestAnimationFrame(frame); }
        requestAnimationFrame(frame);
      }));
    }
    await page.locator("#open").click();
    await page.getByLabel("Search pictures").fill("Apple");
    if (delay) await page.waitForTimeout(delay);
    await page.evaluate(() => { window.events = []; });
    await page.locator("#apple").tap();
    await page.waitForTimeout(500);
    const result = { name, scroll, delay, ...await page.evaluate(() => ({ inserted: window.inserted, events: window.events, scrollY })) };
    console.log(`${name}: inserted=${result.inserted}; events=${result.events.map(event => event.type).join(",")}`);
    results.push(result);
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(path.join(output, "static-touch-results.json"), JSON.stringify(results, null, 2));
