import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGuideController } from "./guides";
import { createPreferencesController, PREFERENCES_KEY } from "./preferences";
import { createGuideRepository, GUIDE_PREFIX, LEGACY_KEY, type GuideStore } from "../lib/guide-repository";
import { createDocumentSession, sessionActions } from "./document";
import { createEmptyDocument } from "../model/instruction";
import type { GuideRecord, GuideRepository } from "../model/guide";

function storage() {
  const records = new Map<string, unknown>(); let tail = Promise.resolve();
  const state = { fail: false, failPreferences: false };
  const store: GuideStore = { transaction: (operation) => {
    const promise = tail.then(() => {
      const draft = structuredClone(records);
      const result = operation({ get: (key) => draft.get(key), entries: () => [...draft], put: (key, value) => {
        if (state.failPreferences && key === PREFERENCES_KEY) throw new Error("preference quota");
        draft.set(key, structuredClone(value));
      } });
      if (state.fail) throw new Error("quota"); records.clear(); for (const [key, value] of draft) records.set(key, value); return result;
    }); tail = promise.then(() => undefined, () => undefined); return promise;
  } };
  return { records, store, state };
}
const cleanup: (() => void)[] = [];
async function fixture(options: { empty?: boolean; lastGuideId?: string; prepare?: (repository: GuideRepository, records: GuideRecord[]) => Promise<void>; wrap?: (repository: GuideRepository) => GuideRepository } = {}) {
  const data = storage(); const repository = createGuideRepository({ store: data.store });
  const records: GuideRecord[] = [];
  if (!options.empty) for (const title of ["A", "B"]) {
    const doc = createEmptyDocument(); doc.meta.title = title;
    doc.steps[0].tokens = [{ id: "token-" + title, iconId: "onion", category: "object", label: title }];
    const result = await repository.create(doc); if (!result.ok) throw new Error("fixture create"); records.push(result.record);
  }
  const preferenceController = createPreferencesController({ store: data.store, languages: ["en"] });
  await preferenceController.initializePreferences();
  if (records[0] || options.lastGuideId) await preferenceController.updatePreferences({ lastGuideId: options.lastGuideId ?? records[0].id });
  await options.prepare?.(repository, records);
  const session = createDocumentSession();
  const controller = createGuideController(session, { repository: options.wrap?.(repository) ?? repository, store: data.store, preferenceController });
  cleanup.push(controller.dispose); await controller.initializeGuides();
  return { ...data, repository, records, session, controller, preferenceController };
}
function deferred() { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; }

describe("local guide controller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { for (const dispose of cleanup.splice(0)) dispose(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("keeps a fresh profile empty and rejects missing last-guide targets", async () => {
    const { controller, records, preferenceController } = await fixture({ empty: true, lastGuideId: "missing" });
    expect(controller.activeGuideId.value).toBeNull(); expect(controller.guideSummaries.value).toEqual([]); expect(records).toEqual([]);
    await preferenceController.updatePreferences({ lastGuideId: "missing" });
    expect(await controller.openGuide("missing")).toEqual({ ok: false, reason: "not-found" });
    expect(controller.activeGuideId.value).toBeNull();
  });

  it("a deleted last-guide preference returns to My guides without another creation", async () => {
    const { controller, records, repository } = await fixture({ prepare: async (repository, records) => {
      expect((await repository.remove(records[0].id, 1)).ok).toBe(true);
    } });
    expect(controller.activeGuideId.value).toBeNull(); expect(controller.guideSummaries.value.map((guide) => guide.id)).toEqual([records[1].id]);
    expect((await repository.load(records[0].id))?.deletedAt).toBeDefined();
  });

  it("drainsLatestEditBeforeNavigation", async () => {
    const gate = deferred(); let writes = 0;
    const { controller, session, records, store } = await fixture({ wrap: (repository) => ({ ...repository, save: async (...args) => {
      if (++writes === 1) await gate.promise; return repository.save(...args);
    } }) });
    sessionActions.updateTitle(session, "First"); await vi.advanceTimersByTimeAsync(200);
    expect(controller.saveState.value).toBe("saving");
    sessionActions.updateTitle(session, "Latest"); expect(controller.saveState.value).toBe("pending");
    let opened = false; const navigation = controller.openGuide(records[1].id).then((result) => { opened = result.ok; return result; });
    await Promise.resolve(); expect(opened).toBe(false);
    gate.resolve(); expect(await navigation).toEqual({ ok: true, guideId: records[1].id });
    expect(session.document.value.meta.title).toBe("B"); expect(writes).toBe(2);
    const disk = await createGuideRepository({ store }).load(records[0].id);
    expect(disk?.document.meta.title).toBe("Latest"); expect(disk?.revision).toBe(3);
    expect((await createGuideRepository({ store }).load(records[1].id))?.revision).toBe(1);
  });

  it("drains edits arriving while the target loads", async () => {
    const gate = deferred(); let block = false;
    const { controller, session, records, store } = await fixture({ wrap: (repository) => ({ ...repository, load: async (id) => {
      if (block) await gate.promise; return repository.load(id);
    } }) });
    block = true; const navigation = controller.openGuide(records[1].id);
    await Promise.resolve(); await Promise.resolve(); sessionActions.updateTitle(session, "Edited while opening");
    gate.resolve(); expect((await navigation).ok).toBe(true);
    expect((await createGuideRepository({ store }).load(records[0].id))?.document.meta.title).toBe("Edited while opening");
  });

  it("isolatesHistoryAndClipboard", async () => {
    const { controller, session, records } = await fixture();
    sessionActions.updateTitle(session, "A edited"); sessionActions.copyToken(session, records[0].document.steps[0].id, "token-A");
    await controller.openGuide(records[1].id); sessionActions.undo(session); sessionActions.pasteToken(session);
    expect(session.document.value.meta.title).toBe("B"); expect(session.document.value.steps[0].tokens.map((token) => token.label)).toEqual(["B"]);
    expect(session.past.value).toEqual([]); expect(session.copiedToken.value).toBeNull();
    await controller.openGuide(records[0].id); expect(session.document.value.meta.title).toBe("A edited");
  });

  it("reportsTruthfulSaveState", async () => {
    const first = deferred(); const second = deferred(); let writes = 0;
    const { controller, session, state } = await fixture({ wrap: (repository) => ({ ...repository, save: async (...args) => {
      await (++writes === 1 ? first.promise : second.promise); return repository.save(...args);
    } }) });
    expect(controller.saveState.value).toBe("saved"); sessionActions.updateTitle(session, "One"); expect(controller.saveState.value).toBe("pending");
    await vi.advanceTimersByTimeAsync(200); expect(controller.saveState.value).toBe("saving");
    sessionActions.updateTitle(session, "Two"); expect(controller.saveState.value).toBe("pending");
    first.resolve(); await vi.advanceTimersByTimeAsync(200); expect(controller.saveState.value).not.toBe("saved");
    second.resolve(); await controller.flushActiveGuide(); expect(controller.saveState.value).toBe("saved");
    state.fail = true; sessionActions.updateTitle(session, "Quota draft");
    expect(await controller.flushActiveGuide()).toEqual({ ok: false, reason: "unavailable" }); expect(controller.saveState.value).toBe("unavailable");
    state.fail = false; sessionActions.updateTitle(session, "Still local"); await vi.advanceTimersByTimeAsync(500);
    expect(controller.saveState.value).toBe("unavailable");
  });

  it("summary refresh cannot rebase a same-revision external edit", async () => {
    const { controller, session, records, records: [active], ...data } = await fixture();
    const external = structuredClone(active); external.document.meta.title = "External without revision bump";
    const diskRecords = await data.store.transaction((tx) => tx.entries());
    expect(diskRecords).toHaveLength(3);
    await data.store.transaction((tx) => tx.put(GUIDE_PREFIX + active.id, external));
    await controller.refreshGuides(); sessionActions.updateTitle(session, "Losing local");
    expect(await controller.flushActiveGuide()).toEqual({ ok: false, reason: "conflict" });
    expect(session.document.value.meta.title).toBe("Losing local"); expect(records[0].id).toBe(active.id);
  });

  it("reloadResolvesConflictWithoutStaleFlush", async () => {
    const { controller, session, records, store } = await fixture(); const other = createGuideRepository({ store });
    const winner = await other.load(records[0].id); if (!winner) throw new Error("fixture load"); winner.document.meta.title = "Winner";
    await other.save(winner.id, winner.revision, winner.document); sessionActions.updateTitle(session, "Loser");
    expect((await controller.flushActiveGuide()).ok).toBe(false); expect(controller.saveState.value).toBe("conflict");
    sessionActions.copyToken(session, session.document.value.steps[0].id, "token-A");
    expect(await controller.reloadActiveGuide()).toEqual({ ok: true, guideId: winner.id });
    expect(session.document.value.meta.title).toBe("Winner"); expect(session.past.value).toEqual([]); expect(session.copiedToken.value).toBeNull();
    expect(controller.saveState.value).toBe("saved"); sessionActions.updateTitle(session, "After reload");
    expect((await controller.flushActiveGuide()).ok).toBe(true);
    expect((await other.load(winner.id))?.document.meta.title).toBe("After reload");
  });

  it("failed/deleted explicit reload preserves losing draft and history", async () => {
    const { controller, session, records, store } = await fixture(); const other = createGuideRepository({ store });
    const disk = await other.load(records[0].id); if (!disk) throw new Error("fixture load"); await other.remove(disk.id, disk.revision);
    sessionActions.updateTitle(session, "Recoverable deleted draft");
    expect(await controller.flushActiveGuide()).toEqual({ ok: false, reason: "deleted" });
    const draft = session.document.value; const history = session.past.value;
    expect(await controller.reloadActiveGuide()).toEqual({ ok: false, reason: "deleted" });
    expect(session.document.value).toBe(draft); expect(session.past.value).toBe(history);
    expect(await controller.openGuide(records[1].id)).toEqual({ ok: false, reason: "deleted" });
  });

  it("active delete validates the requested baseline then uses its own flushed revision", async () => {
    const { controller, session, records, store } = await fixture(); sessionActions.updateTitle(session, "Delete latest");
    expect(await controller.deleteGuide(records[0].id, 99)).toEqual({ ok: false, reason: "conflict" });
    expect(controller.saveState.value).toBe("pending");
    expect((await controller.deleteGuide(records[0].id, 1)).ok).toBe(true); expect(controller.activeGuideId.value).toBeNull();
    const tombstone = await createGuideRepository({ store }).load(records[0].id);
    expect(tombstone).toMatchObject({ revision: 3, document: { meta: { title: "Delete latest" } }, deletedAt: expect.any(String) });
    expect(controller.lastDeletedGuide.value).toEqual(tombstone);
    expect(await controller.restoreGuide(records[0].id, 1)).toEqual({ ok: false, reason: "conflict" });
    expect(controller.lastDeletedGuide.value?.revision).toBe(3);
    expect((await controller.restoreGuide(records[0].id, 3)).ok).toBe(true); expect(controller.guideSummaries.value).toHaveLength(2);
    expect((await createGuideRepository({ store }).load(records[0].id))?.revision).toBe(4);
    expect(controller.lastDeletedGuide.value).toBeNull();
  });

  it("an edit during explicit reload cancels adoption and cannot use the loaded raw baseline", async () => {
    const entered = deferred(); const gate = deferred(); let block = false;
    const { controller, session, records, store } = await fixture({ wrap: (repository) => ({ ...repository, load: async (id) => {
      const result = await repository.load(id);
      if (block) { entered.resolve(); await gate.promise; }
      return result;
    } }) });
    await store.transaction((tx) => { const raw = tx.get(GUIDE_PREFIX + records[0].id) as GuideRecord;
      raw.document.meta.title = "Same-revision disk winner"; tx.put(GUIDE_PREFIX + raw.id, raw); });
    block = true; const reload = controller.reloadActiveGuide(); await entered.promise;
    sessionActions.updateTitle(session, "New local edit during reload"); await vi.advanceTimersByTimeAsync(250);
    expect((await createGuideRepository({ store }).load(records[0].id))?.document.meta.title).toBe("Same-revision disk winner");
    gate.resolve();
    expect(await reload).toEqual({ ok: false, reason: "cancelled" });
    expect(await controller.flushActiveGuide()).toEqual({ ok: false, reason: "conflict" });
    expect(session.document.value.meta.title).toBe("New local edit during reload");
    expect((await createGuideRepository({ store }).load(records[0].id))?.document.meta.title).toBe("Same-revision disk winner");
  });

  it.each(["pagehide", "visibilitychange", "direct"] as const)("%s cannot start a save while reload holds an unadopted disk baseline", async (trigger) => {
    const window = Object.assign(new EventTarget(), { document: { visibilityState: "visible" } }); vi.stubGlobal("window", window);
    const entered = deferred(); const gate = deferred(); let pauseLoad = false; let writes = 0;
    const { controller, session, records, store } = await fixture({ wrap: (repository) => ({ ...repository,
      load: async (id) => { const record = await repository.load(id); if (pauseLoad) { entered.resolve(); await gate.promise; } return record; },
      save: (...args) => { writes++; return repository.save(...args); },
    }) });
    const winner = { ...records[0], document: { ...records[0].document, meta: { ...records[0].document.meta, title: "Same-revision disk winner" } } };
    await store.transaction((tx) => tx.put(GUIDE_PREFIX + winner.id, winner));
    pauseLoad = true; const reload = controller.reloadActiveGuide(); await entered.promise;
    sessionActions.updateTitle(session, "Exportable edit during reload");
    if (trigger === "visibilitychange") window.document.visibilityState = "hidden";
    if (trigger !== "direct") window.dispatchEvent(new Event(trigger));
    const flushed = await controller.flushActiveGuide(); await vi.advanceTimersByTimeAsync(250);
    const disk = await store.transaction((tx) => tx.get(GUIDE_PREFIX + winner.id));
    gate.resolve(); const result = await reload;
    expect(flushed).toEqual({ ok: false, reason: "cancelled" }); expect(disk).toEqual(winner); expect(writes).toBe(0);
    expect(result).toEqual({ ok: false, reason: "cancelled" }); expect(session.document.value.meta.title).toBe("Exportable edit during reload");
    expect(controller.saveState.value).toBe("conflict");
    expect(await controller.flushActiveGuide()).toEqual({ ok: false, reason: "conflict" });
    pauseLoad = false; expect((await controller.reloadActiveGuide()).ok).toBe(true);
    expect(session.document.value.meta.title).toBe("Same-revision disk winner");
    sessionActions.updateTitle(session, "Edit after successful adoption"); expect((await controller.flushActiveGuide()).ok).toBe(true);
  });

  it("reload awaits only the existing write and preserves edits queued while it waits", async () => {
    const saving = deferred(); const releaseWrite = deferred(); const loading = deferred(); const releaseLoad = deferred();
    let writes = 0; let pauseLoad = false;
    const { controller, session, records, store } = await fixture({ wrap: (repository) => ({ ...repository,
      save: async (...args) => { writes++; saving.resolve(); await releaseWrite.promise; return repository.save(...args); },
      load: async (id) => { const record = await repository.load(id); if (pauseLoad) { loading.resolve(); await releaseLoad.promise; } return record; },
    }) });
    sessionActions.updateTitle(session, "Write already in flight"); const first = controller.flushActiveGuide(); await saving.promise;
    sessionActions.updateTitle(session, "Queued before reload"); pauseLoad = true;
    const reload = controller.reloadActiveGuide(); await Promise.resolve(); await Promise.resolve();
    sessionActions.updateTitle(session, "New edit while reload waits"); releaseWrite.resolve(); await loading.promise;
    expect(writes).toBe(1);
    expect(await controller.flushActiveGuide()).toEqual({ ok: false, reason: "cancelled" });
    releaseLoad.resolve(); expect(await reload).toEqual({ ok: false, reason: "cancelled" });
    expect(await first).toEqual({ ok: false, reason: "cancelled" });
    expect(session.document.value.meta.title).toBe("New edit while reload waits");
    expect((await store.transaction((tx) => tx.get(GUIDE_PREFIX + records[0].id)) as GuideRecord).document.meta.title).toBe("Write already in flight");
    expect(controller.saveState.value).toBe("conflict");
  });

  it("failed create preserves current session and exposes the attempted new document", async () => {
    const { controller, session, state, records } = await fixture(); const current = session.document.value;
    const attempt = createEmptyDocument("board"); attempt.meta.title = "Attempted"; state.fail = true;
    expect(await controller.createGuide(attempt)).toEqual({ ok: false, reason: "unavailable" });
    expect(session.document.value).toBe(current); expect(controller.activeGuideId.value).toBe(records[0].id);
    expect(controller.failedNewGuide.value).toEqual(attempt);
    state.fail = false; expect((await controller.createGuide(attempt)).ok).toBe(true);
    expect(controller.failedNewGuide.value).toBeNull(); expect(session.document.value.meta.title).toBe("Attempted");
    expect(controller.guideSummaries.value).toHaveLength(3);
  });

  it("duplicate flushes the active source and uses explicit UI locale", async () => {
    const { controller, session, preferenceController, records } = await fixture();
    await preferenceController.updatePreferences({ uiLocale: "de" }); sessionActions.updateTitle(session, "Latest source");
    expect((await controller.duplicateGuide(records[0].id)).ok).toBe(true);
    expect(session.document.value.meta.title).toBe("Latest source (Kopie)");
    expect(session.document.value.steps[0].tokens[0].id).toBe("token-A"); expect(controller.guideSummaries.value).toHaveLength(3);
  });

  it("preferencesDoNotEditDocuments", async () => {
    const { controller, session, preferenceController, state, records, store } = await fixture();
    const before = session.document.value; sessionActions.updateTitle(session, "Authored"); await controller.flushActiveGuide();
    const history = session.past.value; const diskBefore = await createGuideRepository({ store }).load(records[0].id);
    state.failPreferences = true; await preferenceController.updatePreferences({ uiLocale: "de", labelLocale: "de", activeLibraryId: "learning" });
    expect(preferenceController.preferenceSaveState.value).toBe("unavailable"); expect(controller.saveState.value).toBe("saved");
    expect(session.past.value).toBe(history); expect(session.document.value.steps).toBe(before.steps);
    expect(await createGuideRepository({ store }).load(records[0].id)).toEqual(diskBefore);
  });

  it("imports recovered content as another guide and never removes the recovery source", async () => {
    const { controller, store, session } = await fixture(); const recovered = createEmptyDocument("board"); recovered.meta.title = "Recovered";
    const key = "instruction-builder:recovery:fixture"; await store.transaction((tx) => tx.put(key, recovered));
    expect((await controller.importRecoveredGuide(key)).ok).toBe(true); expect(session.document.value.meta.title).toBe("Recovered");
    expect(await store.transaction((tx) => tx.get(key))).toEqual(recovered); expect(controller.guideSummaries.value).toHaveLength(3);
    await store.transaction((tx) => tx.put(key, { schemaVersion: 999 })); const draft = session.document.value;
    expect((await controller.importRecoveredGuide(key)).ok).toBe(false); expect(session.document.value).toBe(draft);
    expect((await controller.importRecoveredGuide(LEGACY_KEY)).ok).toBe(false);
  });
});
