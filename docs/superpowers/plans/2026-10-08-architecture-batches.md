# Architecture batches implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver all three requested architecture remediation batches while preserving the running product's behavior.

**Architecture:** Deepen authoring/drop and presentation/projection first. Then extract storage, consolidate guide files and extract shell orchestration as separate reviewable tasks. Root coordinates each task's local commit and independent review before dependent work begins.

**Tech Stack:** Existing TypeScript, Preact signals, IndexedDB/idb-keyval, Vitest and native Playwright; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-architecture-batches-design.md`

## Global Constraints

- No new product dependencies, document/storage schemas or artwork.
- Preserve authored text and every nonempty ID exactly, including whitespace and punctuation.
- Preserve undo/redo coalescing, no-op identity/history, clipboard independence and failed-draft recovery.
- Preserve fixed millimeter cells, lanes, heading bands, gaps, pagination and font measurements.
- Keep current controls, detail-saving semantics, modal rules and responsive zoom choices.
- Keep real IndexedDB/browser verification; do not add a simulated component DOM environment.
- Work locally in the existing managed worktree; root coordinates commits and integration checks.

## Review Focus

- Continued segments and self/adjacent anchors must resolve against original document order without changing redo/selection on a no-op (Task 1).
- Blank/whitespace names, full unknown IDs and print metadata must retain context-specific meaning (Task 2).
- Read-object mutation and post-put mutation must not bypass explicit persistence; failed recovery must roll back notices/baselines (Task 3).
- Invalid file/read/download failures must leave current history/clipboard/storage intact and allow JSON backup independently of physical preflight (Task 4).
- Same-turn duplicate submissions and stale/modal focus callbacks must preserve drafts and avoid a second guide (Task 5).

### Task 1: Picture commands and drop composition

**Files:** Create `src/model/editor-command.ts`; deepen `src/state/authoring.ts`, `src/state/document.ts`, `src/lib/editor-drop.ts`, `src/state/editor-drag.ts`; delete `src/lib/editor-drop-index.ts`; migrate/extend their tests, `src/state/guides.test.ts` and `tests/browser/import-identity-check.mjs`. Update StepDetails/TokenDetails/marker imports only as required. Keep pointer-drag unchanged.

**Interfaces:** Command types define `PictureRef {stepId,tokenId}`, `PicturePlacement` append/final-index/empty/anchor, `GroupPlacement {anchorId,edge}`, `PictureCommand` insert/move/duplicate/copy/paste and result changed/copied/unchanged/rejected. `createAuthoringController(session)` exposes `executePicture(command,followUp?)` and `moveGroup(sourceStepId,destination)`, plus existing caller wrappers. `followUp.panel` is preserve or close. `editor-drop.ts` exports `resolvePicturePlacement(document,destination,source?)`, `resolveGroupPlacement(document,sourceStepId,destination)`, and `resolveEditorDropCommand(source,targets,permission,labelLocale)`. Picture placement resolves final index; group placement resolves the existing private insertion index. Picture drop results contain groupId/anchorId/edge, never DOM index. Permission names are inViewport, blockedTarget, modalOpen, sourceConnected, guideUnchanged and documentUnchanged. Low-level `moveToken` accepts final picture index; remove `moveTokenTo` after migration. No new competing live controller.

- [x] Add behavioral composition tests before implementation: move `x` after anchor `z` in `[x,y,z]` gives `[y,z,x]`, one history entry, selected x and matching panel's destination; continued p24 resolves against `[p0..p29]`, not segment order. Self-before/self-after preserve document/past/future/selection/panel identities. Missing source/anchor and false-empty targets reject unchanged.
- [x] Add independent deep-copy tests: nested quantity/time/warning from Copy survives source edit/removal, duplicate/repeated paste have fresh IDs and independent nested values, Copy preserves history/focus-facing panel state and stale Copy preserves old clipboard. Guide opening prevents paste of the old guide.
- [x] Run focused tests and retain RED output. Implement the shared command path and pure permission composition; each false permission or wrong source/target kind returns null. Keep current drag validity/focus/announcement policies and picker/keyboard/details follow-ups.
- [x] Migrate existing behavioral checks instead of discarding them; geometry expectations assert anchors/edges and retain wrapping/gap/bounds assertions. Remove dead paths only when tests use surviving interfaces.
- [x] Run `npm test`, `npm run typecheck`, `npm run lint`; root runs native drag/Copy/import/physical-editor checks with stable source. Write report including RED/GREEN and diff hazards; root commits and dispatches independent spec/quality review.

### Task 2: Presentation and screen projection

**Files:** Create `src/lib/instruction-presentation.ts`, `src/lib/output-presentation.ts`, `src/lib/editor-projection.ts` and tests. Modify `src/lib/instruction-reading.ts`, `src/lib/output-plan.ts`, `src/lib/output-options.ts`, `src/model/output.ts`, InstructionEditor/EditorGroup/EditorPicture, StepDetails/TokenDetails/TokenPicker, InstructionReader, OutputDialog/OutputPreview and relevant tests. Keep Task 1 command interfaces intact.

**Interfaces:** `getGroupLabel(title,locale,context):string` contexts editor/authoring/reader (presentation and one-based number), issue, print (number/groupTitles/stepNumbers/continued). `getPictureLabel({iconId,label?},locale):string`; `getWarningPresentation(warning,locale,context:screen|print)` returns meaning/text/review. `issueText(issue,locale):string` and `noticeText(notice,locale):string` reside in output-presentation. `hasMinimumTargetSize(box,scale):boolean`; `canPlaceGroupControls(placement,scale):boolean`; `projectEditorControls(layout,selectedStepIds,scale)` returns auxiliaryStepIds/needsPictureList. `switchOutputPreset(doc,current,preset):OutputOptions`. Normalized options and composed plans expose canonical contentRegions (optional on old externally constructed plans).

- [x] Write RED tests with literal expected locale names: sequence editor `Step 1: Boil` versus reader `Boil`; board untitled authoring `Group 1` versus reader `Group`; whitespace titles and nonblank authored picture labels retain their exact strings, while whitespace-only picture labels use the existing fallback without changing stored text; full unknown ID `vendor.<raw>-$&`; print metadata off/continuation, known versus missing-artwork warning. Issue tests cover all codes, unknown field fallback and document/group heading sources.
- [x] Add threshold tests just below/at/above 44 px and 280 px, continued/absent heading exclusion, split groups/selected order and tiny-picture repair list. Preset tests preserve locale/orientation/mode/background/selection, reset custom size to 210×297, discard old sheet settings and retain input identity.
- [x] Run focused tests for RED. Implement helpers and migrate call sites without changing naming contexts, source order, physical caption omission or placement.
- [x] Expose existing clamped content rectangles once; planner and preview consume them, including unused sheet cells. Test A4 `{xMm:10,yMm:10,widthMm:190,heightMm:277}`, orientation and blocked custom sizes while retaining existing exact geometry tests. Type issue/notice keys against catalog keys without weakening parameter types.
- [x] Run `npm test`, typecheck and lint; root runs native reading/unknown/physical-output checks. Report RED/GREEN and review hazards; root commits and reviews independently.

### Task 3: Storage adapters and repository recovery

**Files:** Create `src/lib/storage.ts`, `src/test/memory-storage.ts`, `src/test/storage-contract.ts`, `src/lib/storage.test.ts`. Modify guide-repository, preferences, guides, model/guide, three domain tests, `tests/browser/storage-check.mjs` and maintained probes/imports. Do not restructure shell yet.

**Interfaces:** `StorageTransaction {get,put,add,entries}`; `StorageReadPlan {keys?,prefix?,mode?}`; `StorageStore.transaction<T>(plan,operation):Promise<T>`; `createIndexedDbStorage():StorageStore`; unchanged `rawFingerprint(value):string`; `RECOVERY_PREFIX`; `copyRecovery(transaction,raw,{now,newId}):string` uses add. `createMemoryStorage(options?)` test helper returns store/records and hooks preserving fault/pause timing; shared `runStorageContract(createStore)` browser-importable without Vitest/Node dependencies. `GuideRepository.loadRecoveredDocument(key):Promise<InstructionDocument|undefined>` performs readonly lookup/migrate, never creates/deletes guides. Controller retains serialized existing create path.

- [x] Add RED shared contract cases for declared keys/prefix/combined/duplicates; present undefined; undeclared reads; readonly writes; add collision rollback; thrown policy/returned callable thenable; noncallable then raw data; read-your-writes; cloned cyclic/Map/Set/Date/binary data; serial continuation after rejection; commit completion. Verify mutating get results without put and mutating input after put do not persist. A put then input/get mutation must remain visible in the current transaction's cached read view, while a later transaction sees the request-time write clone.
- [x] Add recovered raw/envelope/missing/foreign/invalid/readonly failure tests and composition failed-flush preservation tests. Recovery lookup/migration precedes flush: invalid candidates leave the existing failed draft untouched and perform no flush; a valid candidate followed by failed flush becomes the retained failed draft. Use existing schema/identity fixtures and retain exact recovery source assertions. The readonly lookup must not run migration initialization or loadRecords.
- [x] Run RED cases. Extract native adapter/fingerprint unchanged; share recovery mechanics and test adapter, preserving existing domain policies and hook timing. Replace three duplicated fakes. Avoid GuideStore compatibility aliases in production.
- [x] Run same contract against native and memory adapters in maintained storage-check; retain native no-full-scan/cursor FFFF/commit-event/abort-baseline tests. Root owns browser execution with source stable.
- [x] Run full units, typecheck, lint; report RED/GREEN and migration/recovery risks. Root commits and obtains independent spec/quality approval.

### Task 4: Guide file consolidation

**Files:** Deepen `src/lib/document-file.ts` and its tests; delete document-actions and its exclusive tests after migration; delete model/validate and exclusive tests; change App, OutputDialog, ui PendingImport; move sample-tokens/artwork-provenance into `src/test/fixtures` and fix test imports/comments. Update current recovery example to the new file API.

**Interfaces:** `parseGuideFile(text:string)` and `readImportFile(file:Pick<File,"text">)` return `{ok:true,document}` or `{ok:false,reason:read-failed|invalid-json|invalid-document}`. `runJsonExport(doc)` returns `{ok:true}` or `{ok:false,reason:export-failed}`. Keep parsing/download helpers private unless a live caller needs them. PendingImport contains document only. Shared `migrate` remains unchanged. Shell task consumes these interfaces.

- [x] Add RED behavior tests for full pretty JSON/slug/MIME round-trip with attachments, non-Latin authored text, empty groups and physically blocked content; download failure returns export-failed. Mock only download boundary, inspect real Blob bytes rather than call-only assertions.
- [x] Add read rejection, malformed JSON, newer schema, empty IDs and malformed attachment tests with literal reason expectations; valid schema1 migration succeeds. Confirm source objects stay unchanged and active browser import preservation checks remain.
- [x] Run RED; consolidate into one file module, return typed reasons, migrate callers to `.ok`, remove unread warning/error/count outputs and exclusive advisory code. Move test-only provenance/sample data while keeping assertions.
- [x] Run full units, typecheck and lint; root runs import/backup/export checks. Report RED/GREEN; root commits and obtains independent review.

### Task 5: App shell and stable controller access

**Files:** Add `src/state/guide-bootstrap.ts`, `src/state/app-shell.ts` and behavioral tests; optionally add a focused DOM focus adapter under `src/lib`. Modify guides bootstrap exports, main, App, MyGuides, view-entry-focus if needed, maintained browser probes and current controller integration docs. Consume Task 3/4 types without compatibility wrappers.

**Interfaces:** Export `GuideController`/`GuideControllerSignals` and signal factory from guides. `createGuideBootstrap(options?)` exposes stable signals, `initialize(session):Promise<void>` and `controller():GuideController`; singleton `guideBootstrap` supplies startup/access. Keep named stable signal exports; delete ten action forwarding exports. `createAppShell(options)` injects controller accessor/session/view/pendingImport/toast/preferences-retry/authoring-close/backup/focus adapter. It exposes busy signals, `reportResult`, `createOnce`, `confirmImport`, `closeImport`, `runGuideAction`, `retryStorage`, `retryPreferenceStorage`, `openGuides`, `openEditor`, `openReader`, `returnToEditor`, `openOutput`, `closeOutput` and captured output signal. Factory callers supply all dependencies; no competing live session. Focus adapter schedules DOM work and accepts currentness guards/captured opener destinations.

- [x] Write RED tests using real guide/controller storage with deferred transaction/operation hooks: two same-turn confirmations create one guide; lock appears before await and releases on success/failure; import dismissal blocked while creating; any returned result clears pending import; failed draft remains; duplicate undefined leaves it open.
- [x] Test flush failure preserves view/panel/focus; successful guides navigation orders flush→close→refresh→entry. Test separate retry statuses/mutual exclusion and notices localized at completion. Stable bootstrap initialize is idempotent through failed storage/retry.
- [x] Test list actions' success/failure and existing new/delete modal dismissal rules through shell result contracts. Test captured output locale/guide, invalidation and queued entry/return/output focus suppressed after view/guide change or modal opening; preserve recipient destination priority.
- [x] Run RED; extract orchestration, migrate App/MyGuides and all maintained guide action probes to accessor. Keep JSX/local presentation/example/dialog choices in components, current controls and modal differences intact.
- [x] Run full units, typecheck and lint; root runs import double-submit, transitions, startup retry and output integration native checks. Report RED/GREEN; root commits and reviews independently.

## Final integration

- [x] Hold product source stable; run full units, tooling, lint, production build, complete browser gate and production cold/update PWA gate.
- [x] Request one broad whole-range review from `78e42be` to completed HEAD; fix actionable issues and rerun affected gates.
- [x] Update verification/delivery/current docs with exact final behavior, commits, counts, rulings and remaining release limits. Save all local work and leave the managed worktree intact.
