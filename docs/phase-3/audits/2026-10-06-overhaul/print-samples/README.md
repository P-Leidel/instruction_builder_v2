# Actual-size print samples

**Prepared for practical acceptance; physical and participant results pending.** These files use the production physical planner and SVG/PDF exporters through the isolated browser adapter. Every page has its named physical size. The A6 PDFs contain one card per group (three pages); the other PDFs contain one page. Print with **100% / Actual size**, then measure the page or cut region. Disable Fit to page. Use suitable paper or print the smaller region on larger paper without scaling.

The workplace sequence is Wash hands with Soap, Chop onion with an illustrative Sharp blade warning, then Store food with a Food container. The routine is Wash hands, Brush teeth, Get dressed. Their editable JSON files retain the complete guides. The 50 x 30 mm labels isolate Soap and Wash hands respectively; they do not claim to contain the full guide or its warning. Participants supply their familiar actual procedure and warning when completing the creator/recipient tasks.

| Format | Workplace PDF | Routine PDF | Intended page size |
| --- | --- | --- | --- |
| Label | [Workplace](workplace-label.pdf) | [Routine](routine-label.pdf) | 50 x 30 mm |
| A6 card | [Workplace](workplace-a6.pdf) | [Routine](routine-a6.pdf) | 105 x 148 mm |
| A4 sheet | [Workplace](workplace-a4.pdf) | [Routine](routine-a4.pdf) | 210 x 297 mm |
| A3 print | [Workplace](workplace-a3.pdf) | [Routine](routine-a3.pdf) | 297 x 420 mm |
| Custom print | [Workplace](workplace-custom.pdf) | [Routine](routine-custom.pdf) | 180 x 250 mm |

Matching SVGs and independently reopened PNGs are alongside each PDF. Text and pictograms remain vector in SVG/PDF; outlined text is not selectable. The generated JSON record names exact options, dimensions and browser. Software inspection does not establish actual printer scale, small-picture comprehension or viewing-distance suitability.

The sample generation passed for 10 PDFs / 14 pages, with every page reopened through Poppler. Independent `validate-samples.py` uses PyPDF to verify every PDF page count and millimeter MediaBox (within 0.01 mm). The controller inspected the complete rendered contact sheet and the full A6 warning card: no observed clipping or overlap. This evidence establishes digital files, with physical results still pending.

Regenerate from the repository root with `node docs/phase-3/audits/2026-10-06-overhaul/print-samples/generate-samples.mjs`. It uses installed project Vite/Playwright plus the bundled Sharp/Poppler runtime; override `CODEX_PROOF_RUNTIME` / `CODEX_PROOF_PDFTOPPM` on another machine. It starts and closes its own ephemeral dev server. This sample-generation run is separate from the production cold-offline gate.

Then run `python docs/phase-3/audits/2026-10-06-overhaul/print-samples/validate-samples.py` with PyPDF installed. Review all refreshed rendered pages before using the samples; regeneration alone does not repeat the controller's visual inspection.

Record measured size, printer/scaling, viewing distance, grayscale/color, warning interpretation and recipient context in the [practical acceptance record](../practical-acceptance-template.md), using the [creator/recipient tasks](../creator-and-recipient-tasks.md). Fix observed blockers and repeat affected tasks.
