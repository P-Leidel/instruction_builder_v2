# Local guide management and reliable saving

**Owner:** Guide storage agent. **Dependencies:** Shared document/session and repository types from [00](00-shared-contracts.md). **Deliverable:** A local guide repository and controller that preserve the current maintenance safeguards while supporting several guides.

## Owned files

Create `src/lib/guide-repository.ts`, `src/lib/guide-repository.test.ts`, `src/state/guides.ts`, `src/state/guides.test.ts`, and `src/state/preferences.ts` with tests. Own the replacement of `src/state/persistence.ts` and its tests, and updates to `docs/persistence-recovery.md`. Foundation owns shared models/session actions. The editor/integrator owns My guides UI, `app.tsx`, `main.tsx` startup wiring, and global styles. Coordinate startup through one exported initialization function; never attach two autosave observers.

Export `createGuideRepository(): GuideRepository`, `initializeGuides(session: DocumentSession): Promise<void>`, and the controller/preference interfaces from 00. Use the existing IndexedDB database/store, `keyval-store` / `keyval`. Keep the repository independently testable through an injected store/clock/ID factory; do not require DOM globals for transaction policy tests.

## Storage format and migration

Store each `GuideRecord` under `instruction-builder:guide:<id>`. Keep app preferences at `instruction-builder:preferences:v1`; they are not portable document content. Persist a legacy-import marker at `instruction-builder:guides-migration:v1` containing the imported guide ID and exact legacy snapshot fingerprint. Guide records have their own validated envelope; document schema v2 is independent of preference/migration record versions.

Initial startup reads the legacy `instruction-builder:document`, migration marker, and candidate record within one readwrite transaction. With no completed migration, validate/migrate the legacy document, create one guide, and commit record plus marker atomically. Repeated startup/two simultaneous first-launch tabs produce exactly one migrated guide. Keep the original legacy record unchanged as a recovery source; the new app stops writing it.

If legacy data is unreadable or future-version data, save its **exact raw value** under a unique `instruction-builder:recovery:<timestamp>:<uuid>` key before offering a fallback guide. A failed recovery copy leaves the original untouched and saving unavailable. If no legacy record exists, show My guides' empty state; create no surprise empty saved guide. Inspect any changed legacy fingerprint on later launches: preserve that revision in recovery and show an import offer, without silently overwriting or duplicating the migrated guide. This covers edits by a still-open older client.

Validate every loaded guide envelope/document before activation. Unreadable records stay at their original keys and receive unique recovery copies and a recoverable notice; they do not break the list of other valid guides. Do not discard future-version records or clear the database to recover. List excludes tombstones and returns most recently updated first, breaking ties by ID. Titles are derived from the document, not independently edited metadata.

## Guide operations

| Operation | Required behavior |
| --- | --- |
| Create blank | Create a sequence or board document; open it only after successful creation, retaining a failed creation as an exportable local draft |
| Create example / import JSON | Add another guide; preserve existing guides and v1 repair; malformed input changes nothing |
| Open | Flush the current guide, load a valid target, open through `openDocumentInSession`, and clear cross-guide history/clipboard |
| Duplicate | Read the committed source, clone content and presentation, use a fresh guide ID/revision/timestamps, and add a localized copy suffix; token IDs remain document-scoped |
| Rename | Edit the document title through the session; save title and content in the same revision |
| Delete | Confirm the specific guide in the UI; commit a revisioned tombstone, preserving content; offer Undo / restore using its new revision |
| Restore | Clear the tombstone in a revision-checked transaction; stale restore cannot overwrite a newer state |
| Last guide | Reopen a valid last-guide preference; missing/deleted preference falls back to My guides without replacing another guide |

Before opening, creating, duplicating from the active guide, deleting the active guide, or importing, flush pending active edits. The UI may explicitly choose to export/reload/keep editing after a conflict or failure; until then, these actions must not discard the current in-memory document. A successful flush acknowledges the exact latest snapshot, including edits queued while another write was in flight.

`duplicateGuide` resolves the copy title through the explicit UI locale and passes it to `repository.duplicate(id, title)`. The repository clones the committed source and writes the new title in the same creation transaction; it reads no localization preferences. No intermediate untranslated duplicate or separate rename write is needed.

For active deletion, validate the requested revision against the controller's loaded baseline first, then advance it only through this controller's successful flush commits before deleting. Do not compare an old list revision after your own flush, and do not reload/rebase over another tab's newer revision to bypass conflict protection.

Deletion of the active guide returns to My guides after commit. Deletion in another tab leaves this tab's unsaved work available to export, then reports `deleted` rather than recreating the record. Different tabs may safely edit different guides. Tabs editing the same guide use compare-and-write protection; no silent last-writer overwrite.

## Saving and status

Retain the **200 ms** coalescing interval, sequential writes, visibility/pagehide best-effort flush, and sticky conflict protection. Compare `expectedRevision` and the loaded envelope's raw baseline inside the write transaction; reject changed content even if an external/older writer did not increment its revision. Increment the revision only after a committed mutation. Updates to guide A do not create conflicts for guide B.

`saved` means that the latest active-document snapshot has committed. A queued edit is `pending`; a transaction is `saving`; a newer pending edit prevents a completed older transaction from showing `saved`. `unavailable` and `conflict` remain until resolved through explicit reload/recovery. Never show “Saved” based on a timer firing or storage availability alone.

Implement `reloadActiveGuide` from 00 as an explicit recovery operation rather than routing it through `openGuide`. Successful reload adopts the current disk baseline and resets history/status without attempting a stale write. Failed or deleted-target reload leaves the local draft exportable. The UI names the discarded local edits before invoking it.

Do not promise pagehide guarantees for abrupt closure. Internal guide navigation can await the write and must do so. A local JSON backup always uses the in-memory document, including in conflict/unavailable states. Provide enough status detail for the UI to show “Saved on this device”, “Saving”, and actionable failures, translated by the central message catalog.

Preferences are validated and versioned separately. Persist locale/library changes without writing guide revisions or document history. A preference write failure must not make a successfully saved guide look unsaved. Prefer English and Kitchen for malformed unsupported preference values while retaining an invalid raw preference record for diagnosis.

### Controller integration exports

`src/state/preferences.ts` exports `preferences: Signal<AppPreferences>`, `initializePreferences(): Promise<void>`, `updatePreferences(patch: Partial<AppPreferences>): Promise<void>`, and `preferenceSaveState: Signal<"loading" | "saved" | "pending" | "saving" | "unavailable">`. Preference updates are immediately visible and persist in serialized order; failures remain separate from guide save status. `initializeGuides` initializes preferences and attaches the sole document observer; application startup awaits only that function.

`src/state/guides.ts` also exports `guideNotices: Signal<readonly GuideNotice[]>`, where each notice has `code: "legacy-changed" | "legacy-recovered" | "guide-recovered"`, `sourceKey: string`, and `recoveryKey: string`, with optional `guideId: string`. These are structured recovery information for localized UI and diagnosis, not translated sentences or document content. The repository can accept an injected notice callback while preserving its no-argument public factory and the exact `GuideRepository` interface. Changed legacy content is offered through `importRecoveredGuide(recoveryKey: string): Promise<GuideActionResult>`: validate the referenced recovery document and create another guide through the normal flush/create path; malformed or missing input preserves current work and returns an error. Recovery data is never removed by this action.

Failed creation preserves the current session and exposes the attempted document through `failedNewGuide: Signal<InstructionDocument | null>` for explicit JSON backup/retry; a successful create clears it. The integrator shows this draft alongside the failure so its recoverability is discoverable. `duplicateGuide` uses typed `guide.copyTitle` with `{ title: string }` before calling the repository.

`lastDeletedGuide: Signal<GuideRecord | null>` exposes the last committed tombstone so Undo calls `restoreGuide` with its exact post-flush deletion revision. Set it only after deletion commits; the next committed deletion replaces the offer, a successful restore of that record clears it, and failed operations preserve it. Do not infer the tombstone revision from an old list summary or change `GuideActionResult`.

## Acceptance cases

Implement named tests covering these assertions:

- `migratesLegacyExactlyOnce`: two concurrent first launches create one v2 guide and one marker; legacy raw data remains byte/structure equivalent.
- `backsUpUnreadableLegacyBeforeFallback`: future schemas and malformed/cyclic raw values preserve exact unique recovery copies; copy failure disables replacement.
- `preservesLaterLegacyEdits`: an older client changes the legacy record after migration; startup preserves/offers that content and does not overwrite the new guide.
- `commitsOnlyMatchingBaseline`: stale revisions and same-revision altered content cannot overwrite; winner stays on disk and losing local work is exportable.
- `differentGuidesDoNotConflict`: simultaneous A/B saves both commit; same-guide competing saves produce one success and one conflict.
- `drainsLatestEditBeforeNavigation`: switching while a write is active waits for the newer queued snapshot; opening the next guide cannot redirect the old save.
- `isolatesHistoryAndClipboard`: edit A, open B, Undo and Paste cannot insert A's content; returning to A retrieves the committed edits.
- `tombstoneBlocksStaleResurrection`: deletion/restore are revisioned; a stale open tab cannot recreate deleted work.
- `reportsTruthfulSaveState`: initial load, pending, in-flight, newer pending, commit, conflict, and quota failures have the specified statuses.
- `reloadResolvesConflictWithoutStaleFlush`: explicit reload adopts the winning saved record and resumes saving; a failed/deleted reload preserves the losing local work.
- `malformedGuideDoesNotHideOthers`: one invalid envelope remains recoverable while valid guides list/open normally.
- `preferencesDoNotEditDocuments`: locale/library/last-guide writes do not change document revisions/history or authored labels.

Run focused Vitest tests, then existing persistence/recovery unit tests and real IndexedDB browser fixtures. Adapt fixtures to the new record shape without removing stale-tab, backup-failure, simultaneous-writer, or raw-preservation assertions. Full unit/lint/type gates and browser reliability gates must pass.

## Handoff

Document keys, transaction boundaries, migration marker, tombstone restore, raw recovery, last-guide behavior, and the device-local limitation. Give the integrator controller examples for empty list, failed new draft, opening, import-as-new, and conflict recovery. No cloud synchronization or hard-delete/purge UI is part of this delivery.
