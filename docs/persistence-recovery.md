# Local guides and recovery

> 📌 **Doc status: CURRENT** — current storage, validation and recovery contract for local guides and preferences.

Guides live in IndexedDB database `keyval-store`, object store `keyval`, in this browser profile and origin. They do not sync between devices. Clearing site data removes guides, preferences, and recovery copies. Portable JSON backups contain the instruction document, without local guide envelopes or preferences.

| Key | Value |
| --- | --- |
| `instruction-builder:guide:<id>` | `GuideRecord`: `id`, positive integer `revision`, `document`, `createdAt`, `updatedAt`, optional `deletedAt` |
| `instruction-builder:preferences:v1` | `{ version: 1, preferences: { uiLocale, labelLocale, theme, activeLibraryId, lastGuideId? } }` |
| `instruction-builder:guides-migration:v1` | `{ guideId, fingerprint }`, identifying the exact imported legacy snapshot |
| `instruction-builder:document` | Original legacy document; the guide controller never replaces it |
| `instruction-builder:recovery:<ISO timestamp>:<UUID>` | Exact raw value copied from an unreadable or changed source |

Document schema 2 and preference/migration record versions are independent. Schema 1 documents retain authored content and IDs, default to sequence, and receive the existing label-only quantity repair. Preferences never edit authored labels, guide revisions, or history.

Both document schemas require nonempty group and picture ID strings. Every nonempty ID, including whitespace, is preserved exactly; validation does not rename or trim IDs. Invalid JSON file imports fail before activation and retain the current document, history, selection and clipboard. Invalid stored identities follow the exact-copy recovery rules below. A recovery copy preserves the original raw invalid record; repair a separate copy before importing. See [functional remediation](phase-3/progress/2026-10-08-functional-remediation.md).

## Transactions and startup

Legacy read, migration-marker comparison, guide creation, and marker write occur in one readwrite transaction. Two simultaneous first launches import one guide. The original legacy value stays intact before and after repair. Absent legacy data creates no saved blank guide. A missing/deleted/invalid last-guide preference returns to My guides.

Unreadable/future legacy values receive unique exact recovery copies before creating a fallback guide. Failed copies abort and disable creation/saving for that repository rather than replacing the source. A later change by an older client receives a recovery copy and `legacy-changed` notice; it does not automatically replace or duplicate the migrated guide. Recovery copies survive later creates, imports, saves, and reloads.

Every guide envelope/document is validated before activation. An unreadable record stays at its original key and receives a `guide-recovered` notice and recovery copy. Other valid guides remain listed; tombstones do not. A list/read that cannot commit its required recovery copy reports unavailable storage. Lists sort by descending `updatedAt`, then ID, and never replace an already loaded raw baseline.

Each mutation compares the expected revision and loaded raw baseline in the same transaction as its write. Another tab's same-revision change still conflicts. Baselines advance only after commit. An explicit successful load/reload is the deliberate disk-baseline adoption boundary. Different guide IDs have independent comparisons.

Normal JSON records and comparable structured-clone graphs (including cycles and binary data) use stable comparisons. Opaque non-JSON extras such as Blob/File/Error cannot be compared synchronously inside the transaction; records containing them conservatively conflict instead of risking a stale overwrite. Their original values and any recovery copies remain intact. Ordinary imported JSON and authored fields are unaffected.

Startup calls `await initializeGuides(documentSession)` once. This initializes preferences/repository, opens a valid last guide, and owns one document observer. The unused legacy single-document writer and its compatibility aliases have been removed; legacy-record migration and recovery remain repository responsibilities. See the [8 October architecture verification](phase-3/reviews/2026-10-08-architecture-verification.md).

After a failed startup read/migration, **Retry local storage** resumes incomplete initialization in the running app. Failed recovery copies must still commit before creation is enabled; their failure rolls back the entire transaction and retains the original. Retry installs observation once and does not replace document/history edited before or during recovery. It remains on My guides; Open/Create become usable after success. This startup action does not clear active conflicts, deletions or later save failures. **Retry saving preferences** independently retries failed initialization or retained preference writes.

## Save status and conflicts

Autosave coalesces for 200 ms and writes sequentially. `saved` means the latest active snapshot committed; an edit is `pending`, a write is `saving`, and newer queued edits prevent an older commit from showing `saved`. Empty My guides exposes `activeGuideId === null` and `saveState === "pending"`; hide the saved-guide message there. `preferenceSaveState` is independent.

Navigation awaits all active edits, including edits during an in-flight write or target load. Failures preserve the current session. `conflict`/`unavailable` stay sticky until explicit recovery. When another tab deletes the active guide, `flushActiveGuide()` returns `{ ok: false, reason: "deleted" }`; the shared save-state signal is `conflict`. The local draft remains exportable and cannot resurrect the record.

After an explicit backup/discard choice, `reloadActiveGuide()` reads the disk winner without a stale flush, resets history/clipboard, and resumes saving. Missing/deleted/unreadable/failing reloads preserve the draft. Editing during reload cancels adoption and preserves the new edits; saving remains conflicted until another explicit reload adopts both document and baseline.

While reload is active, every new flush—including direct calls, pagehide and hidden visibilitychange—returns `cancelled` without writing. A write already started before reload can finish, but its drain cannot start another queued snapshot. Reload remembers the consented local snapshot before waiting for that write, so edits during the wait also cancel adoption and remain available for backup.

Visibility/pagehide flushing is best effort. Browsers can abandon asynchronous writes during abrupt reload or closure. The debounce reduces that window but cannot guarantee durability during immediate teardown. Await internal actions and keep a JSON backup for work that must survive outside this profile.

## Controller integration

Stable signals: `activeGuideId`, `guideSummaries`, `saveState`, `guideNotices`, `failedNewGuide`, and `lastDeletedGuide`. Actions return `GuideActionResult`: success with optional `guideId`, or failure reason `conflict`, `unavailable`, `deleted`, `not-found`, or `cancelled`.

```ts
import { readImportFile, runJsonExport } from "../src/lib/document-file";

await initializeGuides(documentSession);
// Empty UI uses activeGuideId === null and guideSummaries.length === 0.
await createGuide(createEmptyDocument("board"));
await openGuide(id);
const imported = await readImportFile(file);
if (imported.ok) await createGuide(imported.document); // Adds another guide.
// Otherwise imported.reason is read-failed, invalid-json or invalid-document.

// After the explicit backup/discard choice:
const backup = await runJsonExport(documentSession.document.value);
if (backup.ok) await reloadActiveGuide();
// Otherwise backup.reason is export-failed; retain the draft and retry backup.
```

The file API returns typed failure reasons for UI localization. JSON backup downloads the full editable document as pretty `application/json`, including authored text, attachments and empty groups, independently of physical output readiness.

`createGuide` validates before changing anything and flushes the old guide. Failure preserves the current session and sets `failedNewGuide: Signal<InstructionDocument | null>` to the attempted new document for explicit backup/retry. It starts as null; successful creation/duplication clears it. Unrelated opens/reloads and failed retries retain it. A new record can commit while a later old-guide edit conflicts: the new record remains listed, the current draft stays open, and the action reports that flush failure. Inspect the list before retrying to avoid an extra copy.

`duplicateGuide` flushes current edits, reads committed source content, and passes typed `guide.copyTitle` with `{ title }` in UI locale to the repository. The clone gets a fresh guide envelope and keeps document-scoped token IDs; title/content commit in one transaction.

Deletion retains content in a revisioned tombstone. Active deletion validates the requested revision against the loaded baseline before its own flush. Requested revision 1 can flush to 2 and delete at 3. `lastDeletedGuide: Signal<GuideRecord | null>` exposes the committed tombstone so Undo uses its exact revision:

```ts
const result = await deleteGuide(id, displayedRevision); // UI confirms this guide.
if (result.ok && lastDeletedGuide.value) {
  const tombstone = lastDeletedGuide.value;
  await restoreGuide(tombstone.id, tombstone.revision); // Example: restore 3 -> 4.
}
```

The signal starts as null, changes only after committed deletion, is replaced by the next committed delete, and clears when its guide successfully restores. Failures retain the previous offer. Restore returns the guide to the list; opening is separate. Stale restores cannot overwrite newer content.

`guideNotices` exposes `{ code, sourceKey, recoveryKey, guideId? }` with codes `legacy-changed`, `legacy-recovered`, and `guide-recovered`; UI owns localized explanations. `importRecoveredGuide(recoveryKey)` validates a recovered document (or a guide envelope's inner document), flushes, and adds another guide. It never deletes recovery data. Missing/malformed input leaves the session intact and returns an error.

Preferences use a separate versioned record. New profiles use browser English/German, otherwise English, Kitchen and light theme. Unsupported stored values fall back field by field; invalid raw records receive exact diagnostic recovery copies before replacement. Changes appear immediately and persist in serialized order, including during initialization. Each write reads the latest stored record and merges only retained local patches atomically, so another tab's unrelated choices survive. Other tabs adopt external changes on their next local write or initialization; no immediate broadcast is implemented. Failure retains local choices and reports `unavailable` without changing the guide's saved status. Explicit preference retry preserves failed patches and changes queued while retry is running; Saved requires committed writes.

## Inspecting raw recovery data

1. Open the same origin/profile. In Chromium DevTools open Application → IndexedDB → `keyval-store` → `keyval` and refresh the view.
2. Inspect recovery timestamps and source keys. Do not clear the database or overwrite originals to test repairs. Tombstones retain their document and the revision required by restore.
3. Replace the key below to download a JSON-compatible diagnostic copy:

```js
const recoveryKey = "instruction-builder:recovery:<ISO timestamp>:<UUID>";
const open = indexedDB.open("keyval-store");
open.onsuccess = () => {
  const db = open.result;
  const transaction = db.transaction("keyval", "readonly");
  const request = transaction.objectStore("keyval").get(recoveryKey);
  request.onsuccess = () => {
    if (request.result === undefined) throw new Error("Recovery key not found");
    const blob = new Blob([JSON.stringify(request.result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "instruction-recovery-record.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  transaction.oncomplete = () => db.close();
};
```

A recovered envelope or preference record is diagnostic data, not portable instruction JSON. Preserve it intact; extract/repair a separate copy of its `document` for normal import, or use `importRecoveredGuide` for valid content. Future schemas may require a compatible app. Inspect non-JSON raw values directly in DevTools: JSON download can lose structured-clone types or fail for cycles/BigInt, while the stored recovery value stays exact.

Historical native transaction proof/evidence remains in `docs/phase-3/audits/2026-10-06-overhaul/storage-proof/`. Its dated script includes retired legacy APIs and cannot be replayed against current source. Run the maintained [storage check](../tests/browser/storage-check.mjs) from the repository root with `node tests/browser/storage-check.mjs`; it owns and cleans up a Vite server/headless Chromium and uses isolated profiles to check native commits, aborts, recovery and bounded transactions. The full browser gate also runs it.
