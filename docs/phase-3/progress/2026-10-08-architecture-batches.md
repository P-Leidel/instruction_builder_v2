# Architecture remediation batches — 8 October 2026

> 📌 **Doc status: CURRENT** — delivery record for the three authorized architecture batches. All five implementation tasks have independent specification/quality approval and final integration gates pass at `be04807`; broad whole-range review is pending.

The [initial architecture verification](../reviews/2026-10-08-architecture-verification.md) qualified nine review candidates and retired the unused legacy writer and singleton aliases in `78e42be`. The user then authorized all three follow-up batches. The [design](../../superpowers/specs/2026-10-08-architecture-batches-design.md) and [implementation plan](../../superpowers/plans/2026-10-08-architecture-batches.md) define their scope; planning commit `1eabd92` precedes the five product commits below.

This work consolidates the running command, presentation, storage, file and shell policies and adds composition/adapter coverage. It preserves authored text and every nonempty ID, undo/redo and clipboard behavior, failed drafts, fixed print geometry, current controls, detail-saving rules and responsive zoom. There are no new product dependencies, document/storage schemas or artwork. Work is saved locally in the existing managed worktree; no push, merge or deployment occurred.

## Delivered boundaries

| Authorized batch / task | Delivered behavior and ownership | Local commit |
| --- | --- | --- |
| **1. Picture commands and drop composition** / Task 1 | [Authoring controller](../../../src/state/authoring.ts) executes typed [picture intents](../../../src/model/editor-command.ts) for insert, move, copy, duplicate and paste. Stable picture/group anchors resolve against the full document in [editor-drop](../../../src/lib/editor-drop.ts); picture mutation uses one final-index convention. Pure drop permission composes viewport, modal, target, connectivity, guide and document guards. DOM focus, capture, scrolling and cancellation remain in the gesture adapter. | `60f4c4f` |
| **2. Presentation and screen projection** / Task 2 | [Instruction presentation](../../../src/lib/instruction-presentation.ts) preserves explicit editor/authoring/reader/issue/print naming contexts and distinct screen/print warning policies. [Output presentation](../../../src/lib/output-presentation.ts) owns issue/notice formatting; the editor no longer imports a dialog formatter. [Editor projection](../../../src/lib/editor-projection.ts) owns target/control eligibility. Editor and output share [preset switching](../../../src/lib/output-options.ts); normalized/composed content regions supply the existing clamped geometry to planner and preview, including unused sheet cells. | `30b2fe4` |
| **3. Storage, guide files and shell** / Task 3 | [Storage](../../../src/lib/storage.ts) owns bounded synchronous transactions, native IndexedDB, raw fingerprints and insert-only recovery copies. Repository/preferences retain domain validation, migration, conflicts, notices, tombstones and post-commit baselines. [Repository recovery lookup](../../../src/lib/guide-repository.ts) performs bounded readonly lookup and shared migration before the controller's existing create/flush path. One [memory adapter](../../../src/test/memory-storage.ts) and [shared contract](../../../src/test/storage-contract.ts) replace three duplicated fakes. | `01bb68a` |
| **3. Storage, guide files and shell** / Task 4 | [Document file](../../../src/lib/document-file.ts) owns parse/read/pretty JSON backup with typed failure reasons. Shared migration remains the safety boundary. Full editable backup remains available when physical output is blocked or groups are empty. Retired the dead document-actions/advisory chain and unread warning/count/error-text outputs; sample/provenance data now live in test fixtures with retained assertions. | `8250762` |
| **3. Storage, guide files and shell** / Task 5 | [Guide bootstrap](../../../src/state/guide-bootstrap.ts) owns the stable controller/accessor and idempotent initialization; named signals remain stable and ten action forwarding exports are removed. [App shell](../../../src/state/app-shell.ts) owns synchronous busy guards, result notices, import/retry/navigation/output orchestration through injected dependencies. Components retain local presentation/example/dialog choices; [focus adapter](../../../src/lib/view-entry-focus.ts) owns DOM scheduling and destination lookup. | `be04807` |

Obsolete paths were removed only after meaningful behavior moved to surviving interfaces: `moveTokenTo`, session `pasteToken`, selected-step insertion, `editor-drop-index.ts`, `document-actions.ts` and the empty-group advisory module. The generic session clipboard primitive and selection repair remain. Maintained browser probes consume the new storage/controller boundaries. Current [recovery integration](../../persistence-recovery.md) documents the accessor and typed file results; dated audit scripts remain historical evidence.

Successful picture commands select their target and retarget only a matching picture panel. Copy preserves document/history/selection/panel/focus-facing state and deep-clones attachments. Self/equivalent moves preserve document, past/future, selection and panel identity. Picker/details close and keyboard paste preserves the panel according to existing caller policy; guide opening clears history/clipboard.

Presentation keeps one-based caller ordering, authored whitespace, full unknown IDs, metadata-controlled print headings and Pictures-only caption omission. Targets retain inclusive 44 px width/height and 280 px heading width; continued headings receive no inline group controls. Any tiny physical picture reveals the complete selected-group repair list. Preset switching preserves locale/orientation/mode/background/selection, resets metadata and custom dimensions to existing defaults, and discards old custom/sheet configuration.

Native storage/fingerprint algorithms were extracted without algorithm changes. The memory adapter clones writes at request time and separates persisted clones from transaction read views; mutations without explicit writes cannot persist. Failed recovery rolls back notices/baselines and preserves originals. Invalid recovery lookup performs no flush; a valid candidate followed by failed flush becomes the retained failed draft. Recovery sources are never deleted or overwritten.

Shell creation/list/retry locks take effect before the first await. Import stays open during creation; any returned result clears it, while duplicate suppression returns undefined and leaves it open. My guides retains dismissible new/delete dialogs, with new closing after success and delete after any returned result. Failed navigation preserves view/panel/focus; successful My guides navigation orders flush → authoring close → refresh → entry. Notices use locale at completion; output captures guide/locale and invalidates on guide/editor-view change. Deferred focus checks view/guide/modal currentness; reader return keeps picture → selected-group Add → surviving opener → first Add priority.

## Verification

Root ran the final gates with product source stable at `be04807`; the documentation pass does not rerun or independently claim execution of these gates.

| Final gate | Result |
| --- | --- |
| `npm test` | **682 tests / 41 files passed** |
| `npm run test:tooling` | **7 passed** |
| `npm run typecheck`, `npm run lint`, `npm run build` | **Passed**, production manifest includes **15 offline assets** |
| Complete `npm run test:browser` | **22 drivers passed**; includes focus 40, review regressions 9, drag 31, physical editor 118 and centered pictograms 170 |
| Storage and retained native checks | Shared contract **12 each** for native/memory; retained native 11, preferences 5, startup retry 5, import 9, export/backup 57, reader 24 and Copy 100 passed |
| `npm run test:pwa` | **49 cold-offline checks / four formats passed**; old/new waiting-worker activation and actual first-use PDF from both offline clients passed |
| Independent task specification/quality reviews | **All five approved**, no critical/important issue |
| Broad independent review, `78e42be` through completed delivery | **Pending**; no whole-range verdict is claimed yet |

Each task recorded failing-before/passing-after evidence, full retained units and targeted native checks before its independent review. Unit checkpoints progressed from 590/37 to 632/40, 658/41, 668/39 and final 682/41. These counts reflect moved/retired exclusive interfaces as well as new tests; earlier gate counts remain dated checkpoints. Composition coverage includes continued/self anchors, deep clipboard independence, role/whitespace/unknown naming, exact print regions, request-time clone isolation and rollback, real JSON bytes/migration failures, duplicate submission, failed drafts, startup identity and stale focus.

Detailed implementer/reviewer records and coordination history are local under `.superpowers/sdd/2026-10-08-architecture-batches/`. This durable record carries their outcomes and rulings so current status does not depend on that working ledger. Native IndexedDB, modal/focus and production offline gates remain authoritative for browser behavior; no simulated component DOM environment was introduced. Chromium verification does not establish practical release acceptance.

## Review rulings and preservation costs

The preflight review approved these boundaries. The ledger's coordination ruling requires sequential product implementation because tasks share files; independent reconnaissance/review preparation can proceed in parallel. Existing user authorization covers reversible local implementation. The selected scope preserves documented behavior and defers speculative i18n derivation: output keys use the existing catalog type while explicit numeric/string parameter contracts remain intact. Parallel product edits could overwrite dependencies; deriving parameter types from strings alone would weaken numeric checks and change the approved scope.

| Ledger ruling | Why it matters / cost if wrong |
| --- | --- |
| Commands use one final picture index, translate stable anchors once, retain private group insertion convention and exact no-op selection/redo. | Double translation can misplace forward moves; a no-op that touches history/selection/panel destroys redo or changes UI state. Group intent is resolved without unnecessarily rewriting a separate primitive. |
| Presentation roles remain explicit; canonical regions use the existing inset. | Universal naming would change editor ordinals, authored Read/details names or print metadata. New inset policy would alter physical geometry. |
| Memory storage clones requests, separates reads from persisted writes and preserves failure/pause hooks. | Shared mutable objects could hide missing writes or rollback failures; changed scheduling can conceal preference/controller ordering defects. Native comparison remains necessary. |
| Typed file failures retain generic localized UI feedback; unread warnings/counts retire while shared migration remains. | Changing user copy is a separate UX decision. Removing migration would weaken schema/identity/attachment safety or activate invalid content. |
| Shell factories remain injectable, stable startup signals survive and import/list modal rules stay distinct. | A competing session/controller or observer could duplicate saves; uniform dismissal would lose the guarded import or alter list-dialog behavior. |
| Task 2 consumes Task 1's surviving details/authoring wrappers sequentially. | Shared component edits could discard command follow-ups or restore obsolete paths. |
| Task 3 retains Task 1's guide/clipboard checks while replacing the fake. | Storage consolidation must not erase evidence that guide opening clears the live clipboard/history. |
| Task 4 changes OutputDialog backup results after Task 2 formatter/geometry approval. | Concurrent changes could drop the new formatter or couple JSON backup to physical planning. |
| Task 5 preserves Task 2 naming/source IDs and recipient focus priority. | Repair targets or reader return could focus the wrong source after a view/guide change. |
| Task 3 moves recovered lookup; Task 5 extracts bootstrap only afterward. | Reordering recovery and flush can overwrite failed drafts; shell extraction must not duplicate repository policy. |
| Task 5 consumes Task 4's document-only pending import and typed file results. | Retained compatibility fields would perpetuate dead interfaces and muddle duplicate/dismissal behavior. |

Two nonblocking test-precision observations await broad-review triage: shared storage-contract JSON array equality conflates `undefined` and `null`; one shell test's local modal assignments do not exercise actual component dismissal. Neither identified a product defect. Native storage assertions and the complete modal/browser gate remain retained. Vitest's informational transform-cache suggestion and Git's line-ending advisory are tooling notes, with passing required gates. These observations are not counted as resolved until final review decides them.

## Remaining product and release work

Phase 3 remains in progress (**5 of 7 tasks**); real-user task 30 and practical refinement/acceptance for task 31 remain open. The user-selected automatic saving of valid detail edits and simpler Print / Download controls with named advanced sections still await implementation. Mobile fitting/readability remains the next UX decision; contextual-panel placement and guide creation/list flow also remain open. See [P3 remediation](./2026-10-08-p3-remediation.md) for those decisions.

Participant comprehension, actual-size/grayscale/distance printing, real iOS/Android operation, VoiceOver/NVDA and artwork distribution licensing remain pending. Local browser storage, the abrupt-teardown final-edit window, outlined vector text and current raster limits remain documented in [known issues](../../known-issues.md), [print fonts](../../print-fonts.md) and [recovery](../../persistence-recovery.md). No remote integration or release acceptance is implied by the architecture gates.
