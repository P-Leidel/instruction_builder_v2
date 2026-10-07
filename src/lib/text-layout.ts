import type { PreparedFonts } from "../model/output";

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Preserve complete text, or fail as soon as the physical line capacity is exceeded. */
export function wrapPrintText(text: string, widthMm: number, sizePt: number, fonts: PreparedFonts, maximumLines: number): { ok: true; lines: readonly string[] } | { ok: false } {
  if (!Number.isFinite(widthMm) || widthMm <= 0 || !Number.isInteger(maximumLines) || maximumLines < 1) return { ok: false };
  const lines: string[] = [];
  let segments: string[] = [], line = "", lastSpace = 0;
  // Iterate instead of allocating every explicit line and grapheme up front.
  // Only the current fitting line and the bounded output lines are retained.
  for (const { segment } of graphemes.segment(text.replace(/\r\n?/gu, "\n").replace(/\t/gu, "    "))) {
    if (segment === "\n") {
      lines.push(line);
      if (lines.length >= maximumLines) return { ok: false };
      segments = []; line = ""; lastSpace = 0;
      continue;
    }
    while (fonts.measureWidthMm(line + segment, sizePt) > widthMm + 1e-8) {
      if (!segments.length) return { ok: false };
      const end = lastSpace || segments.length;
      lines.push(segments.slice(0, end).join(""));
      if (lines.length >= maximumLines) return { ok: false };
      segments = segments.slice(end); line = segments.join(""); lastSpace = 0;
    }
    segments.push(segment); line += segment;
    if (/\s/u.test(segment)) lastSpace = segments.length;
  }
  lines.push(line);
  return { ok: true, lines };
}
