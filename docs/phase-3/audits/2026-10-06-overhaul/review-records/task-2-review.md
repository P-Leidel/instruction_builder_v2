# Task 2 independent review — CHANGES REQUESTED

Reviewed fixed commit `9919893` against base `34863d1`. This is an independent review of the storage worker's package, not my own implementation. No production implementation or Git changes were made.

## Finding

### [P1] Block every new save while explicit reload is adopting a disk baseline

**Location:** `src/state/guides.ts:64–75`, with lifecycle callers at `src/state/guides.ts:87–88` and reload boundary at `src/state/guides.ts:123–138`.

`reloadActiveGuide` sets `reloading = true`, and the document observer uses this flag to suppress its debounce timer. However, `flushActiveGuide` does not check that flag. The pagehide/hidden-visibility handlers, or another caller of the exposed flush action, can therefore start a new write while reload is in progress. `repository.load` deliberately adopts the disk raw baseline before the controller adopts the loaded document. If the disk winner changed without a revision increment, that new raw baseline now permits a local snapshot based on the old document to overwrite the winner. The eventual `cancelled` reload result and sticky conflict occur after the destructive commit.

**Reproduction:** Create and activate revision 1; externally change its title without bumping revision; begin an explicit reload; pause the load return after its raw baseline is adopted; edit the local title and dispatch `pagehide`; await flush; release reload. The local session remains recoverable and reload returns `cancelled`, but the disk winner has already been replaced by the new local title at a higher revision. The existing cancelled-reload test exercises debounce suppression, not a lifecycle/public flush during that window.

**Specification/impact:** Shared contract 00 says reload does not flush the conflicted draft and only successful document adoption resumes saving. Package 02 requires same-revision changed-content protection, explicit reload without a stale flush, and cancelled reload preserving local edits without adopting an unowned baseline. This path bypasses those protections and overwrites another writer's saved content. It is a storage safety defect, not a status-only inconsistency.

**Minimal fix:** Make the reload guard authoritative at the entry to `flushActiveGuide`, before it can start any new write, retaining pending local edits and returning a non-success result such as `cancelled`. Lifecycle calls should not initiate saving during reload. Preserve the existing ability for reload to await a drain that was already in flight before reload started; do not restart/drain new edits against an unadopted baseline. Keep cancelled/failed reload sticky until another successful explicit adoption. Add focused tests for both `pagehide` and hidden `visibilitychange`, plus direct flush during reload, asserting the disk winner remains unchanged and the local edit remains exportable. A native IndexedDB queue-order fixture would provide additional assurance for this boundary.

## Verification evidence

One isolated review-only regression was run because code inspection exposed the named cancelled-reload/raw-baseline risk:

`npx vitest run --config .superpowers/sdd/2026-10-06-agent-implementation/task-2-review-probe.config.mts`

Result: **1 test failed**, exit 1, at 16:57:51 Europe/Berlin. It reached the expected cancelled reload, then failed the disk-preservation assertion:

```text
Expected diskTitle: Same-revision disk winner
Received diskTitle: New local edit while reloading
Expected flush non-success/cancelled
Received flush ok:true with the active guide ID
```

Reproduction artifacts are retained beside this report as `task-2-review-probe.test.ts` and `task-2-review-probe.config.mts`. They do not enter the normal source test include and do not modify implementation. The exact non-success reason is an example fix expectation; the confirmed defect is the successful overwrite before adoption.

No previously green suite, typecheck, lint, build, or 12-check native proof was rerun. The author's latest evidence remains 43 owned tests / 409 full tests / typecheck / lint / build / 12 native checks passing at the reviewed commit. The new probe identifies a missing case in that coverage.

## Reviewed boundaries and positive findings

- Opened the scoped `review-34863d1..9919893.diff` once; inspected the committed repository/controller/preferences, their tests, legacy observer handoff, recovery documentation, and native proof/evidence. No out-of-scope helper investigation or self-review of Task 1.
- Native adapter executes synchronous policy in one readwrite transaction and resolves only on commit; policy exceptions abort queued writes. Legacy record + marker creation are atomic, concurrent initialization imports once, and the unchanged legacy source is retained.
- Missing legacy data creates no surprise guide. Unreadable/future/cyclic legacy data is copied exactly before fallback creation becomes available; failed copy leaves the initialization promise rejected and later creation unavailable. Changed legacy content produces a structured import notice. Malformed guide records are copied without removing their originals and isolated from valid summaries when recovery succeeds.
- Mutation compares both safe integer revision and cached raw fingerprint in the write transaction. List refresh does not replace an existing revision's cached baseline. Opaque structured-clone values deliberately conflict rather than compare falsely equal; source and recovery retention are documented.
- Save drain captures its guide target, serializes writes, processes newer pending edits before navigation, and avoids reporting saved for an older snapshot. Open/create drain again after asynchronous target work. Failed operations preserve the active draft; failed creation exposes the attempted document independently.
- Explicit session opening resets cross-guide history/coalescing/clipboard. Default exported signals retain identity. Startup disables and drains the old observer before installing the sole guide observer; repeated initialization reuses its promise.
- Active deletion first validates the requested controller baseline and advances only through its own committed flush. The committed tombstone's exact revision is exposed for restore, stale saves cannot resurrect it, and failed restores retain the offer.
- Preference writes are separately versioned/serialized, preserve malformed raw diagnostics, retain immediate startup updates, do not enter document history, and do not change guide save status on preference failure.
- Remaining application startup/UI migration is deliberately owned by Task 3; legacy UI still running until that integration is not a Task 2 defect. Native proof is controller/storage coverage, not completed user-facing browser acceptance.

## Verdict

**CHANGES REQUESTED:** one P1 finding. Fix the reload/flush boundary and demonstrate the targeted regression green before Task 2 approval and Task 3 production integration. No additional blocking findings identified within this bounded review.
