import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { createServer } from "vite";
import { boot, fixture, importDocument, snapshot } from "./editor-browser-helpers.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));

// Usage: node tests/browser/check-print-faithful-editor.mjs <output-directory> [url]
// Without a URL this driver owns and closes its fresh Vite server. Browser
// contexts have isolated native storage and never use a user's browser profile.
const output = path.resolve(process.argv[2] ?? path.join(root, "artifacts", "print-faithful-editor"));
const checks = {}, errors = [], measurements = {};
let browser, server, failure;
function check(name, value) {
  checks[name] = value === true;
  assert.equal(value, true, name);
}
const near = (actual, expected, tolerance = 0.25) => Math.abs(actual - expected) <= tolerance;
async function paint(page) {
  await page.waitForFunction(() => !!document.querySelector('[data-editor-layout="ready"] [data-editor-page] svg path'));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function geometry(page) {
  return page.evaluate(() => {
    const papers = [...document.querySelectorAll("[data-editor-page]")].map(node => {
      const svg = node.querySelector("svg");
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      return { index: node.dataset.editorPage, width: rect.width, height: rect.height, viewBox: svg.getAttribute("viewBox"),
        widthAttribute: svg.getAttribute("width"), heightAttribute: svg.getAttribute("height") };
    }).filter(Boolean);
    const pictures = [...document.querySelectorAll("[data-editor-picture]")].map(button => {
      const cell = button.closest(".editor-picture"), paper = button.closest("[data-editor-page]");
      const svg = paper?.querySelector("svg");
      if (!cell || !svg) return null;
      const box = cell.getBoundingClientRect(), origin = svg.getBoundingClientRect();
      return { id: button.dataset.editorPicture, page: paper.dataset.editorPage,
        x: box.left - origin.left, y: box.top - origin.top, width: box.width, height: box.height };
    }).filter(Boolean);
    return { papers, pictures };
  });
}
function sameCells(before, after) {
  return before.pictures.length === after.pictures.length && before.pictures.every(cell => {
    const other = after.pictures.find(candidate => candidate.id === cell.id);
    return !!other && cell.page === other.page && ["x", "y", "width", "height"].every(key => near(cell[key], other[key]));
  });
}
function finiteCells(value) {
  return value.pictures.length > 0 && value.pictures.every(cell =>
    [cell.x, cell.y, cell.width, cell.height].every(Number.isFinite) && cell.width > 0 && cell.height > 0);
}
async function svgMarkup(page) {
  return page.locator("[data-editor-page]").first().locator("svg").first().evaluate(node => node.outerHTML);
}
async function physicalSignature(page, markup) {
  return page.evaluate(value => {
    const svg = new DOMParser().parseFromString(value, "image/svg+xml").documentElement;
    if (svg.localName !== "svg" || svg.querySelector("parsererror")) throw new Error("Invalid SVG artifact");
    // Ignore only editor/root accessibility and namespace serialization.
    // Preserve IDs, clip/mask references, all inner style and paint attributes.
    const editorRootAttributes = ["aria-hidden", "aria-label", "role", "tabindex", "class", "style"];
    return JSON.stringify([svg, ...svg.querySelectorAll("*")].map(node => ({
      tag: node.localName,
      attributes: [...node.attributes].filter(attribute => !attribute.name.startsWith("xmlns") &&
        !(node === svg && editorRootAttributes.includes(attribute.name)))
        .map(attribute => [attribute.name, attribute.value]).sort((a, b) => a[0].localeCompare(b[0])),
      text: ["text", "tspan"].includes(node.localName) ? node.textContent : undefined,
    })));
  }, markup);
}
async function download(page, button, filename) {
  const [file] = await Promise.all([page.waitForEvent("download"), button.click()]);
  assert.equal(await file.failure(), null, filename);
  const stream = await file.createReadStream();
  assert.ok(stream, filename);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  await writeFile(path.join(output, filename), bytes);
  return bytes;
}
async function waitOutput(page, status = "ready") {
  await page.waitForFunction(value => document.querySelector(".output-dialog")?.getAttribute("data-output-status") === value, status);
}
async function mutateAttachments(page, changed = false) {
  const previous = await svgMarkup(page);
  await page.evaluate(async different => {
    const { documentSession, sessionActions } = await import("/src/state/document.ts");
    const group = documentSession.document.peek().steps[0], token = group.tokens[0];
    sessionActions.attachToToken(documentSession, group.id, token.id, {
      kind: "quantity", value: { iconId: "quantity.amount", amount: different ? 4 : 5435, unit: "g", label: different ? "4 g" : "5435 g" },
    });
    sessionActions.attachToToken(documentSession, group.id, token.id, {
      kind: "warning", value: { iconId: "warning.sharp", label: different ? "Stay clear" : "Sharp!" },
    });
    sessionActions.setTokenTime(documentSession, group.id, token.id, {
      iconId: "time.duration", seconds: different ? 1203 : 543, label: different ? "20m 3s" : "9m 3s",
    });
  }, changed);
  await page.waitForFunction(old => document.querySelector("[data-editor-page] svg")?.outerHTML !== old, previous);
  await paint(page);
}
async function blankBoardRename(url) {
  const { page, context } = await boot(browser, url, errors);
  try {
    const document = fixture([1], "board");
    document.meta.title = "Untitled board group";
    delete document.steps[0].title;
    await importDocument(page, document);
    await paint(page);
    const before = await geometry(page);
    const beforeSvg = await physicalSignature(page, await svgMarkup(page));
    const name = page.locator('[data-group-drag="group-0"],[data-group-edit="group-0"]').first();
    check("untitled_board_group_has_visible_rename_placeholder", await name.innerText() === "Group 1" && await name.evaluate(node => {
      const text = [...node.childNodes].find(child => child.textContent?.trim() === "Group 1");
      if (!text) return false;
      const range = document.createRange(); range.selectNodeContents(text);
      const painted = range.getBoundingClientRect();
      const style = getComputedStyle(text instanceof Element ? text : node);
      return painted.width >= 24 && painted.height >= 12 && style.visibility === "visible" &&
        style.display !== "none" && Number(style.opacity) > 0 && style.clipPath === "none";
    }));
    check("untitled_board_svg_does_not_invent_printed_group_heading", await page.locator('[data-editor-page] svg [data-output-text]').evaluateAll(nodes =>
      nodes.every(node => node.getAttribute("data-output-text") !== "Group 1" &&
        !(node.getAttribute("data-step-id") === "group-0" && node.getAttribute("data-output-role") === "heading"))));
    await name.click();
    check("untitled_board_visible_placeholder_opens_group_title", await page.getByLabel("Group title", { exact: true }).isVisible());
    check("untitled_board_rename_overlay_preserves_fixed_geometry", sameCells(before, await geometry(page)) &&
      beforeSvg === await physicalSignature(page, await svgMarkup(page)));
    check("untitled_board_placeholder_keeps_authored_title_absent", (await snapshot(page)).steps[0].title === undefined);
    await page.screenshot({ path: path.join(output, "untitled-board-group.png"), fullPage: true });
  } catch (error) {
    await page.screenshot({ path: path.join(output, "untitled-board-failure.png"), fullPage: true });
    throw error;
  } finally {
    await context.close();
  }
}
async function narrowAddVisibility(page, baseline) {
  const beforeSvg = await physicalSignature(page, await svgMarkup(page));
  const viewport = page.locator(".editor-canvas-viewport");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await paint(page);
    const maxPan = await viewport.evaluate(node => node.scrollWidth - node.clientWidth);
    check("narrow_" + width + "_exercises_horizontal_paper_overflow", maxPan > 100);
    for (const side of ["start", "end"]) {
      await viewport.evaluate((node, value) => { node.scrollLeft = value === "start" ? 0 : node.scrollWidth - node.clientWidth; }, side);
      await paint(page);
      const bounds = await page.locator("[data-add-picture]").evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect();
        const ancestor = node.closest(".editor-canvas-viewport");
        const clip = ancestor?.getBoundingClientRect();
        const visibleLeft = Math.max(0, clip ? clip.left + ancestor.clientLeft : 0);
        const visibleRight = Math.min(innerWidth, clip ? clip.left + ancestor.clientLeft + ancestor.clientWidth : innerWidth);
        return { groupId: node.getAttribute("data-add-picture"), left: rect.left, right: rect.right,
          width: rect.width, height: rect.height, visibleLeft, visibleRight };
      }));
      const current = await geometry(page);
      measurements["narrow_" + width + "_" + side] = { bounds, geometry: current, scrollLeft: await viewport.evaluate(node => node.scrollLeft) };
      check("add_picture_" + width + "_" + side + "_fully_horizontally_visible", bounds.length > 0 &&
        bounds.every(box => box.left >= box.visibleLeft - .25 && box.right <= box.visibleRight + .25 && box.width >= 44 && box.height >= 44));
      check("narrow_" + width + "_" + side + "_preserves_fixed_paper_and_cells", sameCells(baseline, current) &&
        baseline.papers.length === current.papers.length && baseline.papers.every((paper, index) =>
          near(paper.width, current.papers[index].width) && near(paper.height, current.papers[index].height) && paper.viewBox === current.papers[index].viewBox));
      check("narrow_" + width + "_" + side + "_preserves_printed_svg", beforeSvg === await physicalSignature(page, await svgMarkup(page)));
      await page.screenshot({ path: path.join(output, "add-picture-" + width + "-" + side + ".png"), fullPage: false });
    }
  }
  await viewport.evaluate(node => { node.scrollLeft = 0; });
}
async function formatsAndRepairs(url) {
  const { page, context } = await boot(browser, url, errors);
  try {
    const document = fixture([1]);
    document.meta.title = "Small physical formats";
    document.steps[0].tokens[0] = { id: "repair-picture", iconId: "object.banana", category: "object", label: "Banana" };
    await importDocument(page, document);
    for (const [preset, width, height] of [["label", 50, 30], ["card", 105, 148], ["sheet", 210, 297], ["large", 297, 420], ["custom", 210, 297]]) {
      await page.getByLabel("Paper format", { exact: true }).selectOption(preset);
      await paint(page);
      const paper = (await geometry(page)).papers[0];
      check(preset + "_physical_viewbox", paper.viewBox.trim().split(/\s+/).map(Number).join() === [0, 0, width, height].join());
      check(preset + "_physical_screen_size", near(paper.width, width * 96 / 25.4) && near(paper.height, height * 96 / 25.4));
      const add = page.locator('[data-add-picture="group-0"]').first();
      check(preset + "_group_add_reachable", await add.isVisible() && await add.evaluate(node => {
        const box = node.getBoundingClientRect();
        return !!node.closest(".editor-group__header, .editor-group-tools") && box.width >= 44 && box.height >= 44;
      }));
    }
    await page.getByLabel("Page orientation", { exact: true }).selectOption("landscape");
    await paint(page);
    check("custom_landscape_swaps_physical_dimensions", (await geometry(page)).papers[0].viewBox.trim().split(/\s+/).map(Number).join() === "0,0,297,210");
    await page.getByLabel("Page orientation", { exact: true }).selectOption("portrait");
    await page.getByLabel("Paper format", { exact: true }).selectOption("label");
    await page.getByLabel("Canvas zoom", { exact: true }).selectOption("50");
    await paint(page);
    const alternative = page.locator('.editor-repair-pictures [data-editor-picture="repair-picture"]');
    const physicalTarget = page.locator('.editor-picture--physical [data-editor-picture="repair-picture"]');
    const physicalUsable = await physicalTarget.evaluate(node => {
      const box = node.getBoundingClientRect(); return box.width >= 44 && box.height >= 44;
    });
    const auxiliaryUsable = await alternative.isVisible() && await alternative.evaluate(node => {
      const box = node.getBoundingClientRect(); return box.width >= 44 && box.height >= 44;
    });
    check("tiny_zoom_keeps_44px_picture_access", physicalUsable || auxiliaryUsable);
    await page.screenshot({ path: path.join(output, "label-50-percent-controls.png"), fullPage: true });
    await page.getByLabel("Canvas zoom", { exact: true }).selectOption("100");
    await page.getByLabel("Paper format", { exact: true }).selectOption("custom");
    await paint(page);
    await page.locator(".editor-canvas-controls input[type=number]").first().fill("");
    await page.waitForFunction(() => document.querySelector(".instruction-editor")?.getAttribute("data-editor-layout") === "blocked");
    check("invalid_custom_dimension_keeps_repair_target", await page.locator('.editor-repair-list [data-editor-picture="repair-picture"]').isVisible());
    const original = await snapshot(page);
    await page.getByRole("button", { name: "Print / Download", exact: true }).click();
    await waitOutput(page, "blocked");
    const dialog = page.locator(".output-dialog");
    check("invalid_custom_dimension_blocks_physical_download", await dialog.getByRole("button", { name: "Download PDF", exact: true }).isDisabled());
    const backup = await download(page, dialog.getByRole("button", { name: "Download JSON backup", exact: true }), "invalid-options-backup.json");
    check("invalid_custom_dimension_keeps_exact_json_backup", JSON.stringify(JSON.parse(backup.toString())) === JSON.stringify(original));
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
  } catch (error) {
    await page.screenshot({ path: path.join(output, "formats-failure.png"), fullPage: true });
    throw error;
  } finally {
    await context.close();
  }
  for (const failureKind of ["unsupported", "overflow", "font"]) {
    const { page, context } = await boot(browser, url, errors);
    try {
      if (failureKind === "font") await page.route("**/fonts/**", route => route.fulfill({
        status: 200, contentType: "font/ttf", body: Buffer.from([0, 1, 2, 3]),
      }));
      const document = fixture([1]);
      document.meta.title = failureKind + " repair";
      document.steps[0].tokens[0] = { id: "repair-picture", iconId: "object.banana", category: "object",
        label: failureKind === "unsupported" ? "日本語" : "Banana" };
      if (failureKind === "overflow") document.steps[0].tokens[0].warning = {
        iconId: "warning.sharp", label: "Keep hands clear ".repeat(400),
      };
      await importDocument(page, document);
      await page.waitForFunction(() => document.querySelector(".instruction-editor")?.getAttribute("data-editor-layout") === "blocked" &&
        !!document.querySelector('.instruction-editor [role="alert"]'));
      const target = page.locator('[data-editor-picture="repair-picture"]').first();
      check(failureKind + "_current_repair_target_remains_reachable", await target.isVisible());
      check(failureKind + "_repair_target_geometry_is_finite", await target.evaluate(node => {
        const box = node.getBoundingClientRect();
        return [box.x, box.y, box.width, box.height].every(Number.isFinite) && box.width > 0 && box.height > 0;
      }));
      const expected = await snapshot(page);
      await page.getByRole("button", { name: "Print / Download", exact: true }).click();
      await waitOutput(page, "blocked");
      const dialog = page.locator(".output-dialog");
      check(failureKind + "_physical_download_blocked", await dialog.getByRole("button", { name: "Download PDF", exact: true }).isDisabled());
      const backup = await download(page, dialog.getByRole("button", { name: "Download JSON backup", exact: true }), failureKind + "-backup.json");
      check(failureKind + "_authored_data_survives_exact_backup", JSON.stringify(JSON.parse(backup.toString())) === JSON.stringify(expected));
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await target.click();
      await page.locator(".token-details").waitFor();
      check(failureKind + "_repair_form_opens_current_picture", (await page.locator(".token-details textarea").first().inputValue()) === expected.steps[0].tokens[0].label);
      if (failureKind === "unsupported") {
        await page.locator(".token-details textarea").first().fill("Repaired banana");
        await page.keyboard.press("Escape");
        await paint(page);
        check("unsupported_label_can_be_repaired_without_losing_picture", (await snapshot(page)).steps[0].tokens[0].id === "repair-picture" &&
          (await snapshot(page)).steps[0].tokens[0].label === "Repaired banana");
      }
      await page.screenshot({ path: path.join(output, failureKind + "-repair.png"), fullPage: true });
    } catch (error) {
      await page.screenshot({ path: path.join(output, failureKind + "-failure.png"), fullPage: true });
      throw error;
    } finally {
      await context.close();
    }
  }
}
async function center(locator) {
  await locator.evaluate(node => node.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
  await locator.page().evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const box = await locator.boundingBox();
  assert.ok(box);
  return box;
}
async function mouseMove(page, source, destination) {
  const from = await center(source);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  const to = await center(destination);
  await page.mouse.move(to.x + to.width - 8, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
}
async function mobileProof(url) {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: "en-US",
    isMobile: true, hasTouch: true, acceptDownloads: true, serviceWorkers: "block" });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  let cdp;
  try {
    await page.goto(url);
    await page.locator(".app-brand").waitFor();
    const document = fixture([24, 1, 0]);
    document.meta.title = "Touch physical editor";
    document.steps[0].tokens.forEach(token => { token.iconId = "object.banana"; token.category = "object"; token.label = "Banana"; });
    document.steps[0].tokens[0].quantity = { iconId: "quantity.amount", amount: 7, unit: "pcs", label: "7 pcs" };
    document.steps[0].tokens[0].time = { iconId: "time.duration", seconds: 63, label: "1m 3s" };
    document.steps[0].tokens[0].warning = { iconId: "warning.sharp", label: "Sharp!" };
    await importDocument(page, document);
    await paint(page);
    check("phone_initial_zoom_keeps_fixed_a4_paper", (await geometry(page)).papers[0].viewBox.trim().split(/\s+/).map(Number).join() === "0,0,210,297");
    check("phone_has_continuation_segments", await page.locator('[data-editor-group="group-0"]').count() > 1);
    check("phone_no_six_dot_controls", await page.locator("button.editor-drag-handle, button.editor-picture__drag").count() === 0);
    cdp = await context.newCDPSession(page);
    const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", {
      type, touchPoints: ["touchEnd", "touchCancel"].includes(type) ? [] : [{ x, y, id: 1 }],
    });
    const first = page.locator('[data-editor-picture="picture-0-0"]');
    let from = await center(first);
    const original = await snapshot(page);
    const scrolling = () => page.evaluate(() => {
      const offsets = [scrollX, scrollY];
      let node = document.querySelector("[data-editor-picture]");
      while (node) { offsets.push(node.scrollLeft, node.scrollTop); node = node.parentElement; }
      return offsets;
    });
    const beforeScroll = await scrolling();
    await touch("touchStart", from.x + from.width / 2, from.y + from.height / 2);
    await touch("touchMove", from.x + from.width / 2, from.y + from.height / 2 - 150);
    await touch("touchEnd");
    await page.waitForFunction(previous => {
      const offsets = [scrollX, scrollY];
      let node = document.querySelector("[data-editor-picture]");
      while (node) { offsets.push(node.scrollLeft, node.scrollTop); node = node.parentElement; }
      return offsets.some((value, index) => Math.abs(value - previous[index]) > 1);
    }, beforeScroll);
    check("normal_whole_picture_touch_scrolls", (await scrolling()).some((value, index) => Math.abs(value - beforeScroll[index]) > 1));
    check("normal_touch_scroll_does_not_move_or_open_picture", JSON.stringify(await snapshot(page)) === JSON.stringify(original) &&
      await page.locator("dialog[open], .editor-drag-ghost").count() === 0);
    const arm = async () => {
      await first.click();
      await page.locator(".token-details").waitFor();
      await page.locator(".token-details summary").click();
      await page.locator(".token-details").getByRole("button", { name: "Move picture", exact: true }).click();
      await page.waitForFunction(() => !document.querySelector("dialog[open]"));
      await center(first);
    };
    await arm();
    check("actions_move_arms_touch_surface_before_gesture", await first.evaluate(node => getComputedStyle(node).touchAction === "none"));
    from = await center(first);
    const destination = page.locator('[data-editor-picture="picture-0-1"]');
    const to = await destination.boundingBox();
    assert.ok(to);
    check("touch_probe_stays_clear_of_auto_scroll_edges", from.y + from.height / 2 > 100 && from.y + from.height / 2 < 800 &&
      to.y + to.height / 2 > 100 && to.y + to.height / 2 < 800);
    await touch("touchStart", from.x + from.width / 2, from.y + from.height / 2);
    await touch("touchMove", to.x + to.width - 8, to.y + to.height / 2);
    await page.locator(".editor-drag-ghost").waitFor();
    const held = await first.boundingBox();
    check("held_touch_preserves_armed_banner", await page.locator(".editor-move-notice").count() === 1 &&
      await first.evaluate(node => getComputedStyle(node).touchAction === "none"));
    check("pointerdown_does_not_shift_canvas_during_touch_move", near(held.x, from.x) && near(held.y, from.y));
    // Full-page screenshots on Chromium mobile resize the viewport and correctly
    // cancel a held gesture. Only capture the current viewport before release.
    await page.screenshot({ path: path.join(output, "phone-held-touch.png"), fullPage: false });
    check("viewport_screenshot_does_not_cancel_held_touch", await page.locator(".editor-drag-ghost").count() === 1);
    await touch("touchEnd");
    const moved = await snapshot(page);
    check("armed_touch_reorders_whole_picture_once", moved.steps[0].tokens.slice(0, 3).map(token => token.id).join() === "picture-0-1,picture-0-0,picture-0-2");
    check("armed_touch_preserves_all_attachment_data", JSON.stringify(moved.steps[0].tokens[1]) === JSON.stringify(original.steps[0].tokens[0]));
    check("successful_touch_drop_resets_armed_mode", await page.locator(".editor-move-notice").count() === 0 &&
      await first.evaluate(node => getComputedStyle(node).touchAction !== "none"));
    check("touch_drop_keeps_details_closed", await page.locator("dialog[open]").count() === 0);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    check("one_undo_reverts_touch_move", JSON.stringify(await snapshot(page)) === JSON.stringify(original));
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    check("one_redo_restores_touch_move", JSON.stringify(await snapshot(page)) === JSON.stringify(moved));
    await arm();
    from = await center(first);
    await touch("touchStart", from.x + from.width / 2, from.y + from.height / 2);
    await touch("touchMove", from.x + from.width / 2 + 25, from.y + from.height / 2);
    await touch("touchCancel");
    check("armed_touch_cancel_preserves_document", JSON.stringify(await snapshot(page)) === JSON.stringify(moved));
    check("armed_touch_cancel_resets_mode_and_ghost", await page.locator(".editor-move-notice, .editor-drag-ghost").count() === 0 &&
      await first.evaluate(node => getComputedStyle(node).touchAction !== "none"));
    const order = moved.steps[0].tokens.map(token => token.id);
    for (const targetId of ["picture-0-17", "picture-0-3"]) {
      const expected = order.filter(id => id !== "picture-0-20");
      expected.splice(expected.indexOf(targetId) + 1, 0, "picture-0-20");
      await mouseMove(page, page.locator('[data-editor-picture="picture-0-20"]'), page.locator('[data-editor-picture="' + targetId + '"]'));
      check("continuation_drop_uses_original_indices_after_" + targetId, (await snapshot(page)).steps[0].tokens.map(token => token.id).join() === expected.join());
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      check("continuation_move_is_single_undo_after_" + targetId, (await snapshot(page)).steps[0].tokens.map(token => token.id).join() === order.join());
    }
    await page.screenshot({ path: path.join(output, "phone-final.png"), fullPage: true });
  } catch (error) {
    if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }).catch(() => {});
    await page.screenshot({ path: path.join(output, "phone-failure.png"), fullPage: true });
    throw error;
  } finally {
    await cdp?.detach();
    await context.close();
  }
}

try {
  await mkdir(output, { recursive: true });
  let url = process.argv[3];
  if (!url) {
    server = await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false } });
    await server.listen();
    url = `http://127.0.0.1:${server.httpServer.address().port}/`;
  }
  browser = await chromium.launch({ headless: true });
  const { page, context } = await boot(browser, url, errors);
  try {
    const document = fixture([9, 1, 0]);
    document.meta.title = "Stable physical editor";
    document.steps[0].tokens.forEach((token, index) => {
      token.iconId = "object.banana";
      token.category = "object";
      token.label = `Banana ${index + 1}`;
    });
    await importDocument(page, document);
    check("physical_page_regions_exist", await page.locator("[data-editor-page]").count() > 0);
    check("paper_format_control_reachable", await page.getByLabel("Paper format", { exact: true }).isVisible());
    check("canvas_zoom_control_reachable", await page.getByLabel("Canvas zoom", { exact: true }).isVisible());
    check("new_session_defaults_a4_portrait", await page.getByLabel("Paper format", { exact: true }).inputValue() === "sheet");
    check("new_session_zoom_is_explicit_100_percent", await page.getByLabel("Canvas zoom", { exact: true }).inputValue() === "100");
    await paint(page);
    const baseline = await geometry(page);
    measurements.baseline = baseline;
    check("a4_viewbox_is_210_by_297_mm", baseline.papers[0]?.viewBox?.trim().split(/\s+/).map(Number).join() === "0,0,210,297");
    check("a4_screen_width_96_css_pixels_per_inch", near(baseline.papers[0].width, 210 * 96 / 25.4));
    check("a4_screen_height_96_css_pixels_per_inch", near(baseline.papers[0].height, 297 * 96 / 25.4));
    check("all_ten_pictures_have_finite_cells", finiteCells(baseline) && baseline.pictures.length === 10);
    check("every_picture_has_same_fixed_cell_size", baseline.pictures.every(cell =>
      near(cell.width, baseline.pictures[0].width) && near(cell.height, baseline.pictures[0].height)));
    const firstGroup = baseline.pictures.filter(cell => cell.id.startsWith("picture-0-"));
    const rowTops = [...new Set(firstGroup.map(cell => Math.round(cell.y * 100) / 100))].sort((a, b) => a - b);
    check("pictures_fill_horizontally_before_wrapping", near(firstGroup[0].y, firstGroup[1].y) && firstGroup[1].x > firstGroup[0].x && rowTops.length >= 2);
    check("fixed_row_pitch", rowTops.length < 3 || rowTops.slice(2).every((top, index) => near(top - rowTops[index + 1], rowTops[1] - rowTops[0])));
    check("no_six_dot_drag_controls", await page.locator("button.editor-drag-handle, button.editor-picture__drag").count() === 0);
    for (const group of document.steps) {
      const add = page.locator('[data-add-picture="' + group.id + '"]').first();
      check("header_add_picture_" + group.id, await add.evaluate(node => !!node.closest(".editor-group__header, .editor-group-tools")));
      check("header_add_picture_44px_" + group.id, await add.evaluate(node => {
        const box = node.getBoundingClientRect(); return box.width >= 44 && box.height >= 44;
      }));
    }
    await page.locator('[data-editor-picture="picture-0-0"]').click();
    await page.locator(".token-details").waitFor();
    const panel = await geometry(page);
    check("opening_overlay_panel_keeps_all_cell_positions", sameCells(baseline, panel));
    check("opening_overlay_panel_keeps_paper_scale", near(panel.papers[0].width, baseline.papers[0].width) && near(panel.papers[0].height, baseline.papers[0].height));
    await page.keyboard.press("Escape");
    await mutateAttachments(page);
    const attached = await geometry(page);
    measurements.attachmentsAdded = attached;
    check("adding_quantity_warning_time_keeps_all_cell_positions", sameCells(baseline, attached));
    await mutateAttachments(page, true);
    const changed = await geometry(page);
    measurements.attachmentsChanged = changed;
    check("changing_quantity_warning_time_keeps_all_cell_positions", sameCells(baseline, changed));
    const saved = await snapshot(page);
    check("structured_attachment_values_preserved", saved.steps[0].tokens[0].quantity.amount === 4 &&
      saved.steps[0].tokens[0].quantity.unit === "g" && saved.steps[0].tokens[0].time.seconds === 1203 &&
      saved.steps[0].tokens[0].warning.label === "Stay clear");
    await page.setViewportSize({ width: 768, height: 900 });
    await paint(page);
    check("viewport_resize_keeps_all_cell_positions", sameCells(baseline, await geometry(page)));
    const resized = await geometry(page);
    check("viewport_resize_keeps_physical_paper_width", near(resized.papers[0].width, baseline.papers[0].width));
    await narrowAddVisibility(page, baseline);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByLabel("Canvas zoom", { exact: true }).selectOption("75");
    await paint(page);
    const zoomed = await geometry(page);
    check("only_explicit_zoom_changes_paper_scale", near(zoomed.papers[0].width, baseline.papers[0].width * 0.75) && near(zoomed.papers[0].height, baseline.papers[0].height * 0.75));
    check("explicit_zoom_scales_same_physical_cells", changed.pictures.every(cell => {
      const other = zoomed.pictures.find(candidate => candidate.id === cell.id);
      return !!other && ["x", "y", "width", "height"].every(key => near(other[key], cell[key] * 0.75));
    }));
    await page.getByLabel("Canvas zoom", { exact: true }).selectOption("100");
    await paint(page);
    const editorSvg = await svgMarkup(page);
    await writeFile(path.join(output, "editor-page.svg"), editorSvg);
    await page.getByRole("button", { name: "Print / Download", exact: true }).click();
    await waitOutput(page);
    const dialog = page.locator(".output-dialog");
    check("output_uses_shared_a4_format", await dialog.getByLabel("Output size", { exact: true }).inputValue() === "sheet");
    const exported = await download(page, dialog.getByRole("button", { name: /^Download SVG page 1 of / }), "download-page.svg");
    check("actual_download_has_a4_physical_dimensions", exported.toString().includes('width="210mm"') && exported.toString().includes('height="297mm"'));
    check("editor_and_actual_download_have_identical_physical_vectors", await physicalSignature(page, editorSvg) === await physicalSignature(page, exported.toString()));
    await dialog.getByLabel("Content mode", { exact: true }).selectOption("pictures");
    await waitOutput(page);
    await paint(page);
    const modeEditor = await svgMarkup(page);
    const modeDownload = await download(page, dialog.getByRole("button", { name: /^Download SVG page 1 of / }), "pictures-download-page.svg");
    check("output_mode_change_reaches_editor_without_geometry_drift", sameCells(changed, await geometry(page)));
    check("changed_mode_editor_matches_actual_download", await physicalSignature(page, modeEditor) === await physicalSignature(page, modeDownload.toString()));
    await dialog.getByLabel("Content mode", { exact: true }).selectOption("detailed");
    await waitOutput(page);
    await paint(page);
    const detailedEditor = await svgMarkup(page);
    const detailedDownload = await download(page, dialog.getByRole("button", { name: /^Download SVG page 1 of / }), "detailed-download-page.svg");
    check("detailed_mode_keeps_same_fixed_cells", sameCells(changed, await geometry(page)));
    check("detailed_editor_matches_actual_download", await physicalSignature(page, detailedEditor) === await physicalSignature(page, detailedDownload.toString()));
    await dialog.getByRole("group", { name: "Select groups", exact: true }).getByLabel("Group 2", { exact: true }).uncheck();
    await waitOutput(page);
    check("output_subset_hides_excluded_group_on_editor", await page.locator('[data-editor-picture="picture-1-0"]').count() === 0);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    check("excluded_groups_have_reveal_control", await page.getByRole("button", { name: "Show all groups", exact: true }).isVisible());
    await page.getByRole("button", { name: "Show all groups", exact: true }).click();
    await paint(page);
    check("reveal_all_restores_excluded_picture", await page.locator('[data-editor-picture="picture-1-0"]').count() === 1);
    check("physical_svg_contains_no_editor_buttons", !/<(?:button|foreignObject)\b/i.test(editorSvg));
    check("browser_errors_empty", errors.length === 0);
    await page.screenshot({ path: path.join(output, "desktop.png"), fullPage: true });
  } catch (error) {
    await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true });
    throw error;
  } finally {
    await context.close();
  }
  await formatsAndRepairs(url);
  await mobileProof(url);
  await blankBoardRename(url);
  check("all_scenarios_browser_errors_empty", errors.length === 0);
} catch (error) {
  failure = String(error);
  process.exitCode = 1;
} finally {
  await writeFile(path.join(output, "results.json"), JSON.stringify({ runAt: new Date().toISOString(), checks, errors, measurements, failure }, null, 2));
  await browser?.close();
  await server?.close();
}
if (failure) throw new Error(failure);
console.log(`PRINT_FAITHFUL_EDITOR_CHECKS=${Object.keys(checks).length}; OUTPUT_DIR=${output}`);
