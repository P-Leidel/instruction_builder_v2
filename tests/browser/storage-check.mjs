import assert from "node:assert/strict";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

// Standalone use gets an ephemeral server; the browser runner supplies its own.
const root = fileURLToPath(new URL("../../", import.meta.url));
const server = process.argv[2] ? undefined : await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false } });
await server?.listen();
const url = process.argv[2] ?? `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await chromium.launch();
const context = await browser.newContext({ serviceWorkers: "block" });
try {
  const page = await context.newPage();
  await page.route(url, route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Native storage checks</title>" }));
  await page.goto(url);
  const checks = await page.evaluate(async () => {
    const { createIndexedDbGuideStore, createGuideRepository, GUIDE_PREFIX, LEGACY_KEY, MIGRATION_KEY } = await import("/src/lib/guide-repository.ts");
    const { createEmptyDocument } = await import("/src/model/instruction.ts");
    const { createPreferencesController, PREFERENCES_KEY } = await import("/src/state/preferences.ts");
    const store = createIndexedDbGuideStore();
    const results = {};
    const check = async (name, operation) => { try { await operation(); results[name] = true; } catch (error) { results[name] = String(error); } };
    const equal = (actual, expected) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`); };
    await check("DECLARED_KEY_READS_AND_NO_FULL_STORE_SCANS", async () => {
      const getAll = IDBObjectStore.prototype.getAll, getAllKeys = IDBObjectStore.prototype.getAllKeys, cursor = IDBObjectStore.prototype.openCursor;
      IDBObjectStore.prototype.getAll = IDBObjectStore.prototype.getAllKeys = IDBObjectStore.prototype.openCursor = () => { throw new Error("Unrelated records scanned"); };
      try {
        const ids = ["keyed", "keyed-copy"];
        const repository = createGuideRepository({ store, newId: () => ids.shift() });
        const made = await repository.create(createEmptyDocument()); if (!made.ok) throw new Error("Create failed");
        const loaded = await repository.load("keyed"); if (!loaded) throw new Error("Load failed");
        equal((await repository.save("keyed", 1, loaded.document)).ok, true);
        equal((await repository.remove("keyed", 2)).ok, true);
        equal((await repository.restore("keyed", 3)).ok, true);
        const duplicate = await repository.duplicate("keyed", "Copied guide"); equal(duplicate.ok, true); equal(duplicate.record.document.meta.title, "Copied guide");
        equal((await repository.remove("keyed-copy", 1)).ok, true);
        const preferences = createPreferencesController({ store, languages: ["en"] });
        await preferences.initializePreferences(); await preferences.updatePreferences({ theme: "dark" });
        equal(preferences.preferenceSaveState.peek(), "saved");
        equal(await store.transaction({ keys: [PREFERENCES_KEY], mode: "readonly" }, tx => tx.get(PREFERENCES_KEY)).then(raw => raw.preferences.theme), "dark");
      } finally { IDBObjectStore.prototype.getAll = getAll; IDBObjectStore.prototype.getAllKeys = getAllKeys; IDBObjectStore.prototype.openCursor = cursor; }
    });
    await check("PREFIX_RANGE_INCLUDES_ARBITRARY_SUFFIX_AND_COMBINED_KEYS", async () => {
      await store.transaction({}, tx => { for (const key of ["range:", "range:a", "range:\ufffftail", "range:\uffff\uffff", "rangf:", "elsewhere", "\uffff\ufffftail"]) tx.put(key, key); });
      equal(await store.transaction({ prefix: "range:", keys: ["elsewhere"], mode: "readonly" }, tx => tx.entries().map(([key]) => key).sort()), ["elsewhere", "range:", "range:a", "range:\ufffftail", "range:\uffff\uffff"]);
      equal(await store.transaction({ prefix: "\uffff\uffff", mode: "readonly" }, tx => tx.entries().map(([key]) => key)), ["\uffff\ufffftail"]);
      const cursor = IDBObjectStore.prototype.openCursor;
      IDBObjectStore.prototype.openCursor = function (range) { equal([range.lower, range.upper, range.upperOpen], [GUIDE_PREFIX, "instruction-builder:guide;", true]); return cursor.call(this, range); };
      try { equal((await createGuideRepository({ store }).list()).map(item => item.id), ["keyed"]); } finally { IDBObjectStore.prototype.openCursor = cursor; }
    });
    await check("UNDECLARED_READ_AND_READONLY_WRITE_ABORT", async () => {
      for (const operation of [tx => tx.get("undeclared"), tx => tx.entries()]) {
        let rejected = false; try { await store.transaction({}, operation); } catch { rejected = true; } equal(rejected, true);
      }
      let rejected = false; try { await store.transaction({ mode: "readonly" }, tx => tx.put("readonly-write", "bad")); } catch { rejected = true; } equal(rejected, true);
      equal(await store.transaction({ keys: ["readonly-write"], mode: "readonly" }, tx => tx.get("readonly-write")), undefined);
    });
    await check("RAW_NONCALLABLE_THEN_FIELDS_REMAIN_READABLE", async () => {
      const raw = { then: "future-data", retained: true };
      await store.transaction({}, tx => tx.put("raw-then", raw));
      equal(await store.transaction({ keys: ["raw-then"], mode: "readonly" }, tx => tx.get("raw-then")), raw);
    });
    await check("PRESENT_UNDEFINED_GUIDE_VALUES_ARE_RECOVERED", async () => {
      await store.transaction({}, tx => tx.put(GUIDE_PREFIX + "undefined-value", undefined));
      const notices = []; const repository = createGuideRepository({ store, newId: () => "undefined-value", now: () => "fixed", onNotice: notice => notices.push(notice) });
      equal(await repository.load("undefined-value"), undefined); equal(notices.length, 1);
      equal(await store.transaction({ keys: [notices[0].recoveryKey], mode: "readonly" }, tx => tx.entries().map(([key]) => key)), [notices[0].recoveryKey]);
    });
    await check("NATIVE_INSERT_COLLISION_ROLLS_BACK_EARLIER_WRITES", async () => {
      await store.transaction({}, tx => tx.put("collision", "original"));
      let rejected = false; try { await store.transaction({}, tx => { tx.put("earlier", "rollback"); tx.add("collision", "replacement"); }); } catch { rejected = true; }
      equal(rejected, true);
      equal(await store.transaction({ keys: ["earlier", "collision"], mode: "readonly" }, tx => [tx.get("earlier"), tx.get("collision")]), [undefined, "original"]);
    });
    await check("SYNCHRONOUS_POLICY_ERRORS_ROLL_BACK_AND_RESULTS_WAIT_FOR_COMMIT", async () => {
      for (const operation of [tx => { tx.put("policy-error", "rollback"); throw new Error("policy failure"); }, tx => { tx.put("policy-error", "rollback"); return Promise.resolve("async policy"); }]) {
        let rejected = false; try { await store.transaction({}, operation); } catch { rejected = true; } equal(rejected, true);
      }
      equal(await store.transaction({ keys: ["policy-error"], mode: "readonly" }, tx => tx.get("policy-error")), undefined);
      let completed = false; const nativeTransaction = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (...args) { const transaction = nativeTransaction.apply(this, args); transaction.addEventListener("complete", () => { completed = true; }); return transaction; };
      try { equal(await store.transaction({}, tx => { tx.put("committed", "yes"); return "result"; }), "result"); equal(completed, true); } finally { IDBDatabase.prototype.transaction = nativeTransaction; }
    });
    await check("ABORTED_SAVE_CANNOT_ADVANCE_BASELINE", async () => {
      let abortSave = false;
      const repository = createGuideRepository({ store: { transaction: (plan, operation) => store.transaction(plan, tx => { const result = operation(tx); if (abortSave && result?.ok) tx.add("collision", "force abort after save"); return result; }) }, newId: () => "commit-baseline" });
      const made = await repository.create(createEmptyDocument()); equal(made.ok, true);
      abortSave = true; equal(await repository.save(made.record.id, 1, made.record.document), { ok: false, reason: "unavailable" });
      abortSave = false; const retry = await repository.save(made.record.id, 1, made.record.document); equal(retry.ok, true); equal(retry.record.revision, 2);
    });
    await check("RECOVERY_COLLISION_SUPPRESSES_NOTICE_AND_RETRIES_AFTER_ABORT", async () => {
      const raw = { future: "exact", schemaVersion: 99 }; const source = GUIDE_PREFIX + "bad";
      const recovery = "instruction-builder:recovery:fixed:collision";
      await store.transaction({}, tx => { tx.put(source, raw); tx.put(recovery, "existing"); });
      const notices = []; let id = "collision";
      const repository = createGuideRepository({ store, now: () => "fixed", newId: () => id, onNotice: notice => notices.push(notice) });
      let rejected = false; try { await repository.load("bad"); } catch { rejected = true; } equal(rejected, true); equal(notices.length, 0);
      id = "retry"; equal(await repository.load("bad"), undefined); equal(notices.length, 1);
      equal(await store.transaction({ keys: [source, recovery, "instruction-builder:recovery:fixed:retry"], mode: "readonly" }, tx => [tx.get(source), tx.get(recovery), tx.get("instruction-builder:recovery:fixed:retry")]), [raw, "existing", raw]);
    });
    await check("RECOVERY_PRESERVES_CLONE_GRAPHS", async () => {
      const raw = { schemaVersion: 99, binary: new Uint8Array([0, 255]), map: new Map([["retained", new Set(["exact"])]]), date: new Date("2026-10-07T00:00:00Z") }; raw.cycle = raw;
      await store.transaction({}, tx => tx.put(GUIDE_PREFIX + "clone-graph", raw));
      const notices = []; const repository = createGuideRepository({ store, newId: () => "clone-graph", now: () => "fixed", onNotice: notice => notices.push(notice) });
      equal(await repository.load("clone-graph"), undefined); equal(notices.length, 1);
      const copy = await store.transaction({ keys: [notices[0].recoveryKey], mode: "readonly" }, tx => tx.get(notices[0].recoveryKey));
      equal(copy.cycle === copy, true); equal([...copy.binary], [0, 255]); equal([...copy.map.get("retained")], ["exact"]); equal(copy.date.toISOString(), "2026-10-07T00:00:00.000Z");
    });
    await check("MIGRATION_COLLISION_ROLLS_BACK_MARKER", async () => {
      const raw = createEmptyDocument(); await store.transaction({}, tx => tx.put(LEGACY_KEY, raw));
      const repository = createGuideRepository({ store, newId: () => "keyed" });
      let rejected = false; try { await repository.list(); } catch { rejected = true; } equal(rejected, true);
      equal(await store.transaction({ keys: [LEGACY_KEY, MIGRATION_KEY], mode: "readonly" }, tx => [tx.get(LEGACY_KEY), tx.get(MIGRATION_KEY)]), [raw, undefined]);
    });
    return results;
  });
  for (const [name, result] of Object.entries(checks)) console.log(`${name}=${result === true ? "PASS" : result}`);
  assert.deepEqual(Object.values(checks), Object.values(checks).map(() => true), "All native storage contracts pass");
  console.log("NATIVE_STORAGE_CHECKS=PASS");
} finally { await context.close(); await browser.close(); await server?.close(); }
