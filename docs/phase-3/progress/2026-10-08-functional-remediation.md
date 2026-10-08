# Functional review remediation — 8 October 2026

> 📌 **Doc status: CURRENT** — delivery record for the four P2 fixes following [reliability remediation](./2026-10-07-reliability-remediation.md). The [dated health review](../reviews/2026-10-07-codebase-health-review.md) preserves the original findings; practical acceptance remains open below.

Each fix has independent task approval and a separate pushed commit on `codex/architecture-remediation`. No dependency or storage-schema change, merge or deployment occurred.

| Finding | Delivered behavior | Source / commit |
| --- | --- | --- |
| Empty imported group/picture IDs break selection and clipboard | Schema 1/2 validation rejects empty IDs before activation; every nonempty ID, including whitespace, is preserved exactly. Rejected file imports retain document, populated undo/redo history, selection, clipboard and stored records. Invalid disk records retain exact source/recovery copies; a failed copy rolls back and blocks unsafe creation. | [migrate.ts:35](../../../src/model/migrate.ts#L35), [step validation:44](../../../src/model/migrate.ts#L44); [f35fbd5](https://github.com/P-Leidel/instruction_builder_v2/commit/f35fbd5), fixture correction [c4399f1](https://github.com/P-Leidel/instruction_builder_v2/commit/c4399f1) |
| Unknown picture caption wastes its reserved space | Full localized unknown identity and authored label share one measured `context` caption flow without an extra gap. Both locales/modes preserve full diagnostic text, source repair targets, fixed geometry and authored content; overflow still blocks export. | [output-plan.ts:178](../../../src/lib/output-plan.ts#L178); [77d194b](https://github.com/P-Leidel/instruction_builder_v2/commit/77d194b) |
| PNG lacks selected physical density | One valid `pHYs` chunk before `IDAT` declares both axes as 5906/11811 pixels per metre for 150/300 DPI. Existing density is replaced; all other native chunks and decoded pixels stay exact. Dimension rounding, transparency, 24M allocation guard and failure cleanup are retained. | [png-density.ts:2](../../../src/lib/png-density.ts#L2), [output-export.ts:54](../../../src/lib/output-export.ts#L54); [73cadb9](https://github.com/P-Leidel/instruction_builder_v2/commit/73cadb9) |
| Successful navigation leaves focus behind | User-driven editor entry focuses Guide title, Read entry focuses Back to editing, and My guides entry focuses its heading. Deferred focus checks the current view/guide and open modal; unrelated renders do not move focus. Reader exit retains selected-picture/group focus. | [app.tsx:78](../../../src/app.tsx#L78), [view-entry-focus.ts:10](../../../src/lib/view-entry-focus.ts#L10), [MyGuides.tsx:15](../../../src/components/MyGuides/MyGuides.tsx#L15), [InstructionReader.tsx:13](../../../src/components/InstructionReader/InstructionReader.tsx#L13); [bd5e708](https://github.com/P-Leidel/instruction_builder_v2/commit/bd5e708) |

PNG metadata follows the [W3C physical pixel dimensions contract](https://www.w3.org/TR/png-3/#11pHYs). Metadata lets consumers interpret physical size; actual printer scaling/readability remains a separate acceptance task.

## Verification

Independent scoped reviews approve all four fixes without blocking findings. The final whole-batch review approves committed range `735b485..bd5e708` with no actionable findings and passes **178 focused tests / 4 files** plus diff whitespace checks. Fresh root verification passes **561 unit tests / 39 files**, **7 tooling tests**, lint and production build/typecheck. The full development browser gate passes, including **9 import/recovery cases**, **11 unknown-caption cases**, **6 PNG export cases plus 2 actual dialog downloads**, and **40 transition-focus checks** across desktop/mobile. Existing gates also pass, including **31 drag checks**, **118 physical-editor checks** and **170 centered-pictogram checks**. The focus reviewer additionally passes **16 supplemental checks** for failed-draft retry, recovered import and actual stale view/guide callbacks. Root inspected unknown-caption preview and mobile failed-navigation focus screenshots; these are digital/browser observations.

Production PWA verification passes **49 cold-offline checks / four formats**, synthetic old/new activation and actual first-use PDF export from both old/new offline clients across a waiting update. PNG and focus commit GitHub CI runs pass the full browser, PWA and audit workflow through `bd5e708`.

The first strengthened import-history fixture used rapid title edits that coalesced, so its history assertion failed. Root pushed before inspecting that failed result, then corrected the fixture separately with a title edit, structural group addition and Undo. Fresh root and independent runs verify both populated history stacks before all four rejected imports; production validation did not change.

| Combined gate | Current result |
| --- | --- |
| Whole-batch independent review | Approved; no actionable findings/blockers |
| Full development browser gate | Passed (exit 0) |
| Production cold-offline/update PWA gate | Passed (49 cold checks / four formats, synthetic and actual-app updates) |
| GitHub CI through focus commit `bd5e708` | Passed |

Local ignored evidence is under `artifacts/functional-remediation/`, including per-task RED/GREEN reports, native outputs, and `reviews/{identities,unknown,png,focus,final}.md`. [Implementation plan](../../superpowers/plans/2026-10-08-functional-remediation.md). Earlier batch results are recorded separately in the [reliability delivery](./2026-10-07-reliability-remediation.md).

## Next agenda

The subsequent [P3 remediation](./2026-10-08-p3-remediation.md) records board list semantics, reader quantity/time reference notices and Copy success feedback, with their current review/verification status and UX decisions. Practical device, screen-reader, participant and physical-print acceptance and artwork distribution licensing remain pending. This record's verification counts describe the P2 checkpoint; Phase 3 remains in progress.
