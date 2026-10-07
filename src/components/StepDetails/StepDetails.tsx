import { useState } from "preact/hooks";
import { sessionActions, type DocumentSession } from "../../state/document";
import { authoring, closeAuthoringPanel, focusPicture } from "../../state/ui";
import { preferences } from "../../state/preferences";
import { t } from "../../i18n/messages";
import { TimeEditor } from "../TokenDetails/AttachmentFields";
export function StepDetails({ session }: { session: DocumentSession }) {
  const [confirmRemove, setConfirmRemove] = useState(false); const panel = authoring.panel.value; const locale = preferences.value.uiLocale;
  if (panel.kind !== "group") return null;
  const step = session.document.value.steps.find((group) => group.id === panel.stepId); if (!step) return null;
  const index = session.document.value.steps.indexOf(step); const name = step.title || t(locale, session.document.value.meta.presentation === "board" ? "editor.groupNumber" : "editor.stepNumber", { number: index + 1 });
  const remove = () => { sessionActions.removeStep(session, step.id); closeAuthoringPanel(); };
  if (confirmRemove) return <section><h2>{t(locale, "editor.removeGroupConfirm", { group: name, count: step.tokens.length })}</h2><div class="action-row"><button type="button" onClick={() => setConfirmRemove(false)}>{t(locale, "dialog.cancel")}</button><button type="button" onClick={remove}>{t(locale, "dialog.delete")}</button></div></section>;
  return <section><h2>{name}</h2><label>{t(locale, "editor.groupTitle")}<input autoFocus value={step.title ?? ""} onInput={(event) => sessionActions.updateStepTitle(session, step.id, event.currentTarget.value)} /></label>
    <TimeEditor value={step.time} locale={locale} onSave={(value) => sessionActions.setStepTime(session, step.id, value)} />
    <details class="editor-actions"><summary>{t(locale, "editor.actions")}</summary>
      <label>{t(locale, "editor.description")}<textarea value={step.description ?? ""} onInput={(event) => sessionActions.updateStepDescription(session, step.id, event.currentTarget.value)} /></label>
      <div class="action-row"><button type="button" disabled={index === 0} onClick={() => sessionActions.moveStepUp(session, step.id)}>{t(locale, "editor.moveGroupEarlier")}</button><button type="button" disabled={index === session.document.value.steps.length - 1} onClick={() => sessionActions.moveStepDown(session, step.id)}>{t(locale, "editor.moveGroupLater")}</button></div>
      {session.copiedToken.value && <button type="button" onClick={() => { const id = authoring.pastePicture(step.id); if (id) { authoring.close(); focusPicture(id); } }}>{t(locale, "editor.pastePicture")}</button>}
      <button type="button" onClick={() => step.tokens.length ? setConfirmRemove(true) : remove()}>{t(locale, "editor.removeGroup")}</button>
    </details>
  </section>;
}
