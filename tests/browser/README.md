# Browser verification

Maintained Playwright drivers and shared fixtures live here. `scripts/` owns
the gate runner, result assertions, tooling tests and production offline asset
generation. The project skill keeps usage instructions; dated audit scripts
and evidence remain under `docs/phase-3/audits/`.

Run the complete gates from the repository:

```bash
npm run test:browser
npm run build
npm run test:pwa
```

The runner starts and closes its Vite server, runs each driver sequentially,
and stops at the first nonzero exit. It explicitly selects the repository
root and child working directory. Both gates accept an output directory
after `--`; defaults are ignored `artifacts/browser` and `artifacts/pwa`.
New standalone evidence also defaults to ignored `artifacts/`, while an
explicit relative output directory resolves against the caller's directory.
Standalone checks that own a Vite server resolve its root from their file.

| Driver | Arguments after the filename | Server |
| --- | --- | --- |
| `driver.mjs`, `review-check.mjs` | `[output-directory] [url]` | Existing dev server; URL defaults to `http://localhost:5173/` |
| `responsive-editor-check.mjs` | `[output-directory] [url]` | Own dev server when URL is omitted |
| `editor-transition-check.mjs` | `[output-directory] [url-or-dash] [case] [evidence-tag]` | Own dev server when URL is omitted or `-`; cases remain `all`, `attachments`, `modal`, `focus` |
| `editor-output-integration-check.mjs`, `export-review.mjs` | `[output-directory] [url-or-dash]` | Own dev server when URL is omitted or `-` |
| `reliability-check.mjs` | `[url]` | Existing dev server; URL defaults to `http://localhost:5173/` |
| `storage-check.mjs`, `preferences-merge-check.mjs` | `[url]` | Own dev server when URL is omitted; native IndexedDB contracts in isolated contexts |
| `check-header-theme.mjs`, `check-editor-drag.mjs`, `check-review-regressions.mjs`, `check-print-faithful-editor.mjs` | `[output-directory] [url]` | Own dev server when URL is omitted |
| `check-centered-pictograms.mjs` | `[output-directory] [url] [--baseline]` | Own dev server when URL is omitted; `--baseline` keeps the existing baseline comparison mode |
| `pwa-check.mjs` | `[url] [output-directory]` | Existing production preview; URL defaults to `http://127.0.0.1:4173/` |
| `pwa-update-check.mjs` | `[output-directory]` | Own HTTP fixtures and two real production builds |

For example, a focused check can own its server:

```bash
node tests/browser/check-header-theme.mjs
node tests/browser/editor-transition-check.mjs artifacts/transitions - focus
```

The browser gate covers authoring/history/downloads, semantic reading,
responsive layout and accessibility, attachment/modal/focus transitions,
output integration, export artifacts, native persistence and conflicts, declared-key/prefix reads and atomic insert recovery,
theme/header layout, review regressions, mouse/touch drag behavior,
print-faithful editor geometry and centered pictograms. The PWA gate covers
four separately cold offline exports and old/new waiting-worker activation,
including first-use fonts and converters. Each driver closes its own fresh
browser contexts; the runner owns the shared server. ESLint checks these
`.mjs` files with Node globals during `npm run lint`.
