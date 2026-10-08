import { describe, it, expect } from "vitest";
import { SAMPLE_TOKENS } from "../test/fixtures/sample-tokens";
import * as fixtures from "../test/fixtures/overhaul";

import * as api from "./library-catalog";

describe("canonical libraries", () => {
  it("retains all 84 kitchen legacy IDs, English labels, and order", () => {
    expect(SAMPLE_TOKENS).toHaveLength(84);
    const kitchen = api.getLibrary("kitchen");
    expect(kitchen.entries.slice(0, 84).map((entry: { iconId: string; labels: { en: string }; category: string }) =>
      ({ iconId: entry.iconId, label: entry.labels.en, category: entry.category }))).toEqual(SAMPLE_TOKENS);
    expect(kitchen.names).toEqual({ en: "Kitchen", de: "Küche" });
  });
  it("provides exact new inventories and canonical cross-library identity", () => {
    const routines = api.getLibrary("routines");
    const learning = api.getLibrary("learning");
    expect(routines.entries.slice(0, 24).map((entry: { iconId: string }) => entry.iconId)).toEqual([
      "routines.action.wash-hands", "routines.action.brush-teeth", "routines.action.dress", "routines.action.eat",
      "routines.action.drink", "routines.action.use-toilet", "routines.action.rest", "routines.action.clean-surface",
      "routines.action.put-away", "routines.action.collect", "routines.action.carry", "routines.action.bin-waste",
      "routines.object.soap", "routines.object.towel", "routines.object.toothbrush", "routines.object.clothes",
      "routines.object.cup", "routines.object.plate", "routines.object.chair", "routines.object.bed",
      "routines.tool.cleaning-cloth", "routines.tool.gloves", "routines.object.bin", "routines.object.toilet",
    ]);
    expect(learning.entries.slice(0, 24).map((entry: { iconId: string }) => entry.iconId)).toEqual([
      "learning.action.read", "learning.action.write", "learning.action.draw", "learning.action.paint", "learning.action.cut",
      "learning.action.glue", "learning.action.listen", "learning.action.speak", "learning.action.choose", "learning.action.count",
      "learning.action.play", "learning.action.tidy", "learning.object.book", "learning.tool.pencil", "learning.object.paper",
      "learning.tool.scissors", "learning.tool.glue", "learning.tool.paintbrush", "learning.object.blocks", "learning.object.desk",
      "learning.object.bag", "learning.object.ball", "learning.object.puzzle", "learning.object.quiet-space",
    ]);
    for (const id of ["kitchen", "routines", "learning"] as const) {
      const library = api.getLibrary(id);
      expect(new Set(library.entries.map((entry: { iconId: string }) => entry.iconId)).size).toBe(library.entries.length);
      for (const entry of library.entries) {
        expect(entry).toBe(api.getCatalogEntry(entry.iconId));
        expect(entry.labels).toEqual({ en: expect.any(String), de: expect.any(String) });
        expect(entry.aliases).toEqual({ en: expect.any(Array), de: expect.any(Array) });
      }
      expect(library.entries.filter((entry: { iconId: string }) => entry.iconId.startsWith("shared.action.")).map((entry: { iconId: string }) => entry.iconId))
        .toEqual(["shared.action.yes", "shared.action.no", "shared.action.more", "shared.action.finished", "shared.action.help", "shared.action.stop"]);
    }
    expect(api.getCatalogEntry("quantity.amount")?.labels).toEqual({ en: "Quantity", de: "Menge" });
    expect(api.getCatalogEntry("time.duration")?.labels).toEqual({ en: "Time", de: "Zeit" });
  });
  it("searches locale aliases, normalized words and stable category order", () => {
    const kitchen = api.getLibrary("kitchen");
    expect(api.findLibraryEntries(kitchen, " KÜHLEN ", "de").map((entry: { iconId: string }) => entry.iconId)).toEqual(["action.chill"]);
    expect(api.findLibraryEntries(kitchen, "kuhlen", "de").map((entry: { iconId: string }) => entry.iconId)).toEqual(["action.chill"]);
    expect(api.findLibraryEntries(kitchen, "refrigerator", "en", "tool").map((entry: { iconId: string }) => entry.iconId)).toEqual(["tool.fridge"]);
    expect(api.findLibraryEntries(kitchen, "refrigerator", "de")).toEqual([]);
    expect(api.findLibraryEntries(kitchen, "\t\n", "en", "object").map((entry: { iconId: string }) => entry.iconId))
      .toEqual(SAMPLE_TOKENS.filter((token) => token.category === "object").map((token) => token.iconId).concat("routines.object.bin"));
    expect(api.findLibraryEntries(api.getLibrary("routines"), "hand washing", "en").map((entry: { iconId: string }) => entry.iconId)).toEqual(["routines.action.wash-hands"]);
    expect(api.findLibraryEntries(kitchen, "no such picture", "en")).toEqual([]);
  });
  it("case-folds German sharp-s without changing selected-language filtering or source order", () => {
    const kitchen = api.getLibrary("kitchen");
    for (const query of ["HEISS", "heiß", "HEIẞ"]) {
      expect(api.findLibraryEntries(kitchen, query, "de", "warning").map((entry) => entry.iconId)).toEqual(["warning.hot"]);
      expect(api.findLibraryEntries(kitchen, query, "en")).toEqual([]);
      expect(api.findLibraryEntries(kitchen, query, "de", "action")).toEqual([]);
    }
    expect(api.findLibraryEntries(kitchen, "ẞ", "de").map((entry) => entry.iconId))
      .toEqual(["action.pour", "action.drain", "action.measure", "action.close", "object.water", "object.nuts", "tool.knife", "warning.hot"]);
    expect(api.findLibraryEntries(kitchen, "SS", "de", "action").map((entry) => entry.iconId))
      .toEqual(["action.pour", "action.drain", "action.measure", "action.close"]);
    expect(api.getCatalogEntry("warning.hot")?.labels.de).toBe("Heiß!");
  });
  it("names warnings independently of unknown picture artwork", () => {
    expect(api.getWarningMeaning({ iconId: "warning.sharp" }, "de")).toBe("Scharf!");
    expect(api.getWarningMeaning({ iconId: "custom", label: "  Authored warning  " }, "de")).toBe("  Authored warning  ");
    expect(api.getWarningMeaning({ iconId: "custom", label: " " }, "de")).toBe("Unbekannte Warnung (custom)");
    expect(api.getWarningMeaning({ iconId: "object.onion" }, "en")).toBe("Unknown warning (object.onion)");
  });
  it("resolves all known foundation fixture pictures and attachments", () => {
    for (const doc of [fixtures.sequenceFixture(), fixtures.boardFixture(), fixtures.mixedLibraryFixture(), fixtures.longGroupFixture(85), fixtures.unsupportedTextFixture()]) {
      for (const step of doc.steps) for (const token of step.tokens) {
        expect(api.resolveIcon(token.iconId).known).toBe(true);
        for (const attachment of [token.quantity, token.warning, token.time, step.time]) {
          if (attachment) expect(api.resolveIcon(attachment.iconId).known).toBe(true);
        }
      }
    }
    expect(api.resolveIcon("user-entered-unknown")).toMatchObject({ iconId: "user-entered-unknown", known: false, viewBox: "0 0 24 24", markup: expect.stringContaining("path") });
    for (const id of ["__proto__", "constructor", "toString"]) {
      expect(api.getCatalogEntry(id)).toBeUndefined();
      expect(api.resolveIcon(id)).toMatchObject({ iconId: id, known: false });
    }
  });
});
