# Print font and portable output proof

Task 4 uses **Source Sans 3 Regular 3.052**, unmodified, from Adobe's fixed **3.052R** release. The physical planner and all output text paths use this one regular face; no synthetic bold, installed system font, remote font service, or raster text is involved.

## Asset provenance and coverage

| Item | Recorded value |
| --- | --- |
| Original source | [Adobe Source Sans release 3.052R](https://github.com/adobe-fonts/source-sans/releases/tag/3.052R) |
| Original binary | [Tagged SourceSans3-Regular.ttf](https://raw.githubusercontent.com/adobe-fonts/source-sans/3.052R/TTF/SourceSans3-Regular.ttf) |
| Local binary | [public/fonts/SourceSans3-Regular-3.052.ttf](../public/fonts/SourceSans3-Regular-3.052.ttf) |
| License | [Tagged SIL OFL 1.1](https://raw.githubusercontent.com/adobe-fonts/source-sans/3.052R/LICENSE.md), shipped verbatim as [SourceSans3-LICENSE.md](../public/fonts/SourceSans3-LICENSE.md) |
| Copyright/reserved name | Adobe 2010–2022; reserved font name **Source** |
| Exact size | 431,196 bytes |
| SHA-256 | `4644c81b86ec9caaa76b634889968ed3c4f4f52f054855933acc7c2b21e53b0f` |
| Prepared identity | `source-sans-3-regular-3.052` |
| Parsed revision/units | 3.052 / 1,000 units per em |
| Actual cmap | 1,614 mapped code points |

The binary's actual cmap and paths support the exercised English/German text, `ÄÖÜ äöü ß ẞ`, Latin accents, curly quotes, en/em dashes, digits, arbitrary Latin quantity-unit text, and leading/trailing `j`. Japanese `日本語` is deliberately unsupported and blocks output only when that text is selected for rendering. Coverage is checked against actual glyph IDs, not whether a browser fallback can paint a character. This is a Latin output face, not a claim of universal language coverage.

`prepareFonts` loads the local binary, verifies its exact byte size/hash/revision, parses its real metrics/cmap, loads that same ArrayBuffer into a regular browser `FontFace`, and awaits font readiness. Success is memoized; a rejected attempt clears the memo so an explicit retry can succeed. Font preparation failures remain visible to the export controller as `font-unavailable`.

## Chosen adapter and measurement

Portable **vector outlines** passed. Production dependencies are `opentype.js` **2.0.0** (MIT), `jspdf` **4.2.1**, and `svg2pdf.js` **2.8.1**; development typings are `@types/opentype.js` **1.3.10** (MIT). The parser was added through the coordinating owner after the embedded-text route failed; dependency/lock edits belong to that owner.

`measureWidthMm` and `createSvgText` use the identical NFC-normalized glyph run, regular face, kerning, and ligature options. Authored strings remain unchanged in the document and semantic plan. Sizes convert by `pt × 25.4 / 72`; path coordinates are in mm. Wrapping preserves grapheme boundaries, explicit newlines, and repeated spaces; tabs consistently expand to four spaces.

Measured width contains both advances and painted `xMin`/`xMax`: negative leading bearings are offset into the assigned box and trailing overhangs reserve space. Line height reserves the face's full vertical extremes around the fixed baseline at 80% of the line box. Renderer adapters check actual outline bounds against each fragment's fixed width and baseline. Renderers never wrap again. The production outline precision is eight decimal places.

`prepareSvgText` and `registerPdfFonts` validate prepared identity and need no resource registration because SVG/PDF text is already paths. `createSvgText` returns controlled SVG paths from that face. Exported SVG requires no font URL or inherited app font state. PDF pictograms and text stay vectors. **Outlined text is not selectable/searchable as PDF text**; authored/semantic text remains in OutputPlan and the reader/preview equivalent owned by packages 03/05.

## Actual rendered evidence

Evidence is retained under [docs/phase-3/audits/2026-10-06-overhaul/font-proof](phase-3/audits/2026-10-06-overhaul/font-proof/). These are reproducible diagnostic artifacts, not another application output renderer.

The initial embedded TTF `@font-face` route failed independent portability: sharp/librsvg substituted a visibly different serif face and changed line advances. The registered jsPDF/svg2pdf text route also disagreed on decomposed accents. Preserved [Image rendering](phase-3/audits/2026-10-06-overhaul/font-proof/embedded-image.png), [independent SVG rendering](phase-3/audits/2026-10-06-overhaul/font-proof/embedded-independent.png), [independent PDF rendering](phase-3/audits/2026-10-06-overhaul/font-proof/embedded-pdf.png), and [metrics](phase-3/audits/2026-10-06-overhaul/font-proof/embedded-metrics.json) record that rejected route. [embedded-proof.mjs](phase-3/audits/2026-10-06-overhaul/font-proof/embedded-proof.mjs) reproduces it from the same local asset; full rejected SVG/PDF stay in a disposable temporary directory.

The final proof uses production preparation, wrapping, planner, outline adapters, and canonical catalog artwork. The diagnostic exercises English/German, punctuation, NFC/decomposed accents, 18 wide letters wrapped in 25 mm, an unbroken German word wrapped in 30 mm, and exact right/bottom boundary text including `j`. The composition fixture uses original kitchen/routines/learning pictograms, arbitrary unit text, required time, and a labelled unknown warning retaining visible warning context. Its quantity and token/group duration attachments deliberately have blank/whitespace stored labels: shared display-only helpers recover `2 small cups` and `5m` from structured values without changing authored data; nonblank labels remain verbatim.

| Passing artifact | Standalone vector | Image PNG | Independent SVG PNG | Independent PDF PNG |
| --- | --- | --- | --- | --- |
| Font diagnostic, 190 × 120 mm | [SVG](phase-3/audits/2026-10-06-overhaul/font-proof/diagnostic.svg), [PDF](phase-3/audits/2026-10-06-overhaul/font-proof/diagnostic.pdf) | [PNG](phase-3/audits/2026-10-06-overhaul/font-proof/diagnostic-image.png) | [PNG](phase-3/audits/2026-10-06-overhaul/font-proof/diagnostic-independent.png) | [PNG](phase-3/audits/2026-10-06-overhaul/font-proof/diagnostic-pdf.png) |
| Mixed-library composition, 210 × 297 mm | [SVG](phase-3/audits/2026-10-06-overhaul/font-proof/composition.svg), [PDF](phase-3/audits/2026-10-06-overhaul/font-proof/composition.pdf) | [PNG](phase-3/audits/2026-10-06-overhaul/font-proof/composition-image.png) | [PNG](phase-3/audits/2026-10-06-overhaul/font-proof/composition-independent.png) | [PNG](phase-3/audits/2026-10-06-overhaul/font-proof/composition-pdf.png) |

Fresh Chromium standalone documents also produced [diagnostic-browser.png](phase-3/audits/2026-10-06-overhaul/font-proof/diagnostic-browser.png) and [composition-browser.png](phase-3/audits/2026-10-06-overhaul/font-proof/composition-browser.png), with no inherited prepared FontFace. All four 150-dpi renders were visually inspected for glyph shapes, advances, wrapping, baselines, attachments, and boundary text. A [comparison image](phase-3/audits/2026-10-06-overhaul/font-proof/rendered-comparison.png) and [per-line comparison JSON](phase-3/audits/2026-10-06-overhaul/font-proof/rendered-comparison.json) preserve the result: **22 text lines across two artifacts, no missing lines, all ink-edge differences ≤2 pixels** across Chromium Image, fresh Chromium SVG, librsvg, and Poppler. Differences are raster rounding/antialiasing; measured path coordinates are shared. PDFs contain no image XObjects.

Independent runtimes: Chromium **153.0.8010.12**, sharp **0.35.4** with librsvg **2.62.91**, Pango **1.58.2**, FreeType **2.14.3**, HarfBuzz **14.3.1**, and Poppler **26.07.0**. The exact Chromium/runtime inventory and font/page/path measurements are in [proof-results.json](phase-3/audits/2026-10-06-overhaul/font-proof/proof-results.json); use that generated inventory if the local executable changes.

[fixture-plans.json](phase-3/audits/2026-10-06-overhaul/font-proof/fixture-plans.json) preserves successful plans for mixed libraries (3 pictures/1 page), board alternatives (2/1), 20 pictures (20/1), an 85-picture continuation (85/4), and 25 labels (25/2). Every selected main token occurs exactly once. Focused tests also cover label/card overflow with no partial plan, all presets/orientations, selected-content totals, impossible dimensions/grids, unsupported visible/omitted Japanese text, empty groups, and labelled/unlabelled/non-warning warning references.

## First-use offline proof and reproduction

[run-proof.mjs](phase-3/audits/2026-10-06-overhaul/font-proof/run-proof.mjs) builds the isolated harness through **Vite production bundling**, copies the actual public service worker/font assets, and calls the repository's actual `prepareOfflineAssets` writer. The harness imports production package APIs, while PDF/converter dependencies remain lazy chunks. Generated builds live in the OS temporary directory, not the source tree.

In a new browser context, the worker finished caching the complete build. Before output, `document.fonts.size` was **0**, and page requests had loaded no TTF/PDF/converter chunk. The context then went offline. Its first `prepareFonts` and SVG/Image/PDF export succeeded, with **0 server requests during output**, using the precached local TTF and lazy dependencies. Responses include `Vary: Origin`. Generated proof JSON records cache names, manifest entries, cached entries, request order, and the prepared face count. This passes the Task 4 font/converter first-use gate. The complete app dialog/export flows, stale preview recovery, old-client update coexistence, and end-to-end release offline proof remain package 05/06 responsibilities.

From repository root after `npm ci`:

```powershell
node docs/phase-3/audits/2026-10-06-overhaul/font-proof/embedded-proof.mjs
node docs/phase-3/audits/2026-10-06-overhaul/font-proof/run-proof.mjs
& 'C:/Users/Patrick/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' docs/phase-3/audits/2026-10-06-overhaul/font-proof/compare-proof.py
```

The scripts default to this host's bundled runtime paths. Set `CODEX_PROOF_RUNTIME` to the dependency root and/or `CODEX_PROOF_PDFTOPPM` to another verified Poppler executable on another host. The comparison script requires Pillow. No font is installed into the OS. No external font download occurs during proof reproduction.

Actual printed scale, printer margins/contrast, participant comprehension/readability, 60–100 cm viewing, and real-device/PWA acceptance are **pending**. Passing technical renders do not establish those physical/user conclusions.
