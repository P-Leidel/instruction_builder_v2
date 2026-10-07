# Visual Instruction Builder: UX and design overhaul

**Date:** 6 October 2026. **Status:** Design direction; the [agent specification package](2026-10-06-overhaul/README.md) now defines the confirmed release scope, exact contracts, and module acceptance. The [agent implementation plan](../plans/2026-10-06-agent-implementation.md) defines execution order. Implementation of the overhaul has not started. Independent reliability maintenance is [implemented and verified](../../phase-3/progress/2026-10-06-reliability-maintenance.md). This direction supersedes the recipe-only finishing recommendation in the [takeover audit](../../phase-3/audits/2026-10-06-takeover-review.md).

## Product purpose and audience

The product helps people make short visual instructions that another person can understand and use. The primary application is practical reminders for kitchens and other physical jobs with repetitive tasks, including situations where workers and creators do not share a language. The same building blocks have reported value for teachers, parents, nonverbal children, and people with cognitive disabilities. Children should also be able to help create instructions.

The user's priorities are practical creation, pictograms that scale from small labels to large prints, several selectable content libraries, and an intuitive editor. Child usability and symbol comprehension are goals to test with the intended participants; the current evidence does not establish them. Pictograms can reduce dependence on text, but their meaning still needs testing in context.

Treat two experiences separately:

| Person | Main task | Design consequence |
| --- | --- | --- |
| Creator: worker, teacher, parent, or child with appropriate support | Choose symbols, arrange a short sequence, add necessary information, and print it | A direct tap/click path, predictable controls, recoverable actions, and immediate print preview |
| Recipient: worker or learner | Recognize what to do and in which order | Clear symbols, consistent reading order, sufficient physical size, and little distracting decoration |

The user confirmed **Kitchen**, **Daily routines/workplace**, and **Learning/classroom**, English/German controls and default labels, one original vector pictogram system, picture-only routines and choice boards, and several saved guides in a local **My guides** list. Kitchen retains the recipe vocabulary's stored identifiers. The package supplies minimum inventories to refine through comprehension testing.

## Recommended approach and alternatives

Evolve the existing document engine into a simple responsive authoring surface and a shared print composition system. Keep Preact/signals, immutable document/history actions, inline vector artwork, and local offline persistence. Use semantic HTML for authoring and reading; keep SVG for pictograms and composed output. Screen controls and printed geometry serve different purposes and should each have an explicit layout contract.

Continuing to scale one large editable SVG would preserve more UI code but retain the causes of tiny phone controls and inaccessible reading. A freeform graphic-design canvas would offer flexibility but make alignment, sequencing, and child authoring harder. Structured steps with controlled print presets best match the practical instruction task.

## Creation flow

1. Open My guides and create a Sequence or Choice board, blank or from an example, then choose a library. Examples and JSON imports add a guide by default and preserve existing saved work.
2. The main screen shows the sequence's steps or board's unnumbered picture groups. A visible **Add picture** action belongs to the current group; there is no prerequisite two-stage selection rule. Choice boards have no procedural arrows or summed alternative durations.
3. Choose a symbol from a labelled grid, category, or search. One activation adds one symbol and returns attention to the edited step. Keep the current step's name/number visible while choosing.
4. Tap/click a placed symbol to edit its optional label. A clearly labelled **More details** action reveals note, quantity, time, and warning fields when needed. Existing data remains intact when details are hidden.
5. Use **Move earlier**, **Move later**, and **Move to step** for ordering. Dragging is an additional shortcut, with the same committed destination as its visible insertion marker.
6. Use **Read** for the recipient view, then **Print / Download** to choose physical format and preview the actual output. Keep JSON backup/import available under document actions.

On phones, keep the instruction above the fold, with Add picture beside the current step. Open the picture picker and details in one contextual panel at a time, below the selected item or in a bottom sheet. The proposed default is a bottom sheet because it keeps the sequence visible; validate it with the software keyboard and supported users before retaining it. Close/Escape restores focus to the opener. The panel must not obscure its focused field or require precision gestures to dismiss.

On larger screens, show the same sequence with a nearby palette or inspector. Avoid maintaining a separate desktop workflow. Basic creation keeps the same names and steps at every width. Save status, Undo, Read, and Print / Download stay discoverable; advanced settings stay behind deliberate actions. No separate child account or parallel document model is proposed.

## Screen accessibility and visual system

- Use ordered HTML steps for sequences, unnumbered picture groups for boards, and named native controls. A read-only guide exposes group title, symbol label/meaning, quantity, time, warning, and included description/note in source order.
- Keep authoring controls at least **44 × 44 CSS px**. Ordinary authoring text is at least **16 CSS px**; avoid scaling text or controls down as a document grows. At 320 CSS px, a 20-symbol step wraps within its own section and does not shrink another step.
- Preserve document order, visible focus, selection after moves, Undo/Redo, keyboard operation, and 200% text zoom. Navigation, library filters, panel opening, and preview settings do not add document-history entries.
- Use a quiet neutral surface, one clear accent, and a consistent selected outline. Normal text targets at least **4.5:1** contrast; large text and meaningful controls target at least **3:1**. Warning shape and wording convey meaning independently of color.
- Establish a shared pictogram drawing system: consistent viewBox, optical size, stroke weight, and distinguishable silhouettes. Replace misleading substitutions, including onion-as-carrot and generic utensils for unrelated ingredients. Test familiar action/object pairs before expanding inventory.
- Keep labels optional visually, with readable names available to assistive technology. Symbol-only output is a deliberate choice; the recipient test must check its comprehension separately from labelled output.

These are proposed design acceptance values, not a claim that the existing app meets an accessibility standard or that automated checks establish usability.

## Libraries and language

Each bundled library supplies an ID, display name, categories, searchable entries, supported default-label locales, and artwork/license attribution. Shared verbs and warnings can appear in multiple libraries without duplicating stored meaning. Search includes the selected locale's names and explicit aliases; a no-results state offers category browsing.

Switching a palette changes the choices available for future insertion. It does **not** clear the instruction, rewrite existing labels, or remove symbols from another library. Mixed-library instructions remain valid. Every placed symbol resolves independently of the active palette. Existing icon IDs continue to resolve; namespace new library-specific IDs to avoid collisions. Unknown imported IDs show a labelled fallback and a review notice rather than disappearing.

Keep document content separate from catalog text. On insertion, a catalog label becomes editable authored text. Locale changes affect future default labels and never rewrite placed labels. Free text accepts user-authored languages. English/German application chrome and defaults are required. Bulk relabeling, automatic translation, remote marketplaces, and user-uploaded artwork remain outside scope.

All initial libraries and their artwork are bundled and work offline. License review must allow the intended distribution of exported prints/files, and attribution information must travel with the library's maintainer record.

## Print composition and scalable graphics

Physical dimensions are the source of truth for output. Preserve pictograms as inline vector paths in SVG and vector PDF; increasing print size must not enlarge a pre-rendered bitmap. PNG is an explicit raster alternative generated at the requested physical size and density.

Proposed presets for the first release:

| Preset | Physical size | Composition |
| --- | --- | --- |
| Label | 50 × 30 mm | One selected instruction step per label, with all its action/object/warning content; export individual labels or an A4 label sheet |
| Instruction card | A6, 105 × 148 mm | One selected step per card; repeated step number and clear sequence context |
| Instruction sheet | A4, 210 × 297 mm | Ordered multi-step guide, paginated at readable size |
| Large print | A3, 297 × 420 mm | Ordered guide with larger symbols/type, paginated when needed |

Provide portrait/landscape orientation and custom width/height from **20 to 1000 mm**. Label-sheet margins, gaps, and rows/columns are explicit settings; the first release does not promise compatibility with a printer-specific label stock. Preview shows real dimensions and printable bounds. A creator prints at 100% actual size; screen zoom is a viewing aid and never changes exported dimensions.

The default labelled formats target at least **10 pt** labels and **9 pt** secondary annotations. A6/A4 pictograms target at least **15 mm** in their shorter dimension; A3 starts at **25 mm**. These are starting design values for physical tests, not proven universal readability thresholds. A compact label may omit optional text through the selected mode, but must not silently omit a symbol, warning, quantity, time, or selected step. If content cannot fit at the preset's minimum sizes, block that format with a specific explanation and offer a larger size or smaller step. Do not silently shrink the whole document.

The output dialog provides **Pictures + labels**, **Pictures only**, and **Detailed** modes. Detailed includes step descriptions and symbol notes; the other modes explicitly state that they omit this optional text. Warnings and structured quantities/times remain in every mode. Metadata visibility (document title, step titles/numbers, total time) is explicit in the preview; label/card titles use their own space rather than disappearing accidentally.

A single output plan drives Preview, SVG, PNG, and PDF. Every format includes the same chosen content, background, measurements, and order. Default background is white; transparent SVG/PNG is an explicit option. Multi-page SVG/PNG output offers numbered pages for individual download with the full page count visible; PDF includes the complete selected guide. JSON preserves the full editable document independently of output mode or page selection.

PNG offers **150 and 300 dpi**. Preflight physical dimensions before allocating a raster canvas, with a proposed ceiling of **24 million pixels per page**. Larger requests offer vector PDF/SVG or a lower density instead of attempting an unbounded allocation on a phone. This preserves the large-print goal through vector output.

Oversized A4/A3 steps continue across pages at token-row boundaries, repeating step number/title with **continued** context. They never lose rows or shrink below the minimum. Labels/cards require the step to fit one region and report overflow rather than splitting the label's instruction unpredictably. Text wraps using actual font metrics; character-count limits alone are insufficient.

Font coverage is a release requirement for English/German and Latin accents. Prove one licensed offline font through actual SVG/PNG/PDF output. The Japanese audit fixture must receive clear unsupported-glyph preflight until its script is deliberately supported; all editable text is preserved. Additional scripts/right-to-left shaping need rendered acceptance before advertising support. Font/export assets retain first-use export after the installed build is ready offline.

## Technical boundaries

| Boundary | Responsibility | Existing foundation |
| --- | --- | --- |
| Document session | Authored content, stable IDs, edits, selection, history | `src/model/instruction.ts`, `src/state/document.ts` |
| Library catalog | Resolve artwork and defaults; filtering/search/attribution | `src/data/icon-library.ts`, `src/data/sample-tokens.ts` |
| Authoring presentation | Responsive HTML controls and contextual panel state | `src/app.tsx`, components, `src/state/ui.ts` |
| Instruction reader | Semantic recipient content and order | Replacement for inaccessible read-only canvas semantics |
| Output composition | Physical-size settings, measured text, ordered fragments, pagination | `src/lib/canvas-layout.ts`, `src/lib/pdf-pagination.ts` |
| Output rendering/export | Render the same plan to vector pages and rasterize explicitly | Existing SVG/PNG/PDF modules |
| Reliability | Safe import/save/recovery, offline assets, verification | Existing migration/persistence/SW and current maintenance |

Keep one active document session and one artwork resolver. The recipe domain remains legacy metadata; active palette is UI state. Schema v2 stores sequence/board presentation and migrates v1 to sequence. Local guide envelopes hold identity/revision separately from portable document JSON. Switching guides flushes pending work and starts independent history. Output options remain UI state. Do not build a second document engine or renderer for each library.

## Validation and release evidence

Use the same tasks with creators and recipients so editing success cannot hide confusing output:

- A kitchen/workplace creator makes a three-step repeated task, adds a warning, and prints a label and an A4 guide. A recipient explains/does the intended sequence with the support customary in that setting. Compare labelled and symbol-only comprehension, including warning interpretation.
- A teacher/parent and child create a three-step familiar routine. Record what the child can find, add, move, undo, and read, and exactly what support was required. Use appropriate consent and existing support arrangements; report observed usability without generalizing beyond participants.
- A phone/keyboard creator makes five steps, including a 20-symbol step, changes libraries, edits a long label, moves a symbol, and exports. The result retains every selected symbol and authored field under the chosen mode.
- Inspect actual 50 × 30 mm labels, A6 cards, A4 sheets, and A3 prints at their intended viewing distances. Check grayscale, long German labels, accents/Japanese, 85-symbol continuation, print scaling, and information completeness.
- Verify real iOS Safari/Android Chrome, keyboard and supported screen-reader operation, offline cold export, updates, save conflicts/recovery, and JSON round trips. Record device/browser/version and artifacts. Chromium emulation supplements these checks.

Release requires no silent data loss or clipped/corrupt output in the supported fixtures, completion of the core creator task without precision dragging, and recorded comprehension/usability results for both primary contexts. Set quantitative participant targets after the first research round establishes realistic baselines; do not invent a success rate from the current audit.

## Sequence and scope

1. Preserve the verified maintenance that survives the redesign: import validation, stale-tab/recovery protection, dependency maintenance, browser/production gates, offline export assets, and the oversized-PDF safeguard.
2. Prototype the simple creation flow and physical formats together using two short real instructions. Validate symbol meaning and child-supported interaction before committing to the screen design.
3. Deliver the library registry and shared print composition, then connect the responsive editor, recipient view, and export dialog through their common contracts.
4. Run target-user and physical/device acceptance, correct observed blockers, and update live milestones with evidence.

Accounts, cloud collaboration, gamification, arbitrary freeform placement, theme marketplaces, automatic translation, and a wholesale engine rewrite are outside this release. Fractional quantities can follow a separate model decision if kitchen testing requires them; preserve the current integer contract until then. The [agent implementation plan](../plans/2026-10-06-agent-implementation.md) breaks the confirmed scope into reviewable deliveries.
