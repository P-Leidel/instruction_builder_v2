import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { sessionActions, type DocumentSession } from "../../state/document";
import type { AppLocale } from "../../model/library";
import type { OutputPage, OutputPreset, PreparedFonts } from "../../model/output";
import { t } from "../../i18n/messages";
import { EditorGroup, GroupControls } from "./EditorGroup";
import { EditorPicture } from "./EditorPicture";
import { authoring, capturePanelOpener } from "../../state/ui";
import { armedPictureMove, cancelEditorDrag, editorDrag, editorDragAnnouncement } from "../../state/editor-drag";
import { activeGuideId } from "../../state/guides";
import { printSettings } from "../../state/print-settings";
import { preparedPrintFonts } from "../../state/print-fonts";
import { prepareFonts } from "../../lib/print-fonts";
import { planOutput } from "../../lib/output-plan";
import { switchOutputPreset } from "../../lib/output-options";
import { projectEditorControls } from "../../lib/editor-projection";
import { renderOutputPage } from "../../lib/output-svg";
import { issueText } from "../../lib/output-presentation";

function PrintedPage({ page, fonts, onError }: { page: OutputPage; fonts: PreparedFonts; onError: (error: unknown) => void }) {
  const visual = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    try { const svg = renderOutputPage(page, fonts); svg.setAttribute("aria-hidden", "true"); visual.current?.replaceChildren(svg); }
    catch (error) { visual.current?.replaceChildren(); onError(error); }
  }, [page, fonts, onError]);
  return <div ref={visual} class="editor-paper__image" aria-hidden="true" />;
}

function captureProjectionFocus(root: HTMLElement | null) {
  const element = root?.ownerDocument.activeElement;
  if (!root || !element || !root.contains(element)) return null;
  const picture = element.getAttribute("data-editor-picture"), add = element.getAttribute("data-add-picture");
  const group = element.getAttribute("data-group-edit") ?? element.getAttribute("data-group-drag");
  const selector = picture !== null ? `[data-editor-picture="${CSS.escape(picture)}"]` :
    add !== null ? `[data-add-picture="${CSS.escape(add)}"]` :
    group !== null ? `[data-group-edit="${CSS.escape(group)}"], [data-group-drag="${CSS.escape(group)}"]` : null;
  return selector ? { element, selector } : null;
}

export function InstructionEditor({ session, locale }: { session: DocumentSession; locale: AppLocale }) {
  const ref = useRef<HTMLElement>(null);
  const projectionFocus = captureProjectionFocus(ref.current);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !projectionFocus || projectionFocus.element.isConnected) return;
    const document = root.ownerDocument;
    if (document.activeElement !== document.body || document.querySelector("dialog[open]")) return;
    // Font/zoom replanning can replace a focused repair control with its physical counterpart.
    root.querySelector<HTMLElement>(projectionFocus.selector)?.focus({ preventScroll: true });
  });
  const doc = session.document.value, guideId = activeGuideId.value, records = printSettings.records.value;
  const options = useMemo(() => printSettings.getOptions(doc, guideId, locale), [doc, guideId, locale, records]);
  const fonts = preparedPrintFonts.value;
  const [fontFailed, setFontFailed] = useState(false), [fontAttempt, setFontAttempt] = useState(0), [renderError, setRenderError] = useState<unknown>();
  const [zoom, setZoom] = useState(() => window.matchMedia("(max-width: 767px)").matches ? 50 : 100);
  const scale = 96 / 25.4 * zoom / 100;
  useEffect(() => { if (preparedPrintFonts.peek()) return; let current = true; setFontFailed(false); void prepareFonts().then(value => { if (current) preparedPrintFonts.value = value; }, () => { if (current) setFontFailed(true); }); return () => { current = false; }; }, [fontAttempt]);
  useEffect(() => { cancelEditorDrag(); return cancelEditorDrag; }, [doc, guideId, options, zoom]);
  useEffect(() => { const cancel = () => cancelEditorDrag(); window.addEventListener("resize", cancel); return () => window.removeEventListener("resize", cancel); }, []);
  useEffect(() => setRenderError(undefined), [doc, options, fonts]);
  const result = useMemo(() => fonts ? planOutput(doc, options, fonts) : undefined, [doc, options, fonts]);
  const plan = result?.ok && !renderError ? result.plan : undefined;
  const layout = result?.ok ? result.plan.editorLayout : result?.editorLayout;
  const issues = result && !result.ok ? result.issues : [];
  const marked = new Set(issues.map(issue => issue.source?.tokenId).filter((id): id is string => !!id));
  const board = doc.meta.presentation === "board", drag = editorDrag.value, armed = armedPictureMove.value;
  const GroupList = board ? "ul" : "ol";
  const selected = doc.steps.filter(step => options.selectedStepIds.includes(step.id));
  const change = (next: typeof options) => printSettings.setOptions(doc, guideId, next);
  const projection = projectEditorControls(layout, selected.map(step => step.id), scale);
  const auxiliary = selected.filter(step => projection.auxiliaryStepIds.includes(step.id));
  return <section class="instruction-editor" ref={ref} aria-label={t(locale, "toolbar.edit")} data-editor-layout={plan ? "ready" : "blocked"}>
    <div class="editor-document-fields"><label class="guide-title">{t(locale, "editor.documentTitle")}<input value={doc.meta.title} placeholder={t(locale, "guide.untitled")} onInput={event => sessionActions.updateTitle(session, event.currentTarget.value)} /></label>
      <label>{t(locale, "editor.presentation")}<select aria-label={t(locale, "editor.presentation")} value={doc.meta.presentation} onChange={event => sessionActions.setPresentation(session, event.currentTarget.value as "sequence" | "board")}><option value="sequence">{t(locale, "guide.sequence")}</option><option value="board">{t(locale, "guide.board")}</option></select></label></div>
    <div class="editor-canvas-controls"><label>{t(locale, "editor.paperFormat")}<select aria-label={t(locale, "editor.paperFormat")} value={options.preset} onChange={event => change(switchOutputPreset(doc, options, event.currentTarget.value as OutputPreset))}>{(["label", "card", "sheet", "large", "custom"] as const).map(preset => <option value={preset}>{t(locale, `output.${preset}`)}</option>)}</select></label>
      <label>{t(locale, "editor.pageOrientation")}<select aria-label={t(locale, "editor.pageOrientation")} value={options.orientation} onChange={event => change({ ...options, orientation: event.currentTarget.value as "portrait" | "landscape" })}>{(["portrait", "landscape"] as const).map(value => <option value={value}>{t(locale, `output.${value}`)}</option>)}</select></label>
      <label>{t(locale, "editor.canvasZoom")}<select aria-label={t(locale, "editor.canvasZoom")} value={zoom} onChange={event => setZoom(Number(event.currentTarget.value))}>{[50, 75, 100, 125, 150, 200].map(value => <option value={value}>{value}%</option>)}</select></label>
      {options.preset === "custom" && options.customSize && <>{(["widthMm", "heightMm"] as const).map(key => <label>{t(locale, key === "widthMm" ? "output.width" : "output.height")}<input type="number" min="20" max="1000" value={Number.isFinite(options.customSize![key]) ? options.customSize![key] : ""} onInput={event => change({ ...options, customSize: { ...options.customSize!, [key]: event.currentTarget.valueAsNumber } })} /></label>)}</>}
      {selected.length !== doc.steps.length && <button type="button" onClick={() => change({ ...options, selectedStepIds: doc.steps.map(step => step.id) })}>{t(locale, "editor.showAllGroups")}</button>}
    </div>
    <p class="editor-canvas-help">{t(locale, "editor.canvasHelp")}</p>
    {armed && <div class="editor-move-notice" role="status"><p>{t(locale, "editor.moveReady")}</p><button type="button" onClick={cancelEditorDrag}>{t(locale, "editor.cancelMove")}</button></div>}
    {(!result && !fontFailed) && <p role="status">{t(locale, "output.preparing")}</p>}
    {fontFailed && !fonts && <p role="alert">{t(locale, "output.fontUnavailable")} <button type="button" onClick={() => setFontAttempt(value => value + 1)}>{t(locale, "output.retry")}</button></p>}
    {renderError && <p role="alert">{t(locale, "output.failed")}</p>}
    {!!issues.length && <div class="editor-layout-issues" role="alert"><p>{t(locale, "editor.repairCanvas")}</p>{issues.map((issue, index) => <p key={index}>{issueText(issue, locale)}{issue.source?.tokenId && <button type="button" onClick={() => { capturePanelOpener(); authoring.openPicture(issue.source!.stepId!, issue.source!.tokenId!); }}>{t(locale, "editor.pictureDetails", { label: doc.steps.flatMap(step => step.tokens).find(token => token.id === issue.source!.tokenId)?.label ?? "" })}</button>}</p>)}</div>}
    {!!auxiliary.length && <div class="editor-group-tools" aria-label={t(locale, "editor.groupControls")}>{auxiliary.map(step => <GroupControls key={step.id} step={step} index={doc.steps.indexOf(step)} board={board} locale={locale} />)}</div>}
    {layout && <div class="editor-canvas-viewport"><div class="editor-paper-stack">{layout.pages.map(page => <div key={page.pageIndex} class={`editor-paper${plan ? "" : " editor-paper--draft"}`} data-editor-page={page.pageIndex} style={{ width: `${page.size.widthMm * scale}px`, height: `${page.size.heightMm * scale}px` }}>
      {plan && fonts && <PrintedPage page={plan.pages[page.pageIndex]} fonts={fonts} onError={setRenderError} />}
      <GroupList class="editor-groups" data-editor-presentation={doc.meta.presentation}>{page.groups.map(group => { const step = doc.steps.find(step => step.id === group.stepId); return step && <EditorGroup key={`${step.id}-${group.segment}`} step={step} index={doc.steps.indexOf(step)} session={session} locale={locale} placement={group} scale={scale} draft={!plan} marked={marked} headingPrinted={(!board && options.metadata.stepNumbers) || (options.metadata.groupTitles && !!step.title?.trim())} />; })}</GroupList>
    </div>)}</div></div>}
    {projection.needsPictureList && <div class="editor-repair-list">{selected.map(step => <div key={step.id}>{!auxiliary.includes(step) && <GroupControls step={step} index={doc.steps.indexOf(step)} board={board} locale={locale} />}<ul class="editor-repair-pictures">{step.tokens.map(token => <EditorPicture key={token.id} token={token} locale={locale} session={session} groupId={step.id} selected={session.selectedTokenId.value === token.id} scale={scale} draft onActivate={() => { capturePanelOpener(); authoring.openPicture(step.id, token.id); }} />)}</ul></div>)}</div>}
    <button type="button" data-add-group onClick={() => { capturePanelOpener(); sessionActions.addStep(session); const id = session.selectedStepId.peek(); if (id) authoring.openGroup(id); }}>{t(locale, board ? "editor.addGroup" : "editor.addStep")}</button>
    {drag && <div class="editor-drag-ghost" aria-hidden="true" style={{ left: `${Math.min(drag.x + 12, window.innerWidth - 160)}px`, top: `${Math.min(drag.y + 12, window.innerHeight - 50)}px` }}>{drag.label}</div>}
    <span class="visually-hidden" role="status">{editorDragAnnouncement.value}</span>
  </section>;
}
