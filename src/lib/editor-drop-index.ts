import type { InstructionDocument } from "../model/instruction";
import type { EditorPictureDrop } from "./editor-drop";

/** Continued page segments contain only part of a group. Resolve stable
 * anchors against the source document rather than the segment's DOM index. */
export function pictureDropIndex(document: InstructionDocument, drop: EditorPictureDrop): number | null {
  const group = document.steps.find(step => step.id === drop.groupId);
  if (!group) return null;
  if (drop.edge === "empty") return group.tokens.length === 0 ? 0 : null;
  const index = group.tokens.findIndex(token => token.id === drop.anchorId);
  return index < 0 ? null : index + (drop.edge === "after" ? 1 : 0);
}
export function groupDropIndex(document: InstructionDocument, drop: { anchorId: string; edge: "before" | "after" }): number | null {
  const index = document.steps.findIndex(group => group.id === drop.anchorId);
  return index < 0 ? null : index + (drop.edge === "after" ? 1 : 0);
}
