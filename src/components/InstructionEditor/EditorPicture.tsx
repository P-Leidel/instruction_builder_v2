import type { InstructionToken } from "../../model/instruction";
import type { MmBox } from "../../model/output";
import { Icon } from "../Icon/Icon";
import { getCatalogEntry, getWarningMeaning } from "../../lib/library-catalog";
import { t } from "../../i18n/messages";
import type { AppLocale } from "../../model/library";
import { getQuantityDisplayLabel, getDurationDisplayLabel } from "../../lib/attachment-labels";
import type { DocumentSession } from "../../state/document";
import { armedPictureMove, beginEditorDrag, editorDrag } from "../../state/editor-drag";

export function pictureName(token: InstructionToken, locale: AppLocale) {
  return token.label?.trim() ? token.label : getCatalogEntry(token.iconId)?.labels[locale] ?? t(locale, "catalog.unknownSymbol", { iconId: token.iconId });
}
export function EditorPicture({ token, locale, selected, onActivate, session, groupId, box, scale, draft = false, marked = false }: { token: InstructionToken; locale: AppLocale; selected: boolean; onActivate: () => void; session: DocumentSession; groupId: string; box?: MmBox; scale: number; draft?: boolean; marked?: boolean }) {
  const name = pictureName(token, locale);
  const accessibleName = [name, token.quantity && getQuantityDisplayLabel(token.quantity), token.warning && t(locale, "reader.warning", { meaning: getWarningMeaning(token.warning, locale) }), token.time && getDurationDisplayLabel(token.time)].filter(Boolean).join(". ");
  const drag = editorDrag.value, armed = armedPictureMove.value;
  const edge = drag?.pictureDrop?.anchorId === token.id ? ` is-drop-${drag.pictureDrop.edge}` : "";
  const dragging = drag?.source.kind === "picture" && drag.source.tokenId === token.id;
  const ready = armed?.groupId === groupId && armed.tokenId === token.id;
  const interactive = !box || (box.widthMm * scale >= 44 && box.heightMm * scale >= 44);
  const style = box ? { left: `${box.xMm * scale}px`, top: `${box.yMm * scale}px`, width: `${box.widthMm * scale}px`, height: `${box.heightMm * scale}px` } : undefined;
  return <li class={`editor-picture${edge}${dragging ? " is-dragging" : ""}${marked ? " needs-repair" : ""}${box ? " editor-picture--physical" : ""}`} style={style}>
    <button type="button" class={`editor-picture__button${selected ? " is-selected" : ""}${ready ? " is-move-ready" : ""}`} data-editor-picture={interactive ? token.id : undefined} aria-hidden={!interactive || undefined} disabled={!interactive} aria-label={accessibleName} aria-pressed={selected} title={accessibleName} onPointerDown={event => beginEditorDrag(event, session, { kind: "picture", groupId, tokenId: token.id }, name)} onClick={onActivate}>
      {draft ? <><Icon iconId={token.iconId} /><span>{name}</span></> : <span class="visually-hidden">{accessibleName}</span>}
    </button>
  </li>;
}
