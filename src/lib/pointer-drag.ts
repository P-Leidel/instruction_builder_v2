/** Pixels of deliberate movement before the live editor starts a drag. */
export const MOUSE_DRAG_THRESHOLD = 6;
export const TOUCH_DRAG_THRESHOLD = 12;

/** Touch tolerates more contact wobble; mouse, pen and unknown types use 6px. */
export function dragThresholdFor(pointerType: string): number {
  return pointerType === "touch" ? TOUCH_DRAG_THRESHOLD : MOUSE_DRAG_THRESHOLD;
}
