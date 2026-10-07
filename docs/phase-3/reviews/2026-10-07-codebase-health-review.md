# Codebase health review — 7 October 2026

> 📌 **Doc status: CURRENT** — dated assessment of this checkout after the fixes below. Findings are open unless marked fixed; the source line references describe this review's snapshot.

The core architecture is sound: document sessions, revision/raw-baseline conflict protection, one measured print plan, a shared renderer, and semantic reading are useful boundaries. Automated coverage is substantial. The principal debt is reliability at storage/input boundaries, retained obsolete implementations, and an authoring UI that exposes too many controls. Broad release still needs the existing device, participant and physical-print acceptance work.

## Fixed during this review

| Change | Reference |
| --- | --- |
| **P1: Undo could save a reverted edit and show Saved.** Cancel a queued write when returning to the committed snapshot; if a write is already in flight, persist the restored snapshot afterwards. Two regressions failed before the fix and now pass. | [guides.ts:55](../../../src/state/guides.ts#L55), [guides.test.ts:117](../../../src/state/guides.test.ts#L117) |
| Keep native field undo/redo separate from guide history; respect consumed keyboard events. Verified real field undo plus picture-focused guide undo/redo. | [app.tsx:35](../../../src/app.tsx#L35) |
| Update the document's language when switching English/German UI. | [app.tsx:31](../../../src/app.tsx#L31) |
| Claim import/failed-draft creation synchronously; prevent repeated submissions and dismissal during import commit. A real blocked IndexedDB transaction reproduced duplicate guides before the fix. | [app.tsx:55](../../../src/app.tsx#L55), [AuthoringPanel.tsx:11](../../../src/components/AuthoringPanel/AuthoringPanel.tsx#L11) |
| Remove startup viewport tracking used only by the disconnected legacy canvas. | [main.tsx:17](../../../src/main.tsx#L17) |
| Exclude generated review/test artifacts from product lint; a saved diagnostic probe previously made a fresh lint run fail. | [eslint.config.js:9](../../../eslint.config.js#L9) |

The nine targeted browser checks run through the normal browser gate: [check-review-regressions.mjs:22](../../../scripts/check-review-regressions.mjs#L22), [check-browser.mjs:23](../../../scripts/check-browser.mjs#L23). An independent review found no blocking defect in the production fixes.

## Remaining bugs, in priority order

P2 means a reproducible functional problem to address; P3 means a smaller usability/semantic gap. These are separate from the design suggestions below.

| Priority | Trigger and impact | Next action / reference |
| --- | --- | --- |
| P2 | A valid imported note containing 150,000 newline characters throws `RangeError` in Detailed planning. The editor calls the planner without containment, so that mode can break rendering. | Bound text fitting before allocating/spreading fragments; return overflow and repair targets. [output-plan.ts:161](../../../src/lib/output-plan.ts#L161), [InstructionEditor.tsx:39](../../../src/components/InstructionEditor/InstructionEditor.tsx#L39). Actual bundled-font reproduction retained locally. |
| P2 | Tab A changes language/theme; stale tab B opens a guide and writes only `lastGuideId`. B replaces the complete preferences record with its old language/theme. | Merge the captured patch into the current record inside the transaction; decide whether other tabs update immediately. [preferences.ts:64](../../../src/state/preferences.ts#L64), [guides.ts:31](../../../src/state/guides.ts#L31). Reproduced with two controllers sharing storage. |
| P2 | A one-off startup storage failure remains latched after storage recovers. Guides can appear on refresh, but Open/Create remain unavailable; Reload has no active guide. Browser reload is the workaround. | Add explicit startup retry without clearing genuine conflict protection. [guides.ts:43](../../../src/state/guides.ts#L43), [guides.ts:77](../../../src/state/guides.ts#L77), [preferences.ts:29](../../../src/state/preferences.ts#L29). Reproduced with a single failed list operation. |
| P2 | Unknown picture `iconId: "x"`, authored label `"Cup"`, default A4 Labels mode: generated fallback plus label needs 12.3505 mm in an 11.5 mm caption lane. Export is blocked and incorrectly blames the short label. Pictures mode succeeds. | Choose fallback composition that retains the label and unknown identity within fixed geometry. [output-plan.ts:172](../../../src/lib/output-plan.ts#L172). |
| P2 | Empty imported step/token IDs pass validation, then truthiness checks disable clipboard operations. | Require nonempty IDs at the input boundary, or explicitly define normalization. Preserve rejected originals through recovery. [migrate.ts:33](../../../src/model/migrate.ts#L33), [migrate.ts:42](../../../src/model/migrate.ts#L42), [document.ts:535](../../../src/state/document.ts#L535). Reproduced import acceptance and no-op Paste. |
| P2 | PNG downloads have the correct 150/300-DPI pixel dimensions but no `pHYs` density metadata. Receiving software cannot infer the chosen millimeter size from the file. | Embed density or clearly document manual scaling; PDF/SVG already encode physical size. [output-export.ts:32](../../../src/lib/output-export.ts#L32). Parsed actual exports: 1240×1754 and 2480×3508, both density absent. |
| P2 | Entering Read or opening/creating a guide removes the focused control without assigning a destination. Source tracing finds no entry-focus effect; return-from-Read is already handled. | Focus an appropriate reader/editor heading or control after transition; verify with keyboard and screen reader. [app.tsx:64](../../../src/app.tsx#L64), [MyGuides.tsx:13](../../../src/components/MyGuides/MyGuides.tsx#L13). Runtime assistive-tool acceptance remains pending. |

Smaller follow-ups: choice-board editor groups use `<ol>` despite unordered choices ([InstructionEditor.tsx:67](../../../src/components/InstructionEditor/InstructionEditor.tsx#L67)); Read does not flag unknown quantity/time icon references ([instruction-reading.ts:28](../../../src/lib/instruction-reading.ts#L28)); Copy has no feedback despite an existing localized message ([TokenDetails.tsx:27](../../../src/components/TokenDetails/TokenDetails.tsx#L27)).

## Architecture and maintenance decisions

- **Retire the old implementation deliberately.** Legacy canvas/cards/chips, drag state, popovers/forms, confirmation dialogs and pagination helpers have no current runtime path after the startup fix. Their tests and comments still describe replaced behavior. Keep the live pointer-threshold helper. Start at [InstructionCanvas.tsx:1](../../../src/components/InstructionCanvas/InstructionCanvas.tsx#L1), [canvas.ts:70](../../../src/state/canvas.ts#L70), [pdf-pagination.ts:1](../../../src/lib/pdf-pagination.ts#L1). Shared old CSS forces new overrides: [global.css:504](../../../src/styles/global.css#L504), [editor.css:101](../../../src/components/InstructionEditor/editor.css#L101).
- **Narrow storage transactions.** Every operation reads all keys/values, including tombstones and recovery copies. This makes each autosave/preference write grow with total retained data. Use keyed reads and list cursors while preserving atomic revision/recovery checks. The code path is confirmed; practical slowdown is unbenchmarked. [guide-repository.ts:29](../../../src/lib/guide-repository.ts#L29), [guide-repository.ts:34](../../../src/lib/guide-repository.ts#L34).
- **Make verification ownership clearer.** CI browser tests depend on hidden `.claude/skills` scripts that ordinary lint excludes. Move maintained test drivers/helpers into an explicit test directory and lint them. [check-browser.mjs:30](../../../scripts/check-browser.mjs#L30), [eslint.config.js:9](../../../eslint.config.js#L9). Reconcile historical prose separately from current contracts; [ui.ts:20](../../../src/state/ui.ts#L20) still describes the former preview.

## UX and visual decisions

| Decision | Recommended direction | Reference |
| --- | --- | --- |
| Attachment editing and save semantics | Show label plus attachment summaries; expand Add quantity/time/warning as needed. Choose consistent immediate saving or explicit Apply with visible pending changes. Today labels save immediately, quantity/time need Save, and closing loses those drafts. Put notes beside content, rather than inside Actions. | [TokenDetails.tsx:16](../../../src/components/TokenDetails/TokenDetails.tsx#L16), [AttachmentFields.tsx:39](../../../src/components/TokenDetails/AttachmentFields.tsx#L39) |
| Output menu density | Keep size, content mode, preview and PDF prominent. Group background, metadata, group selection, DPI and per-page alternate formats under named advanced sections. Preserve the already simplified header. | [OutputDialog.tsx:57](../../../src/components/OutputDialog/OutputDialog.tsx#L57) |
| Mobile authoring readability | Preserve millimeter geometry; add a fit option and readable editing aids. Initial mobile 50% zoom still makes A4 about 397 CSS px wide and 9 pt captions about 6 CSS px. Zoom is retained when resizing from desktop, which can make overflow greater. | [InstructionEditor.tsx:33](../../../src/components/InstructionEditor/InstructionEditor.tsx#L33), [InstructionEditor.tsx:54](../../../src/components/InstructionEditor/InstructionEditor.tsx#L54) |
| Desktop contextual panel | Position it opposite the selected picture, or offer a docked alternative; the fixed right overlay can hide the item being edited. Use clearer grouping and spacing as controls are reduced. | [editor.css:97](../../../src/components/InstructionEditor/editor.css#L97) |
| Guide creation/list flow | Separate Blank and Example choices, or show each example's fixed type: the Guide type selector currently has no effect on examples. Make opening the main card action and duplication/deletion quieter secondary actions. | [MyGuides.tsx:18](../../../src/components/MyGuides/MyGuides.tsx#L18), [MyGuides.tsx:24](../../../src/components/MyGuides/MyGuides.tsx#L24) |

## Verification and limits

Fresh verification: **576 unit tests / 42 files**, **7 tooling tests**, lint, typecheck through production build, full browser gate, **9 targeted browser regressions**, production cold-offline exports and waiting-update lifecycle all pass. Current `npm audit` reports **zero advisories**. One Windows watcher warning occurred while parallel PWA/browser jobs wrote a PDF artifact; both gates completed successfully.

Reviewed active source, retained-code reachability, storage/import/recovery, output/fonts/drag, UI/CSS, test/CI tooling and actual desktop/mobile screenshots. Browser fixtures used isolated profiles. Detailed local evidence is in `artifacts/health-review/` (gitignored), including `planner-repros/results.json` and browser/PWA records; these files are not part of the portable report.

Chromium automation does not establish real iOS/Android, screen-reader, pictogram-comprehension or physical-print acceptance. Those checks and the recorded artwork distribution-license decision remain open: [known-issues.md:31](../../known-issues.md#L31), [LICENSE-STATUS.md:5](../../artwork/LICENSE-STATUS.md#L5). First address the remaining functional issues, then retire legacy code and trial the simpler authoring/output flows.
