import { describe, expect, it } from "vitest";
import { createPreferencesController, PREFERENCES_KEY } from "./preferences";
import type { GuideStore } from "../lib/guide-repository";

function storage(seed?: unknown) {
  const records = new Map<string, unknown>(); if (seed !== undefined) records.set(PREFERENCES_KEY, seed);
  const state = { fail: false, pause: undefined as Promise<void> | undefined };
  const store: GuideStore = { transaction: async (plan, operation) => {
    await state.pause; const draft = structuredClone(records);
    const declared = (key: string) => plan.keys?.includes(key) || (plan.prefix !== undefined && key.startsWith(plan.prefix));
    const put = (key: string, value: unknown) => { if (plan.mode === "readonly") throw new Error("readonly"); draft.set(key, structuredClone(value)); };
    const result = operation({ get: (key) => { if (!declared(key)) throw new Error("undeclared read"); return draft.get(key); },
      entries: () => { if (plan.prefix === undefined && !plan.keys?.length) throw new Error("undeclared entries"); return [...draft].filter(([key]) => declared(key)); },
      put, add: (key, value) => { if (draft.has(key)) throw new Error("insert collision"); put(key, value); } });
    if (state.fail) throw new Error("quota");
    records.clear(); for (const [key, value] of draft) records.set(key, value); return result;
  } };
  return { records, store, state };
}

describe("local preferences", () => {
  it("uses supported browser language only for a new profile", async () => {
    for (const [language, expected] of [["de-DE", "de"], ["fr-FR", "en"], ["en-GB", "en"]]) {
      const { store } = storage(); const controller = createPreferencesController({ store, languages: [language] });
      await controller.initializePreferences();
      expect(controller.preferences.value).toEqual({ uiLocale: expected, labelLocale: expected, activeLibraryId: "kitchen", theme: "light" });
    }
  });

  it("retains malformed raw preferences and applies safe field defaults", async () => {
    const raw = { version: 1, preferences: { uiLocale: "fr", labelLocale: "de", activeLibraryId: "unknown", lastGuideId: 4 } };
    const { store, records } = storage(raw); const controller = createPreferencesController({ store, languages: ["de"] });
    await controller.initializePreferences();
    expect(controller.preferences.value).toEqual({ uiLocale: "en", labelLocale: "de", activeLibraryId: "kitchen", theme: "light" });
    expect(records.get(PREFERENCES_KEY)).toEqual(raw);
    expect([...records].filter(([key]) => key.startsWith("instruction-builder:recovery:"))[0][1]).toEqual(raw);
    await controller.updatePreferences({ uiLocale: "de" });
    expect(records.get(PREFERENCES_KEY)).toMatchObject({ version: 1, preferences: { uiLocale: "de" } });
  });

  it("serializes immediate preference changes and reports commit rather than availability", async () => {
    const { store, records, state } = storage(); const controller = createPreferencesController({ store, languages: ["en"] });
    await controller.initializePreferences();
    let release!: () => void; state.pause = new Promise<void>((resolve) => { release = resolve; });
    const first = controller.updatePreferences({ uiLocale: "de" });
    const second = controller.updatePreferences({ activeLibraryId: "learning", lastGuideId: "guide" });
    expect(controller.preferences.value).toMatchObject({ uiLocale: "de", activeLibraryId: "learning" });
    expect(controller.preferenceSaveState.value).not.toBe("saved");
    release(); await Promise.all([first, second]);
    expect(records.get(PREFERENCES_KEY)).toEqual({ version: 1, preferences: controller.preferences.value });
    expect(controller.preferenceSaveState.value).toBe("saved");
    state.fail = true; await controller.updatePreferences({ labelLocale: "de" });
    expect(controller.preferenceSaveState.value).toBe("unavailable");
    expect(controller.preferences.value.labelLocale).toBe("de");
    expect((records.get(PREFERENCES_KEY) as { preferences: { labelLocale: string } }).preferences.labelLocale).toBe("en");
  });

  it("a failed diagnostic copy leaves the invalid record untouched", async () => {
    const raw = { version: 99, future: "raw" }; const { store, records, state } = storage(raw); state.fail = true;
    const controller = createPreferencesController({ store }); await controller.initializePreferences();
    await controller.updatePreferences({ uiLocale: "de" });
    expect(controller.preferenceSaveState.value).toBe("unavailable"); expect(records.get(PREFERENCES_KEY)).toEqual(raw);
  });

  it("updates during initialization remain visible and preserve untouched saved preferences", async () => {
    const raw = { version: 1, preferences: { uiLocale: "de", labelLocale: "en", activeLibraryId: "routines", lastGuideId: "saved-guide" } };
    const { store, records, state } = storage(raw); const controller = createPreferencesController({ store, languages: ["en"] });
    let release!: () => void; state.pause = new Promise<void>((resolve) => { release = resolve; });
    const initialize = controller.initializePreferences(); const update = controller.updatePreferences({ labelLocale: "de" });
    expect(controller.preferences.value.labelLocale).toBe("de"); release(); await initialize;
    expect(controller.preferences.value.labelLocale).toBe("de"); expect(controller.preferenceSaveState.value).not.toBe("saved");
    await update;
    expect(controller.preferences.value).toEqual({ uiLocale: "de", labelLocale: "de", activeLibraryId: "routines", lastGuideId: "saved-guide", theme: "light" });
    expect(records.get(PREFERENCES_KEY)).toEqual({ version: 1, preferences: controller.preferences.value });
  });

  it("loads an older v1 record in light mode without diagnostic recovery or an initial overwrite", async () => {
    const raw = { version: 1, preferences: { uiLocale: "de", labelLocale: "en", activeLibraryId: "learning", lastGuideId: "saved-guide" } };
    const { store, records } = storage(raw); const controller = createPreferencesController({ store, languages: ["en"] });
    await controller.initializePreferences();
    expect(controller.preferences.value).toEqual({ uiLocale: "de", labelLocale: "en", activeLibraryId: "learning", lastGuideId: "saved-guide", theme: "light" });
    expect([...records]).toEqual([[PREFERENCES_KEY, raw]]);
    expect(controller.preferenceSaveState.value).toBe("saved");
  });

  it("persists the chosen theme across reload without changing guides or other preferences", async () => {
    const raw = { version: 1, preferences: { uiLocale: "de", labelLocale: "en", activeLibraryId: "routines", lastGuideId: "saved-guide" } };
    const guide = { revision: 3, document: { title: "Authored guide", history: ["preserved"] } };
    const { store, records } = storage(raw); records.set("instruction-builder:guide:saved-guide", guide);
    const controller = createPreferencesController({ store }); await controller.initializePreferences();
    await controller.updatePreferences({ theme: "dark" });
    const persisted = { version: 1, preferences: { uiLocale: "de", labelLocale: "en", activeLibraryId: "routines", lastGuideId: "saved-guide", theme: "dark" } };
    expect(records.get(PREFERENCES_KEY)).toEqual(persisted);
    expect([...records]).toEqual([[PREFERENCES_KEY, persisted], ["instruction-builder:guide:saved-guide", guide]]);
    const reloaded = createPreferencesController({ store, languages: ["en"] }); await reloaded.initializePreferences();
    expect(reloaded.preferences.value).toEqual(persisted.preferences);
    expect(reloaded.preferenceSaveState.value).toBe("saved");
    await reloaded.updatePreferences({ theme: "light" });
    expect(records.get(PREFERENCES_KEY)).toEqual({ version: 1, preferences: { ...persisted.preferences, theme: "light" } });
  });

  it.each(["system", "", null, 42])("recovers an invalid stored theme %j and displays light mode", async (theme) => {
    const raw = { version: 1, preferences: { uiLocale: "de", labelLocale: "en", activeLibraryId: "kitchen", theme } };
    const { store, records } = storage(raw); const controller = createPreferencesController({ store });
    await controller.initializePreferences();
    expect(controller.preferences.value).toEqual({ uiLocale: "de", labelLocale: "en", activeLibraryId: "kitchen", theme: "light" });
    expect(records.get(PREFERENCES_KEY)).toEqual(raw);
    expect([...records].filter(([key]) => key.startsWith("instruction-builder:recovery:")).map(([, value]) => value)).toEqual([raw]);
  });

  it("a theme change queued during startup preserves loaded locales and guide selection", async () => {
    const raw = { version: 1, preferences: { uiLocale: "de", labelLocale: "de", activeLibraryId: "learning", lastGuideId: "saved-guide", theme: "light" } };
    const { store, records, state } = storage(raw); const controller = createPreferencesController({ store, languages: ["en"] });
    let release!: () => void; state.pause = new Promise<void>((resolve) => { release = resolve; });
    const initialize = controller.initializePreferences(), update = controller.updatePreferences({ theme: "dark" });
    expect(controller.preferences.value).toMatchObject({ theme: "dark" }); release(); await initialize;
    expect(controller.preferences.value).toMatchObject({ theme: "dark" }); await update;
    expect(controller.preferences.value).toEqual({ uiLocale: "de", labelLocale: "de", activeLibraryId: "learning", lastGuideId: "saved-guide", theme: "dark" });
    expect([...records]).toEqual([[PREFERENCES_KEY, { version: 1, preferences: controller.preferences.value }]]);
  });

  it("keeps a chosen theme usable when its save fails while retaining the saved record", async () => {
    const raw = { version: 1, preferences: { uiLocale: "en", labelLocale: "en", activeLibraryId: "kitchen", theme: "light" } };
    const { store, records, state } = storage(raw); const controller = createPreferencesController({ store });
    await controller.initializePreferences(); state.fail = true; await controller.updatePreferences({ theme: "dark" });
    expect(controller.preferences.value).toMatchObject({ theme: "dark" });
    expect(controller.preferenceSaveState.value).toBe("unavailable");
    expect(records.get(PREFERENCES_KEY)).toEqual(raw);
  });
});
