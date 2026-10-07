import type { InstructionDocument } from "../model/instruction";
import type { AppLocale } from "../model/library";
import type { FixedCellMetrics, MmBox, OutputIssue, OutputOptions, OutputPreset, PageSize } from "../model/output";

const PRESETS = {
  label: { widthMm: 50, heightMm: 30, marginMm: 2 },
  card: { widthMm: 105, heightMm: 148, marginMm: 5 },
  sheet: { widthMm: 210, heightMm: 297, marginMm: 10 },
  large: { widthMm: 297, heightMm: 420, marginMm: 10 },
  custom: { widthMm: 210, heightMm: 297, marginMm: 10 },
} as const;

export function createDefaultLabelSheet(): NonNullable<OutputOptions["labelSheet"]> {
  return { pageSize: { widthMm: 210, heightMm: 297 }, marginMm: 10, gapMm: 2, columns: 3, rows: 8 };
}
export function createDefaultOutputOptions(doc: InstructionDocument, locale: AppLocale, preset: OutputPreset = "sheet"): OutputOptions {
  const compact = preset === "label" || preset === "card", sequence = doc.meta.presentation === "sequence";
  return { preset, locale, orientation: "portrait", mode: "labels", background: "white",
    selectedStepIds: doc.steps.map((step) => step.id),
    ...(preset === "custom" ? { customSize: { widthMm: 210, heightMm: 297 } } : {}),
    metadata: { documentTitle: !compact, groupTitles: preset !== "label", stepNumbers: sequence && preset !== "label", totalTime: !compact && sequence } };
}

export interface NormalizedOutputOptions {
  ok: true; options: OutputOptions; pageSize: PageSize; regions: readonly MmBox[];
  marginMm: number; compact: boolean; pictureMm: number; labelPt: number; secondaryPt: number; warningPt: number; headingPt: number;
  cell: FixedCellMetrics; documentHeaderMm: number; groupHeaderMm: number; headingGapMm: number; groupGapMm: number;
}
type Normalization = NormalizedOutputOptions | { ok: false; issues: readonly OutputIssue[]; geometry?: NormalizedOutputOptions };
function invalid(code: "invalid-options" | "empty-selection" = "invalid-options"): Normalization {
  return { ok: false, issues: [{ code, messageKey: code === "empty-selection" ? "output.emptySelection" : "output.invalidOptions" }] };
}
function finiteSize(size: PageSize | undefined): size is PageSize {
  return !!size && Number.isFinite(size.widthMm) && Number.isFinite(size.heightMm) && size.widthMm >= 20 && size.widthMm <= 1000 && size.heightMm >= 20 && size.heightMm <= 1000;
}

/** Package-private geometry normalization; UI consumes only canonical option defaults. */
export function normalizeOutputOptions(doc: InstructionDocument, input: OutputOptions): Normalization {
  if (!input || !Object.hasOwn(PRESETS, input.preset) || !["en", "de"].includes(input.locale) ||
      !["portrait", "landscape"].includes(input.orientation) || !["labels", "pictures", "detailed"].includes(input.mode) ||
      !["white", "transparent"].includes(input.background) || !input.metadata ||
      ["documentTitle", "groupTitles", "stepNumbers", "totalTime"].some((key) => typeof input.metadata[key as keyof OutputOptions["metadata"]] !== "boolean") ||
      !Array.isArray(input.selectedStepIds)) return invalid();
  const selected = new Set(input.selectedStepIds);
  if (selected.size !== input.selectedStepIds.length || input.selectedStepIds.some((id) => !doc.steps.some((step) => step.id === id))) return invalid();
  const preset = PRESETS[input.preset];
  const base = input.preset === "custom" ? input.customSize : preset;
  if (!finiteSize(base)) return invalid();
  const regionSize = input.orientation === "landscape" ? { widthMm: base.heightMm, heightMm: base.widthMm } : { widthMm: base.widthMm, heightMm: base.heightMm };
  let pageSize = regionSize;
  let regions: MmBox[] = [{ xMm: 0, yMm: 0, ...regionSize }];
  if (input.labelSheet !== undefined) {
    if (input.preset !== "label") return invalid();
    const sheet = input.labelSheet;
    if (!sheet || !finiteSize(sheet.pageSize) || !Number.isInteger(sheet.rows) || sheet.rows < 1 || !Number.isInteger(sheet.columns) || sheet.columns < 1 ||
        !Number.isFinite(sheet.marginMm) || sheet.marginMm < 0 || !Number.isFinite(sheet.gapMm) || sheet.gapMm < 0 ||
        sheet.columns * regionSize.widthMm + (sheet.columns - 1) * sheet.gapMm + 2 * sheet.marginMm > sheet.pageSize.widthMm ||
        sheet.rows * regionSize.heightMm + (sheet.rows - 1) * sheet.gapMm + 2 * sheet.marginMm > sheet.pageSize.heightMm) return invalid();
    pageSize = { ...sheet.pageSize };
    regions = Array.from({ length: sheet.columns * sheet.rows }, (_, index) => ({
      xMm: sheet.marginMm + index % sheet.columns * (regionSize.widthMm + sheet.gapMm),
      yMm: sheet.marginMm + Math.floor(index / sheet.columns) * (regionSize.heightMm + sheet.gapMm), ...regionSize }));
  }
  const options: OutputOptions = { ...input, metadata: { ...input.metadata }, selectedStepIds: doc.steps.filter((step) => selected.has(step.id)).map((step) => step.id),
    ...(input.customSize ? { customSize: { ...input.customSize } } : {}),
    ...(input.labelSheet ? { labelSheet: { ...input.labelSheet, pageSize: { ...input.labelSheet.pageSize } } } : {}) };
  if (doc.meta.presentation === "board") { options.metadata.stepNumbers = false; options.metadata.totalTime = false; }
  const large = input.preset === "large", label = input.preset === "label";
  const landscapeLabel = label && input.orientation === "landscape";
  const widthMm = large ? 64 : label ? landscapeLabel ? 26 : 46 : 44;
  const heightMm = large ? 52 : label ? landscapeLabel ? 46 : 25 : 40;
  const pictureMm = large ? 25 : label ? 10 : 15;
  const pictureX = (widthMm - pictureMm) / 2, pictureY = (heightMm - pictureMm) / 2;
  const sideWidth = pictureX - 1;
  // The pictogram is the immutable center anchor. All surrounding lanes are
  // reserved even when empty; measured text can fail preflight but never move
  // the anchor, change these boxes or increase the fixed cell/row dimensions.
  const lanes = landscapeLabel ? {
    captionBox: { xMm: 0, yMm: 7, widthMm, heightMm: pictureY - 8 },
    quantityBox: { xMm: 0, yMm: 0, widthMm, heightMm: 6 },
    detailBox: { xMm: 0, yMm: 36, widthMm, heightMm: heightMm - 36 },
    timeBox: { xMm: 0, yMm: pictureY + pictureMm + 1, widthMm, heightMm: 6 },
    noteBox: { xMm: 0, yMm: pictureY, widthMm: sideWidth, heightMm: pictureMm },
  } : {
    captionBox: { xMm: 0, yMm: 0, widthMm, heightMm: pictureY - 1 },
    quantityBox: { xMm: 0, yMm: pictureY, widthMm: sideWidth, heightMm: pictureMm + (label ? 0 : 1) },
    detailBox: { xMm: pictureX + pictureMm + 1, yMm: pictureY - 1, widthMm: sideWidth, heightMm: label ? pictureMm + 1 : heightMm - pictureY + 1 },
    timeBox: { xMm: pictureX - 1, yMm: pictureY + pictureMm + 1, widthMm: pictureMm + 2, heightMm: heightMm - pictureY - pictureMm - 1 },
    noteBox: { xMm: 0, yMm: pictureY + pictureMm + (label ? 1 : 2), widthMm: sideWidth, heightMm: heightMm - pictureY - pictureMm - (label ? 1 : 2) },
  };
  const geometry: NormalizedOutputOptions = { ok: true, options, pageSize, regions, marginMm: preset.marginMm,
    compact: label || input.preset === "card", pictureMm,
    labelPt: large ? 14 : 9, secondaryPt: large ? 12 : 9, warningPt: large ? 10 : 9,
    headingPt: large ? 20 : label ? 10 : 14,
    cell: { widthMm, heightMm, columnGapMm: 4, rowGapMm: 4,
      pictureBox: { xMm: pictureX, yMm: pictureY, widthMm: pictureMm, heightMm: pictureMm }, ...lanes },
    documentHeaderMm: label ? 0 : large ? 32 : input.preset === "card" ? 22 : 24, groupHeaderMm: label ? 0 : large ? 32 : 24,
    headingGapMm: label ? 0 : 4, groupGapMm: 4 };
  if (!options.selectedStepIds.length) return { ok: false, issues: [{ code: "empty-selection", messageKey: "output.emptySelection" }], geometry };
  return geometry;
}
