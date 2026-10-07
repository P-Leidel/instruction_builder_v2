import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "../model/instruction";
import { groupDropIndex, pictureDropIndex } from "./editor-drop-index";
describe("physical page drop anchors", () => {
  const doc = createEmptyDocument();
  doc.steps = [{ id: "first", tokens: Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, category: "object" as const, iconId: "object.onion" })) }, { id: "empty", tokens: [] }];
  it("resolves later page anchors against document order", () => {
    expect(pictureDropIndex(doc, { groupId: "first", index: 0, anchorId: "p24", edge: "before" })).toBe(24);
    expect(pictureDropIndex(doc, { groupId: "first", index: 1, anchorId: "p24", edge: "after" })).toBe(25);
    expect(groupDropIndex(doc, { anchorId: "empty", edge: "after" })).toBe(2);
  });
  it("rejects removed anchors and false empty segments", () => {
    expect(pictureDropIndex(doc, { groupId: "first", index: 0, edge: "empty" })).toBeNull();
    expect(pictureDropIndex(doc, { groupId: "first", index: 0, anchorId: "gone", edge: "before" })).toBeNull();
    expect(pictureDropIndex(doc, { groupId: "empty", index: 0, edge: "empty" })).toBe(0);
    expect(groupDropIndex(doc, { anchorId: "gone", edge: "after" })).toBeNull();
  });
});
