import { createMemoryStorage } from "../test/memory-storage";
import { effect } from "@preact/signals";
import { describe, expect, it } from "vitest";
import { createPreferencesController, PREFERENCES_KEY } from "./preferences";
import type { StorageStore } from "../lib/storage";

function storage(seed?: unknown) {
  const records = new Map<string, unknown>(); if (seed !== undefined) records.set(PREFERENCES_KEY, seed);
  const state = { fail: false, failures: 0, failBackup: false, failRead: false, pause: undefined as Promise<void> | undefined, onStart: undefined as (() => void) | undefined };
  const pauses: (Promise<void> | undefined)[] = [];
  const data = createMemoryStorage({ records,
    beforeTransaction: () => { state.onStart?.(); return pauses.shift(); },
    beforeGet: () => { if (state.failRead) throw new Error("read unavailable"); },
    beforeWrite: (kind) => { if (kind === "add" && state.failBackup) throw new Error("backup unavailable"); },
    beforeCommit: () => {
      if (state.fail) throw new Error("quota");
      if (state.failures > 0) { state.failures--; throw new Error("quota"); }
    },
  });
  const store: StorageStore = { transaction: (plan, operation) => {
    // Preference tests capture the pause when queued, not when execution begins.
    pauses.push(state.pause);
    return data.store.transaction(plan, operation);
  } };
  return { records, store, state };
}

describe("local preferences", () => {
  it("explicit retry rechecks a failed startup read and adopts saved preferences without rewriting them", async () => {
    const raw = { version: 1, preferences: { uiLocale: "de", labelLocale: "en", activeLibraryId: "learning", lastGuideId: "saved" } };
    const { store, records, state } = storage(raw); const controller = createPreferencesController({ store, languages: ["en"] });
    state.failRead = true; await controller.initializePreferences();
    expect(controller.preferenceSaveState.value).toBe("unavailable");
    await controller.retryPreferences(); expect(controller.preferenceSaveState.value).toBe("unavailable");
    state.failRead = false; await controller.retryPreferences();
    expect(controller.preferences.value).toEqual({ uiLocale: "de", labelLocale: "en", activeLibraryId: "learning", lastGuideId: "saved", theme: "light" });
    expect(controller.preferenceSaveState.value).toBe("saved");
    expect([...records]).toEqual([[PREFERENCES_KEY, raw]]);
  });

  it("startup retry saves retained local patches while adopting another tab's untouched fields", async () => {
    const { store, records, state } = storage();
    const external = createPreferencesController({ store, languages: ["en"] }); await external.initializePreferences();
    const controller = createPreferencesController({ store, languages: ["en"] });
    state.failRead = true; await controller.initializePreferences();
    await controller.updatePreferences({ theme: "dark", lastGuideId: "first" });
    await controller.updatePreferences({ lastGuideId: undefined });
    state.failRead = false; await external.updatePreferences({ uiLocale: "de", activeLibraryId: "routines", lastGuideId: "external" });
    await controller.retryPreferences();
    const expected = { uiLocale: "de", labelLocale: "en", activeLibraryId: "routines", theme: "dark" };
    expect(controller.preferences.value).toEqual(expected);
    expect(controller.preferenceSaveState.value).toBe("saved");
    expect(records.get(PREFERENCES_KEY)).toEqual({ version: 1, preferences: expected });
  });

  it("retrying a failed save keeps failed intent and merges another tab's intervening commit", async () => {
    const { store, records, state } = storage();
    const controller = createPreferencesController({ store, languages: ["en"] }), external = createPreferencesController({ store, languages: ["en"] });
    await Promise.all([controller.initializePreferences(), external.initializePreferences()]);
    state.fail = true; await controller.updatePreferences({ theme: "dark" }); state.fail = false;
    await external.updatePreferences({ uiLocale: "de", lastGuideId: "external" });
    await controller.retryPreferences();
    const expected = { uiLocale: "de", labelLocale: "en", activeLibraryId: "kitchen", theme: "dark", lastGuideId: "external" };
    expect(records.get(PREFERENCES_KEY)).toEqual({ version: 1, preferences: expected });
    expect(controller.preferences.value).toEqual(expected);
    expect(controller.preferenceSaveState.value).toBe("saved");
  });

  it("retrying an empty failed patch cannot claim saved while storage remains unavailable", async () => {
    const { store, records, state } = storage(); const controller = createPreferencesController({ store, languages: ["en"] });
    await controller.initializePreferences(); state.fail = true;
    await controller.updatePreferences({}); await controller.retryPreferences();
    expect(controller.preferenceSaveState.value).toBe("unavailable");
    expect([...records]).toEqual([]);
    state.fail = false; await controller.retryPreferences();
    expect(records.get(PREFERENCES_KEY)).toEqual({ version: 1, preferences: { uiLocale: "en", labelLocale: "en", activeLibraryId: "kitchen", theme: "light" } });
    expect(controller.preferenceSaveState.value).toBe("saved");
  });

  it.each(["startup", "save"])("%s backup retry remains unavailable until exact diagnostic preservation commits", async (when) => {
    const { store, records, state } = storage(); const controller = createPreferencesController({ store, languages: ["en"] });
    if (when === "save") await controller.initializePreferences();
    const raw = { version: 99, retained: new Map([["exact", new Uint8Array([3, 255])]]) }; records.set(PREFERENCES_KEY, raw);
    state.failBackup = true;
    if (when === "startup") await controller.initializePreferences();
    await controller.updatePreferences({ theme: "dark" });
    for (let attempt = 0; attempt < 2; attempt++) {
      await controller.retryPreferences();
      expect(controller.preferenceSaveState.value).toBe("unavailable");
      expect([...records]).toEqual([[PREFERENCES_KEY, raw]]);
      expect(controller.preferences.value.theme).toBe("dark");
    }
    state.failBackup = false; await controller.retryPreferences();
    expect([...records].filter(([key]) => key.startsWith("instruction-builder:recovery:")).map(([, value]) => value)).toEqual([raw]);
    expect(records.get(PREFERENCES_KEY)).toEqual({ version: 1, preferences: { uiLocale: "en", labelLocale: "en", activeLibraryId: "kitchen", theme: "dark" } });
    expect(controller.preferenceSaveState.value).toBe("saved");
  });

  it("simultaneous explicit retries share one operation while initialization is paused", async () => {
    const { store, records, state } = storage({ version: 99, exact: "retained" });
    const controller = createPreferencesController({ store, languages: ["en"] });
    state.failBackup = true; await controller.initializePreferences(); state.failBackup = false;
    let release!: () => void; state.pause = new Promise<void>((resolve) => { release = resolve; });
    const first = controller.retryPreferences(), second = controller.retryPreferences();
    expect(second).toBe(first); expect(controller.preferenceSaveState.value).not.toBe("saved");
    release(); await Promise.all([first, second]);
    expect([...records].filter(([key]) => key.startsWith("instruction-builder:recovery:")).map(([, value]) => value)).toEqual([{ version: 99, exact: "retained" }]);
    expect(controller.preferenceSaveState.value).toBe("saved");
  });

  it("a user update during startup retry remains visible and saves after the retained older patch", async () => {
    const raw = { version: 1, preferences: { uiLocale: "de", labelLocale: "de", activeLibraryId: "learning", theme: "light", lastGuideId: "saved" } };
    const { store, records, state } = storage(raw); const controller = createPreferencesController({ store, languages: ["en"] });
    state.failRead = true; await controller.updatePreferences({ theme: "dark", lastGuideId: "older" }); state.failRead = false;
    let release!: () => void; state.pause = new Promise<void>((resolve) => { release = resolve; });
    let entered!: () => void; const started = new Promise<void>((resolve) => { entered = resolve; }); state.onStart = entered;
    const retry = controller.retryPreferences(); await started;
    const update = controller.updatePreferences({ theme: "light", lastGuideId: "latest" });
    const observed: string[] = []; const dispose = effect(() => { observed.push(controller.preferences.value.lastGuideId ?? "none"); });
    expect(controller.preferences.value).toMatchObject({ theme: "light", lastGuideId: "latest" });
    release(); await Promise.all([retry, update]); dispose();
    expect(observed.every((id) => id === "latest")).toBe(true);
    const expected = { uiLocale: "de", labelLocale: "de", activeLibraryId: "learning", theme: "light", lastGuideId: "latest" };
    expect(controller.preferences.value).toEqual(expected);
    expect(records.get(PREFERENCES_KEY)).toEqual({ version: 1, preferences: expected });
    expect(controller.preferenceSaveState.value).toBe("saved");
  });

  it("retry drains earlier queued writes and cannot overwrite a newer update queued during its wait", async () => {
    const { store, records, state } = storage(); const controller = createPreferencesController({ store, languages: ["en"] });
    await controller.initializePreferences();
    let release!: () => void; state.pause = new Promise<void>((resolve) => { release = resolve; });
    let entered!: () => void; const started = new Promise<void>((resolve) => { entered = resolve; }); state.onStart = entered;
    state.failures = 1; const first = controller.updatePreferences({ theme: "dark", lastGuideId: "older" }); await started;
    const retry = controller.retryPreferences();
    const latest = controller.updatePreferences({ lastGuideId: "latest" });
    const observed: string[] = []; const dispose = effect(() => { observed.push(controller.preferences.value.lastGuideId ?? "none"); });
    release(); await Promise.all([first, retry, latest]); dispose();
    expect(observed.every((id) => id === "latest")).toBe(true);
    expect(records.get(PREFERENCES_KEY)).toEqual({ version: 1, preferences: { uiLocale: "en", labelLocale: "en", activeLibraryId: "kitchen", theme: "dark", lastGuideId: "latest" } });
    expect(controller.preferenceSaveState.value).toBe("saved");
  });

  it("a stale controller changes only its patch and adopts another controller's saved fields", async () => {
    const raw = { version: 1, preferences: { uiLocale: "en", labelLocale: "en", activeLibraryId: "kitchen", theme: "light" } };
    const { store, records } = storage(raw);
    const first = createPreferencesController({ store }), stale = createPreferencesController({ store });
    await Promise.all([first.initializePreferences(), stale.initializePreferences()]);
    await first.updatePreferences({ uiLocale: "de", theme: "dark" });
    await stale.updatePreferences({ lastGuideId: "chosen-guide" });
    const expected = { uiLocale: "de", labelLocale: "en", activeLibraryId: "kitchen", theme: "dark", lastGuideId: "chosen-guide" };
    expect(records.get(PREFERENCES_KEY)).toEqual({ version: 1, preferences: expected });
    expect(stale.preferences.value).toEqual(expected);
    expect(stale.preferenceSaveState.value).toBe("saved");
  });

  it("concurrent controllers preserve disjoint patches in storage transaction order", async () => {
    const { store, records, state } = storage();
    const first = createPreferencesController({ store, languages: ["en"] }), second = createPreferencesController({ store, languages: ["en"] });
    await Promise.all([first.initializePreferences(), second.initializePreferences()]);
    let release!: () => void; state.pause = new Promise<void>((resolve) => { release = resolve; });
    const changes = [first.updatePreferences({ uiLocale: "de", theme: "dark" }), second.updatePreferences({ activeLibraryId: "routines", lastGuideId: "routine" })];
    release(); await Promise.all(changes);
    expect(records.get(PREFERENCES_KEY)).toEqual({ version: 1, preferences: { uiLocale: "de", labelLocale: "en", activeLibraryId: "routines", theme: "dark", lastGuideId: "routine" } });
  });

  it("the later overlapping patch wins without reverting unrelated committed fields", async () => {
    const { store, records } = storage();
    const first = createPreferencesController({ store, languages: ["en"] }), second = createPreferencesController({ store, languages: ["en"] });
    await Promise.all([first.initializePreferences(), second.initializePreferences()]);
    await Promise.all([first.updatePreferences({ uiLocale: "de", theme: "dark" }), second.updatePreferences({ theme: "light", labelLocale: "de" })]);
    expect(records.get(PREFERENCES_KEY)).toEqual({ version: 1, preferences: { uiLocale: "de", labelLocale: "de", activeLibraryId: "kitchen", theme: "light" } });
  });

  it("explicit undefined removes lastGuideId while adopting other tabs' changes", async () => {
    const raw = { version: 1, preferences: { uiLocale: "en", labelLocale: "en", activeLibraryId: "kitchen", theme: "light", lastGuideId: "old" } };
    const { store, records } = storage(raw);
    const first = createPreferencesController({ store }), second = createPreferencesController({ store });
    await Promise.all([first.initializePreferences(), second.initializePreferences()]);
    await first.updatePreferences({ theme: "dark", lastGuideId: "new" });
    await second.updatePreferences({ lastGuideId: undefined });
    expect(records.get(PREFERENCES_KEY)).toEqual({ version: 1, preferences: { uiLocale: "en", labelLocale: "en", activeLibraryId: "kitchen", theme: "dark" } });
    expect(second.preferences.value).not.toHaveProperty("lastGuideId");
  });

  it("rapid local patches keep optimistic intent while adopting fresh persisted fields", async () => {
    const { store, records, state } = storage();
    const first = createPreferencesController({ store, languages: ["en"] }), second = createPreferencesController({ store, languages: ["en"] });
    await Promise.all([first.initializePreferences(), second.initializePreferences()]);
    await first.updatePreferences({ uiLocale: "de", theme: "dark" });
    let release!: () => void; state.pause = new Promise<void>((resolve) => { release = resolve; });
    const pending = [second.updatePreferences({ labelLocale: "de", lastGuideId: "first" }), second.updatePreferences({ lastGuideId: "second" }), second.updatePreferences({ activeLibraryId: "learning" })];
    expect(second.preferences.value).toMatchObject({ labelLocale: "de", lastGuideId: "second", activeLibraryId: "learning" });
    expect(second.preferenceSaveState.value).toBe("pending");
    release(); await Promise.all(pending);
    const expected = { uiLocale: "de", labelLocale: "de", activeLibraryId: "learning", theme: "dark", lastGuideId: "second" };
    expect(records.get(PREFERENCES_KEY)).toEqual({ version: 1, preferences: expected });
    expect(second.preferences.value).toEqual(expected);
  });

  it("a subsequent save retains failed local intent while merging another controller's patch", async () => {
    const { store, records, state } = storage();
    const first = createPreferencesController({ store, languages: ["en"] }), second = createPreferencesController({ store, languages: ["en"] });
    await Promise.all([first.initializePreferences(), second.initializePreferences()]);
    state.fail = true; await second.updatePreferences({ theme: "dark" }); state.fail = false;
    expect(second.preferenceSaveState.value).toBe("unavailable");
    await first.updatePreferences({ uiLocale: "de" });
    await second.updatePreferences({ lastGuideId: "guide" });
    expect(records.get(PREFERENCES_KEY)).toEqual({ version: 1, preferences: { uiLocale: "de", labelLocale: "en", activeLibraryId: "kitchen", theme: "dark", lastGuideId: "guide" } });
    expect(second.preferenceSaveState.value).toBe("saved");
  });

  it("an older failed save cannot report unavailable for a newer pending patch", async () => {
    const { store, records, state } = storage();
    const controller = createPreferencesController({ store, languages: ["en"] }); await controller.initializePreferences();
    const states: string[] = []; const dispose = effect(() => { states.push(controller.preferenceSaveState.value); });
    state.failures = 1;
    await Promise.all([controller.updatePreferences({ theme: "dark" }), controller.updatePreferences({ uiLocale: "de" })]);
    dispose();
    expect(states).not.toContain("unavailable");
    expect(controller.preferenceSaveState.value).toBe("saved");
    expect(records.get(PREFERENCES_KEY)).toEqual({ version: 1, preferences: { uiLocale: "de", labelLocale: "en", activeLibraryId: "kitchen", theme: "dark" } });
  });

  it.each([
    { raw: { version: 1, preferences: { uiLocale: "fr", labelLocale: "de", activeLibraryId: "unknown", theme: "system", bytes: new Uint8Array([0, 255]) } }, labelLocale: "de" },
    { raw: { version: 99, future: new Map([["binary", new Uint8Array([2, 7])]]) }, labelLocale: "en" },
    { raw: { version: 1, preferences: { uiLocale: "en", labelLocale: "en", activeLibraryId: "kitchen", theme: "light" }, unknownEnvelopeData: new Set(["retained"]) }, labelLocale: "en" },
    { raw: undefined, labelLocale: "en" },
  ])("backs up exact malformed data introduced after startup before replacing it: %j", async ({ raw, labelLocale }) => {
    const { store, records } = storage(); const controller = createPreferencesController({ store, languages: ["en"] });
    await controller.initializePreferences(); records.set(PREFERENCES_KEY, raw);
    await controller.updatePreferences({ theme: "dark" });
    expect([...records].filter(([key]) => key.startsWith("instruction-builder:recovery:")).map(([, value]) => value)).toEqual([raw]);
    expect(records.get(PREFERENCES_KEY)).toEqual({ version: 1, preferences: { uiLocale: "en", labelLocale, activeLibraryId: "kitchen", theme: "dark" } });
    expect(controller.preferenceSaveState.value).toBe("saved");
  });

  it("a failed backup after startup blocks overwrite and permits a later safe save", async () => {
    const { store, records, state } = storage(); const controller = createPreferencesController({ store, languages: ["en"] });
    await controller.initializePreferences(); const raw = { version: 99, future: { exact: ["payload"] } }; records.set(PREFERENCES_KEY, raw);
    state.failBackup = true; await controller.updatePreferences({ theme: "dark" });
    expect([...records]).toEqual([[PREFERENCES_KEY, raw]]);
    expect(controller.preferences.value.theme).toBe("dark");
    expect(controller.preferenceSaveState.value).toBe("unavailable");
    state.failBackup = false; await controller.updatePreferences({ uiLocale: "de" });
    expect([...records].filter(([key]) => key.startsWith("instruction-builder:recovery:")).map(([, value]) => value)).toEqual([raw]);
    expect(records.get(PREFERENCES_KEY)).toEqual({ version: 1, preferences: { uiLocale: "de", labelLocale: "en", activeLibraryId: "kitchen", theme: "dark" } });
    expect(controller.preferenceSaveState.value).toBe("saved");
  });

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
