import { describe, expect, it } from "vitest";
import type { PreparedFonts } from "../model/output";
import * as api from "./text-layout";
const fonts: PreparedFonts = { fontId: "fixture", measureWidthMm: (text) => [...text.normalize("NFC")].length,
  lineHeightMm: () => 5, unsupportedCodePoints: () => [] };
describe("measured print wrapping", () => {
  it("preserves word boundaries, explicit blank lines and repeated whitespace", async () => {
    expect(api.wrapPrintText("Hello world", 6, 10, fonts)).toEqual({ ok: true, lines: ["Hello ", "world"] });
    expect(api.wrapPrintText("A  B\n\nC", 5, 10, fonts)).toEqual({ ok: true, lines: ["A  B", "", "C"] });
  });
  it("splits an unbroken string at safe grapheme boundaries without losing characters", async () => {
    const text = "A\u0308".repeat(18);
    const result = api.wrapPrintText(text, 4, 10, fonts);
    expect(result.ok).toBe(true); if (!result.ok) throw new Error("Expected wrapped text"); expect(result.lines.map((line: string) => [...line.normalize("NFC")].length)).toEqual([4, 4, 4, 4, 2]);
    expect(result.lines.join("")).toBe(text);
    expect(api.wrapPrintText("W", .5, 10, fonts)).toEqual({ ok: false });
  });
});
