import { describe, expect, it } from "vitest";
import { migrate } from "../model/migrate";
import { sequenceFixture } from "../test/fixtures/overhaul";

import * as api from "./quantity-units";

describe("suggested quantity units", () => {
  it("provides bilingual suggestions independent of stored arbitrary units", () => {
    expect(api.getSuggestedUnits("kitchen", "en").map((unit: { value: string }) => unit.value)).toEqual(["g", "kg", "ml", "l", "tsp", "tbsp", "pinch", "pcs"]);
    expect(api.getSuggestedUnits("routines", "de")).toEqual([{ value: "pcs", label: "Stück" }]);
    expect(api.getSuggestedUnits("learning", "en")).toEqual([{ value: "pcs", label: "pcs (pieces)" }]);
    for (const unit of ["boxes", "Stück", "small cups"]) {
      const doc = sequenceFixture();
      doc.steps[0].tokens[0].quantity!.unit = unit;
      for (const library of ["kitchen", "routines", "learning"] as const) api.getSuggestedUnits(library, "de");
      expect(migrate(doc).steps[0].tokens[0].quantity?.unit).toBe(unit);
    }
  });
});
