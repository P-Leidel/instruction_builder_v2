import { describe, expect, it } from "vitest";
import { sequenceFixture, boardFixture } from "../test/fixtures/overhaul";
import type { OutputOptions } from "../model/output";
import * as api from "./output-options";

function normalized(doc: Parameters<typeof api.normalizeOutputOptions>[0], options: OutputOptions) {
  const result = api.normalizeOutputOptions(doc, options);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result;
}
describe("physical output options", () => {
  it("supplies content-independent fixed cell metrics and leaves label headings off by default", () => {
    const doc = sequenceFixture();
    const options = api.createDefaultOutputOptions(doc, "en");
    const plain = normalized(doc, options);
    doc.steps[0].tokens[0].warning = { iconId: "warning.sharp", label: "Long warning ".repeat(30) };
    expect(normalized(doc, options).cell).toEqual(plain.cell);
    expect(plain.cell).toMatchObject({ widthMm: 44, pictureBox: { widthMm: 15, heightMm: 15 } });
    const label = api.createDefaultOutputOptions(doc, "en", "label");
    expect(label.metadata).toMatchObject({ documentTitle: false, groupTitles: false, stepNumbers: false, totalTime: false });
    expect(normalized(doc, label).cell).toMatchObject({ widthMm: 46, heightMm: 25, pictureBox: { widthMm: 10, heightMm: 10 } });
  });

  it("normalizes preset orientation once and keeps the label-sheet page independent", async () => {
    const doc = sequenceFixture();
    for (const [preset, width, height] of [["label", 50, 30], ["card", 105, 148], ["sheet", 210, 297], ["large", 297, 420]] as const) {
      const options = api.createDefaultOutputOptions(doc, "de", preset);
      expect(normalized(doc, options).pageSize).toEqual({ widthMm: width, heightMm: height });
      options.orientation = "landscape";
      expect(normalized(doc, options).pageSize).toEqual({ widthMm: height, heightMm: width });
    }
    const options = api.createDefaultOutputOptions(doc, "en", "label");
    options.labelSheet = api.createDefaultLabelSheet();
    const result = normalized(doc, options);
    expect(result.pageSize).toEqual({ widthMm: 210, heightMm: 297 });
    expect(result.regions).toHaveLength(24);
    expect(result.regions[0]).toEqual({ xMm: 10, yMm: 10, widthMm: 50, heightMm: 30 });
    expect(result.regions[23]).toEqual({ xMm: 114, yMm: 234, widthMm: 50, heightMm: 30 });
  });

  it("captures defaults and selection in document order without editing a board", async () => {
    const doc = boardFixture();
    doc.steps.push({ id: "second", tokens: [] });
    const options = api.createDefaultOutputOptions(doc, "de"); options.selectedStepIds = [...options.selectedStepIds].reverse();
    options.metadata.stepNumbers = true; options.metadata.totalTime = true;
    const result = normalized(doc, options);
    expect(result.options.selectedStepIds).toEqual(["fixture-group-1", "second"]);
    expect(result.options.metadata.stepNumbers).toBe(false);
    expect(result.options.metadata.totalTime).toBe(false);
    expect(options.metadata.stepNumbers).toBe(true);
    expect(result.options.locale).toBe("de");
    expect(api.createDefaultOutputOptions(doc, "en", "label").metadata.documentTitle).toBe(false);
    expect(api.createDefaultOutputOptions(doc, "en", "large").metadata.documentTitle).toBe(true);
  });

  it("rejects invalid dimensions, selections, and impossible or irrelevant label grids", async () => {
    const doc = sequenceFixture(), defaults = api.createDefaultOutputOptions(doc, "en");
    const failures: Partial<OutputOptions>[] = [
      { selectedStepIds: [] }, { selectedStepIds: ["stale"] }, { selectedStepIds: [doc.steps[0].id, doc.steps[0].id] },
      { preset: "custom" }, { preset: "custom", customSize: { widthMm: NaN, heightMm: 100 } },
      { preset: "custom", customSize: { widthMm: 19, heightMm: 100 } },
      { preset: "custom", customSize: { widthMm: 1001, heightMm: 100 } },
      { labelSheet: api.createDefaultLabelSheet() },
      { preset: "label", labelSheet: { ...api.createDefaultLabelSheet(), rows: 9 } },
      { preset: "label", labelSheet: { ...api.createDefaultLabelSheet(), columns: 0 } },
      { preset: "label", labelSheet: { ...api.createDefaultLabelSheet(), gapMm: -1 } },
    ];
    for (const change of failures) expect(api.normalizeOutputOptions(doc, { ...defaults, ...change }).ok).toBe(false);
    for (const value of [20, 1000]) expect(api.normalizeOutputOptions(doc, { ...defaults, preset: "custom", customSize: { widthMm: value, heightMm: value } }).ok).toBe(true);
  });
});
