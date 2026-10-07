# Actual A3 continuation proof

This focused technical proof closes the A3 half of spec 06's 85-picture sequence requirement. The unchanged shipped planner and file APIs produce **six A3 portrait pages**, with 85 main pictures exactly once in source order. The default Large preset retains **25 mm main pictures**; no layout, preset, renderer, or source code was changed to induce pagination.

`source.json` is an editable schema-v2 sequence with one group. Its 85 distinct source token IDs (`a3-main-001` through `a3-main-085`) cycle three offered canonical artwork IDs: `action.chop`, `routines.action.wash-hands`, and `learning.action.count`. Every picture has quantity `2 pieces`, warning `Sharp edge`, and duration `1m`, including both sides of every page boundary. The explicit group duration is `5m`; sequence total time is `5m`. This is an attachment-heavy engineering stress fixture, not a recipient-tested procedure.

| Page | Ordered main source IDs | Main pictures | Context |
| --- | --- | --- | --- |
| 1 | a3-main-001–016 | 16 | Document title, sequence heading, group time, total time |
| 2 | a3-main-017–032 | 16 | Step 1: Repeat the familiar action (continued) |
| 3 | a3-main-033–048 | 16 | Step 1: Repeat the familiar action (continued) |
| 4 | a3-main-049–064 | 16 | Step 1: Repeat the familiar action (continued) |
| 5 | a3-main-065–080 | 16 | Step 1: Repeat the familiar action (continued) |
| 6 | a3-main-081–085 | 5 | Step 1: Repeat the familiar action (continued) |

Every page measures 297 × 420 mm. All planned fragments remain within the preset's 10 mm margins. Actual 150 dpi PNG pages are 1754 × 2480 pixels. Independently rasterized PDF pages are 1754 × 2481 pixels because Poppler rounds the height up; each reopened PDF MediaBox measures 297.00000000000006 × 420 mm. The one-pixel rasterizer rounding difference is recorded, not treated as a production defect.

## Reproduce

From the repository root, with the existing installed Node 24 dependencies and Playwright Chromium:

```powershell
node docs/phase-3/audits/2026-10-06-overhaul/continuation-a3-proof/run-proof.mjs
npm exec eslint -- docs/phase-3/audits/2026-10-06-overhaul/continuation-a3-proof/run-proof.mjs
node --check docs/phase-3/audits/2026-10-06-overhaul/continuation-a3-proof/run-proof.mjs
```

The generator serves the existing sibling `export-proof/index.html` / `ui-proof.ts` adapter through an ephemeral Vite server. It calls `prepareOutputProof` and `outputProofArtifact`, which use the shipped font preparation, default options, planner, SVG, PNG, and vector PDF file APIs. The adapter and production files are unchanged. No new TypeScript harness was introduced.

Independent tooling comes from `C:/Users/Patrick/.cache/codex-runtimes/codex-primary-runtime/dependencies`: Sharp from `node_modules`, `python/python.exe` with Pillow/PyPDF, and `native/poppler/Library/bin/pdftoppm.exe`. Optional overrides are `CODEX_PROOF_RUNTIME`, `CODEX_PROOF_PYTHON`, and `CODEX_PROOF_PDFTOPPM`. `compare-pages.py` can be rerun directly with that Python executable after generation.

The script captures both `console.error` and `pageerror`, enforces zero errors, closes its browser/context and ephemeral server in nested `finally` blocks, and removes its isolated temporary Vite cache. Recursive cleanup first validates the resolved temporary directory against the system temporary root and the `instruction-a3-proof-` prefix. These cleanup outcomes are asserted in `results.json`.

## Evidence and inspection

- `source.json`, `plan.json`, and `results.json`: editable input, exact actual plan, and **308 passing focused checks**.
- `continuation-a3.pdf`: actual six-page vector PDF; raw and reopened resource inspection find **zero image XObjects**.
- `continuation-a3-page-01.svg` through `-06.svg`: actual portable SVG pages with physical units and source-tagged main-picture order; glyphs are paths and pages have no external image/font dependency.
- Matching `continuation-a3-page-01.png` through `-06.png`: actual 150 dpi PNG output.
- `continuation-a3-page-01-svg-independent.png` through `-06-svg-independent.png`: independently reopened SVGs rendered by Sharp and sized from the verified page dimensions to the requested 150 dpi grid, matching the established artifact-proof method.
- `continuation-a3-pdf-independent-1.png` through `-6.png`: PDF pages independently reopened/rasterized by Poppler at 150 dpi.
- `independent-results.json`: PDF dimensions/page count/resource checks and **689 symbol/text fragment comparisons**, including every main picture, every attached value, the title/time, and repeated context. Ink-edge differences are required to be at most 2 pixels; bidirectional unmatched ink after a 2-pixel neighborhood is required to be at most 3%. Actual maximum edge difference is **1 pixel**, and actual maximum unmatched ratio is **0**.
- `inspection-gallery.png`: six rows, each comparing actual PNG, independent SVG, and independent PDF. All six rows and full PDF first/final pages were digitally inspected: distinct main artwork, complete attached values, repeated context, and no observed clipping or overlapping content.

The initial independent raster assertion failed because Sharp's SVG density conversion produced a larger pixel grid; the harness was corrected to use the established explicit physical-dimension sizing. The actual exports were unchanged. A prior absent-evidence assertion failed before these files were created.

This evidence establishes digital content/geometry agreement. Physical A3 printer scaling, paper readability, recipient comprehension, creator testing, and actual device observations remain **Pending**. It makes no actual-size readability or participant-success claim.
