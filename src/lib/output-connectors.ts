import type { MmBox, MmPoint } from "../model/output";

/** A row turn stays in the fixed gap between the source and destination cells. */
export function rowConnectorPoints(previous: MmBox, current: MmBox): {
  from: MmPoint; to: MmPoint; via: readonly MmPoint[];
} {
  const from = { xMm: previous.xMm + previous.widthMm / 2, yMm: previous.yMm + previous.heightMm };
  const to = { xMm: current.xMm + current.widthMm / 2, yMm: current.yMm };
  const gapCenter = (from.yMm + to.yMm) / 2;
  return { from, to, via: [{ xMm: from.xMm, yMm: gapCenter }, { xMm: to.xMm, yMm: gapCenter }] };
}
