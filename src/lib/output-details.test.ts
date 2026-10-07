import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { InstructionDocument } from "../model/instruction";
import type { OutputFragment, OutputPlan } from "../model/output";
import { sequenceFixture } from "../test/fixtures/overhaul";
import { createDefaultOutputOptions } from "./output-options";
import { planOutput } from "./output-plan";
import { prepareFontFromBuffer } from "./print-fonts";

function bananaGuide(): InstructionDocument {
  const doc = sequenceFixture();
  doc.steps[0].tokens = ["Grape", "Banana", "Potato", "Apple", "Simmer", "Bake", "Fry", "Fish"].map((label, index) => ({
    id: `picture-${index}`, category: "object", iconId: "object.banana", label,
  }));
  return doc;
}
function main(plan: OutputPlan, id: string) {
  const fragment = plan.pages.flatMap(page => page.fragments).find(fragment => fragment.kind === "symbol" && fragment.role === "token" && fragment.source.tokenId === id);
  if (!fragment || fragment.kind !== "symbol") throw new Error(`Missing main picture ${id}`);
  return fragment;
}
function box(fragment: OutputFragment) {
  if (fragment.kind === "connector") throw new Error("Expected a content box");
  return fragment.box;
}

describe("picture details around the centered printed picture", () => {
  it("keeps the complete authored label and its fixed lane when another picture gains details", async () => {
    const bytes = readFileSync("public/fonts/SourceSans3-Regular-3.052.ttf");
    const fonts = await prepareFontFromBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const doc = bananaGuide();
    doc.steps[0].tokens[0].label = "Prepare ingredients";
    const options = createDefaultOutputOptions(doc, "en"), plain = planOutput(doc, options, fonts);
    expect(plain.ok).toBe(true); if (!plain.ok) throw new Error(JSON.stringify(plain.issues));
    const before = plain.plan.pages.flatMap(page => page.fragments).filter(fragment => fragment.kind === "text" && fragment.role === "label" && fragment.source.tokenId === "picture-0");
    doc.steps[0].tokens[1].quantity = { iconId: "quantity.amount", amount: 5435, unit: "g", label: "" };
    const result = planOutput(doc, options, fonts);
    expect(result.ok).toBe(true); if (!result.ok) throw new Error(JSON.stringify(result.issues));
    const labels = result.plan.pages.flatMap(page => page.fragments).filter(fragment => fragment.kind === "text" && fragment.role === "label" && fragment.source.tokenId === "picture-0");
    expect(labels).toEqual(before);
    expect(labels.map(fragment => fragment.kind === "text" ? fragment.text : "").join("")).toBe("Prepare ingredients");
  });

  // Every field has a reserved zone, including the time beneath the icon.
  it.each(["sheet", "large", "card"] as const)("keeps short details around Banana without moving the next %s row down", async preset => {
    const bytes = readFileSync("public/fonts/SourceSans3-Regular-3.052.ttf");
    const fonts = await prepareFontFromBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const doc = bananaGuide();
    if (preset === "card") doc.steps[0].tokens = doc.steps[0].tokens.slice(0, 4);
    const options = createDefaultOutputOptions(doc, "en", preset);
    const plain = planOutput(doc, options, fonts);
    doc.steps[0].tokens[1].quantity = { iconId: "quantity.amount", amount: 5435, unit: "g", label: "" };
    doc.steps[0].tokens[1].warning = { iconId: "warning.sharp", label: "Sharp!" };
    doc.steps[0].tokens[1].time = { iconId: "time.duration", seconds: 543, label: "" };
    const detailed = planOutput(doc, options, fonts);
    expect(plain.ok).toBe(true); expect(detailed.ok).toBe(true);
    if (!plain.ok || !detailed.ok) throw new Error("Expected both guides to fit");
    const nextId = preset === "card" ? "picture-2" : "picture-4";
    const rowSpacing = (plan: OutputPlan) => main(plan, nextId).box.yMm - main(plan, "picture-0").box.yMm;
    expect(rowSpacing(detailed.plan)).toBeCloseTo(rowSpacing(plain.plan), 7);
    const banana = main(detailed.plan, "picture-1");
    const details = detailed.plan.pages.flatMap(page => page.fragments).filter(fragment => fragment.source.tokenId === "picture-1" && ["quantity", "warning", "time"].includes(fragment.role));
    expect(details.filter(fragment => fragment.kind === "symbol")).toHaveLength(3);
    expect(details.filter(fragment => fragment.role === "quantity").every(fragment => box(fragment).xMm + box(fragment).widthMm <= banana.box.xMm - 1)).toBe(true);
    expect(details.filter(fragment => fragment.role === "warning").every(fragment => box(fragment).xMm >= banana.box.xMm + banana.box.widthMm + 1)).toBe(true);
    expect(details.filter(fragment => fragment.role === "time").every(fragment => box(fragment).yMm > banana.box.yMm + banana.box.heightMm)).toBe(true);
    expect(details.filter(fragment => fragment.kind === "text" && fragment.role === "quantity").map(fragment => fragment.kind === "text" ? fragment.text : "").join("")).toBe("5435 g");
    expect(details.filter(fragment => fragment.kind === "text" && fragment.role === "warning").map(fragment => fragment.kind === "text" ? fragment.text : "").join("")).toBe("Sharp!");
    expect(details.filter(fragment => fragment.kind === "text" && fragment.role === "time").map(fragment => fragment.kind === "text" ? fragment.text : "").join("")).toBe("9m 3s");
  });

  // Required long warning text must wrap, never disappear into a fixed badge.
  it("reports a warning that exceeds A4's reserved zone and retains it completely on A3", async () => {
    const bytes = readFileSync("public/fonts/SourceSans3-Regular-3.052.ttf");
    const fonts = await prepareFontFromBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const doc = bananaGuide();
    doc.steps[0].tokens[1].warning = { iconId: "warning.sharp", label: "Keep fingers away from the sharp blade" };
    const before = structuredClone(doc);
    const small = planOutput(doc, createDefaultOutputOptions(doc, "en"), fonts);
    expect(small.ok).toBe(false);
    if (small.ok) throw new Error("Expected a fixed-zone warning overflow");
    expect(small.issues).toContainEqual(expect.objectContaining({ code: "overflow", source: { stepId: doc.steps[0].id, tokenId: "picture-1" }, params: expect.objectContaining({ field: "warning", content: "Keep fingers away from the sharp blade" }) }));
    expect(small.editorLayout?.pages.flatMap(page => page.groups.flatMap(group => group.pictures)).map(picture => picture.tokenId)).toEqual(doc.steps[0].tokens.map(token => token.id));
    expect(doc).toEqual(before);
    const result = planOutput(doc, createDefaultOutputOptions(doc, "en", "large"), fonts);
    expect(result.ok).toBe(true); if (!result.ok) throw new Error(JSON.stringify(result.issues));
    const banana = main(result.plan, "picture-1"), next = main(result.plan, "picture-2");
    const lines = result.plan.pages.flatMap(page => page.fragments).filter(fragment => fragment.kind === "text" && fragment.source.tokenId === "picture-1" && fragment.role === "warning");
    expect(lines.map(fragment => fragment.kind === "text" ? fragment.text : "").join("")).toBe("Keep fingers away from the sharp blade");
    for (const line of lines) {
      expect(box(line).xMm).toBeGreaterThan(banana.box.xMm + banana.box.widthMm);
      expect(box(line).xMm + box(line).widthMm).toBeLessThan(next.box.xMm);
    }
  });
});
