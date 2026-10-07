# Focused centered-pictogram browser evidence

The standalone `tests/browser/check-centered-pictograms.mjs` opens the actual App in fresh Playwright contexts. Without a supplied URL it owns an ephemeral Vite server and closes both the server and browser. The full browser adapter supplies its own managed server URL; the checker still owns and closes its isolated contexts/browser. It never accesses the user's browser profile or storage.

The checks measure the rendered SVG and physical editor-cell DOM, without importing the layout planner, normalizer, or connector helper. Pictogram centering uses the allocated 24-unit icon viewport rather than the asymmetric ink of a particular drawing. Annotation containment and overlap use painted SVG bounds. Connector route and arrowhead checks inspect the actual path commands. Export parity compares the native SVG download to the editor vectors, preserving all physical attributes and ignoring only root accessibility and namespace serialization.

RED was captured before the centered layout correction. Its A4 portrait fixture exercises three rows, mixed short metadata in detailed mode, two row wraps, native SVG download, and a 390-pixel mobile viewport. The recorded run has **36 checks, 16 expected failures, and zero browser errors**. The first pictogram's allocation center is 11 mm left and 12.5 mm above its fixed-cell center. Time is stacked to its right and row turns are diagonal. Cell dimensions, row placement, metadata presence, physical page size, mobile invariance, and download parity already pass.

The final driver adds explicit arrowhead-wing and all-cell route-interior checks beyond the recorded RED assertions. Its complete run also covers A4 and A3 in both orientations, label portrait and landscape with simple supported metadata, and a board with no connectors.

GREEN records **170 passing checks, zero failures, and zero browser errors** across all seven desktop scenarios plus mobile. Every pictogram allocation is centered on both axes and remains anchored when metadata is added. Required short metadata is painted within its fixed cell without overlaps, time is centered immediately below the pictogram, and row-wrap arrows use exact cell-edge centers with orthogonal routes through the row gap and downward arrowheads. All seven native SVG downloads preserve the editor's physical vectors. Fixed cell dimensions and wrapping remain unchanged before/after metadata and on mobile. Desktop/mobile and both label orientations were also visually inspected.

The final run was captured at 2026-10-07 10:53:30 UTC after product edits were frozen. One earlier refresh encountered HMR during board export and was discarded; the final frozen-source run passes parity for every format. The immediate-time check permits up to 3 mm between the pictogram allocation and actual clock/text ink, accounting for the clock's internal viewport whitespace and its vertical centering within the fixed text line.

Commands from the repository root (PowerShell):

```powershell
& 'C:/Users/Patrick/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' tests/browser/check-centered-pictograms.mjs docs/phase-3/audits/2026-10-07-centered-pictograms/browser/red --baseline
& 'C:/Users/Patrick/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' tests/browser/check-centered-pictograms.mjs docs/phase-3/audits/2026-10-07-centered-pictograms/browser/green
& 'C:/Users/Patrick/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' node_modules/eslint/bin/eslint.js tests/browser/check-centered-pictograms.mjs
```

Vite/Playwright require process launch outside this workspace's restrictive sandbox; the focused check was run through the approved escalation. The driver creates no product dependencies and does not modify broad browser drivers.
