# Task 6 A3 continuation evidence report

Status: **DONE — source STOP**. Scope is the new `docs/phase-3/audits/2026-10-06-overhaul/continuation-a3-proof/` evidence directory and this report. No production, test, shared adapter, exporter, global documentation, dependency, runner, or Git/index changes were made. No child agents or broad release gates were run.

## Requirement and actual outcome

Spec `06-release-acceptance.md:26` requires the 85-picture sequence stress fixture to retain every main token once with repeated context on A4/A3. Existing A4 evidence remains unchanged. This delta supplies the actual A3 half through the existing `export-proof/index.html` / `ui-proof.ts` adapter and unchanged shipped planner/file APIs.

Default Large/A3, labels mode, English, white background, portrait: **six pages at 297 × 420 mm**, **25 mm main pictures**, 10 mm margins. Main counts are **16,16,16,16,16,5**, source IDs `a3-main-001`–`085` in order. The source cycles offered Chop / Wash hands / Count artwork across 85 distinct token IDs in one sequence group. All 85 pictures carry quantity `2 pieces`, warning `Warning: Sharp edge`, and duration `1m`, so every continuation boundary retains its required attachments. Page 1 has the authored title, `Step 1: Repeat the familiar action`, explicit group `5m`, and `Total time: 5m`; pages 2–6 repeat `Step 1: Repeat the familiar action (continued)`.

No picture shrinking or synthetic layout/renderer was used. This attachment-heavy fixture demonstrates actual multi-page pagination and is an engineering fixture, not a participant-approved activity.

## RED and GREEN evidence

1. Before creating evidence, a PowerShell `Test-Path` assertion for the actual A3 PDF failed with `RED: independently inspected actual A3 85-picture export evidence is absent` (exit 1).
2. First actual generation passed canonical resolution, source ordering, all attached text/symbol checks, page bounds/context, portable SVG, actual PNG, vector-PDF checks, and zero console/page errors. Independent reopening then failed its raster-dimension assertion: Sharp's density conversion produced 3654 × 5167 pixels instead of 1754 × 2480. Only the proof harness changed to the existing artifact-proof explicit physical-size raster method; production exports stayed unchanged.
3. Actual generation and independent reopening passed. The final run additionally used an isolated Vite cache and asserted browser/server shutdown and cache removal. Its cleanup path check was extracted into a named helper for ESLint's `no-unsafe-finally` rule without changing cleanup behavior.

Actual commands and results:

| Command | Result |
| --- | --- |
| `node docs/phase-3/audits/2026-10-06-overhaul/continuation-a3-proof/run-proof.mjs` | exit 0; **308 passing focused checks**, 6 actual pages, 85 main pictures, zero console/page errors; cleanup assertions pass |
| Python `compare-pages.py` (invoked by generator) | exit 0; **689 symbol/text fragment comparisons**, 6 exact-size PDF pages, 85 main pictures, zero PDF image XObjects |
| `npm exec eslint -- docs/phase-3/audits/2026-10-06-overhaul/continuation-a3-proof/run-proof.mjs` | exit 0 on final source |
| `node --check docs/phase-3/audits/2026-10-06-overhaul/continuation-a3-proof/run-proof.mjs` | exit 0 on final source |
| Runtime Python `compile(..., 'compare-pages.py', 'exec')` | Python syntax PASS; no bytecode/temp artifact created |

The final generation ran on 2026-10-06 with installed Node v24.19.0 / locked existing dependencies. No new TypeScript file was added, so no new strict TS harness check was needed; the existing reviewed adapter is reused unchanged. The root's integrated clean-install gates are separate and were not repeated here.

## Independent reopening and visual inspection

Each actual SVG is independently rendered with bundled Sharp. The actual PDF is reopened with PyPDF, its six MediaBoxes checked to within 0.001 mm, its XObject resources inspected for images, and every page rasterized with Poppler at 150 dpi. Actual PNG and independently reopened vectors are compared over **every text and symbol fragment**, not only signatures or page counts.

Actual PNG/SVG inspection grid: 1754 × 2480 pixels. Poppler: 1754 × 2481, due to ceiling rather than rounded height. Exact PDF page dimensions are 297.00000000000006 × 420 mm. Comparison requires at most 2 px ink-edge displacement and at most 3% bidirectional unmatched ink within a 2 px neighborhood. Observed maximum edge displacement is **1 px**, unmatched ratio **0**.

I inspected the full six-row comparison gallery and the independently reopened PDF first and final pages at larger display size. Main images and required attached values are present, final picture 85 is complete, and repeated continuation context is clear. No clipping/overlap was observed. Root separately inspected all gallery rows and PDF page 6; its acceptance record remains root-owned. These are digital observations, not printer/recipient findings.

## Exact owned files and artifacts

All paths below are under `docs/phase-3/audits/2026-10-06-overhaul/continuation-a3-proof/`:

- Sources/reproduction: `run-proof.mjs`, `compare-pages.py`, `README.md`.
- Editable input/exact plan/checks: `source.json`, `plan.json`, `results.json`, `independent-results.json`.
- Actual vector PDF: `continuation-a3.pdf`.
- Actual SVG pages: `continuation-a3-page-01.svg`, `-02.svg`, `-03.svg`, `-04.svg`, `-05.svg`, `-06.svg`.
- Actual 150 dpi PNG pages: `continuation-a3-page-01.png`, `-02.png`, `-03.png`, `-04.png`, `-05.png`, `-06.png`.
- Independent SVG rasters: `continuation-a3-page-01-svg-independent.png`, `-02-svg-independent.png`, `-03-svg-independent.png`, `-04-svg-independent.png`, `-05-svg-independent.png`, `-06-svg-independent.png`.
- Independent PDF rasters: `continuation-a3-pdf-independent-1.png`, `-2.png`, `-3.png`, `-4.png`, `-5.png`, `-6.png`.
- Inspection: `inspection-gallery.png`.

This report is the sole additional file outside that directory. The reproduction command rewrites only its own evidence files and safely removes its own temporary cache. Browser/context and ephemeral Vite server are closed in nested `finally` blocks on success or failure.

## Remaining concerns and handoff

No concrete technical concern remains in this focused evidence. Physical A3 print scaling/readability, recipient comprehension, creator testing, and actual devices remain **Pending**, as in the existing acceptance handoff. No distribution/license, human comprehension, or actual-size readability claim is introduced. Root can checkpoint this frozen delta and dispatch the independent scoped evidence review. Source edits are stopped.
