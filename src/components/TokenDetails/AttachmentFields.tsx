import { createContext, type ComponentChildren } from "preact";
import { useContext, useState, useId, useLayoutEffect, useRef } from "preact/hooks";
import type { AppLocale, LibraryId } from "../../model/library";
import type { QuantityAttachment, DurationAttachment } from "../../model/instruction";
import { buildQuantity, MIN_QUANTITY, MAX_QUANTITY } from "../../lib/quantity";
import { buildDuration, splitDuration, MAX_DURATION_SECONDS } from "../../lib/duration";
import { getSuggestedUnits } from "../../lib/quantity-units";
import { t } from "../../i18n/messages";

interface AttachmentDraft { committed: string; value: unknown }
const DraftContext = createContext<Map<string, AttachmentDraft> | undefined>(undefined);
/** Scoped to one authoring target; native dialog/aside changes retain its drafts. */
export function AttachmentDraftProvider({ children }: { children: ComponentChildren }) {
  const drafts = useRef(new Map<string, AttachmentDraft>());
  return <DraftContext.Provider value={drafts.current}>{children}</DraftContext.Provider>;
}
function useAttachmentDraft<T extends object>(key: string, committed: string, initial: () => T) {
  const drafts = useContext(DraftContext);
  const [draft, setDraft] = useState<T>(() => {
    const cached = drafts?.get(key);
    return cached?.committed === committed ? cached.value as T : initial();
  });
  const previous = useRef(committed);
  // History clones unrelated attachments. Only committed field changes reset
  // pending input; remounting the same target reads its cached form instead.
  useLayoutEffect(() => {
    if (previous.current !== committed) {
      previous.current = committed;
      const next = initial();
      drafts?.set(key, { committed, value: next }); setDraft(next);
    } else drafts?.set(key, { committed, value: draft });
  }, [committed, draft, drafts, key]);
  const update = (patch: Partial<T>) => setDraft(current => {
    const next = { ...current, ...patch }; drafts?.set(key, { committed, value: next }); return next;
  });
  return [draft, update] as const;
}
export function QuantityEditor({ value, locale, libraryId, onSave }: { value?: QuantityAttachment; locale: AppLocale; libraryId: LibraryId; onSave: (value: QuantityAttachment | undefined) => void }) {
  const [{ amount, unit, invalid }, update] = useAttachmentDraft("quantity", JSON.stringify([!!value, value?.amount, value?.unit, value?.label, value?.iconId]), () => ({ amount: String(value?.amount ?? 1), unit: value?.unit ?? "pcs", invalid: false }));
  const errorId = useId();
  const unitListId = useId();
  return <fieldset><legend>{t(locale, "quantity.title")}</legend><label>{t(locale, "quantity.amount")}<input type="number" min={MIN_QUANTITY} max={MAX_QUANTITY} step="1" value={amount} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined} onFocus={(event) => event.currentTarget.select()} onInput={(event) => update({ amount: event.currentTarget.value })} /></label>
    <label>{t(locale, "quantity.unit")}<input aria-label={t(locale, "quantity.unit")} list={unitListId} value={unit} onInput={(event) => update({ unit: event.currentTarget.value })} /><datalist id={unitListId}>{getSuggestedUnits(libraryId, locale).map((option) => <option value={option.value}>{option.label}</option>)}</datalist></label>
    {invalid && <p role="alert" id={errorId}>{t(locale, "quantity.invalid")}</p>}
    <div class="action-row attachment-fields__actions"><button type="button" onClick={() => { const result = buildQuantity(Number(amount), unit); if (!result) { update({ invalid: true }); return; } update({ invalid: false }); onSave(value?.amount === result.amount && value.unit === result.unit ? value : { ...value, ...result }); }}>{t(locale, "dialog.save")}</button>
    <button type="button" disabled={!value} onClick={() => onSave(undefined)}>{t(locale, "quantity.remove")}</button></div></fieldset>;
}
export function TimeEditor({ value, locale, onSave }: { value?: DurationAttachment; locale: AppLocale; onSave: (value: DurationAttachment | undefined) => void }) {
  const [draft, update] = useAttachmentDraft("duration", JSON.stringify([!!value, value?.seconds, value?.label, value?.iconId]), () => {
    const parts = splitDuration(value?.seconds ?? 60);
    return { days: String(parts.days), hours: String(parts.hours), minutes: String(parts.minutes), seconds: String(parts.seconds), invalid: false };
  });
  const errorId = useId();
  const fields = [
    { field: "days", key: "time.days", factor: 86400 },
    { field: "hours", key: "time.hours", factor: 3600 },
    { field: "minutes", key: "time.minutes", factor: 60 },
    { field: "seconds", key: "time.remainingSeconds", factor: 1 },
  ] as const;
  const save = () => {
    const parts = fields.map(({ field }) => Number(draft[field]));
    const total = parts.reduce((sum, part, index) => sum + part * fields[index].factor, 0);
    if (fields.some(({ field }, index) => draft[field].trim() === "" || !Number.isInteger(parts[index]) || parts[index] < 0) || total < 1 || total > MAX_DURATION_SECONDS) { update({ invalid: true }); return; }
    // Validate before buildDuration: its historical clamping must not silently
    // replace an invalid form value. Unchanged saves retain authored labels.
    const result = buildDuration(parts[0], parts[1], parts[2], parts[3])!;
    update({ invalid: false }); onSave(value?.seconds === total ? value : { ...value, ...result });
  };
  return <fieldset><legend>{t(locale, "time.title")}</legend><div class="time-fields">{fields.map(({ field, key, factor }) => <label key={field}>{t(locale, key)}<input type="number" min="0" max={Math.floor(MAX_DURATION_SECONDS / factor)} step="1" value={draft[field]} aria-invalid={draft.invalid || undefined} aria-describedby={draft.invalid ? errorId : undefined} onFocus={(event) => event.currentTarget.select()} onInput={(event) => update({ [field]: event.currentTarget.value })} /></label>)}</div>
    {draft.invalid && <p role="alert" id={errorId}>{t(locale, "time.invalid")}</p>}
    <div class="action-row attachment-fields__actions"><button type="button" onClick={save}>{t(locale, "dialog.save")}</button>
    <button type="button" disabled={!value} onClick={() => onSave(undefined)}>{t(locale, "time.remove")}</button></div></fieldset>;
}
