// Actual per-guide IndexedDB and UI safety, with legacy seed before bootstrap.
import assert from "node:assert/strict";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { boot, records, snapshot, downloadJson, createBlank, openGroup, openActions } from "./editor-browser-helpers.mjs";
const url = process.argv[2] ?? "http://localhost:5173/"; const errors = []; const browser = await chromium.launch();
const legacyKey = "instruction-builder:document"; const guidePrefix = "instruction-builder:guide:"; const recoveryPrefix = "instruction-builder:recovery:";
const rawSeed = { schemaVersion: 1, meta: { title: "Concurrency baseline", domain: "recipe", createdAt: "2026-10-05T00:00:00Z" }, extraRaw: { retained: [1, "exact", null] }, steps: [{ id: "reliability-step", title: "Prepare vegetables", tokens: [{ id: "reliability-token", category: "action", iconId: "action.chop", label: "Chop", quantity: { iconId: "quantity.amount", label: "3 kg" } }] }] };
const value = async (page, key) => (await records(page)).find(([id]) => id === key)?.[1];
async function waitRecord(page, key, predicate) { const deadline = Date.now() + 5000; do { const record = await value(page, key); if (predicate(record)) return record; await delay(40); } while (Date.now() < deadline); assert.fail(`Expected committed record ${key}`); }
async function stays(page, key, expected) { await page.evaluate(() => window.dispatchEvent(new Event("pagehide"))); const deadline = Date.now() + 650; do { assert.deepEqual(await value(page, key), expected); await delay(40); } while (Date.now() < deadline); }
try {
  const { page: a, context } = await boot(browser, url, errors, undefined, [[legacyKey, rawSeed]]);
  try {
    await a.getByRole("button", { name: "Open Concurrency baseline", exact: true }).click(); await a.getByLabel("Guide title", { exact: true }).waitFor();
    const id = await a.evaluate(async () => (await import("/src/state/guides.ts")).activeGuideId.peek()); const key = guidePrefix + id;
    await stays(a, legacyKey, rawSeed); assert.equal((await snapshot(a)).steps[0].tokens[0].quantity.amount, 3);
    const b = await context.newPage(); b.on("pageerror", (error) => errors.push(error.message)); b.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); }); await b.goto(url); await b.getByLabel("Guide title", { exact: true }).waitFor(); await stays(b, legacyKey, rawSeed);
    await a.getByLabel("Guide title", { exact: true }).fill("Saved by tab A"); const winner = await waitRecord(a, key, (record) => record?.document.meta.title === "Saved by tab A");
    const repaired = structuredClone(rawSeed); repaired.schemaVersion = 2; repaired.meta.presentation = "sequence"; repaired.meta.title = "Saved by tab A"; repaired.steps[0].tokens[0].quantity = { iconId: "quantity.amount", label: "3 kg", amount: 3, unit: "kg" }; assert.deepEqual(winner.document, repaired);
    await openGroup(b, "reliability-step"); await b.getByLabel("Group title", { exact: true }).fill("Unsaved tab B step"); await openActions(b); await b.getByLabel("Optional description", { exact: true }).fill("Keep this local work"); await b.getByRole("button", { name: "Close", exact: true }).last().click();
    await b.locator(".save-status--conflict").waitFor(); await stays(b, key, winner);
    await b.getByLabel("Guide title", { exact: true }).fill("Local unsaved tab B"); const exported = await downloadJson(b); const expectedLocal = structuredClone(rawSeed); expectedLocal.schemaVersion = 2; expectedLocal.meta.presentation = "sequence"; expectedLocal.meta.title = "Local unsaved tab B"; expectedLocal.steps[0].title = "Unsaved tab B step"; expectedLocal.steps[0].description = "Keep this local work"; expectedLocal.steps[0].tokens[0].quantity = repaired.steps[0].tokens[0].quantity;
    assert.deepEqual(exported, expectedLocal); assert.equal(await b.locator(".save-status--conflict").isVisible(), true); await stays(b, key, winner); await stays(b, legacyKey, rawSeed);
    console.log("CROSS_TAB_CONFLICT_AND_LOCAL_JSON_EXPORT=PASS");
    // A failed explicit reload must preserve the entire losing draft; no stale flush.
    await b.evaluate(() => { window.__realGetAll = IDBObjectStore.prototype.getAll; IDBObjectStore.prototype.getAll = function () { throw new DOMException("Injected load failure", "UnknownError"); }; });
    await b.getByRole("button", { name: "Reload saved guide", exact: true }).click(); await b.getByRole("dialog").getByRole("button", { name: "Reload saved guide", exact: true }).click(); await b.waitForFunction(() => !document.querySelector("dialog")); await b.evaluate(() => { IDBObjectStore.prototype.getAll = window.__realGetAll; });
    assert.deepEqual(await snapshot(b), expectedLocal); assert.equal(await b.locator(".save-status--unavailable").count(), 1); await stays(b, key, winner);
    await b.getByRole("button", { name: "Reload saved guide", exact: true }).click(); await b.getByRole("dialog").getByRole("button", { name: "Reload saved guide", exact: true }).click(); await b.waitForFunction(() => !document.querySelector("dialog")); assert.deepEqual(await snapshot(b), winner.document); assert.equal(await b.getByRole("button", { name: "Undo", exact: true }).isDisabled(), true);
    console.log("EXPLICIT_RELOAD_FAILURE_PRESERVES_DRAFT_AND_SUCCESS_ADOPTS_WINNER=PASS");
    // A's new guide and B's existing guide write independently, despite shared preferences.
    await a.getByRole("button", { name: "My guides", exact: true }).click(); await createBlank(a); await a.getByLabel("Guide title", { exact: true }).fill("Independent guide A"); const otherId = await a.evaluate(async () => (await import("/src/state/guides.ts")).activeGuideId.peek());
    await b.getByLabel("Guide title", { exact: true }).fill("Independent guide B"); await waitRecord(a, guidePrefix + otherId, (record) => record?.document.meta.title === "Independent guide A"); await waitRecord(b, key, (record) => record?.document.meta.title === "Independent guide B"); assert.equal(await b.locator(".save-status--conflict").count(), 0);
    await a.getByRole("button", { name: "My guides", exact: true }).click(); await a.getByRole("button", { name: "Delete Independent guide B", exact: true }).click(); await a.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click(); await a.waitForFunction(() => !document.querySelector("dialog"));
    const tombstone = await value(a, key); assert.ok(tombstone.deletedAt); await b.getByLabel("Guide title", { exact: true }).fill("Exportable deleted draft"); await b.locator(".save-status--conflict").waitFor(); await stays(b, key, tombstone); assert.equal((await downloadJson(b)).meta.title, "Exportable deleted draft");
    await a.getByRole("button", { name: "Restore Independent guide B", exact: true }).click(); await waitRecord(a, key, (record) => record && !record.deletedAt && record.revision === tombstone.revision + 1);
    console.log("DIFFERENT_GUIDES_AND_TOMBSTONE_STALE_SAVE_PROTECTION=PASS");
  } finally { await context.close(); }
  const future = { schemaVersion: 99, meta: { title: "Unreadable future", domain: "recipe", createdAt: "2026-10-06T00:00:00Z" }, steps: [], futureOnly: { values: [1, "retain exact raw data", null], enabled: true } };
  const { page, context: recoveryContext } = await boot(browser, url, errors, undefined, [[legacyKey, future]]);
  try {
    await page.getByText("Saved work could not be read.", { exact: false }).waitFor(); const first = (await records(page)).filter(([key]) => key.startsWith(recoveryPrefix)); assert.equal(first.length, 1); assert.deepEqual(first[0][1], future); await stays(page, legacyKey, future);
    await page.reload(); await page.getByRole("heading", { name: "My guides", exact: true }).waitFor(); const copies = (await records(page)).filter(([key]) => key.startsWith(recoveryPrefix)); assert.equal(copies.length, 2); assert.equal(new Set(copies.map(([key]) => key)).size, 2); for (const [, raw] of copies) assert.deepEqual(raw, future);
    await createBlank(page); await page.getByLabel("Guide title", { exact: true }).fill("Edited recovered fallback"); const active = await page.evaluate(async () => (await import("/src/state/guides.ts")).activeGuideId.peek()); const saved = await waitRecord(page, guidePrefix + active, (record) => record?.document.meta.title === "Edited recovered fallback"); assert.equal(saved.document.schemaVersion, 2); assert.equal(saved.document.steps.length, 1); assert.deepEqual(saved.document.steps[0].tokens, []); assert.deepEqual((await records(page)).filter(([key]) => key.startsWith(recoveryPrefix)), copies); await stays(page, legacyKey, future);
    console.log("UNIQUE_EXACT_RECOVERY_COPIES_SURVIVE_FALLBACK_SAVE=PASS");
  } finally { await recoveryContext.close(); }
  // Failed raw backup aborts initialization and prevents creation, keeping exportable draft explicit.
  const { page: fail, context: failContext } = await boot(browser, url, errors);
  try {
    await fail.evaluate(async (raw) => { const { createIndexedDbGuideStore, LEGACY_KEY } = await import("/src/lib/guide-repository.ts"); await createIndexedDbGuideStore().transaction((tx) => tx.put(LEGACY_KEY, raw)); }, future);
    await fail.addInitScript(() => { const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (value, key) { if (String(key).startsWith("instruction-builder:recovery:")) throw new DOMException("Injected backup quota", "QuotaExceededError"); return put.call(this, value, key); }; });
    await fail.reload(); await fail.locator(".save-status--unavailable").waitFor(); await fail.getByRole("button", { name: "New guide", exact: true }).click(); await fail.getByRole("button", { name: "Start blank", exact: true }).click(); await fail.getByRole("button", { name: "Close", exact: true }).last().click(); await fail.getByRole("button", { name: "Download new draft JSON", exact: true }).waitFor();
    const draft = await downloadJson(fail, fail.getByRole("button", { name: "Download new draft JSON", exact: true })); assert.equal(draft.schemaVersion, 2); assert.deepEqual(await value(fail, legacyKey), future); assert.equal((await records(fail)).filter(([key]) => key.startsWith(guidePrefix)).length, 0);
    console.log("FAILED_RECOVERY_COPY_BLOCKS_CREATION_WITH_EXPLICIT_DRAFT_BACKUP=PASS");
  } finally { await failContext.close(); }
  assert.deepEqual(errors, [], "No page or console errors"); console.log("PERSISTENCE_RELIABILITY_CHECKS=PASS");
} finally { await browser.close(); }
