# Task 4 implementation report

Date: 2026-10-06. Implementer: `/root/agent_spec_review`. Starting shared HEAD was `cfa9f4a`. No staging, commits, Git mutation, child agents, app changes, output-SVG/export changes, service-worker changes, or edits to another package's files were made. Root owns dependency/lock edits and commits; an independent worker must review this task.

## Outcome

4A and 4B technical implementation are ready for independent review. The embedded-font portability route was actually rendered and rejected. Same-font vector outlines passed standalone Chromium SVG, Chromium Image-to-PNG, independent sharp/librsvg SVG rasterization, vector jsPDF/svg2pdf output independently rasterized through Poppler, and cold first-use offline production output. The measured physical planner uses canonical foundation types, shared content projection, explicit-locale whole-message helpers, and the completed global original-artwork resolver.

Full application integration and package 05/06 release checks remain owned by their assigned workers. Physical scale/readability, participant comprehension, viewing at 60–100 cm, printers, and real-device/PWA acceptance remain explicitly pending; technical artifact parity does not close these checks.

## Owned files

- `src/data/print-fonts.ts`
- `src/lib/print-fonts.ts`, `print-fonts.test.ts`
- `src/lib/print-font-adapters.ts`, `print-font-adapters.test.ts`
- `src/lib/output-options.ts`, `output-options.test.ts`
- `src/lib/text-layout.ts`, `text-layout.test.ts`
- `src/lib/output-plan.ts`, `output-plan.test.ts`
- `public/fonts/SourceSans3-Regular-3.052.ttf`, `SourceSans3-LICENSE.md`
- `docs/print-fonts.md`
- `docs/phase-3/audits/2026-10-06-overhaul/font-proof/` evidence files listed below
- This report. Prototype scripts/artifacts stay in the task-4-font-proof scratch directory; they are not production assets or the durable evidence source.

The coordinating owner added production `opentype.js` **2.0.0** and development `@types/opentype.js` **1.3.10** to `package.json`/lock after the rendered embedded route failed. Both are MIT licensed. These serialized dependency edits belong in Task 4 review scope but were not edited/staged here. No second font parser, font asset strategy, model variant, message table, or global preference source was introduced.

## Implementation and contracts

Public downstream contracts remain:

```ts
prepareFonts(): Promise<PreparedFonts>;
planOutput(doc, options, fonts): OutputPlanResult;
createDefaultOutputOptions(doc, locale, preset?);
createDefaultLabelSheet();
prepareSvgText(svg, fonts): void;
createSvgText(fragment, fonts): SVGElement;
registerPdfFonts(pdf, fonts): void;
```

Geometry/metrics helpers are package implementation seams, not new model types. The planner is synchronous and reads no viewport, preference singleton, UI/session state, DOM geometry, or active library. Normalization captures/clones options and selected IDs in document order, validates dimensions/settings, swaps orientation once, keeps label-sheet page orientation independent, and forces procedural board metadata off.

The binary is unmodified Adobe Source Sans 3 Regular **3.052R**, **431,196 bytes**, SHA-256 `4644c81b86ec9caaa76b634889968ed3c4f4f52f054855933acc7c2b21e53b0f`, with the tagged OFL 1.1/Adobe copyright/license beside it. Parsing verified revision 3.052, 1,000 units/em, and 1,614 cmap mappings. Preparation verifies binary identity/actual Latin coverage, resolves the same browser FontFace, memoizes success, and retries rejected attempts.

Measurement and output paths use identical NFC glyph runs/options and `25.4 / 72` pt-to-mm conversion. Authored document/plan strings stay unchanged. Measurement contains advance plus painted negative-bearing/overhang bounds. Lines reserve the actual face's complete vertical extrema at the fixed 80% baseline. Wrapping preserves graphemes, repeated spaces, explicit blank/newlines, and expands tabs consistently. A bounded 2,048-entry measured-width cache avoids repeated outline work for long repeated labels. Outlined SVGs have no font references; PDF receives those same vector glyph paths. The tradeoff is no selectable/searchable PDF text; semantic text remains in the canonical plan/reader/preview path.

Composition builds complete token units before placement. Required quantity/warning/time stay with their main token on one page. Every main token is emitted once. Fixed print minima and internal margins are enforced without shrinking. Labels/cards fit whole selected groups or fail; labels use 24 default cells per independent A4 sheet. Sheet/large/custom keep whole groups when possible, then paginate oversized groups at token-row boundaries with measured localized continuation context. Header/first-row and required-row impossibility return source-aware `overflow` without partial plans. Exact-fit regions do not reserve space for absent headings or unused trailing row gaps. Sequence adjacent-unit connectors occupy column/row gaps and stop at page boundaries; boards have none.

Canonical `getWarningMeaning` supplies authored → known-warning → localized-unknown fallback, wrapped in localized visible warning context in every mode. Missing/non-warning warning references retain warning roles/notices. Named neutral fallback and notices preserve unknown main artwork, and empty groups retain visible context/notices. Shared projection owns mode omissions. Unsupported glyphs block only actually rendered selected text and include readable U+ code points/source IDs. Selected sequence totals use shared explicit-group-before-token-sum durations; alternatives never sum into a board group/guide duration.

## TDD and checks

Recorded RED checks preceded implementation: four missing font/adapter assertions, then thirteen missing options/wrapping/planner cases. Implemented font/adapters passed four cases, options/wrapping passed five, and composition passed its initial eight. Later self-review added a failing same-page cross-row connector check (four connectors instead of five) and an exact-fit 35 × 35 mm custom-page check (unnecessary heading/gap overflow); both were corrected and rerun green. Additional painted-bearing, attachment association, duration, and non-warning-reference cases were added and passed. Typed static test imports replace temporary missing-module probes.

Final fresh verification on 2026-10-06:

| Command | Actual result |
| --- | --- |
| `npm test -- src/lib/output-options.test.ts src/lib/text-layout.test.ts src/lib/print-fonts.test.ts src/lib/print-font-adapters.test.ts src/lib/output-plan.test.ts src/lib/output-content.test.ts` | Earlier final-package run: 25/25, six files; one subsequent exact-fit regression was added and final full run includes it |
| `npm test -- src/lib/output-plan.test.ts` after exact-fit fix | **14/14** |
| `npm test` after all final source changes | **411/411**, **31 files**, exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| Strict standalone TypeScript check of durable `proof.ts` with target ES2022/module ESNext/bundler/strict/Vite client/esModuleInterop/skipLibCheck | exit 0 |
| `node docs/phase-3/audits/2026-10-06-overhaul/font-proof/embedded-proof.mjs` | exit 0; reproduced and preserved the rejected embedded-text renderer comparison |
| `node docs/phase-3/audits/2026-10-06-overhaul/font-proof/run-proof.mjs` on final planner/adapters | exit 0; production harness cold offline first output passed; main pictures exactly 3/2/20/85/25 in fixture plans |
| Bundled Python `compare-proof.py` | exit 0; **22 lines** across two artifacts, no missing lines, all ink-edge deltas **≤2 px** across four renderers |

The isolated production proof uses actual Vite bundling, the unchanged current `public/sw.js`, and repository `prepareOfflineAssets` writer. A new context precaches all emitted assets/lazy converter chunks. Before output there are zero prepared FontFaces and no page font/PDF/converter request. The context goes offline, then its first font preparation and SVG/Image/PDF exports succeed with zero server requests. Responses include `Vary: Origin`. Fresh independent standalone SVG contexts inherit no font state. Poppler output and PDF inspection confirm vector output/no image XObjects. This is the font/converter first-use feasibility gate; complete app/update coexistence checks are not represented as complete.

No peer-file diagnostics remain in the final full checks. A temporary generated nested build initially caused lint to traverse minified dependencies; that disposable checked directory was removed, and subsequent proof builds use the OS temporary directory. Scratch Node proof scripts declare process/Buffer locally. Production lint configuration was not changed or weakened. A route-intercepted standalone screenshot timed out; direct standalone SVG navigation fixed the proof harness, and actual output/render comparisons passed. The proof renderer initially omitted canonical outer pictogram stroke properties; visual inspection caught it, and regenerated final evidence applies `ICON_PRESENTATION_PROPS` to the resolver's trusted inner primitives.

## Durable evidence and handoff

`docs/print-fonts.md` records fixed primary-source URLs, license/hash/coverage, dependencies, normalization/bearing strategy, the rejected route, all artifact links, reproduction commands/runtime overrides, the outline semantic tradeoff, and pending physical checks.

Under `docs/phase-3/audits/2026-10-06-overhaul/font-proof/`:

- Reproducible source: `index.html`, `proof.ts`, `run-proof.mjs`, `embedded-proof.mjs`, `compare-proof.py`.
- Passing standalone `diagnostic.svg/.pdf`, `composition.svg/.pdf`.
- Each passing artifact's `-image.png`, `-browser.png`, `-independent.png`, and `-pdf.png`.
- `proof-results.json`: exact face identity/metrics/cmap, prepared/browser cache state and manifest, lazy request order, cold offline server count, path/line/page measurements, runtime inventory.
- `fixture-plans.json`: mixed 3/1, board 2/1, 20 pictures 20/1, 85 pictures 85/4, and 25 labels 25/2 (pictures/pages).
- `rendered-comparison.png/.json`: four renderer comparison panels and per-line thresholded ink bounds at 150 dpi.
- Rejected route evidence: `embedded-image.png`, `embedded-independent.png`, `embedded-pdf.png`, `embedded-metrics.json`. The full rejected SVG/PDF are reproduced in a disposable OS temporary directory, not another production font strategy.

The actual renders were visually inspected after canonical artwork presentation was applied. Glyph shape, accented/decomposed text, advances, wrapping, fixed baselines, warning/value/time association, and leading/trailing/right/bottom `j` boundaries agree. Font diagnostic is 190 × 120 mm; mixed composition is 210 × 297 mm. Chromium 153.0.8010.12, sharp 0.35.4/librsvg 2.62.91, and Poppler 26.07.0 provide the independent rendered paths.

No remaining Task 4 technical blocker is known. Independent task review is required before root commits the owned code/assets/evidence. Package 05 must use the canonical resolver presentation properties, adapters, semantic equivalent, captured plans, and lazy/offline cache handling; package 06 keeps actual-print/participant/device acceptance open.

## Independent-review corrections — 2026-10-06

Both reproduced P2 findings in `task-4-review.md` are corrected. The reviewer probe and config were read before editing and remain unchanged. This section records the correction snapshot; the whole-tree results above describe the original delivery snapshot.

Root extended ownership to `src/lib/attachment-labels.ts` and its focused test. The pure helpers export the agreed `getQuantityDisplayLabel(QuantityAttachment): string` and `getDurationDisplayLabel(DurationAttachment): string`. A nonblank authored label is returned verbatim, including its spacing. An empty or whitespace-only quantity label displays the stored amount and arbitrary unit; an equivalent duration label uses the existing `formatDuration(seconds)`. Nothing is written back to authored data. The planner consumes these helpers for quantity, token duration, and explicit group duration in every content mode. Projection and schema are unchanged. Root was notified so the reader owner can consume the same helpers.

Each row now tracks the source of the unit that determines its maximum height. A required attachment that makes a later column impossible therefore reports that token instead of the first token in the row. The same source survives continuation pagination. Equal-height units deterministically retain the first source; no order, geometry, connector, or attachment association changes were introduced.

New tests cover nonblank labels preserved verbatim; blank, tab/newline, and nonbreaking-space labels; arbitrary units; multi-part durations; frozen attachment data; all three output modes; document immutability; and oversized later columns in the first and continuation rows.

| Command/check | Actual correction result |
| --- | --- |
| Original unchanged `npm test -- --config .superpowers/sdd/2026-10-06-agent-implementation/task-4-review-probe.config.mts` before edits, 17:16:37 | **4 failures**, exit 1: three missing numeric display cases and incorrect later-token source |
| Own filtered helper/planner TDD check before implementation, 17:18:05 | **9 failures**, 14 skipped, exit 1 |
| `npm test -- src/lib/attachment-labels.test.ts src/lib/output-plan.test.ts` after correction, 17:19:21 | **23/23**, exit 0 |
| Original unchanged reviewer probe after correction, 17:19:26 | **4/4**, exit 0 |
| Focused attachment helpers, output options, text layout, font preparation/adapters, planner, and shared output-content suite, 17:20:45 | **35/35**, **7 files**, exit 0 |
| `npm run typecheck` on the shared checkout | Failed only with Task 3 peer diagnostics: `src/app.tsx:445`, `:446`, `:450`, TS2322 missing required `session: DocumentSession` prop. No peer files were edited. |
| `npm run lint` | exit 0, no diagnostics |
| Strict standalone TypeScript check of durable `proof.ts` | exit 0 |
| `node docs/phase-3/audits/2026-10-06-overhaul/font-proof/run-proof.mjs` | exit 0; refreshed production bundle and cold first-use offline SVG/Image/PDF proof |
| Bundled Python `compare-proof.py` | exit 0; **22 lines**, all four-renderer ink-edge deltas **≤2 px** |

The durable mixed composition now deliberately stores an empty quantity label, whitespace-only token duration label, and empty explicit group duration label. Its refreshed actual image and PDF visibly retain `2 small cups` and both `5m` values. The final SVG/PNG/PDF, fixture plans, result JSON, and independent comparison artifacts were regenerated; image/PDF composition was visually inspected. Counts remain mixed 3/1, board 2/1, 20 pictures 20/1, 85 pictures 85/4, and 25 labels 25/2. `docs/print-fonts.md` records the structured-value recovery fixture.

Task 3 remains active in the shared checkout. At root's instruction, final integrated full-unit/type/build gates are reserved for the settled-tree checkpoint; the targeted correction gates and unchanged reviewer probe pass now. The isolated production proof build passes. Physical readability, actual-print, participant, and device acceptance remain pending as previously recorded. No Git/index changes or reviewer-file edits were made. The correction is ready for root checkpoint and the original reviewer's scoped re-review.
