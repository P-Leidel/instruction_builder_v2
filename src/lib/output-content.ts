import type { InstructionDocument } from "../model/instruction";
import type { OutputContentGroup, OutputMode } from "../model/output";
import { stepDisplayedTime } from "./duration";

export type { OutputContentGroup, OutputContentPicture } from "../model/output";

/** The shared visible/accessible content policy for readers and physical output. */
export function projectOutputContent(doc: InstructionDocument, mode: OutputMode): readonly OutputContentGroup[] {
  return doc.steps.map((step) => ({
    stepId: step.id,
    title: step.title,
    ...(mode === "detailed" ? { description: step.description } : {}),
    time: step.time === undefined ? undefined : { ...step.time },
    groupSeconds: (doc.meta.presentation === "board" ? step.time : stepDisplayedTime(step))?.seconds,
    pictures: step.tokens.map((token) => ({
      tokenId: token.id,
      iconId: token.iconId,
      authoredLabel: token.label,
      ...(mode === "pictures" ? {} : { label: token.label }),
      ...(mode === "detailed" ? { note: token.note } : {}),
      quantity: token.quantity === undefined ? undefined : { ...token.quantity },
      warning: token.warning === undefined ? undefined : { ...token.warning },
      time: token.time === undefined ? undefined : { ...token.time },
    })),
  }));
}
