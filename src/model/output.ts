import type { DurationAttachment, QuantityAttachment, TokenAttachment } from "./instruction";
import type { AppLocale } from "./library";

export type OutputMode = "labels" | "pictures" | "detailed";
export type OutputPreset = "label" | "card" | "sheet" | "large" | "custom";
export interface PageSize { widthMm: number; heightMm: number }
export interface OutputOptions {
  preset: OutputPreset;
  locale: AppLocale;
  orientation: "portrait" | "landscape";
  customSize?: PageSize;
  mode: OutputMode;
  selectedStepIds: readonly string[];
  background: "white" | "transparent";
  metadata: { documentTitle: boolean; groupTitles: boolean; stepNumbers: boolean; totalTime: boolean };
  labelSheet?: { pageSize: PageSize; marginMm: number; gapMm: number; columns: number; rows: number };
}
export interface OutputSource { stepId?: string; tokenId?: string }
export interface MmBox { xMm: number; yMm: number; widthMm: number; heightMm: number }
export interface MmPoint { xMm: number; yMm: number }
/** Content-independent physical lanes, in local cell coordinates. */
export interface FixedCellMetrics {
  widthMm: number;
  heightMm: number;
  columnGapMm: number;
  rowGapMm: number;
  pictureBox: MmBox;
  captionBox: MmBox;
  detailBox: MmBox;
  quantityBox: MmBox;
  timeBox: MmBox;
  noteBox: MmBox;
}
export interface EditorPicturePlacement {
  stepId: string;
  tokenId: string;
  index: number;
  row: number;
  column: number;
  cellBox: MmBox;
  pictureBox: MmBox;
}
export interface EditorGroupPlacement {
  stepId: string;
  segment: number;
  continued: boolean;
  headingBox?: MmBox;
  groupBox: MmBox;
  emptyDropBox?: MmBox;
  pictures: readonly EditorPicturePlacement[];
}
export interface EditorPageLayout {
  pageIndex: number;
  size: PageSize;
  groups: readonly EditorGroupPlacement[];
}
export interface EditorLayout {
  cell: FixedCellMetrics;
  pages: readonly EditorPageLayout[];
}
export type ContentRole = "token" | "warning" | "quantity" | "time"
  | "label" | "note" | "description" | "heading" | "context";
export type OutputFragment =
  | { kind: "symbol"; source: OutputSource; role: ContentRole; box: MmBox; iconId: string }
  | { kind: "text"; source: OutputSource; role: ContentRole; box: MmBox; text: string;
      fontId: string; fontSizePt: number; baselineMm: number }
  | { kind: "connector"; source: OutputSource; role: "context";
      from: MmPoint; to: MmPoint; via?: readonly MmPoint[] };
export interface OutputPage {
  index: number;
  size: PageSize;
  background: "white" | "transparent";
  fragments: readonly OutputFragment[];
}
export interface OutputIssue {
  code: "invalid-options" | "empty-selection" | "overflow" | "unsupported-glyph" | "font-unavailable" | "raster-limit";
  source?: OutputSource;
  messageKey: string;
  params?: Record<string, string | number>;
}
export interface OutputNotice {
  code: "unknown-symbol" | "empty-group";
  source: OutputSource;
  messageKey: string;
}
export interface OutputPlan {
  documentTitle: string;
  presentation: "sequence" | "board";
  options: OutputOptions;
  pages: readonly OutputPage[];
  notices: readonly OutputNotice[];
  /** Every composed plan supplies this; optional for older external plan fixtures. */
  editorLayout?: EditorLayout;
}
export type OutputPlanResult =
  | { ok: true; plan: OutputPlan }
  | { ok: false; issues: readonly OutputIssue[]; editorLayout?: EditorLayout };
export interface PreparedFonts {
  fontId: string;
  measureWidthMm(text: string, fontSizePt: number): number;
  lineHeightMm(fontSizePt: number): number;
  unsupportedCodePoints(text: string): readonly number[];
}
export interface OutputContentPicture {
  tokenId: string;
  iconId: string;
  authoredLabel?: string;
  label?: string;
  note?: string;
  quantity?: QuantityAttachment;
  warning?: TokenAttachment;
  time?: DurationAttachment;
}
export interface OutputContentGroup {
  stepId: string;
  title?: string;
  description?: string;
  time?: DurationAttachment;
  groupSeconds?: number;
  pictures: readonly OutputContentPicture[];
}
