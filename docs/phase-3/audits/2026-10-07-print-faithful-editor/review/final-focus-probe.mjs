import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { boot, fixture, importDocument, openActions, openGroup, snapshot } from "../../../../../.claude/skills/run-instruction-builder/editor-browser-helpers.mjs";

let server, browser;
const evidence = [];
try {
  server = await createServer({ server: { host: "127.0.0.1", port: 0, open: false } });
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
  for (const width of [1440, 390]) {
    const { page, context } = await boot(browser, url, [], { width, height: 1000 });
    const doc = fixture([1, 0]);
    doc.steps[0].tokens[0].quantity = { iconId: "quantity.amount", amount: 3, unit: "g", label: "3 g" };
    await importDocument(page, doc);
    await page.waitForFunction(() => document.querySelector(".instruction-editor")?.getAttribute("data-editor-layout") === "ready");
    await page.locator('[data-editor-picture="picture-0-0"]').click();
    await openActions(page);
    await page.getByRole("button", { name: "Copy picture", exact: true }).click();
    await page.keyboard.press("Escape");
    await openGroup(page, 1);
    await openActions(page);
    await page.getByRole("button", { name: "Paste picture", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector(".authoring-panel, dialog[open]"));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const pasted = (await snapshot(page)).steps[1].tokens[0];
    assert.ok(pasted.id !== doc.steps[0].tokens[0].id);
    assert.deepEqual({ ...pasted, id: doc.steps[0].tokens[0].id }, doc.steps[0].tokens[0]);
    const pasteFocus = await page.evaluate(() => ({ id: document.activeElement?.getAttribute("data-editor-picture"), inModal: !!document.activeElement?.closest("dialog") }));
    assert.equal(pasteFocus.id, pasted.id);
    assert.equal(pasteFocus.inModal, false);
    await page.getByLabel("Paper format", { exact: true }).selectOption("custom");
    const dimensions = page.locator(".editor-canvas-controls input[type=number]");
    await dimensions.nth(0).fill("20");
    await dimensions.nth(1).fill("20");
    await page.waitForFunction(() => document.querySelector(".instruction-editor")?.getAttribute("data-editor-layout") === "blocked");
    const targets = await page.locator("[data-editor-picture]").evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.editorPicture, disabled: node.disabled, hidden: node.getAttribute("aria-hidden"), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
    assert.equal(new Set(targets.map(node => node.id)).size, targets.length);
    assert.ok(targets.every(node => !node.disabled && node.hidden !== "true" && node.width >= 44 && node.height >= 44));
    const physical = await page.locator(".editor-picture--physical button").evaluateAll(nodes => nodes.map(node => ({ disabled: node.disabled, hidden: node.getAttribute("aria-hidden"), identity: node.getAttribute("data-editor-picture") })));
    assert.ok(physical.length > 0 && physical.every(node => node.disabled && node.hidden === "true" && node.identity === null));
    await page.evaluate(async id => (await import("/src/state/ui.ts")).focusPicture(id), pasted.id);
    await page.waitForFunction(id => document.activeElement?.getAttribute("data-editor-picture") === id, pasted.id);
    evidence.push({ width, pasteFocus, targets, physical, tinyFocus: await page.evaluate(() => ({ width: document.activeElement.getBoundingClientRect().width, height: document.activeElement.getBoundingClientRect().height })) });
    await context.close();
  }
  await writeFile(new URL("./final-focus.json", import.meta.url), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally {
  await browser?.close();
  await server?.close();
}
