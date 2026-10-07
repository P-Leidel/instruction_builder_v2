# App review and takeover recommendations

Reviewed on 6 October 2026. The existing recipe builder has a working editing/export foundation. Its biggest gap is mobile authoring: the page fits the screen, but the canvas becomes hard to read and users travel between distant controls. The user's subsequent direction prioritizes practical pictogram instructions across several libraries, scalable print formats, and simple authoring usable by children with appropriate support. The [overhaul brief](../../superpowers/specs/2026-10-06-ux-design-overhaul.md) supersedes this audit's initial recipe-only scope.

This review covers source, project documentation, desktop/mobile browser flows, production offline behavior, and downloaded output. Findings below record the observed baseline. Minor fixes are listed separately; the [maintenance follow-up](../progress/2026-10-06-reliability-maintenance.md) records additional fixes and current verification. Larger UX/graphics/output changes are folded into the overhaul plan.

## Current state and strengths

The app supports step/token editing, times, integer quantities, warnings, drag-and-drop, keyboard step management, copy/paste, undo/redo, JSON import/export, SVG/PNG/PDF output, IndexedDB autosave, and offline startup. Phase 3 remains at five of seven tasks: user testing is in progress and the larger UX refinement task remains open. Vector PDF shipped early. Several selectable libraries are now proposed next-release work; themes remain lower priority.

Preserve Preact/signals, immutable document sessions, shared layout/hit-testing geometry, and the common SVG export source. They provide useful boundaries for finishing without an engine rewrite. Desktop cards, selection outlines, icon strokes, form labels, category arrow navigation, and cancel-first dialogs are consistent. Existing undo/redo and persistence-error feedback are valuable safeguards.

| Area | Assessment |
| --- | --- |
| Desktop editing | Functional; first-use guidance and action hierarchy need refinement. |
| Phone editing | Major usability work remains despite passing page-overflow checks. |
| Graphics | Consistent style; tiny text and substitute ingredient icons weaken comprehension. |
| Accessibility | Good partial keyboard paths; Preview content and token movement remain incomplete. |
| Output | Ordinary exports work; completeness, languages, and large-step limits remain. |
| Reliability | Ordinary single-tab flow works; stale-tab writes and optional imports need hardening. |

## Coverage and evidence

The baseline passed 217 unit tests, lint, and production build. After minor fixes, 227 unit tests pass. The existing browser driver again reported every boolean check true, zero console errors, and zero axe violations in its five tested states. Production PWA checks confirmed manifest/icons, shell caching, and offline reload. Final commands are recorded in the [progress note](../progress/2026-10-06-takeover-review.md).

Additional probes covered 320, 390, 768, 800, 1024, and 1440px; quantity popovers, warning state, Tab navigation, Preview's accessibility tree, and canvas measurements with two versus twelve tokens. Touch-event phone emulation added exactly one token and selected it. Two-tab overwrite and first PDF export offline were reproduced. Downloaded PDF boundary samples were rendered with Poppler and inspected.

These checks use Chromium and viewport/touch emulation. Real iOS Safari, Android, screen-reader operation, installation/update UX, and physical printing still need acceptance testing. An axe pass does not establish complete accessibility: Preview's missing content demonstrates that distinction.

Reproducible scripts are in [.claude/skills/run-instruction-builder](../../../.claude/skills/run-instruction-builder): existing `driver.mjs`/`pwa-check.mjs`, plus `review-check.mjs`/`export-review.mjs` added for this audit. The targeted review script fails on its fixed-defect regressions; the export script captures evidence.

## UX and mobile findings

### P1 Mobile canvas scale collapses as content grows

At 390px, two tokens render icons at about 15.4px and labels at 5.8px. Twelve tokens grow the viewBox from 748 to 1412 design units while the SVG stays 480px wide: icons fall to 8.2px, labels to 3.1px, and an 18-unit remove target to about 6.1px. A long step shrinks every step because width is document-wide. This is more severe than the older small-label issue.

Phone layout uses one token row while CSS scales its growing viewBox into a fixed width. Preserve readable control/token sizes through deliberate wrapping or scrolling at a stable scale. Keep interaction targets outside content-dependent zoom where practical. Preview needs a useful phone reading mode too.

Sources: [canvas-layout.ts](../../../src/lib/canvas-layout.ts), [global.css](../../../src/styles/global.css). Evidence: [390px editor](2026-10-06-assets/mobile-editor.png).

### P1 Preview omits instruction content for screen readers

A populated Preview exposes the document heading and a group named “1 instruction step, read-only preview.” It omits the step title and all token labels. Read-only rendering hides meaningful text with `aria-hidden`, then removes editing buttons that otherwise provide partial labels.

Provide ordered readable instructions with step titles, labels, times, quantities, and warnings. Semantic HTML beside or instead of the diagram is a practical option; decide whether it should be a visible reader mode. Validate information and reading order with a screen reader.

Sources: [StepCard.tsx](../../../src/components/InstructionCanvas/StepCard.tsx), [TokenChip.tsx](../../../src/components/InstructionCanvas/TokenChip.tsx).

### P1 Token movement requires dragging

Keyboard users can select, edit, copy, paste, remove tokens, and reorder steps, but cannot reorder tokens or move them between steps. Add explicit position/destination controls with focus handling. These also give phone users an alternative to precision dragging.

Source: [StepDetails.tsx](../../../src/components/StepDetails/StepDetails.tsx); already tracked in [known issues](../../known-issues.md).

### P2 Phone authoring controls are far apart

The toolbar takes several rows. Step/Token details precede the canvas; Add to step follows the whole document. In the populated 390px probe the canvas starts around 1160px down the page. Token selection inserts a large editor above the canvas without navigating to it. Longer documents increase the distance between insertion and reviewing the result.

Make the document the main phone surface, with nearby insertion and contextual editing. Compare a bottom sheet with an inline inspector before committing. Group export choices into one accessible action and prioritize building/reviewing. Keep the same document engine.

Source: [app.tsx](../../../src/app.tsx). Evidence: [desktop](2026-10-06-assets/desktop-editor.png), [phone](2026-10-06-assets/mobile-editor.png).

### P2 Drag feedback and first use need finishing

No edge auto-scroll exists during dragging; step reordering has no landing marker; moving a selected token between steps clears selection. The two-stage step-then-token selection rule is easy to miss, and the blank canvas gives little guidance.

Add a contextual first-use hint or optional example recipe, show the selected step near Add to step, retain sensible selection after moves, and finish drag feedback after non-drag alternatives. Add icon search to reduce category scanning.

Sources: [TokenPicker.tsx](../../../src/components/TokenPicker/TokenPicker.tsx), [document.ts](../../../src/state/document.ts), [known issues](../../known-issues.md).

## Graphics and output findings

### P1 Output omits authored instruction text

Descriptions and token notes survive JSON, but never appear in the visual canvas, SVG, PNG, or PDF. The product plan promises detailed instructions with text. Decide whether these fields are editing metadata or reader-facing instructions. Recommended scope includes a detailed output mode so users can deliver the information they authored.

Sources: [instruction.ts](../../../src/model/instruction.ts), [StepCard.tsx](../../../src/components/InstructionCanvas/StepCard.tsx), [project-plan.md](../../project-plan.md).

### P2 Formats differ from Preview

SVG/PNG serialize only the SVG. The title and total time live in its sibling HTML heading and disappear; PDF recreates them. PNG also has a transparent background, potentially surprising for a standalone shared recipe.

Define one output contract covering heading/time, visual/detailed modes, incomplete markers, and background. Prefer white for standalone sharing, with transparency an explicit option if needed. Preview should reflect the selected output faithfully.

Sources: [InstructionCanvas.tsx](../../../src/components/InstructionCanvas/InstructionCanvas.tsx), [svg-export.ts](../../../src/lib/svg-export.ts), [pdf-export.ts](../../../src/lib/pdf-export.ts).

### P2 Typography is small and unconstrained

Current A4 scaling produces roughly 6.1pt token labels and 5.5pt quantity/time text. An allowed eighteen-character `W` label measures about 154 design units inside a 96-unit chip and visibly overflows. Character caps do not bound text width.

Set independent screen/print legibility targets. Use wrapping or deliberate truncation with access to the full label, adequate chip height, and measured step-title layout. Test German words, wide letters, durations plus titles, and imported strings.

Sources: [TokenChip.tsx](../../../src/components/InstructionCanvas/TokenChip.tsx), [global.css](../../../src/styles/global.css).

### P2 PDF needs language and oversized-step policies

The downloaded “Crème brûlée — Gemüse 日本語” sample renders Japanese as incorrect Latin-looking glyphs. Standard PDF fonts lack embedded coverage. An 85-token single step also exceeds the page and loses final rows; pagination admits oversized steps without fitting or splitting them.

Choose supported languages and embed an appropriately licensed font. Prefer continuation pages over shrinking below readable size. Verify actual rendered content, not just PDF signatures/page counts.

Sources: [pdf-export.ts](../../../src/lib/pdf-export.ts), [pdf-pagination.ts](../../../src/lib/pdf-pagination.ts). Evidence: [Unicode](2026-10-06-assets/pdf-unicode.png), [oversized step](2026-10-06-assets/pdf-oversized-step.png).

### P2 Ingredient symbols need literal artwork

Nineteen ingredient mappings reuse a generic utensil symbol; onion uses a carrot. Labels carry most of the meaning, undermining the pictogram purpose and compounding the small-label problem.

Keep the SVG/stroke language, replace frequent substitutes with recognizable ingredient artwork, record licenses, and test comprehension. Subtle category accents may help; warnings need an additional non-color cue. Themes and decoration are lower priority than accurate readable symbols.

Source: [icon-library.ts](../../../src/data/icon-library.ts).

## Baseline reliability findings

| Priority | Finding | Evidence and next action |
| --- | --- | --- |
| P1 | Two tabs silently overwrite work. | Reproduced: A saves a title; stale B edits a step; reloading A restores “Untitled instructions.” Choose conflict detection or a single-editor policy. |
| P1 | Browser coverage is not a release gate. | Existing browser/PWA scripts print failures without a failing exit code; CI runs neither. Add assertions, documented commands, and CI coverage. |
| P2 | Optional imports remain shallowly validated. | A source probe accepts two `time.seconds: "60"` values and calculates 6060 seconds. Validate consumed fields, finite ranges, and supported text lengths, retaining legacy repair. |
| P2 | First PDF export offline fails. | Fresh production shell goes offline; Export PDF shows a raw dynamic-module fetch error. Cache needed chunks or communicate offline preparation/readiness. |
| P2 | Saving and recovery need clearer behavior. | Accepted ~200ms final-edit loss window remains. Provide actual saved status, JSON backup guidance, and recovery before replacing an unreadable record. |
| P2 | Dependencies need a maintenance pass. | Network-enabled locked-install audit reports 9 affected entries: 1 low, 3 moderate, 3 high, 2 critical. Most concern tooling; DOMPurify is runtime-transitive. Separate reachability from severity and verify upgrades. |

Sources: [persistence.ts](../../../src/state/persistence.ts), [migrate.ts](../../../src/model/migrate.ts), [duration.ts](../../../src/lib/duration.ts), [CI](../../../.github/workflows/ci.yml), [service worker](../../../public/sw.js), [lockfile](../../../package-lock.json). These baseline failures led to the [maintenance follow-up](../progress/2026-10-06-reliability-maintenance.md): import, conflict/recovery, browser gates, offline assets, and dependency fixes. The nine-entry dependency count describes the pre-maintenance snapshot.

## Minor fixes implemented

| Fix | Verification |
| --- | --- |
| Reject duplicate step IDs and document-wide duplicate token IDs. Removing a colliding ID could previously delete multiple tokens. | Four migration tests; three demonstrated failures before the fix. |
| Clamp wide popovers to both viewport gutters. Quantity previously started at x≈−158px on a 390px phone. | Three demonstrated failing tests; final x=8px at 320/390px and containment at all six widths. |
| Wrap PDF headings and reserve their actual pagination height. | Two demonstrated failing tests using real jsPDF metrics; fifty-`W` download visually inspected. |
| Reject an imported title whose wrapped PDF heading cannot fit on a page, with a shortening instruction. | Demonstrated failing test for 3000 `W` characters; stored title remains unchanged. |
| Remove the hidden import field from Tab order. | Import → Tab reaches Preview at all six widths. |
| Expose warning selection with `aria-pressed`. | Select/remove state verified at all six widths. |
| Connect quantity errors through unique ID, `aria-invalid`, and `aria-describedby`. | Invalid amount's description verified at all six widths. |
| Use viewport-neutral empty-step guidance. | Source and responsive layout review. |
| Darken accent buttons on hover to preserve contrast. | Calculated hover white-text contrast remains above 4.5:1. |

See the [progress note](../progress/2026-10-06-takeover-review.md) for commands and change details.

## Finishing direction and decisions

Keep one document engine and retain recipes as a library. The revised direction prioritizes short practical workplace reminders and teaching/routine instructions, scalable vector output from labels to posters, several selectable libraries, and a predictable editor. Validate symbol comprehension and supported child authoring with actual creators and recipients.

The [design brief](../../superpowers/specs/2026-10-06-ux-design-overhaul.md) and [delivery plan](../../superpowers/plans/2026-10-06-app-finishing.md) integrate remaining mobile, accessibility, artwork, multilingual text, and output defects. Proposed library inventories and physical sizes need prototype/user evidence; the overhaul itself has not been implemented.
