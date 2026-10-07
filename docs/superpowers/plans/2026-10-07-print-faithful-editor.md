# Print-faithful editor implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace responsive editor cards with stable physical pages and direct, compact authoring.

**Architecture:** The existing physical planner owns fixed layout and editable hit regions. The editor renders its SVG with transparent HTML controls; one per-guide print-options store feeds both editor and captured output. Compact editing overlays never consume canvas layout space.

**Tech Stack:** TypeScript, Preact/signals, existing measured print font, PointerEvents, Vitest and Playwright. No new product dependency.

**Spec:** `docs/superpowers/specs/2026-10-07-print-faithful-editor.md`

## Global constraints

- A4 portrait default with selectable formats; all existing authored guide data retained.
- Fixed physical cells/rows; no responsive stretch or metadata-driven row growth.
- No dot handles; complete touch-scroll, keyboard move and drag alternatives.
- No clipping/shrinking/loss of required printed content; blocked output remains repairable.
- Chrome themes never affect document colors; EN/DE and native focus containment retained.
- Reuse the existing managed worktree and dependencies; no push/merge/deployment.

## Review focus

- Overflow/unsupported imported data stays selectable and never becomes a partial export.
- Continued groups and label-sheet segments resolve movement by stable identities, not local DOM indices.
- Panel and viewport changes preserve physical cell positions and user zoom.
- Per-guide print choices, added groups and source Refresh remain coherent across canvas and downloads.
- Touch move mode is armed before a gesture, and every cancel/guide-switch path clears it without consuming a later intentional click.

## Task 1: Fixed planner and editing geometry

Files: `src/model/output.ts`, `src/lib/output-options.ts`, `src/lib/output-plan.ts`, corresponding planner tests.

- [x] Write failing real-font tests for stable widths/row positions, fixed lanes and repairable failure geometry.
- [x] Add fixed metrics and page/group/picture hit-region types; compose into fixed lanes while retaining export bounds/required meaning.
- [x] Cover continuation identity, empty targets, presets/orientations, label sheets and exact data preservation.
- [x] Run focused planner tests and review the physical contract.

## Task 2: Compact group/picture editing

Files: `src/components/TokenDetails/TokenDetails.tsx`, `AttachmentFields.tsx`, `src/components/StepDetails/StepDetails.tsx`, `src/components/AuthoringPanel/AuthoringPanel.tsx`.

- [x] Capture the existing seconds-only/button-wall behavior in focused UI evidence.
- [x] Expose name/quantity/readable time/warning directly; relocate optional text and move/delete controls to Actions.
- [x] Make the desktop panel an overlay and preserve native mobile modal/draft/focus behavior.
- [x] Verify draft/history reconciliation, invalid attachments, imported meaning, keyboard actions and disappearance of removed targets.

## Task 3: Canvas, settings and drag integration

Files: editor components/styles; new print-settings seam; App/output controller/dialog; `src/state/editor-drag.ts`; EN/DE messages.

- [x] Write failing browser checks for paper/overlay alignment, panel invariance, header Add picture and editor/download equality.
- [x] Render physical SVG pages and transparent identity-bearing controls; preserve blocked-layout repair access.
- [x] Connect shared print choices; reconcile selections/new groups without changing authored schema.
- [x] Remove dot controls; implement stable source-index mapping and armed touch moves, retaining cancellation/Undo/Redo.
- [x] Update acceptance helpers only for intentionally changed UX; retain their meaningful data/focus/output assertions.

## Task 4: Integrated review and handoff

- [x] Independently review the finished source, fix reproduced findings and rerun affected checks.
- [x] Run appropriate unit/tooling/lint/type/build, browser and offline gates.
- [x] Inspect desktop/mobile/EN/DE/light/dark screenshots and actual physical output.
- [x] Preserve concise evidence/report and commit verified local work; leave the user's development server running.
