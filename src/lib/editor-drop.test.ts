import { describe, expect, it } from "vitest";
import {
  resolveEditorGroupDrop,
  resolveEditorPictureDrop,
  type EditorGroupRect,
} from "./editor-drop";

const groups: EditorGroupRect[] = [
  {
    id: "first",
    rect: { left: 20, top: 80, right: 360, bottom: 360 },
    pictures: [
      { id: "a", rect: { left: 40, top: 120, right: 140, bottom: 220 } },
      { id: "b", rect: { left: 170, top: 120, right: 270, bottom: 165 } },
      { id: "c", rect: { left: 40, top: 250, right: 140, bottom: 300 } },
      { id: "d", rect: { left: 170, top: 250, right: 270, bottom: 315 } },
    ],
  },
  {
    id: "empty",
    rect: { left: 20, top: 390, right: 360, bottom: 490 },
    pictures: [],
  },
  {
    id: "last",
    rect: { left: 20, top: 520, right: 360, bottom: 690 },
    pictures: [
      { id: "e", rect: { left: 40, top: 560, right: 140, bottom: 620 } },
    ],
  },
];

describe("resolveEditorPictureDrop", () => {
  it("returns before the first picture when moving backward", () => {
    expect(resolveEditorPictureDrop(groups, 55, 145)).toEqual({
      groupId: "first", index: 0, anchorId: "a", edge: "before",
    });
  });

  it("returns a pre-removal slot after the last picture when moving forward", () => {
    expect(resolveEditorPictureDrop(groups, 255, 275)).toEqual({
      groupId: "first", index: 4, anchorId: "d", edge: "after",
    });
  });

  it("uses row alignment when a short picture ends above its taller neighbour", () => {
    expect(resolveEditorPictureDrop(groups, 190, 205)).toEqual({
      groupId: "first", index: 1, anchorId: "b", edge: "before",
    });
  });

  it("resolves the next wrapped row in document order", () => {
    expect(resolveEditorPictureDrop(groups, 55, 270)).toEqual({
      groupId: "first", index: 2, anchorId: "c", edge: "before",
    });
  });

  it.each([
    { y: 230, index: 0, anchorId: "a" },
    { y: 245, index: 2, anchorId: "c" },
  ])("chooses the vertically closest row in the row gap at y=$y", ({ y, index, anchorId }) => {
    expect(resolveEditorPictureDrop(groups, 55, y)).toEqual({
      groupId: "first", index, anchorId, edge: "before",
    });
  });

  it.each([
    { x: 145, anchorId: "a", edge: "after" },
    { x: 165, anchorId: "b", edge: "before" },
  ])("anchors a horizontal gap to the nearest tile edge at x=$x", ({ x, anchorId, edge }) => {
    expect(resolveEditorPictureDrop(groups, x, 140)).toEqual({
      groupId: "first", index: 1, anchorId, edge,
    });
  });

  it("appends from whitespace below the last row regardless of its horizontal position", () => {
    expect(resolveEditorPictureDrop(groups, 25, 340)).toEqual({
      groupId: "first", index: 4, anchorId: "d", edge: "after",
    });
  });

  it("targets an empty destination group", () => {
    expect(resolveEditorPictureDrop(groups, 200, 440)).toEqual({
      groupId: "empty", index: 0, edge: "empty",
    });
  });

  it("returns the destination group's index when moving across groups", () => {
    expect(resolveEditorPictureDrop(groups, 110, 580)).toEqual({
      groupId: "last", index: 1, anchorId: "e", edge: "after",
    });
  });

  it.each([
    { x: 19, y: 140 },
    { x: 361, y: 140 },
    { x: 55, y: 79 },
    { x: 55, y: 375 },
    { x: 55, y: 691 },
  ])("cancels outside an actual group at $x,$y", ({ x, y }) => {
    expect(resolveEditorPictureDrop(groups, x, y)).toBeNull();
  });

  it("cancels when there are no groups", () => {
    expect(resolveEditorPictureDrop([], 40, 40)).toBeNull();
  });

  it.each([
    { left: 20, top: 80, right: 20, bottom: 360 },
    { left: 20, top: 80, right: 360, bottom: 80 },
    { left: 360, top: 80, right: 20, bottom: 360 },
    { left: 20, top: 360, right: 360, bottom: 80 },
    { left: 20, top: 80, right: Number.POSITIVE_INFINITY, bottom: 360 },
    { left: Number.NaN, top: 80, right: 360, bottom: 360 },
  ])("rejects hidden or invalid group geometry $left,$top,$right,$bottom", (rect) => {
    const invalidGroup = { id: "invalid", rect, pictures: [] };
    expect(resolveEditorPictureDrop([invalidGroup], 20, 80)).toBeNull();
  });

  it.each([
    { left: 170, top: 120, right: 170, bottom: 200 },
    { left: 170, top: 120, right: 180, bottom: 120 },
    { left: 180, top: 120, right: 170, bottom: 200 },
    { left: 170, top: 200, right: 180, bottom: 120 },
    { left: 170, top: 120, right: Number.POSITIVE_INFINITY, bottom: 200 },
    { left: 170, top: Number.NaN, right: 180, bottom: 200 },
  ])("ignores invalid picture geometry $left,$top,$right,$bottom without renumbering", (rect) => {
    const group: EditorGroupRect = {
      id: "filtered",
      rect: groups[0].rect,
      pictures: [
        groups[0].pictures[0],
        { id: "hidden", rect },
        { id: "visible", rect: { left: 190, top: 120, right: 290, bottom: 200 } },
      ],
    };
    expect(resolveEditorPictureDrop([group], 170, 140)).toEqual({
      groupId: "filtered", index: 2, anchorId: "visible", edge: "before",
    });
  });

  it("does not derive a picture insertion when every picture has hidden geometry", () => {
    const group: EditorGroupRect = {
      ...groups[0],
      pictures: [{ id: "hidden", rect: { left: 0, top: 0, right: 0, bottom: 0 } }],
    };
    expect(resolveEditorPictureDrop([group], 200, 140)).toBeNull();
  });

  it.each([
    { x: Number.NaN, y: 140 },
    { x: 55, y: Number.NaN },
    { x: Number.POSITIVE_INFINITY, y: 140 },
    { x: 55, y: Number.NEGATIVE_INFINITY },
  ])("rejects nonfinite pointer coordinates $x,$y", ({ x, y }) => {
    expect(resolveEditorPictureDrop(groups, x, y)).toBeNull();
  });
});

describe("resolveEditorGroupDrop", () => {
  it("returns the first insertion when moving backward", () => {
    expect(resolveEditorGroupDrop(groups, 200, 100)).toEqual({
      index: 0, anchorId: "first", edge: "before",
    });
  });

  it("returns a pre-removal insertion after the last group when moving forward", () => {
    expect(resolveEditorGroupDrop(groups, 200, 660)).toEqual({
      index: 3, anchorId: "last", edge: "after",
    });
  });

  it.each([
    { y: 430, index: 1, edge: "before" },
    { y: 450, index: 2, edge: "after" },
  ])("splits a group at its own vertical midpoint at y=$y", ({ y, index, edge }) => {
    expect(resolveEditorGroupDrop(groups, 200, y)).toEqual({
      index, anchorId: "empty", edge,
    });
  });

  it.each([
    { y: 365, anchorId: "first", edge: "after" },
    { y: 385, anchorId: "empty", edge: "before" },
  ])("anchors the list gap to the nearest group edge at y=$y", ({ y, anchorId, edge }) => {
    expect(resolveEditorGroupDrop(groups, 200, y)).toEqual({
      index: 1, anchorId, edge,
    });
  });

  it.each([
    { x: 19, y: 440 },
    { x: 361, y: 440 },
    { x: 200, y: 79 },
    { x: 200, y: 691 },
  ])("cancels outside the list bounds at $x,$y", ({ x, y }) => {
    expect(resolveEditorGroupDrop(groups, x, y)).toBeNull();
  });

  it("cancels when there are no groups", () => {
    expect(resolveEditorGroupDrop([], 40, 40)).toBeNull();
  });

  it.each([
    { left: 20, top: 80, right: 20, bottom: 360 },
    { left: 20, top: 80, right: 360, bottom: 80 },
    { left: 360, top: 80, right: 20, bottom: 360 },
    { left: 20, top: 360, right: 360, bottom: 80 },
    { left: 20, top: 80, right: Number.POSITIVE_INFINITY, bottom: 360 },
    { left: Number.NaN, top: 80, right: 360, bottom: 360 },
  ])("rejects a list with only invalid group geometry $left,$top,$right,$bottom", (rect) => {
    expect(resolveEditorGroupDrop([{ id: "invalid", rect, pictures: [] }], 20, 80)).toBeNull();
  });

  it("excludes invalid groups from bounds while preserving valid group indices", () => {
    const list: EditorGroupRect[] = [
      { id: "invalid", rect: { left: 0, top: 0, right: Number.NaN, bottom: 0 }, pictures: [] },
      groups[1],
    ];
    expect(resolveEditorGroupDrop(list, 200, 430)).toEqual({
      index: 1, anchorId: "empty", edge: "before",
    });
  });

  it.each([
    { x: Number.NaN, y: 440 },
    { x: 200, y: Number.NaN },
    { x: Number.NEGATIVE_INFINITY, y: 440 },
    { x: 200, y: Number.POSITIVE_INFINITY },
  ])("rejects nonfinite pointer coordinates $x,$y", ({ x, y }) => {
    expect(resolveEditorGroupDrop(groups, x, y)).toBeNull();
  });
});
