# Overhaul integration and release acceptance

**Owner:** Acceptance agent, with a fresh final reviewer. **Dependencies:** Completed packages 00–05. **Deliverable:** Reproducible technical checks and an honest record of practical usability, printing, devices, remaining limitations, and recovery.

## Owned files and evidence

Own the final browser fixture/runner updates under `.claude/skills/run-instruction-builder/`, affected tooling tests under `scripts/`, and CI verification wiring in `.github/workflows/ci.yml`. Module implementers own their focused tests first. Store new evidence under `docs/phase-3/audits/2026-10-06-overhaul/`; update `README.md`, `docs/milestones.md`, `docs/known-issues.md`, and progress/recovery documentation. Do not rewrite historical evidence as if it tested the overhaul.

## Technical release gate

From the locked dependencies using Node 24, run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:tooling`, `npm run build`, install Chromium through the existing Playwright command, then `npm run test:browser` and `npm run test:pwa`. Run full/production dependency audits. Record command, build/commit identity, date, result, and artifact location. Do not carry forward the maintenance's 323-test count as an overhaul result.

Every reported browser expectation must assert and fail the process when false. Keep the deliberate false-check regression, owned ephemeral server shutdown, error-console assertions, service-worker cache isolation, update waiting, and lazy-asset availability for old clients. Do not weaken gates simply because the authoring DOM changed.

## Integrated fixtures

| Fixture | Required result |
| --- | --- |
| Legacy v1 recipe and label-only quantity | Imports/migrates into a new local v2 sequence with IDs/content preserved |
| Object-only routine and choice board | Valid content; saved/imported board retains unnumbered, arrow-free meaning; timed alternatives are never summed |
| Five groups, one with 20 pictures | Readable controls at 320 px; tap/keyboard creation and move works without global shrink |
| Mixed libraries and unknown ID | Palette switches preserve content; unknown named fallback remains visible/editable/exportable |
| Unknown warning, with and without authored label | Retains warning context/meaning in semantic view, preview, and every exported mode |
| Long German text, accents, ß, quotes, ampersands | Accurate wrapped output and escaped text in all supported formats |
| Unsupported Japanese rendered text | Clear affected-content preflight error; no corrupt download; omitted optional text does not block |
| 85-picture sequence group | A4/A3 continuation retains each main token exactly once and readable repeated context |
| Label/card overflow | Specific larger-size/smaller-group guidance; no tiny or clipped download |
| Quantity/time/warning and Detailed notes | Same chosen content in semantic view, preview, SVG, PNG, and PDF |
| Multiple local guides, two tabs | Independent saves, same-guide conflict, history isolation, delete protection, raw recovery |
| Cold installed build, offline first export | All three palettes/fonts and every format work without a prior online export |
| Updated build with an old open tab | Old lazy assets remain usable until the tab closes; new version then works offline |

Open generated SVG/PNG/PDF independently of the app. Inspect actual page dimensions, fonts, picture paths, grayscale, continuation rows, selected groups, metadata, and page completeness. File signatures/page counts alone do not establish accuracy. PNG tests check rounded mm-to-pixel dimensions and the 24-million-pixel refusal before allocation.

## Practical creator and recipient checks

Prepare one three-step repetitive workplace/kitchen task and one familiar teaching/daily routine from the shipped inventories. Record each intended action, required warning, optional detail, and the recipient's context before testing. Do not assume an arbitrary stock example matches actual practice.

A workplace creator makes the guide, changes a picture, moves a picture without dragging, undoes a mistake, and prints a label and A4 guide. A recipient interprets the intended task and warning using customary support. Compare labelled and pictures-only output; record ambiguous pictures and missed or misunderstood information.

A teacher/parent and child build the familiar routine. Record which add/find/move/undo/read actions the child completes, the assistance required, and whether the printed result is understood. Include an object-only board where relevant. Use the participants' ordinary support arrangements; record observations without turning them into a universal age or disability claim.

Agents supply task scripts, fixtures, printable files, and a results template. Human sessions must be performed by people with access to participants; if they have not happened, mark the associated release evidence pending. Fix observed blockers and repeat the affected task.

## Physical formats and devices

Print **50 × 30 mm**, A6, A4, and A3 at **100% actual size**. Record printer/scaling, measured output size, viewing distance, content mode, grayscale/color, observer context, and result. Check warning visibility and distinguishable picture silhouettes at the smallest supported region. The starting 10 pt / 9 pt / 15 mm / 25 mm values may change based on evidence; update shared specs and affected tests together.

Use real iOS Safari and Android Chrome with software keyboards, rotation, interrupted saving, installed/offline behavior, export downloads, and custom-size preview. Record device/OS/browser versions. Test desktop keyboard plus VoiceOver/Safari and NVDA with a supported browser where available; record actual reading/focus behavior rather than only accessibility-tree snapshots.

## Completion and handoff

Technical integration is complete when the automated gates and independent artifact inspection pass. Practical release acceptance additionally needs recorded creator/recipient, physical print, and real device/screen-reader results, with blockers fixed. Keep those statuses distinct so unattended agents can finish useful implementation without fabricating human evidence.

The handoff names supported languages, limits of unsupported text, local storage/backup behavior, record/schema migrations, conflict and recovery steps, browser evidence, artwork/font provenance, and unresolved issues with owners. Update milestones to the reviewed overhaul scope. Deployment, merging, cloud services, and contacting test participants require their own authorization; this specification does not schedule or publish anything.
