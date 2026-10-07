# Shared contracts for the visual instruction overhaul

**Owner:** Foundation agent. **Purpose:** Freeze the narrow interfaces used by independently implemented packages. Types below belong in the named production files during implementation; this specification does not create those files.

## Document and session

In `src/model/instruction.ts`, advance `CURRENT_SCHEMA_VERSION` to **2** and add required `meta.presentation: "sequence" | "board"`. Keep `meta.domain`, `createdAt`, steps, tokens, categories, attachments, and their numeric contracts. A board's steps are picture groups; array order defines DOM/reading order without conveying a procedural sequence. No library ID belongs on a document.

`migrate(value: unknown): InstructionDocument` accepts validated v1 documents and produces v2 with `presentation: "sequence"` when the field is absent. If v1 already contains this reserved field, retain a recognized sequence/board value and reject an invalid value rather than silently overwrite it. V2 requires a supported presentation. Preserve other unknown fields and historical quantity repairs. Reject future schemas and malformed presentation without replacing active work. Document-file JSON exports v2; a bare JSON file contains the document, not local guide IDs/revisions or preferences.

`createEmptyDocument(presentation: "sequence" | "board" = "sequence")` keeps its current default and returns one empty group with schema v2. The creation UI supplies a localized untitled title; migration does not translate stored titles.

`validateStep(step)` reports empty groups as advisory and accepts every nonempty token array, including object-only steps. Remove the missing-action rule and its copy. Unknown artwork stays structurally valid; artwork review and output glyph/overflow problems are separate concerns.

Add these bound actions in `src/state/document.ts`, with matching session-first entries in `sessionActions`:

```ts
setPresentation(presentation: "sequence" | "board"): void;
moveTokenTo(fromStepId: string, tokenId: string,
            toStepId: string, finalIndex: number): void;
```

Separately export the explicit session-first helper (do not bind away its session argument):

```ts
openDocumentInSession(session: DocumentSession, doc: InstructionDocument): void;
```

`moveTokenTo` interprets the index **after** removing the source token; clamps to the destination length; no-ops on stale IDs or the current destination; makes one history entry; and selects the moved token in its destination. Keep the existing `moveToken` pre-removal contract for remaining legacy callers until replacement. `openDocumentInSession` opens a different guide, clears history/coalescing/clipboard, and selects its first group. Existing `replaceDocument` remains an undoable replacement within the current guide; do not use it to carry undo across guides.

Export `documentSession: DocumentSession` as the existing default session. Existing bound exports continue using that same instance. New components receive it explicitly; do not create a second running document or persistence observer.

## Catalog and preferences

Define in `src/model/library.ts`:

```ts
type AppLocale = "en" | "de";
type LibraryId = "kitchen" | "routines" | "learning";
interface CatalogEntry {
  iconId: string;
  category: TokenCategory;
  labels: Record<AppLocale, string>;
  aliases: Record<AppLocale, readonly string[]>;
}
interface ContentLibrary {
  id: LibraryId;
  names: Record<AppLocale, string>;
  entries: readonly CatalogEntry[];
  provenanceIds: readonly string[];
}
interface ResolvedIcon {
  iconId: string;
  known: boolean;
  viewBox: "0 0 24 24";
  markup: string;
}
```

`src/lib/library-catalog.ts` exports `getLibrary(id: LibraryId): ContentLibrary`, `getCatalogEntry(iconId: string): CatalogEntry | undefined`, `findLibraryEntries(library: ContentLibrary, query: string, locale: AppLocale, category?: TokenCategory): readonly CatalogEntry[]`, and `resolveIcon(iconId: string): ResolvedIcon`. Unknown resolution returns a visible neutral question-mark tile. Markup comes only from bundled trusted artwork. Retain `iconMarkup(iconId): string | undefined` for legacy compatibility; new consumers use `resolveIcon`.

Also export `getWarningMeaning(warning: TokenAttachment, locale: AppLocale): string`: nonblank authored warning label, otherwise a known warning entry's localized label, otherwise localized **Unknown warning (<stored ID>)**. Retain a visible and accessible warning context independently of the neutral fallback tile, in every content mode. Unrecognized/non-warning attachment references receive a review notice; never disappear or turn into an ordinary unknown object.

Define in `src/model/preferences.ts`: `AppPreferences { uiLocale: AppLocale; labelLocale: AppLocale; activeLibraryId: LibraryId; lastGuideId?: string }`. New profiles match supported browser language, otherwise English; label locale initially matches UI locale but is independently changeable. Preference changes do not enter document history. Preferences use their own versioned local key.

Localization uses typed message keys with parameter interpolation; consumers do not build translated sentences from fragments. Catalog insertion copies a default label into authored text. This release has no bulk relabel or automatic translation action.

## Guide repository

Define in `src/model/guide.ts`:

```ts
interface GuideRecord {
  id: string;
  revision: number;
  document: InstructionDocument;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}
interface GuideSummary {
  id: string;
  revision: number;
  title: string;
  presentation: "sequence" | "board";
  updatedAt: string;
}
type GuideWriteResult =
  | { ok: true; record: GuideRecord }
  | { ok: false; reason: "conflict" | "unavailable" | "deleted" };
interface GuideRepository {
  list(): Promise<readonly GuideSummary[]>;
  load(id: string): Promise<GuideRecord | undefined>;
  create(doc: InstructionDocument): Promise<GuideWriteResult>;
  save(id: string, expectedRevision: number,
       doc: InstructionDocument): Promise<GuideWriteResult>;
  duplicate(id: string, title: string): Promise<GuideWriteResult>;
  remove(id: string, expectedRevision: number): Promise<GuideWriteResult>;
  restore(id: string, expectedRevision: number): Promise<GuideWriteResult>;
}
```

Revision starts at 1, increases once per committed mutation, and is compared within the same readwrite transaction as the write. Records are independently keyed so writes to separate guides do not conflict. Removal retains a tombstone and recoverable document. Missing/deleted records cannot be recreated by a stale save. Initial create failures leave in-memory work exportable.

`src/state/guides.ts` exposes `activeGuideId: Signal<string | null>`, `guideSummaries`, and `saveState` signals. `GuideActionResult` is `{ ok: true; guideId?: string } | { ok: false; reason: "conflict" | "unavailable" | "deleted" | "not-found" | "cancelled" }`. Actions are `refreshGuides(): Promise<void>`, `openGuide(id: string): Promise<GuideActionResult>`, `reloadActiveGuide(): Promise<GuideActionResult>`, `createGuide(doc: InstructionDocument): Promise<GuideActionResult>`, `duplicateGuide(id: string): Promise<GuideActionResult>`, `deleteGuide(id: string, expectedRevision: number): Promise<GuideActionResult>`, `restoreGuide(id: string, expectedRevision: number): Promise<GuideActionResult>`, and `flushActiveGuide(): Promise<GuideActionResult>`. Storage code does not claim success before commit. Save-state values are `loading`, `saved`, `pending`, `saving`, `unavailable`, and `conflict`. A last-guide preference is a reopening convenience, not authority over another tab's active guide.

`reloadActiveGuide` is the explicit discard-local-edits recovery path after the UI's export/reload choice. It does not flush the conflicted draft. Load and validate the saved record first; only success replaces the session, clears history/clipboard, adopts the disk baseline, and resumes saving. Missing/deleted/unreadable/failing loads preserve the draft and return an error. Ordinary `openGuide` never bypasses its flush requirement.

## Shared content projection

Foundation owns `src/lib/output-content.ts` and tests, consumed by the reader and composer. Export `projectOutputContent(doc: InstructionDocument, mode: OutputMode): readonly OutputContentGroup[]` with these types:

```ts
interface OutputContentPicture {
  tokenId: string;
  iconId: string;
  authoredLabel?: string;
  label?: string;
  note?: string;
  quantity?: QuantityAttachment;
  warning?: TokenAttachment;
  time?: DurationAttachment;
}
interface OutputContentGroup {
  stepId: string;
  title?: string;
  description?: string;
  time?: DurationAttachment;
  groupSeconds?: number;
  pictures: readonly OutputContentPicture[];
}
```

`authoredLabel` retains the source label for accessible meaning. `label` is visible authored text in labels/detailed mode, omitted in pictures mode. Only detailed mode includes note/description. Clone arrays and attachment objects; preserve authored empty strings. Never generate translated visible text for absent labels. For sequences, `groupSeconds` uses `stepDisplayedTime`'s explicit-group-time-over-token-sum rule. For boards it contains only explicit group time, otherwise undefined; alternative picture times must never be summed. Every mode retains structured warnings/quantities/times. Reader derives accessible names from nonblank authored text, catalog meaning in its locale, or unknown fallback. Boards have no summed guide-level duration.

## Physical output

Define in `src/model/output.ts`:

```ts
type OutputMode = "labels" | "pictures" | "detailed";
type OutputPreset = "label" | "card" | "sheet" | "large" | "custom";
interface PageSize { widthMm: number; heightMm: number }
interface OutputOptions {
  preset: OutputPreset;
  locale: AppLocale;
  orientation: "portrait" | "landscape";
  customSize?: PageSize;
  mode: OutputMode;
  selectedStepIds: readonly string[];
  background: "white" | "transparent";
  metadata: { documentTitle: boolean; groupTitles: boolean;
              stepNumbers: boolean; totalTime: boolean };
  labelSheet?: { pageSize: PageSize; marginMm: number;
                 gapMm: number; columns: number; rows: number };
}
interface OutputSource { stepId?: string; tokenId?: string }
interface MmBox { xMm: number; yMm: number; widthMm: number; heightMm: number }
type ContentRole = "token" | "warning" | "quantity" | "time"
  | "label" | "note" | "description" | "heading" | "context";
type OutputFragment =
  | { kind: "symbol"; source: OutputSource; role: ContentRole;
      box: MmBox; iconId: string }
  | { kind: "text"; source: OutputSource; role: ContentRole;
      box: MmBox; text: string; fontId: string; fontSizePt: number;
      baselineMm: number }
  | { kind: "connector"; source: OutputSource; role: "context";
      from: { xMm: number; yMm: number }; to: { xMm: number; yMm: number } };
interface OutputPage {
  index: number;
  size: PageSize;
  background: "white" | "transparent";
  fragments: readonly OutputFragment[];
}
interface OutputIssue {
  code: "invalid-options" | "empty-selection" | "overflow"
    | "unsupported-glyph" | "font-unavailable" | "raster-limit";
  source?: OutputSource;
  messageKey: string;
  params?: Record<string, string | number>;
}
interface OutputNotice {
  code: "unknown-symbol" | "empty-group";
  source: OutputSource;
  messageKey: string;
}
interface OutputPlan {
  documentTitle: string;
  presentation: "sequence" | "board";
  options: OutputOptions;
  pages: readonly OutputPage[];
  notices: readonly OutputNotice[];
}
type OutputPlanResult =
  | { ok: true; plan: OutputPlan }
  | { ok: false; issues: readonly OutputIssue[] };
interface PreparedFonts {
  fontId: string;
  measureWidthMm(text: string, fontSizePt: number): number;
  lineHeightMm(fontSizePt: number): number;
  unsupportedCodePoints(text: string): readonly number[];
}
```

`src/lib/print-fonts.ts` exports `prepareFonts(): Promise<PreparedFonts>` and browser/font-format adapters for the same licensed font. `src/lib/output-plan.ts` exports `planOutput(doc: InstructionDocument, options: OutputOptions, fonts: PreparedFonts): OutputPlanResult`. Planning is pure and synchronous after preparation; font preparation failure is mapped to `font-unavailable`. Sizes/margins/regions are normalized once in `src/lib/output-options.ts`, independent of viewport.

`src/lib/output-svg.ts` exports `renderOutputPage(page: OutputPage, fonts: PreparedFonts): SVGSVGElement`. Its font adapter embeds portable font data or outlines measured text using the same font; prove the chosen method across all formats first. Do not embed an external URL or rasterize pictograms to solve font problems.

The physical-layout owner also supplies `src/lib/print-font-adapters.ts`: `prepareSvgText(svg: SVGSVGElement, fonts: PreparedFonts): void`, `createSvgText(fragment: Extract<OutputFragment, { kind: "text" }>, fonts: PreparedFonts): SVGElement`, and `registerPdfFonts(pdf: jsPDF, fonts: PreparedFonts): void`. SVG preparation adds portable font resources when needed; text creation implements the proven text or outline path; PDF registration adds the matching face or is a documented no-op for outlined text. The private font cache retains the asset matched by `fontId`; consumers never invent a second font asset/measurement strategy.

Export contracts in `src/lib/output-export.ts` are `createSvgFile(plan, pageIndex): Promise<Blob>`, `createPngFile(plan, pageIndex, dpi: 150 | 300): Promise<Blob>`, and `createPdfFile(plan): Promise<Blob>`. All share prepared font adapters and the renderer. File creation is separate from initiating a browser download. Reject invalid page indexes and over-limit PNG requests before allocating or downloading; callers map errors into localized issues.

## Interpretation rules

- `selectedStepIds` is explicit: an empty array is an error, not shorthand for all. UI defaults to all document groups. Normalize order to the document, reject stale IDs and duplicates, and never silently select another group.
- Portrait uses the preset's stated dimensions; landscape swaps them once. Labels are a fixed **50 × 30 mm** region before orientation. A label sheet has independent page size and calculated label-region positions; validate its rows/columns/margins/gaps before placing content.
- `locale` is captured from UI locale on opening output, and controls generated headings, continuation context, and fallback messages only. It never translates authored text. Planning reads no global preference signals.
- Board metadata normalizes procedural step numbers and summed total time to false; their controls are unavailable. Board output has no connectors. It retains group titles, source order, and individual group/picture durations. Sequence output uses numbered context and restrained direction cues.
- Only `kind: "symbol", role: "token"` counts as a main token occurrence. Other fragments may repeat its source ID. Continuation headings intentionally repeat. Every selected main token occurs once in the plan.
- Unknown pictures render a named fallback plus notice; unsupported glyphs in actually selected output content block the plan. Omitted optional text is not glyph-preflighted for that mode. JSON always preserves all content.
- A failed plan has no downloadable partial pages. Each successful export reflects the captured plan, not a later document or active palette. The preview controller discards stale asynchronous preparation results.

## Foundation acceptance

Test v1 migration, v2 sequence/board round trips, invalid/future schemas, exact preservation of optional fields, object-only completeness, fresh-session history, final-index moves and stale destinations. Add contract fixture builders for mixed libraries, a board, a 20-token group, an 85-token group, long German labels, warnings/quantity/time, and unsupported Japanese text. Fixtures must not become production sample content accidentally.

Create `src/test/fixtures/overhaul.ts` exporting `sequenceFixture()`, `boardFixture()`, `mixedLibraryFixture()`, `longGroupFixture(tokenCount: number)`, and `unsupportedTextFixture()`, each returning `InstructionDocument` with deterministic fixture IDs. Include warning/quantity/time and optional notes in the sequence fixture, and two timed alternatives with no group time in the board fixture. Consumers clone returned values rather than mutate shared constants.

This owner reviews exported names/types with dependent agents before they implement them. Later agents request contract changes rather than independently creating another variant.
