import type { InstructionDocument } from "../model/instruction";
import type { ContentRole, EditorGroupPlacement, EditorLayout, EditorPageLayout, EditorPicturePlacement, MmBox, OutputContentGroup, OutputContentPicture, OutputFragment, OutputIssue, OutputNotice, OutputOptions, OutputPage, OutputPlanResult, OutputSource, PreparedFonts } from "../model/output";
import { t } from "../i18n/messages";
import { formatDuration } from "./duration";
import { getDurationDisplayLabel, getQuantityDisplayLabel } from "./attachment-labels";
import { getCatalogEntry, getWarningMeaning, resolveIcon } from "./library-catalog";
import { projectOutputContent } from "./output-content";
import { normalizeOutputOptions, type NormalizedOutputOptions } from "./output-options";
import { wrapPrintText } from "./text-layout";
import { rowConnectorPoints } from "./output-connectors";

interface Block { fragments: OutputFragment[]; height: number }
interface MutablePage extends EditorPageLayout { groups: EditorGroupPlacement[] }
const EPSILON = 1e-7;
const GAP = 2;
const FORMAT_KEYS = { label: "output.formatLabel", card: "output.formatCard", sheet: "output.formatSheet", large: "output.formatLarge", custom: "output.formatCustom" } as const;

function translated(box: MmBox, x: number, y: number): MmBox {
  return { ...box, xMm: box.xMm + x, yMm: box.yMm + y };
}

/** Pure geometry is finished before text is measured, so failures stay repairable. */
function editingGeometry(groups: readonly OutputContentGroup[], geometry: NormalizedOutputOptions) {
  const { cell, pageSize, regions, compact } = geometry;
  const pages: MutablePage[] = [];
  const documentHeaders: { pageIndex: number; box: MmBox }[] = [];
  const unfit = new Set<string>();
  const newPage = () => {
    const page: MutablePage = { pageIndex: pages.length, size: { ...pageSize }, groups: [] };
    pages.push(page); return page;
  };
  function area(region: MmBox, documentHeader: boolean) {
    const margin = Math.min(geometry.marginMm, region.widthMm / 4, region.heightMm / 4);
    const width = region.widthMm - 2 * margin, height = region.heightMm - 2 * margin;
    const documentHeight = documentHeader ? geometry.documentHeaderMm : 0;
    const required = documentHeight + (documentHeight ? geometry.headingGapMm : 0) + geometry.groupHeaderMm + (geometry.groupHeaderMm ? geometry.headingGapMm : 0) + cell.heightMm;
    const fits = width + EPSILON >= cell.widthMm && height + EPSILON >= required;
    // A blocked draft still has bounded targets on physically tiny custom paper.
    // These boxes are never passed to the print renderer or an export function.
    const documentMm = fits ? documentHeight : Math.min(documentHeight, height / 4);
    const headerMm = fits ? geometry.groupHeaderMm : Math.min(geometry.groupHeaderMm, height / 4);
    const gap = fits ? geometry.headingGapMm : Math.min(geometry.headingGapMm, height / 10);
    const documentBand = documentMm + (documentMm ? gap : 0);
    const headerBand = headerMm + (headerMm ? gap : 0);
    return {
      fits, left: region.xMm + margin, top: region.yMm + margin, width,
      bottom: region.yMm + region.heightMm - margin,
      documentMm, documentBand, headerMm, headerBand,
      cellWidth: fits ? cell.widthMm : Math.min(cell.widthMm, width),
      cellHeight: fits ? cell.heightMm : Math.min(cell.heightMm, height - documentBand - headerBand),
    };
  }
  function addSegment(page: MutablePage, group: OutputContentGroup, start: number, count: number, segment: number, top: number, surface: ReturnType<typeof area>, columns: number) {
    const bodyTop = top + surface.headerBand;
    const rowCount = Math.max(1, Math.ceil(count / columns));
    const height = surface.headerBand + rowCount * surface.cellHeight + (rowCount - 1) * cell.rowGapMm;
    const pictures: EditorPicturePlacement[] = [];
    for (let offset = 0; offset < count; offset += 1) {
      const index = start + offset, column = offset % columns, localRow = Math.floor(offset / columns);
      const cellBox = { xMm: surface.left + column * (surface.cellWidth + cell.columnGapMm), yMm: bodyTop + localRow * (surface.cellHeight + cell.rowGapMm), widthMm: surface.cellWidth, heightMm: surface.cellHeight };
      const symbolSize = Math.min(cell.pictureBox.widthMm, cellBox.widthMm, cellBox.heightMm);
      const pictureBox = {
        xMm: cellBox.xMm + (cellBox.widthMm - symbolSize) / 2, yMm: cellBox.yMm + (cellBox.heightMm - symbolSize) / 2,
        widthMm: symbolSize, heightMm: symbolSize,
      };
      pictures.push({ stepId: group.stepId, tokenId: group.pictures[index].tokenId, index, row: Math.floor(index / columns), column, cellBox, pictureBox });
    }
    const placement: EditorGroupPlacement = {
      stepId: group.stepId, segment, continued: segment > 0,
      groupBox: { xMm: surface.left, yMm: top, widthMm: surface.width, heightMm: height },
      ...(surface.headerMm ? { headingBox: { xMm: surface.left, yMm: top, widthMm: surface.width, heightMm: surface.headerMm } } : {}),
      ...(!group.pictures.length ? { emptyDropBox: { xMm: surface.left, yMm: bodyTop, widthMm: surface.width, heightMm: surface.cellHeight } } : {}),
      pictures,
    };
    page.groups.push(placement);
    return top + height;
  }

  if (compact) {
    let regionOrdinal = 0;
    for (const group of groups) {
      let start = 0, segment = 0;
      do {
        if (regionOrdinal % regions.length === 0) newPage();
        const page = pages[pages.length - 1], surface = area(regions[regionOrdinal % regions.length], true);
        if (!surface.fits) unfit.add(group.stepId);
        const columns = Math.max(1, Math.floor((surface.width + cell.columnGapMm) / (surface.cellWidth + cell.columnGapMm)));
        const rows = Math.max(1, Math.floor((surface.bottom - surface.top - surface.documentBand - surface.headerBand + cell.rowGapMm + EPSILON) / (surface.cellHeight + cell.rowGapMm)));
        const count = Math.min(group.pictures.length - start, columns * rows);
        if (surface.documentMm || geometry.options.metadata.documentTitle || geometry.options.metadata.totalTime) documentHeaders.push({ pageIndex: page.pageIndex, box: { xMm: surface.left, yMm: surface.top, widthMm: surface.width, heightMm: surface.documentMm } });
        addSegment(page, group, start, count, segment, surface.top + surface.documentBand, surface, columns);
        start += count; segment += 1; regionOrdinal += 1;
        if (start < group.pictures.length) unfit.add(group.stepId);
      } while (start < group.pictures.length);
    }
  } else {
    let page = newPage(), surface = area(regions[0], true), y = surface.top + surface.documentBand;
    if (surface.documentMm) documentHeaders.push({ pageIndex: page.pageIndex, box: { xMm: surface.left, yMm: surface.top, widthMm: surface.width, heightMm: surface.documentMm } });
    const fresh = () => { page = newPage(); surface = area(regions[0], false); y = surface.top; };
    for (const group of groups) {
      let start = 0, segment = 0;
      const columns = Math.max(1, Math.floor((surface.width + cell.columnGapMm) / (surface.cellWidth + cell.columnGapMm)));
      const rowsNeeded = Math.max(1, Math.ceil(group.pictures.length / columns));
      const totalHeight = surface.headerBand + rowsNeeded * surface.cellHeight + (rowsNeeded - 1) * cell.rowGapMm;
      const wholePage = area(regions[0], false);
      if (totalHeight <= wholePage.bottom - wholePage.top + EPSILON && totalHeight > surface.bottom - y + EPSILON && page.groups.length) fresh();
      do {
        if (!surface.fits) unfit.add(group.stepId);
        if (surface.headerBand + surface.cellHeight > surface.bottom - y + EPSILON && page.groups.length) fresh();
        const capacity = Math.max(1, Math.floor((surface.bottom - y - surface.headerBand + cell.rowGapMm + EPSILON) / (surface.cellHeight + cell.rowGapMm)));
        const count = Math.min(group.pictures.length - start, columns * capacity);
        y = addSegment(page, group, start, count, segment, y, surface, columns) + geometry.groupGapMm;
        start += count; segment += 1;
        if (start < group.pictures.length) fresh();
      } while (start < group.pictures.length);
    }
  }
  if (!pages.length) newPage();
  return { layout: { cell: structuredClone(cell), pages } satisfies EditorLayout, documentHeaders, unfit };
}

/** One physical layout drives printed fragments and every editable hit region. */
export function planOutput(doc: InstructionDocument, input: OutputOptions, fonts: PreparedFonts): OutputPlanResult {
  const normalized = normalizeOutputOptions(doc, input);
  const geometry = normalized.ok ? normalized : normalized.geometry;
  if (!geometry) return normalized as Extract<OutputPlanResult, { ok: false }>;
  const { options, cell, pictureMm, labelPt, secondaryPt, warningPt, headingPt } = geometry;
  const selected = new Set(options.selectedStepIds);
  const groups = projectOutputContent(doc, options.mode).filter(group => selected.has(group.stepId));
  const { layout, documentHeaders, unfit } = editingGeometry(groups, geometry);
  if (!normalized.ok) return { ok: false, issues: normalized.issues, editorLayout: layout };
  const issues: OutputIssue[] = [], notices: OutputNotice[] = [];
  const pages: (OutputPage & { fragments: OutputFragment[] })[] = layout.pages.map(page => ({ index: page.pageIndex, size: { ...page.size }, background: options.background, fragments: [] }));
  const groupName = (group: OutputContentGroup) => group.title || t(options.locale, "output.groupContext");
  const format = t(options.locale, FORMAT_KEYS[options.preset]);
  function overflow(source: OutputSource, group: OutputContentGroup, field: string, content: string) {
    issues.push({ code: "overflow", source, messageKey: "output.cellOverflow", params: { group: groupName(group), format, field, content } });
  }
  for (const group of groups) if (unfit.has(group.stepId)) {
    issues.push({ code: "overflow", source: { stepId: group.stepId, ...(group.pictures[0] ? { tokenId: group.pictures[0].tokenId } : {}) }, messageKey: "output.overflow", params: { group: groupName(group), format } });
  }
  function text(value: string, width: number, size: number, source: OutputSource, role: ContentRole, group: OutputContentGroup): Block | null {
    const missing = fonts.unsupportedCodePoints(value);
    if (missing.length) {
      issues.push({ code: "unsupported-glyph", source, messageKey: "output.unsupportedGlyph", params: { content: value, codePoints: missing.map(cp => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`).join(", ") } });
      return null;
    }
    const wrapped = wrapPrintText(value, width, size, fonts);
    if (!wrapped.ok) { overflow(source, group, role, value); return null; }
    const height = fonts.lineHeightMm(size);
    return { height: height * wrapped.lines.length, fragments: wrapped.lines.map((line, index) => ({ kind: "text", source: { ...source }, role, text: line, fontId: fonts.fontId, fontSizePt: size,
      box: { xMm: 0, yMm: index * height, widthMm: width, heightMm: height }, baselineMm: (index + .8) * height })) };
  }
  function move(fragments: readonly OutputFragment[], x: number, y: number): OutputFragment[] {
    return fragments.map(fragment => fragment.kind === "connector" ? { ...fragment, from: { xMm: fragment.from.xMm + x, yMm: fragment.from.yMm + y }, to: { xMm: fragment.to.xMm + x, yMm: fragment.to.yMm + y }, ...(fragment.via ? { via: fragment.via.map(point => ({ xMm: point.xMm + x, yMm: point.yMm + y })) } : {}) } :
      { ...fragment, box: translated(fragment.box, x, y), ...(fragment.kind === "text" ? { baselineMm: fragment.baselineMm + y } : {}) });
  }
  function stack(block: Block, next: Block | null, gap = GAP) {
    if (!next) return;
    const offset = block.height ? block.height + gap : 0;
    block.fragments.push(...move(next.fragments, 0, offset)); block.height = offset + next.height;
  }
  function addText(block: Block, value: string | undefined, lane: MmBox, size: number, source: OutputSource, role: ContentRole, group: OutputContentGroup) {
    if (!value) return;
    stack(block, text(value, lane.widthMm, size, source, role, group));
    if (block.height > lane.heightMm + EPSILON) overflow(source, group, role, value);
  }
  function unit(picture: OutputContentPicture, placement: EditorPicturePlacement, group: OutputContentGroup): OutputFragment[] {
    const source = { stepId: group.stepId, tokenId: picture.tokenId };
    const fragments: OutputFragment[] = [{ kind: "symbol", role: "token", iconId: picture.iconId, source, box: { ...cell.pictureBox } }];
    const caption: Block = { fragments: [], height: 0 }, note: Block = { fragments: [], height: 0 };
    if (!resolveIcon(picture.iconId).known) {
      notices.push({ code: "unknown-symbol", source, messageKey: "output.unknownSymbolNotice" });
      addText(caption, t(options.locale, "catalog.unknownSymbol", { iconId: picture.iconId }), cell.captionBox, labelPt, source, "context", group);
    }
    addText(caption, picture.label, cell.captionBox, labelPt, source, "label", group);
    addText(note, picture.note, cell.noteBox, secondaryPt, source, "note", group);
    const attach = (iconId: string, label: string, role: "quantity" | "warning" | "time", lane: MmBox, centered = false) => {
      if (role !== "warning" && !resolveIcon(iconId).known) notices.push({ code: "unknown-symbol", source, messageKey: "output.unknownSymbolNotice" });
      const symbolSize = Math.min(options.preset === "label" ? 3 : 4, pictureMm), stacked = role === "warning";
      const fontSize = stacked ? warningPt : secondaryPt;
      const labelBlock = text(label, stacked ? lane.widthMm : lane.widthMm - symbolSize - 1, fontSize, source, role, group);
      const paintedWidth = Math.max(0, ...(labelBlock?.fragments ?? []).map(fragment => fragment.kind === "text" ? fonts.measureWidthMm(fragment.text, fragment.fontSizePt) : 0));
      const offset = centered ? (lane.widthMm - symbolSize - 1 - paintedWidth) / 2 : 0;
      const labelFragments = (labelBlock?.fragments ?? []).map(fragment => {
        if (fragment.kind !== "text") return fragment;
        const widthMm = fonts.measureWidthMm(fragment.text, fragment.fontSizePt);
        return { ...fragment, box: { ...fragment.box, xMm: centered ? (paintedWidth - widthMm) / 2 : 0, widthMm } };
      });
      const attachment: OutputFragment[] = [
        { kind: "symbol", source, role, iconId, box: { xMm: stacked ? (lane.widthMm - symbolSize) / 2 : offset, yMm: stacked ? 0 : Math.max(0, (fonts.lineHeightMm(fontSize) - symbolSize) / 2), widthMm: symbolSize, heightMm: symbolSize } },
        ...move(labelFragments, stacked ? 0 : offset + symbolSize + 1, stacked ? symbolSize + .5 : 0),
      ];
      const height = stacked ? symbolSize + .5 + (labelBlock?.height ?? 0) : Math.max(symbolSize, labelBlock?.height ?? 0);
      if (height > lane.heightMm + EPSILON) overflow(source, group, role, label);
      fragments.push(...move(attachment, lane.xMm, lane.yMm));
    };
    if (picture.quantity) attach(picture.quantity.iconId, getQuantityDisplayLabel(picture.quantity), "quantity", cell.quantityBox);
    if (picture.warning) {
      const known = resolveIcon(picture.warning.iconId).known && getCatalogEntry(picture.warning.iconId)?.category === "warning";
      if (!known) notices.push({ code: "unknown-symbol", source, messageKey: "output.unknownSymbolNotice" });
      const meaning = getWarningMeaning(picture.warning, options.locale);
      attach(picture.warning.iconId, known ? meaning : t(options.locale, "output.warningContext", { meaning }), "warning", cell.detailBox);
    }
    if (picture.time) attach(picture.time.iconId, getDurationDisplayLabel(picture.time), "time", cell.timeBox, true);
    const centeredCaption = caption.fragments.map(fragment => {
      if (fragment.kind !== "text") return fragment;
      const widthMm = fonts.measureWidthMm(fragment.text, fragment.fontSizePt);
      return { ...fragment, box: { ...fragment.box, xMm: (cell.captionBox.widthMm - widthMm) / 2, widthMm } };
    });
    fragments.push(...move(centeredCaption, cell.captionBox.xMm, cell.captionBox.yMm + Math.max(0, cell.captionBox.heightMm - caption.height)), ...move(note.fragments, cell.noteBox.xMm, cell.noteBox.yMm));
    return move(fragments, placement.cellBox.xMm, placement.cellBox.yMm);
  }
  function heading(group: OutputContentGroup, placement: EditorGroupPlacement): OutputFragment[] {
    const source = { stepId: group.stepId }, block: Block = { height: 0, fragments: [] };
    const lane = placement.headingBox ?? { xMm: placement.groupBox.xMm, yMm: placement.groupBox.yMm, widthMm: placement.groupBox.widthMm, heightMm: 0 };
    let title = options.metadata.groupTitles ? group.title || "" : "";
    if (options.metadata.stepNumbers) title = t(options.locale, "output.sequenceGroup", { number: doc.steps.findIndex(step => step.id === group.stepId) + 1, title });
    if (placement.continued) title = t(options.locale, "output.continuedGroup", { group: title || groupName(group) });
    addText(block, title, lane, headingPt, source, placement.continued ? "context" : "heading", group);
    if (!placement.continued) {
      addText(block, group.description, lane, secondaryPt, source, "description", group);
      if (group.groupSeconds !== undefined && (lane.heightMm > 0 || group.time)) addText(block, group.time ? getDurationDisplayLabel(group.time) : formatDuration(group.groupSeconds), lane, secondaryPt, source, "time", group);
    }
    return move(block.fragments, lane.xMm, lane.yMm);
  }
  const first = groups[0];
  const seconds = groups.reduce((sum, group) => sum + (group.groupSeconds ?? 0), 0);
  for (const header of documentHeaders) {
    const block: Block = { height: 0, fragments: [] };
    if (options.metadata.documentTitle) addText(block, doc.meta.title, header.box, headingPt, {}, "heading", first);
    if (options.metadata.totalTime && seconds) addText(block, t(options.locale, "output.totalTime", { duration: formatDuration(seconds) }), header.box, secondaryPt, {}, "time", first);
    pages[header.pageIndex].fragments.push(...move(block.fragments, header.box.xMm, header.box.yMm));
  }
  for (const page of layout.pages) for (const placement of page.groups) {
    const group = groups.find(group => group.stepId === placement.stepId)!;
    const fragments = pages[page.pageIndex].fragments;
    fragments.push(...heading(group, placement));
    if (placement.emptyDropBox) {
      const source = { stepId: group.stepId };
      notices.push({ code: "empty-group", source, messageKey: "output.emptyGroup" });
      const block: Block = { height: 0, fragments: [] };
      addText(block, t(options.locale, "output.emptyGroup"), placement.emptyDropBox, secondaryPt, source, "context", group);
      fragments.push(...move(block.fragments, placement.emptyDropBox.xMm, placement.emptyDropBox.yMm));
    }
    for (const picture of placement.pictures) fragments.push(...unit(group.pictures[picture.index], picture, group));
    if (doc.meta.presentation === "sequence") for (let index = 1; index < placement.pictures.length; index += 1) {
      const previous = placement.pictures[index - 1], current = placement.pictures[index];
      const sameRow = previous.row === current.row;
      const route = sameRow ? {
        from: { xMm: previous.cellBox.xMm + previous.cellBox.widthMm + .5, yMm: previous.pictureBox.yMm + previous.pictureBox.heightMm / 2 },
        to: { xMm: current.cellBox.xMm - .5, yMm: current.pictureBox.yMm + current.pictureBox.heightMm / 2 },
      } : rowConnectorPoints(previous.cellBox, current.cellBox);
      fragments.push({ kind: "connector", source: { stepId: group.stepId }, role: "context", ...route });
    }
  }
  if (issues.length) return { ok: false, issues, editorLayout: layout };
  return { ok: true, plan: { documentTitle: doc.meta.title, presentation: doc.meta.presentation, options, pages, notices, editorLayout: layout } };
}
