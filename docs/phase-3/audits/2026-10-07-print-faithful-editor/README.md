# Print-faithful editor handoff — 7 October 2026

The editor now shows the actual physical print layout. Opening picture/group controls, changing window width or adding quantity/warning/time no longer stretches pictures or changes row height. A fresh session starts with A4 portrait; creators can select labels, A6 cards, A3 or custom paper and deliberately change screen zoom.

This implements the user's latest canvas and editing corrections. The earlier [overhaul handoff](../2026-10-06-overhaul/implementation-report.md) remains the historical record for libraries, local guides, persistence and original graphics. The [specification](../../../superpowers/specs/2026-10-07-print-faithful-editor.md) and [completed implementation plan](../../../superpowers/plans/2026-10-07-print-faithful-editor.md) define the current editor contract.

## What changed

| Requirement | Finished behavior |
| --- | --- |
| Equal pictures and stable rows | Fixed physical cells, symbol sizes, caption/detail lanes and row pitch per format. Pictures fill horizontally and then wrap; attachment edits cannot grow a row. |
| Truthful canvas | Editor, preview and SVG/PNG/PDF use the same measured millimeter plan and SVG renderer. The desktop panel overlays the app without consuming canvas width. Narrow screens pan the paper; only explicit zoom changes its scale. |
| Add picture near the group name | Header Add picture remains visible at both horizontal pan extremes on 320/390px screens. Compact formats use an unscaled group control rail when the physical heading cannot hold usable controls. |
| Remove dot handles and Group actions | Whole pictures support mouse/pen dragging. Activating the group name opens editing; an untitled board has an editor-only rename placeholder. No dot artwork or Group actions button remains. |
| Convenient fields | Picture name, quantity, structured days/hours/minutes/seconds and warning are immediately available. Group name/time are primary. Optional text, copy/paste/duplicate, movement and removal stay under Actions. |
| Touch and accessible movement | Ordinary pictures allow touch scrolling. Actions → Move picture arms the selected tile before the next gesture and closes the sheet. Keyboard movement, cancel, Undo/Redo and cross-page movement preserve identities and attachments. |
| Safe fixed-size overflow | Required text is never shrunk or clipped to fit. Named issues block physical exports and retain editable current-source targets. Full JSON backup remains available, including unsupported text and unknown authored meanings. |

Sheet/card/custom cells are 44 × 40 mm with 15 mm symbols; A3 uses 64 × 52 mm cells and 25 mm symbols. Labels use 46 × 25 mm portrait or 26 × 46 mm landscape cells with 10 mm symbols. Existing printable margins remain part of the shared plan. Interface themes never alter paper, pictograms or exported colors.

Print choices are session-scoped per guide and shared with Print / Download. Switching guides keeps their choices within that session; a new app session returns to defaults. Selecting all groups includes newly added groups. Explicit subsets remain accessible through Show all groups. These choices do not add fields to authored JSON. Captured output still requires explicit Refresh after source edits, and closed/stale requests cannot download another guide's content.

## Verified final source

Final checks used Node 24.19.0 and isolated Chromium contexts on Windows. The user's browser storage was not used. All commands below exited 0 after the final source changes.

| Gate | Result / evidence |
| --- | --- |
| Unit tests | `npm test`: 561 tests across 40 files |
| Tooling tests | `npm run test:tooling`: 7 tests |
| Lint and build | `npm run lint`, explicit ESLint for ignored browser drivers, and `npm run build` pass. Build includes TypeScript checking. |
| Full browser acceptance | `npm run test:browser -- docs/phase-3/audits/2026-10-07-print-faithful-editor/integrated-browser`: **452 strict true checks**, no console/page errors in the nine recorded result sets, plus successful persistence/recovery scenarios |
| Compact form checks | [Forms record](forms/README.md): 73 strict true checks in EN light / DE dark, desktop/mobile; invalid input, unchanged imported meaning, draft/history reconciliation and native focus containment |
| Production offline/update checks | `npm run test:pwa -- docs/phase-3/audits/2026-10-07-print-faithful-editor/pwa`: 49 cold-install checks for all four output formats, waiting-update fixture and actual old/new production-app offline PDF scenarios |
| Independent review | No remaining blockers. [Font recovery](review/font-recovery.json) and [paste/tiny-target focus](review/final-focus.json) probes preserve the reproduced findings and final results. |

The nine full-browser result sets contain 30 authoring, 22 semantic review, 79 responsive, 55 transitions, 26 output integration, 57 export, 35 header/theme, 30 drag and 118 physical-editor checks. The focused form and standalone physical checks are additional runs, not included twice in the 452 total.

The final production bundle is 464.83 kB / 131.17 kB gzip; CSS is 37.60 kB / 6.97 kB gzip. Sixteen offline assets use cache `instruction-builder-v2-6157f4775bfb5dd0`. The physical canvas prepares its bundled font online; offline reload retrieves it from the installed service-worker cache after browser HTTP-cache clearing. Output converters remain lazy. The actual-app waiting-update test additionally builds two instrumented versions of this source and verifies old-client asset retention and new-client activation.

## Evidence to inspect

- [Physical canvas regression record](browser/README.md), [final full-suite results](integrated-browser/print-faithful-editor/results.json) and [standalone proof](browser/proof/results.json): exact dimensions, fixed rows, panel invariance, viewport/pan bounds, actual editor/download SVG equality, overflow/font repair, original indices and native touch.
- [Desktop canvas](browser/proof/desktop.png), [320px Add control](browser/proof/add-picture-320-start.png), [390px panned canvas](browser/proof/add-picture-390-end.png), [untitled board rename](browser/proof/untitled-board-group.png) and [German dark mobile fields](forms/after/de-mobile-picture.png).
- Actual [labels-mode SVG](browser/proof/download-page.svg), [pictures-mode SVG](browser/proof/pictures-download-page.svg), [detailed-mode SVG](browser/proof/detailed-download-page.svg) and 23 full-suite export artifacts beside [export results](integrated-browser/export-review-results.json).
- [Cold offline record](pwa/pwa-check-results.json), [waiting update](pwa/pwa-update-results.json) and [actual-app old/new offline PDFs](pwa/actual-app/actual-app-update-results.json).

The work corrected real findings around cached-font focus after Read, recovery from failed font preparation, hidden Actions descendants in modal Tab handling, premature clearing of armed touch state, duplicated tiny physical focus targets, narrow-screen Add cropping and invisible blank-group rename. Earlier RED evidence and checker investigation are retained. The [browser record](browser/README.md) distinguishes product findings from locator assumptions and the full-page screenshot resize that interfered with a held touch gesture.

## Next stage

Engineering checks are complete locally. Use the existing [creator/recipient tasks](../2026-10-06-overhaul/creator-and-recipient-tasks.md) and [practical results template](../2026-10-06-overhaul/practical-acceptance-template.md) to finish acceptance of the new editor.

1. Have workplace creators and teachers/parents make a short guide from their own task. Record assistance needed to find, add, rename, move and print pictures; repeat with children and their customary support where appropriate. Prioritize observed editing blockers over adding features.
2. Print current label/card/A4/A3 exports at actual size. Measure margins, warning readability, grayscale contrast and intended viewing distance. Update the shared physical metrics only with repeated affected export checks; historical sample PDFs describe earlier geometry.
3. Exercise real iOS/Android keyboards, touch movement, rotation, downloads and offline use, plus VoiceOver/NVDA reading and focus. Headless viewport checks do not establish these outcomes.
4. Review pictogram interpretation with recipients and resolve ambiguous canonical meanings. The owner still needs to choose the original artwork's distribution license before public release, as recorded in [license status](../../../artwork/LICENSE-STATUS.md).

The development server remains available at `http://127.0.0.1:5173/`. No push, merge or deployment was performed.

## Subsequent visual correction

The [centered-pictogram record](../2026-10-07-centered-pictograms/README.md) moves each pictogram to the exact center of its existing cell, places time below it, and replaces diagonal row turns with orthogonal bottom-center/top-center routes. The [print layout contract](../../../print-layout-contract.md) defines the stable anchors and reserved zones for future changes. This dated record's test counts and screenshots describe the preceding placement.
