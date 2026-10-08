import { signal, effect, batch } from "@preact/signals";
import type { GuideRecord, GuideRepository, GuideSummary, GuideWriteResult } from "../model/guide";
import type { InstructionDocument } from "../model/instruction";
import { openDocumentInSession, type DocumentSession } from "./document";
import { createGuideRepository, createIndexedDbGuideStore, type GuideStore, type GuideNotice } from "../lib/guide-repository";
import { createPreferencesController, preferences, initializePreferences, retryPreferences, updatePreferences, preferenceSaveState, type PreferencesController } from "./preferences";
import { migrate } from "../model/migrate";
import { t } from "../i18n/messages";
export type { GuideNotice } from "../lib/guide-repository";
export type SaveState = "loading" | "saved" | "pending" | "saving" | "unavailable" | "conflict";
export type GuideActionResult = { ok: true; guideId?: string } | { ok: false; reason: "conflict" | "unavailable" | "deleted" | "not-found" | "cancelled" };
type GuidePreferencesController = Pick<PreferencesController, "preferences" | "preferenceSaveState" | "initializePreferences" | "updatePreferences"> & { retryPreferences?: () => Promise<void> };
export interface GuideControllerOptions { repository?: GuideRepository; store?: GuideStore; preferenceController?: GuidePreferencesController; signals?: ReturnType<typeof createGuideControllerSignals> }
export function createGuideController(session: DocumentSession, options: GuideControllerOptions = {}) {
  const { activeGuideId, guideSummaries, saveState, failedNewGuide, guideNotices, lastDeletedGuide, startupStorageUnavailable } = options.signals ?? createGuideControllerSignals();
  const store = options.store ?? createIndexedDbGuideStore();
  const repository = options.repository ?? createGuideRepository({ store, onNotice: (notice) => { guideNotices.value = [...guideNotices.peek(), notice]; } });
  const pref: GuidePreferencesController = options.preferenceController ?? createPreferencesController({ store });
  let baseline: GuideRecord | undefined; let cleanDocument = session.document.peek();
  let pending: InstructionDocument | undefined; let timer: ReturnType<typeof setTimeout> | undefined;
  let drain: Promise<GuideActionResult> | undefined; let initialization: Promise<void> | undefined;
  let blocked: "conflict" | "unavailable" | "deleted" | undefined;
  let disposeObserver: (() => void) | undefined; let operationTail = Promise.resolve(); let disposed = false; let reloading = false;
  let startupComplete = false;
  function clearTimer() { if (timer !== undefined) clearTimeout(timer); timer = undefined; }
  function failure(reason: "conflict" | "unavailable" | "deleted"): GuideActionResult {
    blocked = reason; saveState.value = reason === "deleted" ? "conflict" : reason; clearTimer();
    return { ok: false, reason };
  }
  function adopt(record: GuideRecord) {
    clearTimer(); pending = undefined; blocked = undefined; baseline = record; cleanDocument = record.document;
    batch(() => { activeGuideId.value = record.id; openDocumentInSession(session, record.document); saveState.value = "saved"; });
    void pref.updatePreferences({ lastGuideId: record.id });
  }
  function updateSummary(record: GuideRecord) {
    const others = guideSummaries.peek().filter((summary) => summary.id !== record.id);
    if (record.deletedAt === undefined) others.push({ id: record.id, revision: record.revision, title: record.document.meta.title,
      presentation: record.document.meta.presentation, updatedAt: record.updatedAt });
    guideSummaries.value = others.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  }
  async function refreshGuides(): Promise<void> {
    try { guideSummaries.value = await repository.list(); } catch { failure("unavailable"); }
  }
  function observeDocument() {
    if (disposeObserver || disposed) return;
    disposeObserver = effect(() => {
      const doc = session.document.value;
      if (disposed) return;
      if (doc === cleanDocument && !drain) {
        // Undo can return to the committed snapshot before its queued edit saves.
        pending = undefined; clearTimer();
        if (baseline && !blocked && !reloading) saveState.value = "saved";
        return;
      }
      // Even the previously clean snapshot needs saving if an older edit is in flight.
      pending = doc;
      if (blocked) return;
      saveState.value = "pending"; clearTimer();
      if (reloading) return;
      timer = setTimeout(() => { void flushActiveGuide(); }, 200);
    });
    if (typeof window !== "undefined") { window.addEventListener("pagehide", pagehide); window.addEventListener("visibilitychange", visibilitychange); }
  }
  async function startGuides(retry = false): Promise<GuideActionResult> {
    if (startupComplete) return blocked ? { ok: false, reason: blocked } : { ok: true, ...(baseline ? { guideId: baseline.id } : {}) };
    // Startup has no saved baseline. Never replace edits made before or during recovery.
    const local = cleanDocument;
    const cancelled = () => disposed || session.document.peek() !== local;
    function preserveDraft(): GuideActionResult {
      startupStorageUnavailable.value = true; failure("unavailable");
      return { ok: false, reason: "cancelled" };
    }
    if (cancelled()) return preserveDraft();
    // Preference persistence is independent of guide storage availability.
    try { await (retry && pref.retryPreferences ? pref.retryPreferences() : pref.initializePreferences()); } catch { /* Its own status remains visible. */ }
    if (cancelled()) return preserveDraft();
    try {
      const summaries = await repository.list();
      if (cancelled()) return preserveDraft();
      const id = pref.preferences.peek().lastGuideId;
      const record = id === undefined ? undefined : await repository.load(id);
      if (cancelled()) return preserveDraft();
      guideSummaries.value = summaries;
      blocked = undefined;
      if (record && record.deletedAt === undefined) adopt(record);
      else saveState.value = "pending";
      startupComplete = true; startupStorageUnavailable.value = false;
      observeDocument();
      return { ok: true, ...(baseline ? { guideId: baseline.id } : {}) };
    } catch {
      startupStorageUnavailable.value = true;
      return failure("unavailable");
    }
  }
  function initializeGuides(): Promise<void> {
    initialization ??= startGuides().then(() => undefined);
    return initialization;
  }
  async function flushActiveGuide(): Promise<GuideActionResult> {
    clearTimer();
    // load() may have adopted a newer raw baseline without its document yet.
    // Every caller, including lifecycle events, must honor that adoption barrier.
    if (reloading) return { ok: false, reason: "cancelled" };
    if (blocked) return { ok: false, reason: blocked };
    if (drain) { const result = await drain; return result.ok && pending ? flushActiveGuide() : result; }
    if (!pending) return { ok: true, ...(baseline ? { guideId: baseline.id } : {}) };
    if (!baseline) return { ok: false, reason: "unavailable" };
    drain = (async (): Promise<GuideActionResult> => {
      while (pending && baseline && !disposed && !reloading) {
        const source = pending; pending = undefined; const target = baseline;
        saveState.value = "saving";
        let result: GuideWriteResult;
        try { result = await repository.save(target.id, target.revision, structuredClone(source)); }
        catch { result = { ok: false, reason: "unavailable" }; }
        if (!result.ok) { pending = session.document.peek(); return failure(result.reason); }
        // Navigation awaits this entire drain, so the captured target remains active.
        baseline = result.record; cleanDocument = source; updateSummary(result.record);
        if (pending) saveState.value = "pending";
      }
      if (!disposed) saveState.value = pending ? "pending" : "saved";
      if (reloading && pending) return { ok: false, reason: "cancelled" };
      return { ok: true, guideId: baseline?.id };
    })().finally(() => { drain = undefined; });
    return drain;
  }
  function pagehide() { void flushActiveGuide(); }
  function visibilitychange() { if (window.document.visibilityState === "hidden") void flushActiveGuide(); }
  function serialize(operation: () => Promise<GuideActionResult>): Promise<GuideActionResult> {
    const result = operationTail.then(async () => { await initializeGuides(); return operation(); });
    operationTail = result.then(() => undefined, () => undefined);
    return result.catch(() => ({ ok: false, reason: "unavailable" }));
  }
  async function open(id: string): Promise<GuideActionResult> {
    const flushed = await flushActiveGuide(); if (!flushed.ok) return flushed;
    if (id === activeGuideId.peek()) return { ok: true, guideId: id };
    let record: GuideRecord | undefined; try { record = await repository.load(id); } catch { return { ok: false, reason: "unavailable" }; }
    if (!record) return { ok: false, reason: "not-found" };
    if (record.deletedAt !== undefined) return { ok: false, reason: "deleted" };
    // The old document may have been edited while the target was loading.
    const latest = await flushActiveGuide(); if (!latest.ok) return latest;
    adopt(record); return { ok: true, guideId: id };
  }
  async function finishCreation(result: GuideWriteResult): Promise<GuideActionResult> {
    if (!result.ok) return { ok: false, reason: result.reason };
    updateSummary(result.record);
    const latest = await flushActiveGuide(); if (!latest.ok) return latest;
    adopt(result.record); failedNewGuide.value = null;
    return { ok: true, guideId: result.record.id };
  }
  async function create(doc: InstructionDocument): Promise<GuideActionResult> {
    let candidate: InstructionDocument;
    try { candidate = structuredClone(migrate(doc)); } catch { return { ok: false, reason: "unavailable" }; }
    const flushed = await flushActiveGuide();
    if (!flushed.ok) { failedNewGuide.value = candidate; return flushed; }
    let result: GuideWriteResult; try { result = await repository.create(candidate); } catch { result = { ok: false, reason: "unavailable" }; }
    const finished = await finishCreation(result);
    if (!finished.ok) failedNewGuide.value = candidate;
    return finished;
  }
  return { activeGuideId, guideSummaries, saveState, guideNotices, failedNewGuide, lastDeletedGuide, startupStorageUnavailable, initializeGuides, refreshGuides,
    retryGuideStorage: () => serialize(() => startGuides(true)),
    openGuide: (id: string) => serialize(() => open(id)), flushActiveGuide,
    reloadActiveGuide: () => serialize(async () => {
      clearTimer(); reloading = true;
      const local = session.document.peek();
      try {
        // Only an already-started write may finish; its loop cannot start another.
        if (drain) await drain;
        const id = activeGuideId.peek(); if (id === null) return { ok: false, reason: "not-found" };
        let record: GuideRecord | undefined; try { record = await repository.load(id); } catch { return failure("unavailable"); }
        if (!record) { failure("deleted"); return { ok: false, reason: "not-found" }; }
        if (record.deletedAt !== undefined) return failure("deleted");
        if (session.document.peek() !== local) {
          // load() adopted a raw baseline, but the user has not adopted its document.
          // Keep saving blocked until a subsequent explicit reload can adopt both.
          failure("conflict"); return { ok: false, reason: "cancelled" };
        }
        adopt(record); updateSummary(record); return { ok: true, guideId: id };
      } finally { reloading = false; }
    }),
    createGuide: (doc: InstructionDocument) => {
      // Capture at invocation, before another queued navigation can mutate caller-owned data.
      let snapshot: InstructionDocument; try { snapshot = structuredClone(migrate(doc)); } catch { return Promise.resolve<GuideActionResult>({ ok: false, reason: "unavailable" }); }
      return serialize(() => create(snapshot));
    },
    duplicateGuide: (id: string) => serialize(async () => {
      const flushed = await flushActiveGuide(); if (!flushed.ok) return flushed;
      const source = id === baseline?.id ? baseline : await repository.load(id);
      if (!source) return { ok: false, reason: "not-found" };
      if (source.deletedAt !== undefined) return { ok: false, reason: "deleted" };
      const title = t(pref.preferences.peek().uiLocale, "guide.copyTitle", { title: source.document.meta.title });
      return finishCreation(await repository.duplicate(id, title));
    }),
    deleteGuide: (id: string, expectedRevision: number) => serialize(async () => {
      const active = id === activeGuideId.peek();
      if (active && baseline?.revision !== expectedRevision) return { ok: false, reason: "conflict" };
      if (active) { const flushed = await flushActiveGuide(); if (!flushed.ok) return flushed; }
      const result = await repository.remove(id, active ? baseline!.revision : expectedRevision);
      if (!result.ok) return active ? failure(result.reason) : { ok: false, reason: result.reason };
      lastDeletedGuide.value = result.record;
      updateSummary(result.record);
      if (active) {
        // Do not discard any edit that arrived during the delete transaction.
        if (pending) return failure("deleted");
        baseline = undefined; activeGuideId.value = null; clearTimer(); saveState.value = "pending";
        void pref.updatePreferences({ lastGuideId: undefined });
      }
      return { ok: true, guideId: id };
    }),
    restoreGuide: (id: string, expectedRevision: number) => serialize(async () => {
      const result = await repository.restore(id, expectedRevision);
      if (!result.ok) return { ok: false, reason: result.reason };
      if (lastDeletedGuide.peek()?.id === id) lastDeletedGuide.value = null;
      updateSummary(result.record); return { ok: true, guideId: id };
    }),
    importRecoveredGuide: (key: string) => serialize(async () => {
      if (!key.startsWith("instruction-builder:recovery:")) return { ok: false, reason: "not-found" };
      const raw = await store.transaction({ keys: [key], mode: "readonly" }, (transaction) => transaction.get(key));
      if (raw === undefined) return { ok: false, reason: "not-found" };
      try {
        const doc = typeof raw === "object" && raw !== null && "document" in raw ? raw.document : raw;
        return await create(migrate(doc));
      } catch { return { ok: false, reason: "unavailable" }; }
    }),
    dispose: () => {
      disposed = true; clearTimer(); disposeObserver?.();
      if (typeof window !== "undefined") { window.removeEventListener("pagehide", pagehide); window.removeEventListener("visibilitychange", visibilitychange); }
    },
  };
}

const pref: GuidePreferencesController = { preferences, initializePreferences, retryPreferences, updatePreferences, preferenceSaveState };
let defaultController: ReturnType<typeof createGuideController> | undefined;
let defaultInitialization: Promise<void> | undefined;
// Export stable signal identities before asynchronous startup.
const uninitialized = createGuideControllerSignals();
function createGuideControllerSignals() {
  return { activeGuideId: signal<string | null>(null), guideSummaries: signal<readonly GuideSummary[]>([]), saveState: signal<SaveState>("loading"),
    guideNotices: signal<readonly GuideNotice[]>([]), failedNewGuide: signal<InstructionDocument | null>(null), lastDeletedGuide: signal<GuideRecord | null>(null),
    startupStorageUnavailable: signal(false) };
}
export const { activeGuideId, guideSummaries, saveState, guideNotices, failedNewGuide, lastDeletedGuide, startupStorageUnavailable } = uninitialized;
export function initializeGuides(session: DocumentSession): Promise<void> {
  defaultInitialization ??= (async () => {
    defaultController = createGuideController(session, { preferenceController: pref, signals: uninitialized });
    await defaultController.initializeGuides();
  })();
  return defaultInitialization;
}
function controller() { if (!defaultController) throw new Error("initializeGuides must complete before guide actions"); return defaultController; }
export const refreshGuides = () => controller().refreshGuides();
export const retryGuideStorage = () => controller().retryGuideStorage();
export const openGuide = (id: string) => controller().openGuide(id);
export const reloadActiveGuide = () => controller().reloadActiveGuide();
export const createGuide = (doc: InstructionDocument) => controller().createGuide(doc);
export const duplicateGuide = (id: string) => controller().duplicateGuide(id);
export const deleteGuide = (id: string, revision: number) => controller().deleteGuide(id, revision);
export const restoreGuide = (id: string, revision: number) => controller().restoreGuide(id, revision);
export const flushActiveGuide = () => controller().flushActiveGuide();
export const importRecoveredGuide = (key: string) => controller().importRecoveredGuide(key);
