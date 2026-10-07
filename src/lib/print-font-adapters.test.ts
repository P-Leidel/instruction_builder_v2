import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { prepareFontFromBuffer } from "./print-fonts";
import { outlineText } from "./print-font-adapters";

describe("outline font adapter boundary", () => {
  it("keeps measured line advances and glyph painted bounds within the text fragment", async () => {
    const bytes = readFileSync("public/fonts/SourceSans3-Regular-3.052.ttf");
    const fonts = await prepareFontFromBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    for (const text of ["ÄÖÜ äöü ß ẞ", "A\u0308 café", "WWWWWWWWWWWWWWWWWW", "’f", "j", "jÄ café j", "jj"] ) {
      const outlined = outlineText(text, 10, fonts);
      expect(outlined.path).toContain("M");
      expect(outlined.bounds.x1).toBeGreaterThanOrEqual(-1e-8);
      expect(outlined.bounds.x2).toBeLessThanOrEqual(fonts.measureWidthMm(text, 10) + 1e-8);
      expect(outlined.bounds.y1 + fonts.lineHeightMm(10) * .8).toBeGreaterThanOrEqual(0);
      expect(outlined.bounds.y2 + fonts.lineHeightMm(10) * .8).toBeLessThanOrEqual(fonts.lineHeightMm(10));
    }
    expect(() => outlineText("日", 10, fonts)).toThrow(/glyph/);
  });
});
