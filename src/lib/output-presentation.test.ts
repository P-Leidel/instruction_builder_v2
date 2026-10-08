import { describe, expect, it } from "vitest";
import type { OutputIssue } from "../model/output";
import { issueText, noticeText } from "./output-presentation";

describe("output issue and notice presentation", () => {
  it.each([
    ["invalid-options", "output.invalidOptions", "Check the selected groups and physical page settings.", "Prüfe die ausgewählten Gruppen und die physischen Seiteneinstellungen."],
    ["empty-selection", "output.emptySelection", "Select at least one group.", "Wähle mindestens eine Gruppe aus."],
    ["font-unavailable", "output.fontUnavailable", "The print font could not be loaded. Try again when installation is ready.", "Die Druckschrift konnte nicht geladen werden. Versuche es erneut, wenn die Installation bereit ist."],
    ["raster-limit", "output.rasterLimit", "This page exceeds the PNG pixel limit. Use SVG or PDF, or choose a smaller size.", "Diese Seite überschreitet das PNG-Pixellimit. Verwende SVG oder PDF oder wähle eine kleinere Größe."],
  ] as const)("localizes %s", (code, messageKey, en, de) => {
    expect(issueText({ code, messageKey }, "en")).toBe(en); expect(issueText({ code, messageKey }, "de")).toBe(de);
  });
  it("preserves missing-parameter fallbacks for general overflow and unsupported glyphs", () => {
    expect(issueText({ code: "overflow", messageKey: "output.overflow" }, "en")).toBe("Group does not fit Custom size. Choose a larger size or less content.");
    expect(issueText({ code: "overflow", messageKey: "output.overflow", params: { group: "  $&  ", format: "A4" } }, "de")).toBe("  $&   passt nicht auf A4. Wähle eine größere Größe oder weniger Inhalt.");
    expect(issueText({ code: "unsupported-glyph", messageKey: "output.unsupportedGlyph", params: { content: "vendor.<raw>-$&", codePoints: "U+65E5" } }, "en")).toBe("The print font cannot render “vendor.<raw>-$&” (U+65E5). Edit the text before downloading.");
    expect(issueText({ code: "unsupported-glyph", messageKey: "output.unsupportedGlyph" }, "de")).toBe("Die Druckschrift kann „“ () nicht darstellen. Bearbeite den Text vor dem Herunterladen.");
  });
  it.each([
    ["label", "Picture label", "Bildbeschriftung"], ["note", "Optional note", "Optionale Notiz"],
    ["quantity", "Quantity", "Menge"], ["warning", "Warning", "Warnung"], ["time", "Time", "Zeit"],
    ["heading", "Group title", "Gruppentitel"], ["description", "Optional description", "Optionale Beschreibung"],
    ["context", "Review before sharing", "Vor dem Teilen prüfen"], ["vendor.field", "vendor.field", "vendor.field"],
  ])("localizes the %s field without altering content", (field, en, de) => {
    const issue: OutputIssue = { code: "overflow", messageKey: "output.cellOverflow", source: { stepId: "g" }, params: { group: "Boil", format: "A4", field, content: "vendor.<raw>-$&" } };
    expect(issueText(issue, "en")).toBe(`In Boil, ${en} “vendor.<raw>-$&” does not fit the fixed picture space for A4. Shorten it or choose a larger format.`);
    expect(issueText(issue, "de")).toBe(`In Boil passt ${de} „vendor.<raw>-$&“ nicht in den festen Bildbereich für A4. Kürze den Text oder wähle ein größeres Format.`);
  });
  it("distinguishes document headings from group headings and retains empty cell parameters", () => {
    expect(issueText({ code: "overflow", messageKey: "output.cellOverflow", params: { field: "heading" } }, "en")).toBe("In , Guide title “” does not fit the fixed picture space for . Shorten it or choose a larger format.");
    expect(issueText({ code: "overflow", messageKey: "output.cellOverflow", params: { field: "heading" } }, "de")).toBe("In  passt Titel der Anleitung „“ nicht in den festen Bildbereich für . Kürze den Text oder wähle ein größeres Format.");
  });
  it("localizes both notice codes", () => {
    expect(noticeText({ code: "unknown-symbol", source: {}, messageKey: "output.unknownSymbolNotice" }, "en")).toBe("This picture is unknown. Review its label and meaning before sharing.");
    expect(noticeText({ code: "empty-group", source: { stepId: "g" }, messageKey: "output.emptyGroup" }, "de")).toBe("Diese Gruppe enthält keine Bilder.");
  });
});
