import opentype from "opentype.js";
import type { Font } from "opentype.js";
import { PRINT_FONT } from "../data/print-fonts";
import type { PreparedFonts } from "../model/output";

export const PRINT_GLYPH_OPTIONS = { kerning: true, features: { liga: true, rlig: true } };
const faces = new WeakMap<PreparedFonts, Font>();
let prepared: Promise<PreparedFonts> | undefined;

/** Rendering normalization preserves the authored string in the document/plan. */
export function normalizedPrintText(text: string): string { return text.normalize("NFC"); }
export function fontSizeMm(sizePt: number): number {
  if (!Number.isFinite(sizePt) || sizePt <= 0) throw new Error("Invalid print font size");
  return sizePt * 25.4 / 72;
}
export function getPreparedFace(fonts: PreparedFonts): Font {
  const face = faces.get(fonts);
  if (!face || fonts.fontId !== PRINT_FONT.id) throw new Error("Print font identity is not prepared");
  return face;
}

/** Internal package seam also used by binary/coverage tooling and the rendered proof. */
export async function prepareFontFromBuffer(buffer: ArrayBuffer): Promise<PreparedFonts> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (buffer.byteLength !== PRINT_FONT.bytes || hash !== PRINT_FONT.sha256) throw new Error("Print font asset identity mismatch");
  const face = opentype.parse(buffer);
  if (face.tables.head.fontRevision !== PRINT_FONT.version) throw new Error("Print font version mismatch");
  const missing = (text: string) => [...new Set([...normalizedPrintText(text)]
    .filter((char) => !/[\n\r\t]/u.test(char) && face.charToGlyphIndex(char) === 0)
    .map((char) => char.codePointAt(0)!))];
  if (missing(PRINT_FONT.coverageProbe).length) throw new Error("Print font declared Latin coverage unavailable");
  const ascent = Math.max(face.ascender, face.tables.head.yMax);
  const descent = Math.max(-face.descender, -face.tables.head.yMin);
  // The planner places baselines at 80% of this measured line box. Reserve
  // enough space above/below for the face's complete vertical glyph extent.
  const lineUnits = Math.max(ascent / .8, descent / .2);
  // Repeated authored labels share prefixes during wrapping. Bound the cache
  // while avoiding a fresh outline parse for every prefix on every picture.
  const widths = new Map<string, number>();
  const fonts: PreparedFonts = {
    fontId: PRINT_FONT.id,
    measureWidthMm(text, sizePt) {
      const normalized = normalizedPrintText(text), size = fontSizeMm(sizePt);
      if (!normalized) return 0;
      const key = `${sizePt}:${normalized}`;
      const cached = widths.get(key);
      if (cached !== undefined) return cached;
      const bounds = face.getPath(normalized, 0, 0, size, PRINT_GLYPH_OPTIONS).getBoundingBox();
      const advance = face.getAdvanceWidth(normalized, size, PRINT_GLYPH_OPTIONS);
      const width = Math.max(advance, bounds.x2) - Math.min(0, bounds.x1);
      if (widths.size >= 2048) widths.delete(widths.keys().next().value!);
      widths.set(key, width);
      return width;
    },
    lineHeightMm(sizePt) { return lineUnits / face.unitsPerEm * fontSizeMm(sizePt); },
    unsupportedCodePoints: missing,
  };
  faces.set(fonts, face);
  return fonts;
}

async function loadFonts(): Promise<PreparedFonts> {
  const response = await fetch(PRINT_FONT.url);
  if (!response.ok) throw new Error("Print font asset unavailable");
  const buffer = await response.arrayBuffer();
  const fonts = await prepareFontFromBuffer(buffer);
  if (typeof FontFace === "undefined" || typeof document === "undefined") throw new Error("Browser font loading unavailable");
  const face = await new FontFace(PRINT_FONT.family, buffer, { style: "normal", weight: "400" }).load();
  document.fonts.add(face);
  await document.fonts.ready;
  return fonts;
}

export function prepareFonts(): Promise<PreparedFonts> {
  if (!prepared) {
    prepared = loadFonts().catch((error: unknown) => { prepared = undefined; throw error; });
  }
  return prepared;
}
