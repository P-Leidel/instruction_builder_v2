# Compact editing forms — Task 2 evidence

The four assigned form files expose picture name, quantity, days/hours/minutes/seconds and warning immediately. Group editing exposes name and time. Optional note/description, accessible reorder/move/delete and clipboard actions live in native Actions disclosures. Desktop remains an aside overlay; mobile remains a native dialog at the unchanged 767/768 boundary. A target-scoped attachment draft context preserves pending quantity/time strings across that wrapper transition. Committed attachment fields, rather than cloned object identity, reconcile history changes.

Product files: `TokenDetails.tsx`, `AttachmentFields.tsx`, `StepDetails.tsx`, `AuthoringPanel.tsx` under `src/components/`. No schema, production CSS, i18n, dependency or Git changes were made by this task. Shared canonical translation keys and `armPictureMove` were supplied by the integration owner.

## Reproduction and results

Use the project's supported Node runtime from the repository root:

```powershell
node docs/phase-3/audits/2026-10-07-print-faithful-editor/forms/forms-check.mjs before
node docs/phase-3/audits/2026-10-07-print-faithful-editor/forms/forms-check.mjs after --isolated
```

The first command was run before product edits and failed `en_quantity_immediately_visible`, with zero console/page errors. Its result and actual App screenshot survive in `before/`. The final command passed **73/73** assertions on Node **24.19.0**, Chromium, with zero console/page errors; see `after/results.json`.

The final isolated harness mounts the actual production AuthoringPanel, fields, session/controller, preferences, translations and CSS. Its surrounding buttons only supply explicit targets and surviving focus controls. It owns a temporary Vite server and fresh Playwright contexts, closes both on success/failure, and disables HMR watching. This avoids the concurrently rewritten physical editor. These screenshots establish the forms, not finished App/canvas integration or visual parity with the earlier App screenshot. Integration checks belong to Task 3/4.

Covered in EN light and DE dark, desktop 1440 and phone 390: immediately visible core fields; closed native Actions; unknown authored warning meaning; exact unchanged-save retention of imported labels/icon IDs/metadata; custom units; unrelated-render and desktop-to-phone draft preservation; keyboard disclosure activation and modal Tab wrap; quiet copy with the existing fresh-ID clipboard contract; invalid fractional/negative/blank/over-limit duration; exact 99-day maximum and maximum plus one; zero duration; structured normalization after an actual change; quantity validation/removal/Undo/Redo; group primary fields, quiet description and accessible move; picture move preserving data; armed Move closing the modal; removed target closing and returning focus to a surviving control.

Opening/unchanged saving never rewrites inherited custom labels. Duration parts accept nonnegative integer component carry, matching the existing builder, but reject an invalid aggregate before the builder's historical clamp. Valid changed totals use the existing structured duration builder.

The new disclosure exposed a real keyboard failure: Chromium retained positive layout boxes for hidden closed-details descendants, so the prior width-only Tab filter included hidden Actions controls. `before/disclosure-tab-red.json` records that failure. AuthoringPanel now includes summary and explicitly excludes descendants of closed disclosures; the final keyboard checks pass. Two initial checker locators were corrected to address selects with option text in their label; clipboard comparison was corrected to respect the existing fresh-ID contract. A later full-App attempt encountered peer EditorGroup HMR during its rewrite; no peer source was changed.

Focused ESLint passed for all four assigned TSX files plus `forms-check.mjs`. Scoped `git diff --check` passed (only normal LF/CRLF notices). No full suite, build/offline gate, device, screen-reader, participant or physical-print acceptance is claimed here.

## Representative screenshots

- `before/en-desktop-picture.png`: original App, quantity hidden behind More details.
- `after/en-desktop-picture.png`, `after/de-desktop-picture.png`: compact fields in the production desktop overlay.
- `after/en-mobile-picture.png`, `after/de-mobile-picture.png`: native mobile containment and readable time/warning fields.
- `after/en-mobile-group-actions.png`, `after/de-mobile-group-actions.png`: preserved description/movement under Actions.

The phone screenshots are captured after keyboard traversal scrolls the form to its bottom. Primary name fields remain above in the same scrollable native dialog. Full integrated canvas geometry and the complete width/theme matrix are checked by the integration owner.
