import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import process from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { boot, createBlank, insert, importDocument, fixture, snapshot, groupEditControl } from "./editor-browser-helpers.mjs";
import { assertChecks } from "../../scripts/check-results.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = path.resolve(process.argv[2] ?? path.join(root, "artifacts", "browser"));
let server; let browser; const errors = []; const checks = {}; const observations = [];
async function physicalGeometry(page) {
  return page.locator("[data-editor-page]").evaluateAll(pages => pages.map(paper => {
    const page = paper.getBoundingClientRect();
    const local = node => { const box = node.getBoundingClientRect(); return { x: box.x - page.x, y: box.y - page.y, width: box.width, height: box.height }; };
    return { width: page.width, height: page.height,
      groups: [...paper.querySelectorAll("[data-editor-group]")].map(node => ({ id: node.dataset.editorGroup, segment: node.dataset.groupSegment, ...local(node) })),
      pictures: [...paper.querySelectorAll("[data-editor-picture]")].map(node => ({ id: node.dataset.editorPicture, ...local(node) })),
    };
  }));
}
function sameGeometry(before, after) {
  if (before.length !== after.length) return false;
  return before.every((page, index) => {
    const next = after[index];
    const same = (left, right) => ["x", "y", "width", "height"].every(key => left[key] === undefined && right[key] === undefined || Math.abs(left[key] - right[key]) < .1);
    return same(page, next) && ["groups", "pictures"].every(key => page[key].length === next[key].length && page[key].every((box, position) => box.id === next[key][position].id && box.segment === next[key][position].segment && same(box, next[key][position])));
  });
}
try {
  let url = process.argv[3]; if (!url) { server = await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false } }); await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}/`; }
  await mkdir(output, { recursive: true }); browser = await chromium.launch();
  for (const width of [320, 390, 768, 1440]) {
    const { page, context } = await boot(browser, url, errors, { width, height: 900 });
    try {
      await createBlank(page); await insert(page, "Onion"); await page.waitForSelector('[data-editor-layout="ready"]');
      const firstVisible = await page.locator("[data-editor-picture]").first().boundingBox();
      checks[`INITIAL_VIEWPORT_HAS_PICTURE_${width}`] = firstVisible.y >= 0 && firstVisible.y + firstVisible.height <= 900;
      checks[`INSERTED_PICTURE_FOCUS_${width}`] = await page.locator("[data-editor-picture]").first().evaluate(node => node === document.activeElement);
      await page.evaluate(() => window.scrollTo(0, 0));
      const doc = fixture(); await importDocument(page, doc); await page.waitForFunction(() => document.querySelectorAll("[data-editor-group]").length === 5);
      const short = page.locator("[data-editor-group]").first(); const before = await short.boundingBox(); const paperBefore = await page.locator("[data-editor-page]").first().boundingBox();
      await page.evaluate(async () => { const { documentSession, sessionActions } = await import("/src/state/document.ts"); const group = documentSession.document.peek().steps[4]; for (let i = 1; i < 20; i++) sessionActions.addTokenToStep(documentSession, group.id, { id: `long-${i}`, iconId: "object.onion", category: "object", label: "Onion" }); });
      await page.waitForFunction(() => document.querySelectorAll('[data-editor-group="group-4"] [data-editor-picture]').length === 20);
      const after = await short.boundingBox(); checks[`NO_GLOBAL_SHRINK_${width}`] = Math.abs(before.width - after.width) < .1 && Math.abs(before.height - after.height) < .1;
      const shortTile = await short.locator("[data-editor-picture]").first().boundingBox(); const longTile = await page.locator('[data-editor-group="group-4"] [data-editor-picture]').first().boundingBox();
      checks[`BOUNDED_LOCAL_TILE_SIZE_${width}`] = Math.abs(shortTile.width - longTile.width) < .1 && Math.abs(shortTile.height - longTile.height) < .1;
      const paperAfter = await page.locator("[data-editor-page]").first().boundingBox();
      checks[`PAPER_SIZE_STABLE_AFTER_LONG_GROUP_${width}`] = Math.abs(paperBefore.width - paperAfter.width) < .1 && Math.abs(paperBefore.height - paperAfter.height) < .1;
      const zoom = Number(await page.getByLabel("Canvas zoom", { exact: true }).inputValue()) / 100;
      checks[`CANONICAL_A4_PHYSICAL_DIMENSIONS_${width}`] = Math.abs(paperAfter.width - 210 * 96 / 25.4 * zoom) < .1 && Math.abs(paperAfter.height - 297 * 96 / 25.4 * zoom) < .1;
      const groupControl = await groupEditControl(page, "group-0"); const groupName = await groupControl.getAttribute("aria-label") ?? await groupControl.innerText();
      checks[`SEQUENCE_NUMBERS_${width}`] = groupName.includes("Step 1: Group 1");
      checks[`NO_DOT_DRAG_HANDLES_${width}`] = await page.locator(".editor-drag-handle,[data-picture-drag]").count() === 0;
      const metrics = await page.evaluate(() => { const controls = [...document.querySelectorAll("button,input,select,textarea")].filter((node) => node.getBoundingClientRect().width > 1 && !node.closest("[inert]")); return { overflow: document.documentElement.scrollWidth - window.innerWidth, controls: controls.map((node) => ({ name: node.getAttribute("aria-label") || node.textContent || node.type, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, font: parseFloat(getComputedStyle(node).fontSize) })) }; });
      checks[`CONTROL_MINIMA_${width}`] = metrics.controls.every((item) => item.width >= 43.9 && item.height >= 43.9 && item.font >= 16);
      checks[`NO_HORIZONTAL_OVERFLOW_${width}`] = metrics.overflow <= 1;
      checks[`GROUP_ADD_INSIDE_VIEWPORT_${width}`] = await page.locator("[data-add-picture]").evaluateAll(nodes => nodes.every(node => { const box = node.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth; }));
      await page.screenshot({ path: path.join(output, `${width}-five-group-editor.png`), fullPage: true });
      const past = await page.evaluate(async () => (await import("/src/state/document.ts")).documentSession.past.peek().length);
      const geometryBeforePanel = await physicalGeometry(page);
      await page.locator("[data-add-picture]").first().click();
      if (width < 768) await page.locator("dialog:modal").waitFor(); else await page.locator(".authoring-panel").waitFor();
      checks[`PANEL_MODALITY_${width}`] = width < 768 ? await page.locator("dialog:modal").count() === 1 : await page.locator(".authoring-panel").count() === 1 && await page.locator("dialog").count() === 0;
      checks[`PANEL_PRESERVES_PHYSICAL_GEOMETRY_${width}`] = sameGeometry(geometryBeforePanel, await physicalGeometry(page));
      if (width < 768) { for (let i = 0; i < 12; i++) { await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => !!document.activeElement.closest("dialog")), true); } }
      await page.getByRole("searchbox", { name: "Search pictures" }).fill("zz no matching symbol"); checks[`NO_RESULTS_${width}`] = await page.getByRole("status").filter({ hasText: "No pictures found" }).count() === 1;
      await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.querySelector(".token-picker"));
      await page.waitForFunction(() => document.querySelector("[data-add-picture]") === document.activeElement);
      checks[`ESCAPE_FOCUS_RETURN_${width}`] = await page.locator("[data-add-picture]").first().evaluate((node) => node === document.activeElement);
      checks[`PANEL_IS_NOT_HISTORY_${width}`] = past === await page.evaluate(async () => (await import("/src/state/document.ts")).documentSession.past.peek().length);
      const lockedGeometry = await physicalGeometry(page); await page.setViewportSize({ width: width < 768 ? 1440 : 390, height: 900 });
      checks[`VIEWPORT_PRESERVES_PHYSICAL_GEOMETRY_${width}`] = sameGeometry(lockedGeometry, await physicalGeometry(page));
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
      const zoomOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); checks[`TEXT_ZOOM_200_WRAP_${width}`] = zoomOverflow <= 1;
      await page.screenshot({ path: path.join(output, `${width}-text-zoom-200.png`), fullPage: true });
      await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
      observations.push({ width, firstVisible, before, after, paperBefore, paperAfter, geometryBeforePanel, metrics, zoomOverflow });
      if (width === 320 || width === 1440) {
        const workplace = fixture([2, 1, 1]); workplace.meta.title = "Prepare the workplace";
        workplace.steps[0].title = "Wash hands"; workplace.steps[0].tokens[1] = { id: "workplace-soap", iconId: "routines.object.soap", category: "object", label: "Soap" };
        workplace.steps[1].title = "Prepare vegetables"; workplace.steps[1].tokens[0].iconId = "action.chop"; workplace.steps[1].tokens[0].category = "action"; workplace.steps[1].tokens[0].label = "Chop onion";
        workplace.steps[2].title = "Store food"; workplace.steps[2].tokens[0].iconId = "tool.container"; workplace.steps[2].tokens[0].category = "tool"; workplace.steps[2].tokens[0].label = "Food container";
        await importDocument(page, workplace); await writeFile(path.join(output, "workplace-prototype.json"), JSON.stringify(await snapshot(page), null, 2)); await page.screenshot({ path: path.join(output, `${width}-workplace-prototype.png`), fullPage: true });
        await page.locator("[data-add-picture]").first().click(); await page.getByRole("searchbox").fill("wash"); await page.screenshot({ path: path.join(output, `${width}-workplace-context.png`), fullPage: true }); await page.screenshot({ path: path.join(output, `${width}-workplace-context-viewport.png`), fullPage: false }); await page.getByRole("button", { name: "Close", exact: true }).last().click();
        const routine = fixture([1, 1, 1]); routine.meta.title = "Get ready";
        for (const [index, iconId, label] of [[0, "routines.action.wash-hands", "Wash hands"], [1, "routines.action.brush-teeth", "Brush teeth"], [2, "routines.action.dress", "Get dressed"]]) { routine.steps[index].title = label; routine.steps[index].tokens[0] = { id: `routine-${index}`, iconId, category: "action", label }; }
        await importDocument(page, routine); await writeFile(path.join(output, "routine-prototype.json"), JSON.stringify(await snapshot(page), null, 2)); await page.screenshot({ path: path.join(output, `${width}-routine-prototype.png`), fullPage: true });
        await page.getByRole("button", { name: "Read", exact: true }).click(); await page.screenshot({ path: path.join(output, `${width}-routine-reader.png`), fullPage: true });
        checks[`RECIPIENT_HAS_NO_EDITOR_${width}`] = await page.locator("[data-editor-picture],.app__export-canvas,.app-toolbar").count() === 0;
        await page.getByRole("button", { name: "Back to editing", exact: true }).click();
      }
      checks[`LONG_GROUP_20_${width}`] = doc.steps.length === 5 && after.width > 0 && geometryBeforePanel.flatMap(page => page.pictures).filter(picture => picture.id === "picture-4-0" || picture.id.startsWith("long-")).length === 20;
    } finally { await context.close(); }
  }
  checks.NO_CONSOLE_OR_PAGE_ERRORS = errors.length === 0;
  await writeFile(path.join(output, "editor-evidence.json"), JSON.stringify({ runAt: new Date().toISOString(), browser: browser.version(), checks, observations, errors }, null, 2));
  assertChecks(checks);
} finally { await browser?.close(); await server?.close(); }
