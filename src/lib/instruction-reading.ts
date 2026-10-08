import type { InstructionDocument } from "../model/instruction";
import type { OutputMode, OutputContentGroup, OutputContentPicture } from "../model/output";
import type { AppLocale, ResolvedIcon } from "../model/library";
import { projectOutputContent } from "./output-content";
import { resolveIcon } from "./library-catalog";
import { getPictureLabel, getWarningPresentation } from "./instruction-presentation";
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
  quantityReferenceNotice?: string;
  timeReferenceNotice?: string;
}
export interface ReadingGroup extends Omit<OutputContentGroup, "pictures"> {
  pictures: readonly ReadingPicture[];
  timeReferenceNotice?: string;
}
export function toReadingGroups(doc: InstructionDocument, mode: OutputMode, locale: AppLocale): readonly ReadingGroup[] {
  return projectOutputContent(doc, mode).map((group) => ({ ...group,
    timeReferenceNotice: group.time && !resolveIcon(group.time.iconId).known ? t(locale, "catalog.reviewGroupTime", { iconId: group.time.iconId }) : undefined,
    pictures: group.pictures.map((picture) => {
    const warning = picture.warning && getWarningPresentation(picture.warning, locale, "screen");
    return { ...picture,
      accessibleName: getPictureLabel({ iconId: picture.iconId, label: picture.authoredLabel }, locale),
      icon: resolveIcon(picture.iconId),
      warningIcon: picture.warning && resolveIcon(picture.warning.iconId),
      warningMeaning: warning?.meaning,
      warningContext: warning?.text,
      reviewWarning: warning?.review ?? false,
      quantityDisplayLabel: picture.quantity && getQuantityDisplayLabel(picture.quantity),
      timeDisplayLabel: picture.time && getDurationDisplayLabel(picture.time),
      quantityReferenceNotice: picture.quantity && !resolveIcon(picture.quantity.iconId).known ? t(locale, "catalog.reviewQuantity", { iconId: picture.quantity.iconId }) : undefined,
      timeReferenceNotice: picture.time && !resolveIcon(picture.time.iconId).known ? t(locale, "catalog.reviewPictureTime", { iconId: picture.time.iconId }) : undefined,
    };
  }) }));
}
