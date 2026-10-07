# Task 0 independent implementation review

Date: 2026-10-06. Reviewed range: `d995178..989b378` (`feat: publish visual guide schema and shared contracts`). This is the scoped foundation task gate, not an approval of the complete overhaul.

## Review basis and verification

Read the Task 0 brief, global constraints, shared contract specification 00, implementer report, and supplied diff. Read the diff file once. Inspected the changed files at the fixed reviewed head through `git show` where needed to confirm complete types and exact line references. The only unchanged implementation inspected was the existing history, selection, insertion, and equality helpers directly called by the new session operations; the named risk was preservation of immutable history and final-index behavior.

The implementer reports 201 focused tests, 338 full tests, successful typecheck/lint, and a clean diff check. Those commands were not repeated: the finding below is established directly by the reviewed source and the frozen catalog IDs, and does not require another test run. No production files, index, branch, or commits were modified by this review. This report is the sole review artifact written.

## Strengths

- Migration validates presentation explicitly, preserves recognized reserved v1 values, rejects malformed/future schemas, and retains unknown fields during the existing legacy quantity repair. The added tests cover non-mutation, authored empty strings, unknown data, and v1/v2 behavior.
- The new move operation uses a post-removal index, guards stale/no-op requests before history mutation, retains the original token object, and batches selection into the destination. The existing pre-removal move action remains available.
- Opening another guide clears past/future history, clipboard, selection, and coalescing state in one batch. `documentSession` is the sole default instance behind existing bound exports.
- The shared output projection centralizes mode omissions, retains authored accessible labels, clones attachment objects, and distinguishes explicit-only board group timing from sequence timing. The tests cover empty versus absent text and source isolation.
- Shared catalog/preferences/repository/output types match the frozen shapes. Re-exporting content projection types from `lib/output-content.ts` preserves its specified consumer seam without creating another type or policy.

## Spec-compliance verdict

**With fixes.** The production schema, migration, validation, session, and projection contracts meet Task 0. The required fixture deliverable is not yet a faithful downstream integration input: its supposed known pictures and attachments use IDs absent from the specified catalogs.

### Important finding — use canonical artwork IDs in shared integration fixtures [P2]

**Primary location:** `src/test/fixtures/overhaul.ts:33-35`. Related locations: `src/test/fixtures/overhaul.ts:14-19`, `24-28`, `40`, and `src/test/fixtures/overhaul.test.ts:27-28`.

`mixedLibraryFixture()` uses `onion`, `wash-hands`, and `book`, but the frozen inventories use `object.onion`, `routines.action.wash-hands`, and `learning.object.book`. The consumer test explicitly expects the incorrect IDs. The sequence, board, and long-group builders also use noncanonical `knife`, `quantity`, `warning-sharp`, `clock`, and `play` references.

Unknown IDs are deliberately structurally valid, so successful migration and the current fixture test do not detect this. Once the catalog implementation arrives, the mixed-library fixture will exercise three unknown fallbacks rather than three known libraries. The print/stress fixtures will likewise exercise fallback names/geometry instead of the intended artwork and known warning/quantity/time attachments. This leaves the shared fixture acceptance and downstream boundary unfulfilled despite green foundation tests.

**Minimal correction:** use the specified canonical IDs throughout fixtures intended to contain known artwork: `object.onion`, `routines.action.wash-hands`, `learning.object.book`, `learning.action.play`, `quantity.amount`, `warning.sharp`, and `time.duration`. For the first sequence picture, use a canonical action such as `action.chop`, or use `tool.knife` with category `tool`; do not pair a knife tool ID with category `action`. Update the exact fixture assertions accordingly. Preserve intentionally unknown IDs in the separate projection/migration cases that test unknown handling. Once Task 1 is integrated, its catalog integration checks should assert these shared known fixture references resolve.

Specification basis: 00's foundation acceptance requires mixed-library/shared output fixture builders. 01 defines these canonical IDs and one category/meaning per ID; unknown fallback compatibility is a separate case, not a substitute for known mixed-library coverage.

## Task-quality verdict

**With fixes.** The production change is focused and uses the existing engine rather than introducing a second session or content policy. Tests cover meaningful boundary behaviors, including no-op redo preservation, independent sessions, fresh coalescing after opening, and projection isolation. No separate production defect was found in the scoped review. The P2 fixture issue is also a test-quality gap because its assertion locks in the wrong integration input; correct it before publishing Task 0's fixture handoff to dependent workers.

The authorized expanded files are narrowly changed: the canvas fixture now accepts nonempty object-only content while retaining empty-group advisory assertions, and document actions remove only obsolete missing-action copy. No unauthorized production expansion was found.

## Behaviors considered and set aside

- Legacy canvas numbering and guide totals for boards: replacing the legacy authoring/output consumers belongs to later packages. The explicitly preserved `documentTotalTime(steps)` signature has no presentation input. Task 0 correctly provides board-aware shared group projection; downstream reader/composer owners must suppress board guide totals as specified.
- Runtime catalog search/artwork/warning-meaning resolution and bilingual control rendering: Task 1/3 responsibilities. Task 0 publishes their model and projection seams; it is not expected to implement those consumers.
- Repository persistence/reload/tombstone operations and physical font/layout/export/offline behavior: subsequent package responsibilities. This task publishes their types, not their runtime implementations.
- Physical, participant, and real-device usability evidence: release acceptance work, outside this foundation gate.

## Gate recommendation

Hold the downstream fixture handoff until the canonical IDs and their pinned expectations are corrected. Run the focused fixture tests plus typecheck for that correction; broader checks are needed only if production changes are made or another concrete failure appears. Then a narrow delta review can clear Task 0. No new product decision is required.

## Narrow fix review — approved at 2338176

Reviewed only the supplied `989b378..2338176` delta and the appended fix evidence. The changes are confined to the two shared fixture files. All previously noncanonical known picture/attachment references now match specification 01: sequence action/category, onion, board book/play, mixed-library wash-hands, quantity, warning, and duration. Long-group and unsupported-text fixtures inherit correct known artwork while keeping their intended stress content. Intentionally unknown migration/projection cases are unchanged.

The new fixture assertion covers IDs and matching categories across every builder; the existing mixed-library assertion is corrected. Deterministic source IDs, fresh builder results, schema, times, authored labels, and unsupported Japanese text are preserved by the delta. No regression caused by this correction was found.

The author records two expected RED fixture assertion failures, then two passing focused fixture tests, successful typecheck, and a clean diff check. No concrete doubt justified repeating these checks, so none was rerun.

**Updated spec-compliance verdict: Approved. Updated task-quality verdict: Approved.** The prior P2 finding is resolved, and Task 0's contracts/fixture handoff may proceed. Actual catalog resolution remains the already assigned Task 1 integration check, rather than a reason to keep this foundation gate open.
