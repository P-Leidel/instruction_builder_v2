# Print detail columns and paper padding — 7 October 2026

The user reported that Banana's quantity, warning and duration pushed the next picture row down, and requested space between printed content and the paper edge. They selected **beside the picture** for the details. This bounded refinement follows the local overhaul checkpoint `f1dae51`.

## Behavior

Required details now use a measured side column with an icon beside each value. Short details no longer create the previous tall vertical stack. Main pictures align within the group; unrelated pictures retain their full available label width. Long warning/value text still wraps completely and reserves physical space instead of being clipped, omitted or detached from its picture. A whole token that cannot fit still produces the existing actionable overflow.

Paper padding already existed: **2 mm labels, 5 mm cards, 10 mm sheets/A3/custom pages**. It remains part of the shared physical plan used by preview/SVG/PNG/PDF. The preview now explicitly reports the minimum blank border. Its dashed rectangle marks the inside of that border, not the edge of the paper. Label sheets keep internal label padding even with a zero outer sheet margin.

## Verification

| Check | Observed result |
| --- | --- |
| New spacing/side-column regressions | 5 pass; witnessed RED before each behavior correction |
| New real-font painted-padding properties | 13 pass; honest baseline pass for existing margins |
| `npm test` | 479 tests / 37 files pass |
| `npm run lint` | Exit 0 |
| `npm run build` | TypeScript compilation and production build exit 0; 16 offline assets |
| Explicit lint of modified hidden export checker and proof script | Exit 0 |
| Existing full-App output integration | 26 strict-true checks, no console/page errors; [record](app-output/app-output-integration.json) |
| Existing full-App export audit | 55 strict-true checks, 21 actual files, no console/page errors; [record](app-export/export-review-results.json) |
| Representative actual OutputDialog/export proof | 11 checks, eight pictures exactly once/in order, truthful fractional-margin caption, no errors; [record](results.json) |
| Independent SVG/PDF reopening | Actual ink inside the 10 mm border; cross-renderer ink edges within 2 px, A4 MediaBox and no PDF image XObjects; [record](independent-results.json) |

The corrected original A4 regression measured a 67.276 mm row interval against the unattached 24.750 mm interval. The final short-detail interval is **24.750 mm**. A6's original fixture overflow also resolves. A separate RED/GREEN regression protects unrelated labels from acquiring a narrower width merely because another picture has details.

The full-App export checker originally required a whole warning in one text fragment; the side column correctly wraps it. Its assertion now reconstructs the exact warning using its **warning role and original token ID**, rather than accepting a substring on an unrelated token. The [original failing record](app-export/export-review-red.json) is retained.

An unchanged output-integration script initially failed its direct module `createGuide` call against the long-lived user dev server. The [original failure](app-output/app-output-live-server-failure.json) is retained. The identical script passed all 26 cases on its own fresh server. No guide initialization or persistence code was changed; that live-server development-state cause was not established by this layout check.

Root inspected the complete [updated preview](preview.png) and three-way [comparison gallery](comparison-gallery.png): details remain visibly beside Banana, the next row is compact, and the paper border is clear. These are engineering fixtures in isolated browser profiles; the user's stored guides were not modified. They establish digital output, not physical printer scale or participant comprehension. Earlier overhaul evidence remains dated to its original checkpoint.

The [independent scoped review](review.md) approved specification compliance and change quality with no blocking findings, including the conservative fractional-margin caption. Its approval covers this technical refinement; practical acceptance remains pending.

## Reproduction

Start `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`. Then run `node docs/phase-3/audits/2026-10-07-print-layout/run-proof.mjs`, which uses the already reviewed isolated OutputDialog/planner/file adapter and closes its separate Chromium browser.

Run `python docs/phase-3/audits/2026-10-07-print-layout/validate-artifacts.py` with Pillow/PyPDF and the bundled Node/Sharp/Poppler runtime. `CODEX_PROOF_RUNTIME` can override that runtime directory. Inspect the refreshed preview and complete comparison gallery. Do not replace original dated overhaul records with regenerated files.

The saved fixture, physical plan, actual files, independent renders and machine records are adjacent to this report. Practical release checks in the [overhaul handoff](../2026-10-06-overhaul/implementation-report.md) remain pending.
