import { describe, expect, it } from "vitest";
import { migrate } from "../../model/migrate";
import * as fixtures from "./overhaul";

describe("overhaul fixture consumers", () => {
  it("uses canonical known artwork IDs and categories for integration fixtures", () => {
    const sequence = fixtures.sequenceFixture();
    expect(sequence.steps[0].tokens).toMatchObject([
      { iconId: "action.chop", category: "action",
        quantity: { iconId: "quantity.amount" }, warning: { iconId: "warning.sharp" }, time: { iconId: "time.duration" } },
      { iconId: "object.onion", category: "object" },
    ]);
    expect(fixtures.boardFixture().steps[0].tokens).toMatchObject([
      { iconId: "learning.object.book", category: "object", time: { iconId: "time.duration" } },
      { iconId: "learning.action.play", category: "action", time: { iconId: "time.duration" } },
    ]);
    expect(fixtures.mixedLibraryFixture().steps[0].tokens).toMatchObject([
      { iconId: "object.onion", category: "object" },
      { iconId: "routines.action.wash-hands", category: "action" },
      { iconId: "learning.object.book", category: "object" },
    ]);
    expect(fixtures.longGroupFixture(85).steps[0].tokens.every((token) =>
      token.iconId === "object.onion" && token.category === "object")).toBe(true);
    expect(fixtures.unsupportedTextFixture().steps[0].tokens[0]).toMatchObject({
      iconId: "action.chop", category: "action",
      quantity: { iconId: "quantity.amount" }, warning: { iconId: "warning.sharp" }, time: { iconId: "time.duration" },
    });
  });

  it("provides fresh deterministic documents covering output stress cases", () => {
    const sequence = fixtures.sequenceFixture();
    expect(migrate(sequence)).toEqual(sequence);
    const picture = sequence.steps[0].tokens[0];
    expect(picture).toMatchObject({ note: expect.any(String), warning: expect.any(Object),
      quantity: { amount: 2, unit: "cups" }, time: { seconds: 300 } });
    sequence.steps[0].tokens[0].label = "changed";
    expect(fixtures.sequenceFixture().steps[0].tokens[0].label).not.toBe("changed");
    expect(fixtures.sequenceFixture()).toEqual(fixtures.sequenceFixture());
    const board = fixtures.boardFixture();
    expect(migrate(board)).toEqual(board);
    expect(board.meta.presentation).toBe("board");
    expect(board.steps[0].time).toBeUndefined();
    expect(board.steps[0].tokens.map((token) => token.time?.seconds)).toEqual([300, 600]);
    for (const count of [20, 85]) {
      const long = fixtures.longGroupFixture(count);
      expect(long.steps[0].tokens).toHaveLength(count);
      expect(new Set(long.steps[0].tokens.map((token) => token.id)).size).toBe(count);
      expect(migrate(long)).toEqual(long);
      expect(long.steps[0].tokens[0].label).toContain("Gemüse");
    }
    expect(fixtures.mixedLibraryFixture().steps[0].tokens.map((token) => token.iconId))
      .toEqual(["object.onion", "routines.action.wash-hands", "learning.object.book"]);
    expect(fixtures.unsupportedTextFixture().steps[0].tokens[0].label).toContain("日本語");
  });
});
