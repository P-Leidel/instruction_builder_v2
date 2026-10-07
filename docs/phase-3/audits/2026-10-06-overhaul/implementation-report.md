# Visual instruction overhaul implementation and handoff

**6 October 2026 — technical overhaul delivered and independently approved in the local worktree.** This report covers the approved [agent implementation plan](../../../superpowers/plans/2026-10-06-agent-implementation.md). Clean-install gates, independent package reviews and the [final handoff/evidence review](review-records/task-6-final-review.md) passed, including the scoped A3 stress proof at `f382c0f`. Practical release acceptance remains pending: no new participant session, physical print, real mobile device, or real screen-reader result is implied by automated checks. Nothing from this run has been pushed, merged, or deployed.

## Product direction

The primary use is making short visual reminders across language barriers in kitchens and other repetitive physical jobs. Teachers, parents, nonverbal children, and people with cognitive disabilities use the same simple authoring flow. The release supports ordered instructions, object-only routines and unordered choice boards, three content libraries, English/German controls and default labels, several local saved guides, and physical output from labels to A3 or custom sizes. App language and default-label language are independent; changing either never translates authored content.

The [specification index](../../../superpowers/specs/2026-10-06-overhaul/README.md) contains the confirmed product decisions. The [original takeover audit](../2026-10-06-takeover-review.md) records the observed baseline; [maintenance](../../progress/2026-10-06-reliability-maintenance.md) records earlier fixes and must not be presented as overhaul acceptance.

## Deliveries and review

| Delivery | Current status | Evidence |
| --- | --- | --- |
| Shared v2 model, session and output contracts | Independently approved | `989b378`, fixture correction `2338176`; 338 tests at that checkpoint |
| Three libraries, original vectors, bilingual messages and examples | Independently approved | `34863d1`, search correction `75f37d3`; all 140 meanings inspected digitally |
| Local guides, preferences, transactions and recovery | Independently approved | `9919893`, reload correction `246e50e`; 416 integrated tests and 16 actual IndexedDB cases |
| Responsive authoring, My guides and semantic reading | Independently approved | `d737543`, correction `bae7729`, App hookup `1517d8b`; desktop draft/history/modal/focus fixes verified |
| Font preparation and physical composition | Independently approved | `96582f7` / `bcdb541`, correction `15d16b9`; actual standalone SVG, browser image and PDF comparisons |
| Physical preview, SVG/PNG/PDF and offline integration | Independently approved | `fe5f225`, final integration `fc2950b`; legacy physical exporters retired, JSON retained |
| Final technical acceptance and maintainer handoff | Independently approved; practical release pending | Source/checker `8eb60c6`, production `c577134`, A3 proof/handoff `f382c0f`; [technical acceptance](technical-acceptance.md) |

Counts above are dated package checks. Fresh final results are **461 unit tests / 35 files**, **7 tooling tests**, **236 named browser checks** plus real storage/recovery gates, and **45 cold PWA checks / four formats** plus synthetic and actual old/new update proofs. Lint/type/build/clean install/Chromium installation and full/production audits exited 0; audits reported zero vulnerabilities. [The dated acceptance record](technical-acceptance.md) names Node/npm/Chromium, source/build identity and artifacts. Remote CI has not run in this local-only task.

The [preserved review records](review-records/README.md) contain authors' actual checks, original findings and scoped independent approvals. Task 1's [search approval](review-records/task-1-fix-review.md), Task 2's [reload approval](review-records/task-2-fix-review.md), and Task 4's [composition approval](review-records/task-4-fix-review.md) close the Wave 2 findings.

## Editor and output behavior

The [7 October drag and spacing refinement](../2026-10-07-drag-design/README.md) restores picture, group and desktop-library dragging in the responsive editor, with phone handles and complete tap/keyboard alternatives. It also closes observed desktop/mobile spacing issues. Its dated verification supersedes the earlier drag deferral for the current app; the original overhaul acceptance counts and decisions below remain historical.

The [7 October print refinement](../2026-10-07-print-layout/README.md) places quantity/warning/time beside the picture so short details keep compact rows, and makes the existing paper padding explicit in the preview. Its new verification record is separate from the dated overhaul results above.

The [7 October header/theme refinement](../2026-10-07-header-theme/README.md) replaces the large successful-save banner with inline status, moves file controls into Settings, and adds persisted light/dark interface themes. The document canvas and physical output retain their own colors; there is no More button. Its acceptance record is separate from the dated overhaul checks.

Creators can add/find pictures near the selected group, edit full labels, move with tap/keyboard controls, Undo/Redo, and return from semantic Read to the selected group. Phone sheets and desktop panels keep controls at usable sizes independent of picture count. More details adds required structured warnings/quantities/times and optional text; choice boards keep unordered intent. Settings expose independent EN/DE controls/default labels and library choice.

Independent review caught and corrected stale attachment fields after history changes, desktop Escape affecting a panel behind Settings, and empty-group focus return. Real browser checks also caught the output settings CSS override and a desktop-to-phone resize opening two sheets. Output captures one source/options/locale; edits require Refresh, guide switches close it, and late promises cannot download the wrong guide. Preview, vector SVG/PDF and 150/300dpi PNG share one physical plan. Current-source JSON backup remains complete even when physical text is blocked.

## Storage and recovery

Documents use schema 2 with explicit `sequence` or `board` presentation. Legacy v1 imports default to sequence, retaining stable IDs, authored text, arbitrary units, attachments and unknown supported data. Opening another guide clears document history and clipboard state so Undo cannot bring another guide's content into the current one. JSON imports and examples create another guide rather than replace existing work.

Each local guide has its own versioned IndexedDB envelope and revision. Save transactions compare both revision and the previously loaded raw record. This prevents same-revision edits in another tab from being overwritten. Concurrent first migration creates one guide atomically and retains the unchanged legacy source. Unreadable records are copied exactly before fallback or isolation; a failed recovery copy blocks replacement. Deletion leaves a revisioned tombstone, and Undo uses the committed tombstone revision. Preferences are stored separately and do not rewrite guides.

The independent review found an additional reload race: a background/direct flush could write after the repository loaded another writer's baseline but before the editor adopted its document. The correction blocks every new write during reload, lets only an already-started transaction finish, and cancels adoption if the local draft changed. A cancelled reload retains the draft and conflict until a successful explicit reload. The original failing probe and four native boundary cases now pass, and the original reviewer approved the correction.

Saving on a debounce or page-hide event remains best effort under abrupt browser/process termination. Internal navigation waits for committed writes. Local storage is specific to this browser/device; JSON backup is the portable copy. [Recovery instructions](../../../persistence-recovery.md) explain records, recovery keys and conflict actions.

## Graphics and printed text

The catalog contains 140 original canonical meanings, retaining the 84 historical Kitchen IDs and adding Daily routines/workplace, Learning/classroom and shared meanings. Libraries refer to the same canonical entries and artwork. Unknown imported symbols remain visible as a neutral question picture with a named semantic fallback; warnings preserve their role and meaning separately. [Contact sheets and provenance](../../../content-libraries.md) cover every offered picture. Digital inspection verifies intended geometry, not universal comprehension.

The bundled Source Sans 3 Regular 3.052 face is licensed under OFL 1.1; its source, hash and license are recorded in [print fonts](../../../print-fonts.md). The same normalized glyph run supplies measurements and vector paths. An actual embedded-text experiment failed standalone renderer portability, so exported text uses outlines. SVG/PDF pictograms and text retain vector geometry; outlined PDF text is not searchable or selectable. Semantic reading content and plan text remain available in the app. Unsupported visible glyphs produce a preflight failure; unsupported optional notes do not block an output mode that omits those notes. English/German and the documented Latin coverage are supported; Japanese and right-to-left shaping are not advertised print support.

One finite physical plan drives preview and every output format. It uses millimeters, measured line wrapping, fixed minimum picture/text sizes, required warnings/quantities/times in every content mode, explicit overflow issues and repeated continuation context. Choice boards have no step numbers, connectors or summed alternative times. The 85-picture stress case is exported on both A4 and A3; the attachment-heavy A3 proof has six pages with 25mm pictures and independently matched vector/raster content. Labels/cards fail with actionable guidance if required content cannot fit. PNG is limited to 150/300 dpi and 24 million pixels per page before allocation; larger output remains available through vector formats.

## Remaining release work

The reviewed editor/output integration and fresh cold/update offline gates are complete locally. Remaining release work is practical acceptance, owner licensing and any fixes those observations require. Dragging is an optional convenience deferred behind complete tap/keyboard ordering. Accounts, cloud sync, uploaded pictures, translation, fractional quantities and speech generation are outside this release.

The project did not provide an established distribution license for its original artwork. [Artwork license status](../../../artwork/LICENSE-STATUS.md) records factual original provenance without inventing a grant. The owner must choose the distribution license before release.

## Taking over the next stage

Use the [technical acceptance record](technical-acceptance.md) to identify the tested local code and reproduce its checks before making further changes. The [print sample set](print-samples/README.md) supplies ten PDFs / fourteen actual-size pages and matching SVGs, independently reopened and inspected digitally. Their editable JSON is available for adapting the procedure; A6 produces one card per group. Physical and participant results remain pending.

| Next work | Owner | Completion evidence |
| --- | --- | --- |
| Familiar workplace and supported teaching creation tasks | Product owner with creators and their customary support | Record independent/assisted add, find, label, move, Undo, Read, save and download; fix observed control/flow blockers and repeat |
| Pictogram meaning and warning comprehension | Product/design owner with recipients | Compare intended and interpreted meaning; trace ambiguity to canonical IDs, revise affected vectors and repeat at the intended size |
| Label-to-large-print readability | Design owner and someone with a printer | Measure 50 x 30 mm/A6/A4/A3 output at 100%; record viewing distance and grayscale, then adjust shared sizes only with affected output tests |
| Real mobile and screen-reader behavior | QA owner with iOS/Android and VoiceOver/NVDA | Exercise software keyboards, rotation, downloads, local saving, offline installation and focus/reading; fix actual failures and repeat |
| Artwork distribution license | Project owner | Choose and record an explicit grant before public release |
| Optional drag convenience | Later editor agent, after primary-flow observations | Use the existing final-index actions with cancellation, marker and edge-scroll coverage; keep tap/keyboard moves complete |

The [creator/recipient scripts](creator-and-recipient-tasks.md) and [results template](practical-acceptance-template.md) give the next agents and human testers concrete tasks. Treat missed required warnings, lost content and unusable controls as blockers. Use observed assistance and ambiguity to choose the next design revisions; a larger untested feature set is outside this release plan.

Keep additional features behind the practical trials. Track first-load and raster/export resource use on the actual mobile devices; the recorded main bundle is 438.88kB / 123.56kB gzip, with converters loaded lazily. Automated viewport and download checks do not establish actual device performance.

[Recorded implementation rulings](rulings.md) preserve the 21 workflow/interface decisions and each cost if wrong; the [dispatch ledger](review-records/dispatch-ledger.md) preserves dated task/review boundaries.

## Later editor revisions

The [7 October print-faithful editor handoff](../2026-10-07-print-faithful-editor/README.md) supersedes this report's responsive-card and deferred-drag descriptions. The editor now shares fixed physical pages with output, defaults to selectable A4 portrait, uses handleless dragging and compact direct editing, and keeps Add picture at the group header. Its fresh verification/evidence record includes desktop/mobile geometry, actual downloads and production offline updates. Counts and print samples above remain historical records of the earlier implementation.
