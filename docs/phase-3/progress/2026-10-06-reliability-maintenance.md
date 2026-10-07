# Reliability maintenance and overhaul handoff

6 October 2026. Follow-up to the [takeover review](./2026-10-06-takeover-review.md).
The user requested design-independent fixes now and a coherent UX/design
overhaul plan for the remaining work.

## Product direction

Prioritize practical visual instructions for kitchens and repetitive
physical jobs, including language barriers. Teachers, parents, nonverbal
children, and people with cognitive disabilities also benefit from clear
sequences. Make creation simple enough to test with children and their
customary support. Print scale is central: small labels, instruction cards,
ordinary guides, and larger displays must retain understandable symbols.

The [design brief](../../superpowers/specs/2026-10-06-ux-design-overhaul.md)
and [delivery plan](../../superpowers/plans/2026-10-06-app-finishing.md)
replace the earlier recipe-only finishing scope. Several selectable
libraries are proposed for the next release; existing recipes remain
compatible. The overhaul itself has not been implemented.

## Implemented independently of the design

| Change | Result |
| --- | --- |
| Validate optional import fields | Reject malformed labels, descriptions, notes, attachments, metadata, quantities, durations, and schema versions before replacing a document. String seconds can no longer turn 60 + 60 into 6060. Preserve legacy label-only quantity repair and unknown fields. |
| Protect autosave across tabs | Compare the loaded raw record and current disk value in one IndexedDB transaction. A stale tab stops saving, keeps its local work, and shows a persistent JSON-export/reload instruction. Same-tab writes are serialized. |
| Preserve unreadable saves | Commit an exact raw recovery copy under a unique key before allowing fallback saves. Failed backup disables saving and retains the original. See [recovery instructions](../../persistence-recovery.md). |
| Prevent clipped PDFs | Refuse an oversized whole-step PDF with a clear instruction to split that step. Existing title wrapping/height checks remain. Proper continuation is overhaul work. |
| Prepare offline exports | Build a manifest of all production assets, including lazy PDF dependencies. Install completes caching before control. Public build assets match despite host `Vary: Origin` headers; incompatible browser cache flags are normalized for network attempts. |
| Preserve open tabs during updates | New workers wait while previous tabs remain open. Prior export chunks remain available until old clients close; activation removes only this product's superseded caches. |
| Make browser checks enforceable | Existing driver assertions now fail the process. npm commands own ephemeral servers and close them; CI installs Chromium and runs editing, responsive, persistence, offline, and update checks. Failure screenshots are uploaded. |
| Maintain dependencies | Vite 8.3.3, Vitest 5.0.3, compatible Preact preset/TypeScript ESLint, and repaired transitives. Full and production audits report zero advisories. Use Node 24; prior browser transpilation targets are explicit. |

No new runtime dependency, document schema migration, backend, or account
was introduced. Changes remain in the working tree for takeover/review.

## Verification

- A clean `npm ci` succeeds from the maintained lockfile.
- `npm test`: **323 tests in 16 files pass**. Added import and persistence
  regressions were demonstrated failing before their fixes.
- `npm run test:tooling`: **7 tests pass**, covering failed browser results,
  lazy asset inclusion/build versioning, offline routing, and bounded
  cache-variant handling.
- `npm run lint`, `npm run typecheck`, and `npm run build`: pass. Build
  prepares **14 offline assets**.
- `npm run test:browser`: **74 editing/export/accessibility expectations**
  pass, responsive regressions pass at 320/390/768/800/1024/1440px, and real
  IndexedDB tests verify raw baseline preservation, stale-tab local JSON
  export, exact distinct recovery copies, and fallback preservation.
- `npm run test:pwa`: fresh current build reloads offline and exports
  **PDF, PNG, SVG, and JSON without any prior online export**. Downloads
  have valid signatures/JSON; every manifest asset is cached before control.
- The actual-worker update fixture uses changed hashed files, crossorigin
  requests, and `Vary: Origin`. Old-tab first-use lazy output works offline;
  new activation preserves unrelated caches and supports new-build offline
  output. A forced-activation variant fails as expected; the temporary
  variant was removed.
- A deliberately false browser assertion produces process exit **1**;
  the final restored driver passes. The oversized-step regression also
  failed before the PDF safeguard and passes afterward.
- `npm audit --json` and `npm audit --omit=dev --json`: **zero advisories**
  on 6 October 2026. This is a dated registry snapshot.
- Independent review found and corrected the open-tab update problem;
  no remaining actionable reliability regression was identified.

The GitHub workflow has been updated; it has not been run remotely in
this task. Evidence above is local Windows/Chromium execution. Real Safari,
Firefox, mobile devices, deployed-host updates, screen readers, target-user
comprehension, and physical prints remain acceptance work.

## Remaining work folded into the overhaul

The editor still shrinks long phone instructions, separates selection from
its controls, and lacks non-drag token movement. Preview still omits
instruction content from its accessibility tree. Symbols include misleading
substitutions, and printed labels are too small. Notes/descriptions and
heading/background choices need one explicit output contract. Non-Latin
PDF glyphs still need licensed fonts, coverage/shaping checks, and rendered
fixtures. Continuation pages replace the temporary oversized-step refusal.

The plan addresses these together through a semantic editor/reader, a
searchable library catalog, and measured physical composition shared by
Preview/SVG/PNG/PDF. Proposed library inventories, physical presets, and
panel choices need prototype evidence before implementation. Actual
saved/readiness feedback and the final-edit debounce window remain visible
in that plan. Recovery copies are local browser storage, not an external
backup; export important work to JSON.

## Reproduce and take over

Use the [README](../../../README.md) commands with Node 24. Browser scripts
start/stop their own servers, use fresh contexts, and fail on broken
expectations. `npm run test:pwa` requires `npm run build` first. Browser
screenshots/measurements go to ignored `artifacts/browser`, or an explicit
directory supplied after `npm run test:browser --`.

Build output remains static `dist`; Vercel uses `npm ci`, `npm run build`,
and Node 24. Include the generated `offline-assets.json` and rewritten
worker in deployments. New workers normally wait for old tabs to close;
do not force activation or manually delete their old caches while open
tabs depend on them. If rolling back, deploy the complete prior build;
keep any historic lazy assets needed by still-open clients available when
possible. Do not roll storage back by overwriting a user's current record.

Begin the overhaul with two three-step prototypes: one workplace reminder
and one familiar teaching/routine instruction. Test creation and recipient
understanding together, using actual-size label and A4 output, then
finalize the library inventory and editor/print contracts.
