import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { OutputPlan, OutputPlanResult, PreparedFonts } from "../model/output";
import { sequenceFixture } from "../test/fixtures/overhaul";
import { createDefaultOutputOptions } from "./output-options";
import { planOutput } from "./output-plan";
import { prepareFontFromBuffer } from "./print-fonts";

let fonts: PreparedFonts;
beforeAll(async () => {
  const bytes = readFileSync("public/fonts/SourceSans3-Regular-3.052.ttf");
  fonts = await prepareFontFromBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
});
function success(result: OutputPlanResult): OutputPlan {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.plan;
}

describe("anchored pictogram layout", () => {
  it.each([
    ["sheet", "portrait"], ["sheet", "landscape"], ["card", "portrait"],
    ["large", "portrait"], ["custom", "portrait"], ["label", "portrait"], ["label", "landscape"],
  ] as const)("centers the pictogram in its %s %s tile independently of attachments", (preset, orientation) => {
    const doc = sequenceFixture();
    doc.steps[0].tokens = [{ id: "anchor", category: "object", iconId: "object.banana", label: "Banana" }];
    const options = createDefaultOutputOptions(doc, "en", preset); options.orientation = orientation;
    const plain = success(planOutput(doc, options, fonts));
    doc.steps[0].tokens[0].quantity = { iconId: "quantity.amount", amount: 5, unit: "g", label: "" };
    doc.steps[0].tokens[0].warning = { iconId: "warning.hot", label: "Hot" };
    doc.steps[0].tokens[0].time = { iconId: "time.duration", seconds: 25, label: "" };
    const attached = success(planOutput(doc, options, fonts));
    expect(attached.editorLayout).toEqual(plain.editorLayout);
    const metrics = attached.editorLayout!.cell;
    const lanes = [metrics.pictureBox, metrics.captionBox, metrics.quantityBox, metrics.detailBox, metrics.timeBox, metrics.noteBox];
    for (const [index, lane] of lanes.entries()) {
      expect(lane.xMm).toBeGreaterThanOrEqual(0); expect(lane.yMm).toBeGreaterThanOrEqual(0);
      expect(lane.xMm + lane.widthMm).toBeLessThanOrEqual(metrics.widthMm);
      expect(lane.yMm + lane.heightMm).toBeLessThanOrEqual(metrics.heightMm);
      for (const other of lanes.slice(index + 1)) {
        const overlapX = Math.min(lane.xMm + lane.widthMm, other.xMm + other.widthMm) - Math.max(lane.xMm, other.xMm);
        const overlapY = Math.min(lane.yMm + lane.heightMm, other.yMm + other.heightMm) - Math.max(lane.yMm, other.yMm);
        expect(overlapX <= 0 || overlapY <= 0, "Reserved zones must never overlap").toBe(true);
      }
    }
    for (const plan of [plain, attached]) {
      const cell = plan.editorLayout!.pages[0].groups[0].pictures[0].cellBox;
      const icon = plan.pages[0].fragments.find(fragment => fragment.kind === "symbol" && fragment.role === "token");
      if (!icon || icon.kind !== "symbol") throw new Error("Missing icon");
      expect(icon.box.xMm + icon.box.widthMm / 2).toBeCloseTo(cell.xMm + cell.widthMm / 2, 7);
      expect(icon.box.yMm + icon.box.heightMm / 2).toBeCloseTo(cell.yMm + cell.heightMm / 2, 7);
      expect(plan.editorLayout!.pages[0].groups[0].pictures[0].pictureBox).toEqual(icon.box);
    }
  });

  it("centers the complete time badge directly beneath the fixed icon", () => {
    const doc = sequenceFixture();
    doc.steps[0].tokens = [{ id: "timed", category: "object", iconId: "object.banana", label: "Banana", time: { iconId: "time.duration", seconds: 543, label: "" } }];
    const plan = success(planOutput(doc, createDefaultOutputOptions(doc, "en"), fonts));
    const fragments = plan.pages[0].fragments.filter(fragment => fragment.source.tokenId === "timed");
    const icon = fragments.find(fragment => fragment.kind === "symbol" && fragment.role === "token");
    const clock = fragments.find(fragment => fragment.kind === "symbol" && fragment.role === "time");
    const duration = fragments.find(fragment => fragment.kind === "text" && fragment.role === "time");
    if (!icon || icon.kind !== "symbol" || !clock || clock.kind !== "symbol" || !duration || duration.kind !== "text") throw new Error("Missing timed picture");
    expect(duration.text).toBe("9m 3s");
    expect(clock.box.yMm).toBeGreaterThan(icon.box.yMm + icon.box.heightMm);
    expect(clock.box.yMm - icon.box.yMm - icon.box.heightMm).toBeLessThanOrEqual(2);
    expect(duration.box.yMm).toBeGreaterThan(icon.box.yMm + icon.box.heightMm);
    const paintedRight = duration.box.xMm + fonts.measureWidthMm(duration.text, duration.fontSizePt);
    expect((clock.box.xMm + paintedRight) / 2).toBeCloseTo(icon.box.xMm + icon.box.widthMm / 2, 7);
  });

  it("routes the row wrap from cell bottom center to the next cell top center through the gap", () => {
    const doc = sequenceFixture();
    doc.steps[0].tokens = Array.from({ length: 9 }, (_, index) => ({ id: `route-${index}`, category: "object", iconId: "object.banana", label: "Banana" }));
    const options = createDefaultOutputOptions(doc, "en");
    const plan = success(planOutput(doc, options, fonts));
    const wraps = plan.pages[0].fragments.filter(fragment => fragment.kind === "connector" && fragment.from.xMm > fragment.to.xMm);
    expect(wraps).toHaveLength(2);
    expect(wraps[0]).toMatchObject({ from: { xMm: 176, yMm: 106 }, to: { xMm: 32, yMm: 110 }, via: [{ xMm: 176, yMm: 108 }, { xMm: 32, yMm: 108 }] });
    const before = structuredClone(doc);
    doc.steps[0].tokens[3].time = { iconId: "time.duration", seconds: 60, label: "" };
    const after = success(planOutput(doc, options, fonts));
    expect(after.editorLayout).toEqual(plan.editorLayout);
    expect(after.pages[0].fragments.filter(fragment => fragment.kind === "connector")).toEqual(plan.pages[0].fragments.filter(fragment => fragment.kind === "connector"));
    expect(doc.steps[0].tokens[3].label).toBe(before.steps[0].tokens[3].label);
    doc.meta.presentation = "board";
    expect(success(planOutput(doc, options, fonts)).pages.flatMap(page => page.fragments).some(fragment => fragment.kind === "connector")).toBe(false);
  });
});
