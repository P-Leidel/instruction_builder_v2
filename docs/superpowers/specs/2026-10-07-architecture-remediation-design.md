# Architecture remediation — 7 October 2026

The user requested remediation of the codebase health report, starting with architecture, using parallel agents where practical, with each independent change committed and pushed separately. This first batch addresses the report's three architecture findings. Functional defects and UX decisions remain the next remediation batches.

## Approach and boundaries

Prefer targeted retirement and narrower existing interfaces. A wholesale application rewrite would discard useful document/session, output-plan, reader and storage boundaries. Merely documenting the obsolete implementations would leave duplicate behavior and maintenance costs intact.

Preserve current document formats, migration/recovery data, print geometry, authoring interactions, theme framing and all conflict safeguards. Add no dependencies. Work on `codex/architecture-remediation` in the existing isolated worktree. Root owns Git operations; agents own disjoint file sets. Each reviewed deliverable has its own commit and push; do not merge into main.

## Retire unreachable implementation paths

Remove disconnected legacy canvas/cards/chips, drag state, popovers/forms, confirmation dialogs, pagination/layout/focus/platform helpers and their exclusive tests. Reduce `pointer-drag` to the threshold helper used by the live editor and retain its tests. Remove unused legacy UI exports. Preserve persistence startup migration, document compatibility adapters, imported legacy IDs, artwork fixtures and current editor/reader/output components.

Remove obsolete global class rules and the new editor's compensating legacy reset together. Preserve base/theme rules and desktop scrollbar gutter behavior. Existing browser gates establish unchanged layout, menu, pointer and touch behavior; deleting obsolete test cases does not reduce coverage of the active app.

## Narrow storage transactions

Keep synchronous policy callbacks inside one native IndexedDB transaction. Extend `GuideStore.transaction` to accept a read plan with optional exact `keys`, optional `prefix`, and `mode: readonly | readwrite` (default readwrite). Prefetch only declared keys or a bounded string-prefix cursor. Reject undeclared reads. `GuideTransaction.add` performs insert-only writes for generated guide/recovery IDs; `put` remains for updates and migration markers.

Resolve only after native commit and reject synchronous policy errors, asynchronous collisions, request failures and aborts. Exact-key load/save/remove/restore/duplicate, preference access and recovery imports avoid unrelated records. List scans only guide keys. Initialization reads only legacy and migration keys. Empty read plans support create; dynamic insert collisions remain atomic through native `add`.

Keep revision and raw-fingerprint checks atomic with writes. Advance baselines, recovery deduplication and notices only after commit. Preserve original malformed cloneable graphs, tombstones, unknown envelope fields, overflow and conservative opaque conflicts. Load/list remain readwrite because they may atomically create recovery copies. This refactor does not change preference merge semantics or startup retry policy; those are separate reported bugs.

Tests must prove keyed operations succeed with full-store scans prohibited, prefix scans exclude unrelated data, asynchronous insert collisions roll back all writes, and current concurrent-save/recovery failure protections still hold. Update browser failure injection from obsolete `getAll`/recovery `put` paths to keyed `get`/insert `add` paths.

## Make verification ownership explicit

Move maintained browser drivers and helpers from `.claude/skills/run-instruction-builder` and browser-only root scripts to `tests/browser`. Keep the orchestration/build/assertion/tooling helpers under `scripts`; keep the skill's instructions with corrected command pointers. Preserve npm/CI entrypoints and child argument order. Resolve repository roots explicitly, including standalone checks. Lint maintained browser scripts with Node globals. Write new standalone evidence to ignored `artifacts`, preserving dated evidence.

Update active documentation and executable audit-probe imports. Dated report/progress prose remains historical. Run the full browser and production PWA gates after migration, including cold-offline exports and waiting-update activation.

## Acceptance

Require independent task reviews and a final architecture review, lint, full unit/tooling suites, production build, full browser gate and production PWA gate. Record commit hashes and verification in the remediation record. Report remaining defects and UX decisions accurately; real-device, screen-reader, participant and physical-print acceptance remain outside automated verification.
