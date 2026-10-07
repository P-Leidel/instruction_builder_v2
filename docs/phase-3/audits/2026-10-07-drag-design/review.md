# Independent drag/design review

Reviewed 7 October 2026 by the independent reviewer, against the working delivery after the header/theme checkpoint. No production, test, Git or dependency changes were made by this reviewer.

## Initial decision: changes requested

One P2 cancellation defect must close before approval. The resolver, existing action integration and the other reviewed wiring have no additional blocking finding.

### P2 — cancelled pointer release still invokes a normal click

Initial reviewed source: `src/state/editor-drag.ts:78–82`, `108–120`. The release path suppressed compatibility clicks only when `moved` was true. Escape before that threshold set `cancelled` but allowed the release click; blur immediately removed the release listener, also allowing that click after an established drag.

Independent reproduction used fresh owned Vite servers and fresh headless Chromium contexts, with service workers blocked and native guide import. Commands were inline `node --input-type=module` probes using the existing browser helpers; all browser/server resources closed in `finally`.

| Gesture | Observed result |
| --- | --- |
| Picture pointerdown → Escape before threshold → pointerup | Picture details opened; ghost absent; errors empty. |
| Desktop Apple picker pointerdown → Escape before threshold → pointerup | Authored token count changed from 1 to 2; picker closed; errors empty. |
| Established picture drag → dispatched window blur → pointerup | Picture details opened; ghost absent; errors empty. |
| Ordinary mouse click on picture handle | Picture controls opened as intended. |

Suppress the cancelled gesture's compatibility click, including cancellation before threshold and lifecycle aborts, while preserving the next intentional pointer click and keyboard activation. The library case demonstrates an actual unwanted document mutation after explicit cancellation. Regression coverage should include that case, not only Escape after movement.

### P3 — picture handle is anchored to review notices

`src/components/InstructionEditor/editor.css:51` positions the handle relative to the entire picture list item. That item also contains imported-picture/warning review notices. A fresh 390px fixture with an unknown main picture and unknown warning placed the 44px handle at vertical coordinates 690–734 while the warning notice occupied 660–723, outside the reserved handle area of the picture button. Anchor the handle to the picture control region so notices retain their reading space. Ordinary known-picture fixtures do not expose this layout issue.

## Reviewed behavior and limits

The DOM resolver preserves document indices before source removal, uses wrapped row geometry, rejects nonfinite/hidden rectangles and supports empty destinations. Commits use the existing session actions; pictures retain IDs and attachment objects, and no document writes occur during movement. The controller captures guide/document identity, filters nonprimary/right-button pointers, refreshes geometry, performs final release resolution and retargets an open picture panel after a successful cross-group move. Mobile native picker modals retain tap insertion; desktop picker dragging uses the actual destination and allocates a new ID at commit.

Handles have 44px targets and keyboard/tap paths to existing move controls. Touch suppression is limited to handles; ordinary tiles keep page scrolling. The fixed light document-surface tokens remain, no More menu was added, and the spacing changes do not alter the physical output renderer.

This initial decision is a scoped source review plus the focused independent probes above. It does not claim that the root's still-running full functional/browser gates passed. The captured initial functional result had 24 passing checks and a later timeout; final root evidence remains to be assessed after correction. Physical touch hardware and assistive-technology behavior are outside these headless probes.

## Scoped correction review: approved

The original P2 and P3 above are resolved. No remaining actionable source finding was identified in the correction delta.

`editor-drag.ts` now suppresses release clicks for moved, cancelled and invalid gestures. Lifecycle aborts arm a pointer-specific release guard before tearing down the active drag; a new press or pointer cancellation clears that guard. Ordinary successful release cleanup does not arm it. Escape remains consumed before desktop panel handling. `EditorPicture.tsx` now wraps the picture button and handle in `.editor-picture__tile`, and the corresponding CSS makes that wrapper the positioning ancestor while leaving both review notices outside it.

The independent reviewer reran the original Escape, blur, library and handle-click reproductions against the correction using the same fresh-server/context method. The focused command exited 0 with **15 strict passing assertions and `errors: []`**:

- Early Escape left details closed and the document unchanged.
- Blur removed the ghost, left details closed and preserved the document.
- Early library Escape preserved the exact document and kept the picker open.
- The next intentional picture click and library click worked; the latter inserted exactly once.
- Ordinary handle click and keyboard Enter still opened move controls.
- The original 390px unknown-picture/unknown-warning fixture kept the 44×44px handle inside the picture wrapper and clear of both notices.

For that layout fixture, the corrected handle occupied y545–589, the picture wrapper ended at y594, and the notices began at y602 and y660. This closes the original misplaced-handle observation without hiding either notice.

The approval is an independent scoped source/correction decision. Root owns final broad functional, responsive, unit/build and offline acceptance evidence; the separately investigated mixed-CDP mobile driver timeout was not duplicated or declared resolved by this reviewer. No source/Git changes or broad green-gate repeats were performed here.
