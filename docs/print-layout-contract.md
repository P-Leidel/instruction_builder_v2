# Print layout contract

These rules govern the editor, print preview and SVG/PNG/PDF output. They implement the creator's requirement that future field changes must not shift the whole layout. Geometry is owned by `src/lib/output-options.ts` and `src/lib/output-plan.ts`; app CSS supplies editing controls around that geometry.

## Fixed anchor and reserved zones

1. Each format defines a physical cell, symbol size and row/column gap. Every picture in that format uses the same values. Cells never stretch to fill page width or grow to accommodate text.
2. The pictogram's 24-unit viewport is centered on **both axes** of its cell: `x = cell.x + (cell.width − symbol.width) / 2`, `y = cell.y + (cell.height − symbol.height) / 2`. Use the allocated viewport, not the asymmetric ink of a banana or other drawing.
3. Caption, quantity, warning, time and note have reserved, non-overlapping millimeter zones. Empty fields leave those zones empty. Their presence, absence, label length and wrapping cannot move the pictogram or another zone.
4. The caption is centered and bottom-aligned in its zone above the pictogram. The time badge is centered in its own zone starting 1 mm beneath the pictogram. Quantity sits to the left, warning to the right, and a detailed note below the quantity. Narrow landscape labels have explicit top/bottom annotation zones; their pictogram/time anchor follows the same rule.
5. Typography is selected by format and role before content is measured. Ordinary formats use 9 pt labels/annotations. A3 uses 14 pt labels, 12 pt quantity/time/notes and 10 pt warning text. Font size never changes in response to content length.
6. Wrap text only inside its reserved zone. A required field that cannot fit produces a named overflow issue and blocks physical export. Preserve the full authored value, source identity, editable repair target and JSON backup. Never clip, truncate, shrink or move another zone to force a fit.

| Format | Cell | Pictogram | Column / row gap |
| --- | --- | --- | --- |
| A4, A6 card, custom | 44 × 40 mm | 15 × 15 mm | 4 / 4 mm |
| A3 | 64 × 52 mm | 25 × 25 mm | 4 / 4 mm |
| Label portrait | 46 × 25 mm | 10 × 10 mm | 4 / 4 mm |
| Label landscape | 26 × 46 mm | 10 × 10 mm | 4 / 4 mm |

Rows and columns derive from the cell grid and printable width. Adding, removing or reordering pictures can change their grid occupancy; changing the selected physical format can deliberately change layout. Attachment edits, content mode, heading visibility, themes, panel visibility and viewport width cannot change cell metrics, pictogram anchors or row pitch. Heading bands also remain reserved when their text is hidden. Screen zoom changes only the display scale.

Compact labels have no heading band by default. Their individual picture times remain required; an inferred sum is not duplicated into a nonexistent heading. An explicit authored group time still requires room and produces a fit issue if none is available.

## Connector rules

- Same-row arrows use the fixed pictogram center height and stay in the column gap.
- A row wrap starts at the **bottom center of the last cell** and ends at the **top center of the next row's first cell**. It runs vertically into the row-gap midpoint, horizontally to the destination center, then vertically down to that cell. All route interiors stay outside cells.
- Arrowheads follow the final route segment, so a wrap points down into the destination. Render rounded joins/caps and validate every vertex and arrowhead against page bounds.
- Routes depend only on cell geometry. They do not depend on fields, text ink bounds, panel/viewport size or the count of visible annotations. Never draw a diagonal row turn, link across pages/label regions, or add connectors to choice boards.

## Change and verification rule

Keep one physical planner and one renderer for the editor and all downloads. A UI change must not introduce its own card sizing, text wrapping or connector computation. Any intentional change to cell metrics, fonts or zones must update this contract and pass the affected layout/export checks.

`src/lib/output-centered.test.ts` verifies centered anchors, disjoint zones, unchanged geometry after attachment edits, below-picture time and literal row-wrap endpoints. Planner, renderer, margin and detail tests cover bounds, continuation, data preservation and named overflow. `tests/browser/check-centered-pictograms.mjs` independently measures the actual App's SVG and cell DOM, checks painted overlap and route geometry, and compares seven native SVG downloads with the editor. It runs automatically in `npm run test:browser`.

The [centered-pictogram acceptance record](phase-3/audits/2026-10-07-centered-pictograms/README.md) contains the implementation evidence. Physical-print and real-device acceptance remain separate from engineering geometry checks.
