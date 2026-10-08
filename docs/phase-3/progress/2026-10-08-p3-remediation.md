# P3 review remediation — 8 October 2026

> 📌 **Doc status: CURRENT** — delivery record for the three smaller gaps after [functional remediation](./2026-10-08-functional-remediation.md). The [dated health review](../reviews/2026-10-07-codebase-health-review.md) preserves the original findings.

| Finding | Delivered behavior | Source / commit |
| --- | --- | --- |
| Choice boards expose ordered editor groups | Board pages use unordered lists in ready, blocked and continued layouts; sequences retain ordered lists, content order and physical geometry. | [InstructionEditor.tsx:45](../../../src/components/InstructionEditor/InstructionEditor.tsx#L45), [page lists:68](../../../src/components/InstructionEditor/InstructionEditor.tsx#L68); [e5c47c6](https://github.com/P-Leidel/instruction_builder_v2/commit/e5c47c6) |
| Read omits unknown quantity/time references | Localized notices retain full unresolved quantity, picture-time and explicit group-time icon IDs in Read and shared semantic preview. Authored values, labels and board timing remain intact; resolvable references add no notice. | [instruction-reading.ts:26](../../../src/lib/instruction-reading.ts#L26), [ReadingContent:31](../../../src/components/InstructionReader/InstructionReader.tsx#L31); [af7a46f](https://github.com/P-Leidel/instruction_builder_v2/commit/af7a46f) |
| Copy gives no success feedback | Successful internal clipboard copies announce a meaningful localized label inside the active panel, including the native mobile modal. Repeated copies update the polite status; stale targets preserve the clipboard and do not announce success. Focus and attachment drafts remain intact. | [TokenDetails.tsx:29](../../../src/components/TokenDetails/TokenDetails.tsx#L29), [authoring.ts:31](../../../src/state/authoring.ts#L31); [83c1b5e](https://github.com/P-Leidel/instruction_builder_v2/commit/83c1b5e) |

## Verification

All three fixes have independent task and final whole-batch approval without actionable findings, separate pushed commits and passing GitHub CI. Fresh combined verification passes **569 unit tests / 39 files**, **7 tooling tests**, lint and production build/typecheck. The full browser gate passes, including **47 board checks**, **24 reader/preview cases**, **100 Copy checks** and prior regressions.

Production PWA passes **49 cold-offline checks / four formats**, synthetic activation and actual first-use PDF from old/new offline clients across a waiting update. Inspected German mobile screenshots show unclipped Copy feedback and wrapped full-ID reader notices. Failing-before/passing-after evidence and reports are local and ignored: `artifacts/p3-remediation/`. Earlier counts remain historical checkpoints. No merge or deployment occurred.

## UX decisions

The user chose **automatic saving for valid picture/group details edits**, with incomplete input visibly marked. Today quantity/time still use separate Save buttons and target-scoped drafts ([AttachmentFields.tsx:42](../../../src/components/TokenDetails/AttachmentFields.tsx#L42)); the selected UX change is not implemented yet.

For **Print / Download**, the user chose prominent size, orientation, content mode, preview and PDF controls, with background, headings, group selection, DPI and alternate formats in named collapsed sections. This direction is also awaiting implementation.

The remaining [three decisions](../reviews/2026-10-07-codebase-health-review.md#ux-and-visual-decisions) concern mobile fitting/readability while preserving physical geometry, contextual-panel placement, and guide creation/list flow. Mobile fitting is the next question. Practical device, screen-reader, participant and physical-print acceptance and artwork distribution licensing remain pending. Phase 3 remains in progress.
