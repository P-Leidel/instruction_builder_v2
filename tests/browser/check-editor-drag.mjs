import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { createServer } from "vite";
import { boot, fixture, importDocument, downloadJson } from "./editor-browser-helpers.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));

const output = path.resolve(process.argv[2] ?? path.join(root, "artifacts", "editor-drag"));
const checks = {}, errors = []; let browser, server, failure;
function check(name, value) { checks[name] = value === true; assert.equal(value, true, name); }
async function move(page, source, destination, edge = "before") {
  await source.scrollIntoViewIfNeeded(); const from = await source.boundingBox(); assert.ok(from);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await destination.scrollIntoViewIfNeeded(); const to = await destination.boundingBox(); assert.ok(to);
  await page.mouse.move(to.x + (edge === "before" ? 5 : to.width - 5), to.y + Math.min(40, to.height / 2), { steps: 12 });
  await page.mouse.up();
}
try {
  await mkdir(output, { recursive: true });
  let url = process.argv[3];
  if (!url) { server = await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false } }); await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}/`; }
  browser = await chromium.launch({ headless: true });
  const { page, context } = await boot(browser, url, errors);
  try {
    const doc = fixture([4, 1, 0]); doc.meta.title = "Drag proof";
    doc.steps[0].tokens.forEach((token, index) => { token.label = ["Apple", "Banana", "Grape", "Potato"][index]; });
    doc.steps[0].tokens[1].quantity = { iconId: "quantity.weight", label: "2 g", amount: 2, unit: "g" };
    await importDocument(page, doc);
    check("whole_picture_drag_surface_available_without_dots", await page.locator('[data-editor-picture="picture-0-0"]').count() === 1 && await page.locator(".editor-drag-handle").count() === 0);
    check("group_heading_drag_surface_available", await page.locator('[data-group-drag="group-0"]').count() === 1);
    await move(page, page.locator('[data-editor-picture="picture-0-0"]'), page.locator('[data-editor-picture="picture-0-3"]'), "after");
    let saved = await downloadJson(page);
    check("mouse_picture_reorders_forward", saved.steps[0].tokens.map(token => token.id).join() === "picture-0-1,picture-0-2,picture-0-3,picture-0-0");
    check("drop_does_not_open_details", !await page.locator(".authoring-panel").isVisible());
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    saved = await downloadJson(page); check("drag_undo_restores_order", saved.steps[0].tokens[0].id === "picture-0-0");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await move(page, page.locator('[data-editor-picture="picture-0-1"]'), page.locator('[data-editor-group="group-2"]'), "after");
    saved = await downloadJson(page);
    check("move_to_empty_group_preserves_id_and_details", saved.steps[2].tokens[0]?.id === "picture-0-1" && JSON.stringify(saved.steps[2].tokens[0].quantity) === JSON.stringify(doc.steps[0].tokens[1].quantity));
    check("cross_group_move_removes_single_source", saved.steps[0].tokens.length === 3);
    await move(page, page.locator('[data-group-drag="group-2"]'), page.locator('[data-editor-group="group-0"]'));
    saved = await downloadJson(page); check("groups_reorder_by_handle", saved.steps[0].id === "group-2");
    await page.locator(".save-status--saved").waitFor();
    await page.reload(); await page.getByLabel("Guide title", { exact: true }).waitFor();
    saved = await downloadJson(page); check("drag_changes_survive_reload", saved.steps[0].id === "group-2" && saved.steps[0].tokens[0].id === "picture-0-1");
    await move(page, page.locator('[data-editor-picture="picture-0-2"]'), page.locator('[data-editor-picture="picture-0-3"]'), "after");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    const beforeCancel = await downloadJson(page);
    const first = page.locator('[data-editor-picture="picture-0-2"]'); await first.scrollIntoViewIfNeeded();
    let box = await first.boundingBox();
    await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + 30, { steps: 3 });
    await page.locator(".editor-drag-ghost").waitFor();
    await page.keyboard.press("Escape"); await page.mouse.up();
    check("escape_cancels_drag_and_compatibility_click", JSON.stringify(await downloadJson(page)) === JSON.stringify(beforeCancel) && !await page.locator(".authoring-panel").isVisible() && !await page.locator(".editor-drag-ghost").count());
    check("cancel_preserves_redo", await page.getByRole("button", { name: "Redo", exact: true }).isEnabled());
    for (const reason of ["early_escape", "blur", "lost_capture"]) {
      await first.scrollIntoViewIfNeeded(); box = await first.boundingBox();
      await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down();
      if (reason === "early_escape") await page.keyboard.press("Escape");
      else {
        await page.mouse.move(box.x + 40, box.y + 30);
        if (reason === "blur") await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        else await first.evaluate(node => node.releasePointerCapture(1));
      }
      await page.mouse.up();
      check(`${reason}_cancels_release_click`, !await page.locator(".token-details").isVisible() && JSON.stringify(await downloadJson(page)) === JSON.stringify(beforeCancel));
    }
    await move(page, first, first, "before");
    check("own_slot_noop_preserves_redo", await page.getByRole("button", { name: "Redo", exact: true }).isEnabled());
    check("next_intentional_click_opens_details", await first.click().then(() => page.locator(".token-details").isVisible()));
    await page.keyboard.press("Escape");
    await first.scrollIntoViewIfNeeded(); box = await first.boundingBox();
    await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down(); await page.mouse.move(2, 10, { steps: 8 }); await page.mouse.up();
    check("off_editor_drop_preserves_document", JSON.stringify(await downloadJson(page)) === JSON.stringify(beforeCancel));
    await page.locator('[data-add-picture="group-0"]').click();
    const heading = await page.locator(".token-picker h2").evaluate(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      const rect = range.getClientRects()[0];
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    await page.evaluate(() => window.getSelection().removeAllRanges());
    await page.mouse.move(heading.x + 1, heading.y + heading.height / 2);
    await page.mouse.down();
    await page.mouse.move(heading.x + heading.width - 1, heading.y + heading.height / 2, { steps: 12 });
    await page.mouse.up();
    check("picker_heading_drag_does_not_select_text", await page.evaluate(() => window.getSelection().toString()) === "");
    await page.getByRole("searchbox", { name: "Search pictures", exact: true }).fill("Apple");
    const apple = page.locator(".token-picker").getByRole("button", { name: "Apple", exact: true });
    box = await apple.boundingBox(); await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down(); await page.keyboard.press("Escape"); await page.mouse.up();
    check("early_escape_library_does_not_insert", await page.locator(".token-picker").isVisible() && JSON.stringify(await downloadJson(page)) === JSON.stringify(beforeCancel));
    await move(page, apple, page.locator('[data-editor-picture="picture-0-1"]'), "after");
    saved = await downloadJson(page);
    const dropped = saved.steps.find(group => group.id === "group-2").tokens;
    check("desktop_library_drop_targets_actual_group", dropped.length === 2 && dropped[1].label === "Apple");
    check("library_drop_creates_unique_id_once", new Set(saved.steps.flatMap(group => group.tokens.map(token => token.id))).size === 6);
    check("library_drop_closes_picker", !await page.locator(".token-picker").isVisible());
    await page.screenshot({ path: path.join(output, "desktop.png"), fullPage: true });
    check("no_errors", errors.length === 0);
  } catch (error) { await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true }); throw error; }
  finally { await context.close(); }

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: "en-US", isMobile: true, hasTouch: true, acceptDownloads: true, serviceWorkers: "block" });
  const phone = await touchContext.newPage(); phone.on("pageerror", error => errors.push(error.message));
  try {
    await phone.goto(url); await phone.locator(".app-brand").waitFor();
    const doc = fixture([8, 0]); doc.meta.title = "Touch proof";
    await importDocument(phone, doc);
    await phone.locator('[data-add-picture="group-1"]').click();
    await phone.getByRole("searchbox", { name: "Search pictures", exact: true }).fill("Apple");
    await phone.locator(".token-picker").getByRole("button", { name: "Apple", exact: true }).tap();
    await phone.waitForFunction(() => !document.querySelector(".token-picker"));
    let saved = await downloadJson(phone); check("mobile_modal_picker_tap_adds_picture", saved.steps[1].tokens[0].label === "Apple");
    await phone.evaluate(() => scrollTo(0, 0));
    const cdp = await touchContext.newCDPSession(phone);
    const touch = async (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" || type === "touchCancel" ? [] : [{ x, y, id: 1 }] });
    const handle = phone.locator('[data-editor-picture="picture-0-0"]');
    await handle.click(); await phone.locator(".token-details").getByText("Actions", { exact: true }).click();
    await phone.getByRole("button", { name: "Move picture", exact: true }).click();
    await phone.locator(".editor-picture__button.is-move-ready").waitFor();
    const tile = phone.locator('[data-editor-picture="picture-0-3"]');
    await handle.scrollIntoViewIfNeeded();
    await handle.evaluate(node => window.scrollBy(0, node.getBoundingClientRect().top - innerHeight / 2));
    const from = await handle.boundingBox(), to = await tile.boundingBox();
    check("phone_keeps_four_physical_columns", await phone.locator(".editor-pictures").first().evaluate(node => { const cells = [...node.querySelectorAll(".editor-picture")]; const top = cells[0].getBoundingClientRect().top; return cells.filter(cell => Math.abs(cell.getBoundingClientRect().top - top) < 1).length === 4; }));
    await touch("touchStart", from.x + from.width / 2, from.y + from.height / 2);
    await touch("touchMove", to.x + to.width - 12, to.y + 40);
    await phone.locator(".editor-drag-ghost").waitFor();
    check("touch_drag_shows_insertion_marker", await phone.locator(".editor-picture.is-drop-after").count() === 1);
    await phone.screenshot({ path: path.join(output, "touch-drag-marker.png"), fullPage: false });
    await touch("touchEnd");
    saved = await downloadJson(phone);
    await writeFile(path.join(output, "touch-order.json"), JSON.stringify({ ids: saved.steps[0].tokens.map(token => token.id), from, to }, null, 2));
    check("armed_whole_picture_touch_reorders", saved.steps[0].tokens[3].id === "picture-0-0");
    check("touch_drag_leaves_details_closed", !await phone.locator("dialog[open]").count());
    await phone.evaluate(() => scrollTo(0, 0));
    const nextHandle = phone.locator('[data-editor-picture="picture-0-1"]');
    await nextHandle.click(); await phone.locator(".token-details").getByText("Actions", { exact: true }).click();
    await phone.getByRole("button", { name: "Move picture", exact: true }).click();
    await phone.locator(".editor-picture__button.is-move-ready").waitFor(); await nextHandle.scrollIntoViewIfNeeded();
    const cancelFrom = await nextHandle.boundingBox();
    await touch("touchStart", cancelFrom.x + 20, cancelFrom.y + 20); await touch("touchMove", cancelFrom.x + 50, cancelFrom.y - 50);
    await touch("touchCancel");
    check("touch_pointercancel_cleans_up_without_changes", !await phone.locator(".editor-drag-ghost").count() && JSON.stringify(await downloadJson(phone)) === JSON.stringify(saved));
    await phone.evaluate(() => scrollTo(0, 0));
    const scrollTile = await phone.locator("[data-editor-picture]").first().boundingBox();
    await touch("touchStart", scrollTile.x + 25, scrollTile.y + 50); await touch("touchMove", scrollTile.x + 25, scrollTile.y - 140); await touch("touchEnd");
    await phone.waitForFunction(() => scrollY > 0);
    check("ordinary_tile_touch_scrolls_page", await phone.evaluate(() => scrollY > 0) && !await phone.locator(".editor-drag-ghost").count() && !await phone.locator("dialog[open]").count());
    await phone.evaluate(() => scrollTo(0, 0)); await phone.screenshot({ path: path.join(output, "mobile.png"), fullPage: true });
    check("all_browser_errors_empty", errors.length === 0);
  } catch (error) { await phone.screenshot({ path: path.join(output, "mobile-failure.png"), fullPage: true }); throw error; }
  finally { await touchContext.close(); }
} catch (error) { failure = String(error); process.exitCode = 1; }
finally { await writeFile(path.join(output, "results.json"), JSON.stringify({ runAt: new Date().toISOString(), checks, errors, failure }, null, 2)); await browser?.close(); await server?.close(); }
if (failure) throw new Error(failure);
console.log(`EDITOR_DRAG_CHECKS=${Object.keys(checks).length}; OUTPUT_DIR=${output}`);
