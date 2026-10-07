# Stable print-faithful editing

The user wants fixed-size pictures, stable rows, no six-dot picture handles, Add picture at the top of each group, and convenient editing of names/time/quantity/warnings. The side menu must not scale or reflow the canvas. A4 portrait is the confirmed default; labels, cards, A3 and custom formats remain selectable. Existing stored guides and authored fields must survive.

## One physical layout

The running editor renders the same millimetre OutputPlan and detached SVG renderer as preview and SVG/PNG/PDF. Add explicit fixed cell, caption, detail and heading metrics per preset. Cells never stretch to fill surplus page width; column count depends only on printable physical width. Every row reserves the same cell height plus gap. Adding/removing metadata, opening controls, or changing viewport dimensions cannot change this geometry. Additional pictures fill horizontally and then occupy the next fixed row. The later [print layout contract](../../print-layout-contract.md) centers the pictogram on both cell axes and defines disjoint annotation zones, below-picture time and orthogonal cell-center row turns; it supersedes the initial side-stack placement.

Known warnings use their warning symbol plus authored meaning in a compact fixed side lane; unknown warnings retain explicit warning context. Quantity/time stay structured and visible. Printed text never shrinks, clips or silently disappears to fit a cell. Content exceeding a fixed lane produces a source-specific overflow issue. The editor must keep all offending pictures selectable for repair, including unsupported imported text. Failed composition supplies editing geometry but no exportable plan. Do not alter authored data to make it fit.

The planner exposes an `EditorLayout` containing fixed metrics and page/group/picture positions. Picture placements include step/token identity, original index and physical cell/picture boxes. Group segments include stable identity, heading/body/empty-drop boxes and continuation state. Each selected picture has one placement; continuations retain the original group identity. Excluded groups remain reachable through Show all groups. Invalid options or unavailable fonts use a current-source repair list rather than a stale printable SVG. Existing label/card whole-group overflow rules remain; additional draft pages keep repair targets reachable while export remains blocked.

Implemented fixed cells are 44 × 40 mm for sheet/card/custom and 64 × 52 mm for A3. Labels reserve 46 × 25 mm in portrait and 26 × 46 mm in landscape. Orientation-specific label lanes preserve useful single-label editing in either orientation. All variants keep 10 mm label symbols; sheet/card/custom use 15 mm and A3 uses 25 mm.

## Editing controls

Paper has explicit screen dimensions derived from page millimetres and user zoom. Opening a panel never changes its scale, width, column count or positions. Narrow screens scroll the canvas; zoom is a deliberate user action. Editing controls and selection outlines are outside the exported SVG.

Each group has Add picture at its header's right. It stays inside the visible horizontal canvas viewport while the paper is panned, without altering physical geometry. An untitled board has a visible editor-only rename placeholder; no invented title enters the SVG. When a heading is hidden or too small to provide 44 px controls, an unscaled group control rail outside the paper supplies rename/Add instead. Physical pictures below 44 px are disabled and excluded from identity/focus lookup; a current-source repair list provides large controls. This never enlarges hit boxes over neighboring printed rows. Canvas zoom starts at 100% on desktop and 50% on narrow screens, with explicit choices from 50–200%.

The group name opens the rename/time editor; remove the visible Group actions button. Picture activation opens a compact name/quantity/time/warning form. Main editing exposes these fields immediately. Existing optional note/description and move/delete/copy/duplicate/paste operations remain in a quiet Actions disclosure, preserving imported content and keyboard alternatives without the old button wall. Time uses days/hours/minutes/seconds rather than a large total-seconds value; preserve the existing maximum and structured value validation.

Desktop editing uses an overlay panel, without a second layout column. Mobile uses native modal containment/focus. Drafts survive unrelated renders; document/history changes reconcile committed fields. Removing targets closes safely and returns focus to a surviving control.

Whole-picture mouse/pen dragging remains. Remove picture and group dot artwork. Normal touch scrolling remains available. A quiet Move picture action may arm the selected whole-picture surface before the next touch gesture; show a concise instruction/Cancel, close the modal, and reset on drop/cancel/guide switch. Drag geometry comes from the plan's HTML hit regions. Resolve marker anchor IDs to original document indices so pagination/continuation segments cannot corrupt ordering. Preserve cancellation, click suppression and Undo/Redo.

## Shared print choices

One app-owned print-settings seam supplies editor and Print / Download. Fresh app sessions default to A4 portrait; switching between guides preserves their choices within that session. Format, orientation, mode/background/metadata/selection/custom dimensions changed in either location are reflected in the other. Authored document schema/JSON does not acquire editor settings. New groups remain selected when all groups were selected. Selection subsets remain explicit and revealable so stored content does not become inaccessible. Live settings and captured output options remain separate snapshots. Output requests retain their existing immutable capture, Refresh and late-download cancellation guarantees.

## Acceptance

- Same-size symbols/cells, stable row pitch and positions before/after quantity/warning/time edits and panel toggles.
- Editor SVG and an actual SVG download have identical physical content for the same options. PDF/PNG remain generated from the same plan.
- Fixed paper pixel dimensions and overlay alignment survive viewport/panel changes; user zoom alone changes display scale.
- Add picture in group headers; no visible Group actions or six-dot picture controls; compact editing fields immediately available.
- Handleless drag, touch scrolling, accessible moves, empty groups, continuations, cancellation, persistence and Undo/Redo preserve IDs and all data.
- Overflow/unsupported text leave repair targets and JSON backup available; physical downloads remain blocked.
- Light/dark themes affect app chrome only. EN/DE, 320/390/768/1440, keyboard focus and control sizing receive browser checks.

Existing real-device, screen-reader, participant and physical-print acceptance remains a release task rather than something headless checks can establish.
