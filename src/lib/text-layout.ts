import type { PreparedFonts } from "../model/output";

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Preserve spaces and explicit lines; tabs expand to four spaces in every format. */
export function wrapPrintText(text: string, widthMm: number, sizePt: number, fonts: PreparedFonts): { ok: true; lines: readonly string[] } | { ok: false } {
  if (!Number.isFinite(widthMm) || widthMm <= 0) return { ok: false };
  const lines: string[] = [];
  for (const explicit of text.replace(/\r\n?/gu, "\n").replace(/\t/gu, "    ").split("\n")) {
    const segments = [...graphemes.segment(explicit)].map((part) => part.segment);
    if (!segments.length) { lines.push(""); continue; }
    let start = 0;
    while (start < segments.length) {
      let end = start, lastSpace = -1;
      while (end < segments.length && fonts.measureWidthMm(segments.slice(start, end + 1).join(""), sizePt) <= widthMm + 1e-8) {
        if (/\s/u.test(segments[end])) lastSpace = end + 1;
        end++;
      }
      if (end === start) return { ok: false };
      if (end < segments.length && lastSpace > start) end = lastSpace;
      lines.push(segments.slice(start, end).join("")); start = end;
    }
  }
  return { ok: true, lines };
}
