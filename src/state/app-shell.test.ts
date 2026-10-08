import { signal } from "@preact/signals";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppShell } from "./app-shell";
import { createGuideBootstrap } from "./guide-bootstrap";
import { createDocumentSession, sessionActions } from "./document";
import { createPreferencesController } from "./preferences";
import { createGuideRepository } from "../lib/guide-repository";
import { createMemoryStorage } from "../test/memory-storage";
import { createEmptyDocument } from "../model/instruction";
import type { PendingImport, Toast } from "./ui";
import type { EntryView, ShellFocusAdapter } from "../lib/view-entry-focus";
import { t } from "../i18n/messages";
import type { JsonExportResult } from "../lib/document-file";

function deferred() { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; }
const cleanup: (() => void)[] = [];
afterEach(() => { cleanup.splice(0).forEach((dispose) => dispose()); vi.restoreAllMocks(); });
async function fixture(failStartup = false) {
  const state = { fail: failStartup, pause: undefined as Promise<void> | undefined };
  const data = createMemoryStorage({ beforeTransaction: () => state.pause, beforeCommit: () => { if (state.fail) throw new Error("quota"); } });
  const repository = createGuideRepository({ store: data.store });
  const pref = createPreferencesController({ store: data.store, languages: ["en"] });
  const session = createDocumentSession();
  const bootstrap = createGuideBootstrap({ store: data.store, repository, preferenceController: pref });
  await bootstrap.initialize(session); const controller = bootstrap.controller(); cleanup.push(controller.dispose);
  const view = signal<EntryView>("guides"), pendingImport = signal<PendingImport | null>(null), toast = signal<Toast | null>(null);
  const queued: (() => void)[] = [], focused: string[] = []; let modal = false;
  const focus: ShellFocusAdapter = {
    captureOpener: () => null,
    enter: (target, current) => { queued.push(() => { if (current() && !modal) focused.push(target); }); },
    returnToEditor: (destination, current) => { queued.push(() => { if (current() && !modal) focused.push(destination.pictureId ?? destination.groupId ?? "opener"); }); },
    restore: (_opener, current) => { queued.push(() => { if (current() && !modal) focused.push("output-opener"); }); },
  };
  const closeAuthoring = vi.fn(); const backup = vi.fn(async (): Promise<JsonExportResult> => ({ ok: true }));
  const shell = createAppShell({ controller: bootstrap.controller, session, view, pendingImport, toast,
    preferences: pref.preferences, retryPreferences: pref.retryPreferences, closeAuthoring, backup, focus });
  cleanup.push(shell.dispose);
  return { state, ...data, repository, pref, session, controller, bootstrap, view, pendingImport, toast, shell, closeAuthoring, backup,
    queued, focused, setModal: (value: boolean) => { modal = value; }, focusAll: () => queued.splice(0).forEach((run) => run()) };
}

describe("app shell", () => {
  it.each([false, true])("locks same-turn imports, blocks dismissal and clears a returned result (failure %s)", async (fail) => {
    const f = await fixture(); const gate = deferred(); f.state.pause = gate.promise; f.state.fail = fail;
    const doc = createEmptyDocument(); doc.meta.title = "Imported"; f.pendingImport.value = { document: doc };
    const first = f.shell.confirmImport(); expect(f.shell.guideCreationBusy.peek()).toBe(true);
    f.shell.closeImport(); expect(f.pendingImport.peek()?.document).toBe(doc);
    expect(await f.shell.confirmImport()).toBeUndefined(); expect(f.pendingImport.peek()?.document).toBe(doc);
    gate.resolve(); const result = await first;
    expect(result?.ok).toBe(!fail); expect(f.shell.guideCreationBusy.peek()).toBe(false); expect(f.pendingImport.peek()).toBeNull();
    f.state.fail = false; f.state.pause = undefined;
    expect(await f.repository.list()).toHaveLength(fail ? 0 : 1);
    expect(f.view.peek()).toBe(fail ? "guides" : "editor");
    expect(f.controller.failedNewGuide.peek()).toEqual(fail ? doc : null);
  });

  it("keeps a failed flush's view, panel and focus; orders successful navigation", async () => {
    const f = await fixture(); await f.shell.createOnce(createEmptyDocument()); f.focusAll(); f.focused.length = 0; f.closeAuthoring.mockClear();
    sessionActions.updateTitle(f.session, "Unsaved"); f.state.fail = true;
    expect((await f.shell.openGuides()).ok).toBe(false); expect(f.view.peek()).toBe("editor");
    expect(f.closeAuthoring).not.toHaveBeenCalled(); expect(f.queued).toHaveLength(0);
    f.state.fail = false; await f.controller.reloadActiveGuide(); sessionActions.updateTitle(f.session, "Saved");
    const order: string[] = []; const flush = f.controller.flushActiveGuide, refresh = f.controller.refreshGuides;
    vi.spyOn(f.controller, "flushActiveGuide").mockImplementation(async () => { const result = await flush(); order.push("flush"); return result; });
    f.closeAuthoring.mockImplementation(() => { order.push("close"); });
    vi.spyOn(f.controller, "refreshGuides").mockImplementation(async () => { order.push("refresh"); await refresh(); });
    expect((await f.shell.openGuides()).ok).toBe(true); f.focusAll(); order.push(...f.focused);
    expect(order).toEqual(["flush", "close", "refresh", "guides"]);
  });

  it("list actions are single-flight and return success and failure contracts", async () => {
    const f = await fixture(); const gate = deferred(); f.state.pause = gate.promise;
    const first = f.shell.runGuideAction((controller) => controller.createGuide(createEmptyDocument()), true);
    expect(f.shell.guideActionBusy.peek()).toBe(true);
    expect(await f.shell.runGuideAction((controller) => controller.openGuide("missing"), true)).toBeUndefined();
    gate.resolve(); expect((await first)?.ok).toBe(true); expect(f.view.peek()).toBe("editor"); expect(f.shell.guideActionBusy.peek()).toBe(false);
    f.view.value = "guides";
    const missing = await f.shell.runGuideAction((controller) => controller.openGuide("missing"), true);
    expect(missing).toEqual({ ok: false, reason: "not-found" }); expect(f.view.peek()).toBe("guides");
    const deleted = await f.shell.runGuideAction((controller) => controller.deleteGuide("missing", 1));
    expect(deleted).toEqual({ ok: false, reason: "deleted" }); expect(f.shell.guideActionBusy.peek()).toBe(false);
  });

  it("releases creation/list locks when an injected operation throws", async () => {
    const f = await fixture(); vi.spyOn(f.controller, "createGuide").mockRejectedValueOnce(new Error("unexpected"));
    await expect(f.shell.createOnce(createEmptyDocument())).rejects.toThrow("unexpected"); expect(f.shell.guideCreationBusy.peek()).toBe(false);
    await expect(f.shell.runGuideAction(async () => { throw new Error("unexpected"); })).rejects.toThrow("unexpected");
    expect(f.shell.guideActionBusy.peek()).toBe(false);
  });

  it("opens a real duplicate, deletes it and restores without an implicit view transition", async () => {
    const f = await fixture(); await f.shell.createOnce(createEmptyDocument()); const original = f.controller.activeGuideId.peek()!;
    await f.shell.openGuides();
    const duplicate = await f.shell.runGuideAction((controller) => controller.duplicateGuide(original), true);
    expect(duplicate?.ok).toBe(true); expect(f.view.peek()).toBe("editor"); expect(f.controller.activeGuideId.peek()).not.toBe(original);
    await f.shell.openGuides(); const summary = f.controller.guideSummaries.peek().find((guide) => guide.id !== original)!;
    expect((await f.shell.runGuideAction((controller) => controller.deleteGuide(summary.id, summary.revision)))?.ok).toBe(true);
    expect(f.view.peek()).toBe("guides"); const deleted = f.controller.lastDeletedGuide.peek()!;
    expect((await f.shell.runGuideAction((controller) => controller.restoreGuide(deleted.id, deleted.revision)))?.ok).toBe(true);
    expect(f.view.peek()).toBe("guides"); expect(await f.repository.list()).toHaveLength(2);
  });

  it("keeps real preference and guide failure statuses independent through retries", async () => {
    const f = await fixture(true); expect(f.controller.saveState.peek()).toBe("unavailable"); expect(f.pref.preferenceSaveState.peek()).toBe("unavailable");
    f.state.fail = false; const gate = deferred(); f.state.pause = gate.promise;
    const retry = f.shell.retryPreferenceStorage(); expect(f.shell.preferenceRetryBusy.peek()).toBe(true);
    expect(await f.shell.retryStorage()).toBeUndefined(); gate.resolve(); await retry;
    expect(f.pref.preferenceSaveState.peek()).toBe("saved"); expect(f.controller.saveState.peek()).toBe("unavailable");
    f.toast.value = { text: "Earlier failure", tone: "error" };
    expect((await f.shell.retryStorage())?.ok).toBe(true); expect(f.toast.peek()).toBeNull();
    expect(f.controller.saveState.peek()).toBe("pending"); expect(f.pref.preferenceSaveState.peek()).toBe("saved");
  });

  it("excludes retries synchronously, preserves separate statuses and localizes failure at completion", async () => {
    const f = await fixture(); const gate = deferred(); const entered = deferred();
    vi.spyOn(f.controller, "retryGuideStorage").mockImplementation(async () => { entered.resolve(); await gate.promise; return { ok: false, reason: "unavailable" }; });
    const guideStatus = f.controller.saveState.peek(), prefStatus = f.pref.preferenceSaveState.peek();
    const retry = f.shell.retryStorage(); await entered.promise;
    expect(f.shell.storageRetryBusy.peek()).toBe(true); expect(f.shell.preferenceRetryBusy.peek()).toBe(false);
    expect(await f.shell.retryPreferenceStorage()).toBeUndefined();
    f.pref.preferences.value = { ...f.pref.preferences.peek(), uiLocale: "de" }; gate.resolve(); await retry;
    expect(f.toast.peek()?.text).toBe(t("de", "save.unavailable")); expect(f.controller.saveState.peek()).toBe(guideStatus); expect(f.pref.preferenceSaveState.peek()).toBe(prefStatus);
    expect(f.shell.storageRetryBusy.peek()).toBe(false);
    const prefGate = deferred(); f.state.pause = prefGate.promise;
    const preferenceRetry = f.shell.retryPreferenceStorage(); expect(f.shell.preferenceRetryBusy.peek()).toBe(true);
    expect(await f.shell.retryStorage()).toBeUndefined(); prefGate.resolve(); await preferenceRetry;
    expect(f.shell.preferenceRetryBusy.peek()).toBe(false);
  });

  it("captures output locale and guide, invalidates on guide change, and localizes backup completion", async () => {
    const f = await fixture(); await f.shell.createOnce(createEmptyDocument()); f.shell.openOutput();
    expect(f.shell.output.peek()).toEqual({ guideId: f.controller.activeGuideId.peek(), locale: "en" });
    f.pref.preferences.value = { ...f.pref.preferences.peek(), uiLocale: "de" }; expect(f.shell.output.peek()?.locale).toBe("en");
    await f.controller.createGuide(createEmptyDocument()); expect(f.shell.output.peek()).toBeNull();
    const gate = deferred(); f.backup.mockImplementationOnce(async () => { await gate.promise; return { ok: false, reason: "export-failed" }; });
    const exporting = f.shell.backup(f.session.document.peek()); f.pref.preferences.value = { ...f.pref.preferences.peek(), uiLocale: "en" };
    gate.resolve(); await exporting; expect(f.toast.peek()?.text).toBe(t("en", "output.failed"));
  });

  it.each(["view", "guide", "modal"] as const)("suppresses queued entry/return/output focus after %s changes", async (change) => {
    const f = await fixture(); await f.shell.createOnce(createEmptyDocument()); f.focusAll(); f.focused.length = 0;
    let guideChanges = 0;
    for (const request of [() => f.shell.openEditor(), () => { f.shell.openReader(); f.queued.length = 0; f.shell.returnToEditor(); }, () => { f.shell.openOutput(); f.shell.closeOutput(); }]) {
      f.view.value = "editor"; f.setModal(false); request();
      if (change === "view") f.view.value = "guides";
      else if (change === "guide") f.controller.activeGuideId.value = "changed-" + ++guideChanges;
      else f.setModal(true);
      f.focusAll(); expect(f.focused).toEqual([]);
    }
  });
});

describe("guide bootstrap", () => {
  it("keeps signals/controller/promise across failed startup and retry, installs one observer", async () => {
    let fail = true, writes = 0;
    const data = createMemoryStorage({ beforeCommit: () => { if (fail) throw new Error("offline"); }, beforeWrite: (_kind, key) => { if (key.includes(":guide:")) writes++; } });
    const bootstrap = createGuideBootstrap({ store: data.store }); const session = createDocumentSession();
    expect(() => bootstrap.controller()).toThrow(); const signals = bootstrap.signals;
    const start = bootstrap.initialize(session); const controller = bootstrap.controller(); cleanup.push(controller.dispose);
    expect(bootstrap.initialize(session)).toBe(start); await start; expect(signals.saveState.peek()).toBe("unavailable");
    fail = false; expect((await controller.retryGuideStorage()).ok).toBe(true);
    expect(bootstrap.controller()).toBe(controller); expect(controller.activeGuideId).toBe(signals.activeGuideId); expect(bootstrap.initialize(session)).toBe(start);
    await controller.createGuide(createEmptyDocument()); writes = 0; sessionActions.updateTitle(session, "One observer"); await controller.flushActiveGuide();
    expect(writes).toBe(1); expect(signals.saveState.peek()).toBe("saved");
  });
});
