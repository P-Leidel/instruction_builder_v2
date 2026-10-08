# Architecture remediation batches

> **Status: CURRENT.** Implements the three batches requested after the [verified independent review](../../phase-3/reviews/2026-10-08-architecture-verification.md). The unused legacy persistence writer and aliases are already retired in `78e42be`.

## Intent and constraints

Consolidate the running command, presentation, storage, file and shell boundaries so their real policies can be tested directly. Preserve authoring, reading, physical output and recovery behavior. Success means less duplicated policy, fewer obsolete interfaces, meaningful composition/adapter tests and passing existing browser/offline gates.

- No new product dependencies, document/storage schemas or artwork.
- Preserve authored text and every nonempty ID exactly, including whitespace and punctuation.
- Preserve undo/redo coalescing, no-op identity/history, clipboard independence and failed-draft recovery.
- Preserve fixed millimeter cells, lanes, heading bands, gaps, pagination and font measurements.
- Keep current controls, detail-saving semantics, modal rules and responsive zoom choices.
- Keep real IndexedDB/browser verification; do not add a simulated component DOM environment.
- Work locally in the existing managed worktree; root coordinates commits and integration checks.

## Batch 1 Picture commands and drop composition

Deepen the existing authoring controller into the common command entry point. Catalog insertion, movement, copy, duplicate, paste, selection and matching-panel retargeting run through it. The controller remains injectable through `createDocumentSession()`. DOM focus, capture, auto-scroll, pointer thresholds and cancellation stay in the gesture/UI adapter.

Define intent types in `src/model/editor-command.ts`: picture references use `stepId/tokenId`; destinations are append, finite final index, true empty group or stable before/after anchor. Picture commands are insert, move, duplicate, copy and paste. Group movement takes a stable before/after group anchor. Commands return changed target, copied, unchanged or typed rejection. They may close or preserve the panel according to the existing caller's policy. Copy never changes selection, focus, document/history or panel.

Use one final-index picture mutation implementation. Resolve anchors against the full document and translate forward same-group insertion once. Self-anchor/equivalent moves remain strict no-ops, including redo and panel identity. Insertion and successful movement select their target; matching picture panels retarget, unrelated panels persist. Picker insertion closes; keyboard paste preserves the panel; details paste retains its existing close behavior. Clipboard, duplicate and paste deep-clone attachments and create fresh IDs. Guide opening still clears clipboard/history.

`editor-drop.ts` owns geometry, stable-anchor resolution and pure permission-to-command composition. Delete its unread DOM index and absorb `editor-drop-index.ts`; retain its existing meaningful tests. Pure permission includes viewport/blocked-target/modal/source-connected/guide-unchanged/document-unchanged observations. The adapter recomputes on release and checks validity throughout the gesture. Keep current inside policy for both group and picture drops and existing focus/announcement behavior on real changes. Keep `pointer-drag.ts` as the gesture-threshold policy.

Remove `moveTokenTo`, `pasteToken` and selected-step insertion only after their behavioral tests are exercised at the surviving live interface. Preserve generic selection repair in document primitives. Group reorder internals may retain their existing insertion convention; public group intents resolve it once.

## Batch 2 Presentation policy and screen projection

`instruction-presentation.ts` owns group names with explicit editor, authoring, reader, issue and print contexts. Preserve role differences: editor sequence ordinal+title; details authored title or numbered fallback; reader/output selection generic board fallback; print metadata-controlled prefix/title/continuation. Numbers remain one-based and use each caller's existing original/filtered order. Preserve whitespace titles and authored picture strings; empty/whitespace picture labels use the current catalog/full-ID fallback. Pictures-only physical output must not acquire captions.

Share screen/print warning presentation without merging their different review policies: screen checks category; print also checks artwork. Keep catalog warning meaning lower-level to avoid cycles. `output-presentation.ts` owns issue/notice formatting; the editor stops importing from a dialog component. Preserve localized field names, full IDs, fallback parameters and source-sensitive heading labels. Type output message keys against existing catalog keys; retain explicit numeric/string parameter contracts instead of speculative catalog derivation.

`editor-projection.ts` owns minimum target and group-control eligibility and selected auxiliary-group projection. Preserve inclusive 44 px width/height picture/empty targets and 280 px heading width; continued headings never receive inline group controls. Any undersized physical picture still reveals the complete selected-group repair list. DOM positioning and zoom selection stay in components.

`switchOutputPreset(doc,current,preset)` creates defaults using current locale and preserves orientation, mode, background and selected IDs. Metadata resets to preset defaults; custom size resets to 210×297 mm; old custom/label-sheet configuration disappears.

Expose canonical content regions from normalized output geometry, using the existing `min(marginMm,widthMm/4,heightMm/4)` inset. The planner and preview consume those regions, including every label-sheet cell. Composed plans carry the rectangles; optionality may accommodate older constructed test fixtures. This removes duplicated geometry policy without changing successful print layout.

## Batch 3 Storage guide files and shell

### Storage

`storage.ts` owns generic bounded synchronous transactions, native IndexedDB adapter, exact raw fingerprints and insert-only recovery-copy mechanics. Preferences and guide repository depend directly on it. Keep domain sanitization, migration, notices, conflicts, tombstones and post-commit baseline/dedup advancement in their current owners.

Provide one memory adapter in test utilities, with shared contract cases runnable by Vitest and the native browser check. Preserve each fixture's failure/pause timing through hooks. The memory adapter must model native request-time structured cloning, declared read views separate from staged writes, readonly/collision/thenable rejection, rollback and serialized transactions. Mutating a returned object without a write must not persist. Keep native-only no-full-scan, cursor range and commit-event tests.

The repository gains `loadRecoveredDocument(key)` for bounded readonly recovery lookup and migration validation; foreign/missing keys return undefined and invalid content rejects. The controller retains serialized flush/create navigation and failed-draft retention. Recovery sources are never deleted or overwritten.

### Guide files

Consolidate parse, migrate, file reading and JSON backup into `document-file.ts`. Return typed localizable failure reasons for read, JSON, document or export failures. Download full editable pretty JSON with existing MIME type and slug even when physical output is blocked or groups are empty. Keep `migrate.ts` as the shared safety boundary.

Delete `document-actions.ts`, dead warnings/counts and the now-exclusive empty-group advisory module/tests. Move test-only sample vocabulary/provenance to fixtures and retain their assertions. Update live callers/probes and current documentation; preserve dated historical evidence.

### App shell

Expose one stable guide bootstrap/accessor and controller signals; replace ten action forwarding exports. Initialization remains idempotent, retains controller identity after startup failure and installs one observer. Browser probes move to the live accessor.

`createAppShell(options)` accepts controller access, document session, UI signals, preferences/retry, authoring-close, backup and a DOM focus adapter. It owns result notices, synchronous single-flight creation/list actions, storage/preference retry exclusion, import confirmation/dismissal, successful view transitions, output capture/invalidation and focus requests. App/MyGuides render state and keep presentation/example/dialog-selection UI choices local.

Creation locks before the first await. Import dismissal is blocked during create; confirmation clears pending import after any returned action result, with failure retained in `failedNewGuide`. A suppressed duplicate returns undefined and does not dismiss. MyGuides creation/deletion modals retain their distinct dismissibility. Failure does not enter editor. My guides navigation orders flush, authoring close, refresh, then view/focus, and flush failure preserves the current UI. Error messages use locale at completion.

Output captures guide and locale. Deferred entry/return/output focus checks captured view, guide and absence of a modal. Reader return prioritizes selected picture, selected-group Add control, connected opener, then first Add control; output close restores its surviving opener. DOM reads remain in an adapter and native browser coverage remains authoritative.

## Verification and delivery

Each task has failing-before/passing-after behavioral evidence, full retained unit coverage, independent specification/quality review and a local commit. Run targeted native checks between batches with source stable. Finish with full unit/tooling/lint/build, complete browser and production cold/update PWA gates, a broad independent review and an updated delivery record. Practical device, participant, screen-reader, print and artwork-license acceptance remain existing release work.
