# Architecture batches final reviews — 8 October 2026

> 📌 **Doc status: CURRENT** — durable final review archive for the completed local architecture delivery. All task, whole-range and scoped fix reviews approve the work; no actionable findings remain. See the [delivery record](../progress/2026-10-08-architecture-batches.md) for current implementation, verification and release status.

The whole-range review below assessed `78e42be..5aa90b8`, including planning, all five implementation tasks and initial delivery documentation. Product implementation ended at `be04807` at that 8 October architecture checkpoint. It approved the range with no Critical or Important finding and two nonblocking test-quality suggestions. Its references to pending verdict placeholders and remaining Minor observations are preserved historical statements from that review moment.

Both suggestions were then fixed in test-only commit `7c62dcc`. The scoped re-review assessed `5aa90b8..7c62dcc`, marked both findings ADDRESSED and found no new breakage. The original whole-range and fix reports are archived in full below so their outcomes survive removal of the temporary SDD workspace. The scoped verdict closes the two Minor observations; Vitest cache and Git line-ending notes were dismissed as informational, not defects.

Root's post-review execution passed 27 covering unit tests, typecheck, lint and whitespace checks, plus 12 shared native contracts, 12 shared memory contracts and 11 retained native checks. Production code was unchanged between `be04807` and that test-only review checkpoint, so its earlier full integration evidence (682 tests/41 files, tooling 7, build 15 offline assets, browser 22 drivers and PWA 49 cold checks/four formats plus waiting-update/first-use PDF checks) remained applicable. No full-suite rerun after the test-only fix is implied by that checkpoint. The [delivery record](../progress/2026-10-08-architecture-batches.md) records the subsequent 9 October publication follow-up focus fix and its current verification status.

This archive establishes local technical review approval at the 8 October checkpoint, when remote integration had not occurred. On 9 October, the user authorized committing and publishing the completed work directly to GitHub `main`. Local merge `3f7ead6` preserves both histories and the reviewed tree. The [delivery record](../progress/2026-10-08-architecture-batches.md) records fresh integration evidence and remote status links; remote CI and deployment are separate from local gates. UX, participant, physical-print, real-device, screen-reader and licensing acceptance remain pending. The original review reports below retain their historical scope and verdicts.

## Archived whole-range report

# Whole-range architecture review — 8 October 2026

Reviewed range: `78e42be..5aa90b8` (planning, all five implementation tasks, and delivery documentation). Product source ends at `be04807`. Rubric: `requesting-code-review/code-reviewer.md` from superpowers 6.4.2. Reviewed the supplied whole-range package, approved design and plan, durable delivery record, coordination ledger and all five task reviews. Large package output required bounded follow-up reads where tool output truncated.

## Strengths

- The picture command path is genuinely shared by details, keyboard/picker wrappers and drop release. Stable anchors resolve against the complete group once; final-index mutation retains generic selection repair, while authoring supplies successful selection/panel follow-ups. Self and equivalent moves exit before history, redo, selection or panel changes (`src/lib/editor-drop.ts:155`, `src/state/authoring.ts:24`, `src/state/document.ts:509`). Nested clipboard data is independently cloned at both copy and subsequent duplication/paste boundaries.
- Presentation extraction retains explicit role differences instead of imposing one label convention. Whitespace titles, authored nonblank picture labels, full unknown IDs, screen versus print warning review and caller numbering survive. Canonical content rectangles apply the same clamped inset as the previous planner; preview now consumes the composed plan (`src/lib/instruction-presentation.ts:12`, `src/lib/output-options.ts:95`, `src/lib/output-plan.ts:25`).
- Storage extraction retains the native transaction and fingerprint algorithms. The new memory adapter separates cached read objects from request-time persistence clones and preserves asynchronous collision rollback. Recovery validation moves into the repository without moving flush/create or failed-draft policy out of the controller (`src/test/memory-storage.ts:20`, `src/lib/guide-repository.ts:127`, `src/state/guides.ts:217`).
- File consolidation retains the real migration boundary and full JSON backup independently of physical readiness. Tests inspect Blob bytes, MIME, slug, attachment content, exact authored text and migration results rather than only mocked calls (`src/lib/document-file.test.ts:40`).
- Bootstrap and shell extraction retain one live session/controller and stable signal identities. Creation/list locks take effect before awaiting; import dismissal, list-dialog results, completion-time notices, output locale capture and deferred focus currentness remain distinct policies (`src/state/guide-bootstrap.ts:6`, `src/state/app-shell.ts:25`, `src/lib/view-entry-focus.ts:35`).
- Delivery documentation distinguishes completed local implementation and passing technical gates from pending practical acceptance. It preserves historical evidence and carries all interface rulings into a durable tracked record.

## Issues

### Critical — must fix

None found.

### Important — should fix

None found. No concrete delivery or product-source defect was identified in this range.

### Minor — nice to have

1. **Make present-undefined value assertions exact.** `src/test/storage-contract.ts:24` uses the JSON equality helper at `:5` on an array containing two `undefined` values. JSON serialization converts these array values to `null`, so an adapter returning `null` for those reads would pass the value assertion. The entries-key assertion still tests presence, and both implementations currently return the correct values. Add direct `=== undefined` assertions for present and missing reads while retaining the entries assertion. The rollback arrays at `:35` and `:43` have the same precision limitation; direct absent-value assertions there would also be useful. This is a nonblocking test gap, not evidence of data corruption.

2. **Remove the self-fulfilling modal-dismissal assertion.** `src/state/app-shell.test.ts:77`–`:78` assigns local `creating` and `deleting` variables to false and immediately asserts those values. That cannot detect changes to MyGuides or ModalDialog dismissal. Remove the assignment assertion/comment or state clearly that this test covers shell result contracts only; retain the meaningful single-flight/result/failure checks around it. Actual modal behavior belongs to the native component/browser coverage. The current MyGuides JSX and default nonbusy ModalDialog contract preserve dismissal, so no product change is requested.

## Deferred ledger triage

| Ledger entry | Ruling |
| --- | --- |
| Task 3 undefined/null JSON assertion precision | Confirmed as Minor issue 1. Native/memory implementations are correct; no blocking source defect. |
| Task 5 local modal assignments | Confirmed as Minor issue 2. Useful shell contracts remain, but the local assignment is not dismissal evidence. |
| Task 4 Vitest transform-cache suggestion | Informational only; dismiss as a code finding. It does not contradict passing execution evidence. |
| Task 4 / other Git LF-to-CRLF advisories | Informational only; dismiss as a code finding. No runtime failure or content corruption shown. |

## Cross-task and ruling review

All eleven preflight interface rulings remain sound in the final composition:

| Ruling | Final assessment |
| --- | --- |
| Final picture index, one anchor conversion, exact no-op state; private group convention retained | Satisfied by placement resolution plus the command/mutation boundary; composition tests preserve redo, unrelated selection and panel identity. |
| Explicit presentation roles; existing canonical inset | Satisfied. Original/filtered numbering stays caller-owned; print metadata and physical cell geometry are retained. |
| Memory request cloning, distinct read views and fault/pause hooks | Satisfied. Preference fixtures explicitly preserve queue-time pause capture; repository/controller hooks retain their prior failure points. |
| Typed file failures with existing localized UI; retire unread advisories without removing migration | Satisfied. The file API is consumed through `.ok`; migration remains shared and unchanged. |
| Injectable shell, stable startup signals, distinct import/list modal rules | Satisfied. Singleton bootstrap receives the exported signal bundle; isolated tests receive their own signals. |
| Task 2 consumes Task 1 details/authoring wrappers sequentially | Satisfied. Naming changes coexist with command follow-up policies; no old mutation path restored. |
| Task 3 retains guide/history/clipboard checks while replacing the fake | Satisfied. Guide opening still clears history/clipboard and tests use the surviving authoring paste interface. |
| Task 4 changes OutputDialog backup after Task 2 formatter/geometry extraction | Satisfied. Shared formatter and plan content regions remain; JSON backup has no physical-preflight dependency. |
| Task 5 preserves naming/source IDs and reader focus priority | Satisfied. DOM lookup escapes exact IDs; return priority remains picture, selected-group Add, connected opener, first Add. |
| Task 3 recovery lookup precedes Task 5 bootstrap extraction | Satisfied. Recovery lookup validates before create/flush, invalid lookup preserves an earlier failed draft, and valid failed creation retains its candidate. |
| Task 5 consumes Task 4 document-only pending import and typed file result | Satisfied. No obsolete incomplete-count/error/warning interface remains in live consumers. |

The overarching coordination/scope ruling is also justified: sequential implementation avoids overlapping component/controller ownership, while independent review supports each completed boundary. Deferring speculative i18n parameter derivation preserves existing numeric/string contracts; typing output keys against the existing catalog is the approved limited change.

Named cross-cutting checks beyond package hunks: inspected the controller's initialization/observer/serialization/create/flush flow for bootstrap identity and recovered-draft ordering; inspected ModalDialog's busy/dismissal behavior for shell-to-JSX integration; inspected the synchronous download boundary for export error handling; checked live session wiring and searched maintained source/browser consumers for removed APIs. No stale references to the retired move/paste/drop/file/storage/focus interfaces were found. Native storage and import/focus probes still exercise the surviving accessor/adapter boundaries. No general audit of unrelated unchanged code was performed.

## Verification and delivery assessment

Accepted root-owned stable-source execution evidence: 682 unit tests across 41 files; seven tooling tests; typecheck/lint/build with 15 offline assets; complete browser gate with 22 drivers; shared native/memory storage contracts plus retained native checks; production cold-offline 49 checks across four formats and old/new waiting-worker activation with first-use offline PDF. Individual task reviews also record RED/GREEN evidence and targeted native gates. These are reported root executions, not new executions by this reviewer. No already-passing suite was rerun, and no concrete doubt required an additional runtime check.

The whole-review placeholders in the plan, delivery record and current indexes intentionally await this verdict; they are not findings. Root should now record approval and the dispositions of the two minor observations, then mark the delivery checklist complete. No push, merge, deployment or CI result is implied by this technical review.

## Declined to judge

- Automatic saving of valid quantity/time detail edits and simplified Print / Download controls: explicitly deferred product work; this range preserves current semantics.
- Mobile fitting/readability choices, contextual-panel placement and guide creation/list redesign: existing UX decisions outside these architecture batches.
- Participant comprehension and real-world task acceptance: require participant work beyond technical refactoring verification.
- Actual-size/grayscale/distance printing, real iOS/Android operation and VoiceOver/NVDA acceptance: the supplied Chromium and output checks do not establish these practical release outcomes.
- Artwork distribution licensing: unchanged artwork and an explicitly pending release acceptance item; moving provenance test fixtures does not settle rights.
- Stronger abrupt-teardown durability, remote synchronization and immediate cross-tab preference broadcast: existing documented storage limitations, unchanged by this range.
- Independent proof of test-before-implementation chronology: reports record RED/GREEN milestones, but this final static range cannot independently recreate their historical ordering.
- Remote integration/deployment readiness: not requested or executed; this verdict assesses the local implementation only.

## Assessment

**Ready to merge? Yes, technically, with two nonblocking test-quality suggestions.**

**Whole-range verdict: Approved.** All three authorized batches compose coherently and preserve the approved behavioral boundaries. No Critical or Important issue was found; the remaining actionable observations concern assertion precision and test claims, and the durable documentation accurately preserves pending UX/release work.

Review operations were read-only except for this explicitly requested report. No source/index/HEAD/branch mutation, suite rerun or subagent dispatch occurred.

## Archived scoped fix report — 5aa90b8..7c62dcc

**Make present-undefined value assertions exact** — **ADDRESSED**. `src/test/storage-contract.ts:25` and `:26` directly compare the present and missing reads with `undefined`; an adapter returning `null` now fails. The entries assertion at `:27` still proves that the present key exists and the missing key does not. Both collision cases directly assert the rolled-back read is `undefined` at `:41` and `:52`, and retain the original collision-value checks at `:42` and `:53`. Transaction rejection checks remain intact.

**Remove the self-fulfilling modal-dismissal assertion** — **ADDRESSED**. `src/state/app-shell.test.ts:71` describes shell single-flight and returned result contracts. The local `creating`/`deleting` variables, manual assignments, conditional updates, dismissal comment and local-state assertions have been removed. The test retains the busy-lock and same-turn exclusion checks at `:74`–`:75`, directly checks creation success and editor navigation at `:76`, checks missing-open failure and retained guides view at `:79`, and checks the missing-delete result and released lock at `:81`. The adjacent thrown-operation lock-release test remains unchanged.

### New Breakage in the Fix Diff

None. The supplied `5aa90b8..7c62dcc` package changes exactly these two test files, with 19 insertions and 15 deletions. Assertions remain synchronous inside the storage transaction policies, use the existing plain TypeScript assertion helper, and preserve native/memory compatibility. The shell test now observes actual returned values without claiming component dismissal coverage. No production code is changed by this fix.

### Out-of-Scope Observations

None.

### Checks Reviewed

- Read the scoped re-review rubric, both prior Minor findings, the final fix report, and the complete supplied fix package once. Checked current test-file line numbers for the amended assertions. No Git commands were rerun.
- The fix report names the covering unit command, `npm test -- src/lib/storage.test.ts src/state/app-shell.test.ts`, and supplies final exit-0 output showing 2 files and 27 tests passing. It records the initially incorrect missing-delete expectation, its correction to the existing `deleted` result, and the subsequent passing run. The final diff contains that corrected expectation.
- The report supplies exit-0 typecheck, lint and whitespace-check results. Its appended root execution record reports 12 native and 12 memory shared contract checks plus 11 retained native checks passing on the stable fixed files, followed by local commit `7c62dcc`. These are reported execution results, not independent reruns by this reviewer.
- No specific doubt from the fix diff required an additional runtime check. No tests were rerun, no subagents were dispatched, and no source, index, HEAD or branch mutation occurred. The only write was this requested review report.

### Verdict

**Fix round: All findings addressed, no new Critical/Important breakage.** Both Minor findings are closed; no new Minor issue was found in the fix diff.
