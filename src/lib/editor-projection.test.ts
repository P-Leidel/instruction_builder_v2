import { describe, expect, it } from "vitest";
import type { EditorGroupPlacement, EditorLayout } from "../model/output";
import { hasMinimumTargetSize, canPlaceGroupControls, projectEditorControls } from "./editor-projection";
import { createDefaultOutputOptions, normalizeOutputOptions } from "./output-options";
import { sequenceFixture } from "../test/fixtures/overhaul";

function placement(stepId: string, widthMm = 280, heightMm = 44): EditorGroupPlacement {
  return { stepId, segment: 0, continued: false, headingBox: { xMm: 0, yMm: 0, widthMm, heightMm }, groupBox: { xMm: 0, yMm: 0, widthMm, heightMm }, pictures: [] };
}
function layout(groups: EditorGroupPlacement[]): EditorLayout {
  const doc = sequenceFixture(), options = normalizeOutputOptions(doc, createDefaultOutputOptions(doc, "en"));
  if (!options.ok) throw new Error("Expected valid fixture options");
  return { cell: options.cell, pages: [{ pageIndex: 0, size: { widthMm: 210, heightMm: 297 }, groups }] };
}
describe("editor control projection", () => {
  it.each([[43.999, false], [44, true], [44.001, true]] as const)("includes the 44 px target boundary at %s", (pixels, expected) => {
    expect(hasMinimumTargetSize({ xMm: 0, yMm: 0, widthMm: pixels / 2, heightMm: 22 }, 2)).toBe(expected);
    expect(hasMinimumTargetSize({ xMm: 0, yMm: 0, widthMm: 22, heightMm: pixels / 2 }, 2)).toBe(expected);
  });
  it.each([[279.999, false], [280, true], [280.001, true]] as const)("includes the 280 px heading-width boundary at %s", (pixels, expected) => {
    expect(canPlaceGroupControls(placement("a", pixels / 2, 22), 2)).toBe(expected);
  });
  it.each([[43.999, false], [44, true], [44.001, true]] as const)("includes the 44 px heading-height boundary at %s", (pixels, expected) => {
    expect(canPlaceGroupControls(placement("a", 140, pixels / 2), 2)).toBe(expected);
  });
  it("excludes continued and absent headings even when their group is large", () => {
    expect(canPlaceGroupControls({ ...placement("a"), continued: true }, 1)).toBe(false);
    expect(canPlaceGroupControls({ ...placement("a"), headingBox: undefined }, 1)).toBe(false);
  });
  it("uses any eligible first segment and preserves selected order for auxiliary groups", () => {
    const split = { ...placement("split"), segment: 1, continued: true };
    expect(projectEditorControls(layout([split, placement("inline"), placement("split"), placement("small", 279)]), ["small", "split", "missing", "inline"], 1))
      .toEqual({ auxiliaryStepIds: ["small", "missing"], needsPictureList: false });
    expect(projectEditorControls(undefined, ["b", "a"], 1)).toEqual({ auxiliaryStepIds: ["b", "a"], needsPictureList: true });
  });
  it("reveals the complete repair list when any physical picture is undersized", () => {
    const group = placement("inline");
    group.pictures = [{ stepId: "inline", tokenId: "tiny", index: 0, row: 0, column: 0, cellBox: { xMm: 0, yMm: 0, widthMm: 44, heightMm: 43.999 }, pictureBox: { xMm: 0, yMm: 0, widthMm: 15, heightMm: 15 } }];
    expect(projectEditorControls(layout([group]), ["inline", "missing"], 1)).toEqual({ auxiliaryStepIds: ["missing"], needsPictureList: true });
    group.pictures[0].cellBox.heightMm = 44;
    expect(projectEditorControls(layout([group]), ["inline"], 1)).toEqual({ auxiliaryStepIds: [], needsPictureList: false });
  });
});
