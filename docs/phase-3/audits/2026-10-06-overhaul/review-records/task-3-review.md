# Task 3 independent review

Date: 2026-10-06. Reviewer: `/root/agent_spec_review`, who did not author Task 3. Frozen range: `10c8590..d737543`. Requirements: task-3 brief, global constraints and updated specification index/00/03. Reviewed author evidence: `task-3-report.md`.

## Verdicts

**Spec compliance: changes required.** The sole-session/startup, guide-controller, captured picker target, final-index ordering, full authored strings, deep-copy, reader projection and board policies are consistent with the requirements. Three reproduced focus/history/modal transitions below do not meet the required recovery and interaction behavior.

**Implementation quality: changes required.** No second storage/session authority or competing reading/output policy was found. Strict browser result enforcement, real IndexedDB safety observations, error capture and cleanup remain useful. Mounted attachment drafts and global Escape handling need explicit reconciliation/isolation; the current green fixtures miss these transitions.

Task 5 hookup is an authorized deferred integration boundary. The explicit integration-pending modal and inert editor-only compatibility canvas are accepted for this initial handoff. Recipient reading mounts neither. Matching physical samples, build/PWA/final output gates and practical device/participant/print acceptance remain pending; these are not findings against this bounded delivery.

## Actionable findings

### [P2] Refresh attachment fields when Undo/Redo/reload changes the committed value

`src/components/TokenDetails/AttachmentFields.tsx:9` and `:18` initialize local amount/unit/seconds only on mount. The same picture/group component remains mounted when its attachment prop changes through history or reload. On desktop, open an imported picture with quantity **2 cups** and time **60 seconds**, save **7 cups**, then click toolbar Undo while the panel stays open. The document correctly contains **2**, but Amount still displays **7**. Save time **90**, then Undo: the document contains **60**, while Seconds still displays **90**. The Save callbacks at `:14`/`:22` can then silently reapply the undone values. The reused TimeEditor also affects group-duration fields. This contradicts recoverable editing and truthful field prefill after history/recovery.

Minimal correction: reconcile the local form draft when its committed attachment value changes through history/reload/removal, or make the fields controlled with explicit draft handling. Preserve typed unsaved input during unrelated renders/preferences changes. Add mounted-panel Undo/Redo and successful reload/removal regressions for both quantity and duration, including unchanged authored labels/custom units.

### [P2] Keep a modal's Escape from closing the inert desktop authoring panel

`src/components/AuthoringPanel/AuthoringPanel.tsx:29` handles every window Escape on desktop without checking whether a modal already handled it. Open picture details, type an unsaved quantity amount **11**, then open Settings and press Escape. The modal handles/prevents that Escape at `:13–14`, but it bubbles to the window listener, which also closes the background authoring panel. The probe observes panel count **1 → 0** and the typed quantity field disappearing; the unsaved form draft is lost. Depending on the animation-frame timing, the background panel's opener restoration can also override the Settings opener. This violates modal/background isolation and focus-return behavior.

Minimal correction: ignore Escape already handled by a modal and prevent desktop-panel shortcuts from acting while another modal is open. Retain the normal desktop-panel Escape path. Add Settings/import/output-placeholder Escape coverage with an open desktop panel and an unsaved draft; only the top modal should close, its opener should regain focus, and the background draft should survive.

### [P2] Return Read focus to the selected group when no picture is selected

`src/app.tsx:46` restores selected-picture focus, but the no-picture branch falls back to the first Add picture control. The saved Read opener belongs to the unmounted editor tree and cannot restore focus. Select the third empty group through Group actions, close details, enter Read, then return. Selection correctly remains **group-2**, while focus lands on **group-0**'s Add picture. The next keyboard activation therefore operates in another group, contrary to the required previous picture/group focus restoration.

Minimal correction: use the surviving selected group ID to focus that group's Add picture/action control when no selected picture exists; retain a safe global fallback only if that group no longer exists. Add a non-first empty-group Read/return regression as well as the existing picture case.

## Review and verification evidence

- Consumed `review-10c8590..d737543.diff` once. Its artifact/deletion-heavy transport truncated; inspected named-risk source at frozen head rather than rereading the diff. No repeated screenshot inventory: root already inspected the refreshed phone/desktop/routine evidence.
- Inspected frozen App/main/UI/authoring, editor/picker/details/attachment/My guides/reader components, shared reading tests and browser driver/review/responsive/reliability/runner sources. Checked only named unchanged dependencies needed to resolve a concrete risk (quantity builder and offered warning catalog membership).
- The exercised App/AuthoringPanel/AttachmentFields/reader/authoring sources matched `d737543` before the probe; active peer work did not change the implicated files.
- Focused reproducible probe: `node .superpowers/sdd/2026-10-06-agent-implementation/task-3-review-probe.mjs`. It owns an ephemeral local Vite server and fresh Chromium context and closes both in `finally`. Final run exits **1** on genuine assertions. Observations are preserved in `task-3-review-probe-results.json`: selected group `group-2` / focused `group-0`; stored quantity **2** / field **7**; stored seconds **60** / field **90**; Settings Escape panel **1 → 0**, unsaved quantity draft absent. **Zero console/page errors.** No current user's guide records are used.
- Author-supplied broad evidence was inspected, not rerun: **462 unit**, **7 tooling**, type/lint green; driver **29**, semantic review **22**, responsive **51**, and all six real IndexedDB reliability anchors. These establish their exercised paths, not the transitions reproduced above.
- Safety equivalents retain strict `assertChecks`, console.error/pageerror capture, owned server and browser/context cleanup, exact legacy raw preservation, multiple debounce-window conflict observations, local JSON backup, explicit reload failure/success, separate-guide saves, tombstone protection and recovery-copy failure behavior. Optional drag is explicitly deferred after the passing primary tap/keyboard paths; no new drag interaction is advertised.

No production edits, Git/index mutations, broad production gates or child agents were used. The review probe/report are the only added review-workspace files. Original-author corrections and a scoped independent fix review are required before this Task 3 checkpoint is approved.
