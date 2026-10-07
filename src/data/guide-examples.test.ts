import { describe, expect, it } from "vitest";
import { migrate } from "../model/migrate";

import * as api from "./guide-examples";
import { resolveIcon } from "../lib/library-catalog";

describe("fresh localized example guides", () => {
  it("creates standalone fresh-ID sequence/board examples in either locale", () => {
    for (const id of ["prepare-onion", "ready-to-draw", "choose-activity"] as const) {
      const en = api.createExampleDocument(id, "en");
      const de = api.createExampleDocument(id, "de");
      expect(migrate(JSON.parse(JSON.stringify(de)))).toEqual(de);
      expect(en.meta.title).not.toBe(de.meta.title);
      expect(en.meta.presentation).toBe(id === "choose-activity" ? "board" : "sequence");
      expect(en.steps.map((step: { id: string }) => step.id)).not.toEqual(de.steps.map((step: { id: string }) => step.id));
      expect(en.steps).toHaveLength(id === "choose-activity" ? 2 : 3);
      expect(en).not.toHaveProperty("revision");
      const allIds = (doc: typeof en) => doc.steps.flatMap((step) => [step.id, ...step.tokens.map((token) => token.id)]);
      expect(allIds(en).some((id) => allIds(de).includes(id))).toBe(false);
      for (const doc of [en, de]) for (const step of doc.steps) for (const token of step.tokens) {
        expect(resolveIcon(token.iconId).known).toBe(true);
        expect(token.label?.trim()).not.toBe("");
        if (token.warning) expect(resolveIcon(token.warning.iconId).known).toBe(true);
      }
    }
  });
});
