# Responsive authoring and recipient reading

**Owner:** Editor agent, also the sole application integrator. **Dependencies:** Contracts 00, catalog/localization 01, and guide controller 02. **Deliverable:** One predictable authoring flow on phones and desktops, with complete recipient reading and persisted sequence/board intent.

## Owned files

Create `src/components/MyGuides/MyGuides.tsx`, `src/components/InstructionEditor/InstructionEditor.tsx`, `EditorGroup.tsx`, `EditorPicture.tsx`, `src/components/AuthoringPanel/AuthoringPanel.tsx`, `src/components/InstructionReader/InstructionReader.tsx`, `src/lib/instruction-reading.ts`/tests, `src/state/authoring.ts`/tests, and component-local styles. Own `src/app.tsx`, `src/main.tsx`, `src/state/ui.ts`, `src/styles/global.css`, and replacement/wiring of TokenPicker, TokenDetails, StepDetails, and Toolbar. Other workers provide modules/components but send application integration changes to this owner.

Consume the explicit `documentSession`, catalog/preferences, guide controller, and foundation actions. Do not read/write IndexedDB or create another document session in a component. Output dialogs consume a snapshot and return to the editor; output files belong to package 05.

## My guides and starting

My guides shows title, Sequence / Choice board, last updated, and named Open/Duplicate/Delete actions. “Create guide” offers two presentation choices and blank/example start. Keep the primary creation path obvious in an empty list. Existing guides remain present when creating an example or importing JSON. Failed storage creates an exportable in-memory draft with a persistent status message rather than implying durable storage.

An untitled sequence starts with one empty step; a board starts with one empty group. Document title is editable, with a localized display fallback for an empty title; do not translate stored existing titles automatically. Open awaits package 02's flush and handles its explicit result. Confirm deletion of the named guide; restore is available after success. New/import confirmation wording must reflect adding a guide, not replacing all local work.

## Basic authoring flow

1. The main region begins with the title and visible step/group content. Save status, Undo/Redo, My guides, Read, and Print / Download remain discoverable.
2. Each step/group has **Add picture**, a short optional title, and a deliberate group-actions menu. The selected group has a clear outline without changing its dimensions.
3. Add picture opens a searchable grid with library/category controls and the target group's name visible. One activation inserts one picture into the captured `stepId`, even if ambient selection changes. A deleted target produces a message and closes/reselects; it never inserts into another group.
4. Return focus to the new picture and reveal it in view. Retain useful library/search choices for the next insertion. A direct picture activation selects it and opens its label controls in one action.
5. Basic details show the label and named Move earlier / Move later / Move to group, Duplicate, and Remove actions. **More details** reveals note, quantity, time, and warning without dropping hidden data.
6. Add step/group appends an empty group and puts its title/Add picture in view. Removing content is one undoable edit; removing a populated group shows its name/content count before the edit.

Use simple words (“picture”, “step”, “group”) in product text; TypeScript token/session terminology stays out of the UI. Every icon-only control has an accessible name and visible explanation where its meaning is unfamiliar. No two-click selection prerequisite and no nested interactive controls.

Keep language preferences in a deliberate Settings/My guides preferences surface, with compact truthful save status. At the initial 320 px editor viewport, prioritize the guide title and first group rather than a long settings block. Edit a group's optional title in its group-actions/details panel instead of repeating an always-visible input below the heading. Picture tiles retain comparable local sizes when a group has one, two or twenty pictures; sparse desktop groups do not stretch one picture across the page. Review notices have their own wrapping block and do not overlap Add picture.

## Responsive presentation and panels

At widths below **768 CSS px**, use a single instruction column and one contextual modal sheet. At wider widths, keep the same instruction flow with an adjacent nonmodal authoring panel. The sheet/panel contains either picker or details, never both. Modal sheets make the rest of the page inert, contain focus, support Escape/Close, and return focus to a surviving opener. Desktop panels do not trap focus or mark the page inert.

A desktop panel may stay mounted behind Settings, import or output so its unsaved fields survive closing the modal. Only the top modal handles Escape; background panel shortcuts ignore consumed events and an open modal. On mobile, close the contextual sheet before opening output. Committed attachment changes through Undo/Redo, removal or reload update field values; unrelated renders preserve unsaved drafts. Returning from Read restores the selected picture or selected empty group's control before using a global fallback.

Use dynamic viewport height and scrollable panel content so a software keyboard never hides the focused field or Close. Do not require swiping to dismiss. At 320 px, horizontally long text and picture grids wrap. At 200% text zoom, controls remain usable and document text is preserved. Use reduced-motion preferences; repositioning must not animate essential controls away from the pointer.

All ordinary editor text is at least **16 CSS px**, all controls at least **44 × 44 CSS px**. Picture chips use a readable local size and wrap within their group. Never derive their size from the longest step or physical print scale. Keep one accent and neutral background surfaces; selected, focus, warning, and disabled states have distinct meaning.

Remove the existing 18-character token-label restriction. Permit complete authored/imported strings in labels, titles, descriptions, and notes; wrapping/output preflight determine physical fit. Do not truncate or rewrite an imported long value when entering/leaving a field. Quantity editing retains the current whole-number bounds, uses library suggestions plus a custom unit, and preserves unfamiliar imported units.

## Ordering and board behavior

Use `moveTokenTo` with the final index after removal. Within-group earlier/later moves change the final index by -1/+1; boundary actions are disabled. Move to group offers named groups and an end-of-group default. Reordering maintains IDs, attachments, focus, and selection; each committed move makes one history entry. Duplicate uses a fresh token ID; Copy/Paste retain the existing deep-copy contract.

Keyboard/tap moves are the primary path. Drag is a later shortcut within this package: its marker and committed destination use the same `{ stepId, finalIndex }`, with visible landing feedback, edge autoscroll, cancellation, and scroll-versus-drag separation. Implement it only after the non-drag path passes. Do not remove existing interaction tests until equivalent cases exist.

Sequences display numbered steps and restrained directional cues. Boards display named groups and picture grids without arrows, numbered steps, or language implying “then”. Board DOM/source order remains stable for reading/navigation; it does not claim the user must perform choices in that order. A presentation switch is one undoable document edit and never removes content.

## Reading projection and semantic view

`src/lib/instruction-reading.ts` exports `toReadingGroups(doc: InstructionDocument, mode: OutputMode, locale: AppLocale): readonly ReadingGroup[]`. Define its owned `ReadingGroup`/`ReadingPicture` types in that module: source IDs, optional title/description, ordered pictures, accessible meaning, visually selected label/note, quantity/warning/time, and resolved known/unknown artwork. Consume foundation's `projectOutputContent` from 00 so optional-text decisions cannot diverge from composition.

Recipient view offers the three output content modes and Back to editing. Sequences use an ordered group list; boards use headings and unordered lists/grids. Reading a picture exposes its authored label, otherwise the localized catalog meaning, otherwise a named unknown-picture fallback. Pictures-only hides labels visually while retaining accessible names. Included notes/descriptions, structured quantity/time, and warning meaning appear in the same semantic order as visible content.

Warning attachments use `getWarningMeaning` and retain warning context visibly and semantically in every mode. An unknown warning with authored text keeps that meaning; one without text says Unknown warning with its stored ID. A neutral fallback tile must not make a warning appear to be an ordinary object or hide it from reading.

Use shared projected duration semantics: sequences prefer explicit group time over token sum; boards show only explicitly authored group time and never sum alternatives. Token-specific times remain associated with their pictures. Boards omit a summed guide duration. Return to editing restores the previous picture/group focus and selection. A recipient view contains no remove buttons or hidden authoring controls.

Use the shared display-only `getQuantityDisplayLabel` / `getDurationDisplayLabel` helpers for valid imports with blank attachment labels. Preserve nonblank authored labels verbatim and derive missing display text from structured values without changing the guide.

Export pure presentational `ReadingContent` from `InstructionReader.tsx` with `{ groups: readonly ReadingGroup[]; presentation: InstructionDocument["meta"]["presentation"]; locale: AppLocale }`. It renders recipient content without controls or live session/preferences. Read and output preview wrap the same content; preview supplies the selected projection from its captured document.

## Status and recovery

Render truthful controller states: Saved on this device, pending/saving, unavailable, and conflict. Expose the local-device limitation in My guides/backup help. Conflict offers export of local content, reload of saved work, and keep editing without pretending autosave continues. Loading and font/export preparation use readable progress rather than a success toast.

The explicit Reload saved work action invokes `reloadActiveGuide` after naming its discard consequence and offering JSON backup. Do not call ordinary `openGuide` or manually reset conflict flags to force a reload.

Locale changes translate controls and catalog defaults only. Unknown artwork has a visible tile/name and review notice in editor and reader. Validation accepts nonempty object-only groups; empty groups receive gentle guidance, avoiding immediate error badges on a fresh document.

## Acceptance cases

Automated browser coverage must create a five-group guide at **320, 390, 768, and 1440 px**, including one 20-picture group. Assert stable short-group dimensions, 44 px controls, 16 px text, local Add picture, and no page-level horizontal overflow. Inspect 200% text zoom separately.

Cover keyboard-only add/search/select/edit/move/undo/redo/read/return; captured picker destination; deleted opener/target; panel Escape/focus behavior; empty and no-results states; imported 18-wide-letter and much longer text; custom quantity units; mixed libraries; and board semantics. Opening a sheet or changing category/library/locale must not change history or save revision.

Assert one main-picture accessible item per token, correct chosen optional fields, warning/quantity/time order, full names in Pictures-only, and no procedural numbering/connectors in boards. Exercise guide switching, creation/import as new, duplicate, delete/restore, and unavailable/conflicting storage UI against real repository behavior.

Run focused reading/state tests and all lint/type/unit/browser gates. Human checks cover software keyboards/rotation, actual screen readers, and supported child authoring; package 06 records those results. Do not turn pending human checks into inferred passes.

## Integration handoff

Keep `app.tsx` a composition root; focused components own their own interaction state. Remove obsolete SVG authoring/hidden export canvas only after replacement coverage and package 05 format parity pass. Update old browser expectations for the reviewed product behavior, retaining reliability assertions. Record exact changed workflows so the release owner can reproduce them.
