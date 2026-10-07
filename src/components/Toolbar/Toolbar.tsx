import type { DocumentSession } from "../../state/document";
import { sessionActions } from "../../state/document";
import type { AppLocale } from "../../model/library";
import { t } from "../../i18n/messages";
function HistoryIcon({ redo = false }: { redo?: boolean }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><g transform={redo ? "translate(24 0) scale(-1 1)" : undefined}><path d="m9 4-5 5 5 5M4 9h9a6 6 0 0 1 0 12" /></g></svg>;
}
export function Toolbar({ session, locale, editing, onGuides, onRead, onOutput, onSettings }: { session: DocumentSession; locale: AppLocale; editing: boolean; onGuides: () => void; onRead: () => void; onOutput: () => void; onSettings: () => void }) {
  return <nav class="app-toolbar" aria-label={t(locale, "app.title")}><button type="button" class="app-toolbar__quiet" onClick={onGuides}>{t(locale, "guides.title")}</button>
    {editing && <><div class="app-toolbar__history"><button type="button" class="app-toolbar__icon" aria-label={t(locale, "toolbar.undo")} title={t(locale, "toolbar.undo")} disabled={!session.canUndo.value} onClick={() => sessionActions.undo(session)}><HistoryIcon /></button><button type="button" class="app-toolbar__icon" aria-label={t(locale, "toolbar.redo")} title={t(locale, "toolbar.redo")} disabled={!session.canRedo.value} onClick={() => sessionActions.redo(session)}><HistoryIcon redo /></button></div><button type="button" class="app-toolbar__quiet" onClick={onRead}>{t(locale, "toolbar.read")}</button><button type="button" class="app-toolbar__primary" aria-label={t(locale, "toolbar.output")} onClick={onOutput}><span class="app-toolbar__output-full">{t(locale, "toolbar.output")}</span><span class="app-toolbar__output-short" aria-hidden="true">{t(locale, "toolbar.print")}</span></button></>}
    <button type="button" class="app-toolbar__icon app-toolbar__settings" aria-label={t(locale, "preferences.title")} title={t(locale, "preferences.title")} onClick={onSettings}><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 3-.6 2.3-2 .9-2.2-.6-2 3.4 1.6 1.7v2.6L2.2 15l2 3.4 2.2-.6 2 .9L9 21h6l.6-2.3 2-.9 2.2.6 2-3.4-1.6-1.7v-2.6L21.8 9l-2-3.4-2.2.6-2-.9L15 3Z" /><circle cx="12" cy="12" r="3" /></svg></button>
  </nav>;
}
