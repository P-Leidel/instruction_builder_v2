import assert from "node:assert/strict";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { fixture, records, createBlank } from "./editor-browser-helpers.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const server = process.argv[2] ? undefined : await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false } });
await server?.listen();
const url = process.argv[2] ?? `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await chromium.launch();
const evidence = path.join(root, "artifacts", "startup-retry"); await mkdir(evidence, { recursive: true });
const errors = [];
const legacyKey = "instruction-builder:document", guideKey = "instruction-builder:guide:retry-guide";
const preferencesKey = "instruction-builder:preferences:v1", migrationKey = "instruction-builder:guides-migration:v1";
const original = fixture([1]); original.meta.title = "Recovered startup guide";
const guide = { id: "retry-guide", revision: 1, createdAt: original.meta.createdAt, updatedAt: original.meta.createdAt, document: original };

async function failedBoot(seed, fault) {
  const context = await browser.newContext({ locale: "en-US", serviceWorkers: "block" });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.route(url, route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Startup fixture</title>" }));
  await page.goto(url);
  await page.evaluate(entries => new Promise((resolve, reject) => {
    const request = indexedDB.open("keyval-store", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("keyval");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, transaction = db.transaction("keyval", "readwrite");
      for (const [key, value] of entries) transaction.objectStore("keyval").put(value, key);
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
    };
  }), seed);
  await page.unroute(url);
  await page.addInitScript(({ fault, legacyKey, guideKey, preferencesKey }) => {
    const get = IDBObjectStore.prototype.get, cursor = IDBObjectStore.prototype.openCursor, add = IDBObjectStore.prototype.add;
    let failed = false;
    window.__failRecovery = fault === "recovery";
    window.__recoveryAttempts = 0;
    IDBObjectStore.prototype.get = function (key) {
      const target = fault === "migration" ? legacyKey : fault === "last-guide" ? guideKey : fault === "preferences" ? preferencesKey : null;
      if (!failed && key === target) { failed = true; throw new DOMException("Transient startup read", "UnknownError"); }
      return get.call(this, key);
    };
    IDBObjectStore.prototype.openCursor = function (...args) {
      if (!failed && fault === "list") { failed = true; throw new DOMException("Transient startup list", "UnknownError"); }
      return cursor.apply(this, args);
    };
    IDBObjectStore.prototype.add = function (value, key) {
      if (String(key).startsWith("instruction-builder:recovery:")) {
        window.__recoveryAttempts++;
        if (window.__failRecovery) throw new DOMException("Recovery copy quota", "QuotaExceededError");
      }
      return add.call(this, value, key);
    };
  }, { fault, legacyKey, guideKey, preferencesKey });
  await page.goto(url); await page.locator(".app-brand").waitFor();
  let navigations = 0;
  page.on("framenavigated", frame => { if (frame === page.mainFrame()) navigations++; });
  return { context, page, noReload: () => assert.equal(navigations, 0, "Recovery must stay in the running app") };
}

try {
  for (const fault of ["list", "migration", "last-guide"]) {
    const seed = [[guideKey, guide]];
    if (fault === "last-guide") seed.push([preferencesKey, { version: 1, preferences: { uiLocale: "en", labelLocale: "en", theme: "light", activeLibraryId: "kitchen", lastGuideId: guide.id } }]);
    const { page, context, noReload } = await failedBoot(seed, fault);
    try {
      await page.locator(".save-status--unavailable").waitFor();
      if (fault === "list") await page.screenshot({ path: path.join(evidence, "guide-retry.png"), fullPage: true });
      await page.getByRole("button", { name: "Retry local storage", exact: true }).click();
      await page.waitForFunction(async () => !(await import("/src/state/guides.ts")).startupStorageUnavailable.peek());
      await page.getByRole("button", { name: "Open Recovered startup guide", exact: true }).click();
      const title = page.getByLabel("Guide title", { exact: true }); await title.waitFor();
      await title.fill(`Saved after ${fault} retry`);
      await page.waitForFunction(async ({ key, title }) => {
        const { createIndexedDbGuideStore } = await import("/src/lib/guide-repository.ts");
        return (await createIndexedDbGuideStore().transaction({ keys: [key], mode: "readonly" }, tx => tx.get(key)))?.document.meta.title === title;
      }, { key: guideKey, title: `Saved after ${fault} retry` });
      assert.equal((await records(page)).filter(([key]) => key.startsWith("instruction-builder:guide:")).length, 1);
      noReload(); console.log(`STARTUP_${fault.toUpperCase().replaceAll("-", "_")}_RETRY_AND_AUTOSAVE=PASS`);
    } finally { await context.close(); }
  }

  const { page: preferencesPage, context: preferencesContext, noReload: preferencesNoReload } = await failedBoot([[guideKey, guide]], "preferences");
  try {
    await preferencesPage.getByRole("button", { name: "Retry saving preferences", exact: true }).waitFor();
    await preferencesPage.screenshot({ path: path.join(evidence, "preferences-retry.png"), fullPage: true });
    await preferencesPage.evaluate(async () => (await import("/src/state/preferences.ts")).updatePreferences({ theme: "dark" }));
    await preferencesPage.getByRole("button", { name: "Retry saving preferences", exact: true }).click();
    await preferencesPage.waitForFunction(async () => (await import("/src/state/preferences.ts")).preferenceSaveState.peek() === "saved");
    const raw = (await records(preferencesPage)).find(([key]) => key === preferencesKey)?.[1];
    assert.equal(raw.preferences.theme, "dark");
    assert.equal(await preferencesPage.locator("html").getAttribute("data-theme"), "dark");
    await preferencesPage.getByRole("button", { name: "Open Recovered startup guide", exact: true }).click();
    await preferencesPage.getByLabel("Guide title", { exact: true }).waitFor();
    preferencesNoReload(); console.log("PREFERENCE_STARTUP_RETRY_PRESERVES_LOCAL_PATCH=PASS");
  } finally { await preferencesContext.close(); }

  const future = { schemaVersion: 99, retained: { values: [1, "exact raw", null] }, meta: { title: "Future guide" }, steps: [] };
  const { page: recoveryPage, context: recoveryContext, noReload: recoveryNoReload } = await failedBoot([[legacyKey, future]], "recovery");
  try {
    const retry = recoveryPage.getByRole("button", { name: "Retry local storage", exact: true }); await retry.waitFor();
    await retry.click();
    await recoveryPage.waitForFunction(() => window.__recoveryAttempts >= 2 && [...document.querySelectorAll("button")].some(button => button.textContent === "Retry local storage" && !button.disabled));
    await recoveryPage.waitForFunction(async () => (await import("/src/state/guides.ts")).saveState.peek() === "unavailable");
    let current = await records(recoveryPage);
    assert.deepEqual(current.find(([key]) => key === legacyKey)?.[1], future);
    assert.equal(current.some(([key]) => key === migrationKey || key.startsWith("instruction-builder:recovery:") || key.startsWith("instruction-builder:guide:")), false);
    await recoveryPage.evaluate(() => { window.__failRecovery = false; });
    await retry.click(); await recoveryPage.waitForFunction(async () => !(await import("/src/state/guides.ts")).startupStorageUnavailable.peek());
    current = await records(recoveryPage);
    const copies = current.filter(([key]) => key.startsWith("instruction-builder:recovery:"));
    assert.equal(copies.length, 1); assert.deepEqual(copies[0][1], future);
    assert.deepEqual(current.find(([key]) => key === legacyKey)?.[1], future);
    await createBlank(recoveryPage); assert.equal((await records(recoveryPage)).filter(([key]) => key.startsWith("instruction-builder:guide:")).length, 1);
    recoveryNoReload(); console.log("FAILED_RECOVERY_COPY_RETRIES_ATOMICALLY_AND_PRESERVES_RAW=PASS");
  } finally { await recoveryContext.close(); }
  assert.deepEqual(errors, []); console.log("STARTUP_RETRY_CHECKS=5 PASS");
} finally { await browser.close(); await server?.close(); }
