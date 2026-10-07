# Independent layout contract review

Reviewed the current product diff from HEAD `19aa39e`, including the new connector helper. No actionable blockers found.

- Cell dimensions, row/column gaps, and heading bands remain content independent. Main pictogram boxes are centered in both axes; editor placements and printed symbol boxes agree for valid paper.
- Caption, quantity, warning, time, and note lanes are disjoint and contained in each fixed cell, including the separate portrait/landscape label arrangements. Warning typography is fixed at 10 pt on A3 and 9 pt elsewhere; other A3 body/caption values remain 12/14 pt.
- Text wrapping preserves the authored content and reports named overflow before returning a printable plan. The tightened centered text boxes use the same outline-aware font width calculation as the renderer; vertical glyph bounds retain the measured line box/baseline policy.
- Row transitions use bottom/top cell centers and the midpoint of the fixed row gap. The renderer follows the orthogonal waypoints and orients its arrow along the final nonzero segment. Planner loops connect within one group placement only, and boards emit no connectors.
- Editor, output preview, SVG, PNG, and PDF call the shared planner/renderer paths. No parallel content-dependent layout path was introduced.
- Zero-height label heading lanes skip inferred token-time sums only. Authored group time still undergoes required-content preflight, including blank-label numeric recovery. Explicit-over-inferred precedence and board time semantics remain intact.

## Fresh bounded verification

Ran a geometry-only probe over **361 custom sizes**: each axis from 20 through 200 mm in 10 mm steps. Each document had 21 token identities across two groups. All group, heading, cell, and pictogram repair boxes stayed finite, positive, and page bounded, including rejected physical sizes; every identity remained present. This probe used deterministic mock font metrics to isolate geometry and did not test glyph painting.

Ran the existing real-font tests with the following focused filter:

```powershell
& 'C:/Users/Patrick/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' node_modules/vitest/vitest.mjs run src/lib/output-plan.test.ts -t 'keeps full-size artwork and painted text|preserves fixed hit regions|keeps compact.*repair|keeps every label-sheet repair|blocks label document metadata'
```

Result: **4 passed, 26 skipped**, one test file passed, exit 0, at 12:59:16 local time on 2026-10-07. The executed cases cover actual outlined glyph boxes across physical presets/orientations, unchanged repair geometry across content/metadata changes, label-sheet repair identities across continuations, and required zero-height label metadata overflow. The first sandbox launch failed with Windows child-process `spawn EPERM`; the bounded escalation completed successfully.

Read-only product review. No product or test files changed, no broad gates run, and no Git mutation performed.
