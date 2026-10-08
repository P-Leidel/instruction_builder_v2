import type { InstructionDocument, TokenAttachment } from "../model/instruction";
import type { AppLocale } from "../model/library";
import { t } from "../i18n/messages";
import { getCatalogEntry, getWarningMeaning, resolveIcon } from "./library-catalog";

export type GroupLabelContext =
  | { kind: "editor" | "authoring" | "reader"; presentation: InstructionDocument["meta"]["presentation"]; number: number }
  | { kind: "issue" }
  | { kind: "print"; number: number; groupTitles: boolean; stepNumbers: boolean; continued: boolean };

/** Callers supply the one-based number from their original or filtered order. */
export function getGroupLabel(title: string | undefined, locale: AppLocale, context: GroupLabelContext): string {
  switch (context.kind) {
    case "editor":
      return context.presentation === "sequence" ? t(locale, "output.sequenceGroup", { number: context.number, title: title ?? "" }) : title || t(locale, "editor.groupNumber", { number: context.number });
    case "authoring":
      return title || t(locale, context.presentation === "board" ? "editor.groupNumber" : "editor.stepNumber", { number: context.number });
    case "reader":
      return title || (context.presentation === "board" ? t(locale, "output.groupContext") : t(locale, "editor.stepNumber", { number: context.number }));
    case "issue":
      return title || t(locale, "output.groupContext");
    case "print": {
      let label = context.groupTitles ? title || "" : "";
      if (context.stepNumbers) label = t(locale, "output.sequenceGroup", { number: context.number, title: label });
      return context.continued ? t(locale, "output.continuedGroup", { group: label || getGroupLabel(title, locale, { kind: "issue" }) }) : label;
    }
  }
}

export function getPictureLabel(picture: { iconId: string; label?: string }, locale: AppLocale): string {
  return picture.label?.trim() ? picture.label : getCatalogEntry(picture.iconId)?.labels[locale] ?? t(locale, "catalog.unknownSymbol", { iconId: picture.iconId });
}

/** Screen review checks meaning; physical output also requires bundled artwork. */
export function getWarningPresentation(warning: TokenAttachment, locale: AppLocale, context: "screen" | "print"): { meaning: string; text: string; review: boolean } {
  const meaning = getWarningMeaning(warning, locale);
  const review = getCatalogEntry(warning.iconId)?.category !== "warning" || (context === "print" && !resolveIcon(warning.iconId).known);
  const text = context === "screen" ? t(locale, "reader.warning", { meaning }) : review ? t(locale, "output.warningContext", { meaning }) : meaning;
  return { meaning, text, review };
}
