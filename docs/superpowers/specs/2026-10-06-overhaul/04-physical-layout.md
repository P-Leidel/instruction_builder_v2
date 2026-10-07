# 04 — Physical layout and print fonts

**Owner:** Physical-layout agent. **Status:** Technical delivery independently reviewed at `15d16b9`; physical acceptance remains pending. Current integration evidence is tracked in the implementation report.

Read [README](README.md) and [shared contracts](00-shared-contracts.md) first. This package owns physical composition and font preparation. [05 Export and preview](05-export-and-preview.md) consumes its successful plans; [06 Release acceptance](06-release-acceptance.md) owns actual-print, participant, and real-device evidence.

## Scope and file ownership

Create `src/lib/output-options.ts`/tests, `output-plan.ts`/tests, `text-layout.ts`/tests, `print-fonts.ts`/tests, and `print-font-adapters.ts`/tests.
Create `src/lib/attachment-labels.ts`/tests with shared display-only `getQuantityDisplayLabel(attachment: QuantityAttachment): string` and `getDurationDisplayLabel(attachment: DurationAttachment): string`. Preserve nonblank stored labels verbatim; derive blank/whitespace-only labels from structured values and the existing duration formatter without changing authored records. Reader and composition consume the same helpers.
Create `src/data/print-fonts.ts`, licensed assets under `public/fonts/`, and `docs/print-fonts.md` recording sources, licenses, coverage, sizes, and the proven adapter strategy.
Consume `src/model/output.ts` from the foundation owner; request contract changes instead of defining another output model.
The export owner writes `src/lib/output-svg.ts`, export modules, and preview/dialog components. The editor integrator owns `src/app.tsx`, shared CSS, and UI state.
Do not reuse screen `CanvasLayout` units, viewport signals, SVG DOM measurement, or the active library as print geometry inputs.
Keep the existing `pdf-pagination.ts` safeguard until the export owner replaces its callers and equivalent continuation/overflow coverage passes.

## Public contracts

Use these exact contracts from `00-shared-contracts.md`:

```ts
prepareFonts(): Promise<PreparedFonts>;
planOutput(doc: InstructionDocument, options: OutputOptions,
           fonts: PreparedFonts): OutputPlanResult;
```

`src/lib/output-options.ts` also exports `createDefaultOutputOptions(doc: InstructionDocument, locale: AppLocale, preset?: OutputPreset): OutputOptions` for the dialog, with sheet as the default preset. It supplies the specified selected groups, portrait/labels/white settings and preset metadata, with board procedural metadata off. `createDefaultLabelSheet(): NonNullable<OutputOptions["labelSheet"]>` supplies the A4/10 mm/2 mm/3 × 8 defaults. Geometry normalization and text-layout types remain internal; the UI does not calculate another physical layout.

`PreparedFonts` exposes `fontId`, `measureWidthMm(text, fontSizePt)`, `lineHeightMm(fontSizePt)`, and `unsupportedCodePoints(text)`.
Preparation is asynchronous; planning is pure and synchronous. A preparation failure becomes the localized `font-unavailable` issue before planning/download.
`OutputPlanResult` is either `{ ok: true, plan }` or `{ ok: false, issues }`. A failed result has no downloadable partial pages.
The successful plan contains captured `documentTitle`, `presentation`, `options`, ordered `pages`, and nonblocking `notices`; it does not retain a mutable document session or another document renderer.
Use only the canonical `symbol`, `text`, and `connector` fragment variants, their `MmBox`, source IDs, and `ContentRole` values.
Each text fragment represents one measured line with a fixed baseline. Rendering/export never wraps it again.
Keep normalized options and text-layout helpers internal to this package; do not add competing public plan/fragment types.

## Shared content projection

The foundation owner exports these types and helper from `src/lib/output-content.ts` with matching tests. Composition and editor/reader consume them rather than inventing another mode-omission policy:

```ts
interface OutputContentPicture {
  tokenId: string; iconId: string; authoredLabel?: string;
  label?: string; note?: string;
  quantity?: QuantityAttachment; warning?: TokenAttachment;
  time?: DurationAttachment;
}
interface OutputContentGroup {
  stepId: string; title?: string; description?: string;
  time?: DurationAttachment; groupSeconds?: number;
  pictures: readonly OutputContentPicture[];
}
projectOutputContent(doc: InstructionDocument,
                     mode: OutputMode): readonly OutputContentGroup[];
```

Preserve source group/picture order and IDs; clone arrays and attachment structures. Do not retain mutable document references or modify authored content.
`authoredLabel` always retains the source label for accessible meaning; `label` carries mode-selected visible text only. Absent/empty means no ordinary printed label. Pictures mode omits `label`; only Detailed includes notes/descriptions.
It preserves warning/quantity/token time in every mode and explicit group `time`. Sequences calculate `groupSeconds` through `stepDisplayedTime`; boards use only explicit group time, never the sum of alternative picture times.
The planner filters selected groups after projection; metadata controls and physical pagination remain separate. Boards never calculate a summed guide duration.
The reader resolves accessible meaning from nonblank `authoredLabel`, otherwise its localized catalog name, otherwise a localized unknown name. That accessible fallback does not add another visual label.
The planner uses the named neutral unknown fallback plus notice; this is the deliberate fallback exception described below, not a translation/relabel operation.

## Font feasibility gate

Before completing the planner, prove one licensed TrueType Latin font with the existing browser/jsPDF/svg2pdf stack and the export owner.
Include English, German, Latin accents, ß, curly quotation marks, en/em dashes, numerals, arbitrary quantity-unit text, and long unbroken labels in the fixture.
Use one prepared font identity for measurement, SVG, PNG, and PDF. Do not measure a system fallback and export a different font.
The initial contract has one `fontId`; use its actual regular face throughout rather than synthesizing an unmeasured bold face.
Choose portable embedded font data or vector text outlines made from the same font only after the proof establishes the working path.
Implement the exact `prepareSvgText`, `createSvgText`, and `registerPdfFonts` adapter signatures in 00. The proof can use a minimal fixture SVG and existing conversion libraries before the complete page renderer exists; it must not wait for package 05's finished renderer.
The proof must open the SVG independently, rasterize that SVG through an `Image`, render the resulting PNG, and render the PDF independently.
Check glyph appearance, wrapping, baselines, line advances, and boundary text. PDF signatures/page counts alone cannot pass the proof.
Repeat first-use output after a controlled production build is ready offline, without any earlier export warming font/PDF caches.
Record the fixture, artifact paths, dependency versions, actual results, and chosen adapter in `docs/print-fonts.md`.
If embedded SVG fonts fail in the image/PDF path, test the outlined-text adapter; preserve vector pictograms and the semantic text in the plan/reader.
If neither path passes, report the blocker and request a coordinated contract/dependency decision. Do not silently fall back to system fonts or bitmap pictograms.

## Preparation, coverage, and measurement

Bundle font assets and licenses locally. Loading a remote font service is outside this release.
Memoize preparation within a build/session, but retry a failed preparation on an explicit user retry; a rejected promise must not poison every later attempt.
Resolve browser font readiness before returning `PreparedFonts`. Expose measurable readiness/failure to the preview controller.
Keep the same font asset/version in browser and export adapters. Validate declared coverage against the actual font during preparation/build tooling.
Measure text advance in mm with the prepared font; convert pt using `25.4 / 72`, and use `lineHeightMm` for line spacing.
Wrap on available line width using measured candidates. Split long unbroken strings at safe grapheme boundaries without dropping characters.
Preserve explicit newlines; define repeated whitespace handling consistently in measurement and rendering. Do not truncate with ellipses.
Reject unsupported code points in the text that the chosen output will actually render, with source IDs and a readable recovery explanation.
The Japanese audit string remains a blocking unsupported-glyph fixture. It must not download with substituted or missing glyphs.
An unsupported note omitted by Pictures/Pictures + labels does not block those modes; Detailed must report it.
Editable JSON retains unsupported text. No export preflight may rewrite authored labels, notes, quantities, or duration values.
This package does not advertise right-to-left shaping or additional scripts; those require separate rendered acceptance.

## Options, physical dimensions, and defaults

`output-options.ts` resolves canonical `OutputOptions` into physical sizes/regions once. Planning never infers dimensions from a preview zoom or viewport.
Reject nonfinite dimensions, custom dimensions outside 20–1000 mm, invalid orientation/mode/preset, missing custom size, and irrelevant/invalid label-sheet settings.
Reject duplicate or stale selected IDs. An empty selection is `empty-selection`; selected groups are laid out in document order.
UI defaults to all current groups, `sheet`, `portrait`, `labels`, and a white background. These are UI choices, not shorthand inside the planner.
Capture `options.locale` from UI locale for generated headings/continued/fallback text. Localize through explicit message helpers; planning reads no preference singleton and never translates authored labels.
Portrait uses the stated preset dimensions; landscape swaps them once. A label's stated region is 50 × 30 mm even though its width exceeds its height.

| Preset | Region/page before orientation | Composition | Internal margin |
| --- | --- | --- | --- |
| Label | 50 × 30 mm | One selected group per label | 2 mm |
| Card | 105 × 148 mm | One selected group per card | 5 mm |
| Sheet | 210 × 297 mm | Ordered guide or grouped board, paginated | 10 mm |
| Large | 297 × 420 mm | Larger guide or grouped board, paginated | 10 mm |
| Custom | Explicit `customSize` | Guide/board pagination | 10 mm |

Labels/cards must contain the complete selected group's required content in one region. They never silently split a group.
Single-label export creates one 50 × 30 mm page per selected group. Card export creates one A6 page per selected group.
Label-sheet output has an independent `labelSheet.pageSize`; applying label orientation does not rotate the sheet again.
Default sheet settings are A4 210 × 297 mm, 10 mm sheet margin, 2 mm gap, 3 columns, and 8 rows: 24 label positions per sheet.
Place cells from the top-left configured margin, left-to-right then top-to-bottom. One selected group uses one cell; excess groups continue onto another sheet.
Leave unused cells empty. There is no automatic repeated-copy count, stock-template promise, or filler content from another guide.
Validate positive integer rows/columns, nonnegative finite margins/gaps, and the full grid footprint against the sheet's available bounds.
The dialog may recalculate a fitting grid when a preset/orientation changes; explicitly entered invalid grid values return `invalid-options` instead of being silently altered.

## Typography, metadata, and selected content

Starting typography is 10 pt labels and 9 pt secondary text; large print starts at 14 pt labels and 12 pt secondary text.
Document/group headings start at 14 pt for card/sheet/custom, 20 pt for large, and 10 pt for label. They wrap and reserve their own measured space.
Minimum pictogram shorter dimensions are 10 mm for labels, 15 mm for cards/sheets/custom, and 25 mm for large prints.
These are composition defaults for physical testing, not established universal readability thresholds. Report overflow instead of shrinking below them.
Default label/card metadata shows group titles and sequence step numbers; document title and total time are off.
Default sheet/large/custom metadata shows document title, group titles, and sequence step numbers; sequence total time is on.
Boards always omit procedural numbers/connectors and summed guide duration, because choices are alternatives. Normalization forces `metadata.stepNumbers` and `metadata.totalTime` false; their dialog controls are unavailable. Per-picture/group duration content remains included.
Metadata settings can hide the specified metadata only; they never suppress token warnings, quantities, or times.
Compute sequence group time using explicit-group-time-before-token-sum; a sequence selected-content total uses selected groups rather than hidden groups. Board groups display only explicitly authored group time, and never an inferred sum of alternatives.
`labels` shows token labels; `pictures` hides ordinary token labels; `detailed` additionally includes token notes and group descriptions.
Every mode includes structured warning meaning, quantity value/unit, and token/group time. Pictures mode still shows required warning/value text.
Use authored labels when present; keep catalog names available for semantic meaning and unknown-symbol recovery without rewriting authored text.
Unknown icons use `resolveIcon`'s neutral fallback and a visible name; emit `unknown-symbol` notices. This deliberate fallback may include identifying text even in Pictures mode.
Warning attachments use `getWarningMeaning` with the captured output locale, retain the warning role/visible context, and emit an unknown-symbol notice when their reference is missing or not a warning entry. Test unknown warnings with authored text and without it: neither can disappear or become an ordinary neutral object in Pictures mode.
Empty groups emit `empty-group` notices and retain their selected group context. Do not silently discard them.

## Composition and continuation

Construct complete token units first: main pictogram, chosen label/note lines, and attached warning/quantity/time information.
User-requested refinement on 7 October: place quantity/warning/time in a measured column beside the main picture, with each attachment icon beside its text. Short details must not add the previous tall vertical stack to the next row. Preserve full label width for unrelated pictures. Long required text still wraps and reserves space; retain all content, physical minimums, source association and overflow safeguards. See the [refinement evidence](../../../phase-3/audits/2026-10-07-print-layout/README.md).
Wrap token units into rows within the physical content width. Reserve measured attachments/text before deciding the next row/page boundary.
Keep each token's warning/quantity/time with that token. Never place its required attachment on another page or clip its text to a fixed badge.
Sequence output preserves group/token order with original step numbers and restrained connectors between adjacent token units.
Board output groups a grid in source order with group titles, no connectors, and no procedural numbering.
Fit whole groups when possible on sheet/large/custom pages. An oversized group continues at token-row boundaries with repeated title/number and localized continued context.
Continuation headings consume physical space on every continuation page; they must be measured before row placement.
A token unit or one required row that cannot fit a fresh page returns `overflow` for its source group/token. Do not repeatedly create empty continuation pages.
Label/card overflow returns a specific issue naming the group and format, with larger-size/smaller-group recovery. A label sheet cannot conceal an overflowing cell.
Preserve every selected main token exactly once across pages. Count only `kind: "symbol", role: "token"`; labels and attachment fragments may share its source ID.
All fragment boxes, baselines, connector endpoints, and their drawn extents remain inside their page and assigned region after internal margins.
Use output roles for controlled visuals; this display list does not become arbitrary CSS, user-authored SVG, or a freeform graphics engine.

## Implementation acceptance and evidence

- Add failing fixtures for exact preset/custom sizes, orientation, independent label-sheet page/region sizes, 24/25-cell pagination, and invalid options.
- Test identical plans at 320/390/768/1440 CSS px, long German labels/titles, unbroken text, explicit newlines, and selected-group totals.
- Test labels/cards with fit and overflow; test a 20-token group and 85-token continuation with every main token present once and all measured bounds valid.
- Test all modes, required attachments, empty groups, unknown artwork, mixed libraries, board omissions, and Japanese blocking only when rendered.
- Run focused tests for output options/content/plan, text layout, and print fonts, plus type/lint checks.
- Complete and record the shared font proof with the export owner. Keep actual-print/readability, participant, and real-device conclusions pending for package 06.

Handoff includes frozen option normalization, fixture plans, font/license records, measured-layout tests, and unresolved blockers. Implementation completion requires passing technical evidence; specification completion does not close those checks.
