import { effect, signal, type Signal } from "@preact/signals";
import type { GuideActionResult, GuideController } from "./guides";
import type { DocumentSession } from "./document";
import type { PendingImport, Toast } from "./ui";
import type { AppPreferences } from "../model/preferences";
import type { InstructionDocument } from "../model/instruction";
import type { AppLocale } from "../model/library";
import type { JsonExportResult } from "../lib/document-file";
import type { EntryView, ShellFocusAdapter, FocusTarget } from "../lib/view-entry-focus";
import { t } from "../i18n/messages";

export interface AppShellOptions {
  controller: () => GuideController;
  session: DocumentSession;
  view: Signal<EntryView>;
  pendingImport: Signal<PendingImport | null>;
  toast: Signal<Toast | null>;
  preferences: Signal<AppPreferences>;
  retryPreferences: () => Promise<void>;
  closeAuthoring: () => void;
  backup: (document: InstructionDocument) => Promise<JsonExportResult>;
  focus: ShellFocusAdapter;
}
export type CapturedOutput = { guideId: string | null; locale: AppLocale };

/** UI orchestration for the injected session; storage policy stays in its controller. */
export function createAppShell(options: AppShellOptions) {
  const { controller, session, view, pendingImport, toast, preferences, focus, closeAuthoring } = options;
  const guideCreationBusy = signal(false), guideActionBusy = signal(false);
  const storageRetryBusy = signal(false), preferenceRetryBusy = signal(false);
  const output = signal<CapturedOutput | null>(null);
  let readerOpener: FocusTarget | null = null, outputOpener: FocusTarget | null = null;
  let disposed = false;
  const stopOutput = effect(() => {
    const guideId = controller().activeGuideId.value;
    const currentView = view.value;
    const captured = output.value;
    if (captured && (captured.guideId !== guideId || currentView !== "editor")) output.value = null;
  });
  function guard(destination: EntryView) {
    const guideId = controller().activeGuideId.peek();
    return () => !disposed && view.peek() === destination && controller().activeGuideId.peek() === guideId && output.peek() === null;
  }
  function reportResult(result: GuideActionResult) {
    if (!result.ok) toast.value = { text: t(preferences.peek().uiLocale,
      result.reason === "not-found" ? "guides.notFound" : result.reason === "deleted" ? "guides.deleted" :
      result.reason === "conflict" || result.reason === "cancelled" ? "save.conflict" : "save.unavailable"), tone: "error" };
  }
  function enterView(destination: EntryView) { view.value = destination; focus.enter(destination, guard(destination)); }
  function openEditor() { closeAuthoring(); enterView("editor"); }
  async function createOnce(document: InstructionDocument): Promise<GuideActionResult | undefined> {
    if (guideCreationBusy.peek() || guideActionBusy.peek()) return;
    guideCreationBusy.value = true;
    try { const result = await controller().createGuide(document); reportResult(result); if (result.ok) openEditor(); return result; }
    finally { guideCreationBusy.value = false; }
  }
  async function confirmImport() {
    const imported = pendingImport.peek(); if (!imported) return;
    const result = await createOnce(imported.document);
    if (result) pendingImport.value = null;
    return result;
  }
  function closeImport() { if (!guideCreationBusy.peek()) pendingImport.value = null; }
  async function runGuideAction(operation: (controller: GuideController) => Promise<GuideActionResult>, open = false): Promise<GuideActionResult | undefined> {
    if (guideActionBusy.peek() || guideCreationBusy.peek()) return;
    guideActionBusy.value = true;
    try { const result = await operation(controller()); reportResult(result); if (result.ok && open) openEditor(); return result; }
    finally { guideActionBusy.value = false; }
  }
  async function retryStorage() {
    if (storageRetryBusy.peek() || preferenceRetryBusy.peek()) return;
    storageRetryBusy.value = true;
    try { const result = await controller().retryGuideStorage(); reportResult(result); if (result.ok) toast.value = null; return result; }
    finally { storageRetryBusy.value = false; }
  }
  async function retryPreferenceStorage() {
    if (storageRetryBusy.peek() || preferenceRetryBusy.peek()) return;
    preferenceRetryBusy.value = true;
    try { await options.retryPreferences(); }
    finally { preferenceRetryBusy.value = false; }
  }
  async function openGuides() {
    const result = await controller().flushActiveGuide(); if (!result.ok) { reportResult(result); return result; }
    closeAuthoring(); await controller().refreshGuides(); enterView("guides"); return result;
  }
  function openReader() { readerOpener = focus.captureOpener(); closeAuthoring(); enterView("reader"); }
  function returnToEditor() {
    view.value = "editor";
    focus.returnToEditor({ pictureId: session.selectedTokenId.peek(), groupId: session.selectedStepId.peek(), opener: readerOpener }, guard("editor"));
  }
  function openOutput() { outputOpener = focus.captureOpener(); output.value = { guideId: controller().activeGuideId.peek(), locale: preferences.peek().uiLocale }; }
  function closeOutput() { const opener = outputOpener; output.value = null; focus.restore(opener, guard(view.peek())); }
  async function backup(document: InstructionDocument) {
    const result = await options.backup(document);
    if (!result.ok) toast.value = { text: t(preferences.peek().uiLocale, "output.failed"), tone: "error" };
    return result;
  }
  return { guideCreationBusy, guideActionBusy, storageRetryBusy, preferenceRetryBusy, output, reportResult, createOnce, confirmImport,
    closeImport, runGuideAction, retryStorage, retryPreferenceStorage, openGuides, openEditor, openReader, returnToEditor, openOutput, closeOutput, backup,
    dispose: () => { disposed = true; stopOutput(); } };
}
export type AppShell = ReturnType<typeof createAppShell>;
