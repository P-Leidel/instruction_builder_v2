import type { DocumentSession } from "../../state/document";
import type { TokenCategory } from "../../model/instruction";
import { preferences, updatePreferences } from "../../state/preferences";
import { signal } from "@preact/signals";
import { getLibrary, findLibraryEntries } from "../../lib/library-catalog";
import { t } from "../../i18n/messages";
import { authoring, focusPicture, toast } from "../../state/ui";
import { Icon } from "../Icon/Icon";
import { beginEditorDrag } from "../../state/editor-drag";
import { getGroupLabel } from "../../lib/instruction-presentation";
const query = signal(""); const category = signal<TokenCategory | "">("");
export function TokenPicker({ session }: { session: DocumentSession }) {
  const pref = preferences.value; const panel = authoring.panel.value;
  if (panel.kind !== "picker") return null;
  const step = session.document.value.steps.find((group) => group.id === panel.stepId);
  const index = session.document.value.steps.findIndex((group) => group.id === panel.stepId);
  const target = getGroupLabel(step?.title, pref.uiLocale, { kind: "authoring", presentation: session.document.value.meta.presentation, number: index + 1 });
  const entries = findLibraryEntries(getLibrary(pref.activeLibraryId), query.value, pref.labelLocale, category.value || undefined);
  return <section class="token-picker"><h2>{t(pref.uiLocale, "editor.addPictureTo", { group: target })}</h2>
    <label>{t(pref.uiLocale, "preferences.library")}<select value={pref.activeLibraryId} onChange={(event) => void updatePreferences({ activeLibraryId: event.currentTarget.value as typeof pref.activeLibraryId })}>{(["kitchen", "routines", "learning"] as const).map((id) => <option value={id}>{getLibrary(id).names[pref.uiLocale]}</option>)}</select></label>
    <label>{t(pref.uiLocale, "catalog.search")}<input type="search" autoFocus value={query.value} onInput={(event) => { query.value = event.currentTarget.value; }} /></label>
    <label>{t(pref.uiLocale, "catalog.allCategories")}<select value={category.value} onChange={(event) => { category.value = event.currentTarget.value as TokenCategory | ""; }}><option value="">{t(pref.uiLocale, "catalog.allCategories")}</option>{(["action", "object", "tool", "warning"] as const).map((id) => <option value={id}>{t(pref.uiLocale, `category.${id}`)}</option>)}</select></label>
    {!entries.length && <p role="status">{t(pref.uiLocale, "catalog.noResults", { query: query.value })}</p>}
    <ul class="picker-grid">{entries.map((entry) => <li key={entry.iconId}><button type="button" aria-label={entry.labels[pref.labelLocale]} onPointerDown={event => beginEditorDrag(event, session, { kind: "library", entry }, entry.labels[pref.labelLocale])} onClick={() => { const result = authoring.insert(entry, preferences.peek().labelLocale); if (result.ok) focusPicture(result.tokenId); else toast.value = { text: t(pref.uiLocale, "editor.targetMissing"), tone: "warning" }; }}><Icon iconId={entry.iconId} /><span>{entry.labels[pref.labelLocale]}</span></button></li>)}</ul>
  </section>;
}
