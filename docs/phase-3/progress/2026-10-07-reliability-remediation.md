# Review reliability remediation — 7 October 2026

> 📌 **Doc status: CURRENT** — delivery record for the first three functional fixes after [architecture remediation](./2026-10-07-architecture-remediation.md). The [dated health review](../reviews/2026-10-07-codebase-health-review.md) retains the original evidence and open UX decisions.

| Finding | Result | Source / commit |
| --- | --- | --- |
| Valid very long text crashes planning | Physical line capacity is checked before line/fragment allocation. Oversized text returns complete overflow content and repair targets; authored data, font coverage and editor geometry are preserved. | [output-plan.ts:142](../../../src/lib/output-plan.ts#L142), [text-layout.ts:6](../../../src/lib/text-layout.ts#L6); [9ca63ab](https://github.com/P-Leidel/instruction_builder_v2/commit/9ca63ab) |
| Stale tab overwrites preferences | Each write reads the latest record and applies only retained local patches in the same keyed transaction. Explicit last-guide removal and failed patches are preserved. Malformed/future records require an exact committed recovery copy before replacement. | [preferences.ts:32](../../../src/state/preferences.ts#L32), [preferences.ts:78](../../../src/state/preferences.ts#L78); [8680402](https://github.com/P-Leidel/instruction_builder_v2/commit/8680402) |
| Transient startup storage stays unavailable | Explicit local-storage/preferences retry resumes failed startup. Guarded adoption preserves local drafts; failed recovery copies still roll back and block creation. Guide recovery and preference availability remain independent. Active conflict/deletion/later-save blockers retain explicit Reload. | [guides.ts:64](../../../src/state/guides.ts#L64), [preferences.ts:92](../../../src/state/preferences.ts#L92), [app.tsx:98](../../../src/app.tsx#L98); [870f2f5](https://github.com/P-Leidel/instruction_builder_v2/commit/870f2f5) |

Preference synchronization decision: other tabs adopt the latest stored fields during their next local write or initialization. Immediate broadcast updates are deferred. Planner line/fragment collections are geometry-bounded; complete glyph validation still processes the authored input.

## Verification

Independent task and final combined reviews approved all three fixes without remaining actionable findings. Each first/second independent commit snapshot passed 499 unit tests, lint and production build/typecheck. The original bundled-font 150,000-newline reproduction returns repairable overflow after the fix; regressions failed before implementation. A final empty-patch retry regression caught a false Saved result and now requires the failed write to commit before Saved.

Fresh integrated verification: **532 unit tests / 38 files**, **7 tooling tests**, lint and production build/typecheck, full browser gate, **11 native storage contracts**, **five real two-tab preference scenarios**, **five native startup UI recovery scenarios**, **31 drag checks**, **118 physical-editor checks**, **170 centered-pictogram checks** and **nine earlier-review regressions** pass. Production PWA verification passes **49 cold-offline checks / four formats**, synthetic old/new activation and actual first-use PDF export across a waiting update. Retry UI screenshots were visually inspected; every native recovery scenario remains in the running page without reload.

Local ignored evidence: `artifacts/reliability-remediation/`, including RED/GREEN reports, exact reproduction output, independent reviews, isolated commit snapshots and `browser-final.log` / `pwa-final.log`; retry screenshots are in `artifacts/startup-retry/`. Work is committed/pushed separately on `codex/architecture-remediation`; no merge or deployment occurred. The first two fixes also passed GitHub CI. [Implementation plan](../../superpowers/plans/2026-10-07-reliability-remediation.md).

## Next agenda

The next [functional remediation](./2026-10-08-functional-remediation.md) delivers unknown-picture caption composition, nonempty imported identities, PNG physical-density metadata and transition focus; its combined gates are recorded there. Then address the smaller board/Read/Copy gaps and trial the five UX decisions: attachment save semantics, output menu grouping, mobile fitting/readability, contextual panel placement and guide creation/list flow. Practical device, screen-reader, participant and physical-print acceptance and artwork distribution licensing remain open.
