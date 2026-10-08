import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { effect } from "@preact/signals";
import { documentSession, sessionActions } from "./state/document";
import { appView, authoring, toast, pendingImport, focusPicture } from "./state/ui";
import { preferences, preferenceSaveState, retryPreferences } from "./state/preferences";
import { activeGuideId, saveState, startupStorageUnavailable, failedNewGuide, guideNotices } from "./state/guides";
import { guideBootstrap } from "./state/guide-bootstrap";
import { createAppShell } from "./state/app-shell";
import { InstructionEditor } from "./components/InstructionEditor/InstructionEditor";
import { AuthoringPanel, ModalDialog } from "./components/AuthoringPanel/AuthoringPanel";
import { MyGuides } from "./components/MyGuides/MyGuides";
import { InstructionReader } from "./components/InstructionReader/InstructionReader";
import { Toolbar } from "./components/Toolbar/Toolbar";
import { OutputDialog } from "./components/OutputDialog/OutputDialog";
import { SettingsDialog } from "./components/SettingsDialog/SettingsDialog";
import { runJsonExport, readImportFile } from "./lib/document-file";
import { t } from "./i18n/messages";
import { printSettings } from "./state/print-settings";
import { shellFocus } from "./lib/view-entry-focus";

function textEntry(target: EventTarget | null) { return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable); }
export function App() {
  const input = useRef<HTMLInputElement>(null);
  const [reloadConfirm, setReloadConfirm] = useState(false);
  const [settings, setSettings] = useState(false);
  const [shell] = useState(() => createAppShell({ controller: guideBootstrap.controller, session: documentSession,
    view: appView, pendingImport, toast, preferences, retryPreferences, closeAuthoring: authoring.close,
    backup: runJsonExport, focus: shellFocus }));
  const { openGuides: guides, openReader: read, returnToEditor, closeOutput, closeImport,
    createOnce, retryStorage, retryPreferenceStorage, backup, reportResult: result } = shell;
  const storageRetryBusy = shell.storageRetryBusy.value, preferenceRetryBusy = shell.preferenceRetryBusy.value;
  const guideCreationBusy = shell.guideCreationBusy.value, output = shell.output.value;
  const locale = preferences.value.uiLocale; const session = documentSession;
  const editing = appView.value === "editor"; const reading = appView.value === "reader";
  const outputVisible = output !== null && output.guideId === activeGuideId.value;
  useLayoutEffect(() => effect(() => { window.document.documentElement.dataset.theme = preferences.value.theme; window.document.documentElement.lang = preferences.value.uiLocale; }), []);
  useEffect(() => effect(() => { window.document.title = session.document.value.meta.title || t(preferences.value.uiLocale, "app.title"); }), [session]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !(event.metaKey || event.ctrlKey) || appView.peek() !== "editor" || window.document.querySelector("dialog[open]") || outputVisible || textEntry(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "z" || key === "y") { event.preventDefault(); if (key === "y" || event.shiftKey) sessionActions.redo(session); else sessionActions.undo(session); }
      else if (!textEntry(event.target) && key === "c" && session.selectedStepId.peek() && session.selectedTokenId.peek()) { event.preventDefault(); authoring.copyPicture(session.selectedStepId.peek()!, session.selectedTokenId.peek()!); }
      else if (!textEntry(event.target) && key === "v" && session.copiedToken.peek() && session.selectedStepId.peek()) { event.preventDefault(); const id = authoring.pastePicture(session.selectedStepId.peek()!); if (id) focusPicture(id); }
    };
    window.addEventListener("keydown", keyboard); return () => window.removeEventListener("keydown", keyboard);
  }, [session, outputVisible]);
  useEffect(() => () => shell.dispose(), [shell]);
  useEffect(() => {
    if (!outputVisible) return;
    const media = window.matchMedia("(max-width: 767px)");
    const closeMobileAuthoring = () => { if (media.matches) authoring.close(); };
    closeMobileAuthoring();
    media.addEventListener("change", closeMobileAuthoring);
    return () => media.removeEventListener("change", closeMobileAuthoring);
  }, [outputVisible]);
  if (reading) return <main class="app reader-app"><InstructionReader document={session.document.value} locale={locale} onBack={returnToEditor} /></main>;
  return <div class="app">
    <header class="app-header"><div class="app-header__brand"><h1 class="app-brand">{t(locale, "app.title")}</h1>{activeGuideId.value !== null && saveState.value !== "unavailable" && saveState.value !== "conflict" && <span class={`save-status save-status--${saveState.value}`} role="status" title={t(locale, `save.${saveState.value}`)}>{saveState.value === "saved" ? t(locale, "save.compactSaved") : t(locale, "save.saving")}</span>}</div><Toolbar session={session} locale={locale} editing={editing} onGuides={() => void guides()} onRead={read} onOutput={() => { if (window.matchMedia("(max-width: 767px)").matches) authoring.close(); shell.openOutput(); }} onSettings={() => setSettings(true)} />
      <input ref={input} type="file" accept="application/json,.json" class="visually-hidden" tabIndex={-1} aria-label={t(locale, "import.chooseFile")} onChange={async (event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (!file) return; const imported = await readImportFile(file); if (imported.ok) pendingImport.value = { document: imported.document }; else toast.value = { text: t(preferences.peek().uiLocale, "import.invalid"), tone: "error" }; }} />
    </header>
    {settings && <SettingsDialog locale={locale} onClose={() => setSettings(false)} onImport={() => { setSettings(false); input.current?.click(); }} onBackup={() => void backup(session.document.peek())} />}
    {preferenceSaveState.value === "unavailable" && <section role="status" aria-busy={preferenceRetryBusy || storageRetryBusy}><p>{t(locale, "preferences.saveUnavailable")}</p><button type="button" disabled={preferenceRetryBusy || storageRetryBusy} onClick={() => void retryPreferenceStorage()}>{t(locale, "preferences.retry")}</button></section>}
    {(saveState.value === "unavailable" || saveState.value === "conflict") && <section class={`save-status save-status--${saveState.value}`} role={saveState.value === "conflict" ? "alert" : "status"} aria-busy={storageRetryBusy}><p>{t(locale, `save.${saveState.value}`)}</p>
      {(saveState.value === "unavailable" || saveState.value === "conflict") && <div class="action-row"><button type="button" onClick={() => void backup(session.document.peek())}>{t(locale, "save.backup")}</button>{startupStorageUnavailable.value ? <button type="button" disabled={storageRetryBusy || preferenceRetryBusy} onClick={() => void retryStorage()}>{t(locale, "save.retryStorage")}</button> : <button type="button" onClick={() => setReloadConfirm(true)}>{t(locale, "save.reload")}</button>}<button type="button" onClick={() => { toast.value = null; }}>{t(locale, "save.keepEditing")}</button></div>}
    </section>}
    {toast.value && <div class={`toast toast--${toast.value.tone}`} role={toast.value.tone === "error" ? "alert" : "status"}><p>{toast.value.text}</p><button type="button" aria-label={t(locale, "dialog.close")} onClick={() => { toast.value = null; }}>{t(locale, "dialog.close")}</button></div>}
    {editing && failedNewGuide.value && <div class="persistent-notice" role="alert"><p>{t(locale, "guides.failedNewDraft")}</p><button type="button" onClick={() => void backup(failedNewGuide.peek()!)}>{t(locale, "guides.downloadFailedDraft")}</button><button type="button" disabled={guideCreationBusy} onClick={() => void createOnce(failedNewGuide.peek()!)}>{t(locale, "guides.retryFailedDraft")}</button></div>}
    {editing && guideNotices.value.length > 0 && <p role="status">{t(locale, "guides.legacyRecovered")} <button type="button" onClick={() => void guides()}>{t(locale, "guides.title")}</button></p>}
    <main>{editing ? <div class="editor-layout"><InstructionEditor session={session} locale={locale} /><AuthoringPanel session={session} /></div> : <MyGuides shell={shell} />}</main>
    {pendingImport.value && <ModalDialog label={t(locale, "toolbar.import")} busy={guideCreationBusy} onClose={closeImport}><p>{t(locale, "import.confirmNew")}</p><button type="button" disabled={guideCreationBusy} onClick={() => void shell.confirmImport()}>{t(locale, "dialog.confirm")}</button><button type="button" disabled={guideCreationBusy} onClick={closeImport}>{t(locale, "dialog.cancel")}</button></ModalDialog>}
    {reloadConfirm && <ModalDialog label={t(locale, "save.reload")} onClose={() => setReloadConfirm(false)}><p>{t(locale, "save.reloadConfirm")}</p><button type="button" onClick={() => void backup(session.document.peek())}>{t(locale, "save.backup")}</button><button type="button" onClick={async () => { const reloaded = await guideBootstrap.controller().reloadActiveGuide(); result(reloaded); setReloadConfirm(false); }}>{t(locale, "save.reload")}</button><button type="button" onClick={() => setReloadConfirm(false)}>{t(locale, "save.keepEditing")}</button></ModalDialog>}
    {outputVisible && <OutputDialog sourceDocument={documentSession.document.value} guideId={activeGuideId.value} locale={output.locale} onClose={closeOutput} initialOptions={printSettings.getOptions(session.document.value, activeGuideId.value, output.locale)} onOptionsChange={(options, capturedDocument) => printSettings.setOptions(capturedDocument, activeGuideId.peek(), options)} />}
  </div>;
}
