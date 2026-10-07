# Task 3 App output integration review

Frozen range: `01e49ad..1517d8b`.

Spec compliance: **APPROVED for this bounded integration**.

Task quality: **APPROVED**. No actionable findings in the reviewed delta.

## Scope and method

Read `task-3-output-integration-report.md` and consumed `review-01e49ad..1517d8b.diff` once. Inspected the named integration seams at frozen head `1517d8b`: App, its editor-owned CSS, the new integration driver, and the existing AuthoringPanel/OutputDialog request cleanup reached by App. Checked the relevant shared/editor contracts and the frozen integration results. Artifact/deletion sections did not require repeated image inspection; root owns the visual inspection of `app-output-modal.png`.

This review does not review my Task 4 implementation, the active Task 5 checker/legacy cleanup/proof correction, or final release acceptance. No production or Git/index edits, children, broad gates, or new browser probes were run. The supplied fresh checks were used because source inspection revealed no concrete concern needing a new probe.

## Reviewed behavior

- `src/app.tsx:83` passes exactly the four required props. The document and guide identity are live signal values; the output locale is captured when Print / Download opens (`:68`). App creates no second session, output controller, reading projection, or option store.
- App captures the actual opener and explicitly restores it after unmount if it survives (`:20`, `:65`, `:68`). Opening output preserves the mounted desktop detail/picker component, so unsaved desktop fields retain their state. The existing panel Escape guard respects an open native modal; App document shortcuts also suspend on native dialogs/output (`:29–37`).
- The guide-identity render guard (`:26`, `:38`, `:83`) unmounts output immediately on another active guide. OutputDialog's existing unmount cleanup disposes its request controller; generation/source-consent checks reject pending preparation and download completion after disposal. The live immutable document prop reaches `observeSource` before readiness is rendered, preserving stale-preview rejection and explicit Refresh behavior.
- Opening at phone width closes authoring before mounting output (`:68`). While output remains visible, the breakpoint listener closes authoring when a desktop viewport crosses below 768 px and removes its listener on close/identity change/unmount (`:39–46`). This preserves the required one-modal seam while allowing the desktop draft to survive ordinary output close.
- The generic editor label selector now excludes output descendants (`src/components/InstructionEditor/editor.css:8`), allowing component-local flex checkbox rows. The hidden canvas imports/mount and its editor/global native-print compatibility styling are removed. Recipient reading returns its isolated view before the editor/output markup (`src/app.tsx:66`).
- The new driver uses actual App boot/native IndexedDB and downloads, reuses a supplied runner URL or owns an ephemeral Vite server, enforces strict boolean results, records console/page errors and failures, closes each context in `finally`, and closes its browser/server after evidence recording. The future runner handoff is explicit; this delta does not claim that root's settled runner was already wired.

## Verification evidence and limits

The frozen `app-output-integration.json` contains **26 true checks and zero errors**, matching the report. Its cases cover live-source invalidation and subset-preserving Refresh, captured locale, native Tab/shortcut isolation, Escape/opener restoration, preserved desktop draft, phone resize modality, guide-change unmount, recipient isolation, shared semantic content, required structured values/warnings, and actual SVG/PNG/PDF/JSON downloads.

The author additionally reports fresh **53 transition checks**, **463 unit tests across 37 files**, typecheck and lint passes, plus explicit lint of the normally ignored integration driver. These supplied passes were not rerun by this review. The integration signature/dimension checks are useful App wiring evidence; they do not replace Task 5's independent rendered font/artifact proof.

Task 5's remaining cleanup/checkers, root's settled build/browser/PWA/release gates, actual devices/software keyboards/screen readers, printer calibration, and participant/physical readability acceptance remain pending outside this approval.
