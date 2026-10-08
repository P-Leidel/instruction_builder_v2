import { afterEach, describe, expect, it, vi } from "vitest";
import { getGroupLabel, getPictureLabel, getWarningPresentation } from "./instruction-presentation";
import * as catalog from "./library-catalog";
import { toReadingGroups } from "./instruction-reading";
import { sequenceFixture } from "../test/fixtures/overhaul";

afterEach(() => vi.restoreAllMocks());
describe("instruction presentation contexts", () => {
  it.each([
    ["en", "Step 1: Boil", "Step 1", "Group 1", "Group"],
    ["de", "Schritt 1: Boil", "Schritt 1", "Gruppe 1", "Gruppe"],
  ] as const)("keeps editor, authoring and reader names distinct in %s", (locale, editor, step, numberedGroup, group) => {
    expect(getGroupLabel("Boil", locale, { kind: "editor", presentation: "sequence", number: 1 })).toBe(editor);
    expect(getGroupLabel("Boil", locale, { kind: "reader", presentation: "sequence", number: 1 })).toBe("Boil");
    expect(getGroupLabel("Boil", locale, { kind: "authoring", presentation: "sequence", number: 1 })).toBe("Boil");
    expect(getGroupLabel(undefined, locale, { kind: "reader", presentation: "sequence", number: 1 })).toBe(step);
    expect(getGroupLabel(undefined, locale, { kind: "authoring", presentation: "board", number: 1 })).toBe(numberedGroup);
    expect(getGroupLabel(undefined, locale, { kind: "editor", presentation: "board", number: 1 })).toBe(numberedGroup);
    expect(getGroupLabel(undefined, locale, { kind: "reader", presentation: "board", number: 1 })).toBe(group);
    expect(getGroupLabel(undefined, locale, { kind: "issue" })).toBe(group);
  });
  it("preserves whitespace titles in every authored-title context", () => {
    for (const kind of ["editor", "authoring", "reader"] as const) {
      expect(getGroupLabel(" \t ", "en", { kind, presentation: "board", number: 3 })).toBe(" \t ");
    }
    expect(getGroupLabel(" \t ", "en", { kind: "issue" })).toBe(" \t ");
    expect(getGroupLabel(" \t ", "en", { kind: "editor", presentation: "sequence", number: 3 })).toBe("Step 3:  \t ");
  });
  it("uses metadata and original one-based numbers for print, including continuation fallback", () => {
    const print = { kind: "print", number: 4, groupTitles: false, stepNumbers: false, continued: false } as const;
    expect(getGroupLabel("Boil", "en", print)).toBe("");
    expect(getGroupLabel("Boil", "en", { ...print, stepNumbers: true })).toBe("Step 4: ");
    expect(getGroupLabel("Boil", "de", { ...print, groupTitles: true, stepNumbers: true })).toBe("Schritt 4: Boil");
    expect(getGroupLabel("Boil", "en", { ...print, continued: true })).toBe("Boil (continued)");
    expect(getGroupLabel(undefined, "de", { ...print, continued: true })).toBe("Gruppe (Fortsetzung)");
    expect(getGroupLabel(" \t ", "en", { ...print, groupTitles: true })).toBe(" \t ");
  });
  it.each(["en", "de"] as const)("keeps exact authored picture text and full unknown IDs in %s", locale => {
    const picture = { iconId: "vendor.<raw>-$&", label: "  Authored $& <text>  " };
    expect(getPictureLabel(picture, locale)).toBe("  Authored $& <text>  ");
    picture.label = " \t ";
    expect(getPictureLabel(picture, locale)).toBe(locale === "en" ? "Unknown picture (vendor.<raw>-$&)" : "Unbekanntes Bild (vendor.<raw>-$&)");
    expect(picture.label).toBe(" \t ");
    expect(getPictureLabel({ iconId: "object.onion", label: "  " }, locale)).toBe(locale === "en" ? "Onion" : "Zwiebel");
  });
  it("composes reading labels without introducing a Pictures-only caption or changing stored whitespace", () => {
    const doc = sequenceFixture(); doc.steps[0].tokens[0].label = " \t ";
    const before = structuredClone(doc), picture = toReadingGroups(doc, "pictures", "de")[0].pictures[0];
    expect(picture.accessibleName).toBe("Hacken"); expect(picture.label).toBeUndefined(); expect(doc).toEqual(before);
  });
  it("keeps known screen warnings contextual and known print warnings concise", () => {
    const warning = { iconId: "warning.sharp", label: "  Keep clear  " };
    expect(getWarningPresentation(warning, "en", "screen")).toEqual({ meaning: "  Keep clear  ", text: "Warning:   Keep clear  ", review: false });
    expect(getWarningPresentation(warning, "en", "print")).toEqual({ meaning: "  Keep clear  ", text: "  Keep clear  ", review: false });
    expect(getWarningPresentation({ iconId: "vendor.<raw>-$&" }, "de", "print")).toEqual({ meaning: "Unbekannte Warnung (vendor.<raw>-$&)", text: "Warnung: Unbekannte Warnung (vendor.<raw>-$&)", review: true });
    expect(getWarningPresentation({ iconId: "object.onion" }, "en", "screen")).toEqual({ meaning: "Unknown warning (object.onion)", text: "Warning: Unknown warning (object.onion)", review: true });
  });
  it("requires artwork for print review while screen review checks warning category", () => {
    vi.spyOn(catalog, "resolveIcon").mockReturnValue({ iconId: "warning.sharp", known: false, markup: "", viewBox: "0 0 24 24" });
    const warning = { iconId: "warning.sharp", label: "Keep clear" };
    expect(getWarningPresentation(warning, "en", "screen")).toEqual({ meaning: "Keep clear", text: "Warning: Keep clear", review: false });
    expect(getWarningPresentation(warning, "en", "print")).toEqual({ meaning: "Keep clear", text: "Warning: Keep clear", review: true });
  });
});
