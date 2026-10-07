import { describe, expect, it } from "vitest";
import type { DurationAttachment, QuantityAttachment } from "../model/instruction";
import * as helpers from "./attachment-labels";

describe("display-only numeric attachment meaning", () => {
  it("retains a nonblank authored quantity label verbatim", () => {
    const quantity: QuantityAttachment = Object.freeze({ iconId: "quantity.amount", amount: 2, unit: "small cups", label: "  Authored amount — keep spacing  " });
    expect(helpers.getQuantityDisplayLabel(quantity)).toBe(quantity.label);
  });
  it("retains a nonblank authored duration label verbatim", () => {
    const duration: DurationAttachment = Object.freeze({ iconId: "time.duration", seconds: 60, label: "  Approximately one minute  " });
    expect(helpers.getDurationDisplayLabel(duration)).toBe(duration.label);
  });
  it("derives blank/whitespace quantity labels from amount and arbitrary unit without changing stored data", () => {
    for (const label of ["", " \t\n ", "\u00a0"]) {
      const quantity: QuantityAttachment = Object.freeze({ iconId: "quantity.amount", amount: 2, unit: "small cups & scoops", label });
      expect(helpers.getQuantityDisplayLabel(quantity)).toBe("2 small cups & scoops");
      expect(quantity.label).toBe(label); expect(quantity.unit).toBe("small cups & scoops");
    }
  });
  it("derives blank/whitespace durations using the existing duration format without changing stored data", () => {
    for (const label of ["", " \t\n ", "\u00a0"]) {
      const duration: DurationAttachment = Object.freeze({ iconId: "time.duration", seconds: 93784, label });
      expect(helpers.getDurationDisplayLabel(duration)).toBe("1d 2h 3m 4s");
      expect(duration.label).toBe(label); expect(duration.seconds).toBe(93784);
    }
  });
});
