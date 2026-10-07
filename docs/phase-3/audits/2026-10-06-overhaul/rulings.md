# Rulings I made

Recorded during the agent implementation, in their original order. Each states the decision and its cost if wrong. These decisions and the [full dispatch ledger](review-records/dispatch-ledger.md) are preserved with the local handoff rather than left only in temporary agent scratch.

1. Run approved Wave 2 packages concurrently with disjoint file ownership, despite the generic skill's sequential implementer preference — user selected the plan's agent workflow and the plan explicitly defines independent parallel packages — if wrong, shared-checkout interference could require rework; controller serializes integration and commits.

2. Controller alone stages/commits each owned delivery; implementers do not mutate Git index/HEAD — prevents parallel commit races and captures task-scoped review ranges — if wrong, a package boundary may need splitting, but local history remains recoverable.

3. Extend Task 0 to existing test fixtures and incomplete-export wording affected by schema/completeness changes — a schema migration must keep the full suite and user-facing validation consistent — if wrong, unnecessary fixture changes could mask regressions; reviewer checks raw-preservation assertions remain intact.

4. Reuse the three available agent seats when the harness rejects new or evicted threads with its thread limit — permits continued implementation with independent cross-review of other workers' code — if wrong, retained context can add cost/bias; workers never review their own delivery.

5. Name the unspecified preference and recovery-notice integration exports in package 02 before its implementation — the editor needs structured status/recovery without extra repository policy or translated storage messages — if wrong, additional UI consumers may need a small adapter; frozen GuideRepository and document types remain unchanged.

6. On a failed new-guide create, preserve the current session and expose failedNewGuide for explicit backup/retry — satisfies open-only-after-commit while retaining attempted work — if wrong, an extra visible recovery affordance may be needed; no existing guide is replaced. Catalog owner supplies guide.copyTitle whole-message key.

7. Use same-font vector text outlines after actual embedded-font proof failed standalone librsvg portability and decomposed-accent PDF parity — preserves glyph geometry across outputs without rasterizing pictures — if wrong, exported text loses search/copy and font-parser cost increases; semantic reader/plan text remains. Serialized root install opentype.js 2.0.0 and @types/opentype.js 1.3.10 (MIT), exit0/audit0; packagejson/lock included in Task4 review. Outline proof must pass before final adapter choice is declared complete.

8. Record original artwork provenance without inventing a project distribution license — repository has no established artwork/project LICENSE and no third-party artwork source is being copied — if wrong, owner must settle a distribution license before release; implementation/export scope itself remains user-authorized.

9. Publish createDefaultOutputOptions(doc, locale) from package04 for package05 settings initialization — enforces the specified single source of defaults and board metadata without exposing another geometry model — if wrong, dialog callers may require a signature adapter; planner normalization stays internal.

10. Publish lastDeletedGuide as the committed tombstone for exact revisioned restore — active flush can advance revision beyond the removed summary, so UI cannot guess an Undo revision — if wrong, controller/UI may need another read adapter; repository and shared result contracts remain unchanged. Added active flush→delete→restore coverage.

11. Task3 may adapt driver/review/reliability browser selectors and add responsive editor coverage, before Task6 final ownership transfer — replacing the authoring DOM requires equivalent behavior checks during implementation — if wrong, final runner integration may need merging; PWA/export scripts remain Task5-owned and root coordinates check-browser wiring.

12. Prioritize complete tap/keyboard ordering; drag remains optional under the authoritative spec index and may be deferred explicitly — avoids blocking the child-friendly primary path with an unnecessary shortcut — if wrong, existing drag users lose a convenience until a later enhancement; document it and retain equivalent ordering/attachment/undo safety coverage.

13. Mark generated PDFs binary and the bundled font license as byte-preserved in `.gitattributes` — Windows text conversion can corrupt PDF cross-reference offsets; the upstream license has intentional literal whitespace — if wrong, textual PDF diffs become unavailable, so reviewers use the preserved source, artifact inspection and hashes. No source lint or test rule is weakened.

14. Freeze OutputDialog's four props as `sourceDocument`, `guideId`, `locale`, and `onClose` — the live immutable source/identity let the output owner detect changes while owning its captured clone/request tokens; App captures locale and unmounts on a guide switch — if wrong, another transient prop may be necessary, but no second document/session or physical layout is introduced. Dialog offers explicit Refresh after source edits; both owners have the exact contract. Integrator owns App/shortcut/focus wiring; output owner owns component state and stale-result rejection.

15. Extend Task 4 correction ownership to pure `attachment-labels.ts` / tests with `getQuantityDisplayLabel` and `getDurationDisplayLabel` — reading and printing must retain numeric meaning for valid blank-label imports using one display policy, preserving nonblank authored labels and all stored fields — if wrong, another consumer may need an adapter, but no schema/projection/geometry contract changes. Task 3 reader owner is notified to consume the helper and cover all modes.

16. Publish pure `ReadingContent` from the Task 3 reader module with `groups`, `presentation`, and `locale` props — lets output preview render the exact captured semantic projection using the same warning/value/accessibility rules as Read — if wrong, a wrapper may need adjustment, but no live session or second projection enters preview. Task 3 owns implementation; Task 5 filters the captured projection by selected source IDs and consumes it. App captures/restores the output opener and suspends shortcuts while output is open.

17. Begin Task 5's disjoint renderer/file/private-controller/offline work while Task 3 finishes browser checks — approved shared contracts, reader exports, dialog props and all output messages are available, and parallel work can save time — if wrong, a consumer adjustment may be needed after Task 3 review. App hookup, legacy removal and full new-UI browser/PWA gates await the reviewed editor handoff. Workers do not edit each other's files; root coordinates final integration/checks.

18. Freeze and independently review Task 5's disjoint initial modules/components/SW delivery while Task 3 corrections run — reviewer did not author either package; validated physical parity and contract seams are available — if wrong, integration may require a later scoped adjustment. App hookup and legacy removal stay held, and full integrated browser/PWA acceptance remains a later delta.

19. Preserve the nonmodal desktop authoring panel/draft behind Settings/import/output native modals, and close a mobile contextual sheet before output — enables truthful modal isolation without discarding a draft merely to print; normal desktop Escape remains available once no modal is open — if wrong, an additional responsive draft adapter could be required. Root records this focus/draft seam in 03/05; initial placeholder integration remains until scoped editor fix approval.

20. Preserve only this run's captured stdout/stderr logs with scoped -text/-whitespace Git attributes — their emitted blank lines are part of the dated evidence, and source/test/CI whitespace or lint rules stay intact — if wrong, future log diffs may be less readable, but no executable source is exempted. Root verified working/committed browser and unit log hashes match, and an actual sample PDF hash matches.

21. Keep the existing externally managed detached worktree and all reviewed local commits without a merge, push or deployment — the authorized task is local implementation/planning/handoff, and no integration decision is needed to deliver that result — if wrong, a maintainer must later select a branch/integration destination before publishing; all changes remain preserved locally.
