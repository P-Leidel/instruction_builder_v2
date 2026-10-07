# Architecture Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Execute independent file scopes in parallel; root reviews, verifies, commits and pushes each change separately.

**Goal:** Address the health report's three architecture findings without changing current product behavior.

**Architecture:** Retire unreachable paths, preserve synchronous atomic storage policy with declared reads, and consolidate maintained browser verification. Each task is independently reviewable and releasable.

**Tech Stack:** TypeScript, Preact/signals, IndexedDB/idb-keyval, Vitest, Playwright, Node, Vite.

**Spec:** `docs/superpowers/specs/2026-10-07-architecture-remediation-design.md`

## Global Constraints

- Preserve current document formats, migration/recovery data, print geometry, authoring interactions, theme framing and all conflict safeguards.
- Add no dependencies.
- Root owns Git operations; agents own disjoint file sets.
- Each reviewed deliverable has its own commit and push; do not merge into main.
- Functional defects and UX decisions remain the next remediation batches.

## Review Focus

- Live pointer thresholds and persistence migration must survive deletion (Task 1 existing tests/browser gate).
- Prefix ranges must include arbitrary valid suffixes, including `\uffff` (Task 3 range tests).
- Asynchronous insert collision must abort earlier writes and suppress notices (Task 3 native browser test).
- Existing reload/recovery failure injection must still hit real adapter paths (Task 3 reliability gate).
- Relocated PWA checks must still build and activate both offline app versions (Task 2 full PWA gate).

## Task 1: Retire disconnected legacy code

**Files:** Remove legacy `InstructionCanvas`, `CollapsedField`, `ConfirmDialog`, `DragGhost`, `DurationField`, `FieldPopover`, import/new-document dialogs, `TokenDetails/QuantityForm`, `InstructionEditor/DragHandle`; `state/canvas`, `state/drag`; `lib/canvas-layout`, `dialog-focus`, `field-placement`, `pdf-pagination`, `platform`; exclusive tests. Modify `lib/pointer-drag.ts`/test, `state/ui.ts`, `styles/global.css`, `InstructionEditor/editor.css`.

**Interfaces:** Preserve `dragThresholdFor(pointerType: string): number`, its two threshold constants, and all active UI/session exports.

- [ ] Reconfirm static/dynamic imports and active CSS boundaries.
- [ ] Remove unreachable files/exports and exclusive tests; retain threshold tests, base/theme CSS and desktop scrollbar gutter.
- [ ] Run `npm test`, `npm run lint`, `npm run build`; active tests and compilation pass.
- [ ] Obtain independent review; commit `refactor: retire disconnected legacy editor implementation` and push after browser verification.

## Task 2: Consolidate maintained browser checks

**Files:** Move ten hidden `.mjs` drivers/helpers and five `scripts/check-{header-theme,editor-drag,print-faithful-editor,centered-pictograms,review-regressions}.mjs` to `tests/browser`. Modify `scripts/check-browser.mjs`, `eslint.config.js`, active test documentation/skill pointers and six executable archived probe imports.

**Interfaces:** Preserve `npm run test:browser`/`test:pwa`, check argument order and helper exports. Storage task owns later edits to relocated reliability/helper files.

- [ ] Move files, update imports/root resolution and evidence defaults; lint Node browser drivers.
- [ ] Run lint, tooling, build, full browser and PWA gates. Confirm no maintained executable imports hidden drivers.
- [ ] Obtain independent review; commit `refactor: make browser verification ownership explicit` and push.

## Task 3: Declare storage reads and use atomic inserts

**Files:** `lib/guide-repository.ts`/test, `state/preferences.ts`/test, recovery-key read in `state/guides.ts` and test fakes. After Task 2 relocation, update `tests/browser/editor-browser-helpers.mjs`, `reliability-check.mjs`; add focused native storage checks and wire runner.

**Interfaces:** `GuideReadPlan { keys?: readonly string[]; prefix?: string; mode?: "readonly" | "readwrite" }`; `GuideStore.transaction<T>(plan: GuideReadPlan, operation: (transaction: GuideTransaction) => T): Promise<T>`; existing transaction `get/put/entries` plus `add(key: string, value: unknown): void`.

- [ ] Write meaningful read-plan/range/insert rollback regressions, run before implementation and record expected failures.
- [ ] Implement selective prefetch and synchronous policy dispatch; require declared reads; native `add` for guide/recovery inserts. Update callers and serialized fakes while preserving existing session behavior.
- [ ] Update real-browser reload/recovery fault injections; test keyed operations with `getAll/getAllKeys` prohibited and prefix exclusion, collision rollback and notice/baseline protection.
- [ ] Run full unit suite, lint/build and reliability/native browser checks; obtain independent concurrency/recovery review.
- [ ] Commit `refactor: narrow atomic guide storage transactions` and push.

## Final verification

- [ ] Run integrated unit/tooling, lint/build, browser/PWA gates after all changes.
- [ ] Review the branch independently, resolve material findings, and update current remediation status with source lines and commits in a separate documentation commit.
- [ ] Verify remote branch equals local HEAD and working tree is clean.
