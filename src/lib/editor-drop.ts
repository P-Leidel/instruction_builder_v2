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

export interface EditorPictureDrop {
  groupId: string;
  index: number;
  anchorId?: string;
  edge: "before" | "after" | "empty";
}

interface IndexedRect {
  id: string;
  rect: EditorRect;
  index: number;
}

interface EditorInsertion {
  index: number;
  anchorId: string;
  edge: "before" | "after";
}

interface PictureRow {
  top: number;
  bottom: number;
  pictures: IndexedRect[];
}

function hasVisibleRect(rect: EditorRect): boolean {
  return [rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite)
    && rect.right > rect.left
    && rect.bottom > rect.top;
}

function contains(rect: EditorRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function insertionAt(item: IndexedRect, edge: "before" | "after"): EditorInsertion {
  return { index: item.index + (edge === "after" ? 1 : 0), anchorId: item.id, edge };
}

/** Resolve the two halves of a tile, or the nearest edge in an inter-tile gap. */
function axisInsertion(
  items: IndexedRect[],
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
  const indexed = pictures
    .map((picture, index) => ({ ...picture, index }))
    .filter((picture) => hasVisibleRect(picture.rect))
    .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
  const rows: PictureRow[] = [];
  for (const picture of indexed) {
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

/** Indices refer to the supplied document order before the dragged picture is removed. */
export function resolveEditorPictureDrop(
  groups: EditorGroupRect[],
  x: number,
  y: number,
): EditorPictureDrop | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const group = groups.find((candidate) => hasVisibleRect(candidate.rect) && contains(candidate.rect, x, y));
  if (!group) return null;
  if (group.pictures.length === 0) return { groupId: group.id, index: 0, edge: "empty" };

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
): { index: number; anchorId: string; edge: "before" | "after" } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const indexed = groups
    .map((group, index) => ({ id: group.id, rect: group.rect, index }))
    .filter((group) => hasVisibleRect(group.rect))
    .sort((a, b) => a.rect.top - b.rect.top);
  if (indexed.length === 0) return null;
  const bounds = {
    left: Math.min(...indexed.map((group) => group.rect.left)),
    top: Math.min(...indexed.map((group) => group.rect.top)),
    right: Math.max(...indexed.map((group) => group.rect.right)),
    bottom: Math.max(...indexed.map((group) => group.rect.bottom)),
  };
  if (!contains(bounds, x, y)) return null;
  return axisInsertion(indexed, y, "top", "bottom");
}
