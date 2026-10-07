import { signal } from "@preact/signals";
import type { AppPreferences } from "../model/preferences";
import { createIndexedDbGuideStore, rawFingerprint, type GuideStore, type GuideTransaction } from "../lib/guide-repository";

export const PREFERENCES_KEY = "instruction-builder:preferences:v1";
export type PreferenceSaveState = "loading" | "saved" | "pending" | "saving" | "unavailable";
export interface PreferencesOptions { store?: GuideStore; languages?: readonly string[]; now?: () => string; newId?: () => string }
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validated(value: unknown): AppPreferences {
  const fields = object(value) ? value : {};
  return { uiLocale: fields.uiLocale === "de" ? "de" : "en", labelLocale: fields.labelLocale === "de" ? "de" : "en",
    theme: fields.theme === "dark" ? "dark" : "light",
    activeLibraryId: fields.activeLibraryId === "routines" || fields.activeLibraryId === "learning" ? fields.activeLibraryId : "kitchen",
    ...(typeof fields.lastGuideId === "string" && fields.lastGuideId.length > 0 ? { lastGuideId: fields.lastGuideId } : {}) };
}
export function createPreferencesController(options: PreferencesOptions = {}) {
  const store = options.store ?? createIndexedDbGuideStore();
  const languages = options.languages ?? (typeof navigator === "undefined" ? [] : navigator.languages);
  const locale = languages[0]?.toLowerCase().split("-")[0] === "de" ? "de" : "en";
  const preferences = signal<AppPreferences>({ uiLocale: locale, labelLocale: locale, activeLibraryId: "kitchen", theme: "light" });
  const preferenceSaveState = signal<PreferenceSaveState>("loading");
  let initialization: Promise<void> | undefined;
  let tail = Promise.resolve(); let serial = 0; let writable = false;
  let initialized = false; let intent = preferences.peek();
  const startupPatches: Partial<AppPreferences>[] = [];
  let pendingPatch: Partial<AppPreferences> = {};
  const recovered = new Set<string>();
  function readPreferences(transaction: GuideTransaction): { value: AppPreferences; recoveryFingerprint?: string } {
    const raw = transaction.get(PREFERENCES_KEY);
    if (raw === undefined && !transaction.entries().some(([key]) => key === PREFERENCES_KEY)) return { value: intent };
    const value = object(raw) && raw.version === 1 ? raw.preferences : undefined;
    const clean = validated(value);
    // Theme is an additive v1 field. Older valid records default to light.
    const compatible = object(value) && !Object.prototype.hasOwnProperty.call(value, "theme")
      ? { ...value, theme: "light" } : value;
    const envelope = object(raw) ? { ...raw, preferences: compatible } : raw;
    if (rawFingerprint(envelope) !== rawFingerprint({ version: 1, preferences: clean })) {
      const recoveryFingerprint = rawFingerprint(raw);
      if (!recovered.has(recoveryFingerprint)) {
        const key = `instruction-builder:recovery:${options.now?.() ?? new Date().toISOString()}:${options.newId?.() ?? crypto.randomUUID()}`;
        transaction.add(key, raw);
      }
      return { value: clean, recoveryFingerprint };
    }
    return { value: clean };
  }
  function initializePreferences(): Promise<void> {
    initialization ??= store.transaction({ keys: [PREFERENCES_KEY], mode: "readwrite" }, readPreferences).then(({ value, recoveryFingerprint }) => {
      if (recoveryFingerprint !== undefined) recovered.add(recoveryFingerprint);
      intent = value; initialized = true; writable = true;
      preferences.value = startupPatches.reduce<AppPreferences>((current, patch) => validated({ ...current, ...patch }), value);
      startupPatches.length = 0;
      if (serial === 0) preferenceSaveState.value = "saved";
    })
      .catch(() => { preferenceSaveState.value = "unavailable"; });
    return initialization;
  }
  function updatePreferences(patch: Partial<AppPreferences>): Promise<void> {
    const capturedPatch = { ...patch };
    if (!initialized) startupPatches.push(capturedPatch);
    const snapshot = validated({ ...preferences.peek(), ...patch });
    preferences.value = snapshot;
    const version = ++serial; preferenceSaveState.value = "pending";
    tail = tail.then(async () => {
      await initializePreferences();
      if (!writable) { preferenceSaveState.value = "unavailable"; return; }
      // Retain failed local intent, but never replay fields this controller did not change.
      pendingPatch = { ...pendingPatch, ...capturedPatch };
      if (version === serial) preferenceSaveState.value = "saving";
      try {
        const { value, recoveryFingerprint } = await store.transaction({ keys: [PREFERENCES_KEY], mode: "readwrite" }, (transaction) => {
          const current = readPreferences(transaction);
          const value = validated({ ...current.value, ...pendingPatch });
          transaction.put(PREFERENCES_KEY, { version: 1, preferences: value });
          return { ...current, value };
        });
        if (recoveryFingerprint !== undefined) recovered.add(recoveryFingerprint);
        intent = value; pendingPatch = {};
        if (version === serial) preferences.value = value;
        if (version === serial) preferenceSaveState.value = "saved";
      } catch { if (version === serial) preferenceSaveState.value = "unavailable"; }
    });
    return tail;
  }
  return { preferences, preferenceSaveState, initializePreferences, updatePreferences };
}

export type PreferencesController = ReturnType<typeof createPreferencesController>;
const controller = createPreferencesController();
export const { preferences, preferenceSaveState, initializePreferences, updatePreferences } = controller;
