import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "../model/instruction";
import { projectOutputContent } from "./output-content";
import type { OutputMode } from "../model/output";

describe("shared output projection", () => {
  it("projectionSelectsOptionalText", () => {
    const doc = createEmptyDocument();
    doc.steps = [{ id: "group", title: "", description: "Description", tokens: [{
      id: "picture", category: "object", iconId: "unknown", label: "", note: "Optional note",
      quantity: { iconId: "q", label: "2 cups", amount: 2, unit: "cups" },
      warning: { iconId: "warning", label: "Careful" },
      time: { iconId: "clock", label: "5m", seconds: 300 },
    }] }];
    for (const mode of ["labels", "pictures", "detailed"] as OutputMode[]) {
      const groups = projectOutputContent(doc, mode);
      expect(groups).toHaveLength(1);
      expect(groups[0]).toMatchObject({ stepId: "group", title: "", groupSeconds: 300 });
      const picture = groups[0].pictures[0];
      expect(picture).toMatchObject({ tokenId: "picture", iconId: "unknown", authoredLabel: "",
        quantity: { iconId: "q", label: "2 cups", amount: 2, unit: "cups" },
        warning: { iconId: "warning", label: "Careful" }, time: { iconId: "clock", label: "5m", seconds: 300 },
      });
      expect(picture.label).toBe(mode === "pictures" ? undefined : "");
      expect(picture.note).toBe(mode === "detailed" ? "Optional note" : undefined);
      expect(groups[0].description).toBe(mode === "detailed" ? "Description" : undefined);
      expect(groups).not.toBe(doc.steps);
      expect(groups[0].pictures).not.toBe(doc.steps[0].tokens);
      for (const kind of ["quantity", "warning", "time"] as const) {
        expect(picture[kind]).not.toBe(doc.steps[0].tokens[0][kind]);
      }
    }
  });

  it("boardDoesNotSumTimedAlternatives", () => {
    const doc = createEmptyDocument();
    doc.meta = { ...doc.meta, presentation: "board" };
    doc.steps = [{ id: "choices", tokens: [300, 600].map((seconds, index) => ({
      id: `choice-${index}`, iconId: "object", category: "object", time: { iconId: "clock", label: `${seconds / 60}m`, seconds },
    })) }];
    expect(projectOutputContent(doc, "labels")[0].groupSeconds).toBeUndefined();
    doc.steps[0].time = { iconId: "clock", label: "2m", seconds: 120 };
    expect(projectOutputContent(doc, "labels")[0]).toMatchObject({ groupSeconds: 120, time: doc.steps[0].time });
    doc.meta.presentation = "sequence";
    expect(projectOutputContent(doc, "labels")[0].groupSeconds).toBe(120);
    delete doc.steps[0].time;
    expect(projectOutputContent(doc, "labels")[0].groupSeconds).toBe(900);
  });

  it("preserves absent and explicitly empty authored text without sharing attachment objects", () => {
    const doc = createEmptyDocument();
    doc.steps = [{ id: "group", description: "", time: { iconId: "clock", label: "1m", seconds: 60 }, tokens: [
      { id: "empty", iconId: "unknown", category: "object", label: "", note: "",
        quantity: { iconId: "q", label: "2 custom units", amount: 2, unit: "custom units" },
        warning: { iconId: "unknown-warning" }, time: { iconId: "clock", label: "5m", seconds: 300 } },
      { id: "absent", iconId: "unknown", category: "object" },
    ] }];
    const group = projectOutputContent(doc, "detailed")[0];
    expect(group.description).toBe("");
    expect(group.pictures[0]).toMatchObject({ authoredLabel: "", label: "", note: "" });
    expect(group.pictures[1].label).toBeUndefined();
    expect(group.pictures[1].authoredLabel).toBeUndefined();
    group.time!.seconds = 120;
    group.pictures[0].quantity!.unit = "changed";
    group.pictures[0].warning!.label = "changed";
    group.pictures[0].time!.seconds = 600;
    expect(doc.steps[0].time?.seconds).toBe(60);
    expect(doc.steps[0].tokens[0].quantity?.unit).toBe("custom units");
    expect(doc.steps[0].tokens[0].warning?.label).toBeUndefined();
    expect(doc.steps[0].tokens[0].time?.seconds).toBe(300);
    expect(projectOutputContent(doc, "pictures")[0].pictures[0]).not.toHaveProperty("label");
    expect(projectOutputContent(doc, "labels")[0]).not.toHaveProperty("description");
  });
});
