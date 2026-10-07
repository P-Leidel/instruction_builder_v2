# Task 2 report — DONE

Implemented package 02 against the approved Task 0 contracts. Source is frozen for independent review. No Git mutations, child agents, application startup/UI edits, or maintenance-runner edits were made.

## Owned changes

- `src/lib/guide-repository.ts` and tests: injected transactional store/clock/ID factory, native IndexedDB adapter, per-guide envelopes, atomic/idempotent legacy migration, unchanged legacy source, exact unique recovery copies/notices, validation/isolation, sorted summaries, raw-baseline plus revision comparison, create/duplicate/save/tombstone/restore.
- `src/state/guides.ts` and tests: one session observer, sequential 200 ms save draining, truthful status, safe navigation and session opener, explicit reload, create/import/duplicate/delete/restore, recovery imports, and approved draft/tombstone signals.
- `src/state/preferences.ts` and tests: versioned separate preferences, immediate updates, serialized persistence, browser-language defaults, validated fallbacks, exact invalid-record diagnostics, and initialization-race protection.
- `src/state/persistence.ts` and tests: compatibility `initPersistence` remains; `stopLegacyPersistence` disposes observer/lifecycle listeners, drains pending writes and awaits active commits, and prevents reattachment. All existing raw-recovery/conflict tests remain intact.
- `docs/persistence-recovery.md`: keys, transaction boundaries, migration/recovery, tombstones, statuses, portable backups, empty-list/new/import/open/reload/Undo integration examples and device-local limitations.
- Durable actual IndexedDB proof/evidence: `docs/phase-3/audits/2026-10-06-overhaul/storage-proof/task-2-idb-proof.mjs` and `task-2-idb-evidence.json`. These replaced the temporary plan-workspace proof files.

## Red / green evidence

Repository behavior was tested before implementation (9 failures / 1 pass on the interface scaffold). Preference behavior was RED on its scaffold (4 failures); controller behavior was RED on its scaffold (13 failures). Legacy shutdown tests reproduced missing shutdown behavior (2 failures). Additional regressions reproduced RED for cancelled reload silently using an unadopted raw baseline, immediate preference updates being clobbered by initial load, and opaque same-revision envelope changes bypassing comparison. Each is now GREEN.

Final focused gate at 16:52 Europe/Berlin: `npm test -- src/lib/guide-repository.test.ts src/state/guides.test.ts src/state/preferences.test.ts src/state/persistence.test.ts` — **43 tests, 4 files passed** (repository 13, guides 15, preferences 5, persistence 10).

Final integrated gates against frozen source:

- `npm test` at 16:53 — **409 tests, 31 files passed**.
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0, no diagnostics.
- `npm run build` at 16:53 — exit 0; Vite build and offline asset preparation succeeded.
- `node docs/phase-3/audits/2026-10-06-overhaul/storage-proof/task-2-idb-proof.mjs` at 16:53 — exit 0, **12 checks passed**, Chromium **153.0.8010.12**, no uncaught browser errors. Timestamp/browser/transaction results are recorded in the durable JSON.

The native proof uses actual `keyval-store`/`keyval` readwrite transactions and separate tabs/profiles. It proves one atomic initial import, simultaneous same-guide winner/conflict, sticky losing draft through pagehide, explicit reload, same-revision change after summary refresh, independent-guide commits, stale tombstone/restore protection, changed-legacy and malformed-guide exact copies, cyclic/future recovery retention, latest queued snapshot before navigation with exact statuses, and no baseline advance after an aborted mutation. Injected `IDBObjectStore.put` quota errors prove failed recovery blocks replacement and failed marker write rolls back an already-queued guide write. Actual old-observer handoff also passes. The proof starts/cleans up its own Vite server and Chromium; it does not require the old application UI or replace the release browser runner. Root/Task 6 owns release-runner integration.

## Exact integration contract

Startup awaits only `initializeGuides(documentSession)`. Exports keep stable signal identities and the existing default session. Call it once; repeated calls reuse initialization. `activeGuideId === null` is My guides; its `saveState` is `pending`, so UI must hide “Saved” without an active guide.

`preferences`, `initializePreferences`, `updatePreferences`, and separate `preferenceSaveState` are exported from preferences. Failed preference writes never mark a committed guide unsaved. Records use `{ version: 1, preferences }`; unsupported stored fields fall back independently to English/Kitchen and their raw value is retained under a recovery key.

`guideNotices` and re-exported `GuideNotice` provide structured `legacy-changed` / `legacy-recovered` / `guide-recovered` notices, source/recovery keys and optional guide ID. `importRecoveredGuide` validates the recovered document or envelope's inner document, uses ordinary flush/create, and retains the source.

`failedNewGuide: Signal<InstructionDocument | null>` starts null, captures validated attempted creation on failure, and clears on successful creation/duplication. Opens/reloads and failed retries retain it. The current session stays intact. If creation commits but a later active edit fails its second drain, the new record remains listed and the action fails while preserving the old draft; inspect the list before retry.

`lastDeletedGuide: Signal<GuideRecord | null>` starts null, is set only after committed deletion, and retains the exact tombstone revision for Undo. Failed operations retain it; the next committed deletion replaces it; successful restoration of its guide clears it. Covered requested revision 1 -> own flush 2 -> tombstone 3 -> restore 4. Shared `GuideActionResult` is unchanged.

Externally deleted active work stays in the session: saveState becomes `conflict`, and `flushActiveGuide` returns sticky reason `deleted` for the UI's specific explanation. Explicit failed/deleted reload preserves the losing draft/history. An edit while reload is reading returns `cancelled`, preserves that edit, and blocks saving until another explicit reload adopts both document and raw baseline.

Summary refresh never replaces an already cached raw baseline. Normal JSON and comparable clone graphs (cycles, Date/Map/Set/RegExp/binary) compare stably. Opaque non-JSON extras such as Blob/File/Error deliberately never compare equal because their contents cannot be compared synchronously inside the transaction; this conservatively conflicts instead of allowing an undetected stale overwrite. Exact raw data remains intact, and ordinary authored/imported JSON is unaffected. No text limits or document schema changes were introduced.

The 200 ms / pagehide policy remains best effort for abrupt page teardown. Internal actions await all writes; JSON backup always uses the in-memory document. Application/main/UI still use the compatibility path until Task 3 switches startup. No requirement is blocked; fresh review and serialized commit are root-owned.

## Review round 1 — P1 reload write barrier fixed

The independent review reproduced a data-loss window after repository load had adopted a same-revision disk baseline but before the controller adopted its document. Direct flush, pagehide, or hidden visibilitychange could write a newer local draft against that unadopted baseline. An existing save drain could also start queued writes while reload waited for it.

`flushActiveGuide` now returns `cancelled` without starting a write for the entire reload window. An already-started write may finish, but its drain cannot start another queued snapshot during reload and does not acknowledge pending work as saved. Reload captures the consented local document before awaiting that drain; any intervening edit cancels adoption, preserves the latest exportable draft, and keeps conflict sticky until a later successful explicit reload. Pending edits retain truthful pending status during the read. No public types or repository transaction contracts changed.

Owned round 1 files: `src/state/guides.ts`, `src/state/guides.test.ts`, `docs/persistence-recovery.md`, the durable proof script and JSON listed above, and this report. The independent review probe/config remain unchanged.

TDD evidence on 2026-10-06 (Europe/Berlin):

- At 17:02, `npm test -- src/state/guides.test.ts` — **4 failed / 15 passed**. All three new flush-entry regressions returned success instead of cancelled; the drain regression started two writes instead of one.
- At 17:03, the same command after the production fix — **19 passed**.
- At 17:03, `npm test -- --config .superpowers/sdd/2026-10-06-agent-implementation/task-2-review-probe.config.mts` — **1 passed**, reproducing the original reviewer scenario with the unchanged probe.
- At 17:05, `node docs/phase-3/audits/2026-10-06-overhaul/storage-proof/task-2-idb-proof.mjs` — exit 0, **16 native IndexedDB checks passed**, Chromium **153.0.8010.12**. Durable JSON timestamp: `2026-10-06T15:05:37.270Z`. The original 12 checks remain, plus actual transaction-boundary regressions for direct/pagehide/hidden visibilitychange flushes and an already-started save with queued edits. These verify the exact disk winner, zero new writes during the paused load, cancelled results, retained local draft, sticky conflict, and resumed saving only after successful explicit adoption.
- At 17:06, focused repository/controller/preferences/legacy tests — **47 passed, 4 files** (13 / 19 / 5 / 10).
- At 17:06, `npm test` — **416 passed, 31 files**; `npm run typecheck`, `npm run lint`, and `npm run build` — all exit 0. Lint had no diagnostics; build and offline asset preparation succeeded.

Round 1 is DONE with no remaining blocker. Source is ready for the root-owned commit and original reviewer's scoped re-review. The earlier evidence above records the pre-review snapshot; this appendix is the current verification.
