# Task 0 foundation implementation report

Date: 2026-10-06. Workspace: `D:\worktrees\8f23\instruction_builder`. Starting maintenance checkpoint: `d995178` (controller-provided baseline: 323 passing tests).

## Implemented contracts

- Document schema is now 2. `InstructionMeta.presentation` is required, and `createEmptyDocument(presentation = "sequence")` supports sequence and board creation with the existing empty-group/title/date behavior.
- `migrate(unknown)` upgrades valid v1 data to v2, defaults absent v1 presentation to sequence, retains recognized reserved v1 values, rejects invalid/reserved undefined values, requires valid v2 presentation, and rejects future schemas. Structural/optional field/numeric validation, duplicate ID checks, non-mutating repair, and authored text preservation remain intact. Legacy quantity repair now spreads unknown attachment fields before supplying recovered amount/unit.
- Empty groups retain an advisory; all nonempty token arrays are complete, including unknown-artwork object-only groups. The missing-action rule and export advisory copy were removed.
- `documentSession` exposes the existing sole default instance. Existing bound signals/actions use that instance; there is no extra running session or observer.
- Session-first and bound `setPresentation` and `moveTokenTo` are available. Presentation changes are undoable and identical requests do not add history. The new move action uses the final post-removal index, clamps it, preserves immutable snapshots, records one entry per real move, no-ops on stale IDs/current destinations, and selects the moved token at its destination. Legacy `moveToken` and its pre-removal semantics were left intact.
- Explicit unbound `openDocumentInSession(session, doc)` batches opening a guide, clears undo/redo/coalescing/clipboard, and selects its first group or null. `replaceDocument` remains the existing undoable replacement.
- Published `library.ts`, `preferences.ts`, `guide.ts`, and `output.ts` types exactly matching shared contract 00. `OutputContentPicture` and `OutputContentGroup` live in `model/output.ts` and are also re-exported from `lib/output-content.ts` for consumer convenience.
- `projectOutputContent` is the shared content policy: authored label retained for accessibility, visible labels only in labels/detailed modes, notes/descriptions only in detailed mode, empty strings preserved, no generated translated labels, fresh arrays and attachment objects. Every mode retains quantity/warning/time. Sequence group duration uses explicit group time before summed token time. Board group duration uses explicit group time exclusively.
- Deterministic fresh fixture builders cover structured warning/quantity/time/notes, 5/10-minute board alternatives, mixed-library picture IDs, arbitrary-size groups (verified 20 and 85), long German labels, and unsupported Japanese text. Fixtures are under `src/test/fixtures`, not production sample data.

## TDD evidence and verification

Before production changes, added the required named cases `migratesV1ToSequence`, `roundTripsBoardV2`, `rejectsInvalidPresentationAndFutureSchema`, `acceptsObjectOnlyGroups`, `moveUsesFinalIndexAndRetainsSelection`, `openingGuideClearsHistory`, `projectionSelectsOptionalText`, and `boardDoesNotSumTimedAlternatives`, plus recognized-v1 reserved presentation and sole-session/presentation checks.

Initial sandboxed focused run could not start Vite because Windows subprocess spawning returned `EPERM`; this was an infrastructure failure, not RED evidence. Re-running the exact focused command with authorized escalation produced **11 expected failures and 186 passes**: missing schema upgrade/presentation rejection, unsupported schema 2, dropped legacy unknown attachment data, the obsolete missing-action advisory, missing session APIs/default instance, and missing projection export. Missing-module cases used an import caught by an explicit function assertion to avoid unrelated loader/setup failures; final tests use ordinary typed static imports.

Implemented the contracts, observed the required cases pass, and updated one existing current-schema migration fixture to include the now-required presentation field. Before implementing fixture builders, a separate fixture consumer test was run RED for the absent fixture export. It then passed with static imports after implementation.

Additional green regression coverage checks negative/oversized final indexes, preserved redo for no-op/stale moves, opening documents with no groups, independent sessions, fresh edit coalescing after opening, omitted versus empty optional text, and mutations of projected attachments not changing the source document.

The first full regression run found only the existing canvas test's obsolete object-only incomplete expectation (333 passing, 1 failing). The controller authorized the minimal update preserving the empty-group advisory assertions. No other failure was omitted.

Latest verification (all exit 0):

- `npm test -- src/model/migrate.test.ts src/model/validate.test.ts src/state/document.test.ts src/lib/output-content.test.ts src/test/fixtures/overhaul.test.ts`: **201 tests passed in 5 files**.
- `npm test`: **338 tests passed in 18 files**.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

Npm validation used `require_escalated` for normal subprocess support after the sandbox startup failure. No staging or commits performed; Git is serialized by the controller.

## Owned and authorized expanded files

Production owned: `src/model/instruction.ts`, `src/model/migrate.ts`, `src/model/validate.ts`, `src/state/document.ts`, new `src/model/library.ts`, `src/model/preferences.ts`, `src/model/guide.ts`, `src/model/output.ts`, `src/lib/output-content.ts`, and `src/test/fixtures/overhaul.ts`.

Tests owned: `src/model/instruction.test.ts`, `src/model/migrate.test.ts`, `src/model/validate.test.ts`, `src/state/document.test.ts`, new `src/lib/output-content.test.ts`, and `src/test/fixtures/overhaul.test.ts`.

Expanded with controller authorization: `src/lib/canvas-layout.test.ts` updates the obsolete missing-action expectation while retaining empty-group advisory behavior; `src/lib/document-actions.ts` changes only the incomplete export advisory to empty-group wording. Existing persistence raw-save tests needed no changes and continue passing.

Report file: `.superpowers/sdd/2026-10-06-agent-implementation/task-0-report.md`. Unrelated controller-created audit files were left untouched.

## Self-review and handoff

Reviewed every exported type against 00 and checked schema snapshots/fixtures/projection expectations. Reviewed source diff for immutable history, retained unknown fields, continued optional field/raw import validation, exact v1/v2/future-schema handling, post-removal versus legacy move semantics, stale destinations, and single-session binding. All required contracts are published to the controller through messages. No independent review or agent spawning was performed; controller supplies review.

Integration boundary: the legacy `documentTotalTime(steps)` helper remains a sequence-only helper because its input has no presentation field. The new shared projection produces no summed board group duration. Reader/output owners must suppress board guide-level totals and use the shared projection, as specified by 00; existing legacy canvas behavior will be replaced by those owners. Foundation has not introduced a second document-time policy or changed unnamed duration interfaces.

No implementation defects remain known from this self-review. Physical output, human usability/device evidence, catalog artwork availability, storage behavior, and editor/reader integration are subsequent owners' deliverables.

## Independent review fix round 1 — canonical fixture artwork

Read `task-0-review.md` and verified its P2 finding against the canonical inventories in specification 01. The known integration fixtures had used short legacy-style artwork IDs, and migration correctly accepted them structurally, so the earlier migration checks did not prove known-catalog resolution. This finding is fixed narrowly in `src/test/fixtures/overhaul.ts` and `src/test/fixtures/overhaul.test.ts`.

The sequence now uses `action.chop` with category action and `object.onion` with category object, with `quantity.amount`, `warning.sharp`, and `time.duration` attachments. Board choices use `learning.object.book`/object and `learning.action.play`/action, with canonical time attachments. Mixed-library fixtures use `object.onion`, `routines.action.wash-hands`, and `learning.object.book` with their matching categories. Long groups use `object.onion`; the unsupported-text fixture inherits the corrected sequence artwork while retaining Japanese text. No intentionally unknown-ID migration/projection tests were changed.

Before changing builders, updated the pinned mixed-library expectation and added a focused consumer assertion for all known picture/category and attachment IDs across sequence, board, mixed-library, long-group, and unsupported-text fixtures. Ran `npm test -- src/test/fixtures/overhaul.test.ts` RED: **2 expected assertion failures**, showing the noncanonical sequence/attachments and mixed-library IDs. Corrected builders, then ran the same command GREEN: **2 tests passed in 1 file**, exit 0. `npm run typecheck` and `git diff --check` also passed (exit 0). Broader tests were not repeated for this fixture-only correction, per the controller's narrow review instructions; the earlier full verification remains recorded above.

No Git mutation performed. Remaining concern: none for the fixture correction. Actual catalog-resolution integration assertions belong to Task 1 after its catalog is available. Ready for the controller's narrow delta review.
