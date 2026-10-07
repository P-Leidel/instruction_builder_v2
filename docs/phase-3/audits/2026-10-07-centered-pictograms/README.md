# Centered pictograms and stable layout rules — 7 October 2026

Pictograms now sit at the exact horizontal and vertical center of their existing physical tiles. Caption, quantity, warning, time and note use separate reserved zones around that anchor. Time is centered immediately below the pictogram. Row-wrap arrows leave the last tile's bottom center and enter the next row's first tile at its top center, with an orthogonal route through the row gap and a downward arrowhead.

The [print layout contract](../../../print-layout-contract.md) is the durable rule for future changes. It defines fixed metrics, disjoint zones, format/role typography, overflow behavior and connector routing. Cell sizes, page margins and row/column gaps remain unchanged. Field edits, missing fields, text wrapping, app themes, menus and viewport changes cannot alter the pictogram anchor or row geometry. The editor and all output formats still use one physical planner and renderer.

## Verification

Final source checks all exited 0:

| Check | Result |
| --- | --- |
| `npm test` | 574 tests across 42 files |
| `npm run test:tooling` | 7 tests |
| `npm run build` | TypeScript and production build pass; 16 offline assets |
| `npm run lint` and explicit browser-driver lint | Pass |
| `npm run test:browser -- docs/phase-3/audits/2026-10-07-centered-pictograms/integrated-browser` | 622 strict true assertions across ten recorded result sets, empty console/page errors, plus successful persistence/recovery scenarios |
| `npm run test:pwa -- docs/phase-3/audits/2026-10-07-centered-pictograms/pwa` | 49 cold-install checks for four output formats; waiting-update and actual old/new-app offline PDF scenarios pass |
| [Independent review](review/layout-contract-review.md) | No blockers; 4 focused real-font checks pass and a 361-size custom-paper sweep retains all 21 token identities within bounded repair targets |

The 622 browser assertions comprise the existing 452 editor/output/theme/drag checks plus the new 170 centered-layout checks. The new checker is registered in `npm run test:browser` so future changes exercise it automatically. The production main bundle is 466.23 kB / 131.62 kB gzip; the offline cache is `instruction-builder-v2-95bd5b05fdc31f14`.

The [focused browser record](browser/README.md) preserves RED and final GREEN evidence. It measures the actual rendered SVG against the physical cell DOM without calling planner helpers: A4/A3 and labels in both orientations, mobile, board semantics, unchanged geometry after metadata edits, painted annotation containment/nonoverlap, literal cell-edge route endpoints, downward arrowheads and seven native SVG downloads matching the editor. [Final integrated results](integrated-browser/centered-pictograms/results.json) repeat those checks against frozen source.

Representative output: [desktop](browser/green/a4-portrait-desktop.png), [mobile](browser/green/a4-mobile.png), [landscape label](browser/green/label-landscape-desktop.png), and [connector renderer record](connectors/renderer-verification.md).

## Preserved behavior and limits

Long required content can exceed a reserved zone. The output stays blocked with its named fit issue and full repair identity; authored text is retained exactly and JSON backup remains available. The real-font regression includes an A4 warning that cannot fit and its complete A3 rendering. There is no automatic content-driven font reduction. Large-print caption capacity follows its fixed 14 pt typography and top zone.

Compact labels retain individual times without duplicating an inferred group sum into their absent heading band. Explicit authored group time still requires room or produces an overflow issue. Unknown pictograms/warnings retain their meanings and source identities. Drag, Undo/Redo, focus, local storage, themes, and captured-output Refresh behavior pass the integrated suite.

Legacy tests were adapted only where the requested layout deliberately changed their assumptions: left-aligned symbol coordinates, every attachment living on the right, the old narrow caption wrap, and waiting for a printable plan when long imported labels validly leave repair pages. Full-content, glyph-boundary, overflow, history and focus checks remain. An intermediate browser download comparison caught concurrent HMR; the final frozen-source run replaces that intermediate record, as explained in the focused browser evidence.

Physical-print readability, real-phone behavior and participant comprehension still use the practical acceptance tasks in the [overhaul handoff](../2026-10-06-overhaul/implementation-report.md). This record establishes engineering geometry and output parity.

The development server remains at `http://127.0.0.1:5173/`. No push, merge or deployment was performed.
