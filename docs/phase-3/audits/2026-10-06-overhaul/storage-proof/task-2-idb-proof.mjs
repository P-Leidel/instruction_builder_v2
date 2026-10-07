// Temporary Task 2 proof: real Chromium IndexedDB, no application wiring/UI assumptions.
import assert from "node:assert/strict";
import process from "node:process";
import { writeFile } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "playwright";

const server = await createServer({ server: { host: "127.0.0.1", port: 0, open: false } });
await server.listen();
const address = server.httpServer.address(); const url = `http://127.0.0.1:${address.port}/`;
let browser; const errors = []; const evidence = [];
async function context() {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.route("**/*", (route) => new URL(route.request().url()).pathname === "/" ?
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Task 2 IndexedDB proof</title>" }) : route.continue());
  return context;
}
async function page(context) {
  const page = await context.newPage(); page.on("pageerror", (error) => errors.push(error.message)); await page.goto(url);
  await page.evaluate(async () => {
    const repository = await import("/src/lib/guide-repository.ts"); const preferences = await import("/src/state/preferences.ts");
    const guides = await import("/src/state/guides.ts"); const session = await import("/src/state/document.ts");
    const model = await import("/src/model/instruction.ts");
    window.proof = { ...repository, ...preferences, ...guides, ...session, ...model, store: repository.createIndexedDbGuideStore() };
  }); return page;
}
const legacy = { schemaVersion: 1, meta: { title: "Original", domain: "recipe", createdAt: "2026-10-06T00:00:00Z" },
  steps: [{ id: "step", tokens: [{ id: "token", category: "action", iconId: "action.chop", label: "Chop", quantity: { iconId: "quantity.amount", label: "3 kg" } }] }] };
try {
  browser = await chromium.launch();
  const ctx = await context(); const a = await page(ctx); const b = await page(ctx);
  await a.evaluate(async (raw) => { await window.proof.store.transaction((tx) => tx.put(window.proof.LEGACY_KEY, raw)); }, legacy);
  const lists = await Promise.all([a, b].map((tab) => tab.evaluate(async () => {
    const p = window.proof; p.repo = p.createGuideRepository(); return p.repo.list();
  })));
  assert.equal(lists[0].length, 1); assert.equal(lists[0][0].id, lists[1][0].id); const id = lists[0][0].id;
  const initial = await a.evaluate(async () => window.proof.store.transaction((tx) => tx.entries()));
  assert.equal(initial.filter(([key]) => key.startsWith("instruction-builder:guide:")).length, 1);
  assert.deepEqual(initial.find(([key]) => key === "instruction-builder:document")[1], legacy);
  assert.equal(initial.find(([key]) => key.includes("guides-migration"))[1].guideId, id);
  const repaired = initial.find(([key]) => key.startsWith("instruction-builder:guide:"))[1];
  assert.equal(repaired.document.schemaVersion, 2); assert.equal(repaired.document.steps[0].tokens[0].quantity.amount, 3);
  evidence.push({ check: "two simultaneous first launches", result: "PASS", guideId: id, transactions: "one atomic legacy read + guide creation + marker commit; each caller then lists" });
  await a.evaluate(async (id) => { await window.proof.store.transaction((tx) => tx.put(window.proof.PREFERENCES_KEY,
    { version: 1, preferences: { uiLocale: "en", labelLocale: "en", activeLibraryId: "kitchen", lastGuideId: id } })); }, id);
  await Promise.all([a, b].map((tab) => tab.evaluate(async () => {
    const p = window.proof; p.session = p.createDocumentSession(); p.controller = p.createGuideController(p.session); await p.controller.initializeGuides();
  })));
  const outcomes = await Promise.all([a, b].map((tab, index) => tab.evaluate(async (title) => {
    const p = window.proof; p.sessionActions.updateTitle(p.session, title); return p.controller.flushActiveGuide();
  }, index === 0 ? "Tab A" : "Tab B")));
  assert.equal(outcomes.filter((result) => result.ok).length, 1); assert.equal(outcomes.filter((result) => result.reason === "conflict").length, 1);
  const loser = outcomes[0].ok ? b : a; const winnerTitle = outcomes[0].ok ? "Tab A" : "Tab B";
  const losing = await loser.evaluate(async () => {
    const p = window.proof; p.sessionActions.updateTitle(p.session, "Exportable loser"); window.dispatchEvent(new Event("pagehide"));
    await new Promise((resolve) => setTimeout(resolve, 650));
    const disk = await p.store.transaction((tx) => tx.get(p.GUIDE_PREFIX + p.controller.activeGuideId.value));
    return { state: p.controller.saveState.value, local: p.session.document.value.meta.title, disk: disk.document.meta.title, result: await p.controller.openGuide("missing") };
  });
  assert.deepEqual(losing, { state: "conflict", local: "Exportable loser", disk: winnerTitle, result: { ok: false, reason: "conflict" } });
  const reload = await loser.evaluate(async () => {
    const p = window.proof; const result = await p.controller.reloadActiveGuide(); const loaded = p.session.document.value.meta.title;
    p.sessionActions.updateTitle(p.session, "After explicit reload"); return { result, loaded, save: await p.controller.flushActiveGuide(), state: p.controller.saveState.value };
  });
  assert.equal(reload.result.ok, true); assert.equal(reload.loaded, winnerTitle); assert.equal(reload.save.ok, true); assert.equal(reload.state, "saved");
  evidence.push({ check: "simultaneous same-guide writers, sticky conflict/pagehide, exportable loser, explicit reload", result: "PASS", outcomes });
  const sameRevision = await loser.evaluate(async () => {
    const p = window.proof; const active = p.controller.activeGuideId.value;
    await p.store.transaction((tx) => { const raw = tx.get(p.GUIDE_PREFIX + active); raw.document.meta.title = "Manual same-revision edit"; tx.put(p.GUIDE_PREFIX + active, raw); });
    await p.controller.refreshGuides(); p.sessionActions.updateTitle(p.session, "Should stay local");
    return { result: await p.controller.flushActiveGuide(), local: p.session.document.value.meta.title,
      disk: await p.store.transaction((tx) => tx.get(p.GUIDE_PREFIX + active)) };
  });
  assert.deepEqual(sameRevision.result, { ok: false, reason: "conflict" }); assert.equal(sameRevision.disk.document.meta.title, "Manual same-revision edit");
  evidence.push({ check: "summary refresh preserves raw baseline, even with unchanged revision", result: "PASS" });
  await Promise.all([a, b].map((tab) => tab.evaluate(() => window.proof.controller.dispose())));
  const independentId = await a.evaluate(async () => {
    const p = window.proof; const made = await p.repo.create(p.createEmptyDocument("board")); if (!made.ok) throw new Error("create"); return made.record.id;
  });
  const independent = await Promise.all([[a, id], [b, independentId]].map(([tab, guideId]) => tab.evaluate(async (guideId) => {
    const p = window.proof; const record = await p.repo.load(guideId); record.document.meta.title = "Independent " + guideId;
    return p.repo.save(record.id, record.revision, record.document);
  }, guideId)));
  assert.ok(independent.every((result) => result.ok));
  evidence.push({ check: "different-guide concurrent commits", result: "PASS", revisions: independent.map((result) => result.record.revision) });
  await b.evaluate(async (id) => { window.proof.stale = await window.proof.repo.load(id); }, id);
  const removed = await a.evaluate(async (id) => { const p = window.proof; const record = await p.repo.load(id); return p.repo.remove(id, record.revision); }, id);
  const deleted = await b.evaluate(async () => { const p = window.proof; return p.repo.save(p.stale.id, p.stale.revision, p.stale.document); });
  assert.deepEqual(deleted, { ok: false, reason: "deleted" });
  const restored = await a.evaluate(async ({ id, revision }) => { const p = window.proof; return { stale: await p.repo.restore(id, revision - 1), valid: await p.repo.restore(id, revision) }; }, { id, revision: removed.record.revision });
  assert.deepEqual(restored.stale, { ok: false, reason: "conflict" }); assert.equal(restored.valid.ok, true);
  evidence.push({ check: "tombstone blocks stale resurrection and stale restore", result: "PASS", tombstoneRevision: removed.record.revision });
  const recovery = await a.evaluate(async (legacy) => {
    const p = window.proof; legacy.meta.title = "Still-open old client"; const broken = { id: "broken", revision: "bad", future: [null, "retain"] };
    await p.store.transaction((tx) => { tx.put(p.LEGACY_KEY, legacy); tx.put(p.GUIDE_PREFIX + "broken", broken); });
    const notices = []; const repository = p.createGuideRepository({ onNotice: (notice) => notices.push(notice) }); const list = await repository.list();
    return { list, notices, raw: await p.store.transaction((tx) => tx.entries()) };
  }, legacy);
  assert.equal(recovery.list.length, 2); assert.deepEqual(recovery.notices.map((notice) => notice.code).sort(), ["guide-recovered", "legacy-changed"]);
  for (const notice of recovery.notices) assert.deepEqual(recovery.raw.find(([key]) => key === notice.recoveryKey)[1], recovery.raw.find(([key]) => key === notice.sourceKey)[1]);
  evidence.push({ check: "changed legacy and malformed guide isolated with exact raw recovery", result: "PASS", notices: recovery.notices });
  await ctx.close();

  const navigationContext = await context(); const navigationPage = await page(navigationContext);
  const navigation = await navigationPage.evaluate(async () => {
    const p = window.proof; const repository = p.createGuideRepository(); const records = [];
    for (const title of ["Navigation A", "Navigation B"]) {
      const document = p.createEmptyDocument(); document.meta.title = title;
      const result = await repository.create(document); if (!result.ok) throw new Error("fixture create"); records.push(result.record);
    }
    const pref = p.createPreferencesController(); await pref.initializePreferences(); await pref.updatePreferences({ lastGuideId: records[0].id });
    let release; const gate = new Promise((resolve) => { release = resolve; }); const writes = [];
    const session = p.createDocumentSession();
    const controller = p.createGuideController(session, { preferenceController: pref, repository: { ...repository, save: async (...args) => {
      writes.push({ id: args[0], title: args[2].meta.title }); if (writes.length === 1) await gate; return repository.save(...args);
    } } });
    const states = [controller.saveState.value]; await controller.initializeGuides(); states.push(controller.saveState.value);
    p.sessionActions.updateTitle(session, "Earlier snapshot"); states.push(controller.saveState.value);
    const first = controller.flushActiveGuide(); states.push(controller.saveState.value);
    p.sessionActions.updateTitle(session, "Latest during write"); states.push(controller.saveState.value);
    const open = controller.openGuide(records[1].id); release(); await first; const result = await open;
    states.push(controller.saveState.value); const disk = await repository.load(records[0].id);
    const target = await repository.load(records[1].id); controller.dispose();
    return { result, states, writes, source: { title: disk.document.meta.title, revision: disk.revision },
      target: { title: session.document.value.meta.title, revision: target.revision }, sourceId: records[0].id, targetId: records[1].id };
  });
  assert.equal(navigation.result.ok, true); assert.deepEqual(navigation.states, ["loading", "saved", "pending", "saving", "pending", "saved"]);
  assert.deepEqual(navigation.writes, [{ id: navigation.sourceId, title: "Earlier snapshot" }, { id: navigation.sourceId, title: "Latest during write" }]);
  assert.deepEqual(navigation.source, { title: "Latest during write", revision: 3 }); assert.deepEqual(navigation.target, { title: "Navigation B", revision: 1 });
  evidence.push({ check: "latest queued snapshot drains before navigation; truthful pending/saving/saved", result: "PASS", ...navigation }); await navigationContext.close();

  for (const trigger of ["pagehide", "visibilitychange", "direct"]) {
    const reloadContext = await context(); const reloadPage = await page(reloadContext);
    const adoption = await reloadPage.evaluate(async (trigger) => {
      const p = window.proof; const repository = p.createGuideRepository(); const made = await repository.create(p.createEmptyDocument());
      if (!made.ok) throw new Error("fixture create");
      const pref = p.createPreferencesController(); await pref.initializePreferences(); await pref.updatePreferences({ lastGuideId: made.record.id });
      let entered; const entering = new Promise((resolve) => { entered = resolve; });
      let release; const gate = new Promise((resolve) => { release = resolve; }); let pauseLoad = false; let writes = 0;
      const session = p.createDocumentSession();
      const controller = p.createGuideController(session, { preferenceController: pref, repository: { ...repository,
        load: async (id) => { const record = await repository.load(id); if (pauseLoad) { entered(); await gate; } return record; },
        save: (...args) => { writes++; return repository.save(...args); },
      } });
      try {
        await controller.initializeGuides(); const winner = structuredClone(made.record); winner.document.meta.title = "Same-revision disk winner";
        await p.store.transaction((tx) => tx.put(p.GUIDE_PREFIX + winner.id, winner));
        pauseLoad = true; const reload = controller.reloadActiveGuide(); await entering;
        p.sessionActions.updateTitle(session, "Exportable edit during reload"); const stateDuringLoad = controller.saveState.value;
        if (trigger === "visibilitychange") Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        if (trigger !== "direct") window.dispatchEvent(new Event(trigger));
        const flushed = await controller.flushActiveGuide();
        const disk = await p.store.transaction((tx) => tx.get(p.GUIDE_PREFIX + winner.id));
        release(); const result = await reload;
        const local = session.document.value.meta.title; const sticky = await controller.flushActiveGuide();
        pauseLoad = false; const recovered = await controller.reloadActiveGuide();
        p.sessionActions.updateTitle(session, "After successful adoption"); const resumed = await controller.flushActiveGuide();
        return { trigger, stateDuringLoad, flushed, disk, winner, result, local, sticky, writesBeforeRecovery: writes - (resumed.ok ? 1 : 0),
          recovered: recovered.ok, resumed: resumed.ok };
      } finally { release(); controller.dispose(); }
    }, trigger);
    assert.equal(adoption.stateDuringLoad, "pending"); assert.deepEqual(adoption.flushed, { ok: false, reason: "cancelled" });
    assert.deepEqual(adoption.disk, adoption.winner); assert.deepEqual(adoption.result, { ok: false, reason: "cancelled" });
    assert.equal(adoption.local, "Exportable edit during reload"); assert.deepEqual(adoption.sticky, { ok: false, reason: "conflict" });
    assert.equal(adoption.writesBeforeRecovery, 0); assert.equal(adoption.recovered, true); assert.equal(adoption.resumed, true);
    evidence.push({ check: `${trigger} cannot write against an unadopted reload baseline`, result: "PASS",
      transactions: "native same-revision external mutation; load commit adopts raw baseline; all new saves blocked until explicit document adoption",
      trigger, stateDuringLoad: adoption.stateDuringLoad, flushResult: adoption.flushed, reloadResult: adoption.result,
      diskRevision: adoption.disk.revision, diskTitle: adoption.disk.document.meta.title, localTitle: adoption.local,
      writesBeforeRecovery: adoption.writesBeforeRecovery, resumedAfterSuccessfulAdoption: adoption.resumed });
    await reloadContext.close();
  }

  const drainContext = await context(); const drainPage = await page(drainContext);
  const interruptedDrain = await drainPage.evaluate(async () => {
    const p = window.proof; const repository = p.createGuideRepository(); const made = await repository.create(p.createEmptyDocument());
    if (!made.ok) throw new Error("fixture create");
    const pref = p.createPreferencesController(); await pref.initializePreferences(); await pref.updatePreferences({ lastGuideId: made.record.id });
    let started; const saving = new Promise((resolve) => { started = resolve; });
    let releaseWrite; const writing = new Promise((resolve) => { releaseWrite = resolve; });
    let entered; const entering = new Promise((resolve) => { entered = resolve; });
    let releaseLoad; const loading = new Promise((resolve) => { releaseLoad = resolve; }); let pauseLoad = false; let writes = 0;
    const session = p.createDocumentSession();
    const controller = p.createGuideController(session, { preferenceController: pref, repository: { ...repository,
      save: async (...args) => { writes++; started(); await writing; return repository.save(...args); },
      load: async (id) => { const record = await repository.load(id); if (pauseLoad) { entered(); await loading; } return record; },
    } });
    try {
      await controller.initializeGuides(); p.sessionActions.updateTitle(session, "Write already in flight");
      const first = controller.flushActiveGuide(); await saving; p.sessionActions.updateTitle(session, "Queued before reload");
      pauseLoad = true; const reload = controller.reloadActiveGuide(); await new Promise((resolve) => setTimeout(resolve, 0));
      p.sessionActions.updateTitle(session, "New edit while reload waits"); releaseWrite(); await entering;
      const flushed = await controller.flushActiveGuide(); const disk = await p.store.transaction((tx) => tx.get(p.GUIDE_PREFIX + made.record.id));
      releaseLoad(); const result = await reload;
      return { writes, first: await first, flushed, result, local: session.document.value.meta.title, state: controller.saveState.value,
        diskTitle: disk.document.meta.title, diskRevision: disk.revision };
    } finally { releaseWrite(); releaseLoad(); controller.dispose(); }
  });
  assert.deepEqual(interruptedDrain, { writes: 1, first: { ok: false, reason: "cancelled" }, flushed: { ok: false, reason: "cancelled" },
    result: { ok: false, reason: "cancelled" }, local: "New edit while reload waits", state: "conflict", diskTitle: "Write already in flight", diskRevision: 2 });
  evidence.push({ check: "reload awaits an existing native write without starting newer queued snapshots", result: "PASS", ...interruptedDrain });
  await drainContext.close();

  const commitContext = await context(); const commitPage = await page(commitContext);
  const commit = await commitPage.evaluate(async () => {
    const p = window.proof; const repository = p.createGuideRepository(); const made = await repository.create(p.createEmptyDocument());
    if (!made.ok) throw new Error("fixture create");
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (String(key).startsWith(p.GUIDE_PREFIX)) throw new DOMException("Injected quota", "QuotaExceededError");
      return put.call(this, value, key);
    };
    const failed = await repository.save(made.record.id, 1, made.record.document); IDBObjectStore.prototype.put = put;
    const retried = await repository.save(made.record.id, 1, made.record.document);
    return { failed, retried: retried.ok, revision: retried.ok ? retried.record.revision : null };
  });
  assert.deepEqual(commit, { failed: { ok: false, reason: "unavailable" }, retried: true, revision: 2 });
  evidence.push({ check: "an aborted mutation never advances the committed baseline/revision", result: "PASS", ...commit }); await commitContext.close();

  const futureContext = await context(); const futurePage = await page(futureContext);
  const future = await futurePage.evaluate(async () => {
    const p = window.proof; const raw = { schemaVersion: 999, unknown: ["exact", null] }; raw.cycle = raw;
    await p.store.transaction((tx) => tx.put(p.LEGACY_KEY, raw));
    await p.createGuideRepository().list(); await p.createGuideRepository().list();
    const before = await p.store.transaction((tx) => tx.entries()); const copies = before.filter(([key]) => key.startsWith("instruction-builder:recovery:"));
    const created = await p.createGuideRepository().create(p.createEmptyDocument());
    const after = await p.store.transaction((tx) => tx.entries());
    return { copyCount: copies.length, unique: new Set(copies.map(([key]) => key)).size,
      exactCycles: copies.every(([, value]) => value.cycle === value && value.unknown[0] === "exact"),
      sourcePreserved: after.find(([key]) => key === p.LEGACY_KEY)[1].schemaVersion === 999,
      copiesRetained: copies.every(([key]) => after.some(([other]) => other === key)), created: created.ok };
  });
  assert.deepEqual(future, { copyCount: 2, unique: 2, exactCycles: true, sourcePreserved: true, copiesRetained: true, created: true });
  evidence.push({ check: "unique cyclic/future raw backups retained after fallback creation", result: "PASS", ...future }); await futureContext.close();

  for (const failKey of ["recovery", "marker"]) {
    const failureContext = await context(); const failurePage = await page(failureContext);
    const aborted = await failurePage.evaluate(async ({ legacy, failKey }) => {
      const p = window.proof; const raw = failKey === "recovery" ? { schemaVersion: 999, future: "must remain" } : legacy;
      await p.store.transaction((tx) => tx.put(p.LEGACY_KEY, raw));
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (value, key) {
        if (String(key).includes(failKey === "recovery" ? "instruction-builder:recovery:" : "guides-migration")) throw new DOMException("Injected quota", "QuotaExceededError");
        return put.call(this, value, key);
      };
      const repository = p.createGuideRepository(); let failed = false;
      try { await repository.list(); } catch { failed = true; }
      const create = await repository.create(p.createEmptyDocument()); IDBObjectStore.prototype.put = put;
      return { failed, create, entries: await p.store.transaction((tx) => tx.entries()), raw };
    }, { legacy, failKey });
    assert.equal(aborted.failed, true); assert.deepEqual(aborted.create, { ok: false, reason: "unavailable" }); assert.deepEqual(aborted.entries, [["instruction-builder:document", aborted.raw]]);
    evidence.push({ check: failKey === "recovery" ? "backup failure prevents fallback replacement" : "marker failure rolls back already-queued guide write", result: "PASS", transactions: "native readwrite abort; no marker or guide commits" });
    await failureContext.close();
  }
  const handoffContext = await context(); const handoffPage = await page(handoffContext);
  const handoff = await handoffPage.evaluate(async (legacy) => {
    const p = window.proof; await p.store.transaction((tx) => tx.put(p.LEGACY_KEY, legacy));
    const persistence = await import("/src/state/persistence.ts"); await persistence.initPersistence(); p.updateTitle("Old observer queued edit");
    await p.initializeGuides(p.documentSession); const list = p.guideSummaries.value; await p.openGuide(list[0].id);
    p.updateTitle("New observer edit"); await p.flushActiveGuide(); window.dispatchEvent(new Event("pagehide"));
    await new Promise((resolve) => setTimeout(resolve, 650));
    const raw = await p.store.transaction((tx) => tx.entries()); return { legacy: raw.find(([key]) => key === p.LEGACY_KEY)[1].meta.title,
      current: raw.find(([key]) => key === p.GUIDE_PREFIX + list[0].id)[1].document.meta.title, state: p.saveState.value };
  }, legacy);
  assert.deepEqual(handoff, { legacy: "Old observer queued edit", current: "New observer edit", state: "saved" });
  evidence.push({ check: "legacy observer shutdown drains its pending edit; only new observer saves afterward", result: "PASS", ...handoff }); await handoffContext.close();
  assert.deepEqual(errors, []);
  const report = { runAt: new Date().toISOString(), browser: browser.version(), url, checks: evidence, uncaughtBrowserErrors: errors };
  const path = `${process.cwd()}/docs/phase-3/audits/2026-10-06-overhaul/storage-proof/task-2-idb-evidence.json`;
  await writeFile(path, JSON.stringify(report, null, 2)); console.log(JSON.stringify({ artifact: path, checks: evidence.length, result: "PASS" }));
} finally { await browser?.close(); await server.close(); }
