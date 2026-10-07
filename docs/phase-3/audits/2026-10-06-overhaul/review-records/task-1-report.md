# Task 1 libraries, original pictograms and bilingual text

Date: 2026-10-06. Workspace: `D:\worktrees\8f23\instruction_builder`. Controller-supplied task base: `cfa9f4a`. Task 0 was independently approved before this work. No Git staging/commits, child agents or changes to another owner's files were performed.

## Complete deliverable

Published the exact package-00 catalog/search/resolver interfaces with 140 canonical meanings, matching every specified English/German label and category: 84 unchanged legacy Kitchen IDs/order/English labels, 24 Routines additions, 24 Learning additions, 6 shared choices, quantity and time. Palettes are ordered Kitchen, Routines, Learning; each orders its own inventory, shared choices, cross-library references. Offered counts are Kitchen 95, Routines 39, Learning 46. Quantity/time are canonical attachment meanings but excluded from palettes. Entries, locale labels/aliases, palette references and provenance references are frozen; cross-library references share object identity.

`findLibraryEntries` uses the selected locale only, NFKD/accent folding, case folding, trimmed/collapsed whitespace and all-query-word matching, filtering category first, deduplicating IDs and preserving source order. All specified aliases are seeded. `resolveIcon` resolves trusted bundled artwork independently of palette and preserves stored unknown IDs in a visible neutral rounded question tile. Both main and attachment IDs can use that tile. `getWarningMeaning` preserves nonblank authored warning text, otherwise a canonical warning label, otherwise the localized unknown-warning message, including for a non-warning catalog ID. Downstream consumers retain warning context and review notices. `__proto__`, `constructor` and `toString` are ordinary unknown IDs, never object-prototype lookups.

Authored every one of the 140 SVG sources as original geometric paths/primitives. No copied/traced stock artwork, generic food/utensil placeholders, imported SVG strings, fonts/text, remote references, bitmap images or effects. ViewBox is 0 0 24 24; presentation is fill none, currentColor stroke 2, round caps/joins. Actual browser geometry bounds were checked for all 140 against 2–22. Art and the neutral fallback are eagerly available from the same resolver; `Icon` remains decorative/aria-hidden and now renders unknown pictures as visible fallback. Preserved the legacy `iconMarkup`, viewBox/presentation, quantity/time constants, `SAMPLE_TOKENS`, category labels and `EU_FOOD_UNITS`. The old sample/unit compatibility tables themselves did not require mutation.

Published 168 complete typed whole-message keys in both locales, including categories/libraries, toolbar, local guides and conflict/recovery/backup messages, editor/reader/search states, dialogs/preferences, quantity/time/warnings, output/options/preflight/continuation, import and examples. `t` takes explicit locale and exact conditional parameter tuples, without reading any signal. Values interpolate as plain text and preserve user replacement-like text such as `$&` and German accents. En/de key sets and placeholders match. Negative compile fixtures prove unknown keys, missing params, wrong numeric params and params on a parameterless key fail type checking.

`getSuggestedUnits(libraryId, locale)` preserves Kitchen suggestions g/kg/ml/l/tsp/tbsp/pinch/pcs and offers pcs elsewhere. Dropdown labels localize; stored values never translate or normalize. Existing arbitrary-unit behavior and integer bounds remain intact. `createExampleDocument` supplies all three specified examples in both locales with fresh step/token IDs and creation time, schema-2 bare documents, localized authored titles/labels, descriptions/notes on sequences, and Sharp warning on the onion example's knife. Board intent survives JSON.

## TDD and verification evidence

Before implementing new production code, added the five focused test files. Executed:

`npm test -- src/lib/library-catalog.test.ts src/data/icon-library.test.ts src/i18n/messages.test.ts src/lib/quantity-units.test.ts src/data/guide-examples.test.ts`

Initial RED: **11 tests failed in 5 files** for missing catalog/search/warning/fixture-resolution APIs, missing typed messages/tables, missing unit/example helpers, reused unrelated stock food artwork (1 unique result instead of 19), and `iconMarkup("__proto__")` returning a prototype object. Missing modules were caught by explicit exported-function assertions to prevent unrelated setup failures. Final tests use ordinary static typed imports. First GREEN: all 11 passed after implementation. Added completeness/provenance/type fixtures and visual-feedback regression; final focused run: **14 tests passed in 5 files**, exit 0.

Root inspected all six contact sheets and identified Count's initial graph/statistics silhouette. Added the focused bead/frame regression and ran RED: 1 failure (4 chart dots versus 6 grouped beads), 3 passes. Replaced the artwork by an original abacus, regenerated sheets and ran GREEN. Root's delta screen review confirmed Count now reads as grouped counters and is distinct from a graph. This structural regression does not claim recipient comprehension.

`node docs/artwork/verify-vector-geometry.mjs` initially failed with actual out-of-bounds curves in beans, chicken, thermometer, drink and Stop. Corrected those source curves (no global scale or stroke changes); subsequent run passed with **all 140 actual rendered geometry bounds inside 2–22**. Regenerated all sheet SVGs/PNGs and visually re-inspected affected sheets 2/3/4/6.

Complete contact generation and rendering: both commands exit 0. The first direct-SVG screenshot attempt timed out in Chromium; the final reproducible PNG renderer wraps inline SVG in HTML and produces all six captures without that issue.

Latest full unit run after the final artwork corrections: `npm test` **401 tests passed in 31 files**, exit 0. Earlier full run while Task 4's planner was absent had 391 passing / 8 expected peer failures, all in `output-plan.test.ts`: continuation bounds; 24/25 label cells; overflow; required attachments/warnings; optional text glyph preflight; boards; selection/options; empty/unknown groups. Those peer failures are now green in the latest full run.

Typecheck/build integration history: a full `npm run typecheck` passed and `npm run build` passed (419 bundled modules, 16 offline assets) after initial artwork/keys were complete. Later final runs (after peers resumed edits) failed solely in peer files: unused `MmBox` in `src/lib/output-plan.ts:2`, and `lastDeletedGuide` missing in the mid-edit `src/state/guides.test.ts` at 150/152/155. No Task 1 diagnostics remained. Final `npm run lint` exited 0 with one peer unused-MmBox warning; an earlier post-fix lint run passed with no diagnostics. The controller has these precise findings and owns the integrated final gates; do not represent the latest full typecheck/build as green until peers settle.

`git diff --check` scoped to owned package files passed. Normal npm/browser subprocesses used authorized escalation. Browser/PWA product gates belong after editor/output integration; they were not claimed by this package. Geometry/contact-sheet Chromium checks are review tooling, not real-device/screen-reader or physical print evidence.

## Owned files

Modified: `src/components/Icon/Icon.tsx`, `src/data/icon-library.ts`.

Created: `src/data/catalog-entries.ts`; `src/data/libraries/kitchen.ts`, `routines.ts`, `learning.ts`, `index.ts`; `src/data/artwork-provenance.ts`; `src/data/guide-examples.ts` and its test; `src/data/icon-library.test.ts`; `src/lib/library-catalog.ts` and its test; `src/lib/quantity-units.ts` and its test; `src/i18n/messages.ts`, `en.ts`, `de.ts`, `messages.test.ts`; all 140 `src/assets/pictograms/<canonical-id>.svg` files; `docs/content-libraries.md`; the artwork artifacts/scripts listed below; and this report.

Preserved unchanged compatibility files in this ownership package: `src/data/sample-tokens.ts` and `src/data/units.ts`. No app/main/state/global CSS, repository, physical composition/font/export or other package files were edited.

## Exact integration seams and requested keys

- `src/data/libraries/index.ts`: `CONTENT_LIBRARIES: readonly ContentLibrary[]`.
- `src/lib/library-catalog.ts`: `getLibrary`, `getCatalogEntry`, `findLibraryEntries`, `resolveIcon`, `getWarningMeaning`, with exact package-00 signatures.
- `src/data/icon-library.ts`: existing compatibility exports retained; also `UNKNOWN_ICON_MARKUP` for the shared resolver only.
- `src/i18n/messages.ts`: `MessageParams`, `MessageKey`, exact generic `t(locale, key, ...args)` helper. Both message tables export `en`/`de` for parity verification.
- Storage's requested `guide.copyTitle` has `{ title: string }`.
- Physical planner keys requested and supplied exactly: `output.invalidOptions`, `output.emptySelection`, `output.fontUnavailable`, `output.formatLabel`, `output.formatCard`, `output.formatSheet`, `output.formatLarge`, `output.formatCustom`, `output.emptyGroup`, `output.unknownSymbolNotice`, `output.groupContext` (all undefined params); `output.overflow` `{ group: string; format: string }`; `output.unsupportedGlyph` `{ content: string; codePoints: string }`; `output.continuedGroup` `{ group: string }`; `output.sequenceGroup` `{ number: number; title: string }`; `output.totalTime` `{ duration: string }`; `output.warningContext` `{ meaning: string }`; `catalog.unknownSymbol` / `catalog.unknownWarning` `{ iconId: string }`.
- Other parameterized UI keys: `guides.deleteConfirm` `{ title: string }`; `editor.selection` `{ label: string }`; `editor.groupNumber` / `editor.stepNumber` `{ number: number }`; `reader.warning` `{ meaning: string }`; `catalog.noResults` `{ query: string }`; `catalog.reviewWarning` `{ iconId: string }`; `output.page` `{ number: number; total: number }`. All remaining keys in `MessageParams` are parameterless.
- `src/lib/quantity-units.ts`: `getSuggestedUnits(libraryId, locale): readonly UnitOption[]`.
- `src/data/guide-examples.ts`: `ExampleId` and exact `createExampleDocument(exampleId, locale): InstructionDocument`.

Reader/editor should use authored nonblank label then catalog localized meaning then `catalog.unknownSymbol`; hidden visual labels retain accessible meaning. Warning references use `getWarningMeaning` independently of fallback tile, with warning role/context/review notices. New UI owners may request further whole-message keys instead of adding a second table or concatenating fragments.

## Review artifacts and provenance

All paths are under `D:/worktrees/8f23/instruction_builder/`:

- `docs/content-libraries.md`: complete inventory, integration notes, semantic observations and pending evidence.
- `docs/artwork/inventory.json`: 140 ID/English/German rows.
- `docs/artwork/contact-sheets.html`: complete review index.
- `docs/artwork/contact-sheet-1.svg` through `contact-sheet-6.svg`: every canonical meaning, original source filename, bilingual labels and nominal grayscale 8/15/25 mm geometry.
- Matching `contact-sheet-1.png` through `contact-sheet-6.png`: complete rendered screen-review evidence.
- `docs/artwork/generate-contact-sheets.mjs`, `render-contact-sheets.mjs`, `verify-vector-geometry.mjs`: reproducible generation/render/bounds checks.
- `docs/artwork/LICENSE-STATUS.md` and `src/data/artwork-provenance.ts`: exact source/license/review status. Provenance ID `original-pictograms-2026-10-06` resolves every palette and canonical source path.

Actual license status is `LicenseRef-Original-Project-Work`, a factual status record, not an invented license or ownership grant. No established project distribution license was supplied. Root explicitly authorized recording this exact status while intended app/export/print use follows the user's overhaul request. The owner distribution-license decision remains a documented handoff.

## Self-review and remaining concerns

Reviewed canonical inventories against 01; projection fixture IDs resolve, all bilingual labels/alias keys are present, library order and cross-library identity are pinned, all 140 original drawings are bundled, and resolver prototype IDs safely use Maps. Reviewed whole-message parameters/locale isolation, untouched authored units, fresh example IDs/JSON board mode, compatibility exports and trusted SVG boundaries. Root performed independent screen review of all 140 meanings and cleared the corrected Count drawing. Final refreshed affected sheets were re-inspected.

Package implementation is complete. Current cross-package type/build diagnostics require the owning workers/controller's integration pass. Owner distribution licensing, supported-recipient comprehension (especially More/Finished/Help and quiet-space), actual grayscale prints, and calibrated 8/15/25 mm readability are pending release evidence. Screen review and structural bounds do not claim those human/physical results. There are no known placeholder artwork entries or unresolved Task 1 runtime asset dependencies.

## Independent review correction — round 1, German sharp-s

Read `task-1-review.md` before editing production. Its sole P2 finding was confirmed: Unicode NFKD plus lowercase does not case-fold German `ß`, so `HEISS` could not find the authored label `Heiß!`.

Changed only `src/lib/library-catalog.ts` and `src/lib/library-catalog.test.ts`, plus this report. Search normalization now folds `ß` to `ss` after lowercase, covering uppercase `ẞ` as well. Authored labels, aliases, canonical IDs, library order, and category policy remain unchanged. The regression pins German `HEISS` / `heiß` / `HEIẞ`, English locale isolation, warning/action category separation, multi-result `ẞ` and `SS` source order, and the unchanged stored `Heiß!` label.

Actual RED: `npx vitest run src/lib/library-catalog.test.ts` at 17:01:06 Europe/Berlin returned exit 1, 1 failed / 5 passed; the new `HEISS` expectation received an empty result rather than `warning.hot`. The broad sharp-s ordering expectation was completed to include existing `ss` spellings such as Messen/Wasser/Nüsse/Messer, which correctly share the folded match.

Actual GREEN: the same focused command at 17:01:47 returned exit 0, **6/6 passed**. `npm run typecheck` and `npm run lint` then both returned exit 0 with no diagnostics. No full suite/build/browser command was repeated for this isolated search correction, and no Git mutations were made. The original independent reviewer/root owns scoped approval and commit. Human/physical comprehension and owner licensing remain pending as previously documented; no new technical concern was identified in this correction.
