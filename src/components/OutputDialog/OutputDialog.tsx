import type { InstructionDocument } from "../../model/instruction";
import type { AppLocale } from "../../model/library";
import type { OutputOptions, OutputPreset } from "../../model/output";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { t } from "../../i18n/messages";
import { createDefaultLabelSheet, normalizeOutputOptions, switchOutputPreset } from "../../lib/output-options";
import { getGroupLabel } from "../../lib/instruction-presentation";
import { issueText, noticeText } from "../../lib/output-presentation";
import { runJsonExport } from "../../lib/document-actions";
import { createOutputRequestController } from "./output-request";
import { OutputPreview } from "../OutputPreview/OutputPreview";
import { preparedPrintFonts } from "../../state/print-fonts";
import "./output-dialog.css";

export interface OutputDialogProps { sourceDocument: InstructionDocument; guideId: string | null; locale: AppLocale; onClose: () => void; initialOptions?: OutputOptions; onOptionsChange?: (options: OutputOptions, capturedDocument: InstructionDocument) => void }

export function OutputDialog({ sourceDocument, guideId, locale, onClose, initialOptions, onOptionsChange }: OutputDialogProps) {
  const [controller] = useState(() => createOutputRequestController(sourceDocument, guideId, locale, {}, initialOptions));
  const dialog = useRef<HTMLDialogElement>(null);
  const [dpi, setDpi] = useState<150 | 300>(150), [previewError, setPreviewError] = useState<unknown>(), [backupFailed, setBackupFailed] = useState(false);
  // Observe immutable props before reading readiness, so a render with new
  // source cannot expose old download consent until a later effect.
  controller.observeSource(sourceDocument, guideId);
  const request = controller.state.value, options = request.options;
  const close = () => { controller.dispose(); onClose(); };
  useLayoutEffect(() => {
    dialog.current?.showModal(); void controller.requestOptions(controller.state.peek().options);
    return () => controller.dispose();
  }, [controller]);
  useLayoutEffect(() => { if (request.fonts) preparedPrintFonts.value = request.fonts; }, [request.fonts]);
  if (request.status === "closed") return null;
  const change = (next: OutputOptions) => { setPreviewError(undefined); onOptionsChange?.(next, request.document); void controller.requestOptions(next); };
  const update = (patch: Partial<OutputOptions>) => change({ ...options, ...patch });
  const numberField = (key: "output.width" | "output.height" | "output.sheetMargin" | "output.sheetGap" | "output.columns" | "output.rows", value: number, commit: (value: number) => void, min: number, max?: number, step = "any") => <label key={`${options.preset}-${key}`}>{t(locale, key)}<input type="number" min={min} max={max} step={step} defaultValue={Number.isFinite(value) ? value : ""} onInput={event => commit(event.currentTarget.valueAsNumber)} /></label>;
  const metadata = (key: keyof OutputOptions["metadata"], label: "output.documentTitle" | "output.groupTitles" | "output.stepNumbers" | "output.includeTotalTime") => <label class="output-dialog__check"><input type="checkbox" checked={options.metadata[key]} onChange={event => update({ metadata: { ...options.metadata, [key]: event.currentTarget.checked } })} />{t(locale, label)}</label>;
  const board = request.document.meta.presentation === "board", ready = request.status === "ready" && !previewError;
  const geometry = normalizeOutputOptions(request.document, options);
  const backup = async () => { const result = await runJsonExport(controller.backupDocument()); setBackupFailed(!!result.error); };
  return <dialog ref={dialog} class="output-dialog" aria-labelledby="output-dialog-heading" data-output-status={request.status} onCancel={event => { event.preventDefault(); close(); }}>
    <header class="output-dialog__header"><h2 id="output-dialog-heading">{t(locale, "output.title")}</h2><button type="button" onClick={close}>{t(locale, "dialog.close")}</button></header>
    <div class="output-dialog__body">
      <div class="output-dialog__settings">
        <label>{t(locale, "output.format")}<select aria-label={t(locale, "output.format")} value={options.preset} onChange={event => change(switchOutputPreset(request.document, options, event.currentTarget.value as OutputPreset))}>{(["label", "card", "sheet", "large", "custom"] as const).map(preset => <option value={preset}>{t(locale, `output.${preset}`)}</option>)}</select></label>
        <label>{t(locale, "output.orientation")}<select aria-label={t(locale, "output.orientation")} value={options.orientation} onChange={event => update({ orientation: event.currentTarget.value as OutputOptions["orientation"] })}>{(["portrait", "landscape"] as const).map(value => <option value={value}>{t(locale, `output.${value}`)}</option>)}</select></label>
        {options.preset === "custom" && options.customSize && <fieldset><legend>{t(locale, "output.custom")}</legend><div class="output-dialog__fields">
          {numberField("output.width", options.customSize.widthMm, widthMm => update({ customSize: { ...options.customSize!, widthMm } }), 20, 1000)}
          {numberField("output.height", options.customSize.heightMm, heightMm => update({ customSize: { ...options.customSize!, heightMm } }), 20, 1000)}
        </div></fieldset>}
        <label>{t(locale, "output.mode")}<select aria-label={t(locale, "output.mode")} value={options.mode} onChange={event => update({ mode: event.currentTarget.value as OutputOptions["mode"] })}>{(["labels", "pictures", "detailed"] as const).map(value => <option value={value}>{t(locale, `output.${value}`)}</option>)}</select></label>
        <p>{t(locale, "output.omittedText")}</p>
        <label>{t(locale, "output.background")}<select aria-label={t(locale, "output.background")} value={options.background} onChange={event => update({ background: event.currentTarget.value as OutputOptions["background"] })}>{(["white", "transparent"] as const).map(value => <option value={value}>{t(locale, `output.${value}`)}</option>)}</select></label>
        {options.background === "transparent" && <p>{t(locale, "output.pdfPaper")}</p>}
        <fieldset><legend>{t(locale, "output.metadata")}</legend>{metadata("documentTitle", "output.documentTitle")}{metadata("groupTitles", "output.groupTitles")}{!board && <>{metadata("stepNumbers", "output.stepNumbers")}{metadata("totalTime", "output.includeTotalTime")}</>}</fieldset>
        <fieldset><legend>{t(locale, "output.selectGroups")}</legend>{request.document.steps.map((group, index) => <label class="output-dialog__check" key={group.id}><input type="checkbox" checked={options.selectedStepIds.includes(group.id)} onChange={event => update({ selectedStepIds: event.currentTarget.checked ? [...options.selectedStepIds, group.id] : options.selectedStepIds.filter(id => id !== group.id) })} />{getGroupLabel(group.title, locale, { kind: "reader", presentation: request.document.meta.presentation, number: index + 1 })}</label>)}</fieldset>
        {options.preset === "label" && <>
          <label class="output-dialog__check"><input type="checkbox" checked={!!options.labelSheet} onChange={event => update({ labelSheet: event.currentTarget.checked ? createDefaultLabelSheet() : undefined })} />{t(locale, "output.labelSheet")}</label>
          {options.labelSheet && <fieldset><legend>{t(locale, "output.sheetSettings")}</legend><div class="output-dialog__fields">
            {numberField("output.width", options.labelSheet.pageSize.widthMm, widthMm => update({ labelSheet: { ...options.labelSheet!, pageSize: { ...options.labelSheet!.pageSize, widthMm } } }), 20, 1000)}
            {numberField("output.height", options.labelSheet.pageSize.heightMm, heightMm => update({ labelSheet: { ...options.labelSheet!, pageSize: { ...options.labelSheet!.pageSize, heightMm } } }), 20, 1000)}
            {numberField("output.sheetMargin", options.labelSheet.marginMm, marginMm => update({ labelSheet: { ...options.labelSheet!, marginMm } }), 0)}
            {numberField("output.sheetGap", options.labelSheet.gapMm, gapMm => update({ labelSheet: { ...options.labelSheet!, gapMm } }), 0)}
            {numberField("output.columns", options.labelSheet.columns, columns => update({ labelSheet: { ...options.labelSheet!, columns } }), 1, undefined, "1")}
            {numberField("output.rows", options.labelSheet.rows, rows => update({ labelSheet: { ...options.labelSheet!, rows } }), 1, undefined, "1")}
          </div>{geometry.ok && <><p>{t(locale, "output.cellSize", { width: geometry.regions[0].widthMm, height: geometry.regions[0].heightMm })}</p><p>{t(locale, "output.sheetUsage", { used: options.selectedStepIds.length, capacity: geometry.regions.length, pages: request.plan?.pages.length ?? Math.ceil(options.selectedStepIds.length / geometry.regions.length) })}</p></>}</fieldset>}
        </>}
        <button type="button" onClick={() => void backup()}>{t(locale, "toolbar.backup")}</button>
        {backupFailed && <p role="alert">{t(locale, "output.failed")}</p>}
      </div>
      <div class="output-dialog__result">
        <div role="status" aria-live="polite">{request.status === "preparing" ? t(locale, "output.preparing") : request.status === "exporting" ? t(locale, "output.exporting", { format: request.exportFormat ?? "PDF" }) : ready && request.plan ? t(locale, "output.ready", { pages: request.plan.pages.length }) : ""}</div>
        {request.status === "stale" && <><p role="alert">{t(locale, "output.sourceChanged")}</p><button type="button" onClick={() => { setPreviewError(undefined); const refreshed = controller.refreshSource(); onOptionsChange?.(controller.state.peek().options, controller.state.peek().document); void refreshed; }}>{t(locale, "output.refresh")}</button></>}
        {request.issues.map((issue, index) => <p role="alert" key={index}>{issueText(issue, locale)}</p>)}
        {request.exportIssue && <p role="alert">{issueText(request.exportIssue, locale)}</p>}
        {(request.errorKey || previewError) && <p role="alert">{t(locale, request.errorKey ?? "output.failed")}</p>}
        {(request.status === "blocked" || request.errorKey || previewError) && <button type="button" onClick={() => { setPreviewError(undefined); void controller.retryPreparation(); }}>{t(locale, "output.retry")}</button>}
        {!!request.plan?.notices.length && <section aria-label={t(locale, "output.notices")}><h3>{t(locale, "output.notices")}</h3>{request.plan.notices.map((notice, index) => <p key={index}>{noticeText(notice, locale)}</p>)}</section>}
        {request.plan && request.fonts && request.readingGroups && <OutputPreview plan={request.plan} fonts={request.fonts} readingGroups={request.readingGroups} onError={setPreviewError} />}
        <div class="output-dialog__downloads"><button type="button" disabled={!ready} onClick={() => void controller.download("pdf")}>{t(locale, "output.downloadPdf")}</button>
          <label>{t(locale, "output.dpi")}<select aria-label={t(locale, "output.dpi")} value={dpi} onChange={event => { setDpi(Number(event.currentTarget.value) as 150 | 300); change(options); }}><option value="150">150</option><option value="300">300</option></select></label>
          {request.plan?.pages.map((_page, index) => <div class="output-dialog__page-actions" key={index}><button type="button" disabled={!ready} onClick={() => void controller.download("svg", index)}>{t(locale, "output.downloadSvgPage", { number: index + 1, total: request.plan!.pages.length })}</button><button type="button" disabled={!ready} onClick={() => void controller.download("png", index, dpi)}>{t(locale, "output.downloadPngPage", { number: index + 1, total: request.plan!.pages.length, dpi })}</button></div>)}
        </div>
        {request.downloadedFilename && <p role="status">{t(locale, "output.downloadRequested", { filename: request.downloadedFilename })}</p>}
      </div>
    </div>
  </dialog>;
}
