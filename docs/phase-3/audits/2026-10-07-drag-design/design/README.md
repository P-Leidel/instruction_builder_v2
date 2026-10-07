# Bounded editor and output-dialog spacing sweep

The CSS owner changed only `src/components/InstructionEditor/editor.css` and `src/components/OutputDialog/output-dialog.css`. Root owns drag behavior, markup, localization and integration checks. This is browser layout evidence, not participant, device, print or release acceptance.

The probe uses the existing browser helper with fresh, nonpersistent Playwright contexts and a temporary Vite server on an ephemeral port. It seeds a copy of the saved workplace prototype plus four pictures, including a banana with quantity, warning and duration. It does not connect to the user's browser profile, guide storage or running development server. All contexts, the browser and the temporary server are closed by the probe.

## Observed issues and changes

- At 320 and 390 px, editor pictures used one column and left unused horizontal space. The editor grid now uses a 7.5 rem minimum with flexible columns; all eight phone language/theme cases use two columns at the normal text size. The recipient reader grid retains its existing layout.
- Picker and details sections inherited a second padded frame inside their panel or modal. Scoped rules remove that redundant frame, allowing two picker columns at 320 px, and provide consistent heading, action and panel-header gaps.
- Settings language labels compounded their margins with the parent grid gap. A scoped rule removes those label margins. The controls and navigation remain unchanged.
- Group headings accommodate a separate 44 px drag handle. Picture handles reserve space at the bottom of the picture button. Source opacity, absolute insertion markers, an empty-group outline and a light-colored fixed ghost communicate the current drag without changing grid geometry. Normal picture buttons retain touch scrolling; only handles disable touch scrolling.
- Output-dialog changes are limited to header sizing and control/body/fieldset spacing. Preview paper, checkerboard, bounds, physical composition and exports are unchanged.

## Narrow verification

Run from the repository root with the bundled Node 24 runtime or another supported Node runtime:

```powershell
node docs/phase-3/audits/2026-10-07-drag-design/design/design-check.mjs after
node docs/phase-3/audits/2026-10-07-drag-design/design/design-check.mjs compare
node docs/phase-3/audits/2026-10-07-drag-design/design/handle-geometry-check.mjs after
```

The design probe covers 320, 390, 768 and 1440 px; English/German; light/dark; editor, picker, expanded details, Settings and output: 80 cases per run. It checks page and surface overflow, visible control dimensions of at least 44 px, console/page errors and the phone grid property. Intentionally hidden file inputs are excluded from visible-control measurements. Screenshots cover representative combinations; every case retains its measurements.

The clean baseline in [before/results.json](before/results.json) exited 1 solely for the reproduced phone-grid property: 0/8 cases had two columns. The final spacing sweep in [after/results.json](after/results.json) exited 0: 80 cases, 8/8 phone-grid cases, no overflow or undersized visible controls, and zero console/page errors. The separate `compare` mode asserts the baseline/final invariants: all 16 output SVG hashes are identical and all 80 sampled document/picture/reading color sets are identical; [comparison.json](comparison.json) records the passing comparison. A sweep overlapping transient peer component/localization writes was discarded and replaced with the clean baseline; it is not claimed as a passing run.

After that sweep, an additional imported-data case reproduced a handle below an unknown-picture button: [handle-before/results.json](handle-before/results.json), exit 1. Root added a picture-tile wrapper with notices outside it; the CSS owner added only `position: relative` to that wrapper. The unchanged probe then passed six cases at 320/1440 px for known pictures, unknown pictures and unknown warnings: [handle-after/results.json](handle-after/results.json), exit 0 and zero console/page errors. It checks that the 44 × 44 px handle stays inside the picture button without overlapping picture content and verifies the distinct handle/picture touch-scroll policy. This scoped correction followed the 80-case sweep; root owns the final integrated gates.

Only 40 representative screenshots remain: five surfaces for `390-en-light`, `1440-en-light`, `320-de-dark` and `768-de-dark`, before and after. Useful comparisons:

- [Phone editor before](before/390-en-light-editor.png) / [after](after/390-en-light-editor.png)
- [Narrow German picker before](before/320-de-dark-picker.png) / [after](after/320-de-dark-picker.png)
- [Desktop details before](before/1440-en-light-details.png) / [after](after/1440-en-light-details.png)
- [Narrow German Settings before](before/320-de-dark-settings.png) / [after](after/320-de-dark-settings.png)
- [Tablet details before](before/768-de-dark-details.png) / [after](after/768-de-dark-details.png)
- [Desktop output before](before/1440-en-light-output.png) / [after](after/1440-en-light-output.png)

These probes can catch a reintroduced single-column phone grid, overflowing dialog controls, reduced hit areas, theme leakage into document surfaces or changed physical SVG content, and handles overlapping imported-data review notices. They do not validate drag/controller behavior; root's functional drag checks cover that delivery.
