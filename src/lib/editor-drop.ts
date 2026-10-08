import type { InstructionDocument } from "../model/instruction";
import type { AppLocale } from "../model/library";
import type { EditorDragSource, EditorDropCommand, PictureCommand, PicturePlacement, PictureRef, GroupPlacement, GroupMoveCommand } from "../model/editor-command";

export interface EditorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface EditorPictureRect {
  id: string;
  rect: EditorRect;
}

export interface EditorGroupRect {
  id: string;
  rect: EditorRect;
  pictures: EditorPictureRect[];
}

export type EditorPictureDrop =
  | { groupId: string; edge: "empty"; anchorId?: never }
  | { groupId: string; anchorId: string; edge: "before" | "after" };
export type EditorGroupDrop = GroupPlacement;

interface AnchoredRect {
  id: string;
  rect: EditorRect;
}

interface EditorInsertion {
  anchorId: string;
  edge: "before" | "after";
}

interface PictureRow {
  top: number;
  bottom: number;
  pictures: AnchoredRect[];
}

function hasVisibleRect(rect: EditorRect): boolean {
  return [rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite)
    && rect.right > rect.left
    && rect.bottom > rect.top;
}

function contains(rect: EditorRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function insertionAt(item: AnchoredRect, edge: "before" | "after"): EditorInsertion {
  return { anchorId: item.id, edge };
}

/** Resolve the two halves of a tile, or the nearest edge in an inter-tile gap. */
function axisInsertion(
  items: AnchoredRect[],
  point: number,
  start: "left" | "top",
  end: "right" | "bottom",
): EditorInsertion {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (point < item.rect[start]) {
      const previous = items[index - 1];
      if (previous && point - previous.rect[end] <= item.rect[start] - point) {
        return insertionAt(previous, "after");
      }
      return insertionAt(item, "before");
    }
    if (point <= item.rect[end]) {
      return insertionAt(item, point < (item.rect[start] + item.rect[end]) / 2 ? "before" : "after");
    }
  }
  return insertionAt(items[items.length - 1], "after");
}

function pictureRows(pictures: EditorPictureRect[]): PictureRow[] {
  const visible = pictures
    .filter((picture) => hasVisibleRect(picture.rect))
    .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
  const rows: PictureRow[] = [];
  for (const picture of visible) {
    const row = rows[rows.length - 1];
    // A shared row top survives both differing tile heights and CSS subpixel rounding.
    if (row && Math.abs(picture.rect.top - row.top) <= 1) {
      row.bottom = Math.max(row.bottom, picture.rect.bottom);
      row.pictures.push(picture);
    } else {
      rows.push({ top: picture.rect.top, bottom: picture.rect.bottom, pictures: [picture] });
    }
  }
  for (const row of rows) row.pictures.sort((a, b) => a.rect.left - b.rect.left);
  return rows;
}

function verticalGap(row: PictureRow, y: number): number {
  return Math.max(row.top - y, y - row.bottom, 0);
}

/** Geometry supplies stable anchors, including on continued page segments. */
export function resolveEditorPictureDrop(
  groups: EditorGroupRect[],
  x: number,
  y: number,
): EditorPictureDrop | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const group = groups.find((candidate) => hasVisibleRect(candidate.rect) && contains(candidate.rect, x, y));
  if (!group) return null;
  if (group.pictures.length === 0) return { groupId: group.id, edge: "empty" };

  const rows = pictureRows(group.pictures);
  if (rows.length === 0) return null;
  const lastRow = rows[rows.length - 1];
  if (y > lastRow.bottom) {
    return {
      groupId: group.id,
      ...insertionAt(lastRow.pictures[lastRow.pictures.length - 1], "after"),
    };
  }

  let closestRow = rows[0];
  for (const row of rows.slice(1)) {
    if (verticalGap(row, y) < verticalGap(closestRow, y)) closestRow = row;
  }
  return { groupId: group.id, ...axisInsertion(closestRow.pictures, x, "left", "right") };
}

/** Group gaps are valid targets; points beyond the list's outer bounds cancel. */
export function resolveEditorGroupDrop(
  groups: EditorGroupRect[],
  x: number,
  y: number,
): EditorGroupDrop | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const visible = groups
    .map((group) => ({ id: group.id, rect: group.rect }))
    .filter((group) => hasVisibleRect(group.rect))
    .sort((a, b) => a.rect.top - b.rect.top);
  if (visible.length === 0) return null;
  const bounds = {
    left: Math.min(...visible.map((group) => group.rect.left)),
    top: Math.min(...visible.map((group) => group.rect.top)),
    right: Math.max(...visible.map((group) => group.rect.right)),
    bottom: Math.max(...visible.map((group) => group.rect.bottom)),
  };
  if (!contains(bounds, x, y)) return null;
  return axisInsertion(visible, y, "top", "bottom");
}
/** Resolve against the complete group, then translate to the final picture slot
 * exactly once. A self anchor denotes its existing position on either edge. */
export function resolvePicturePlacement(document: InstructionDocument, destination: PicturePlacement, source?: PictureRef): number | null {
  const group = document.steps.find(step => step.id === destination.stepId);
  if (!group) return null;
  const sourceGroup = source && document.steps.find(step => step.id === source.stepId);
  const sourceIndex = sourceGroup?.tokens.findIndex(token => token.id === source?.tokenId) ?? -1;
  if (source && sourceIndex < 0) return null;
  const sameGroup = source?.stepId === destination.stepId;
  const length = group.tokens.length - (sameGroup ? 1 : 0);
  switch (destination.kind) {
    case "append": return length;
    case "empty": return group.tokens.length === 0 ? 0 : null;
    case "final-index": return Number.isFinite(destination.index) ? Math.max(0, Math.min(Math.trunc(destination.index), length)) : null;
    case "anchor": {
      const index = group.tokens.findIndex(token => token.id === destination.anchorId);
      if (index < 0) return null;
      if (sameGroup && destination.anchorId === source?.tokenId) return sourceIndex;
      const insertion = index + (destination.edge === "after" ? 1 : 0);
      return insertion - (sameGroup && sourceIndex < insertion ? 1 : 0);
    }
  }
}

/** Group primitives retain their private pre-removal insertion convention. */
export function resolveGroupPlacement(document: InstructionDocument, sourceStepId: string, destination: GroupPlacement): number | null {
  if (!document.steps.some(step => step.id === sourceStepId)) return null;
  const index = document.steps.findIndex(step => step.id === destination.anchorId);
  return index < 0 ? null : index + (destination.edge === "after" ? 1 : 0);
}

export interface EditorDropPermission {
  inViewport: boolean;
  blockedTarget: boolean;
  modalOpen: boolean;
  sourceConnected: boolean;
  guideUnchanged: boolean;
  documentUnchanged: boolean;
}
interface EditorDropTargets { pictureDrop: EditorPictureDrop | null; groupDrop: EditorGroupDrop | null }

export function resolveEditorDropCommand(source: Exclude<EditorDragSource, { kind: "group" }>, targets: EditorDropTargets, permission: EditorDropPermission, labelLocale: AppLocale): PictureCommand | null;
export function resolveEditorDropCommand(source: Extract<EditorDragSource, { kind: "group" }>, targets: EditorDropTargets, permission: EditorDropPermission, labelLocale: AppLocale): GroupMoveCommand | null;
export function resolveEditorDropCommand(source: EditorDragSource, targets: EditorDropTargets, permission: EditorDropPermission, labelLocale: AppLocale): EditorDropCommand | null;
export function resolveEditorDropCommand(source: EditorDragSource, targets: EditorDropTargets, permission: EditorDropPermission, labelLocale: AppLocale): EditorDropCommand | null {
  if (!permission.inViewport || permission.blockedTarget || permission.modalOpen || !permission.sourceConnected || !permission.guideUnchanged || !permission.documentUnchanged) return null;
  if (source.kind === "group") return targets.groupDrop ? { kind: "move-group", sourceStepId: source.groupId, destination: targets.groupDrop } : null;
  const drop = targets.pictureDrop; if (!drop) return null;
  const destination: PicturePlacement = drop.edge === "empty"
    ? { kind: "empty", stepId: drop.groupId }
    : { kind: "anchor", stepId: drop.groupId, anchorId: drop.anchorId, edge: drop.edge };
  return source.kind === "library"
    ? { kind: "insert", entry: source.entry, locale: labelLocale, destination }
    : { kind: "move", source: { stepId: source.groupId, tokenId: source.tokenId }, destination };
}
