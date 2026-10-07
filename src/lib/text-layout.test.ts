import { describe, expect, it } from "vitest";
import type { PreparedFonts } from "../model/output";
import * as api from "./text-layout";
const fonts: PreparedFonts = { fontId: "fixture", measureWidthMm: (text) => [...text.normalize("NFC")].length,
  lineHeightMm: () => 5, unsupportedCodePoints: () => [] };
describe("measured print wrapping", () => {
  it("preserves word boundaries, explicit blank lines and repeated whitespace", async () => {
    expect(api.wrapPrintText("Hello world", 6, 10, fonts, 2)).toEqual({ ok: true, lines: ["Hello ", "world"] });
    expect(api.wrapPrintText("A  B\n\nC", 5, 10, fonts, 3)).toEqual({ ok: true, lines: ["A  B", "", "C"] });
  });
  it("splits an unbroken string at safe grapheme boundaries without losing characters", async () => {
    const text = "A\u0308".repeat(18);
    const result = api.wrapPrintText(text, 4, 10, fonts, 5);
    expect(result.ok).toBe(true); if (!result.ok) throw new Error("Expected wrapped text"); expect(result.lines.map((line: string) => [...line.normalize("NFC")].length)).toEqual([4, 4, 4, 4, 2]);
    expect(result.lines.join("")).toBe(text);
    expect(api.wrapPrintText("W", .5, 10, fonts, 1)).toEqual({ ok: false });
  });
  it("rejects explicit lines beyond the physical capacity instead of returning a partial success", () => {
    expect(api.wrapPrintText("\n".repeat(150000), 6, 10, fonts, 2).ok).toBe(false);
    expect(api.wrapPrintText("A\r\n\rB\n", 6, 10, fonts, 4)).toEqual({ ok: true, lines: ["A", "", "B", ""] });
    expect(api.wrapPrintText("A\n", 6, 10, fonts, 1)).toEqual({ ok: false });
  });
  it("fits full grapheme text and expanded tabs within the available lines", () => {
    expect(api.wrapPrintText("A\u0308BCDEF", 3, 10, fonts, 2)).toEqual({ ok: true, lines: ["A\u0308BC", "DEF"] });
    expect(api.wrapPrintText("A\tB", 4, 10, fonts, 2)).toEqual({ ok: true, lines: ["A   ", " B"] });
    expect(api.wrapPrintText("ABCDEFG", 3, 10, fonts, 2)).toEqual({ ok: false });
    expect(api.wrapPrintText("A", 3, 10, fonts, 0)).toEqual({ ok: false });
  });
});
