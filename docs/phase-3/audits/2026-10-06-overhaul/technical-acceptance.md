# Overhaul technical acceptance

**6 October 2026: local technical gates, independent package reviews and final handoff/evidence review passed. Practical release acceptance remains Pending.** This is the local overhaul, not a deployed release. Historical maintenance/package counts remain dated separately. The [final review](review-records/task-6-final-review.md) approves technical Task 6 and handoff at `f382c0f`, closing the A3 evidence finding.

## Identity and runtime

Source/checker checkpoint **`8eb60c6`**. Production built at **`c577134`**; the intervening delta only imports Node values in four checkers and preserves a review, with no production/dependency change. Later handoff commits contain docs/evidence. **Node 24.19.0 / npm 11.17.0 / Chromium 153.0.8010.12, Windows.** Production cache **`instruction-builder-v2-84482efca478c95d`**, **16 assets** including all libraries, font/license and lazy converters. The [machine record and manifest](final-verification/README.md) preserve identity and command exits. GitHub CI source is reviewed; remote CI was not run in this local-only delivery.

## Independently reviewed deliveries

| Package | Accepted local checkpoint | Review/evidence |
| --- | --- | --- |
| 00 Shared v2 schema, session and content/output contracts | `2338176` | [Foundation/fixture approval](review-records/task-0-review.md) |
| 01 Three libraries, original artwork, EN/DE messages/examples | `75f37d3` | [Search correction approval](review-records/task-1-fix-review.md), all 140 meanings digitally inspected |
| 02 Local guides, preferences and recovery | `246e50e` | [Reload safety approval](review-records/task-2-fix-review.md), 16 actual IndexedDB cases |
| 03 Responsive editor and semantic reader | `bae7729`, final App hookup `1517d8b` | [History/modal/focus correction approval](review-records/task-3-fix-review.md), [output integration approval](review-records/task-3-output-integration-review.md) |
| 04 Font proof and physical composition | `15d16b9` | [Numeric content/source correction approval](review-records/task-4-fix-review.md), real independently reopened renderers |
| 05 Physical preview, formats and offline integration | `fe5f225`, final integration `fc2950b` | [Initial approval](review-records/task-5-review.md), [final integration approval](review-records/task-5-integration-review.md); board-proof P3 closed |
| 06 Root CI/runner, context, print preparation/checker imports and final handoff | `01e49ad`, `c577134`, `8eb60c6`, `f382c0f` | [CI/doc preparation](review-records/task-6-doc-preparation-review.md), [runner/samples review](review-records/task-6-integration-preparation-review.md), [checker correction approval](review-records/task-6-checker-lint-review.md), [final approval and A3 closure](review-records/task-6-final-review.md) |

The three reused workers cross-reviewed others' deliveries; no one approved their own package. The harness could not create a fourth fresh reviewer thread. Final integration review covers root handoff/gates and their composition with already independently accepted packages, without self-approving an implementer's earlier modules. [All records](review-records/README.md) preserve findings and actual boundaries.

## Fresh clean-install gates

All required commands exited **0** on 6 October; [logs, timestamps, machine results and actual downloads](final-verification/README.md) are preserved.

| Command | Observed result |
| --- | --- |
| `npm ci` on Node 24 | 247 packages installed; 248 audited; zero vulnerabilities |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | **461/461**, 35 files |
| `npm run test:tooling` | **7/7**, including deliberate false/missing/numeric check rejection |
| `npm run build` | exit 0; 16-asset manifest generated |
| `npx playwright install chromium` | exit 0; existing Chromium available |
| `npm run test:browser -- docs/phase-3/audits/2026-10-06-overhaul/final-verification/browser` | **236 named checks** (29/22/51/53/26/55) plus native storage/recovery gate; **21 export-audit files**, empty console/page errors |
| `npm run test:pwa -- docs/phase-3/audits/2026-10-06-overhaul/final-verification/pwa` | **45 checks / four separately cold formats**, synthetic and actual production waiting updates pass; empty errors/failures |
| `npm audit` / `npm audit --omit=dev` | **0 vulnerabilities** in each |
| Supplemental explicit `eslint --no-ignore` checker gate | Initial RED8 errors/1 warning -> import-only correction -> identical command GREEN; [exact command and dated records](final-verification/README.md) |

The runner owns and closes ephemeral servers, stops on a nonzero child, and the seven scripts run sequentially. Tooling still rejects false expectations. Waiting updates and other-product caches retain their isolation. Fresh checks are separated from earlier digital font/artifact inspection; no file signature is presented as independent rendered accuracy.

## Fixture evidence

| Case | Observed evidence / result |
| --- | --- |
| v1 import, historical label-only quantity and raw optional/unknown data | Model/import/repository tests and browser driver/native migration cases pass; JSON preserves full authored data |
| Five groups / one 20-picture group at 320/390/768/1440px, 200% text | 51 responsive checks pass; [machine record/screenshots](final-verification/browser/editor-evidence.json); 44px controls/16px authoring text and no global shrink |
| Tap/keyboard add, captured target, edit/move/history/Read return | Driver29/review22/transition53 pass; empty-group focus and committed vs unrelated attachment drafts covered |
| Settings/import/output Escape, desktop drafts, mobile one sheet including resize | Native transition53/App-output26 pass; opener return, shortcut suspension, guide switch and current-source Refresh covered |
| Mixed libraries and preference/authored-label independence | Reader/unit/browser cases pass; global artwork survives palette changes and locale capture stays explicit |
| Sequence, picture-only routine, choice board | Projection/reader/physical tests plus browser semantics pass; no generated number/connector or sum of alternatives; explicit times remain |
| Multiple guides, baseline conflict, tombstone and explicit reload | Repository/controller cases plus actual native browser safety gates pass; different guides/history isolate; local edits/reload failure preserve draft |
| Exact unreadable recovery and backup-copy failure | Tests and real reliability gates pass; repeated recovery originals survive fallback, failed copy blocks creation and allows explicit JSON backup |
| Unknown pictures and labelled/unlabelled unknown warnings | Named fallback and required warning context retained in all semantic/physical modes; current App audit55 passes |
| German/Latin accents, ß, escaping, newlines and long labels | Font/text/layout tests plus real [font proof](font-proof/proof-results.json) and [199-line independent comparison](export-proof/artifact-render-comparison.json) pass |
| Unsupported visible Japanese / omitted-note exception | Actual App exports block without a physical download, Detailed notes block, Pictures omitting note succeeds; full JSON remains available |
| 50x30mm/A6/A4/A3/custom / 24th-25th label | Option/layout tests and real exports pass; [ten samples / fourteen independent MediaBoxes](print-samples/independent-pdf-results.json); 25th label begins second complete sheet |
| 85-picture continuation, required attachments/notes | A4 actual App audit: 85 mains once/in order across three complete pages. [Focused actual A3 proof](continuation-a3-proof/README.md): 85 pictures with required attachments, six 297 × 420 mm pages, default 25 mm pictures, 308 checks and 689 independently reopened symbol/text comparisons (maximum 1 px edge difference, zero unmatched ink); no partial/tiny output |
| PNG150/300dpi and 24M refusal | Actual A4 **1240x1754 / 2480x3508px**, opaque/transparent checks pass; allocation/download blocked above cap; vector recovery passes |
| Captured plan / stale async / numbered page downloads | 29 output unit tests and App-output26/audit55 pass, including selected source/semantic parity and close/settings/guide-switch supersession |
| Cold installed build / first output | Four fresh PDF/PNG/SVG/JSON contexts pass with zero online font/converter/output warmup, all libraries cached and source restored |
| Waiting update / old first lazy export / later activation | Synthetic and actual old/new Apps pass; **512ms** waiting, old converter server404, first old/new offline PDFs, old cache deleted only after final old client closes; other-product cache retained |
| Independent reopened formats and painted extents | Prior production **12 fixtures /43 files**, **15 pages /199 text lines**, all glyph edges within **2px**; vector PDF has no image XObjects, SVG opens independently; root digital inspection preserved |

Root additionally inspected final 320px contextual viewport and actual desktop output modal: Close/search/picture and captured required values remain visible. Final offline screenshots capture actual download controls; semantic/content assertions and PDF/vector checks establish the complete export rather than the scrolled screenshot alone. Root also inspected all six A3 comparison rows and full independent PDF page6: repeated context, final main85 and required quantity/warning/time visible with no observed clipping/overlap. Detailed sample/contact-sheet observations remain digital evidence.

The final independent review found the initially missing A3 stress combination. Its [focused report](review-records/task-6-a3-proof-report.md) supplies that proof through unchanged production APIs; broad green gates were not repeated. The [original reviewer independently approved the scoped closure](review-records/task-6-final-review.md) at `f382c0f`, with no remaining technical finding. This development-adapter proof adds no new cold-installed, full-App or practical acceptance claim.

## Practical release acceptance

**Pending:** new workplace/teaching creator and recipient sessions, actual-size/color/grayscale prints and viewing distance, real iOS/Android software keyboards/downloads/saving/offline, and actual VoiceOver/NVDA reading/focus. Use [task scripts](creator-and-recipient-tasks.md), [prepared print files](print-samples/README.md), [results template](practical-acceptance-template.md) and [next-owner handoff](implementation-report.md). Fix observed blockers and repeat affected tasks before practical release acceptance.

Current deliberate limits: English/German/covered Latin printed text; unsupported glyph preflight, vector text without search/select; 150/300dpi/24M raster cap; local browser/device storage with JSON backup and final-edit abrupt-teardown window; optional drag deferred. The owner must establish the [original artwork distribution license](../../../artwork/LICENSE-STATUS.md) before public release. Nothing from this run was pushed, merged, deployed or sent to participants.
