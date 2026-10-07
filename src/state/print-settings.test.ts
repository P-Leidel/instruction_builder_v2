import { describe, it, expect } from "vitest";
import { createEmptyDocument } from "../model/instruction";
import { createPrintSettingsStore } from "./print-settings";

describe("shared per-guide print choices", () => {
  it("defaults to A4 portrait and isolates choices between guides", () => {
    const store = createPrintSettingsStore(), doc = createEmptyDocument();
    const defaults = store.getOptions(doc, "one", "en");
    expect(defaults).toMatchObject({ preset: "sheet", orientation: "portrait" });
    store.setOptions(doc, "one", { ...defaults, preset: "large", orientation: "landscape" });
    expect(store.getOptions(doc, "one", "en")).toMatchObject({ preset: "large", orientation: "landscape" });
    expect(store.getOptions(doc, "two", "en")).toMatchObject({ preset: "sheet", orientation: "portrait" });
  });
  it("includes new groups when all were selected and preserves an explicit subset", () => {
    const store = createPrintSettingsStore(), doc = createEmptyDocument();
    store.setOptions(doc, "guide", store.getOptions(doc, "guide", "en"));
    const next = { ...doc, steps: [...doc.steps, { id: "second", tokens: [] }] };
    expect(store.getOptions(next, "guide", "en").selectedStepIds).toEqual([doc.steps[0].id, "second"]);
    store.setOptions(next, "guide", { ...store.getOptions(next, "guide", "en"), selectedStepIds: ["second"] });
    const added = { ...next, steps: [...next.steps, { id: "third", tokens: [] }] };
    expect(store.getOptions(added, "guide", "en").selectedStepIds).toEqual(["second"]);
    expect(store.getOptions({ ...added, steps: [added.steps[2]] }, "guide", "en").selectedStepIds).toEqual([]);
  });
  it("shares metadata/custom dimensions without mutating inputs or authored content", () => {
    const store = createPrintSettingsStore(), doc = createEmptyDocument(), before = structuredClone(doc);
    const options = { ...store.getOptions(doc, "guide", "en"), preset: "custom" as const, customSize: { widthMm: 220, heightMm: 310 }, metadata: { documentTitle: false, groupTitles: true, stepNumbers: false, totalTime: false } };
    store.setOptions(doc, "guide", options); options.customSize.widthMm = 999;
    const read = store.getOptions(doc, "guide", "de");
    expect(read).toMatchObject({ locale: "de", preset: "custom", customSize: { widthMm: 220, heightMm: 310 }, metadata: options.metadata });
    read.metadata.groupTitles = false;
    expect(store.getOptions(doc, "guide", "en").metadata.groupTitles).toBe(true);
    expect(doc).toEqual(before);
  });
});
