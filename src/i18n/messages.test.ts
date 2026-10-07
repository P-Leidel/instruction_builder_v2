import { describe, expect, it } from "vitest";
import { t, type MessageKey } from "./messages";
import { en } from "./en";
import { de } from "./de";

describe("whole-message localization", () => {
  it("interpolates explicit locales without interpreting user text as HTML or replacement syntax", () => {
    expect(t("de", "editor.addPicture")).toBe("Bild hinzufügen");
    expect(t("de", "catalog.noResults", { query: "<Zwiebeln> $&" })).toBe("Keine Bilder für „<Zwiebeln> $&“ gefunden.");
    expect(t("en", "output.overflow", { group: "Onion", format: "A4" })).toBe("Onion does not fit A4. Choose a larger size or less content.");
    expect(t("de", "guide.copyTitle", { title: "Zwiebeln" })).toBe("Zwiebeln (Kopie)");
    expect(t("de", "editor.removeGroupConfirm", { group: "Öl & Gemüse", count: 20 })).toBe("Öl & Gemüse mit 20 Bildern entfernen? Rückgängig stellt sie wieder her.");
    expect(t("en", "output.sheetUsage", { used: 25, capacity: 24, pages: 2 })).toBe("Selected groups: 25. Cells per sheet: 24. Sheets: 2.");
    expect(t("de", "output.downloadPngPage", { number: 2, total: 3, dpi: 300 })).toBe("PNG-Seite 2 von 3 mit 300 dpi herunterladen");
  });
  it("ships equal complete key sets and matching placeholders", () => {
    expect(en).toBeDefined();
    expect(de).toBeDefined();
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
    for (const key of Object.keys(en) as MessageKey[]) {
      const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
      expect(placeholders(en[key])).toEqual(placeholders(de[key]));
    }
  });

  it("requires exact message keys and parameter types at compilation", () => {
    // eslint-disable-next-line no-constant-condition -- compile-only negative call fixtures
    if (false) {
      // @ts-expect-error Unknown keys are not accepted.
      t("en", "not.a.message");
      // @ts-expect-error A parameterized message requires its complete params.
      t("de", "output.overflow");
      // @ts-expect-error Numeric placeholders are typed as numbers.
      t("de", "output.sequenceGroup", { number: "two", title: "Group" });
      // @ts-expect-error No parameter object is accepted for a parameterless key.
      t("en", "editor.addPicture", {});
    }
    expect(t("de", "output.sequenceGroup", { number: 2, title: "Öl & Gemüse" })).toBe("Schritt 2: Öl & Gemüse");
  });
});
