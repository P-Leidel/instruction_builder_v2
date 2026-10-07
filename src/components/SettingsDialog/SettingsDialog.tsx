import { ModalDialog } from "../AuthoringPanel/AuthoringPanel";
import { preferences, updatePreferences } from "../../state/preferences";
import type { AppPreferences } from "../../model/preferences";
import type { AppLocale } from "../../model/library";
import { t } from "../../i18n/messages";

export function SettingsDialog({ locale, onClose, onImport, onBackup }: { locale: AppLocale; onClose: () => void; onImport: () => void; onBackup: () => void }) {
  const pref = preferences.value;
  return <ModalDialog label={t(locale, "preferences.title")} onClose={onClose}>
    <h2>{t(locale, "preferences.title")}</h2>
    <div class="preferences">
      <label>{t(locale, "preferences.theme")}<select value={pref.theme} onChange={event => void updatePreferences({ theme: event.currentTarget.value as AppPreferences["theme"] })}><option value="light">{t(locale, "preferences.light")}</option><option value="dark">{t(locale, "preferences.dark")}</option></select></label>
      <div class="preferences__languages"><label>{t(locale, "preferences.uiLocale")}<select value={pref.uiLocale} onChange={event => void updatePreferences({ uiLocale: event.currentTarget.value as AppLocale })}><option value="en">{t(locale, "preferences.english")}</option><option value="de">{t(locale, "preferences.german")}</option></select></label><label>{t(locale, "preferences.labelLocale")}<select value={pref.labelLocale} onChange={event => void updatePreferences({ labelLocale: event.currentTarget.value as AppLocale })}><option value="en">{t(locale, "preferences.english")}</option><option value="de">{t(locale, "preferences.german")}</option></select></label></div>
      <p>{t(locale, "preferences.authoredText")}</p>
      <section class="preferences__files"><h3>{t(locale, "preferences.files")}</h3><div class="action-row"><button type="button" onClick={onImport}>{t(locale, "toolbar.import")}</button><button type="button" onClick={onBackup}>{t(locale, "toolbar.backup")}</button></div><p>{t(locale, "save.localOnly")}</p></section>
    </div>
  </ModalDialog>;
}
