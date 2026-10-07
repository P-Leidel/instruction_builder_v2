# Takeover review and minor fixes

Date: 6 October 2026. Phase 3 remains in progress; this pass audits the
project, fixes verified small issues, and proposes the remaining work.

The [review](../audits/2026-10-06-takeover-review.md) covers UX, graphics,
mobile, accessibility, output, saving, and maintenance. The
[finishing plan](../../superpowers/plans/2026-10-06-app-finishing.md)
defines proposed work packages and acceptance criteria. README, milestones,
and known issues link to these current documents.

## Changes

- `src/model/migrate.ts`: reject duplicate step IDs and duplicate token
  IDs anywhere in a document before legacy quantity repair. Three new
  rejection tests failed on the original behavior; a fourth preserves
  valid distinct IDs.
- `src/lib/field-placement.ts` and `FieldPopover.tsx`: preserve edge/vertical
  alignment and apply a horizontal correction when a flipped panel still
  clips the viewport. Three new geometry cases failed before the fix.
- `src/lib/pdf-export.ts`: wrap headings with actual jsPDF metrics and use
  their height in pagination/content placement. Two regression cases
  failed before the fix. A third rejects an imported title whose heading
  is taller than usable A4 space, without downloading or changing the data.
- `src/app.tsx`: the hidden import input no longer takes keyboard focus.
- `StepDetails.tsx`: empty-step guidance names Add to step without a
  desktop-only direction.
- `TokenDetails.tsx`: warning presets expose selected state via ARIA.
- `QuantityForm.tsx`: invalid amount is linked to its unique error text.
- `global.css`: accent button hover darkens instead of lowering contrast
  by brightening.
- New audit tools: `review-check.mjs` collects responsive/accessible content
  evidence and fails on the repaired-defect checks; `export-review.mjs`
  downloads/renderable boundary samples. Both use fresh browser contexts.

## Verification

- `npm test`: 227 tests across 15 files pass (baseline 217).
- `npm run lint`, `npm run typecheck`, and `npm run build`: pass.
- Existing `driver.mjs`: every boolean check true; zero console errors;
  axe violations zero for editor, import dialog, phone, and both tablet
  orientations. The driver itself still needs a reliable failure exit
  policy before being used as a CI gate.
- `review-check.mjs`: pass at 320, 390, 768, 800, 1024, and 1440px.
  Quantity popover left edge is now 8px at both phone sizes; warning state,
  amount error association, and Import-to-Preview Tab navigation pass.
- Production `pwa-check.mjs`: manifest/icons reachable, shell cached,
  offline reload works, zero failed requests.
- Downloaded PDF inspection: the permitted fifty-`W` title wraps and clears
  the first step. Samples also confirm unresolved non-Latin text rendering
  and oversized-step clipping, documented in the review.
- Touch-event phone emulation: one tap adds one token; a canvas tap selects
  it. Physical mobile browser testing remains part of the finishing plan.
- Independent change review: no common-path blockers; its imported-title
  boundary finding led to the additional PDF guard.

Representative screenshots and the measured JSON are in
[audit assets](../audits/2026-10-06-assets). Export/download samples and
complete browser artifacts were written to this chat's visualization
directory rather than adding generated downloads to the repository.

## Reproduce

Start `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`, then:

```powershell
node .claude/skills/run-instruction-builder/driver.mjs <artifact-directory> http://127.0.0.1:5173/
node .claude/skills/run-instruction-builder/review-check.mjs <artifact-directory> http://127.0.0.1:5173/
node .claude/skills/run-instruction-builder/export-review.mjs <artifact-directory> http://127.0.0.1:5173/
```

For PWA checks, build first, start `npm run preview -- --host 127.0.0.1
--port 4173 --strictPort`, then run:

```powershell
node .claude/skills/run-instruction-builder/pwa-check.mjs http://127.0.0.1:4173/
```

The following are baseline reproductions, resolved by the later
[maintenance follow-up](./2026-10-06-reliability-maintenance.md).
Use a fresh context and no previous PDF export to reproduce the offline
PDF issue; after shell caching, disconnect and click Export PDF. For the
stale-tab issue, open two tabs, save a title in A, edit a step in stale B,
then reload A. The current asserted browser/PWA commands verify the
corrected behavior; the original observations above remain audit history.
