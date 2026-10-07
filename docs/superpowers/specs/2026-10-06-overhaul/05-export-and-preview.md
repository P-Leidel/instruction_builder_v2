# 05 — Export, print preview, and offline output

**Owner:** Export/preview agent. **Status:** Implementation is in progress; final integration and release evidence are pending.

Read [README](README.md), [shared contracts](00-shared-contracts.md), and [04 Physical layout](04-physical-layout.md). This package renders the frozen physical plan, generates files, and provides the output dialog. It does not compose another layout from editor DOM or infer usability from exported screenshots.

## Scope and file ownership

Create `src/lib/output-svg.ts`, `output-svg.test.ts`, `output-export.ts`, and `output-export.test.ts`.
Create `src/components/OutputDialog/OutputDialog.tsx`, `src/components/OutputPreview/OutputPreview.tsx`, and colocated styles.
Modify `src/lib/svg-export.ts`, `png-export.ts`, `pdf-export.ts`, their tests, and `document-actions.ts`/tests to replace canvas-based callers after integration.
Own font/artifact offline checks in `scripts/offline-assets.mjs`, its tests, `public/sw.js`, service-worker tests, and the production PWA/export evidence scripts.
The physical-layout owner supplies prepared fonts/metrics and plans; the library owner supplies trusted artwork; the reader owner supplies semantic recipient content.
The editor integrator alone connects components/actions in `src/app.tsx` and owns shared CSS and `src/state/ui.ts`. Supply integration props/results and scoped style names rather than concurrent edits there.
Keep legacy export/heading/oversized-step regressions until the new equivalent checks pass; then remove the hidden export-canvas dependency and obsolete export code with the integrator.

## Exact public contracts

Use these canonical contracts; do not introduce a second page/fragment model:

```ts
renderOutputPage(page: OutputPage, fonts: PreparedFonts): SVGSVGElement;
createSvgFile(plan: OutputPlan, pageIndex: number): Promise<Blob>;
createPngFile(plan: OutputPlan, pageIndex: number,
              dpi: 150 | 300): Promise<Blob>;
createPdfFile(plan: OutputPlan): Promise<Blob>;
```

Exporters share `prepareFonts()` and its format adapters. A preparation failure maps to `font-unavailable`; renderer/converter failure is a localized export failure before success/download.
Consume `prepareSvgText`, `createSvgText`, and `registerPdfFonts` from the physical-layout owner; do not implement another font serialization/conversion strategy.
`OutputPlan` captures `documentTitle`, `presentation`, normalized options, physical pages, and notices; no exporter reads a later document session or active palette.
File creation and `downloadBlob(blob, filename)` remain separate. An artifact-producing promise does not initiate hidden multiple downloads.
Validate page indices as finite integers in the plan's page range. Reject invalid indices, unsupported density, and over-limit raster requests before allocation/download.
Use shared issue codes/translated messages for option/font/raster failures. Preserve unexpected technical error details for diagnostics without showing raw stack traces as product text.
The app must never report a null canvas, empty result, or unresolved promise as a successful export.

## Shared rendering rules

Render every `OutputPage` with physical `width`/`height` attributes in mm and a matching mm-coordinate `viewBox`.
Use explicit fills, strokes, and typography from controlled content roles. Detached output must not depend on app CSS, computed styles, or viewport classes.
Render resolved artwork as inline trusted vector paths with its canonical 24 × 24 viewBox scaled into the fragment box.
Unknown artwork uses the same named fallback/notice as preview; a palette switch cannot remove a symbol from an existing plan.
Unknown warning attachments preserve their planned warning meaning/context in every format, including Pictures-only. Test authored-warning text and the localized unlabelled Unknown warning fallback independently of ordinary missing-picture fixtures.
Render each measured text fragment at its planned baseline/font/pt size. Do not truncate, shrink, remeasure, or recompute line breaks per format.
Apply the proven embedded-font/outlined-text adapter from package 04 consistently; no external font URL is allowed in a portable artifact.
Keep authored text escaped through text nodes or the controlled font adapter. It must never become arbitrary injected SVG/HTML markup.
Use fragment sources/roles to check inclusion and order. Only symbol fragments with role `token` count as main occurrences; other fragments may repeat those source IDs.
Sequence connector fragments render restrained directional cues. Boards contain no procedural arrows or numbering even if a metadata checkbox was previously enabled for a sequence.
White pages include an explicit white background. Transparent SVG/PNG pages omit that background; do not accidentally export the editor's surface color.
PDF viewers/physical paper present the page on a white surface. A transparent plan still omits its background fill; explain that it cannot make physical paper transparent. SVG/PNG preserve the selected transparency without an extra PDF-only opaque fill.
Headings, totals, selected group context, warnings, quantities, and times are already in the plan. PDF must not draw an additional independent heading.
No format may rely on a cropped viewBox to hide overflow that the planner did not resolve. Validate observed painted extents, including stroke/marker bounds.

## Font proof and portable artifacts

Work with the physical-layout owner on the feasibility gate before finalizing font integration.
Prove German/Latin text by reopening standalone SVG and PDF in an independent renderer and examining PNG glyphs/boundary lines.
Register the prepared licensed TTF with jsPDF before svg2pdf when using the embedded-text route; use the same planned family/face for every line.
The installed dependency documentation supports custom TTF registration but does not establish artifact parity; rendered proof is required.
If the agreed adapter outlines text, retain vector paths and plan/source semantics. Do not rasterize pictograms or the full page to bypass font coverage.
Japanese is a negative preflight fixture: display an unsupported-glyph issue and produce no misleading download. Test omitted Japanese notes separately from Detailed.
SVG files contain only bundled artwork, portable font/text assets, and selected plan content. Verify no network access is needed when reopened.
Record proof artifacts and limitations in `docs/print-fonts.md`; actual printer and participant observations remain package 06 evidence.

## SVG, PNG, and PDF generation

`createSvgFile` serializes exactly one chosen plan page to an `image/svg+xml` Blob with physical dimensions and complete portable styling/assets.
For multi-page guides, expose explicit numbered SVG page actions with the full page count. Each user activation generates/downloads that page only.
`createPngFile` rasterizes the same rendered page, preserving chosen background and content.
PNG width is `round(page.size.widthMm / 25.4 * dpi)` and height uses the equivalent formula; offer only 150 and 300 dpi.
Calculate both dimensions and their product before constructing an `Image`/canvas. Reject more than 24,000,000 pixels per page with `raster-limit`.
Also reject invalid/unsupported browser canvas dimensions with an actionable vector-format/lower-density recovery; do not claim the pixel budget guarantees device success.
Release Blob/object URLs on success and error, use `Image.onerror`, and reject null canvas contexts or null `toBlob` results.
Render vectors directly at destination PNG dimensions; do not enlarge an already rasterized preview screenshot.
Expose explicit numbered PNG page actions with density and complete page count. Avoid a download loop subject to browser multiple-download restrictions.
`createPdfFile` includes every page of the selected plan, at each page's mm dimensions, in index order.
Keep pictograms as vector paths in PDF; do not use full-page bitmap images as the PDF rendering path.
Ensure label-sheet PDFs use the sheet page dimensions while individual-label PDFs use the label dimensions.
Use lazy PDF/conversion imports. Do not execute the PDF engine merely to open the editor or change library filters.
Generate filenames from the captured title through `slugify`; number individual pages consistently, for example `guide-page-02-of-05.svg`.
Preserve the existing attached-anchor and delayed download-URL revocation behavior; an early revoke can cancel transfers on slower devices.
Download success copy means the file was generated and its download was requested. It must not claim the browser saved a file or a physical print succeeded.

## Output dialog and captured state

The application integration contract is `OutputDialogProps { sourceDocument: InstructionDocument; guideId: string | null; locale: AppLocale; onClose: () => void }`. `sourceDocument` is the live immutable source prop; the dialog captures its own clone and guide identity on mount. App captures locale and the opener when opening, suspends shortcuts while output is open, unmounts on a guide identity change, and restores opener focus after close. The dialog uses source changes to invalidate readiness and offers explicit Refresh; it never imports the live document session.

Opening output preserves an existing desktop panel and its unsaved draft behind the inert modal. A mobile contextual sheet closes before output opens, keeping one native modal. Escape and Close act on output alone and return focus to the output opener.

`OutputDialog` owns transient settings, preparation status, busy state, blocking issues, notices, and its captured plan. These do not enter document history or JSON.
On open, capture the current guide document and its guide identity, then initialize all groups selected, A4 sheet, portrait, Pictures + labels, and white background.
Capture `options.locale` from UI locale for generated context/fallback text, without changing authored content. Font preparation and file generation read the plan's captured values.
Apply metadata and label-sheet defaults from package 04. There is one source for defaults/normalization; do not independently recompute printable geometry in JSX.
For boards hide/disable procedural-number and summed-total-time controls; normalization forces both false. Explicit group/picture durations remain visible in every mode.
Show named preset/orientation/mode controls, selected groups, metadata visibility, background, and custom width/height where relevant.
For label-sheet mode show independent sheet size, margin, gap, rows/columns, cell size, used cells, and total pages. Default A4 holds 24 cells, one group per cell.
Provide Pictures + labels, Pictures only, and Detailed names with a concise inclusion explanation. Required warning/quantity/time values remain in all modes.
Explain omitted notes/descriptions before download; selecting a mode does not remove them from the guide.
Changing output settings starts preparation/planning for a new captured request. Use a monotonically increasing request token; accept only the latest completed request.
Discard results after close, guide switch, or a newer settings request. A stale promise must not restore pages or enable downloads for an older guide.
If the underlying guide changes while the dialog is open, invalidate download readiness and offer explicit refresh/replanning of the current guide snapshot.
Each download activation captures the successful plan/page/density it will use. Async export completion uses that captured artifact, never later session values.
Disable relevant download actions while preparation/planning/export is pending or blocked; preserve controls needed to fix the issue and offer explicit retry after font failure.
Overflow copy names the affected group/format and offers larger size or return to editing. Glyph/font copy names the affected content and keeps JSON backup available.
Unknown-symbol/empty-group notices are visible before download; they do not become silent omissions or automatically block a valid plan.
Use the existing focus/dialog conventions: modal containment, background inertness through the integrator, Close/Escape, focus return, and software-keyboard-safe scrolling.

## Exact preview and accessibility

`OutputPreview` consumes the successful `OutputPlan` and `renderOutputPage`; it never lays out a competing screen version of print content.
Show actual dimensions, page number/count, label cells where relevant, and the current output mode/background. Page viewing zoom is independent of physical size.
Show printable content bounds/margins as a preview aid outside the exported content. Explain printing at 100% actual size.
At narrow widths, let pages scale as a visual preview while dialog controls remain readable and at least 44 × 44 CSS px.
Provide keyboard-operable page navigation and zoom controls; retain focus while asynchronous preview updates.
Expose page/group summaries and selected content to assistive technology in source order through `projectOutputContent` and the shared reader's accessible-meaning fallback.
The controller supplies that projection from the same captured document/mode, filtered to selected groups; keep it outside the finite plan. Never derive missing accessible meaning from a later guide or rebuild print layout from the projection.

Render this semantic equivalent with package 03's pure `ReadingContent`, using its owned `ReadingGroup` type/source IDs. Both semantic and physical content use the shared display-only attachment-label helpers for valid blank-label imports.
Avoid making every SVG path an accessibility node. If a semantic equivalent accompanies the visual SVG, hide the duplicate graphic from screen-reader traversal.
Pictures mode keeps accessible symbol meaning despite hiding ordinary printed labels. Warning, quantity, time, and Detailed text follow their owner symbol/group.
Announce loading, page-count changes, notices, and blocking errors through appropriate status/error semantics without announcing every rendered SVG primitive.
Verify long German controls and 200% text zoom without covering focused controls or trapping navigation inside a preview page.

## JSON and document actions

JSON export remains the full editable document, independent of selected groups, output mode, page index, unsupported glyphs, or overflow.
Integrate with the guide package's JSON/new/import behavior: imports create another local guide by default, and an example does not replace saved work.
Keep backup/import under document actions; no rendering failure should disable preservation of the current in-memory guide.
`document-actions.ts` keeps result/error orchestration separate from UI signal writes. The integrator displays localized outcomes.

## Offline assets and cache safety

The production asset manifest must include all bundled fonts, artwork assets, and lazy PDF/conversion chunks before the installed build is declared ready offline.
First offline export must work without a previous online export/font load. Repeat after an update while preserving old clients' lazy assets until they close.
Preserve same-origin GET-only service-worker handling and waiting update activation; do not introduce `skipWaiting` plus deletion of assets still needed by open clients.
Current `matchCached` ignores `Vary` only for `/assets/` and `/icons/`. Fonts under `/fonts/` need equivalent narrowly scoped public-build-asset handling or build-hashed asset paths.
Prove font/cache hits when the host adds `Vary: Origin` and installation/page requests have different Origin headers.
Do not use broad `ignoreVary: true` for arbitrary same-origin responses. Keep the exception limited to public immutable build assets included in the manifest.
Add manifest/font/update regressions to existing offline/service-worker tests and controlled-build PWA scripts.

## Implementation acceptance and handoff

- Test renderer dimensions, all fragment roles, backgrounds, escaped authored text, unknown artwork, and no duplicate independently drawn PDF heading.
- Test real artifacts for mode/metadata parity, selected source IDs, long German text, label-sheet sizes, 85-token continuation, and Japanese blocked preflight.
- Test PNG exact pixel sizes, 24-million-pixel boundary rejection before allocation, converter failure, stale async results, guide switching, and per-page download behavior.
- Run focused unit/type/lint checks, `npm run test:browser`, build/tooling checks, and `npm run test:pwa`; retain maintenance regressions.
- Record exported fixtures and actual automated/font proof results. Keep real iOS/Android, screen-reader, actual-print, and participant acceptance explicitly pending for package 06.

Handoff includes renderer/export tests, numbered-download behavior, scoped component integration instructions, portable artifacts, offline/update evidence, and unresolved limits. Do not mark physical readability or child comprehension complete from automated checks.
