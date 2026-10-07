# Task 3 App output integration

Status: DONE. Task 3 correction approval at bae7729 and bounded Task 5 approval at fe5f225 preceded this integration. App now mounts the reviewed actual output component. Source edits stopped for root checkpoint/fresh integration review. No Git/index mutations, children, root runner edits or Task 5 source edits.

## Exact production delta

- `src/app.tsx`: import named `OutputDialog` and replace the integration-pending ModalDialog with exactly its frozen four props: live immutable `sourceDocument={documentSession.document.value}`, live `guideId={activeGuideId.value}`, captured opening `locale={output.locale}`, and `onClose={closeOutput}`. Remove InstructionCanvas/exportLayout imports and the inert hidden canvas mount.
- App's existing opening state captures guide identity, locale and the actual Print/Download opener. Its guide-identity render guard immediately unmounts output when guide changes; the existing effect clears opening state. OutputDialog unmount cleanup disposes its request controller. Document keyboard shortcuts remain suspended while output is visible/native modal is open; explicit close restores a surviving opener after unmount.
- Preserve desktop detail/picker draft behind native output; below 768px, close authoring before opening output. Add an output-visible breakpoint listener that closes authoring if an open desktop output crosses into phone width. Listener cleans up on close/guide change/unmount. No new output options/controller/session were created in App.
- `src/components/InstructionEditor/editor.css`: remove its hidden-canvas zero-box compatibility rule. Exclude output-dialog labels from the generic editor grid-label rule so OutputDialog's local checkbox flex rows retain their intended layout.
- `src/styles/global.css`: remove the obsolete 70-line hidden export canvas/native-print compatibility block whose only printable source was the removed canvas. Other legacy styles/source remain for their owners' cleanup. The new physical download path is the actual reviewed OutputDialog, with no hidden editor DOM serialization.

Task 5 legacy exporters/document-actions export removal belongs to that owner after this handoff. `scripts/check-browser.mjs` belongs to root and was untouched. No output/PWA component/API or catalog/message tables were edited.

## Integration findings and TDD evidence

1. Added `.claude/skills/run-instruction-builder/editor-output-integration-check.mjs` before App hookup. Genuine RED against the old placeholder: `APP_MOUNTS_REVIEWED_OUTPUT_DIALOG`, 0 versus 1. Retained in `app-output-integration-red.json`. Replaced the placeholder with the reviewed four-prop component and removed obsolete canvas/styles.
2. Full-App rendered inspection exposed my generic `.app label` grid rule overriding component-local OutputDialog checkbox row layout. Added a computed-layout assertion; genuine RED was `grid` versus `flex`. Scoped the editor-owned label rule to exclude output descendants. The assertion and visible checkbox/text rows now pass; no peer stylesheet was changed. The actual RED command/output is recorded here: `node .claude/skills/run-instruction-builder/editor-output-integration-check.mjs docs/phase-3/audits/2026-10-06-overhaul/editor-proof`, exit 1, `OUTPUT_CHECKBOX_ROWS_KEEP_COMPONENT_LAYOUT: 'grid' !== 'flex'`.
3. Added full-App desktop→320px output-open resize coverage. The checker waits for the authoring panel to finish adapting before measuring modality; genuine RED: two native dialogs versus one. Root accepted the resulting App breakpoint guard. RED retained in `app-output-integration-resize-red.json`; after correction one output modal remains and the 26-check run passes.

Two test harness corrections did not change production behavior: use existing exact whole-message Select groups instead of a guessed name; reopen the semantic disclosure after preview regeneration before asserting visible accessible items. A first resize observation before responsive adaptation was insufficient; the final test waits for actual adaptation, which exposed and then verified the real defect. No arbitrary sleep or weakened boolean predicate was used.

## Fresh verification

| Command | Observed result |
| --- | --- |
| `node .claude/skills/run-instruction-builder/editor-output-integration-check.mjs docs/phase-3/audits/2026-10-06-overhaul/editor-proof` | 26 checks passed, exit 0, zero console/page errors after final resize correction |
| `node .claude/skills/run-instruction-builder/editor-transition-check.mjs docs/phase-3/audits/2026-10-06-overhaul/editor-proof` | all 53 approved attachment/history/reload/modal/focus checks pass against actual OutputDialog, exit 0, zero console/page errors |
| `npm test` | 37 files / 463 tests passed, exit 0; final run began 18:36:06 local |
| `npm run typecheck` | exit 0 after final App guard |
| `npm run lint` | exit 0 after final App guard/styles |
| `npm exec eslint -- --no-ignore .claude/skills/run-instruction-builder/editor-output-integration-check.mjs` | exit 0; explicit check because hidden browser-script directory is normally ignored |

No full-gate blockage at these runs. Existing broad browser/build/PWA/export suites were not represented as rerun passes; root/Task 5 own settled entrypoint wiring, legacy removal and final release gates.

## Full-App browser coverage

The new focused script uses actual App boot, native IndexedDB, fresh guides and native downloads at 1440×900, then a 320×900 responsive transition. It checks:

- Actual reviewed output component mounts; legacy canvas is absent. Native Tab containment and document Ctrl+Z/paste suspension preserve source content.
- Shared ReadingContent in output exposes one main accessible item per selected picture, full authored names in Pictures-only, required blank-label quantity/token/group times, warning context, and unordered board semantics without procedural totals.
- Selecting a subset changes visible semantic content. A programmatic immutable source edit makes live App output stale and disables PDF consent; explicit Refresh adopts current source while preserving the intentional subset.
- Real UI downloads SVG, PNG and PDF. SVG is explicitly 210×297mm; PNG has the actual PNG signature and 1240×1754 pixels at 150 dpi; PDF has the actual PDF signature. The output JSON backup contains the complete captured document, including unselected group content, rather than only the physical subset.
- UI locale changing behind the modal does not replace its captured opening locale. Escape restores the Print/Download opener and retains the desktop unsaved amount draft.
- Narrowing output-open desktop to phone width leaves one native modal after responsive adaptation. A guide activation unmounts output/preparation, and recipient reading subsequently contains no output/editor/hidden canvas controls.

The unchanged 53-transition script also verifies actual output Escape/opener/draft behavior, direct mobile output opening with one sheet, quantity/time/group Undo/Redo/removal/reload, and non-first empty-group Read return. All source changes stay in App/editor-owned styles; no second storage/session/reading/output policy.

## Durable artifacts and runner handoff

All below live in `docs/phase-3/audits/2026-10-06-overhaul/editor-proof/`:

- `app-output-integration.json`: 26 true checks and empty errors.
- `app-output-integration-red.json`: original missing-hookup RED.
- `app-output-integration-resize-red.json`: genuine adapted two-modal RED.
- `app-output-modal.png`: actual 1440px viewport, output scroll returned to top, visible Close/settings/preview and corrected checkbox rows. UI behind modal is German while output's captured locale is English; background is native-inert.
- `app-output-page.svg`, `app-output-page.png`, `app-output.pdf`: actual downloaded selected-group files.
- `app-output-backup.json`: full captured source document, including unselected group.
- Refreshed `editor-transition-all.json` and transition screenshots retain the 53 approved checks with actual output.

Root can add `['editor-output-integration-check.mjs', outputDirectory, serverURL]` to its sequential browser runner. A supplied URL reuses the runner server; absent URL/`-` uses an ephemeral owned Vite server. Script captures console.error/pageerror, strictly enforces true checks, saves evidence and cleans context/browser/server in finally even on assertion failure. Existing root runner was not edited.

Self-review checked frozen props/live source, captured locale/guide/opener, guide-change unmount, shortcut/modal isolation, desktop draft preservation, mobile resize/open seam, local-style precedence and removal of the inert old serialization path. Observed screenshot layout has visible Close and appropriately adjacent checkbox text; no physical readability/participant suitability is inferred from it. The new actual files use the already-reviewed renderer; this small integration signature/size test is not a replacement for Task 5's independent artifact/font/line/physical comparisons.

No known remaining App integration failure. Task 5 legacy removal, root settled build/browser/PWA/release gates, physical printer calibration and real device/software-keyboard/screen-reader/participant acceptance remain separate pending work. Source stopped for checkpoint/review.
