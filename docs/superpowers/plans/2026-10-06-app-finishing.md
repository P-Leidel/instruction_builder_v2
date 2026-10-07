# UX and Design Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make short pictogram instructions easy to create and understand, with several selectable libraries and reliable output from labels to large prints.

**Architecture:** Retain the Preact/signals document session, stable icon IDs, undo/redo, and offline local persistence. Add a library catalog, semantic responsive editor/reader, and one measured output plan whose physical geometry drives Preview, SVG, PNG, and PDF. Screen interaction geometry and physical print geometry are explicit, separate presentations of the same authored document.

**Tech Stack:** TypeScript, Preact, signals, native HTML/SVG, idb-keyval, jsPDF/svg2pdf.js, Vite, Vitest, Playwright, static hosting/PWA. Use Node 24 for CI; the maintenance branch declares `^22.12.0 || ^24.0.0 || >=26.0.0`.

**Spec:** [UX and design overhaul](../specs/2026-10-06-ux-design-overhaul.md). Read the [observed audit](../../phase-3/audits/2026-10-06-takeover-review.md) for reproduction evidence.

**Status:** Earlier planning record, superseded for execution by the [agent specification package](../specs/2026-10-06-overhaul/README.md) and [agent implementation plan](2026-10-06-agent-implementation.md). The newer package includes confirmed bilingual controls, local My guides, original artwork, and choice boards; use its contracts/tasks for implementation. Independent maintenance is [implemented and verified](../../phase-3/progress/2026-10-06-reliability-maintenance.md). The earlier tasks below remain unexecuted context.

## Global Constraints

- Preserve one document engine, existing recipe icon IDs, legacy JSON repair, immutable edits, history, and offline editing/export.
- Several bundled libraries are part of this release. Kitchen, Daily routines/workplace, and Learning/classroom are proposed initial groupings; validate the names and minimum inventories in Task 1.
- Palette changes do not erase content, change existing labels, remove another library's symbols, or create document-history entries.
- Keep authoring controls at least **44 × 44 CSS px** and ordinary authoring text at least **16 CSS px**. Test 320 CSS px and 200% text zoom without content-dependent shrinking.
- Default labelled print formats target at least **10 pt** labels and **9 pt** secondary annotations. A6/A4 pictograms target at least **15 mm** in their shorter dimension; A3 starts at **25 mm**. Validate these starting values in physical tests.
- Initial presets: label **50 × 30 mm**, A6 **105 × 148 mm**, A4 **210 × 297 mm**, A3 **297 × 420 mm**; custom width/height **20 to 1000 mm**. Output size is independent of viewport and screen zoom.
- Preserve vector pictograms in SVG/PDF. No silent content omission, global shrinking below the minimum, unsupported-glyph substitution, or clipped continuation rows.
- PNG offers **150 and 300 dpi**, with a proposed ceiling of **24 million pixels per page** checked before raster allocation; larger jobs offer vector output or lower density.
- No automatic translation, account/backend requirement, child-suitability claim, freeform canvas, or unrelated engine refactor. New persistence shapes require an explicit version/migration decision.

## Review Focus

- Mixed-library and unknown imported symbols remain visible and editable after switching palettes; Task 2 owns these fixtures.
- A long phone step must preserve another step's readable controls, keyboard focus, and current selection; Task 4 owns these fixtures.
- Small labels and 85-symbol steps either preserve required content at the minimum sizes or report a specific overflow; Tasks 3 and 6 own these fixtures.
- Authored descriptions, notes, warnings, and non-Latin labels reach the recipient in the chosen mode and correct reading order; Tasks 3, 5, and 6 own these fixtures.
- A warmed installed build supports first-use export offline with its libraries/fonts, including after an update; Task 6 owns these fixtures and Task 0 retains the maintenance gates.

## Delivery Boundaries

| Delivery | Visible/testable result | Depends on |
| --- | --- | --- |
| 0 Maintenance | Safe import/save/recovery and enforceable browser/offline checks | Current work, independent of design |
| 1 Prototype | Tested basic authoring flow and real-size print direction | Audit and target-user access |
| 2 Libraries | Several searchable bundled palettes preserving old documents | 1 |
| 3 Composition | Measured, readable physical-size layout and font coverage | 1; artwork resolver from 2 |
| 4 Editor | One nearby tap/keyboard creation flow on phone and desktop | 1–2 |
| 5 Recipient/preview | Complete ordered reading and exact print preview | 3–4 |
| 6 Formats | Consistent vector/raster output and cold offline export | 3 and 5 |
| 7 Acceptance | Recorded creator/recipient, print, device, and recovery evidence | 2–6 |

Tasks 3 and 4 can proceed independently after their interfaces are reviewed. Keep each delivery separately reviewable; do not wait for a full visual rewrite to verify maintenance. Composition and editor work are substantial; this plan makes no calendar estimate before the prototype round.

## Task 0: Finish Independent Maintenance and Preserve Its Gates

**Files:** `src/model/migrate.ts`/tests, `src/state/persistence.ts`/tests, `src/app.tsx` recovery feedback, `package.json`/lock, `public/sw.js`, browser/PWA scripts, `scripts/`, `.github/workflows/ci.yml`, maintainer documentation.

**Interfaces:** Import returns a valid current document or a user-safe error without replacing the active session on rejection. Persistence compares the previously loaded record atomically, preserves newer disk work on conflict, and retains an unreadable record before replacement. Browser commands fail on failed expectations. Offline preparation includes lazy export dependencies.

- [x] Review maintenance against the reproductions: malformed optional fields/string durations, two-tab overwrite, unreadable-record replacement, false browser expectation, first PDF use offline, oversized-step clipping, and dependency audit.
- [x] Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:tooling`, and `npm run build`; record 323 unit tests, seven tooling tests, and successful exits.
- [x] Run `npm run test:browser` and `npm run test:pwa`; verify real IndexedDB conflict/recovery, a deliberate false assertion's nonzero exit, first-use exports offline, and updates retaining open-tab lazy assets. Remove temporary failure variants before final checks.
- [x] Run full and production dependency audits; both report zero advisories. Update recovery instructions, Node 24/CI requirements, known issues, and progress evidence.
- [x] Independently review maintenance. Keep remaining save-status UI, final-edit debounce limitations, and real-device acceptance visible in later tasks.

**Acceptance met locally:** Maintenance has [fresh evidence](../../phase-3/progress/2026-10-06-reliability-maintenance.md), unsafe imported/stale data is protected, and browser/production checks are enforceable. Remote CI/deployment and real-device acceptance have not run. Changes remain uncommitted for takeover/review.

## Task 1: Validate the Authoring and Print Direction

**Files:** Create `docs/superpowers/specs/2026-10-06-overhaul-prototype-results.md` and prototype/evidence assets alongside it. Keep prototypes outside production modules. Update the overhaul spec/this plan when evidence changes a decision.

**Interfaces:** Produce a recorded flow with exact screen states: blank/example start, library choice, active step, picker, details, ordering, reader, and output preset. Produce real-size fixtures for the four presets and the selected initial library inventory.

- [ ] Prepare two three-step examples: a repetitive kitchen/workplace task and a familiar learning/daily routine. Include a warning, optional text, and a label; recipes are one content type.
- [ ] Prototype the semantic step list, nearby Add picture, and phone bottom sheet. Compare the sheet with inline editing on the same task; record focus, software-keyboard visibility, selection, and return to the step.
- [ ] Show the 50 × 30 mm label, A6 card, A4 guide, and A3 guide at actual size. Check minimum sizes and hierarchy at intended viewing distances.
- [ ] Observe workplace creators/recipients and teacher/parent/child participants using their customary support. Record symbol interpretations, help needed, mistakes/recovery, and relevant label languages.
- [ ] Set initial library inventories from those tasks, retain useful shared verbs, and record the result. Avoid adding symbols merely because a stock icon exists.
- [ ] Review evidence and finalized screen/output choices before implementing Tasks 2–6. Production implementation of the overhaul is a later step.

**Acceptance:** The path/formats have concrete evidence, supported-use limitations are stated, and later implementers do not invent the flow or inventory.

## Task 2: Introduce Searchable Libraries Without Breaking Documents

**Files:** Create `src/model/library.ts`, `src/data/libraries/recipe.ts`, `routines.ts`, `learning.ts`, `index.ts`, `src/lib/library-catalog.ts`/tests, and `docs/content-libraries.md`. Modify `src/data/icon-library.ts`, `src/data/sample-tokens.ts`, `src/components/TokenPicker/TokenPicker.tsx`, and `src/state/ui.ts`.

**Interfaces:** Define `LibraryEntry` with `iconId`, current `TokenCategory`, per-locale `labels`/`aliases`, and category membership. Define `ContentLibrary` with `id`, `name`, `entries`, and attribution. Export `CONTENT_LIBRARIES`, `getLibrary(id: string): ContentLibrary | undefined`, `findLibraryEntries(library: ContentLibrary, query: string, locale: string, category?: TokenCategory): LibraryEntry[]`, and the existing global `iconMarkup(iconId)` contract. Active library/locale are UI state.

- [ ] Write failing `library-catalog.test.ts` cases for legacy `object.onion` resolution, unique new IDs, shared entries across palettes, locale aliases, and explicit empty search results. Include unknown artwork and a mixed-library document.
- [ ] Run `npm test -- src/lib/library-catalog.test.ts`; confirm the new expectations fail before implementation.
- [ ] Implement registry/search, expose existing recipe defaults through the recipe library, and bundle the two validated inventories. Retain old IDs; namespace new library-specific IDs with the library ID.
- [ ] Replace misleading high-use artwork in the existing SVG language. Record viewBox/source/license metadata and preserve inline paths. Test meaning with the Task 1 recipients/examples.
- [ ] Add named library/category/search controls and a no-results message. Palette changes affect future choices only. Inserted labels become authored text; locale changes do not rewrite them.
- [ ] Run unit/type/lint checks and `npm run test:browser`. Assert one keyboard/tap inserts one symbol, switching libraries preserves document/history/selection, and unknown artwork has a visible named fallback.
- [ ] Review and commit the delivery with fixtures and license records.

**Acceptance:** Several usable libraries work offline, recipes round-trip unchanged, and library choice cannot remove or relabel placed content.

## Task 3: Build Physical Composition and Readable Text

**Files:** Create `src/model/output.ts`, `src/lib/output-plan.ts`/tests, `src/lib/text-layout.ts`/tests, `src/data/print-fonts.ts`, `public/fonts/` with source/license records, and `src/lib/output-svg.ts`/tests. Modify `src/lib/pdf-pagination.ts`/tests where its whole-step contract is superseded.

**Interfaces:** `OutputOptions` carries preset, mm dimensions, orientation, mode (`labels`, `pictures`, `detailed`), selected step IDs, metadata visibility, background, and label-sheet settings. `TextMeasurer(text: string, fontSizePt: number, fontId: string): number` returns width in mm. `planOutput(doc: InstructionDocument, options: OutputOptions, measure: TextMeasurer): OutputPlan` returns ordered physical pages, positioned text/symbol fragments with source IDs, and blocking issues. `renderOutputPage(page: OutputPage): SVGSVGElement` renders globally resolved vector artwork and escaped authored text for Preview/export. Geometry is in mm; font sizes are in pt.

- [ ] Write failing output-plan fixtures for all exact preset dimensions, viewport independence, minimum label sizes, a 20-symbol step, and 85-symbol continuation. Assert selected token IDs occur exactly once across continuation fragments and every fragment stays within page bounds.
- [ ] Add long-title/18-wide-letter/German-label, empty, and unknown-icon fixtures. Assert Detailed includes notes/descriptions; other modes omit only declared optional text; warnings/quantities/times remain. An impossible label returns a named step/format issue, without a clipped page.
- [ ] Run `npm test -- src/lib/output-plan.test.ts src/lib/text-layout.test.ts`; confirm failures before implementing contracts.
- [ ] Implement measured wrapping and physical composition. A4/A3 break at row boundaries, repeat step context, and retain minimum sizes. Labels/cards block overflow. Keep warning/quantity attachments associated with their symbols.
- [ ] Add licensed offline fonts and coverage preflight. Verify actual metrics/glyphs for English, German/Latin accents, and Japanese. Record supported scripts and reject unsupported glyphs before download. Advertise right-to-left support only after rendered shaping/direction checks.
- [ ] Implement `renderOutputPage` with physical dimensions, text nodes, and inline paths. Assert title/time/background and selected content belong to the composed page; authored text cannot inject markup.
- [ ] Run focused/full unit checks. When Task 6 connects export, render the four real-size fixtures plus long/unicode/85-symbol PDFs and inspect glyphs/completeness beyond page counts/signatures.
- [ ] Review and commit the composition/font interfaces together. Font preparation failures must be actionable before returning a downloadable plan.

**Acceptance:** Physical layout meets minimums, preserves content/order, wraps by measurement, and reports unsupported text/impossible small formats. It replaces global shrinking and clipped oversized steps.

## Task 4: Deliver One Simple Responsive Editor

**Files:** Create `src/components/InstructionEditor/InstructionEditor.tsx`, `EditorStep.tsx`, `EditorToken.tsx`, `src/components/AuthoringPanel/AuthoringPanel.tsx`, and `src/state/authoring.ts`. Modify `src/app.tsx`, `src/styles/global.css`, picker/details, and `src/state/document.ts`/tests for selection-retaining moves. Retain existing canvas/pointer paths until replacement coverage passes.

**Interfaces:** Components consume the existing `DocumentSession` and its actions. `AuthoringPanelState` is `closed`, `picker(stepId)`, or `details(stepId, tokenId)` with an opener focus target. Panel/filter changes do not edit the document. Moves preserve ID/selection and form one undoable edit. Pointer preview/commit consume the same explicit `{ stepId, index }` destination; screen measurements never drive output planning.

- [ ] Add failing browser fixtures at 320, 390, 768, and 1440px for empty, five-step, and 20-symbol documents. Assert 44 × 44px controls, 16px text, unchanged short-step scale, and Add picture beside the active step.
- [ ] Add keyboard-only creation/order/destination/undo/redo cases. Assert retained focus/selection after moves, disabled boundary moves, and no history edit from library or panel navigation.
- [ ] Implement the Task 1 flow with a semantic ordered HTML step list and vector symbols. Direct tapping selects the item. Show predictable basic actions and a deliberate More details path.
- [ ] Implement Close/Escape, focus containment where modal, focus return, and software-keyboard-safe panel positioning. Reveal insertion results without unnecessarily resetting category/search.
- [ ] Add non-drag ordering/destination controls first, then drag shortcuts with marker/commit agreement, step landing feedback, edge auto-scroll, and selection retention. Avoid nested interactive elements.
- [ ] Show actual saving/saved/error/conflict status from persistence events. Saved means a completed write, not a scheduled debounce. Retain export/recovery guidance until resolved.
- [ ] Run unit/type/lint/browser gates. Test 200% text zoom, reduced motion, scroll versus drag, rotation, and keyboard-height viewport; review with keyboard and supported participants.
- [ ] Review and commit; remove obsolete authoring paths only after equivalent replacement coverage passes.

**Acceptance:** Creators make/rearrange five steps using nearby tap/keyboard controls with stable readable content and recoverable mistakes. Child-supported usability is recorded, not inferred from button size.

## Task 5: Provide Recipient Reading and Exact Print Preview

**Files:** Create `src/lib/instruction-reading.ts`/tests, `src/components/InstructionReader/InstructionReader.tsx`, `src/components/OutputPreview/OutputPreview.tsx`, and `src/components/OutputDialog/OutputDialog.tsx`. Modify `src/app.tsx`, `src/state/ui.ts`, and styles; replace inaccessible Preview semantics.

**Interfaces:** `toReadingSteps(doc: InstructionDocument, mode: OutputOptions['mode']): ReadingStep[]` returns ordered steps/tokens with source IDs, names, attachments, and mode-selected full text. OutputPreview consumes Task 3's `OutputPlan`. Output settings/zoom are UI state and do not alter history. The dialog shows dimensions/pages, mode, omitted optional text, and blocking issues before download.

- [ ] Write failing reading fixtures for title/order, warning/quantity/time, Detailed notes/descriptions, visually hidden labels with accessible names, unknown symbols, and mixed libraries. Assert every chosen information item appears in semantic order.
- [ ] Run `npm test -- src/lib/instruction-reading.test.ts`, confirm failure, then implement transformation and the ordered semantic reader.
- [ ] Add Read / Back to editing with focus restoration. Provide all three visual modes; hiding a visual label must preserve the symbol's accessible name.
- [ ] Build preset/custom size, orientation, selected steps, white/transparent background, metadata, and label-sheet settings. Show overflow/font issues with affected step and larger-size/smaller-step recovery actions.
- [ ] Render through `renderOutputPage` with dimensions/page count and viewing zoom. Keep viewing zoom separate from output size; physical printing uses 100% actual size.
- [ ] Run unit/browser gates. Inspect accessibility content and actual supported screen-reader reading for the audit's missing labels/details; check dialog focus/zoom and return to the unchanged editor.
- [ ] Review and commit reading/preview.

**Acceptance:** Recipients access meaning/order, creators know which optional text is included, and Preview reflects the exact export pages.

## Task 6: Connect Consistent Formats and Offline Output

**Files:** Modify `src/lib/svg-export.ts`/tests, `src/lib/png-export.ts`, `src/lib/pdf-export.ts`/tests, `src/lib/document-actions.ts`/tests, export evidence tooling, and production PWA tests. Update offline generation/SW when fonts/artwork require it.

**Interfaces:** Exporters consume `OutputPlan` and `renderOutputPage`. PDF places each page at its mm size without rasterizing pictograms. PNG dimensions are `round(widthMm / 25.4 * dpi)` and the equivalent height, offering 150/300 dpi. Multi-page SVG/PNG provide numbered page downloads with visible count; PDF includes every page. JSON remains the full authored document. Export failure returns a readable result before success is reported.

- [ ] Write failing export fixtures for heading/time parity, mode-selected text, backgrounds, exact physical size, all selected IDs, fonts, long labels, label overflow, and 85-symbol continuation. Assert PDF/SVG pictograms remain vector, PNG dimensions match density, and requests above 24 million pixels return an actionable issue before allocating a canvas.
- [ ] Run focused tests and confirm failure before wiring the plan. Preserve heading/viewport regression coverage until equivalent replacements are proven.
- [ ] Connect SVG/PNG/PDF to the common renderer, embed PDF fonts, and verify supported glyphs/shaping. Offer each numbered SVG/PNG page explicitly so browser download restrictions cannot silently lose pages.
- [ ] Open/render downloaded files independently. Compare Preview/PDF/SVG/PNG content and inspect boundary rows/text, rather than relying on signatures/screen-scale snapshots.
- [ ] Extend `npm run test:pwa` for a fresh controlled build with no prior export, then export offline using every initial library and supported fonts. Repeat after an update; errors fail the gate.
- [ ] Run all maintenance/unit/browser/build/PWA gates and review bundle/font/offline storage cost. Keep export/font execution out of initial startup while retaining offline preparation.
- [ ] Review and commit with representative exported fixtures and supported-language records.

**Acceptance:** Formats represent the same chosen physical content, work outside the app, retain all continuation rows, and support first-use output after the installed build is ready offline.

## Task 7: Validate Practical Use and Hand Over the Release

**Files:** Update the manual checklist, `docs/milestones.md`, `docs/known-issues.md`, progress logs, and maintainer/recovery instructions. Store print/device/participant evidence in `docs/phase-3/audits/`.

**Interfaces:** Results record task/fixture, participant context/support, device/browser/version, physical format/viewing distance, observed result, help required, and unresolved severity. Link evidence; automation counts do not establish child usability or complete accessibility.

- [ ] Run paired workplace creator/recipient and teacher/parent/child routine tasks. Compare labelled/symbol-only meaning, similar-artwork confusion, sequence direction, and warning interpretation.
- [ ] Run five-step creation on real iOS Safari, Android Chrome, desktop keyboard, and supported screen readers. Include zoom, software keyboard, rotation, interrupted saving, conflict/recovery, JSON round trip, and offline update.
- [ ] Print labels/A6/A4/A3 at actual size, including grayscale, long/unicode text, details, and continuation. Verify the smallest intended label and real viewing distance.
- [ ] Fix release blockers and repeat affected checks. Record remaining limitations, owners, and follow-up triggers. Fractional quantities require a separate tested model decision if practical kitchen tasks need them.
- [ ] Run release gates from a locked clean install and record exact results. Update milestones against the new release scope; do not close historic Phase 3 tasks solely because the UI changed.
- [ ] Review and commit evidence/runbook. Integrate/publish through the chosen release process only when separately authorized.

**Acceptance:** Maintainers reproduce checks, creators/recipients have tested practical use/output, and supported languages/devices/limitations and recovery are explicit.

## Recommended First Overhaul Delivery

Validate a three-step kitchen reminder and a three-step familiar routine using the simple creation prototype and actual-size label/A4 prints. This establishes editor, symbols, and output together. Keep the verified maintenance gates passing through every delivery.
