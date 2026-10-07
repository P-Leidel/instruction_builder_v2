import assert from "node:assert/strict";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../../", import.meta.url));
const server = process.argv[2] ? undefined : await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false } });
await server?.listen();
const url = process.argv[2] ?? `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await chromium.launch();
const context = await browser.newContext({ serviceWorkers: "block" });
const errors = [];
const read = (page) => page.evaluate(async () => {
  const { store, key } = window.preferenceHarness;
  return store.transaction({ keys: [key], mode: "readonly" }, tx => tx.get(key));
});
const update = (page, patch) => page.evaluate(async (patch) => {
  const { controller } = window.preferenceHarness;
  await controller.updatePreferences(patch);
  return { preferences: controller.preferences.peek(), status: controller.preferenceSaveState.peek() };
}, patch);
try {
  const a = await context.newPage(), b = await context.newPage();
  for (const page of [a, b]) {
    page.on("pageerror", error => errors.push(error.message));
    await page.route(url, route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Preference merge checks</title>" }));
    await page.goto(url);
    await page.evaluate(async () => {
      const { createIndexedDbGuideStore } = await import("/src/lib/guide-repository.ts");
      const { createPreferencesController, PREFERENCES_KEY } = await import("/src/state/preferences.ts");
      const store = createIndexedDbGuideStore();
      const controller = createPreferencesController({ store, languages: ["en"] });
      await controller.initializePreferences();
      window.preferenceHarness = { store, controller, key: PREFERENCES_KEY };
    });
  }
  await update(a, { uiLocale: "de", theme: "dark" });
  assert.deepEqual(await update(b, { lastGuideId: "selected-in-b" }), {
    preferences: { uiLocale: "de", labelLocale: "en", activeLibraryId: "kitchen", theme: "dark", lastGuideId: "selected-in-b" }, status: "saved",
  });
  assert.deepEqual(await read(b), { version: 1, preferences: { uiLocale: "de", labelLocale: "en", activeLibraryId: "kitchen", theme: "dark", lastGuideId: "selected-in-b" } });
  console.log("NATIVE_TWO_TAB_STALE_PATCH_MERGE=PASS");

  await Promise.all([update(a, { uiLocale: "en", theme: "light" }), update(b, { labelLocale: "de", activeLibraryId: "learning" })]);
  assert.deepEqual(await read(a), { version: 1, preferences: { uiLocale: "en", labelLocale: "de", activeLibraryId: "learning", theme: "light", lastGuideId: "selected-in-b" } });
  await update(a, { lastGuideId: undefined });
  assert.deepEqual(await read(b), { version: 1, preferences: { uiLocale: "en", labelLocale: "de", activeLibraryId: "learning", theme: "light" } });
  console.log("NATIVE_CONCURRENT_DISJOINT_PATCHES_AND_EXPLICIT_REMOVAL=PASS");

  const startup = await b.evaluate(async () => {
    const { createPreferencesController } = await import("/src/state/preferences.ts");
    const { store } = window.preferenceHarness;
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const controller = createPreferencesController({ store: { transaction: async (plan, operation) => { await gate; return store.transaction(plan, operation); } }, languages: ["en"] });
    const initial = controller.initializePreferences();
    const first = controller.updatePreferences({ theme: "dark", lastGuideId: "startup-one" });
    const second = controller.updatePreferences({ lastGuideId: "startup-two" });
    const optimistic = controller.preferences.peek();
    release(); await Promise.all([initial, first, second]);
    return { optimistic, preferences: controller.preferences.peek(), status: controller.preferenceSaveState.peek() };
  });
  assert.equal(startup.optimistic.theme, "dark"); assert.equal(startup.optimistic.lastGuideId, "startup-two");
  assert.deepEqual(startup.preferences, { uiLocale: "en", labelLocale: "de", activeLibraryId: "learning", theme: "dark", lastGuideId: "startup-two" });
  assert.equal(startup.status, "saved");
  console.log("NATIVE_STARTUP_AND_RAPID_LOCAL_INTENT=PASS");

  const backup = await b.evaluate(async () => {
    const { store, key, controller } = window.preferenceHarness;
    const raw = { version: 99, bytes: new Uint8Array([0, 255]), map: new Map([["retained", new Set(["exact"])]]), date: new Date("2026-10-07T00:00:00Z") };
    raw.cycle = raw;
    await store.transaction({}, tx => tx.put(key, raw));
    const nativeAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (value, key) {
      if (String(key).startsWith("instruction-builder:recovery:")) throw new DOMException("Injected backup failure", "QuotaExceededError");
      return nativeAdd.call(this, value, key);
    };
    let failure;
    try {
      await controller.updatePreferences({ theme: "dark" });
      failure = { status: controller.preferenceSaveState.peek(), storedVersion: (await store.transaction({ keys: [key], mode: "readonly" }, tx => tx.get(key))).version };
    } finally { IDBObjectStore.prototype.add = nativeAdd; }
    await controller.updatePreferences({ uiLocale: "de" });
    const copies = await store.transaction({ prefix: "instruction-builder:recovery:", mode: "readonly" }, tx => tx.entries().map(([, copy]) => ({ version: copy.version, cycle: copy.cycle === copy, bytes: [...copy.bytes], map: [...copy.map.get("retained")], date: copy.date.toISOString() })));
    return { failure, copies, status: controller.preferenceSaveState.peek() };
  });
  assert.deepEqual(backup, { failure: { status: "unavailable", storedVersion: 99 }, copies: [{ version: 99, cycle: true, bytes: [0, 255], map: ["exact"], date: "2026-10-07T00:00:00.000Z" }], status: "saved" });
  assert.deepEqual(await read(b), { version: 1, preferences: { uiLocale: "de", labelLocale: "en", activeLibraryId: "kitchen", theme: "dark" } });
  console.log("NATIVE_POST_STARTUP_EXACT_RECOVERY_AND_FAILED_BACKUP=PASS");

  await b.evaluate(async () => {
    const { controller } = window.preferenceHarness;
    const nativePut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) { const request = nativePut.apply(this, args); this.transaction.abort(); return request; };
    try { await controller.updatePreferences({ theme: "light" }); } finally { IDBObjectStore.prototype.put = nativePut; }
  });
  assert.deepEqual(await read(a), { version: 1, preferences: { uiLocale: "de", labelLocale: "en", activeLibraryId: "kitchen", theme: "dark" } });
  await update(a, { labelLocale: "de" });
  assert.deepEqual(await update(b, { lastGuideId: "after-failure" }), { preferences: { uiLocale: "de", labelLocale: "de", activeLibraryId: "kitchen", theme: "light", lastGuideId: "after-failure" }, status: "saved" });
  console.log("NATIVE_FAILED_PATCH_RETRY_MERGES_OTHER_TAB_COMMIT=PASS");
  assert.deepEqual(errors, [], "No browser page errors");
  console.log("PREFERENCE_MERGE_CHECKS=PASS");
} finally { await context.close(); await browser.close(); await server?.close(); }
