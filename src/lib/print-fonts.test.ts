import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const fontBytes = () => {
  const bytes = readFileSync("public/fonts/SourceSans3-Regular-3.052.ttf");
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};
const fontModule = async () => {
  return import("./print-fonts");
};
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("prepared print font", () => {
  it("measures and checks glyphs using the bundled face rather than system fallback", async () => {
    const { prepareFontFromBuffer } = await fontModule();
    const fonts = await prepareFontFromBuffer(fontBytes());
    expect(fonts.fontId).toBe("source-sans-3-regular-3.052");
    expect(fonts.measureWidthMm("WWWWWWWWWWWWWWWWWW", 10)).toBeCloseTo(49.911, 3);
    expect(fonts.measureWidthMm("A\u0308", 10)).toBe(fonts.measureWidthMm("Ä", 10));
    expect(fonts.unsupportedCodePoints("ÄÖÜ äöü ß ẞ café ‘quotes’ – — 日日日\n")).toEqual([26085]);
    expect(fonts.lineHeightMm(10)).toBeGreaterThan(10 * 25.4 / 72);
    expect(() => fonts.measureWidthMm("Text", NaN)).toThrow();
  });

  it("rejects a changed font asset rather than associating it with the captured font identity", async () => {
    const { prepareFontFromBuffer } = await fontModule();
    const modified = fontBytes(); new Uint8Array(modified)[50] ^= 1;
    await expect(prepareFontFromBuffer(modified)).rejects.toThrow(/identity/);
  });

  it("memoizes successful browser preparation and retries a rejected attempt", async () => {
    const { prepareFonts } = await fontModule();
    let fetches = 0;
    vi.stubGlobal("fetch", async () => {
      fetches++;
      if (fetches === 1) throw new Error("Offline asset temporarily unavailable");
      return new Response(fontBytes());
    });
    class ReadyFontFace { async load() { return this; } }
    vi.stubGlobal("FontFace", ReadyFontFace);
    vi.stubGlobal("document", { fonts: { add() {}, ready: Promise.resolve() } });
    await expect(prepareFonts()).rejects.toThrow(/temporarily/);
    const [first, second] = await Promise.all([prepareFonts(), prepareFonts()]);
    expect(first).toBe(second);
    expect(first.unsupportedCodePoints("Größe")).toEqual([]);
    expect(fetches).toBe(2);
  });
});
