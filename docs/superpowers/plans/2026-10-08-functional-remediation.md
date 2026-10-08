# Remaining functional review fixes

> 📌 **Doc status: CURRENT** — implemented delivery plan; final branch verification follows documentation commit/push.

> **For agentic workers:** Use Superpowers debugging, TDD, parallel subagents and independent review. Root owns staging, commits and pushes.

**Goal:** Resolve the four remaining P2 findings in the [health review](../../phase-3/reviews/2026-10-07-codebase-health-review.md), following the [first reliability batch](../../phase-3/progress/2026-10-07-reliability-remediation.md).

**Architecture:** Change existing input, print/export and view-entry boundaries. Preserve authored data, exact stored recovery, fixed print geometry and independent save/conflict semantics. These fixes share no production files and can run in parallel in the existing `codex/architecture-remediation` worktree.

**Tech stack:** TypeScript, Preact, Vitest, native IndexedDB/canvas and Playwright. No new dependency or storage-schema change.

## Decisions and ownership

| Task | Bounded decision | Files / owner |
| --- | --- | --- |
| Unknown main-picture caption | Measure full localized unknown identity plus authored label as one caption flow, using `context` role. Preserve source identity and full text; known-picture captions and fixed geometry stay intact. | `src/lib/output-plan.ts`, focused tests/browser check; planner agent |
| Imported identities | Reject empty step/token ID strings at migration/import. Preserve every nonempty ID exactly, including whitespace; do not rename IDs or strip raw recovery data. | `src/model/migrate.ts`, migrate/repository tests, native import check; root |
| PNG physical density | Add/replace one valid `pHYs` before `IDAT`, with pixels/metre for selected 150/300 DPI and valid CRC; preserve original decoded pixels and other chunks. | `src/lib/output-export.ts`, focused PNG helper/tests/browser check; export agent |
| View-entry focus | On successful user-driven entry, focus editor Guide title, reader Back control or My guides heading. Guard stale destinations/open dialogs; preserve reader return focus and unrelated rerenders. | `src/app.tsx`, MyGuides/InstructionReader, focus helper/browser check; focus agent |

## Tasks

- [x] Reproduce each reported failure and record RED tests before production changes; inspect root cause at the existing boundary.
- [x] Implement/review/verify/commit/push unknown-caption composition independently, including both locales, compact labels and long/unsupported unknown identities. `77d194b`.
- [x] Implement/review/verify/commit/push empty-ID rejection independently, including v1/v2 import, preserved document/history/clipboard and exact backup-failure rollback. `f35fbd5`, corrected native history fixture `c4399f1`.
- [x] Implement/review/verify/commit/push PNG density independently, including actual downloads, 150/300 DPI, orientation, existing density, CRC/pixels and failure cleanup. `73cadb9`.
- [x] Implement/review/verify/commit/push entry focus independently, including keyboard desktop/mobile, imports/examples, dialog/failed navigation and reader return. `bd5e708`.
- [x] Complete independent whole-batch review and integrated unit/tooling/lint/build/browser/PWA gates; update current reports. Source HEAD `bd5e708` matches the remote and passes CI.

After committing and pushing the documentation, verify final remote HEAD and a clean checkout.

The smaller board/Read/Copy gaps and five UX redesign decisions are the following batch. No merge or deployment is included.
