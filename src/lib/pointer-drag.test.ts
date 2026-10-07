import { describe, it, expect } from "vitest";
import {
  dragThresholdFor,
  MOUSE_DRAG_THRESHOLD,
  TOUCH_DRAG_THRESHOLD,
} from "./pointer-drag";

describe("dragThresholdFor", () => {
  it("gives touch a higher bar than mouse or pen", () => {
    expect(dragThresholdFor("touch")).toBe(TOUCH_DRAG_THRESHOLD);
    expect(dragThresholdFor("mouse")).toBe(MOUSE_DRAG_THRESHOLD);
    expect(dragThresholdFor("pen")).toBe(MOUSE_DRAG_THRESHOLD);
    expect(TOUCH_DRAG_THRESHOLD).toBeGreaterThan(MOUSE_DRAG_THRESHOLD);
  });

  it("falls back to the mouse threshold for an unknown pointer type", () => {
    expect(dragThresholdFor("")).toBe(MOUSE_DRAG_THRESHOLD);
  });
});
