# Final clean-install verification — 6 October 2026

These are newly run local gates, not the earlier maintenance or package checks. [Machine record](verification-results.json) records exact checkpoints, runtime, exits, counts and the [16-asset production manifest](offline-assets.json). Production was built at `c577134`; `8eb60c6` changes four checker imports and preserves a review, with no production/dependency change. Later handoff commits only preserve documentation/evidence.

Node **24.19.0**, npm **11.17.0**, Chromium **153.0.8010.12**, Windows. Required clean install, lint, typecheck, **461 unit tests / 35 files**, **7 tooling tests**, build, Chromium install, full and production audits all exited **0**; both audits report **0 vulnerabilities**. Chromium was already installed, so its installer emitted no output. Remote GitHub CI was not run; its source was independently reviewed.

| Final command | Preserved result |
| --- | --- |
| `npm ci` | [Install output](npm-ci.log); 247 packages added, zero vulnerabilities, root exec session completed exit 0 |
| `npm run lint` | [Log](lint.log), [exit/timestamps](lint-result.json) |
| `npm run typecheck` | [Log](typecheck.log), [exit/timestamps](typecheck-result.json) |
| `npm test` | [Log](unit.log), [exit/timestamps](unit-result.json) |
| `npm run test:tooling` | [Log](tooling.log), [exit/timestamps](tooling-result.json), including deliberate false/missing expectation rejection |
| `npm run build` | [Log](build.log), [exit/timestamps](build-result.json) |
| `npx playwright install chromium` | [Exit/timestamps](chromium-install-result.json), no emitted output |
| `npm audit` / `npm audit --omit=dev` | [Full](audit-full.log) / [production](audit-production.log), dated exit records beside logs |
| `npm run test:browser -- docs/phase-3/audits/2026-10-06-overhaul/final-verification/browser` | [Log](browser.log), [exit/timestamps](browser-result.json), machine results/screenshots/actual files under `browser/` |
| `npm run test:pwa -- docs/phase-3/audits/2026-10-06-overhaul/final-verification/pwa` | [Log](pwa.log), [exit/timestamps](pwa-result.json), cold files and synthetic/actual update evidence under `pwa/` |

Supplemental [explicit checker lint command](checker-lint-command.txt) covers all nine active hidden browser drivers, the runner and sample generator. It exposed omitted Node imports in four inherited drivers: [RED log](explicit-checker-lint-red.log)/[exit 1](explicit-checker-lint-red-result.json). Import-only correction passed the identical command: [exit 0](explicit-checker-lint-result.json); the named GREEN log is empty because there were no diagnostics. PowerShell Tee-Object initially retained stale prior content when nothing was emitted; this evidence-only mismatch was independently found, corrected and closed without another broad test run. No lint rule or failure assertion was weakened.

The browser run passed **29 + 22 + 51 + 53 + 26 + 55 = 236** named checks, plus the native storage/recovery safety gate. Its six machine check records contain only true values and empty errors. It includes actual SVG/PNG/PDF/JSON downloads, 85 ordered pictures across complete continuation pages, responsive/200% text layout, focus and history, selected semantic/physical parity, blocked glyph/overflow with full JSON, both PNG densities and raster refusal. Output audit records **21 files**.

Cold PWA: **45 checks / four separately fresh installed contexts**, zero page font/converter/output warmup before going offline. PDF/PNG/SVG/JSON work on first offline use. The retained synthetic Vary/lazy/font/waiting fixture passes. [Actual production old/new update](pwa/actual-app/actual-app-update-results.json) records **512 ms** waiting, unchanged old controller and both caches, old converter URL 404 on the updated server, first old PDF/font/converters offline, old cache removed only after the final old client closes, then first new PDF offline; other-product cache survives. Errors/failures are empty. Actual PDFs and offline screenshots are beside the record.

These files establish local technical results. Separate independent rendering/font proof and actual-size sample inspection remain linked from [technical acceptance](../technical-acceptance.md). Participants, printer calibration/readability/grayscale, real iOS/Android keyboards/downloads and VoiceOver/NVDA remain **Pending**. [The handoff](../implementation-report.md) names next owners and completion evidence.
