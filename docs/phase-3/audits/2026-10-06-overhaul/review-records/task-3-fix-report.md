# Task 3 fix round 1

Status: DONE. All three formal P2 findings reproduced before production edits and corrected sequentially. OutputDialog hookup remains deferred until independent scoped approval. No Git/index mutations, child agents, peer production edits, or check-browser runner edits.

## Findings and corrections

1. **Mounted attachment drafts after history/reload/removal.** Quantity and Time editors initialized local input only on mount. Added layout-effect reconciliation when the committed primitive attachment fields (amount/unit or seconds, label, iconId, presence) change. Document actions clone unrelated attachment objects; dependence on object identity would discard unsaved input on unrelated edits. Primitive dependence preserves typed drafts across unrelated document/preference renders, while committed change/removal resets the fields and stale validation state before paint. Unchanged Save still preserves authored labels/custom units/unknown fields through the existing callbacks.
2. **Desktop Escape leaking from a modal to the authoring panel.** The window listener now ignores defaultPrevented Escape and Escape while any native dialog is open. Normal unconsumed desktop Escape still closes the panel. Root-approved seam clarification: Print/Download keeps the desktop panel mounted behind its native modal, preserving its draft, while opening output below 768px closes the authoring sheet first so there is one native modal. Native showModal makes the background inert; existing document shortcut guards remain in place. The current output placeholder is unchanged otherwise; no Task 5 hookup occurred.
3. **Read return to a non-first empty group.** If no picture is selected, App now locates the selected group's surviving Add picture control, focuses it and reveals it. A surviving opener/global Add fallback is used only if that group control is unavailable. Existing selected-picture restoration remains intact.

## Exact changed files

- `src/components/TokenDetails/AttachmentFields.tsx`: reconcile quantity/unit/time drafts on committed primitive changes.
- `src/components/AuthoringPanel/AuthoringPanel.tsx`: isolate desktop Escape from consumed events/open modals.
- `src/app.tsx`: selected-group Read return; approved desktop/mobile output opening distinction.
- New `.claude/skills/run-instruction-builder/editor-transition-check.mjs`: focused real-browser regressions and durable evidence, explicit Node imports, strict boolean checks, console.error/pageerror capture, owned server/context/browser cleanup in finally.
- New evidence under `docs/phase-3/audits/2026-10-06-overhaul/editor-proof/editor-transition-*` and this fix report.

The independent review probe itself was not edited. Its normal run rewrites its own `task-3-review-probe-results.json` with the observed result. `scripts/check-browser.mjs` remains untouched by this worker; root now owns runner integration.

## RED/GREEN evidence

Before edits, the unchanged reviewer command `node .superpowers/sdd/2026-10-06-agent-implementation/task-3-review-probe.mjs` exited 1 (18:07 local): selected group group-2/focused group-0; committed quantity 2/input 7; committed time 60/input 90; Settings Escape closed panel 1→0 and lost draft 11. Five genuine failed assertions, zero console/page errors.

Each finding was then exercised separately before its production correction:

| Focused case | Genuine RED | GREEN after that correction |
| --- | --- | --- |
| attachments | `TOKEN_QUANTITY_UNDO`: input 7 versus expected 2 | 29 checks |
| modal | `SETTINGS_ESCAPE_BACKGROUND_PANEL`: count 0 versus expected 1 | 22 checks |
| focus | `EMPTY_THIRD_GROUP_READ_RETURN`: group-0 versus expected group-2 | 4 checks |

Commands use `node .claude/skills/run-instruction-builder/editor-transition-check.mjs docs/phase-3/audits/2026-10-06-overhaul/editor-proof - CASE TAG`. CASE selects attachments/modal/focus; `-` makes the script own an ephemeral Vite server. Red evidence tags were `attachments-red`, `modal-red`, and `focus-red`; the corresponding JSON files retain the failed assertion and zero errors. Green runs use the case as their default evidence tag.

After all corrections, the unchanged reviewer probe exited 0: group-2 restored; fields 2/60 match the document; Settings panel stays 1, draft 11 survives, focus is Settings; zero errors.

## Final observed checks

| Command | Result |
| --- | --- |
| unchanged reviewer probe above | exit 0, all original assertions pass |
| `node .claude/skills/run-instruction-builder/editor-transition-check.mjs docs/phase-3/audits/2026-10-06-overhaul/editor-proof` | 53 checks, exit 0, zero console/page errors; final rerun after explicit Node imports also 53 GREEN |
| `npm test` | 37 files / 463 tests passed, exit 0, run began 18:12:28 local |
| `npm run typecheck` | exit 0 |
| `npm run lint` | final rerun exit 0 |
| `npm exec eslint -- --no-ignore .claude/skills/run-instruction-builder/editor-transition-check.mjs` | exit 0 |

The first full lint run found an active parallel sample-generator `no-redeclare` for console in `docs/phase-3/audits/2026-10-06-overhaul/print-samples/generate-samples.mjs:1:28`. Reported it to root and left that file untouched; root removed its duplicate declaration. Final full lint rerun passed. Normal ESLint ignores the hidden browser-script directory, so an explicit no-ignore check was also used; it exposed implicit process/Buffer globals in the new script, corrected with explicit Node imports before its final lint/browser rerun.

No broad existing browser/PWA/export/build suite was repeated: the required original symptom probe, transition regressions, full unit/type/lint are fresh. Root owns final integrated runner/release gates. Shared-worktree gate results do not imply independent approval of a peer package.

## Durable regression coverage

The combined 53 checks use fresh isolated guides and actual native IndexedDB. They cover:

- Token quantity/time mounted-panel Undo and Redo; attachment removal and Undo; reset to ordinary defaults after removal; unfamiliar custom unit restored on Undo.
- Group time mounted-panel Undo/Redo/removal/Undo.
- Unchanged quantity/time/group Save preserves full authored labels/custom units. Reloaded authored attachment labels are preserved on subsequent unchanged Save.
- Unsaved amount, custom unit and time survive an unrelated guide-title edit and label-language preference change.
- A real second tab commits a winning guide revision. UI conflict/reload confirmation adopts it with group time still mounted. A second winning revision is adopted with quantity/unit/token time still mounted. Fields reflect the new committed values, not stale unsaved drafts.
- Settings, import confirmation, and output-placeholder Escape close only the top modal, preserve the desktop quantity/time draft and unchanged source, and return focus to that modal's opener.
- Already consumed nonmodal Escape does not close the background panel. Ordinary unconsumed desktop Escape still closes it.
- Mobile output opening closes the prior authoring sheet, leaving exactly one native modal.
- Third empty group's selection/focus survives Read/Back; if all groups are removed while reading, Back safely focuses Add step.

Evidence paths under `docs/phase-3/audits/2026-10-06-overhaul/editor-proof/`:

- `editor-transition-all.json`: combined 53 true, errors empty.
- `editor-transition-attachments.json`, `editor-transition-modal.json`, `editor-transition-focus.json`: narrow GREEN results.
- `editor-transition-attachments-red.json`, `editor-transition-modal-red.json`, `editor-transition-focus-red.json`: actual pre-correction failure evidence.
- `editor-transition-attachments.png`, `editor-transition-modal.png`, `editor-transition-focus.png`: actual final case states. These are technical evidence, not physical/device/participant acceptance.

## Runner handoff and self-review

Root can insert `['editor-transition-check.mjs', outputDirectory, serverURL]` sequentially in its owned browser runner. Supplied URL reuses the owned runner server; absent URL or `-` creates/cleans an ephemeral server. Optional fourth/fifth CLI arguments select case/evidence tag. Default all case run is strict and writes durable combined evidence. Browser and context cleanup occurs on both assertion failures and success.

Self-review checked that unrelated cloned-document renders do not trigger draft reconciliation, committed removal/reload/history does, and unchanged saves preserve stored display labels. Escape checks protect both already-consumed events and still-open dialogs even when modal closing tears down DOM during bubbling. Selected-group focus uses CSS-escaped IDs and a surviving DOM target with a safe removed-group fallback. All production changes stay inside the three finding files; no storage/session/output policy changed.

No known remaining failure from this review round. Await root's checkpoint and original independent reviewer approval before any OutputDialog integration. Real software keyboards/rotation, screen readers, recipient/child acceptance, and physical printer/actual-size acceptance remain pending as in the initial Task 3 report.
