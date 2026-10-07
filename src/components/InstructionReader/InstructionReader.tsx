import type { InstructionDocument } from "../../model/instruction";
import type { AppLocale } from "../../model/library";
import type { OutputMode } from "../../model/output";
import { useState } from "preact/hooks";
import { toReadingGroups, type ReadingGroup } from "../../lib/instruction-reading";
import { getQuantityDisplayLabel, getDurationDisplayLabel } from "../../lib/attachment-labels";
import { formatDuration } from "../../lib/duration";
import { t } from "../../i18n/messages";
import { Icon } from "../Icon/Icon";
export function InstructionReader({ document, locale, onBack }: { document: InstructionDocument; locale: AppLocale; onBack: () => void }) {
  const [mode, setMode] = useState<OutputMode>("labels"); const groups = toReadingGroups(document, mode, locale); const board = document.meta.presentation === "board";
  return <section class="reader" aria-label={t(locale, "reader.title")}>
    <div class="reader__controls"><button type="button" onClick={onBack}>{t(locale, "reader.backToEditing")}</button>
      <label>{t(locale, "reader.contentMode")}<select value={mode} onChange={(event) => setMode(event.currentTarget.value as OutputMode)}>
        {(["labels", "pictures", "detailed"] as const).map((value) => <option value={value}>{t(locale, `output.${value}`)}</option>)}
      </select></label></div>
    <h1>{document.meta.title || t(locale, "guide.untitled")}</h1>
    {!groups.some((group) => group.pictures.length) && <p>{t(locale, "reader.empty")}</p>}
    <ReadingContent groups={groups} presentation={board ? "board" : "sequence"} locale={locale} />
  </section>;
}
export function ReadingContent({ groups, presentation, locale }: { groups: readonly ReadingGroup[]; presentation: InstructionDocument["meta"]["presentation"]; locale: AppLocale }) {
  const board = presentation === "board"; const GroupList = board ? "ul" : "ol";
  const total = board ? undefined : groups.reduce((sum, group) => sum + (group.groupSeconds ?? 0), 0);
  return <div class="reading-content">{!!total && <p>{t(locale, "output.totalTime", { duration: formatDuration(total) })}</p>}
    <GroupList class="reader__groups" data-reading-presentation={presentation}>
      {groups.map((group, index) => <li class="reader__group" key={group.stepId}>
        <h2>{group.title || (board ? t(locale, "output.groupContext") : t(locale, "editor.stepNumber", { number: index + 1 }))}</h2>
        {group.description !== undefined && <p>{group.description}</p>}
        {group.groupSeconds !== undefined && <p>{t(locale, "time.group")}: {group.time ? getDurationDisplayLabel(group.time) : formatDuration(group.groupSeconds)}</p>}
        <ul class="reader__pictures">{group.pictures.map((picture) => <li key={picture.tokenId} class="reader__picture" data-reading-picture={picture.tokenId}>
          <span role="img" aria-label={picture.accessibleName} class="reader__symbol"><Icon iconId={picture.iconId} /></span>
          {picture.label !== undefined && <p>{picture.label}</p>}
          {picture.note !== undefined && <p>{picture.note}</p>}
          {picture.quantity && <p class="picture__quantity">{t(locale, "quantity.title")}: {getQuantityDisplayLabel(picture.quantity)}</p>}
          {picture.warning && <p class="picture__warning"><Icon iconId={picture.warning.iconId} />{picture.warningContext}</p>}
          {picture.time && <p class="picture__time">{t(locale, "time.picture")}: {getDurationDisplayLabel(picture.time)}</p>}
          {!picture.icon.known && <p class="review-notice">{t(locale, "catalog.unknownSymbol", { iconId: picture.iconId })} — {t(locale, "editor.warningReview")}</p>}
          {picture.reviewWarning && <p class="review-notice">{t(locale, "catalog.reviewWarning", { iconId: picture.warning!.iconId })}</p>}
        </li>)}</ul>
      </li>)}
    </GroupList>
  </div>;
}
