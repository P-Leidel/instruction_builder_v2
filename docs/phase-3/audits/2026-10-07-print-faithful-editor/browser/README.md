# Print-faithful editor browser regression

The standalone driver is [check-print-faithful-editor.mjs](../../../../../scripts/check-print-faithful-editor.mjs).

    node scripts/check-print-faithful-editor.mjs <output-directory> [url]

Omitting the URL starts an owned Vite server on an ephemeral loopback port. The driver closes that server, Chromium, every isolated browser context and the mobile CDP session. Fixtures are imported through the actual guide workflow into fresh native browser storage; no user profile or existing guide collection is used. Both console errors and page errors are recorded.

## Fresh result

    npx eslint --no-ignore scripts/check-print-faithful-editor.mjs
    node scripts/check-print-faithful-editor.mjs docs/phase-3/audits/2026-10-07-print-faithful-editor/browser/proof

Both commands exited 0. [proof/results.json](proof/results.json) records **118 strict true checks**, an empty errors array, and measured paper/cell rectangles. Node was v24.19.0 on Windows. No product, Git or dependency changes were made by this checker author, and no existing broad gates were repeated.

The checks cover:

- A4 physical dimensions and fixed cells/row pitch; top/auxiliary Add picture controls and removal of dot artwork.
- Every Add picture button stays fully within both the window and its clipping canvas viewport at 320px and 390px, at both horizontal pan extremes. Paper dimensions, physical cell rectangles and the complete printed SVG remain unchanged.
- An untitled board group has a measured visible Group 1 rename placeholder, opens Group title, retains its absent authored title and does not invent a printed group heading or change physical geometry.
- Unchanged physical cell positions after opening the overlay, adding/changing quantity/warning/time, resizing the viewport and switching content modes; only explicit zoom changes scale.
- All five presets, custom landscape, 44px access at small zoom and invalid custom-size repair.
- Actual downloaded SVGs matching the editor in labels, pictures and detailed modes. The comparison preserves vector order, IDs, clip/mask references, all inner style/paint/geometry attributes and literal SVG text. It ignores only editor root accessibility/classes/style and namespace serialization.
- Shared group-subset hiding and Show all groups recovery.
- Unsupported text, overflowing required warnings and intentionally malformed font bytes: current finite repair targets and forms remain accessible, physical downloads block, and exact full JSON backups remain available. Unsupported text can be repaired into a printable guide.
- Ordinary phone scrolling; explicit Actions → Move picture arming before touch; stationary canvas/banner during the gesture; one move preserving IDs/attachments; Undo/Redo; pointer cancellation and return to normal scrolling policy.
- Correct original source indices within a continuation segment and across pages, with each move reversed by one Undo.

Primary artifacts are [desktop.png](proof/desktop.png), [phone-held-touch.png](proof/phone-held-touch.png), [phone-final.png](proof/phone-final.png), [label-50-percent-controls.png](proof/label-50-percent-controls.png), [320px Add visibility](proof/add-picture-320-start.png), [390px after panning](proof/add-picture-390-end.png), [untitled board rename](proof/untitled-board-group.png), actual [labels SVG](proof/download-page.svg), [pictures SVG](proof/pictures-download-page.svg), [detailed SVG](proof/detailed-download-page.svg), and the failure-recovery screenshots/backups in the proof directory.

## RED and investigation history

[red/results.json](red/results.json) is the intended first failing run: physical_page_regions_exist was false, exit 1 and no browser errors before the new physical editor API existed.

Increment 1 failed because the initial checker incorrectly treated the retained heading data-group-drag identity as dot artwork. That attribute is on a handleless group-name button; the corrected assertion tests the old actual handle controls. Increment 3 incorrectly required an auxiliary picture list even when the label's physical target already met 44px at 50% zoom. The final assertion requires a usable physical target or a usable unscaled alternative. These are checker corrections, not claimed product defects. Increments 2, 4 and 5 preserve the corresponding successful 35-, 75- and 97-check runs.

[increment-6/results.json](increment-6/results.json) preserves the first 118-check run after the root's sticky Add and board placeholder corrections. The final canonical run strengthens placeholder visibility to actual painted text dimensions and verifies that no group-source heading fragment is added to the SVG; all 118 checks remain true.

[touch-diagnostic/results.json](touch-diagnostic/results.json) records a separate driver interference reproduction: a centered held touch at client y449 retained the armed state and ghost, then a **full-page screenshot emitted a resize**, changed scrollY from 477 to 348, and correctly cancelled the gesture. The final driver takes only a viewport screenshot while a pointer is held; full-page captures occur after release/cancellation. An earlier diagnostic setup omitted the English locale required by the existing import helper and timed out before any gesture; the corrected trace uses a fresh English context and has no browser errors.

## Limits

These are Windows headless Chromium engineering checks, not physical-print, real-phone, screen-reader or participant acceptance. Geometry mutations deliberately use real session actions inside isolated contexts; compact form validation/draft reconciliation and the wider browser/PWA/export gates remain separate owner checks. The injected bad font is a bounded recovery case, not an offline-cache acceptance claim.
