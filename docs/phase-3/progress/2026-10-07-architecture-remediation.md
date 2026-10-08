# Architecture remediation — 7 October 2026

> 📌 **Doc status: CURRENT** — delivery record for the first remediation batch. The original health review is a dated snapshot; functional bugs and UX decisions remain open below.

The three architecture findings are addressed. Work was delegated by file ownership, independently reviewed, verified together, and committed/pushed separately on `codex/architecture-remediation`. No merge or deployment occurred.

| Finding | Delivered change | Source / commit |
| --- | --- | --- |
| Disconnected legacy implementation | Removed 21 unreachable production files, four exclusive test files, obsolete pointer/UI exports and legacy CSS. Preserved migration/compatibility/artwork paths, live pointer thresholds, scrollbar behavior and picker selection protection. 5,522 lines removed; CSS build output fell from 37.60 to 20.37 kB. | [pointer-drag.ts:1](../../../src/lib/pointer-drag.ts#L1), [global.css:101](../../../src/styles/global.css#L101), [editor.css:114](../../../src/components/InstructionEditor/editor.css#L114); [4f6886e](https://github.com/P-Leidel/instruction_builder_v2/commit/4f6886e) |
| Full-store reads on every transaction | Declared exact keys or a bounded prefix cursor replace whole-store snapshots. New guides/recovery copies use atomic insert-only writes. Commit timing, raw/revision conflicts, exact cloneable recovery graphs and tombstones remain protected. No storage schema or dependency change. | [guide-repository.ts:20](../../../src/lib/guide-repository.ts#L20), [guide-repository.ts:33](../../../src/lib/guide-repository.ts#L33), [guide-repository.ts:177](../../../src/lib/guide-repository.ts#L177); [2e6ecc5](https://github.com/P-Leidel/instruction_builder_v2/commit/2e6ecc5) |
| Hidden verification ownership | Consolidated 15 maintained browser drivers/helpers under `tests/browser`, included them in lint, retained npm/CI entrypoints and repaired executable audit imports. Standalone checks resolve their repository roots and default to ignored artifacts. | [tests/browser/README.md:1](../../../tests/browser/README.md#L1), [check-browser.mjs:30](../../../scripts/check-browser.mjs#L30), [eslint.config.js:23](../../../eslint.config.js#L23); [1a058db](https://github.com/P-Leidel/instruction_builder_v2/commit/1a058db) |

## Review and verification

Independent task reviews approved all three changes after corrections. Regression evidence caught picker text-selection loss, a cwd-dependent axe fixture, a non-callable `then` field incorrectly rejected as asynchronous policy, and loss of a present `undefined` malformed guide. Each correction has recorded failing/passing native-browser evidence.

The final independent whole-branch review approved the code through `2e6ecc5` with no actionable findings. All three architecture commits passed GitHub CI; [the final code run](https://github.com/P-Leidel/instruction_builder_v2/actions/runs/37618899677) includes the project's full Linux verification workflow.

Fresh integrated verification: **487 unit tests / 38 files**, **7 tooling tests**, lint, typecheck through production build, full browser gate, **11 native storage contracts**, **31 drag checks**, **9 prior-review regressions**, production cold-offline exports (**49 checks / four formats**) and old/new waiting-update activation including first-use PDF all pass. The lower unit count retires 89 cases for removed legacy behavior. Targeted desktop/mobile screenshots are byte-identical to the baseline. `npm audit` reports zero advisories.

Evidence is local and ignored: `artifacts/architecture-remediation/`, especially `browser-final`, `pwa-final`, `task1-selection-{red,green}`, outside-cwd axe records and the audit JSON. Native checks cover key/prefix bounds, prohibited full scans, collision rollback, commit completion, recovery graphs, notices and baseline adoption. Practical Firefox/WebKit, real-device, screen-reader, participant and physical-print acceptance remains pending.

## Earlier review changes, committed separately

| Change | Commit |
| --- | --- |
| Health report/current issue index | [3f221dc](https://github.com/P-Leidel/instruction_builder_v2/commit/3f221dc) |
| Save/Undo race | [39de47f](https://github.com/P-Leidel/instruction_builder_v2/commit/39de47f) |
| UI document language | [2c35193](https://github.com/P-Leidel/instruction_builder_v2/commit/2c35193) |
| Native field undo/redo | [ec4c110](https://github.com/P-Leidel/instruction_builder_v2/commit/ec4c110) |
| Repeated import / busy dialog | [c56a930](https://github.com/P-Leidel/instruction_builder_v2/commit/c56a930) |
| Obsolete startup tracking | [777744d](https://github.com/P-Leidel/instruction_builder_v2/commit/777744d) |
| Generated-artifact lint scope | [f95624d](https://github.com/P-Leidel/instruction_builder_v2/commit/f95624d) |
| Browser regression gate | [3a4b67a](https://github.com/P-Leidel/instruction_builder_v2/commit/3a4b67a) |
| Architecture design/plan | [68f6d04](https://github.com/P-Leidel/instruction_builder_v2/commit/68f6d04) |

## Next remediation batches

The next [reliability remediation](./2026-10-07-reliability-remediation.md) addresses valid long-text planning, transactional cross-tab preference merging and explicit startup retry. The following [functional remediation](./2026-10-08-functional-remediation.md) addresses unknown-picture caption composition, nonempty imported identities, PNG density metadata and transition focus, with current combined gates recorded there. The [health review](../reviews/2026-10-07-codebase-health-review.md) retains the original evidence. The three smaller usability gaps and five UX/design decisions remain open. Preference semantics changed in the reliability batch, after this architecture change.

Continue with independent reviewed commits for functional fixes, then decide attachment save semantics, output-menu grouping, mobile fit, contextual-panel placement and guide creation flow before altering those UX contracts. The [design](../../superpowers/specs/2026-10-07-architecture-remediation-design.md) and [implementation plan](../../superpowers/plans/2026-10-07-architecture-remediation.md) define this batch's boundaries.
