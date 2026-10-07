import type { DurationAttachment, QuantityAttachment } from "../model/instruction";
import { formatDuration } from "./duration";

/** Display-only recovery: preserve authored labels and stored numeric fields. */
export function getQuantityDisplayLabel(attachment: QuantityAttachment): string {
  return attachment.label.trim() ? attachment.label : `${attachment.amount} ${attachment.unit}`;
}

export function getDurationDisplayLabel(attachment: DurationAttachment): string {
  return attachment.label.trim() ? attachment.label : formatDuration(attachment.seconds);
}
