import { describe, it, expect } from "vitest";
import { toReadingGroups } from "./instruction-reading";
import { sequenceFixture, boardFixture } from "../test/fixtures/overhaul";
describe("recipient reading", () => {
  it.each(["labels", "pictures", "detailed"] as const)("retains structured blank-label values in %s without changing stored fields", (mode) => {
    const doc = sequenceFixture(); const token = doc.steps[0].tokens[0];
    token.quantity = { iconId: "quantity.amount", label: "  ", amount: 4, unit: "custom scoops" };
    token.time = { iconId: "time.duration", label: "", seconds: 90 };
    const raw = structuredClone(doc); const picture = toReadingGroups(doc, mode, "en")[0].pictures[0];
    expect(picture.quantityDisplayLabel).toBe("4 custom scoops"); expect(picture.timeDisplayLabel).toBe("1m 30s");
    expect(picture.quantity?.label).toBe("  "); expect(picture.time?.label).toBe(""); expect(doc).toEqual(raw);
  });
  it("retains authored accessible names and structured attachments in Pictures-only", () => {
    const doc = sequenceFixture(); const source = doc.steps[0].tokens[0];
    source.label = "WWWWWWWWWWWWWWWWWW full authored label"; source.note = "Detailed note";
    source.quantity = { iconId: "quantity.amount", amount: 3, unit: "custom scoops", label: "3 custom scoops" };
    source.time = { iconId: "time.duration", seconds: 60, label: "1m" };
    source.warning = { iconId: "custom-warning", label: "Keep hands clear" };
    const picture = toReadingGroups(doc, "pictures", "de")[0].pictures[0];
    expect(picture).toMatchObject({ tokenId: source.id, accessibleName: source.label, quantity: source.quantity, time: source.time,
      warningMeaning: "Keep hands clear", warningContext: "Warnung: Keep hands clear", reviewWarning: true });
    expect(picture.label).toBeUndefined(); expect(picture.note).toBeUndefined();
    expect(picture.quantity).not.toBe(source.quantity);
  });
  it("uses the shared optional-text policy and named unknown warning context", () => {
    const doc = sequenceFixture(); doc.steps[0].description = "full description";
    doc.steps[0].tokens[0] = { id: "unknown", iconId: "custom-picture", category: "object", note: "full note", warning: { iconId: "object.onion" } };
    const detailed = toReadingGroups(doc, "detailed", "en")[0];
    expect(detailed.description).toBe("full description");
    expect(detailed.pictures[0]).toMatchObject({ accessibleName: "Unknown picture (custom-picture)", note: "full note", icon: { known: false },
      warningMeaning: "Unknown warning (object.onion)", warningContext: "Warning: Unknown warning (object.onion)", reviewWarning: true });
    expect(toReadingGroups(doc, "labels", "en")[0].description).toBeUndefined();
    doc.steps[0].tokens[0].label = "  "; doc.steps[0].tokens[0].iconId = "learning.object.book";
    expect(toReadingGroups(doc, "pictures", "de")[0].pictures[0].accessibleName).toBe("Buch");
  });
  it("keeps board source order while exposing explicit group time only", () => {
    const doc = boardFixture(); doc.steps[0].time = undefined;
    doc.steps[0].tokens[0].time = { iconId: "time.duration", seconds: 60, label: "1m" };
    const groups = toReadingGroups(doc, "pictures", "en");
    expect(groups.map((group) => group.stepId)).toEqual(doc.steps.map((group) => group.id));
    expect(groups[0].groupSeconds).toBeUndefined(); expect(groups[0].pictures[0].time?.seconds).toBe(60);
    doc.steps[0].time = { iconId: "time.duration", seconds: 120, label: "2m" };
    expect(toReadingGroups(doc, "labels", "en")[0].groupSeconds).toBe(120);
    doc.meta.presentation = "sequence"; doc.steps[0].time = undefined;
    for (const token of doc.steps[0].tokens.slice(1)) token.time = undefined;
    expect(toReadingGroups(doc, "labels", "en")[0].groupSeconds).toBe(60);
  });
});
