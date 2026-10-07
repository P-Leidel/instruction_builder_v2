import type { InstructionDocument } from "../model/instruction";
import type { OutputMode, OutputContentGroup, OutputContentPicture } from "../model/output";
import type { AppLocale, ResolvedIcon } from "../model/library";
import { projectOutputContent } from "./output-content";
import { getCatalogEntry, getWarningMeaning, resolveIcon } from "./library-catalog";
import { t } from "../i18n/messages";
import { getQuantityDisplayLabel, getDurationDisplayLabel } from "./attachment-labels";
export interface ReadingPicture extends OutputContentPicture {
  accessibleName: string;
  icon: ResolvedIcon;
  warningIcon?: ResolvedIcon;
  warningMeaning?: string;
  warningContext?: string;
  reviewWarning: boolean;
  quantityDisplayLabel?: string;
  timeDisplayLabel?: string;
}
export interface ReadingGroup extends Omit<OutputContentGroup, "pictures"> { pictures: readonly ReadingPicture[] }
export function toReadingGroups(doc: InstructionDocument, mode: OutputMode, locale: AppLocale): readonly ReadingGroup[] {
  return projectOutputContent(doc, mode).map((group) => ({ ...group, pictures: group.pictures.map((picture) => {
    const meaning = picture.warning && getWarningMeaning(picture.warning, locale);
    return { ...picture,
      accessibleName: picture.authoredLabel?.trim() ? picture.authoredLabel : getCatalogEntry(picture.iconId)?.labels[locale] ?? t(locale, "catalog.unknownSymbol", { iconId: picture.iconId }),
      icon: resolveIcon(picture.iconId),
      warningIcon: picture.warning && resolveIcon(picture.warning.iconId),
      warningMeaning: meaning,
      warningContext: meaning === undefined ? undefined : t(locale, "reader.warning", { meaning }),
      reviewWarning: !!picture.warning && getCatalogEntry(picture.warning.iconId)?.category !== "warning",
      quantityDisplayLabel: picture.quantity && getQuantityDisplayLabel(picture.quantity),
      timeDisplayLabel: picture.time && getDurationDisplayLabel(picture.time),
    };
  }) }));
}
