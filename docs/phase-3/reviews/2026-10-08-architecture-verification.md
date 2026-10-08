# Architecture review verification and initial remediation

> 📌 **Doc status: CURRENT** — assessment of the [8 October independent architecture review](../audits/2026-10-08-architecture-review.html), plus the first cleanup batch. The original report remains a historical snapshot of `5fc8104`, added by `301d9f4`.

The nine candidates identify useful maintenance opportunities. They do not establish nine outstanding functional bugs. Several testing claims overlook existing unit and browser coverage, and some proposed consolidation would change intentional behavior unless the new interface preserves it. Initial remediation retires the unused legacy writer and singleton aliases; broader command and presentation changes remain separate batches.

## Verified findings

| Candidate | Assessment | Evidence and decision |
| --- | --- | --- |
| **1. Picture commands** | Accept duplication; qualify the defect implication. | [authoring.ts](../../../src/state/authoring.ts) and [editor-drag.ts](../../../src/state/editor-drag.ts) duplicate catalog insertion, selection and panel retargeting. [document.ts](../../../src/state/document.ts) has live pre-removal and final-index move conventions. Both have tests, and authoring already has session tests. Consolidate intent and follow-ups in a later batch, preserving no-op history, same-group anchor translation, deep clipboard cloning, selection and Copy focus/drafts. |
| **2. Legacy persistence and aliases** | Confirmed; cleanup started. | `initPersistence` had no production caller. Guide startup dynamically imported the module only to stop an observer that was never started. The legacy writer was the only production consumer of the zero-argument aliases. The guide repository already owns legacy-key migration, exact recovery copies and subsequent-change protection. Removed the unused module, its exclusive tests, the import and aliases. Retain test-used session actions until their behavioral checks can move to the command interface. |
| **3. Drop module** | Accept unused result and composition gap; correct the claimed anchor-test gap. | [editor-drop.ts](../../../src/lib/editor-drop.ts) returns DOM `index` values that production does not read. Production resolves stable anchors through [editor-drop-index.ts](../../../src/lib/editor-drop-index.ts), whose [unit tests](../../../src/lib/editor-drop-index.test.ts) already cover continued segments, removed anchors and false-empty groups. [The physical-editor browser check](../../../tests/browser/check-print-faithful-editor.mjs) also tests continued-page moves and undo. Keep geometry assertions; add coverage across resolution, commit and panel follow-ups when consolidating. Gesture permission still needs viewport, modal, active-guide, source-connectivity and unchanged-document guards supplied by the adapter. |
| **4. Presentation labels** | Accept extraction with explicit context. | Group/picture naming and warning checks are repeated across editor, details, picker, reading and output. The editor imports `issueText` from [OutputDialog](../../../src/components/OutputDialog/OutputDialog.tsx). Some differences are intentional: editor ordinals, authored names in Read/details, and metadata-controlled print prefixes. A shared formatter must model these contexts rather than impose one universal label. |
| **5. Screen projection and presets** | Accept duplicated policy; reject the preview claim as a reachable current bug. | [InstructionEditor](../../../src/components/InstructionEditor/InstructionEditor.tsx) and EditorGroup duplicate matching 44 px/280 px group-control rules; InstructionEditor and EditorPicture also share the 44 px picture-control threshold. Editor and output dialog duplicate preset switching, with no present disagreement. Preview uses raw margins while planning clamps them; the values differ only for custom sizes below 40 mm, which cannot fit the fixed 44 mm cells and heading bands. [output-request.ts](../../../src/components/OutputDialog/output-request.ts) removes the plan when blocked, so the preview cannot render that mismatch. Centralize these policies during the projection batch. |
| **6. Storage seam and recovery** | Qualified acceptance. | Generic transactions live in [guide-repository.ts](../../../src/lib/guide-repository.ts); preferences depends on them. Three test fakes duplicate contracts but have distinct failure/pause hooks. [storage-check.mjs](../../../tests/browser/storage-check.mjs) already checks the native adapter's key/prefix bounds, readonly behavior, collisions, rollback, commit timing and recovery graphs. A shared contract would improve parity. Preserve synchronous callbacks, insert-only recovery copies, cyclic/binary fingerprints and post-commit notices/baselines; keep preference sanitization and guide conflict/migration policy domain-specific. |
| **7. Guide-file chain** | Accept dead outputs; correct the validation premise. | Export warnings, import English error text and pending `incompleteCount` have no live display consumer; `shouldFlagIncompleteStep` has no caller. [validate.ts](../../../src/model/validate.ts) supplies empty-group advisories, while [migrate.ts](../../../src/model/migrate.ts) performs shared schema/identity/attachment safety validation. These are distinct policies. Consolidation must preserve the shared migration boundary, full editable JSON backup even when physical output is blocked, and validation before guide creation. |
| **8. App shell** | Qualified acceptance. | Busy guards, notices and view/focus orchestration live in [app.tsx](../../../src/app.tsx); MyGuides has a local busy wrapper but delegates result mapping and editor entry to App. The ten guide wrappers expose the asynchronously initialized controller and stable startup signals. Flush-before-navigation already has extensive [guide-controller unit coverage](../../../src/state/guides.test.ts). The remaining extraction target is component orchestration; preserve synchronous single-flight creation, failed drafts, modal dismissal rules, independent storage/preference retry and stale-focus guards. |
| **9. Derived i18n types** | Defer speculative derivation; preserve parameter types. | English catalog keys can define `MessageKey`; literal placeholders can define parameter names. Strings alone cannot determine numeric versus string parameter types. Removing [MessageParams](../../../src/i18n/messages.ts) without explicit numeric metadata would weaken existing compile-time checks. Typing output issue/notice keys is a smaller independent improvement. |

## Corrections to the report's coverage summary

The fresh baseline has **569 passing tests in 39 Vitest files**, rather than approximately 373 runtime cases. Parameterized tests expand beyond declaration counts. The browser directory contains **24 runnable drivers, one helper and one README**, rather than 26 drivers.

Missing an adjacent test file does not mean missing behavioral coverage. PNG density is tested through [output-export.test.ts](../../../src/lib/output-export.test.ts), including density bytes, CRC, replacement and malformed chunks. View-entry focus and App import guards have dedicated native-browser regressions. Continuation anchor resolution and guide navigation/save ordering have unit tests as well as browser checks. The real gap is composition coverage for some orchestration, not absence of the underlying tests.

The seven P2 and three P3 findings in the [7 October health review](./2026-10-07-codebase-health-review.md) are already delivered in subsequent remediation records. They are not reopened by this review.

## Initial remediation

Removed `src/state/persistence.ts` and its ten exclusive legacy-writer tests, the startup stop import, the unused signal/action aliases and their binder. Updated the domain glossary, source comments and current recovery documentation, including the maintained storage-check command. Removed one assertion tied specifically to the retired `document` alias. The remaining session tests retain their behavioral checks.

The live repository/controller still owns legacy migration, exact recovery, revision/raw-baseline conflicts, tombstones, startup retry and one autosave observer. No dependency, schema, import format, print geometry or product-control change is part of this batch. `pasteToken` and `addTokenToSelectedStep` have no production callers but remain test consumers; migrate their behavior checks to the future command interface before removal.

### Verification

| Gate | Final result |
| --- | --- |
| Baseline `npm test` | 569 tests / 39 files passed |
| Retained `npm test` | 559 tests / 38 files passed; ten tests retired with the unused writer |
| `npm run test:tooling` | Seven passed |
| `npm run lint` and `git diff --check` | Passed |
| `npm run build` | Typecheck, production build and 15 offline assets passed |
| Full `npm run test:browser` | Passed, including native migration/recovery/conflicts/startup retry, 31 drag checks, 118 physical-editor checks and 170 centered-pictogram checks |
| `npm run test:pwa` | Passed: 49 cold-offline checks / four formats, waiting-update activation and actual first-use PDF from old/new offline clients |
| Independent cleanup review | Approved; no code blocker. Corrected the current recovery instructions and a report link/threshold description identified by review. |

Browser/PWA evidence is local and ignored under `artifacts/architecture-followup/{browser,pwa}/`. The passing browser run used stable source; an earlier run was interrupted by a development-server reload during a source-comment edit. Verification establishes Chromium behavior, not the pending practical acceptance below. This batch is saved locally; remote integration and release status are unchanged.

## Next remediation batches

1. **Picture commands, then drop composition:** define stable-anchor intent and one internal move convention, preserve current selection/panel/no-op semantics, move clipboard checks to the live command interface, and test real follow-ups before deleting old paths.
2. **Presentation policy, then screen projection:** share context-aware names and issue formatting, target placement and preset switching without changing physical geometry or authored text.
3. **Storage, guide files and shell:** address one boundary per batch, preserving domain safety and existing failure injection/browser contracts. Derive i18n types only with an explicit parameter-type contract.

The selected automatic-detail-saving and simpler output-control UX changes remain tracked in [P3 remediation](../progress/2026-10-08-p3-remediation.md). Device, screen-reader, participant and physical-print acceptance and artwork licensing remain separate open release work.
