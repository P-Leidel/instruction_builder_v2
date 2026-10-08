import { useState } from "preact/hooks";
import { guideSummaries, createGuide, openGuide, duplicateGuide, deleteGuide, restoreGuide, lastDeletedGuide, failedNewGuide, guideNotices, importRecoveredGuide, type GuideActionResult } from "../../state/guides";
import { createEmptyDocument } from "../../model/instruction";
import type { InstructionDocument } from "../../model/instruction";
import { preferences } from "../../state/preferences";
import { t } from "../../i18n/messages";
import { createExampleDocument, type ExampleId } from "../../data/guide-examples";
import { ModalDialog } from "../AuthoringPanel/AuthoringPanel";
export function MyGuides({ onOpened, onResult, onBackup }: { onOpened: () => void; onResult: (result: GuideActionResult) => void; onBackup: (doc: InstructionDocument) => void }) {
  const [creating, setCreating] = useState(false); const [presentation, setPresentation] = useState<"sequence" | "board">("sequence");
  const [example, setExample] = useState<ExampleId>("prepare-onion"); const [deleting, setDeleting] = useState<{ id: string; revision: number; title: string } | null>(null); const [busy, setBusy] = useState(false);
  const pref = preferences.value; const locale = pref.uiLocale;
  async function action(operation: () => Promise<GuideActionResult>, open = false) { setBusy(true); try { const result = await operation(); onResult(result); if (result.ok && open) { setCreating(false); onOpened(); } } finally { setBusy(false); } }
  const create = (doc: InstructionDocument) => action(() => createGuide(doc), true);
  return <section class="my-guides"><h1 tabIndex={-1} data-view-entry="guides">{t(locale, "guides.title")}</h1><p>{t(locale, "save.localOnly")}</p>
    <button type="button" onClick={() => setCreating(true)}>{t(locale, "guides.new")}</button>
    {!guideSummaries.value.length && <p>{t(locale, "guides.empty")}</p>}
    <ul class="guide-list">{guideSummaries.value.map((guide) => { const title = guide.title || t(locale, "guide.untitled"); return <li key={guide.id} data-guide-id={guide.id}><h2>{title}</h2><p>{t(locale, guide.presentation === "board" ? "guide.board" : "guide.sequence")}</p><p>{t(locale, "guides.updated", { date: new Date(guide.updatedAt).toLocaleString(locale) })}</p>
      <div class="action-row"><button type="button" disabled={busy} aria-label={t(locale, "guides.openNamed", { title })} onClick={() => void action(() => openGuide(guide.id), true)}>{t(locale, "guides.open")}</button><button type="button" disabled={busy} aria-label={t(locale, "guides.duplicateNamed", { title })} onClick={() => void action(() => duplicateGuide(guide.id), true)}>{t(locale, "guides.duplicate")}</button><button type="button" disabled={busy} aria-label={t(locale, "guides.deleteNamed", { title })} onClick={() => setDeleting({ id: guide.id, revision: guide.revision, title })}>{t(locale, "guides.delete")}</button></div>
    </li>; })}</ul>
    {lastDeletedGuide.value && <button type="button" onClick={() => { const deleted = lastDeletedGuide.peek()!; void action(() => restoreGuide(deleted.id, deleted.revision)); }}>{t(locale, "guides.restoreLast", { title: lastDeletedGuide.value.document.meta.title || t(locale, "guide.untitled") })}</button>}
    {failedNewGuide.value && <div class="persistent-notice" role="alert"><p>{t(locale, "guides.failedNewDraft")}</p><button type="button" onClick={() => onBackup(failedNewGuide.peek()!)}>{t(locale, "guides.downloadFailedDraft")}</button><button type="button" disabled={busy} onClick={() => void create(failedNewGuide.peek()!)}>{t(locale, "guides.retryFailedDraft")}</button></div>}
    {guideNotices.value.map((notice) => <aside class="persistent-notice" key={notice.recoveryKey}><p>{t(locale, notice.code === "legacy-changed" ? "guides.legacyChanged" : notice.code === "legacy-recovered" ? "guides.legacyRecovered" : "guides.guideRecovered")}</p><button type="button" disabled={busy} onClick={() => void action(() => importRecoveredGuide(notice.recoveryKey), true)}>{t(locale, "guides.importRecovered")}</button></aside>)}
    {creating && <ModalDialog label={t(locale, "guides.new")} onClose={() => setCreating(false)}><h2>{t(locale, "guides.new")}</h2><label>{t(locale, "guides.creationType")}<select value={presentation} onChange={(event) => setPresentation(event.currentTarget.value as "sequence" | "board")}><option value="sequence">{t(locale, "guide.sequence")}</option><option value="board">{t(locale, "guide.board")}</option></select></label>
      <button type="button" disabled={busy} onClick={() => { const doc = createEmptyDocument(presentation); doc.meta.title = t(pref.labelLocale, "guide.untitled"); void create(doc); }}>{t(locale, "guide.blank")}</button>
      <label>{t(locale, "guide.examples")}<select value={example} onChange={(event) => setExample(event.currentTarget.value as ExampleId)}>{(["prepare-onion", "ready-to-draw", "choose-activity"] as const).map((id) => <option value={id}>{t(locale, id === "prepare-onion" ? "example.prepareOnion.title" : id === "ready-to-draw" ? "example.readyToDraw.title" : "example.chooseActivity.title")}</option>)}</select></label>
      <button type="button" disabled={busy} onClick={() => void create(createExampleDocument(example, pref.labelLocale))}>{t(locale, "guides.createExample")}</button></ModalDialog>}
    {deleting && <ModalDialog label={t(locale, "guides.delete")} onClose={() => setDeleting(null)}><p>{t(locale, "guides.deleteConfirm", { title: deleting.title })}</p><button type="button" disabled={busy} onClick={() => { const target = deleting; void action(() => deleteGuide(target.id, target.revision)).then(() => setDeleting(null)); }}>{t(locale, "dialog.delete")}</button><button type="button" onClick={() => setDeleting(null)}>{t(locale, "dialog.cancel")}</button></ModalDialog>}
  </section>;
}
