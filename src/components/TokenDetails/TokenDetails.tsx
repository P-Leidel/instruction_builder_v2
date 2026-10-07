import { sessionActions, type DocumentSession } from "../../state/document";
import { authoring, closeAuthoringPanel, focusPicture } from "../../state/ui";
import { armPictureMove } from "../../state/editor-drag";
import { preferences } from "../../state/preferences";
import { t } from "../../i18n/messages";
import { getCatalogEntry, getLibrary } from "../../lib/library-catalog";
import { QuantityEditor, TimeEditor } from "./AttachmentFields";
export function TokenDetails({ session }: { session: DocumentSession }) {
  const panel = authoring.panel.value; const pref = preferences.value;
  if (panel.kind !== "picture") return null;
  const step = session.document.value.steps.find((group) => group.id === panel.stepId); const token = step?.tokens.find((picture) => picture.id === panel.tokenId);
  if (!step || !token) return null;
  const index = step.tokens.findIndex((picture) => picture.id === token.id); const locale = pref.uiLocale;
  const move = (destination: string, finalIndex: number) => { authoring.movePicture(step.id, token.id, destination, finalIndex); authoring.close(); focusPicture(token.id); };
  return <section class="token-details"><h2>{t(locale, "editor.pictureDetails", { label: token.label || getCatalogEntry(token.iconId)?.labels[locale] || token.iconId })}</h2>
    <label>{t(locale, "editor.pictureLabel")}<textarea autoFocus value={token.label ?? ""} onInput={(event) => sessionActions.updateTokenLabel(session, step.id, token.id, event.currentTarget.value)} /></label>
    <QuantityEditor key={`${token.id}-quantity`} value={token.quantity} locale={locale} libraryId={pref.activeLibraryId} onSave={(value) => value ? sessionActions.attachToToken(session, step.id, token.id, { kind: "quantity", value }) : sessionActions.removeTokenAttachment(session, step.id, token.id, "quantity")} />
    <TimeEditor key={`${token.id}-time`} value={token.time} locale={locale} onSave={(value) => sessionActions.setTokenTime(session, step.id, token.id, value)} />
    <fieldset><legend>{t(locale, "warning.title")}</legend><label>{t(locale, "warning.title")}<select value={token.warning?.iconId ?? ""} onChange={(event) => { const id = event.currentTarget.value; if (!id) sessionActions.removeTokenAttachment(session, step.id, token.id, "warning"); else sessionActions.attachToToken(session, step.id, token.id, { kind: "warning", value: { ...token.warning, iconId: id, label: getCatalogEntry(id)?.labels[pref.labelLocale] } }); }}><option value="">{t(locale, "warning.none")}</option>{token.warning && getCatalogEntry(token.warning.iconId)?.category !== "warning" && <option value={token.warning.iconId}>{token.warning.iconId}</option>}{getLibrary("kitchen").entries.filter((entry) => entry.category === "warning").map((entry) => <option value={entry.iconId}>{entry.labels[locale]}</option>)}</select></label>
      {token.warning && <label>{t(locale, "warning.label")}<textarea value={token.warning.label ?? ""} onInput={(event) => sessionActions.attachToToken(session, step.id, token.id, { kind: "warning", value: { ...token.warning!, label: event.currentTarget.value } })} /></label>}</fieldset>
    <details class="editor-actions"><summary>{t(locale, "editor.actions")}</summary>
      <label>{t(locale, "editor.note")}<textarea value={token.note ?? ""} onInput={(event) => sessionActions.updateTokenNote(session, step.id, token.id, event.currentTarget.value)} /></label>
      <button type="button" onClick={() => { armPictureMove(step.id, token.id); closeAuthoringPanel(); }}>{t(locale, "editor.movePicture")}</button>
      <div class="action-row"><button type="button" disabled={index === 0} onClick={() => move(step.id, index - 1)}>{t(locale, "editor.moveEarlier")}</button><button type="button" disabled={index === step.tokens.length - 1} onClick={() => move(step.id, index + 1)}>{t(locale, "editor.moveLater")}</button></div>
      <label>{t(locale, "editor.moveToGroup")}<select value="" onChange={(event) => { const target = session.document.peek().steps.find((group) => group.id === event.currentTarget.value); if (target) move(target.id, target.tokens.length); }}><option value="">{t(locale, "editor.moveToGroup")}</option>{session.document.value.steps.filter((group) => group.id !== step.id).map((group) => <option value={group.id}>{group.title || t(locale, session.document.value.meta.presentation === "board" ? "editor.groupNumber" : "editor.stepNumber", { number: session.document.value.steps.indexOf(group) + 1 })}</option>)}</select></label>
      <div class="action-row"><button type="button" onClick={() => { const id = authoring.duplicatePicture(step.id, token.id); authoring.close(); if (id) focusPicture(id); }}>{t(locale, "editor.duplicatePicture")}</button>
        <button type="button" onClick={() => authoring.copyPicture(step.id, token.id)}>{t(locale, "editor.copyPicture")}</button>
        <button type="button" onClick={() => { sessionActions.removeTokenFromStep(session, step.id, token.id); authoring.close(); requestAnimationFrame(() => window.document.querySelector<HTMLElement>(`[data-add-picture="${CSS.escape(step.id)}"]`)?.focus()); }}>{t(locale, "editor.removePicture")}</button></div>
    </details>
  </section>;
}
