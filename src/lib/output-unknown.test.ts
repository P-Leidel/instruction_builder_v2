import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sequenceFixture } from "../test/fixtures/overhaul";
import type { OutputPlan } from "../model/output";
import { createDefaultOutputOptions } from "./output-options";
import { planOutput } from "./output-plan";
import { prepareFontFromBuffer } from "./print-fonts";

async function preparedFont() {
  const bytes = readFileSync("public/fonts/SourceSans3-Regular-3.052.ttf");
  return prepareFontFromBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
function unknownGuide(iconId = "x", label?: string) {
  const doc = sequenceFixture();
  doc.steps[0].tokens = [{ id: "unknown-cup", iconId, category: "object", ...(label === undefined ? {} : { label }) }];
  return doc;
}
function caption(plan: OutputPlan) {
  return plan.pages.flatMap(page => page.fragments).filter(fragment => fragment.kind === "text" && fragment.source.tokenId === "unknown-cup");
}

describe("unknown main picture captions", () => {
  // Restoring separate paragraphs would block the short caption with the actual font.
  it.each([
    ["en", "sheet", "Unknown picture (x) — Cup"], ["de", "sheet", "Unbekanntes Bild (x) — Cup"],
    ["en", "label", "Unknown picture (x) — Cup"], ["de", "label", "Unbekanntes Bild (x) — Cup"],
  ] as const)("fits the full %s unknown identity and short authored caption on %s", async (locale, preset, expected) => {
    const fonts = await preparedFont(), doc = unknownGuide("x", "Cup"), before = structuredClone(doc);
    const options = createDefaultOutputOptions(doc, locale, preset);
    const known = structuredClone(doc); known.steps[0].tokens[0].iconId = "object.onion";
    const baseline = planOutput(known, options, fonts), result = planOutput(doc, options, fonts);
    expect(baseline.ok).toBe(true); expect(result.ok).toBe(true);
    if (!baseline.ok || !result.ok) throw new Error("Expected both captions to fit");
    expect(caption(result.plan).map(fragment => fragment.kind === "text" ? fragment.text : "").join("")).toBe(expected);
    expect(caption(result.plan).every(fragment => fragment.role === "context")).toBe(true);
    expect(result.plan.notices).toContainEqual({ code: "unknown-symbol", source: { stepId: "fixture-group-1", tokenId: "unknown-cup" }, messageKey: "output.unknownSymbolNotice" });
    expect(result.plan.pages.flatMap(page => page.fragments).find(fragment => fragment.kind === "symbol" && fragment.role === "token")).toMatchObject({ iconId: "x" });
    expect(result.plan.editorLayout).toEqual(baseline.plan.editorLayout);
    const layout = result.plan.editorLayout!, placement = layout.pages[0].groups[0].pictures[0], lane = layout.cell.captionBox;
    for (const fragment of caption(result.plan)) {
      if (fragment.kind !== "text") continue;
      expect(fragment.box.xMm + fragment.box.widthMm / 2).toBeCloseTo(placement.cellBox.xMm + lane.widthMm / 2, 7);
      expect(fragment.box.yMm).toBeGreaterThanOrEqual(placement.cellBox.yMm + lane.yMm);
      expect(fragment.box.yMm + fragment.box.heightMm).toBeLessThanOrEqual(placement.cellBox.yMm + lane.yMm + lane.heightMm + 1e-7);
    }
    expect(doc).toEqual(before);
  });

  it("wraps a longer authored caption completely within A4 without a paragraph gap", async () => {
    const fonts = await preparedFont(), doc = unknownGuide("x", "Prepare ingredients");
    const result = planOutput(doc, createDefaultOutputOptions(doc, "en"), fonts);
    expect(result.ok).toBe(true); if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(caption(result.plan).map(fragment => fragment.kind === "text" ? fragment.text : "").join("")).toBe("Unknown picture (x) — Prepare ingredients");
    expect(caption(result.plan)).toHaveLength(2);
  });

  it.each([undefined, ""])("retains localized identity for an unknown without authored caption %s", async label => {
    const fonts = await preparedFont(), doc = unknownGuide("x", label);
    const result = planOutput(doc, createDefaultOutputOptions(doc, "de"), fonts);
    expect(result.ok).toBe(true); if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(caption(result.plan).map(fragment => fragment.kind === "text" ? fragment.text : "").join("")).toBe("Unbekanntes Bild (x)");
  });

  it("omits the authored caption in Pictures while retaining full unknown context", async () => {
    const fonts = await preparedFont(), doc = unknownGuide("x", "日"), options = createDefaultOutputOptions(doc, "en");
    options.mode = "pictures";
    const result = planOutput(doc, options, fonts);
    expect(result.ok).toBe(true); if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(caption(result.plan).map(fragment => fragment.kind === "text" ? fragment.text : "").join("")).toBe("Unknown picture (x)");
    expect(doc.steps[0].tokens[0].label).toBe("日");
  });

  it.each([
    ["long-" + "W".repeat(80), "Cup"], ["x", "Complete authored meaning ".repeat(30)],
  ])("blocks oversized composite captions without truncation and retains exact repair targets", async (iconId, label) => {
    const fonts = await preparedFont(), doc = unknownGuide(iconId, label), before = structuredClone(doc);
    const result = planOutput(doc, createDefaultOutputOptions(doc, "en"), fonts);
    expect(result.ok).toBe(false); if (result.ok) throw new Error("Expected caption overflow");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "overflow", source: { stepId: "fixture-group-1", tokenId: "unknown-cup" }, params: expect.objectContaining({ field: "context", content: `Unknown picture (${iconId}) — ${label}` }) }));
    expect(result).not.toHaveProperty("plan");
    expect(result.editorLayout?.pages[0].groups[0].pictures[0]).toMatchObject({ stepId: "fixture-group-1", tokenId: "unknown-cup" });
    expect(doc).toEqual(before);
  });

  it.each([["日", "Cup"], ["x", "日"]])("applies glyph policy to the complete visible ID and authored caption", async (iconId, label) => {
    const fonts = await preparedFont(), doc = unknownGuide(iconId, label), before = structuredClone(doc);
    const result = planOutput(doc, createDefaultOutputOptions(doc, "en"), fonts);
    expect(result.ok).toBe(false); if (result.ok) throw new Error("Expected unsupported glyph");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "unsupported-glyph", source: { stepId: "fixture-group-1", tokenId: "unknown-cup" }, params: { content: `Unknown picture (${iconId}) — ${label}`, codePoints: "U+65E5" } }));
    expect(result.editorLayout?.pages[0].groups[0].pictures[0].tokenId).toBe("unknown-cup");
    expect(doc).toEqual(before);
  });
});
