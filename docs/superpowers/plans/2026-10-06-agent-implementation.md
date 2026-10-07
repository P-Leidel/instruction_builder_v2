# Visual instruction overhaul agent implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Product implementation starts after this specification package and plan have been reviewed.

**Goal:** Deliver an intuitive bilingual visual-instruction app with three original-vector libraries, local saved guides, sequences/choice boards, and reliable output from labels to large prints.

**Architecture:** Retain one Preact/signals document engine and global artwork resolver. Publish shared schema/session/content/catalog/storage/output contracts first. Independent catalog, repository, and physical-composition modules feed a semantic responsive editor and one renderer/export pipeline; one integrator owns app wiring.

**Tech Stack:** TypeScript, Preact, signals, native HTML/SVG, IndexedDB/idb-keyval, jsPDF/svg2pdf, Vite, Vitest, Playwright, static PWA. Use Node 24 and the locked dependencies; a font-proof dependency is added only when the proven strategy needs it.

**Spec:** [Package index](../specs/2026-10-06-overhaul/README.md), [shared contracts](../specs/2026-10-06-overhaul/00-shared-contracts.md), and the package linked by each task. This plan supersedes the earlier broad [finishing sequence](2026-10-06-app-finishing.md).

**Execution status:** User authorized agent implementation on 6 October 2026. Tasks 0–5 have passed independent review and final automated integration gates. Task 6 scripts/print preparation/checker corrections and final handoff/evidence are independently approved, including the scoped A3 proof at `f382c0f`. Participant, physical-print and real-device/screen-reader acceptance remains pending. The [implementation report](../../phase-3/audits/2026-10-06-overhaul/implementation-report.md) and [technical acceptance record](../../phase-3/audits/2026-10-06-overhaul/technical-acceptance.md) track evidence. Checked entries name completed local technical work; the unperformed practical acceptance entry remains open. Nothing from this run is pushed, merged or deployed.

## Global constraints

- Kitchen, Daily routines / workplace, and Learning / classroom are required, with English/German controls and default labels, original vector artwork, and local My guides.
- Schema **2** persists `meta.presentation: "sequence" | "board"`; v1 imports default to sequence. Palette/locale preferences never rewrite authored content or become document domain.
- Controls are at least **44 × 44 CSS px**; ordinary authoring text is at least **16 CSS px**. Verify **320 CSS px** and **200% text zoom**, and a **20-picture** group without global shrinking.
- Label/card/sheet/large presets are **50 × 30**, **105 × 148**, **210 × 297**, and **297 × 420 mm**. Custom dimensions accept **20 to 1000 mm**.
- Print labels start at **10 pt**, secondary text **9 pt**; A6/A4 pictures at least **15 mm**, A3 **25 mm**. Package 04 defines the larger-format and compact-label starting values.
- PNG supports **150/300 dpi**, capped at **24 million pixels per page** before allocation. SVG/PDF retain vector pictograms. Output failures are explicit; no clipped/partial downloads.
- Preserve import repair/unknown fields, stable IDs, arbitrary quantity units, integer quantities/durations, history, local recovery, transactional stale-tab protection, and offline cold export/update safety.
- Other scripts stay editable; unsupported rendered glyphs block output. Japanese is a negative preflight fixture, not a promised supported font language.
- Accounts/cloud, automatic translation, uploaded artwork, fractional quantities, arbitrary placement, and speech-generation/AAC systems are outside this release.

## Review focus

- A guide-switch save racing an in-flight older edit must preserve the latest snapshot and isolate history; Task 2 owns the navigation/write-drain fixture.
- Picture-only boards must retain unordered intent after JSON import/local reload without procedural arrows or summed alternative durations; Tasks 0, 3, and 4 own those fixtures.
- Unsupported text omitted in the chosen mode must not block, while actually rendered unsupported text must never download corrupt glyphs; Tasks 0, 4, and 5 own the mode/preflight fixtures.
- A 25th label or 85-picture group must keep every main source once, with physical bounds and continuation context correct; Tasks 4 and 5 own the pagination fixtures.
- A production update must preserve old clients' lazy export/font assets, while fresh first-use export works offline; Tasks 5 and 6 own cold/update fixtures.

## Agent ownership and sequence

| Wave | Task | Sole ownership |
| --- | --- | --- |
| 1 | 0 Contracts and content policy | Shared model files, migration/validation/session, content projection, fixture builders |
| 2 | 1 Catalog and graphics | Catalogs/artwork/resolver/Icon/localization/unit suggestions |
| 2 | 2 Local guides | Repository, persistence/controller/preferences, recovery documentation |
| 2 | 4A Font proof and composition | Prepared fonts/adapters, physical options/text metrics/layout; artwork tests integrate after 1 |
| 3 | 3 Editor and reader | App/main/shared UI/global CSS, My guides, picker/details, editor/reader; depends on 1–2 |
| 3 | 4B Composition integration | Finish artwork/content fixtures and frozen successful plans; depends on 1 and 4A |
| 4 | 5 Preview and formats | Output components, renderer/export files, public offline assets/PWA fixtures; app wiring goes through 3 |
| 5 | 6 Release integration | Browser/tooling/CI/docs/evidence and fresh whole-change review |

Tasks 1, 2, and 4A can run concurrently after 0. Wave labels express dependencies, not time estimates. No two workers edit `app.tsx`, `main.tsx`, `state/ui.ts`, global styles, shared model contracts, or the same browser scripts concurrently. Catalog ownership includes message files; consumer workers request keys until its delivery is integrated, then the integrator owns subsequent message additions.

In a shared checkout, assign explicit file ownership and serialize integration. Separate worktrees must start from a snapshot that includes the current uncommitted maintenance; the base Git commit alone does not contain those fixes. Do not silently abandon that work when spawning implementers.

Each agent receives the package index, shared contracts, its task/spec, dependency results, and owned-file list. Return changed files, actual test commands/results, artifacts, and unresolved decisions. A fresh reviewer checks task scope and invariants before dependent work uses it. A final independent reviewer checks the complete app.

## Task 0 — Publish contracts and document behavior

**Files:** `src/model/instruction.ts`, `migrate.ts`/tests, `validate.ts`/tests, `src/state/document.ts`/tests; create `src/model/library.ts`, `preferences.ts`, `guide.ts`, `output.ts`, `src/lib/output-content.ts`/tests, and `src/test/fixtures/overhaul.ts`.

**Interfaces:** Exactly [00](../specs/2026-10-06-overhaul/00-shared-contracts.md), including `documentSession`, `openDocumentInSession`, `moveTokenTo`, catalog/guide/output types, and `projectOutputContent`. No extra running session or second optional-text policy.

- [x] Add failing tests named `migratesV1ToSequence`, `roundTripsBoardV2`, `rejectsInvalidPresentationAndFutureSchema`, `acceptsObjectOnlyGroups`, `moveUsesFinalIndexAndRetainsSelection`, `openingGuideClearsHistory`, `projectionSelectsOptionalText`, and `boardDoesNotSumTimedAlternatives`. Assert schema 2, exact retained IDs/fields/unknown data, one undo per real move, zero undo/paste content from another guide, structured attachments in every mode, and no 15-minute group/guide sum for 5/10-minute board alternatives.
- [x] Run `npm test -- src/model/migrate.test.ts src/model/validate.test.ts src/state/document.test.ts src/lib/output-content.test.ts`; confirm the new cases fail for the missing behavior, rather than unrelated setup errors.
- [x] Implement the named contracts and fixture builders. Keep old pre-removal actions compatible; do not weaken import validation or quantity repair to accommodate v2.
- [x] Run focused tests, `npm test`, `npm run typecheck`, and `npm run lint`. Review schema snapshots/projection fixtures against 00 and publish the interfaces to the other owners.
- [x] Review the task independently and commit only its owned changes once integration/commit workflow is selected.

**Acceptance:** Dependent agents can import one stable model and content policy; v1/v2 JSON and session invariants are pinned by tests.

## Task 1 — Deliver original libraries and bilingual text

**Files/spec:** [01 Libraries and graphics](../specs/2026-10-06-overhaul/01-libraries-and-graphics.md) owns exact catalog/artwork/i18n/unit files.

**Consumes:** 00 catalog/preferences types. **Produces:** `CONTENT_LIBRARIES`, exact catalog/resolver exports, typed `t`, suggested-unit helper, complete inventories/provenance.

- [x] Add catalog tests asserting all **84** legacy Kitchen IDs/order/English labels, every specified routines/learning/shared entry, complete en/de label/alias keys, canonical cross-library identity, and named fallback. Add search cases for `Kühlen` / `kuhlen`, no results, selected-language aliases, and stable category order.
- [x] Add localization key/parameter parity and arbitrary-unit fixtures; run the exact focused tests in 01 and confirm failure before implementation.
- [x] Implement canonical catalogs/search, original artwork and compatibility adapters, typed whole-message localization, suggested units, and the three fresh-ID localized examples in 01. Produce contact sheets for every offered picture; do not pass structural vector checks with semantically wrong placeholders.
- [x] Run focused/full unit/type/lint/build gates. Hand off integration keys and contact sheets; record actual artwork/license provenance and pending recipient-comprehension results.
- [x] Fresh review, resolve issues, then commit owned changes through the selected workflow.

**Acceptance:** All three offline palettes have complete original artwork and bilingual defaults; existing documents continue resolving their stored IDs.

## Task 2 — Add reliable local My guides

**Files/spec:** [02 Local guides](../specs/2026-10-06-overhaul/02-local-guides.md) owns repository/persistence/controller/preferences.

**Consumes:** v2 document and `GuideRepository`/`GuideWriteResult`/session-opening contracts. **Produces:** `createGuideRepository`, `initializeGuides`, guide/preference signals/actions and documented storage migration.

- [x] Add the named transactional tests in 02, especially two-tab first migration, altered same-revision baseline, independent guide saves, a newer edit during an in-flight switch, backup failure, malformed envelope isolation, tombstone stale-save protection, and explicit conflict reload that adopts the winner without a stale flush.
- [x] Run `npm test -- src/lib/guide-repository.test.ts src/state/guides.test.ts src/state/preferences.test.ts src/state/persistence.test.ts`; reproduce intended failures first.
- [x] Implement per-guide records, atomic/idempotent legacy migration, exact recovery copies, serialized save draining, truthful statuses, preference storage, and operations from 00. Disable the old observer before enabling the new one.
- [x] Run focused/full gates and real IndexedDB reliability fixtures. Adapt maintenance assertions to the new keys while preserving their safety properties.
- [x] Hand off empty-list/new-draft/open/import/delete/restore/conflict integration examples and recovery instructions; fresh review and commit owned changes.

**Acceptance:** Several local guides work without lost edits, cross-guide Undo, stale overwrite, or destruction of unreadable legacy work.

## Task 3 — Build the responsive editor and reader

**Files/spec:** [03 Editor and reader](../specs/2026-10-06-overhaul/03-editor-and-reader.md) owns application integration and its exact components/state.

**Consumes:** Document actions/session, catalog/t/preferences, guide controller, shared content projection. **Produces:** My guides, contextual authoring, non-drag ordering, sequence/board views, semantic reader, and integration slots for 05.

- [x] Create a lightweight three-step workplace example and three-step familiar routine prototype using the reviewed flow. Record phone sheet/desktop panel behavior and actual-size output samples when 04 is available; request feedback on observed issues without blocking independent foundation work.
- [x] Add failing browser fixtures at **320/390/768/1440 px** for five groups and a 20-picture group; assert **44 px** controls, **16 px** text, local Add picture, and no global shrink. Add keyboard creation/move/undo/read/return, picker captured-target, modal/nonmodal focus, My guides switch/delete/recovery, and board semantics.
- [x] Add `instruction-reading.test.ts` fixtures for authored accessible names in Pictures-only, required attachments, Detailed text, unknown/mixed artwork, unknown warnings with/without labels retaining warning context, and unordered board meaning. Run focused browser/unit cases to confirm failure.
- [x] Implement 03's simple flow, long-text fields/custom units, status/recovery, local-guide actions, focus and reader. Use `moveTokenTo`; add drag only after non-drag ordering passes.
- [x] Run unit/type/lint/browser gates and inspect 200% text zoom and emulated viewport/scroll behavior; actual software-keyboard acceptance remains Task 6 practical work. Integrate 02 startup once; preserve existing global shortcuts and ensure no hidden export/editor controls leak into reading.
- [x] Fresh review and commit. Keep obsolete authoring/export paths until equivalent coverage and Task 5 parity are demonstrated.

**Acceptance:** A creator can build/rearrange/read five groups without precision dragging, with recoverable mistakes and truthful saving.

## Task 4 — Prove fonts and compose physical pages

**Files/spec:** [04 Physical layout](../specs/2026-10-06-overhaul/04-physical-layout.md) owns font/adapters/options/metrics/planning.

**Consumes:** Frozen content/output types and global resolver. **Produces:** `prepareFonts`, three font-adapter functions, `planOutput`, normalized physical options, fixture plans, font proof/provenance.

- [x] **4A:** Build a narrow font proof with one licensed Latin TTF, minimal SVG and existing conversion libraries before a complete output renderer exists. Prove measurement, independently opened SVG, SVG-to-image PNG, vector PDF, and first-use offline output with German accents/ß/punctuation. Select embedded text or vector outlines from passing evidence; report a blocker if neither passes.
- [x] Add failing option/text/layout fixtures for every preset, orientation, **24/25** label cells, selected IDs/order, invalid dimensions/grids, 18-wide-letter/long German text, a 20-picture group, an **85-picture** continuation, and whole-label/card overflow.
- [x] Add mode/glyph cases asserting unsupported Japanese visible text blocks with source details while an omitted Japanese note does not. Assert board numbers/totals/connectors absent, every main token exactly once, every fragment/attachment inside bounds, and labelled/unlabelled unknown warnings retain their warning role in every mode.
- [x] Run focused output/font tests and confirm expected failures. Implement measured wrapping, safe grapheme breaks, content regions, metadata/continuation, finite issues, and the exact adapters using the proven font.
- [x] **4B:** Integrate original catalog artwork after Task 1, rerun focused/full gates, and publish successful fixture plans and rendered font-proof artifacts for Task 5. Keep physical/participant readability conclusions pending.
- [x] Fresh review and commit owned code/assets/license evidence.

**Acceptance:** The planner is viewport independent, preserves required content at minimum sizes, and returns actionable failures instead of partial pages.

## Task 5 — Connect exact preview and export formats

**Files/spec:** [05 Export and preview](../specs/2026-10-06-overhaul/05-export-and-preview.md) owns its renderer/components/export/offline files; Task 3 alone wires the application.

**Consumes:** `OutputPlan`, prepared font adapters, shared projection/reader, library artwork. **Produces:** Exact `renderOutputPage`/file APIs, output dialog/preview, explicit numbered-page downloads, and offline output preparation.

- [x] Add failing renderer/export tests for exact mm dimensions, controlled styles, escaped text, backgrounds, no second PDF heading, complete selected roles/content, invalid page indices, and same-plan artifacts. Add stale async request/guide-switch and explicit page-download browser cases.
- [x] Assert PNG dimensions equal `round(mm / 25.4 * dpi)` at **150/300 dpi**; above **24 million pixels**, assert no raster allocation or download. Run focused tests and confirm failures.
- [x] Implement common renderer/files using 04's text adapters; connect snapshot-aware dialog, preflight/error/notices, exact preview and accessible projection, selected groups/modes/metadata, and JSON backup independent of rendering.
- [x] Update offline asset/font cache checks, including narrowly scoped `Vary: Origin`, cold first export in every format, and old-tab update safety. No force-activation cache deletion while old clients need assets.
- [x] With the integrator, run full unit/type/lint/tooling/build/browser/PWA gates. Open actual exported fixtures independently and inspect fonts/vector content/continuation rather than only signatures.
- [x] Fresh review, remove replaced hidden export canvas only after parity evidence, and commit owned changes.

**Acceptance:** Preview and downloaded formats contain the same physical pages, and first-use export works offline without data loss or corrupt text.

## Task 6 — Validate and hand over

**Files/spec:** [06 Release acceptance](../specs/2026-10-06-overhaul/06-release-acceptance.md) owns integration verification/evidence/docs.

**Consumes:** Completed packages and actual artifacts. **Produces:** Reproducible clean-install gate record, supported-use evidence, remaining limitations, and maintainer handoff.

- [x] Run the full integrated fixtures and clean-install commands in 06. Record new actual counts/results and build identity; never relabel maintenance evidence as overhaul evidence.
- [x] Independently review the whole change, focusing on migration/storage races, preserved authored data, semantic order, board meaning, font/artifact parity, and offline updates. Implementers resolve findings and rerun affected checks.
- [x] Prepare creator/recipient scripts, actual-size print files, and a results template for workplace and teaching contexts. Record pending human/device/physical checks explicitly until performed.
- [ ] **PENDING practical release acceptance:** perform authorized available participant/physical/real-device/screen-reader checks, fix observed blockers, and repeat affected tasks. Prepared materials are not observations. Agents cannot substitute emulation for this evidence.
- [x] Update milestones, known issues, README, support/font/artwork/recovery records, and handoff. Distinguish completed technical integration from practical release acceptance still pending.
- [x] Final review and commit evidence via the selected workflow. Deployment/merge/contacting participants remains separately authorized.

**Acceptance:** Maintainers can reproduce checks, recover local work, identify supported languages/devices, and see which practical release criteria have passed.

## Execution handoff

The authorized local implementation follows the checked deliveries above. Root serialized commits while workers implemented disjoint packages and independently cross-reviewed others' work. Use the [takeover report](../../phase-3/audits/2026-10-06-overhaul/implementation-report.md) and [technical acceptance](../../phase-3/audits/2026-10-06-overhaul/technical-acceptance.md) before changing a shared interface. Next agents work from recorded practical observations: preserve the shared session/planner and authored data, fix the affected controls/artwork/layout, add a focused regression and repeat the actual task/print/device check. The release remains local until separately authorized integration/deployment.
