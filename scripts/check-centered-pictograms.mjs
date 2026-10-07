import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { createServer } from "vite";
import { boot, fixture, importDocument } from "../.claude/skills/run-instruction-builder/editor-browser-helpers.mjs";

// Actual App only: fresh isolated contexts, owned ephemeral server, native SVG downloads.
// Usage: node scripts/check-centered-pictograms.mjs <evidence-directory> [url] [--baseline]
const output = path.resolve(process.argv[2] ?? "artifacts/centered-pictograms");
const baselineRun = process.argv.includes("--baseline");
const checks = {}, measurements = {}, errors = [];
let server, browser, failure;
const near = (actual, expected, tolerance = .08) => Math.abs(actual - expected) <= tolerance;
function check(name, value) { checks[name] = value === true; }
async function paint(page) {
  await page.waitForFunction(() => document.querySelector('.instruction-editor')?.dataset.editorLayout === "ready" &&
    !!document.querySelector('[data-editor-page] svg [data-output-role="token"]'));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function geometry(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-editor-page]')].map(paper => {
    const svg = paper.querySelector('svg'), origin = svg.getBoundingClientRect();
    const units = svg.viewBox.baseVal, sx = units.width / origin.width, sy = units.height / origin.height;
    const rectangle = box => ({ x: (box.left - origin.left) * sx, y: (box.top - origin.top) * sy,
      width: box.width * sx, height: box.height * sy });
    const symbols = [...svg.children].filter(node => node.localName === "g" && node.dataset.outputRole === "token").map(node => {
      // Measure the 24-unit icon allocation, not asymmetric ink within a pictogram.
      const matrix = node.transform.baseVal.consolidate().matrix;
      return { id: node.dataset.tokenId, x: matrix.e, y: matrix.f, width: 24 * matrix.a, height: 24 * matrix.d };
    });
    const cells = [...paper.querySelectorAll('.editor-picture--physical')].map(cell => ({
      id: cell.querySelector('[data-editor-picture]')?.dataset.editorPicture, ...rectangle(cell.getBoundingClientRect()),
    }));
    const fields = [...svg.children].filter(node => node.dataset.tokenId && node.dataset.outputRole !== 'token').map(node => ({
      id: node.dataset.tokenId, role: node.dataset.outputRole, tag: node.localName,
      text: node.dataset.outputText, ...rectangle(node.getBoundingClientRect()),
    }));
    const connectors = [...svg.children].filter(node => node.localName === "path" && node.dataset.outputRole === "context" && !node.dataset.outputText)
      .map(node => ({ d: node.getAttribute('d'), stepId: node.dataset.stepId }));
    return { page: paper.dataset.editorPage, viewBox: [...[units.x, units.y, units.width, units.height]],
      screenWidth: origin.width, screenHeight: origin.height, cells, symbols, fields, connectors };
  }));
}
const all = (pages, key) => pages.flatMap(page => page[key].map(item => ({ page: page.page, ...item })));
function sameGeometry(left, right) {
  const first = all(left, "cells"), second = all(right, "cells");
  return first.length === second.length && first.every(cell => {
    const other = second.find(item => item.id === cell.id && item.page === cell.page);
    return !!other && ["x", "y", "width", "height"].every(key => near(cell[key], other[key]));
  });
}
function sameSymbols(left, right) {
  const first = all(left, "symbols"), second = all(right, "symbols");
  return first.length === second.length && first.every(symbol => {
    const other = second.find(item => item.id === symbol.id && item.page === symbol.page);
    return !!other && ["x", "y", "width", "height"].every(key => near(symbol[key], other[key]));
  });
}
const overlaps = (first, second) => Math.min(first.x + first.width, second.x + second.width) > Math.max(first.x, second.x) + .04 &&
  Math.min(first.y + first.height, second.y + second.height) > Math.max(first.y, second.y) + .04;
function inspect(name, pages, expectedCount, hasTime = true) {
  const cells = all(pages, "cells"), symbols = all(pages, "symbols"), fields = all(pages, "fields");
  check(name + "_all_pictures_rendered", cells.length === expectedCount && symbols.length === expectedCount);
  check(name + "_equal_fixed_cell_dimensions", cells.length > 0 && cells.every(cell => near(cell.width, cells[0].width) && near(cell.height, cells[0].height)));
  check(name + "_every_pictogram_centered_horizontally", symbols.every(symbol => {
    const cell = cells.find(item => item.id === symbol.id);
    return !!cell && near(symbol.x + symbol.width / 2, cell.x + cell.width / 2);
  }));
  check(name + "_every_pictogram_centered_vertically", symbols.every(symbol => {
    const cell = cells.find(item => item.id === symbol.id);
    return !!cell && near(symbol.y + symbol.height / 2, cell.y + cell.height / 2);
  }));
  check(name + "_annotations_do_not_overlap_picture_or_each_other", symbols.every(symbol => {
    const annotations = fields.filter(field => field.id === symbol.id);
    return annotations.every((field, index) => !overlaps(field, symbol) && annotations.slice(index + 1).every(other => !overlaps(field, other)));
  }));
  check(name + "_annotations_inside_their_fixed_cell", fields.every(field => {
    const cell = cells.find(item => item.id === field.id);
    return !!cell && field.x >= cell.x - .08 && field.y >= cell.y - .08 &&
      field.x + field.width <= cell.x + cell.width + .08 && field.y + field.height <= cell.y + cell.height + .08;
  }));
  if (hasTime) check(name + "_token_time_directly_below_pictogram", fields.some(field => field.role === "time") && symbols.filter(symbol => fields.some(field => field.id === symbol.id && field.role === "time")).every(symbol => {
    const time = fields.filter(field => field.id === symbol.id && field.role === "time");
    const left = Math.min(...time.map(field => field.x)), right = Math.max(...time.map(field => field.x + field.width));
    return time.length > 0 && time.every(field => field.y >= symbol.y + symbol.height - .08) &&
      // The allocated clock is centered within a text line and has internal
      // viewport whitespace; inspect the resulting ink gap independently.
      Math.min(...time.map(field => field.y)) <= symbol.y + symbol.height + 3 &&
      near((left + right) / 2, symbol.x + symbol.width / 2, .35);
  }));
}
function inspectConnectors(name, pages, requireWrap) {
  let wraps = 0;
  for (const page of pages) {
    const cells = page.cells;
    for (let index = 1; index < cells.length; index += 1) {
      const previous = cells[index - 1], current = cells[index];
      if (near(previous.y, current.y)) continue;
      wraps += 1;
      // SVG path commands are independently read from the final artifact.
      const route = page.connectors.find(connector => {
        const numbers = (connector.d.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
        return numbers[1] >= previous.y + previous.height - .08 && numbers[1] <= previous.y + previous.height + 1;
      });
      const firstNumbers = route?.d.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)?.map(Number);
      check(name + "_wrap_" + wraps + "_starts_bottom_center", !!firstNumbers && near(firstNumbers[0], previous.x + previous.width / 2) && near(firstNumbers[1], previous.y + previous.height));
      if (!route) continue;
      const main = route.d.split(/M/i).filter(Boolean)[0];
      const values = (main.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
      const points = Array.from({ length: values.length / 2 }, (_, i) => ({ x: values[i * 2], y: values[i * 2 + 1] }));
      const last = points.at(-1), penultimate = points.at(-2);
      check(name + "_wrap_" + wraps + "_ends_top_center", !!last && near(last.x, current.x + current.width / 2) && near(last.y, current.y));
      check(name + "_wrap_" + wraps + "_clean_orthogonal_route", points.length >= 4 && points.slice(1).every((point, i) => {
        const start = points[i], vertical = near(point.x, start.x), horizontal = near(point.y, start.y);
        return (vertical || horizontal) && cells.every(cell => vertical ?
          !(point.x > cell.x + .08 && point.x < cell.x + cell.width - .08 && Math.max(point.y, start.y) > cell.y + .08 && Math.min(point.y, start.y) < cell.y + cell.height - .08) :
          !(point.y > cell.y + .08 && point.y < cell.y + cell.height - .08 && Math.max(point.x, start.x) > cell.x + .08 && Math.min(point.x, start.x) < cell.x + cell.width - .08));
      }));
      check(name + "_wrap_" + wraps + "_final_arrow_points_down", !!penultimate && near(last.x, penultimate.x) && last.y > penultimate.y);
      const head = (route.d.split(/M/i).filter(Boolean)[1]?.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
      check(name + "_wrap_" + wraps + "_arrowhead_wings_point_up_from_tip", head.length === 6 &&
        near(head[2], last.x) && near(head[3], last.y) && head[1] < head[3] && head[5] < head[3] &&
        Math.min(head[0], head[4]) < head[2] && Math.max(head[0], head[4]) > head[2]);
    }
  }
  if (requireWrap) check(name + "_exercises_cross_row_wrap", wraps > 0);
}
async function markup(page) { return page.locator('[data-editor-page] svg').first().evaluate(node => node.outerHTML); }
async function signature(page, svg) {
  return page.evaluate(value => {
    const root = new DOMParser().parseFromString(value, 'image/svg+xml').documentElement;
    if (root.localName !== "svg" || root.querySelector('parsererror')) throw new Error('Invalid SVG artifact');
    return JSON.stringify([root, ...root.querySelectorAll('*')].map(node => ({ tag: node.localName,
      attributes: [...node.attributes].filter(attribute => !attribute.name.startsWith('xmlns') && !(node === root &&
        ['aria-hidden', 'aria-label', 'role', 'tabindex', 'class', 'style'].includes(attribute.name)))
        .map(attribute => [attribute.name, attribute.value]).sort((a, b) => a[0].localeCompare(b[0])) })));
  }, svg);
}
async function exportedSvg(page, name) {
  const editor = await markup(page);
  await page.getByRole('button', { name: 'Print / Download', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.output-dialog')?.dataset.outputStatus === 'ready');
  const dialog = page.locator('.output-dialog');
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: /^Download SVG page 1 of / }).click()]);
  assert.equal(await download.failure(), null);
  const stream = await download.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const svg = Buffer.concat(chunks).toString('utf8');
  await writeFile(path.join(output, name + '-download.svg'), svg);
  check(name + '_actual_download_identical_physical_geometry', await signature(page, editor) === await signature(page, svg));
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
}
async function metadata(page, compact) {
  await page.evaluate(async isCompact => {
    const { documentSession, sessionActions } = await import('/src/state/document.ts');
    const group = documentSession.document.peek().steps[0];
    for (const [index, token] of group.tokens.entries()) {
      if (index % 4 === 0) {
        sessionActions.updateTokenLabel(documentSession, group.id, token.id, isCompact ? 'Egg' : 'Banana');
        if (!isCompact) sessionActions.updateTokenNote(documentSession, group.id, token.id, 'Ready');
        sessionActions.attachToToken(documentSession, group.id, token.id, { kind: 'quantity', value: { iconId: 'quantity.amount', amount: 2, unit: 'g', label: '2 g' } });
        sessionActions.attachToToken(documentSession, group.id, token.id, { kind: 'warning', value: { iconId: 'warning.hot', label: 'Hot' } });
        sessionActions.setTokenTime(documentSession, group.id, token.id, { iconId: 'time.duration', seconds: 60, label: '1m' });
      } else if (index % 4 === 1) sessionActions.updateTokenLabel(documentSession, group.id, token.id, 'Onion');
      else if (index % 4 === 2) sessionActions.setTokenTime(documentSession, group.id, token.id, { iconId: 'time.duration', seconds: 120, label: '2m' });
    }
  }, compact);
  await paint(page);
}
async function scenario(url, name, preset, orientation, count, presentation = 'sequence') {
  const { page, context } = await boot(browser, url, errors);
  try {
    const document = fixture([count], presentation);
    document.meta.title = 'Centered pictograms';
    document.steps[0].tokens.forEach(token => { token.iconId = 'object.banana'; token.category = 'object'; delete token.label; });
    await importDocument(page, document);
    await page.getByLabel('Paper format', { exact: true }).selectOption(preset);
    await page.getByLabel('Page orientation', { exact: true }).selectOption(orientation);
    await paint(page);
    if (preset !== 'label') {
      await page.getByRole('button', { name: 'Print / Download', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.output-dialog')?.dataset.outputStatus === 'ready');
      await page.locator('.output-dialog').getByLabel('Content mode', { exact: true }).selectOption('detailed');
      await page.waitForFunction(() => document.querySelector('.output-dialog')?.dataset.outputStatus === 'ready');
      await page.locator('.output-dialog').getByRole('button', { name: 'Close', exact: true }).click();
      await paint(page);
    }
    const before = await geometry(page);
    inspect(name + '_plain', before, count, false);
    const size = { sheet: [210, 297], large: [297, 420], label: [50, 30] }[preset];
    const expected = orientation === 'landscape' ? [size[1], size[0]] : size;
    check(name + '_correct_physical_page_and_css_scale', before.every(paper => paper.viewBox.join() === [0, 0, ...expected].join() &&
      near(paper.screenWidth, expected[0] * 96 / 25.4) && near(paper.screenHeight, expected[1] * 96 / 25.4)));
    await metadata(page, preset === 'label');
    const after = await geometry(page);
    measurements[name] = { before, after };
    check(name + '_fields_do_not_move_resize_or_rewrap_cells', sameGeometry(before, after));
    check(name + '_fields_do_not_move_or_resize_pictogram_anchors', sameSymbols(before, after));
    check(name + '_required_fields_rendered', ['label', 'quantity', 'warning', 'time', ...(preset === 'label' ? [] : ['note'])]
      .every(role => all(after, 'fields').some(field => field.role === role)));
    inspect(name + '_fields', after, count);
    if (presentation === 'board') check(name + '_board_has_no_connectors', after.every(paper => !paper.connectors.length));
    else inspectConnectors(name, after, count > 1);
    await writeFile(path.join(output, name + '-editor.svg'), await markup(page));
    await page.locator('.editor-canvas-viewport').scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: path.join(output, name + '-desktop.png'), fullPage: false });
    await exportedSvg(page, name);
    if (name === 'a4-portrait') {
      await page.setViewportSize({ width: 390, height: 900 });
      await paint(page);
      const mobile = await geometry(page);
      check(name + '_mobile_preserves_physical_cells', sameGeometry(after, mobile));
      inspect('mobile', mobile, count);
      await page.locator('.editor-canvas-viewport').scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      await page.screenshot({ path: path.join(output, 'a4-mobile.png'), fullPage: false });
      measurements.mobile = mobile;
    }
  } catch (error) {
    measurements[name + '_failure'] = { error: String(error),
      status: await page.locator('.instruction-editor').getAttribute('data-editor-layout'),
      issues: await page.locator('.editor-layout-issues, .output-dialog [role="alert"]').allTextContents() };
    await page.screenshot({ path: path.join(output, name + '-failure.png'), fullPage: false });
    throw error;
  } finally { await context.close(); }
}
try {
  await mkdir(output, { recursive: true });
  let url = process.argv.slice(3).find(argument => /^https?:\/\//u.test(argument));
  if (!url) {
    server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
    await server.listen();
    url = `http://127.0.0.1:${server.httpServer.address().port}/`;
  }
  browser = await chromium.launch({ headless: true });
  await scenario(url, 'a4-portrait', 'sheet', 'portrait', 9);
  if (!baselineRun) {
    await scenario(url, 'a4-landscape', 'sheet', 'landscape', 9);
    await scenario(url, 'a3-portrait', 'large', 'portrait', 9);
    await scenario(url, 'a3-landscape', 'large', 'landscape', 9);
    await scenario(url, 'label-portrait', 'label', 'portrait', 1);
    await scenario(url, 'label-landscape', 'label', 'landscape', 1);
    await scenario(url, 'board', 'sheet', 'portrait', 9, 'board');
  }
  check('browser_errors_empty', errors.length === 0);
} catch (error) { failure = String(error); }
finally {
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ runAt: new Date().toISOString(), baselineRun, checks, errors, measurements, failure }, null, 2));
  await browser?.close();
  await server?.close();
}
const failed = Object.keys(checks).filter(name => !checks[name]);
console.log(`CENTERED_PICTOGRAM_CHECKS=${Object.keys(checks).length}; FAILED=${failed.length}; OUTPUT_DIR=${output}`);
if (failure || failed.length) throw new Error(failure ?? `Failed checks: ${failed.join(', ')}`);
