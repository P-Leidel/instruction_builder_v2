# Task 3 implementation report

Status: DONE for the initial editor handoff authorized by the controller. Editor/reader/local-guide integration and automated gates are complete. Task 5's reviewed output hookup and matching physical samples remain a coordinated integration step; human/device acceptance remains pending. No Git/index mutation or child-agent delegation occurred.

## Delivered behavior

- Startup calls `initializeGuides(documentSession)` once and renders after adoption. The existing explicit document session remains the sole running document/history/selection/clipboard. Components delegate storage to the reviewed guide controller rather than opening IndexedDB or constructing another session.
- My guides offers named Open/Duplicate/Delete, localized blank sequence/board and fresh examples, title/presentation/updated summaries, exact tombstone revision restore, original recovery import, and persistent failed-create draft backup/retry. Import adds a guide after truthful confirmation. Switching/creation/import has isolated history and preserves other saved work.
- HTML authoring places guide title and first group ahead of optional settings. Language preferences live in a deliberate Settings modal; truthful saving is compact. Group titles are edited in the group-actions panel rather than repeated as always-visible inputs. Sequence headings are numbered; boards are unnumbered and preserve source/navigation order.
- Each group owns Add picture. The picker captures its target ID, retains useful library/search/category choices, inserts on one activation, and focuses/reveals the new picture. Ambient selection cannot redirect insertion. A deleted target closes with a localized notice and never inserts into another group. Direct picture activation opens label controls immediately.
- Labels/titles/descriptions/notes retain full text. More details contains structured quantity, custom unit/suggestions, integer time, and warning editors. Unknown fields/attachments survive ordinary editing, movement, duplicate and deep copy/paste. Saving unchanged structured quantities/times preserves an imported custom or blank stored label.
- Earlier/later use final post-removal indexes; boundaries disable. Move to group appends to the named destination. Group moves, populated-group confirmation/removal, Undo/Redo, duplicate fresh IDs, copy/paste, and presentation changes preserve document content and attachment data. Presentation changes are one undoable edit.
- Below 768 CSS px, one native modal sheet contains the active picker/details panel with Escape/Close, focus containment, sticky Close, dynamic viewport height and scrolling. At 768+ it is an adjacent nonmodal aside. Focus returns to a surviving opener or a safe surviving Add control. Insertion/moves/reading return focus to the selected picture. Document shortcuts suspend during native modals, reading, and output; text copy/paste retains text-field behavior.
- Local bounded grids keep one/two/twenty-picture groups at comparable tile sizes. Selection outlines do not resize groups. Normal controls are at least 44 × 44 CSS px and normal text at least 16 CSS px. Long text wraps; editor widths 320/390/768/1440 and 200% text sizing have no page-level horizontal overflow. Reduced-motion rules suppress nonessential movement.
- Recipient reading uses foundation `projectOutputContent` through `toReadingGroups`, with labels/pictures/detailed modes and full authored accessible names in Pictures-only. Required quantity, warning context and time retain their semantic order in every mode. Unknown main/warning references remain named and visibly reviewable. The shared attachment display helpers derive missing numeric display text without changing imports. Sequences use explicit group time or projected token sum; boards show only explicit group time and no guide total.
- Reading mounts recipient content and mode/back controls only. It does not mount the hidden legacy canvas, editor toolbar, or authoring controls. Return restores selection/focus.
- Conflict/unavailable states offer exact local JSON backup, explicit reload with discard consequence/backup option, and continued editing without falsely restoring autosave. Failed reload retains the newest local draft; successful reload uses `reloadActiveGuide`. Failed create keeps the current work and exposes the attempted draft's explicit backup.

## Integration seams

`src/lib/instruction-reading.ts` exports:

```ts
toReadingGroups(doc: InstructionDocument, mode: OutputMode, locale: AppLocale): readonly ReadingGroup[]
ReadingGroup
ReadingPicture
```

Reading types retain projected source IDs/text/attachments and add accessible meaning, resolved artwork, warning meaning/context/review state, and display-only quantity/time labels. No second optional-text or board-duration policy is introduced.

`src/components/InstructionReader/InstructionReader.tsx` exports pure `ReadingContent` with exactly:

```ts
{ groups: readonly ReadingGroup[];
  presentation: InstructionDocument['meta']['presentation'];
  locale: AppLocale }
```

It reads no live session/preferences and renders no controls/output layout. Task 5 can project its captured document/mode/locale, filter source group IDs, and reuse this content in OutputPreview.

The frozen eventual App seam is named `OutputDialog` with exactly `sourceDocument={documentSession.document.value}`, `guideId={activeGuideId.value}`, captured opening `locale`, and `onClose`. App already captures the Print/Download opener and guide identity, suppresses output-visible shortcuts, and unmounts output when guide identity differs. SourceDocument must be the live immutable prop; OutputDialog owns its captured clone, source-change invalidation/Refresh, async invalidation and its options. The initial Task 3 delivery retains an explicit localized integration-pending modal until Task 5 parity/review permits hookup, as instructed by the controller. Existing obsolete authoring/export source and inert editor-only compatibility canvas remain until parity; they are absent from recipient reading. No second exporter was added.

`src/state/authoring.ts` exports `createAuthoringController(session)` and `AuthoringController`. Its discriminated panel is closed/picker(stepId)/picture(stepId,tokenId)/group(stepId). Runtime UI creates one controller from the explicit existing session. New insertion/duplicate/paste IDs are fresh; copy/paste/duplicate clone attachment and unknown data.

The legacy bound actions remain intact. Compatibility `copyTokenWithToast` now takes an optional explicit locale (default en), avoiding a preferences/storage dependency in the UI state module. Active HTML flows use the session authoring controller. The original legacy persistence tests remain unchanged.

## Whole-message localization delta

Added 67 typed EN/DE whole-message keys (35 editor integration + 32 coordinated Task 5 additions). Total table size is 235, with equal key sets and matching placeholders. Authored titles/labels/units are never translated on preference change. Exact parameters:

| Editor/integration key | Params |
| --- | --- |
| guides.openNamed, guides.duplicateNamed, guides.deleteNamed | `{ title: string }` |
| editor.addPictureTo, editor.movePictureTo | `{ group: string }` |
| editor.pictureDetails, editor.copiedPicture | `{ label: string }` |
| editor.removeGroupConfirm | `{ group: string; count: number }` |
| guides.updated | `{ date: string }` |
| guides.restoreLast | `{ title: string }` |

The following editor/integration keys take `undefined`: `import.confirmNew`, `preferences.title`, `editor.groupActions`, `editor.targetMissing`, `editor.duplicatePicture`, `editor.moveGroupEarlier`, `editor.moveGroupLater`, `guides.failedNewDraft`, `guides.downloadFailedDraft`, `guides.retryFailedDraft`, `guides.importRecovered`, `guides.legacyChanged`, `guides.legacyRecovered`, `guides.guideRecovered`, `save.reloadConfirm`, `save.keepEditing`, `preferences.saveUnavailable`, `reader.backToEditing`, `reader.contentMode`, `editor.warningReview`, `guides.creationType`, `guides.startingPoint`, `guides.createExample`, `editor.presentation`, `output.integrationPending`.

| Task 5 key | Params |
| --- | --- |
| output.cellSize, output.dimensions | `{ width: number; height: number }` |
| output.sheetUsage | `{ used: number; capacity: number; pages: number }` |
| output.pageCount | `{ count: number }` |
| output.ready | `{ pages: number }` |
| output.exporting | `{ format: string }` |
| output.downloadRequested | `{ filename: string }` |
| output.downloadSvgPage | `{ number: number; total: number }` |
| output.downloadPngPage | `{ number: number; total: number; dpi: number }` |

The following Task 5 keys take `undefined`: `output.format`, `output.orientation`, `output.mode`, `output.background`, `output.metadata`, `output.labelSheet`, `output.sheetSettings`, `output.sheetMargin`, `output.sheetGap`, `output.columns`, `output.rows`, `output.previousPage`, `output.nextPage`, `output.zoom`, `output.previewHelp`, `output.contentBounds`, `output.semanticContent`, `output.notices`, `output.sourceChanged`, `output.refresh`, `output.retry`, `output.pdfPaper`, `output.canvasUnavailable`.

Task 5's exact complete strings were consumed serially from `task-5-message-additions.md`; that worker made no competing i18n edits. Existing planner/output keys are reused. Parity tests also assert full German removal copy and EN/DE page/count messages with typed placeholders.

## TDD and failure evidence

1. Before implementation, focused `instruction-reading.test.ts` and `authoring.test.ts` ran against throwing scaffolds: 6 genuine RED cases at 17:12:51. They failed for the missing reading/authoring behavior, not a build/import problem. Implemented the shared projection/captured-target controller, corrected two test-fixture assumptions (an explicit second empty group and clearing preset unrelated durations), then 6 GREEN at 17:13:57. Added three all-mode blank-label numeric regressions when the shared display helper landed: final reading 6 + authoring 3 = 9 owned cases, all passing in the full suite.
2. The first UI browser fixture failed because the previous app had no reviewed My guides/create flow. After implementation, keyboard blank creation/insertion passed. Expanded browser fixtures then exposed modal setup/focus timing, search-field Escape consumption, and long-text horizontal overflow. Native modal setup uses layout effect; explicit Escape closes search sheets; hidden import-input sizing no longer causes page overflow.
3. Expanded responsive checks passed all 39 original checks. Root's concrete visual feedback added initial-viewport, bounded-tile, and visible-step assertions. Corrections moved preferences into Settings, removed duplicate group-title chrome, separated review notices, bounded sparse desktop tiles, numbered sequences, and replaced nonexistent normal-prototype Store artwork with canonical Container/Soap. Expanded 51 checks are GREEN.
4. A later 768px focus assertion raced intentional requestAnimationFrame restoration. The checker now waits for the actual opener focus before asserting, without weakening the condition or adding an arbitrary delay. All four widths pass.
5. Driver exposed the unit datalist's ambiguous inherited label; added explicit localized Unit aria-label. Final extra presentation coverage exposed the same label ambiguity on its select; added explicit localized Presentation aria-label. A test focusing without selecting a picture was corrected to perform the actual direct-activation/close workflow before expecting selected-picture restoration.
6. Full unit validation initially found 10 legacy persistence tests failing because my static UI import of preferences constructed the guide repository under their intentionally narrow legacy idb-keyval mocks. Removed the UI→preferences dependency; retained explicit-locale compatibility copy messages. No persistence/test-owner changes were made. Full unit rerun: 462 GREEN.
7. Semantic axe check initially rejected status/alert roles on aside elements. Notices that need status/alert now use valid div markup. Final editor axe violations: zero.

## Actual final verification

| Command | Observed result |
| --- | --- |
| `npm test` | 37 files / 462 tests passed, exit 0 (17:46:54 local run). Includes reading/authoring/i18n and unchanged legacy persistence coverage. |
| `npm run typecheck` | exit 0, rerun after the final presentation accessibility label. |
| `npm run lint` | exit 0, rerun after the final browser assertions/label. |
| `npm run test:tooling` | 7 passed, exit 0; strict false/missing/numeric browser-result enforcement retained. |
| `npm run test:browser -- docs/phase-3/audits/2026-10-06-overhaul/editor-proof` | exit 0; driver 29, semantic review 22, responsive 51; all six native reliability PASS anchors. Final responsive evidence timestamp 2026-10-06T15:50:45.896Z, Chromium 153.0.8010.12. |

No test/type/lint blockage from active peers remained at these runs. These are observed shared-worktree results; they do not assert independent approval of another package. Build/PWA/output-format/offline gates belong to Task 5/6 and were not represented as Task 3 passes.

### Retained safety coverage mapping

| Previous safety behavior | HTML/per-guide equivalent |
| --- | --- |
| Two-click SVG selection/edit | Direct activation opens full label controls; keyboard Enter inserts/edits with correct focus. |
| Import replacing current work | Invalid import preserves exact work; valid import explicitly adds a new guide and isolates history while previous guide records remain. |
| Undo/redo / move / clipboard | Final-index picture/group moves, boundary disabling, Undo/Redo, populated group cancellation/removal/Undo, presentation Undo, fresh-ID duplicate and deep attachment copy/paste. Text-field Copy leaves document clipboard alone. |
| Read-only preview control isolation | Recipient DOM contains no hidden export canvas/toolbar/edit controls; Pictures-only retains full accessible names, Back restores selected focus. |
| Download lifetime | Actual JSON download succeeds, anchor is connected at click, object URL is not revoked in the click task, exact current document content returned. |
| Stale-tab save protection / JSON escape | Real shared native IndexedDB tabs conflict on the same guide, keep newest losing draft and exact local JSON backup; winner/legacy raw stay unchanged across pagehide and multiple debounce windows. |
| Reload safety | Failed explicit reload preserves full losing draft and sticky unavailable state; successful reload adopts winner and resets history. |
| Independent guides / deleted guide | Different guide commits coexist; stale save cannot resurrect tombstone; exact next-revision restore succeeds. |
| Raw incompatible recovery | Legacy raw seeded before first bootstrap, exact unknown raw retained. Higher future schema 99 creates unique exact recovery copies before fallback save; copies survive later saves. |
| Recovery write failure | Injected recovery put failure blocks creating durable fallback, original raw unchanged, no guide record, attempted draft has explicit downloadable JSON backup. |
| Console / failed check enforcement / cleanup | Driver, review, responsive, reliability capture console.error plus pageerror. Assertions/strict boolean gate return nonzero on failures. Browser/context cleanup uses finally; inherited owned Vite-server cleanup retained. |

## Durable editor proof and prototypes

All paths below are under `docs/phase-3/audits/2026-10-06-overhaul/editor-proof/`:

- `driver-checks.json` (29 true), `review-checks.json` (22 true, errors empty, axe empty), `editor-evidence.json` (51 true, viewport/control metrics and observed bounds, errors empty).
- `{320,390,768,1440}-five-group-editor.png`: five groups with one containing twenty pictures, stable short-group dimensions.
- `{320,390,768,1440}-text-zoom-200.png`: 32px root text-size simulation; recorded overflow ≤1 CSS px.
- `{320,1440}-workplace-prototype.png`: three-step Prepare the workplace guide (Wash hands/Soap; Chop onion; Food container).
- `{320,1440}-workplace-context.png` plus `-workplace-context-viewport.png`: full-page and actual viewport sheet/panel state, including visible Close/search. Viewports have height 900 CSS px.
- `{320,1440}-routine-prototype.png` and `-routine-reader.png`: Get ready (Wash hands; Brush teeth; Get dressed).
- `workplace-prototype.json` and `routine-prototype.json`: editable schema-2 documents captured from the shown session, not separate reconstructed prose. The normal prototypes use canonical artwork IDs/category pairs (including action.chop/action and tool.container/tool); intentionally unknown cases stay in the dedicated negative semantic fixture.
- `keyboard-editor.png` and `semantic-editor-review.png`: end states of actual keyboard and semantic/locale flows.

Root independently inspected refreshed 320px workplace/prototype/modal viewport, 1440px adjacent panel, and 320px routine reader. Root confirmed the previously observed issues resolved: first picture in the initial phone viewport, deliberate Settings, reduced repeated title chrome, bounded tiles, numbered sequence headings, clear offered Container/Soap, usable visible Close/search, and uncluttered reader. This is technical/rendered visual observation, not participant comprehension/device acceptance. Prototype source paths were sent to root/output owner for matching label/card/sheet/large evidence.

## Owned files changed/added

Production:

- `src/app.tsx`, `src/main.tsx`, `src/state/ui.ts`, `src/styles/global.css`.
- `src/state/authoring.ts`, `src/state/authoring.test.ts`.
- `src/lib/instruction-reading.ts`, `src/lib/instruction-reading.test.ts`.
- `src/components/MyGuides/MyGuides.tsx`.
- `src/components/InstructionEditor/InstructionEditor.tsx`, `EditorGroup.tsx`, `EditorPicture.tsx`, `editor.css`.
- `src/components/AuthoringPanel/AuthoringPanel.tsx`.
- `src/components/InstructionReader/InstructionReader.tsx`.
- `src/components/TokenPicker/TokenPicker.tsx`.
- `src/components/TokenDetails/TokenDetails.tsx`, `AttachmentFields.tsx`.
- `src/components/StepDetails/StepDetails.tsx`.
- `src/components/Toolbar/Toolbar.tsx`.
- Original-owner coordinated additions in `src/i18n/en.ts`, `de.ts`, `messages.ts`, `messages.test.ts`.

Authorized browser adaptations:

- `.claude/skills/run-instruction-builder/driver.mjs`, `review-check.mjs`, `reliability-check.mjs`.
- New `.claude/skills/run-instruction-builder/editor-browser-helpers.mjs`, `responsive-editor-check.mjs`.
- `scripts/check-browser.mjs`: add responsive checker to browser mode, preserve inherited server cleanup and strict exit behavior.
- Durable proof directory above and this implementation report.

No changes by this worker to catalog artwork, guide repository/controller/preferences, attachment-label helper, physical planner/font/layout, output/PWA/offline modules/scripts, docs/milestones, or release audit ownership. Other visible shared-worktree changes belong to their workers and are excluded from this delivery.

## Self-review and remaining concerns

Self-review followed controller/session boundaries, deep cloning/unknown field preservation, final-index moves/history, raw recovery and stale-tab behavior, mode/board duration semantics, warning/non-warning reference fallback, accessibility names/order, native modal teardown/opener fallback, responsive minima/wrapping, language isolation, output guide identity/opener capture, and runner enforcement/cleanup. The observed dependency/label/role issues above were fixed and rerun; no known remaining editor correctness failure is being handed off.

1. Task 5 output modal hookup/removal of the inert legacy compatibility canvas awaits that package's equivalent format parity and independent approval. The temporary Print/Download message is explicit; it does not claim a file has been prepared. Root requested this initial editor handoff before final output hookup.
2. Optional drag convenience is deferred under the authoritative index/controller ruling. All primary tap/keyboard ordering and attachment/history behavior is implemented/tested. Retained legacy source is inert; no new drag shortcut is advertised.
3. Software-keyboard/rotation tests on real mobile devices, actual screen-reader navigation, supported child authoring, and recipient meaning/comprehension remain pending. Dynamic-height/sticky-close behavior and native focus were observed in Chromium viewports only.
4. Matching actual-size label/card/sheet/large artifacts and 100% printer checks are coordinated with Task 5/6 using the saved JSON. Screenshots and 200% text simulation do not establish physical readability, 8mm symbol comprehension, or printer calibration.

Controller owns serialized checkpoint/commit and fresh independent review. This worker does not self-approve its implementation.
