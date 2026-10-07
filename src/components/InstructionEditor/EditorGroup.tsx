import type { DocumentSession } from "../../state/document";
import type { InstructionStep } from "../../model/instruction";
import type { EditorGroupPlacement, MmBox } from "../../model/output";
import type { AppLocale } from "../../model/library";
import { t } from "../../i18n/messages";
import { authoring, capturePanelOpener } from "../../state/ui";
import { EditorPicture } from "./EditorPicture";
import { beginEditorDrag, editorDrag } from "../../state/editor-drag";

export function groupName(step: InstructionStep, index: number, board: boolean, locale: AppLocale) {
  return board ? step.title || t(locale, "editor.groupNumber", { number: index + 1 }) : t(locale, "output.sequenceGroup", { number: index + 1, title: step.title ?? "" });
}
export function GroupControls({ step, index, board, locale }: { step: InstructionStep; index: number; board: boolean; locale: AppLocale }) {
  const name = groupName(step, index, board, locale);
  return <div class="editor-group-tools__row"><button type="button" data-group-edit={step.id} onClick={() => { capturePanelOpener(); authoring.openGroup(step.id); }}>{name}</button><button type="button" data-add-picture={step.id} aria-label={t(locale, "editor.addPictureTo", { group: name })} onClick={() => { capturePanelOpener(); authoring.openPicker(step.id); }}>{t(locale, "editor.addPicture")}</button></div>;
}
export function EditorGroup({ step, index, session, locale, placement, scale, draft, marked, headingPrinted }: { step: InstructionStep; index: number; session: DocumentSession; locale: AppLocale; placement: EditorGroupPlacement; scale: number; draft: boolean; marked: ReadonlySet<string>; headingPrinted: boolean }) {
  const heading = groupName(step, index, session.document.value.meta.presentation === "board", locale);
  const drag = editorDrag.value;
  const edge = drag?.groupDrop?.anchorId === step.id ? ` is-drop-${drag.groupDrop.edge}` : "";
  const empty = drag?.pictureDrop?.groupId === step.id && drag.pictureDrop.edge === "empty";
  const group = placement.groupBox;
  const local = (box: MmBox) => ({ xMm: box.xMm - group.xMm, yMm: box.yMm - group.yMm, widthMm: box.widthMm, heightMm: box.heightMm });
  const header = placement.headingBox && local(placement.headingBox);
  const inline = !placement.continued && header && header.heightMm * scale >= 44 && header.widthMm * scale >= 280;
  return <li class={`editor-group${session.selectedStepId.value === step.id ? " is-selected" : ""}${edge}${empty ? " is-drop-empty" : ""}`} data-editor-group={step.id} data-group-segment={placement.segment} style={{ left: `${group.xMm * scale}px`, top: `${group.yMm * scale}px`, width: `${group.widthMm * scale}px`, height: `${group.heightMm * scale}px` }}>
    {inline && <header class="editor-group__header" style={{ left: `${header.xMm * scale}px`, top: `${header.yMm * scale}px`, width: `${header.widthMm * scale}px`, height: `${header.heightMm * scale}px` }}>
      <button type="button" class="editor-group__name" data-group-drag={step.id} aria-label={t(locale, "editor.editGroup", { group: heading })} onPointerDown={event => beginEditorDrag(event, session, { kind: "group", groupId: step.id }, heading)} onClick={() => { capturePanelOpener(); authoring.openGroup(step.id); }}>{draft || !headingPrinted ? <span class="editor-group__placeholder">{heading}</span> : <span class="visually-hidden">{heading}</span>}</button>
      <button type="button" data-add-picture={step.id} aria-label={t(locale, "editor.addPictureTo", { group: heading })} onClick={() => { capturePanelOpener(); authoring.openPicker(step.id); }}>{t(locale, "editor.addPicture")}</button>
    </header>}
    <ul class="editor-pictures">{placement.pictures.map(picture => {
      const token = step.tokens.find(token => token.id === picture.tokenId);
      return token && <EditorPicture key={token.id} token={token} locale={locale} session={session} groupId={step.id} selected={session.selectedTokenId.value === token.id} box={local(picture.cellBox)} scale={scale} draft={draft} marked={marked.has(token.id)} onActivate={() => { capturePanelOpener(); authoring.openPicture(step.id, token.id); }} />;
    })}</ul>
    {!step.tokens.length && placement.emptyDropBox && placement.emptyDropBox.widthMm * scale >= 44 && placement.emptyDropBox.heightMm * scale >= 44 && <button class="editor-group__empty" type="button" style={{ left: `${local(placement.emptyDropBox).xMm * scale}px`, top: `${local(placement.emptyDropBox).yMm * scale}px`, width: `${placement.emptyDropBox.widthMm * scale}px`, height: `${placement.emptyDropBox.heightMm * scale}px` }} onClick={() => { capturePanelOpener(); authoring.openPicker(step.id); }}>{t(locale, "editor.emptyGroup")}</button>}
  </li>;
}
