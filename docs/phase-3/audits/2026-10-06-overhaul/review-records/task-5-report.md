# Task 5 — delivered output and final integration evidence

**Status: final owned delivery complete and source stopped for root's checkpoint/review.** The bounded package was independently approved at fe5f225; the final integration delta uses Task 3's frozen actual App at 1517d8b and the authorized legacy retirement. No Git/index changes, child agents, installs, app/main/shared CSS/catalog edits, or external actions. Root owns final runner wiring, independent delta review and clean-install acceptance. Physical/device/human acceptance remains pending.

## Delivered behavior and exact files

- `src/lib/output-svg.ts` and `output-svg.test.ts`: detached physical SVG with exact mm dimensions/viewBox, explicit controlled canonical artwork styling, prepared outline text, escaped authored attributes, source/role order, backgrounds, named missing artwork, directional connectors and finite/page-bound guards. Renderer consumes the existing `OutputPage` and font adapters; it adds no layout model, wrapping or PDF heading.
- `src/lib/output-export.ts` and `output-export.test.ts`: separate `createSvgFile`, `createPngFile`, `createPdfFile` promises; captured page copies before asynchronous font work; finite integer/range page guards; lazy converters; all PDF pages at their own mm dimensions; vector paths; temporary SVG cleanup; PNG destination rendering at `round(mm / 25.4 * dpi)`, only 150/300 dpi, 24M guard before Image/canvas allocation, dimension/context/image/toBlob failures and object-URL cleanup. White PNG destinations are filled to keep their complete pixel edges opaque; transparent destinations stay unfilled. File APIs never download.
- `src/components/OutputDialog/output-request.ts` and `output-request.test.ts`: private, injected/testable controller; immutable captured document/options/identity/locale; monotonically increasing acceptance generation; source edits require explicit Refresh; settings supersede promises; close/guide switch discard pending preparation and file completion. One activation downloads one captured artifact with captured title/page/density. Failed or empty artifacts never claim success. Expected issues and technical diagnostics stay separate; JSON backup clones the latest live source independently of physical readiness.
- `src/components/OutputDialog/OutputDialog.tsx`, `output-dialog.css`: frozen four props, native modal/Close/Escape, translated explicit select names, all canonical presets/defaults/orientation/modes/background/metadata/selected groups/custom dimensions/label-sheet settings, notices/preflight/retry/stale Refresh, one PDF action and numbered per-page SVG/PNG actions. No session/preference imports. App owns opener restore and shortcut suspension. Numeric drafts retain input focus across preparation; invalid edits are reported by canonical normalization. Mobile header overrides the browser dialog max-width and stacks the unchanged zoomed title/Close, with a normal full-width Close control.
- `src/components/OutputPreview/OutputPreview.tsx`, `output-preview.css`: exact shared SVG preview, dimensions/page count/mode/background, local page navigation/zoom, canonical normalized region bounds outside exported SVG, print-at-100%-size explanation, captured/selected `ReadingContent` semantic equivalent, hidden duplicate SVG traversal.
- `public/sw.js`: only `/fonts/` added to the existing public build `/assets/`/`/icons/` Vary exception. Same-origin GET policy, waiting updates, cache lifecycle and strict private-response semantics preserved.
- `scripts/offline-assets.test.mjs`, `scripts/service-worker.test.mjs`: font/license/lazy assets in the complete manifest, unchanged cache stability and changed font/lazy-chunk cache identity, narrowly scoped font Origin variants and unchanged reload/origin/method checks. Existing recursive `scripts/offline-assets.mjs` already includes these files; no production writer change was needed.
- `.claude/skills/run-instruction-builder/pwa-update-check.mjs`: actual waiting-worker old/new cold lazy module and real TTF retrieval with `Vary: Origin`, retained other-product cache, console.error + pageerror collection, durable requested-output artifacts and owned server/browser cleanup.
- `docs/phase-3/audits/2026-10-06-overhaul/export-proof/`: reproducible isolated UI/production artifact entrypoints, actual portable SVG/PNG/PDF files, independent renders/comparison, source plans and machine evidence; nested `pwa-update/` stores update results/screenshots. All generated evidence survives ignored scratch cleanup. The production proof validates and removes only its owned mkdtemp directory and always closes browser/server.

## Frozen integration seam

```ts
export interface OutputDialogProps {
  sourceDocument: InstructionDocument;
  guideId: string | null;
  locale: AppLocale;
  onClose: () => void;
}
```

Named import: `OutputDialog` from `src/components/OutputDialog/OutputDialog.tsx`. Task 3's actual App now uses this reviewed seam. App captures locale/opener before mount, supplies the live immutable document prop, unmounts immediately on guide identity change, suspends shortcuts while output is open and restores opener focus after unmount. The dialog clones source on mount, observes changes before reading readiness and disposes requests before calling `onClose`.

Refresh retains a still-existing explicit selected subset. If every old group was selected, Refresh selects all current groups, including new ones. It does not silently repair invalid physical settings. Shared reading comes from `toReadingGroups(capturedDoc, mode, capturedLocale)`, filtered by `ReadingGroup.stepId`; `ReadingContent` remains package 03's pure named export. Bounds come from the approved normalization helper, outside the exported SVG.

## RED → GREEN evidence

- Renderer: initial focused assertions failed before implementation, including all three strengthened geometry/style/bounds cases; then 3/3 passed.
- File APIs: 11 initial failures before implementation, then the separate font-issue regression failed before mapping; 12/12 passed. Actual production PNG proof later observed white corner alpha 253 instead of 255. A new unit test failed with no destination fill; after the white-only fill correction, 13/13 passed and real corner checks passed.
- Request controller: all 13 focused cases failed before implementation, then 13/13 passed, including deferred preparation, stale consent, close/guide switch/settings supersession, captured filename/page/density, retry, JSON preservation and converter failure with no download.
- Browser: placeholder lacked the required named settings. Real initial select accessible names included their options; the named-control check failed until explicit translated names were added. Native UI then passed. Root's visual review identified the 320px/200% German header collapse; the new `Close width >= 200px / height <= 100px` assertion reproduced RED, then the CSS correction passed without shrinking text. Root inspected and accepted the refreshed screenshot.
- Offline tooling: font/license manifest tests already passed against the recursive writer; service-worker `/fonts/` Vary assertion was RED (4/5), then 5/5 GREEN after the narrow path addition.

## Actual commands and results

Latest bounded-source checks:

| Command | Observed result |
| --- | --- |
| `npx vitest run src/lib/output-svg.test.ts src/lib/output-export.test.ts src/components/OutputDialog/output-request.test.ts` | **29/29**, 3 files, 18:10:48 local |
| `node --test scripts/offline-assets.test.mjs scripts/service-worker.test.mjs` | **5/5**, 18:10 local |
| `npm run typecheck` | exit 0 after source/UI correction |
| `npm run lint` | exit 0, including owned proof scripts |
| `npx tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --jsx react-jsx --jsxImportSource preact --lib ES2022,DOM,DOM.Iterable --skipLibCheck --types vite/client docs/phase-3/audits/2026-10-06-overhaul/export-proof/ui-proof.ts` | exit 0, independent harness/source type check |
| `node docs/phase-3/audits/2026-10-06-overhaul/export-proof/run-ui-proof.mjs` | **6 checks PASS**, zero console/page errors, refreshed zoomed screenshot |
| `node docs/phase-3/audits/2026-10-06-overhaul/export-proof/run-artifact-proof.mjs` | **PASS: 3 independently cold formats, 12 fixtures, 43 actual files**, zero server requests during offline output, no online font/converter output warmup |
| Bundled Python `compare-artifacts.py` | **15 pages / 199 text lines**, independent SVG/PDF vs actual PNG, every glyph-edge delta <=2px, exact PDF page sizes |
| `node .claude/skills/run-instruction-builder/pwa-update-check.mjs` | **PASS** waiting update, old/new first lazy module and font offline, other-product cache retained, zero console/page errors |

Windows Vite/Vitest/Node test-runner/Chromium checks use authorized escalation for subprocess execution. An initial ad-hoc harness tsc invocation omitted strict narrowing/DOM.Iterable and produced configuration-dependent errors; the complete command above passed without production changes. No unrelated active peer diagnostics were fixed.

## Durable evidence and review entrypoints

All paths below are under `docs/phase-3/audits/2026-10-06-overhaul/export-proof/`:

- `run-artifact-proof.mjs [output-dir]`: owned isolated production build + actual cold offline APIs. `artifact-proof-results.json` records current build manifest/runtime, all files, cold phases and negative results; `artifact-plans.json` records the canonical source/role display lists.
- `compare-artifacts.py [output-dir]`: independently opens the produced SVG with Sharp and PDF with Poppler/PyPDF/Pillow comparison. `artifact-render-comparison.json` and `artifact-render-comparison.png` record every tested text line and visual gallery. Root inspected the gallery and workplace PDF: distinct aligned pictures, readable text and no visible clipping.
- Real prototype files: `workplace.pdf`, `workplace-page-01.svg`, `workplace-page-01.png`; `routine.pdf`, `routine-page-01.svg`, `routine-page-01.png`.
- Required-content modes: `required-labels`, `required-pictures`, `required-detailed` PDF/SVG/PNG. They retain numeric blank-label quantity and token/group times without authored mutation, authored unknown-warning meaning and unlabelled localized unknown-warning meaning in every mode.
- `continuation.pdf` plus pages 01–03 SVG/PNG: **85 main token occurrences, each exactly once in source order**. No cropped tall-step refusal. `label-sheet.pdf` plus pages 01–02: **25 groups / 24 cells per A4 sheet**, 25th cell on the second complete page. `label.pdf` is exactly **50×30mm**; `label-page-01-300dpi.png` is **591×354px**. A4 150dpi is **1240×1754px**. PDF vectors contain no image XObjects and no extra heading.
- `selected` follows source order even when selected IDs are supplied out of order. `board` suppresses procedural connectors/numbering/totals. `transparent` SVG/PNG omit/fill no white background; white PNG pages are opaque to their pixel edges.
- Visible Japanese and Detailed Japanese notes block with unsupported-glyph; omitted Japanese notes permit Pictures. A 3000-W title blocks overflow, and a valid 1000mm custom page rejects PNG over 24M pixels. No partial plan/download is supplied by the controller on blocked preflight.
- `run-ui-proof.mjs [output-dir]`, `ui-proof-results.json`, `edited-source-page-01-of-01.svg`, `output-de-320px-200-percent-text.png`: native modal, named defaults, source stale/Refresh, one actual numbered SVG download, Escape/opener, EN/DE controls, 44px target minima, 320px/200% text, custom/grid correction, empty selection, focus retention, transparency copy, bounds/semantic selection and board metadata.
- `pwa-update/pwa-update-results.json`, `old-first-font-offline.png`, `new-first-font-offline.png`: old/new font and lazy-asset waiting-update evidence.

The existing isolated `index.html`/`ui-proof.ts` adapter exposes `window.prepareOutputProof(sourceDocument, Partial<OutputOptions>)` and `window.outputProofArtifact(format, pageIndex?, dpi?)`. Root can create separate package-06 A6/A3/custom workplace/routine print samples by supplying canonical preset/locale/customSize options to that unchanged adapter. Initial parity delivery includes A4 prototypes, individual label and label-sheet; it does not yet contain matching prototype A6/A3/custom sample counterparts.

## Final integration delta — 2026-10-06

Root released the reviewed actual App and authorized legacy retirement. A named-import search found no current App/proof/script consumer of the obsolete physical APIs. Deleted `src/lib/svg-export.ts`, `svg-export.test.ts`, `png-export.ts`, `pdf-export.ts`, `pdf-export.test.ts`; removed `CanvasExportInput`, `runCanvasExport`, `runSvgExport`, `runPngExport`, `runPdfExport` and their imports from `document-actions.ts`. Preserved `runJsonExport`, `readImportFile` and their result contracts. Added three JSON orchestration cases to `document-actions.test.ts`: complete editable unsupported text, incomplete backup with warning, and failure without a success warning. All six JSON/import cases pass. Root explicitly directed that unused `pdf-pagination.ts`/tests remain; no live alternate exporter consumes them. Existing driver and the new audit retain connected-anchor/deferred URL lifetime checks.

Owned full-App checker changes:

- `.claude/skills/run-instruction-builder/export-review.mjs <output-dir> <url>` (URL `-`/absent owns and closes a dev server): **55 checks / 21 actual files**. Long 50-W heading is complete across its planned fragments, 99-day time survives, all three library artworks survive palette changes, selected physical/semantic sources stay in document order, required quantity/group/token durations/warning meaning survive Labels/Pictures. Visible Japanese and Detailed optional Japanese block without physical downloads; omitted optional Japanese permits output; complete JSON still downloads for blocked text and 3000-W overflow. The 85-picture guide has **three explicit SVG actions and one complete three-page vector PDF, 85 ordered unique main sources**. Exact A4 150/300dpi PNG dimensions/opaque corners, portable SVG, transparent SVG/PNG and paper explanation, 24M preallocation refusal, failed canvas/no file and SVG recovery pass. Every activation asserts one nonempty download, connected anchor and URL still alive through the click task. Both console.error/pageerror are empty; each context and owned browser/server close even on failure.
- `.claude/skills/run-instruction-builder/pwa-check.mjs <url> <output-dir>`: **45 checks**, four independently fresh installed contexts and real named files. PDF, PNG, SVG and JSON each survive native stored-guide offline reload and work on their first offline use. Before going offline each context records zero page font/converter requests, zero FontFaces and zero downloads, while the complete worker cache already contains fonts/license/converters. Source identity, required content, vector A4 PDF, portable A4 SVG, decoded opaque 150dpi PNG and full unchanged editable JSON pass. JSON never prepares the font/converters. No failed requests or browser errors. Requested output path contains all files/screenshots/machine evidence; every context/browser is cleaned up.
- `.claude/skills/run-instruction-builder/pwa-update-check.mjs <output-dir>` retains the existing synthetic lazy/actual font/Vary/waiting/other-product regression and adds **two actual production Apps** in validated owned OS temporary directories. Build-only main/jsPDF/svg2pdf markers force distinct hashed identities without changing persisted data/export geometry. After switching the server to only-new files, the old converter URL returns **404**. The worker stays installed/waiting across **at least 500ms**, the old controller identity remains, and both complete caches coexist. The old App's first OutputDialog PDF/font/converters then load offline with zero server requests. Closing the last old client permits activation/removal of only the old product cache. The new App restores the same native guide, starts with zero FontFaces/converter requests and produces its first PDF offline. Both actual files have the expected captured filename, exact A4 one-page vector structure; physical and semantic preview IDs match all three source pictures, with quantity/warning/explicit time retained. Actual converter markers prove the old/new identities were executed. Other-product cache survives; failures/console/page errors are empty. Context/browser/server close in nested cleanup even if a preceding close fails; only validated mkdtemp roots are removed.

The independent bounded review's P3 board proof finding is fixed in `export-proof/run-artifact-proof.mjs`. The old nonexistent-role predicate accepted a synthetic canonical `context` numbered-step counterexample (RED). The corrected predicate asserts normalized board step-number/total flags are false and canonical localized generated-number/total text is absent, while explicit times remain. Canonical context/heading counterexamples and both flags now fail correctly (GREEN). Actual complete board SVG/plan also pass. Refreshed production proof remains **12 fixtures / 43 files / 3 cold formats**, independent comparison **15 pages / 199 lines, all edge deltas <=2px**. No production output source changed for this proof correction.

Fresh final checks after retirement:

| Command | Observed result |
| --- | --- |
| `npm test -- src/lib/document-actions.test.ts` before removal | **6/6**, 18:41 local |
| `npm test` after removal | **461/461**, 35 files, 18:45 local (463 minus five obsolete tests plus three JSON tests) |
| `npm run build` | exit 0, TypeScript + Vite production + **16 offline assets** |
| `npm run lint` | exit 0 |
| `npx eslint` on all three owned checker files `--no-ignore` | exit 0 |
| `npm run test:tooling` | **7/7** with Windows subprocess escalation |
| Complete strict independent `ui-proof.ts` tsc command listed above | exit 0 |
| `node .../run-artifact-proof.mjs --board-predicate-probe` | canonical counterexamples/flags/explicit-time checks PASS |
| `node .claude/skills/run-instruction-builder/export-review.mjs docs/phase-3/audits/2026-10-06-overhaul/export-integration-proof -` | **55 checks / 21 files**, zero errors |
| Owned Vite preview + `pwa-check.mjs <preview-url> docs/phase-3/audits/2026-10-06-overhaul/export-integration-proof/pwa` | **45 checks / 4 separately cold formats**, zero errors |
| `node .claude/skills/run-instruction-builder/pwa-update-check.mjs docs/phase-3/audits/2026-10-06-overhaul/export-integration-proof/pwa-update` | synthetic and actual production update checks PASS, zero errors |

Initial tooling execution in the sandbox reported `spawn EPERM`; authorized escalation passed without source changes. An attempted proof tsc config path did not exist; the actual complete standalone strict command passed. Proof-only audit corrections accommodated wrapped heading fragments, the precise authoring-panel Close control, bounded Windows artifact paths for deliberately unbounded titles, and collapsed semantic-disclosure `textContent`. None changed authored data or production behavior. The actual-update check was re-run after its final cleanup/evidence polish and passed.

Final durable evidence is under `docs/phase-3/audits/2026-10-06-overhaul/export-integration-proof/`: `export-review-results.json`, `pwa/pwa-check-results.json`, each actual file and screenshot, `pwa-update/pwa-update-results.json`, and `pwa-update/actual-app/actual-app-update-results.json`, `old-first-output.pdf`, `new-first-output.pdf`, both offline screenshots. Root owns runner wiring and whole release/clean-install/browser matrix; these direct full-App checks are delivered ready for its serialized acceptance. No outstanding owned implementation blocker remains.

## Remaining physical/device/human limits

Text uses the approved same-font vector outlines. PDF/SVG text is visually portable but is not searchable/copyable as text; canonical plan/reader retains semantics. Automated proof is Chromium/Sharp/Poppler on this Windows environment. Actual prints, physical readability, iOS/Android resource behavior, keyboard on mobile, screen-reader/device testing, and participant comprehension remain pending package-06 acceptance. No font licensing permission, recipient suitability or physical printing success is inferred from these artifacts.
