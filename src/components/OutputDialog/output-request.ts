import { signal, type Signal } from "@preact/signals";
import type { InstructionDocument } from "../../model/instruction";
import type { AppLocale } from "../../model/library";
import type { OutputIssue, OutputOptions, OutputPlan, PreparedFonts } from "../../model/output";
import type { ReadingGroup } from "../../lib/instruction-reading";
import { toReadingGroups } from "../../lib/instruction-reading";
import { prepareFonts } from "../../lib/print-fonts";
import { createDefaultOutputOptions } from "../../lib/output-options";
import { planOutput } from "../../lib/output-plan";
import { createSvgFile, createPngFile, createPdfFile, OutputExportError } from "../../lib/output-export";
import { downloadBlob, slugify } from "../../lib/download";

export interface OutputRequestDependencies {
  prepareFonts(): Promise<PreparedFonts>;
  createSvgFile(plan: OutputPlan, index: number): Promise<Blob>;
  createPngFile(plan: OutputPlan, index: number, dpi: 150 | 300): Promise<Blob>;
  createPdfFile(plan: OutputPlan): Promise<Blob>;
  downloadBlob(blob: Blob, filename: string): void;
}
export interface OutputRequestState {
  status: "idle" | "preparing" | "ready" | "blocked" | "stale" | "exporting" | "closed";
  document: InstructionDocument; options: OutputOptions; issues: readonly OutputIssue[];
  plan?: OutputPlan; fonts?: PreparedFonts; readingGroups?: readonly ReadingGroup[];
  exportIssue?: OutputIssue; errorKey?: "output.failed" | "output.canvasUnavailable";
  diagnostic?: unknown; downloadedFilename?: string; exportFormat?: "SVG" | "PNG" | "PDF";
}
export interface OutputRequestController {
  state: Signal<OutputRequestState>;
  requestOptions(options: OutputOptions): Promise<void>;
  observeSource(document: InstructionDocument, guideId: string | null): void;
  refreshSource(): Promise<void>;
  retryPreparation(): Promise<void>;
  download(format: "svg" | "png" | "pdf", pageIndex?: number, dpi?: 150 | 300): Promise<void>;
  backupDocument(): InstructionDocument;
  dispose(): void;
}
export function createOutputRequestController(source: InstructionDocument, guideId: string | null, locale: AppLocale, dependencies: Partial<OutputRequestDependencies> = {}, initialOptions?: OutputOptions): OutputRequestController {
  const services: OutputRequestDependencies = { prepareFonts, createSvgFile, createPngFile, createPdfFile, downloadBlob, ...dependencies };
  let latest = source, consented = source, captured = structuredClone(source), generation = 0, closed = false;
  const state = signal<OutputRequestState>({ status: "idle", document: captured, options: initialOptions ? { ...structuredClone(initialOptions), locale } : createDefaultOutputOptions(captured, locale), issues: [] });
  const current = (request: number) => !closed && latest === consented && request === generation;
  const base = (status: OutputRequestState["status"], options = state.peek().options): OutputRequestState => ({ status, document: captured, options, issues: [] });

  async function requestOptions(input: OutputOptions): Promise<void> {
    if (closed) return;
    const options = { ...structuredClone(input), locale }, request = ++generation;
    if (latest !== consented) { state.value = base("stale", options); return; }
    const document = captured;
    state.value = base("preparing", options);
    let prepared: PreparedFonts;
    try { prepared = await services.prepareFonts(); }
    catch (error) {
      if (current(request)) state.value = { ...base("blocked", options), issues: [{ code: "font-unavailable", messageKey: "output.fontUnavailable" }], diagnostic: error };
      return;
    }
    if (!current(request)) return;
    try {
      const result = planOutput(document, options, prepared);
      if (!result.ok) { state.value = { ...base("blocked", options), issues: result.issues }; return; }
      const selected = new Set(result.plan.options.selectedStepIds);
      state.value = { ...base("ready", result.plan.options), plan: result.plan, fonts: prepared,
        readingGroups: toReadingGroups(document, result.plan.options.mode, locale).filter(group => selected.has(group.stepId)) };
    } catch (error) {
      if (current(request)) state.value = { ...base("blocked", options), errorKey: "output.failed", diagnostic: error };
    }
  }
  function dispose(): void { closed = true; generation++; state.value = base("closed"); }
  function observeSource(document: InstructionDocument, id: string | null): void {
    if (closed) return;
    if (id !== guideId) { dispose(); return; }
    if (latest === document) return;
    latest = document; generation++; state.value = base("stale");
  }
  async function refreshSource(): Promise<void> {
    if (closed) return;
    const options = state.peek().options;
    const allSelected = captured.steps.every(group => options.selectedStepIds.includes(group.id)) && options.selectedStepIds.length === captured.steps.length;
    captured = structuredClone(latest); consented = latest;
    const selectedStepIds = allSelected ? captured.steps.map(group => group.id) : options.selectedStepIds.filter(id => captured.steps.some(group => group.id === id));
    await requestOptions({ ...options, selectedStepIds });
  }
  async function download(format: "svg" | "png" | "pdf", pageIndex = 0, dpi: 150 | 300 = 150): Promise<void> {
    const ready = state.peek();
    if (closed || latest !== consented || ready.status !== "ready" || !ready.plan) return;
    const request = ++generation, plan = structuredClone(ready.plan);
    const suffix = (number: number) => String(number).padStart(Math.max(2, String(plan.pages.length).length), "0");
    const filename = format === "pdf" ? `${slugify(plan.documentTitle)}.pdf` : `${slugify(plan.documentTitle)}-page-${suffix(pageIndex + 1)}-of-${suffix(plan.pages.length)}.${format}`;
    state.value = { ...ready, status: "exporting", downloadedFilename: undefined, exportIssue: undefined, errorKey: undefined, diagnostic: undefined, exportFormat: format.toUpperCase() as "SVG" | "PNG" | "PDF" };
    try {
      const blob = format === "svg" ? await services.createSvgFile(plan, pageIndex) : format === "png" ? await services.createPngFile(plan, pageIndex, dpi) : await services.createPdfFile(plan);
      if (!current(request)) return;
      if (!(blob instanceof Blob) || blob.size === 0) throw new Error("File creation returned no artifact");
      services.downloadBlob(blob, filename);
      state.value = { ...ready, status: "ready", downloadedFilename: filename, exportIssue: undefined, errorKey: undefined, diagnostic: undefined };
    } catch (error) {
      if (!current(request)) return;
      state.value = { ...ready, status: "ready", downloadedFilename: undefined,
        exportIssue: error instanceof OutputExportError ? error.issue : undefined,
        errorKey: error instanceof OutputExportError ? error.messageKey : "output.failed", diagnostic: error };
    }
  }
  return { state, requestOptions, observeSource, refreshSource, retryPreparation: () => requestOptions(state.peek().options), download,
    backupDocument: () => structuredClone(latest), dispose };
}
