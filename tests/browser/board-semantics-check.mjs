import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";
import { boot, createBlank, fixture, importDocument, snapshot } from "./editor-browser-helpers.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = path.resolve(process.argv[2] ?? path.join(root, "artifacts/browser"));
const checks = {}, errors = [], observations = [];
let browser, server, failure;

function check(name, condition) { checks[name] = condition; }
async function waitForLayout(page, presentation, status = "ready") {
  await page.waitForFunction(({ presentation, status }) => {
    const editor = document.querySelector(".instruction-editor");
    const lists = [...document.querySelectorAll(".editor-groups")];
    return editor?.dataset.editorLayout === status && lists.length > 0 && lists.every(list => list.dataset.editorPresentation === presentation);
  }, { presentation, status });
}
async function inspect(page) {
  return page.locator("[data-editor-page]").evaluateAll(papers => papers.map(paper => {
    const paperBox = paper.getBoundingClientRect();
    const box = node => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x - paperBox.x, y: rect.y - paperBox.y, width: rect.width, height: rect.height };
    };
    const list = paper.querySelector(".editor-groups");
    return {
      index: paper.dataset.editorPage, width: paperBox.width, height: paperBox.height,
      tag: list.tagName, presentation: list.dataset.editorPresentation,
      childrenAreListItems: [...list.children].every(node => node.tagName === "LI" && node.hasAttribute("data-editor-group")),
      picturesAreUnordered: [...list.querySelectorAll(".editor-pictures")].every(node => node.tagName === "UL"),
      groups: [...list.children].map(group => ({
        id: group.dataset.editorGroup, segment: group.dataset.groupSegment, ...box(group),
        pictures: [...group.querySelectorAll(".editor-picture__button")].map(button => ({
          id: button.dataset.editorPicture, name: button.getAttribute("aria-label"), disabled: button.disabled, ...box(button),
        })),
      })),
    };
  }));
}
function geometry(papers) {
  return papers.map(({ tag: _tag, presentation: _presentation, ...paper }) => paper);
}
function assertSemantics(name, papers, tag, presentation) {
  check(`${name}_SEMANTICS`, papers.length > 0 && papers.every(paper => paper.tag === tag && paper.presentation === presentation));
  check(`${name}_LIST_ITEMS_AND_PICTURES`, papers.every(paper => paper.childrenAreListItems && paper.picturesAreUnordered));
}
function pictureIds(papers) { return papers.flatMap(paper => paper.groups.flatMap(group => group.pictures.map(picture => picture.id))); }
async function exercise(page, width) {
  await createBlank(page, "board");
  const board = fixture([3, 2, 0], "board");
  board.meta.title = `Board semantics ${width}`;
  await importDocument(page, board);
  await waitForLayout(page, "board");
  const before = await snapshot(page), initial = await inspect(page);
  assertSemantics(`BOARD_${width}`, initial, "UL", "board");
  assert.deepEqual(initial.flatMap(paper => paper.groups.map(group => group.id)), ["group-0", "group-1", "group-2"]);
  assert.deepEqual(pictureIds(initial), ["picture-0-0", "picture-0-1", "picture-0-2", "picture-1-0", "picture-1-1"]);
  check(`BOARD_${width}_SOURCE_ORDER_AND_EMPTY_GROUP`, true);
  check(`BOARD_${width}_INTERACTIVE_HITBOXES`, initial.flatMap(paper => paper.groups.flatMap(group => group.pictures)).every(picture => !picture.disabled && picture.width >= 43.9 && picture.height >= 43.9));
  await page.screenshot({ path: path.join(output, `board-${width}.png`), fullPage: true });

  // The real presentation control must change semantics without changing authored content.
  const presentation = page.locator(".editor-document-fields select");
  await presentation.selectOption("sequence");
  await waitForLayout(page, "sequence");
  const switched = await inspect(page), sequenceSource = await snapshot(page);
  assertSemantics(`SWITCH_TO_SEQUENCE_${width}`, switched, "OL", "sequence");
  assert.deepEqual(sequenceSource, { ...before, meta: { ...before.meta, presentation: "sequence" } });
  check(`SWITCH_TO_SEQUENCE_${width}_SOURCE_RETAINED`, true);
  await presentation.selectOption("board");
  await waitForLayout(page, "board");
  const roundtrip = await inspect(page);
  assertSemantics(`SWITCH_TO_BOARD_${width}`, roundtrip, "UL", "board");
  assert.deepEqual(await snapshot(page), before);
  assert.deepEqual(geometry(roundtrip), geometry(initial));
  check(`PRESENTATION_ROUNDTRIP_${width}_CONTENT_AND_GEOMETRY`, true);

  // A picture hitbox still opens its exact authoring control after the list tag changes.
  await page.locator('[data-editor-group="group-0"] [data-editor-picture="picture-0-0"]').click();
  await page.getByLabel("Picture label", { exact: true }).fill("Clean hands");
  assert.equal((await snapshot(page)).steps[0].tokens[0].label, "Clean hands");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".token-details"));
  check(`BOARD_${width}_EXACT_PICTURE_EDITING`, true);

  // Text overflow keeps the physical group layout available for repair.
  const normal = await inspect(page), longLabel = "Complete authored meaning ".repeat(40);
  await page.evaluate(async label => {
    const { documentSession, sessionActions } = await import("/src/state/document.ts");
    sessionActions.updateTokenLabel(documentSession, "group-0", "picture-0-0", label);
  }, longLabel);
  await waitForLayout(page, "board", "blocked");
  await page.locator(".editor-layout-issues").waitFor();
  const blocked = await inspect(page);
  assertSemantics(`BLOCKED_BOARD_${width}`, blocked, "UL", "board");
  const withoutNames = papers => geometry(papers).map(paper => ({ ...paper, groups: paper.groups.map(group => ({ ...group, pictures: group.pictures.map(({ name: _name, ...picture }) => picture) })) }));
  assert.deepEqual(withoutNames(blocked), withoutNames(normal));
  assert.deepEqual(pictureIds(blocked), pictureIds(normal));
  assert.equal((await snapshot(page)).steps[0].tokens[0].label, longLabel);
  check(`BLOCKED_BOARD_${width}_GEOMETRY_AND_SOURCE_RETAINED`, true);
  await page.locator(".editor-layout-issues button").first().click();
  assert.equal(await page.getByLabel("Picture label", { exact: true }).inputValue(), longLabel);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".token-details"));
  await presentation.selectOption("sequence");
  await waitForLayout(page, "sequence", "blocked");
  assertSemantics(`BLOCKED_SEQUENCE_${width}`, await inspect(page), "OL", "sequence");
  check(`BLOCKED_BOARD_${width}_REPAIR_EDITING`, true);

  // A fresh sequence is ordered, including all segments of a continued group.
  const sequence = fixture([80, 2], "sequence");
  sequence.meta.title = `Continued sequence ${width}`;
  await importDocument(page, sequence);
  await waitForLayout(page, "sequence");
  const continuedSource = await snapshot(page), continuedSequence = await inspect(page);
  assertSemantics(`MULTIPAGE_SEQUENCE_${width}`, continuedSequence, "OL", "sequence");
  assert.ok(continuedSequence.length > 1, "Continuation fixture must render more than one physical page");
  assert.ok(continuedSequence.flatMap(paper => paper.groups).some(group => group.id === "group-0" && Number(group.segment) > 0), "Continuation fixture must split the first group");
  assert.deepEqual(pictureIds(continuedSequence), sequence.steps.flatMap(group => group.tokens.map(token => token.id)));
  check(`MULTIPAGE_SEQUENCE_${width}_CONTINUATION_AND_PICTURE_ORDER`, true);
  await presentation.selectOption("board");
  await waitForLayout(page, "board");
  const continuedBoard = await inspect(page);
  assertSemantics(`MULTIPAGE_BOARD_${width}`, continuedBoard, "UL", "board");
  assert.deepEqual(pictureIds(continuedBoard), pictureIds(continuedSequence));
  assert.deepEqual(await snapshot(page), { ...continuedSource, meta: { ...continuedSource.meta, presentation: "board" } });
  check(`MULTIPAGE_BOARD_${width}_SOURCE_RETAINED`, true);
  observations.push({ width, initial, switched, roundtrip, blocked, continuedSequence, continuedBoard });
}

try {
  await mkdir(output, { recursive: true });
  let url = process.argv[3];
  if (!url || url === "-") {
    server = await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false, watch: { ignored: ["**/artifacts/**"] } } });
    await server.listen();
    url = `http://127.0.0.1:${server.httpServer.address().port}/`;
  }
  browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const { page, context } = await boot(browser, url, errors, { width, height: 900 });
    try { await exercise(page, width); } finally { await context.close(); }
  }
  check("NO_CONSOLE_OR_PAGE_ERRORS", errors.length === 0);
  assert.deepEqual(Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name), [], "All board semantics checks must pass");
  console.log(`PASS board semantics: ${Object.keys(checks).length} checks across desktop and mobile`);
} catch (error) { failure = String(error); throw error; }
finally {
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "board-semantics-result.json"), JSON.stringify({ runAt: new Date().toISOString(), checks, errors, failure, observations }, null, 2));
  await browser?.close(); await server?.close();
}
