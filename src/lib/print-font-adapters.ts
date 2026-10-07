import type { jsPDF } from "jspdf";
import type { OutputFragment, PreparedFonts } from "../model/output";
import { fontSizeMm, getPreparedFace, normalizedPrintText, PRINT_GLYPH_OPTIONS } from "./print-fonts";

/** Outlines and measurements use the same NFC glyph run, kerning and ligatures. */
export function outlineText(text: string, sizePt: number, fonts: PreparedFonts) {
  if (fonts.unsupportedCodePoints(text).length) throw new Error("Unsupported print glyph");
  const face = getPreparedFace(fonts), size = fontSizeMm(sizePt), normalized = normalizedPrintText(text);
  const original = face.getPath(normalized, 0, 0, size, PRINT_GLYPH_OPTIONS);
  const offset = -Math.min(0, original.getBoundingBox().x1);
  const path = face.getPath(normalized, offset, 0, size, PRINT_GLYPH_OPTIONS);
  return { path: path.toPathData(8), bounds: path.getBoundingBox() };
}

export function createSvgText(fragment: Extract<OutputFragment, { kind: "text" }>, fonts: PreparedFonts): SVGElement {
  if (fragment.fontId !== fonts.fontId) throw new Error("Print fragment font identity mismatch");
  const glyphs = outlineText(fragment.text, fragment.fontSizePt, fonts);
  const { box, baselineMm } = fragment, epsilon = 1e-7;
  if (glyphs.bounds.x2 > box.widthMm + epsilon ||
      baselineMm + glyphs.bounds.y1 < box.yMm - epsilon ||
      baselineMm + glyphs.bounds.y2 > box.yMm + box.heightMm + epsilon) throw new Error("Outlined text exceeds its planned bounds");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", glyphs.path);
  path.setAttribute("transform", `translate(${box.xMm} ${baselineMm})`);
  path.setAttribute("fill", "#111827");
  return path;
}

/** Outlined SVGs need no font resource; validate the prepared identity only. */
export function prepareSvgText(_svg: SVGSVGElement, fonts: PreparedFonts): void { getPreparedFace(fonts); }
/** PDF receives vector glyph paths through svg2pdf, so no TTF registration is needed. */
export function registerPdfFonts(_pdf: jsPDF, fonts: PreparedFonts): void { getPreparedFace(fonts); }
