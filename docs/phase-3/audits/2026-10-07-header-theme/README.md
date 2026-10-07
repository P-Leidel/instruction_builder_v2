# Compact header and interface themes — 7 October 2026

The user requested a simpler top menu, removal of the large successful-save bar, and light/dark choices in Settings. They explicitly required **no More button**, file controls under Settings, and **no theme changes to the document canvas**. This bounded change follows local checkpoint `281b05e`.

## Result

The header keeps My guides, named Undo/Redo icons, Read, Print / Download and a named Settings icon. Phone widths show a shorter Print label with the same accessible name. Every action retains a 44 px minimum target. A small inline Saved status replaces the successful-save banner; unavailable/conflict notices still expose backup, reload and keep-editing actions.

Settings contains the light/dark selector, existing independent language controls, JSON import and editable backup. Themes change surrounding controls, panels and backgrounds. Editor groups, picture tiles and reading content keep fixed light document colors. Physical preview paper, checkerboard, bounds and SVG/PNG/PDF composition retain their own colors. Actual SVG files exported in light and dark mode are byte-identical for the same authored guide and options.

Theme defaults to light and persists with existing local preferences. A valid older v1 preference record without a theme loads without a recovery copy or initial overwrite. Invalid stored values still receive exact diagnostic preservation. Startup applies the stored theme before App renders; changes apply immediately without altering authored content, history or guide selection.

## Fresh verification

| Check | Result |
| --- | --- |
| `npm test` | 487 tests / 37 files pass |
| `npm run test:tooling` | 7 tests pass |
| `npm run lint`, explicit lint of modified hidden helpers | Exit 0 |
| `npm run typecheck`, `npm run build` | Exit 0; 16 offline assets |
| `npm run test:browser` | Exit 0; 236 existing named checks + 35 interface checks, plus actual storage/recovery checks |
| `npm run test:pwa` | Exit 0; 45 cold checks / four formats, plus synthetic and actual waiting-update proofs |

The [canonical interface record](browser/header-theme/results.json) contains 35 strict-true results and no console/page errors. It covers 320/390/768/1440 px in both themes, compact status, history controls, modal focus, persisted theme/guide, unchanged document/tile colors, identical actual SVG exports, Settings import preserving the earlier guide, and EN/DE controls. [Desktop dark](browser/header-theme/desktop-dark.png), [mobile dark](browser/header-theme/mobile-dark.png), [desktop light](browser/header-theme/desktop-light.png) and [mobile light](browser/header-theme/mobile-light.png) are complete captured screenshots. Root inspected desktop/mobile dark and the representative Settings layout.

The [independent scoped review](review.md) approved specification compliance and change quality with no blocking findings. It separately parsed the final records and compared the actual light/dark SVG downloads.

The [initial RED](red/results.json) shows file actions still exposed before implementation. Preferences also had observed RED for the missing theme behavior before the agent's correction. `proof/` preserves the earlier 33-case run and intermediate selector diagnostics; `browser/header-theme/` is the final acceptance record.

The [original transition failure](browser/editor-transition-old-text-assertion.json) retains an obsolete literal `textContent` check: the Print button now has a hidden short-label span. The updated checker waits for its unchanged full accessible name and still verifies actual opener-node focus. No focus behavior was weakened. The helper reaches backup through Settings; the existing import-focus check uses the surviving Settings opener. Actual file-chooser import is exercised separately by the new interface proof.

All browser profiles are isolated fixtures; the user's stored guides and theme preference were not modified. These are desktop Chromium and emulated viewport checks, not new real-device, participant or assistive-tool acceptance. Practical release checks in the [overhaul handoff](../2026-10-06-overhaul/implementation-report.md) remain pending. Earlier dated overhaul and print evidence is retained.

## Reproduce

Run `npm test`, `npm run test:tooling`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:browser -- <fresh-output-directory>` and `npm run test:pwa -- <fresh-output-directory>`. Use the configured bundled Node runtime when the host PATH has an older Node. The browser commands require permission to start their local Vite/Chromium child processes. The interface check is included in `test:browser`; it can also run alone as `node tests/browser/check-header-theme.mjs <fresh-output-directory>`.
