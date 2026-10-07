# Print-faithful editor: control and mobile investigation

This is read-only design input for root's architectural specification, not an approved implementation plan. No production changes, browser actions or gates were performed for this investigation.

## Recommended control surface

Keep the physical page as the document surface. Render it with the same measured `OutputPlan` and font adapter as output, then place editor-only selection, hit targets and insertion feedback in a separate overlay. Downloading must continue to render a detached physical SVG, never serialize the interactive editor DOM.

For each logical group, the printed heading is the rename target. A clear **Add picture** control at its top right replaces **Group actions**; remove the redundant bottom Add picture button. A quiet auxiliary disclosure provides group ordering and deletion. Headings remain keyboard reachable when they are empty, hidden by a print setting, or repeated on a continuation page.

Clicking or tapping a whole picture opens a compact editor with:

- Label, using a small multiline field so existing multiline authored text remains editable.
- Quantity: amount and editable unit, retaining custom units.
- Time: minutes and seconds, converted to the existing structured seconds; expose larger durations without truncating existing values.
- Warning: a known-warning choice plus editable authored wording, preserving unknown imported IDs until explicitly changed.

Remove the current note/description/copy/duplicate/move button wall from the primary form. Keep non-drag ordering, move-to-group and deletion under a quiet **Actions** disclosure. Existing additional authored text can have a secondary edit route; hiding a control must not delete its data. Preserve unaffected fields, metadata, unknown symbols, raw attachment values and JSON round-trip behavior. Reuse the existing source-ID-bound authoring/session commands rather than deriving mutation targets from the current selection.

Fields should have clear validation and a compact commit policy. Avoid converting a half-entered numeric draft into a stored attachment. Unrelated renders and viewport changes must preserve an uncommitted field draft and its target; close/deletion/navigation behavior should be explicit in root's spec. Successful edits and moves need reliable Undo, focus return and live-region feedback without a large status banner.

## Desktop and phone panels

The desktop authoring panel should be a fixed overlay on the viewport, outside the editor's layout column. Opening it may cover part of the page; it must not change page width, scale, picture dimensions, row positions or interaction coordinates. Keep Close reachable, provide local vertical scrolling and prevent focusing a panel field from scrolling the underlying page unexpectedly. At 768 px and 200% text size, the panel must remain usable; switching to the existing modal seam is preferable to shrinking the physical canvas.

On phones, retain the native modal and captured-target/focus-return behavior. Store editor zoom and pan independently of panel state; opening the modal, virtual-keyboard height changes and closing it must not silently refit the page. On a desktop/mobile transition, retain one editor for the same target and any field draft, cancel active dragging, and avoid a second modal.

Do not enforce 44 px hit targets by blindly expanding tiny paper regions into adjacent pictures. Use the planner's source-owned interaction regions and either a minimum usable editing zoom or an accessible auxiliary selection route. Repeated group headings across pages represent one logical group; hit testing must carry page index and source ID rather than infer group order from duplicate DOM headings.

## Touch reordering without six-dot handles

The recommended default is whole-picture mouse/pen dragging, ordinary phone scrolling, and tap-to-edit with equivalent ordering controls. If finger dragging is required, **Move picture** can arm the selected whole picture before a subsequent gesture, close the phone modal, and show a small status with Cancel. Only that armed surface disables browser panning. Reset the armed state after success, cancellation, navigation, deletion or viewport transition. A tap-to-place destination is another handle-free option and keeps scrolling available.

A delayed Pointer Events handler cannot reliably take over scrolling by changing `touch-action` after the gesture starts; canceling pointer events does not suppress browser panning. The relevant platform rule is [Pointer Events, section 8](https://www.w3.org/TR/pointerevents3/#declaring-direct-manipulation-behavior). This is why a separate arming action is more predictable than promising hold-and-drag with the present Pointer Events implementation.

A Touch Events hold experiment could cancel the first movement after a stationary hold, based on the [Touch Events first-movement rule](https://www.w3.org/TR/touch-events/#the-touchmove-event). It needs real Chrome Android and Safari/iOS evidence for scroll arbitration, slight pre-hold movement, cancellation and native selection/context menus before adoption. It would introduce a second gesture path and should remain an explicit feasibility decision. `draggable=true` is not a guaranteed replacement for the intended finger gesture: the [HTML drag model](https://html.spec.whatwg.org/multipage/dnd.html#dnd) leaves gesture initiation to platform conventions and hands control away from the application's pointer stream.

## Architectural decisions root should make explicit

1. **One effective print configuration.** Sharing `planOutput` alone is insufficient if the editor and Print dialog choose different settings. The current output controller starts with fresh defaults. Define the app-owned preset/orientation/mode/metadata/locale seam used by both surfaces and whether it persists per guide. Preserve immutable download consent and rejection of stale source independently of the live editor's replanning.
2. **Fixed dimensions versus unbounded required text.** Quantity, time and warning strings can be arbitrarily long. Fixed measured header/label/detail bands need an honest source-specific overflow result rather than clipping, overlap or silent shrinking. A continuation scheme is a separate product decision, especially for warnings and choice boards. Retain all authored data when composition fails and give a clear editing route.
3. **Meaning of fixed picture size.** Decide whether the size is fixed within each physical preset or across all presets. The current planner uses 10/15/25 mm symbols for label/ordinary/large formats. A viewport resize should change viewing scale only; panel state must change neither scale nor physical geometry.
4. **Blank and invalid drafts.** Empty guides/groups and font or composition failures need authoring controls even when there is no valid physical plan. A stale last-valid page must not imply that the current draft will print successfully.

## Existing file seams

| Concern | Existing source | Consequential change |
| --- | --- | --- |
| Primary group/picture interaction | `InstructionEditor/EditorGroup.tsx`, `EditorPicture.tsx` | Heading rename and top-right Add picture; remove picture six-dot controls; plan-derived source hit targets. |
| Quick-edit content | `TokenDetails/TokenDetails.tsx`, `AttachmentFields.tsx`, `StepDetails/StepDetails.tsx` | Compact core fields and quiet auxiliary actions; preserve hidden authored data. |
| Target and session commands | `state/authoring.ts`, `state/ui.ts` | Preserve source IDs, missing-target checks, moves, focus return and uncommitted field drafts. |
| Panel mounting | `AuthoringPanel/AuthoringPanel.tsx` | Fixed desktop overlay and stable phone modal seam. |
| Current width change | `InstructionEditor/editor.css:97` | Remove `.editor-layout:has(.authoring-panel)` two-column split; keep printed/reading colors independent of theme. |
| Gesture lifecycle/drop geometry | `state/editor-drag.ts`, `lib/editor-drop.ts` | New whole-picture touch policy and source/page interaction geometry; retain one-release commit, cancellation and accessible move parity. |
| Physical planning/configuration | `model/output.ts`, `lib/output-plan.ts`, `lib/output-options.ts`, `OutputDialog/output-request.ts` | Shared effective options, fixed measured bands, source-specific overflow and independent export consent. |

The component paths above are under `src/components/`; state/model/lib paths are under `src/`. Root should assign non-overlapping ownership before implementation.

## Targeted UI acceptance

- At 320/390/768/1440 px, both languages/themes and 200% text, picker/group/picture editing is reachable, controls fit their surface, and Close/focus return remain reliable.
- Opening/closing every desktop editor leaves the same page dimensions, zoom, picture boxes and row coordinates. Phone modal/keyboard and desktop/mobile transitions preserve zoom and field drafts.
- Add picture inserts into its captured group even after selection changes; missing/deleted targets cannot silently redirect insertion.
- Rename, quantity/custom-unit, duration and warning edits survive save/reload, Undo and JSON backup without changing unrelated authored/unknown fields.
- No picture six-dot control remains. Mouse drag, ordinary touch scrolling, the chosen finger-reorder route and accessible moves produce identical logical ordering; Escape/pointer cancellation/multi-touch/resize never commit a partial move or open details through a leaked release click.
- Continued groups, empty groups and mixed sequence/board cases retain source IDs and correct insertion order across pages.
- Editor physical SVG and final output have equivalent source, options, measured boxes and text. Auxiliary controls are absent from exports. Metadata within its reserved bands does not change subsequent row positions; excess required text produces a clear bounded failure with no clipping.

Synthetic browser gestures can validate controller and coordinate behavior. They do not substitute for actual touch-device evidence when adopting a new hold-and-scroll arbitration scheme.
