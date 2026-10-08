# Domain context

> 📌 **Doc status: CURRENT** — glossary for the running implementation; historical canvas terms are explicitly separated below.

Terms used consistently across `docs/` and `src/`, kept here so architecture
reviews and new contributors have one place to check a name's meaning
instead of reverse-engineering it from call sites.

**Current overhaul architecture, 8 October 2026:** the editor and physical output share fixed print geometry. The [print layout contract](docs/print-layout-contract.md) defines centered pictogram anchors, disjoint reserved field zones and orthogonal row connectors; future field/UI changes must preserve those invariants. See the [centered-pictogram acceptance record](docs/phase-3/audits/2026-10-07-centered-pictograms/README.md), [print-faithful editor handoff](docs/phase-3/audits/2026-10-07-print-faithful-editor/README.md) and [overhaul implementation handoff](docs/phase-3/audits/2026-10-06-overhaul/implementation-report.md) for verification and practical release status. The [architecture remediation](docs/phase-3/progress/2026-10-07-architecture-remediation.md) retires disconnected legacy implementations and consolidates maintained browser checks under `tests/browser`. The later canvas-era sections describe retired code, rather than the running editor/output flow.

## Document session

A **document session** is one editable `InstructionDocument` together with
its undo/redo history (`past`/`future`), its selection
(`selectedStepId`/`selectedTokenId`), and its token clipboard
(`copiedToken`) - everything one instance of the app has open at a time.
It's constructed by `createDocumentSession()` in
[src/state/document.ts](./src/state/document.ts).

The running app uses exactly one exported `documentSession`. Its editor/controller call `sessionActions` with that explicit session. Legacy zero-argument bindings (`document`, `addStep`, `undo`, ...) remain aliases to the same instance for retained code. Tests can construct independent sessions through `createDocumentSession()`; components never create a competing live session.

This term replaces the informal "module-level singleton" phrasing used in
[docs/known-issues.md](./docs/known-issues.md) while that item was still
open; see [docs/phase-2/progress/README.md](./docs/phase-2/progress/README.md)
for when it was resolved.

## Token clipboard

The **token clipboard** is a document session's single-slot, in-memory
holding area for one copied token (`copiedToken`) - a full deep copy of an
`InstructionToken`, including its `note`/`quantity`/`warning`/`time`, but
with a freshly generated `id`. Copying a token writes it here, overwriting
whatever was held before; pasting reads it and appends a further fresh-id
copy onto the currently selected step, and can be repeated indefinitely
without clearing the clipboard. It is session-only UI state, not part of
the document: it isn't saved, isn't part of undo/redo history, and doesn't
touch the operating system's real clipboard. Opening another guide clears it and all document history. JSON imports/examples create another local guide after a successful repository commit; they do not replace the user's existing guides.
Successful Copy announces its meaningful localized picture label inside the active details panel, including the native mobile modal. Invalid targets preserve the previous clipboard and produce no success announcement. See [P3 remediation](docs/phase-3/progress/2026-10-08-p3-remediation.md) for verification status.
_Avoid_: "copy buffer", "system clipboard" (this is never that).

## Guide and local repository

A **guide** is a schema-2 document with `meta.presentation` equal to `sequence` or `board`. Sequences express ordered steps; boards express choices without procedural numbering, connectors or summed alternative times. The persisted domain is authored data, independent of library/language preferences. A guide's versioned IndexedDB envelope has an identity and revision. Repository transactions compare both revision and the raw loaded baseline; conflict preserves the local draft for backup and explicit reload. Unreadable records are copied exactly before fallback, and deletion uses a revisioned tombstone. See [recovery](docs/persistence-recovery.md).

Storage policy declares exact keys or a bounded prefix before its synchronous callback runs in one native IndexedDB transaction. Generated guide/recovery identities use insert-only `add`, while updates use `put`; results, baselines and notices advance after commit. Keyed operations avoid unrelated retained data, and listing scans only the guide prefix. Recovery import uses an exact readonly key. Preference writes merge retained local patches into the latest stored record atomically. Explicit startup retry resumes incomplete initialization without replacing a changed local draft or clearing active conflict/deletion blockers; preference retry is independent. See the [reliability remediation](docs/phase-3/progress/2026-10-07-reliability-remediation.md).

Imported schema 1/2 group and picture IDs must be nonempty strings; every nonempty value, including whitespace, is retained exactly. Rejection precedes activation, and invalid stored records retain exact originals/recovery copies. See [functional remediation](docs/phase-3/progress/2026-10-08-functional-remediation.md).

## Library and picture

A **library** selects canonical catalog entries for Kitchen, Daily routines/workplace or Learning/classroom. Entries share stable global IDs and original SVG artwork. Preferences select app language and default-label language independently; neither translates authored content. Product controls say **picture**; source models retain `InstructionToken`. Unknown imported pictures/warnings keep their authored meaning and named fallback. See [catalog and provenance](docs/content-libraries.md).

## Authoring and recipient reading

The **editor** renders `OutputPlan` SVG pages with identity-bearing HTML hit regions from `EditorLayout`. Physical cells, caption/detail lanes and row pitch stay fixed; panel/viewport changes never resize them. A4 portrait is the default; paper format/orientation and explicit zoom control the view. Required content that exceeds its reserved lane blocks export and retains current-source repair targets. Add picture lives at each group header, with an unscaled group rail for compact formats. Whole-picture mouse/pen and desktop-library dragging resolve live rectangles to original indices by stable anchors, including continuations. Touch Move picture arms the whole tile before the next gesture; ordinary tiles scroll normally. Cancellation preserves document/history; a valid release commits one action. Quiet Actions retain keyboard movement, copy/paste and deletion. **Read** uses a semantic projection from `projectOutputContent`, with one named accessible item per picture and required quantity/warning/time in every mode. Its pure `ReadingContent` is also used by output preview; Read contains no authoring canvas.

Choice-board editor groups use unordered lists, including blocked and continued pages; sequences retain ordered groups. Read and semantic preview display localized review notices for unresolved quantity, picture-time and explicit group-time icon references, retaining full IDs and authored values. See [P3 remediation](docs/phase-3/progress/2026-10-08-p3-remediation.md).

## Contextual panel and native modal

Successful user-driven navigation focuses Guide title in the editor, Back to editing in Read, or the My guides heading. Deferred entry focus checks the current view and guide and yields to an open native dialog; unrelated renders do not request it. Leaving Read retains the existing selected-picture/group focus policy.

Below 768 CSS px, picker/details use one native modal sheet; desktop uses a fixed nonmodal overlay that consumes no canvas layout column. Settings, import and output use native modal containment. A desktop draft stays mounted behind the inert modal; only the top modal handles Escape. Opening output or resizing open output to mobile closes the prior contextual sheet. Closing returns focus to a surviving opener. Committed Undo/Redo/removal/reload changes reconcile attachment fields; unrelated renders and desktop/mobile remounts retain target-scoped attachment drafts. Prepared fonts survive editor/reader switches and recover after a successful retry, preserving focus and current printable geometry.

The user chose automatic saving for valid picture/group details edits, with incomplete input visibly marked. Implementation is pending: labels, warnings and notes currently save immediately, while quantity/time still use separate Save buttons.

## Physical plan and captured output

The user chose prominent size, orientation, content mode, preview and PDF controls for Print / Download, with background, headings, group selection, DPI and alternate formats in named collapsed sections. This simplification is awaiting implementation.

An **OutputPlan** is the finite millimeter display list produced by the shared physical planner, using measured Source Sans 3 glyph runs. Editor, preview and SVG/PNG/PDF consume the same pages; none rewrap or add a separate heading. Printed text uses vector outlines, with its search/copy limitation disclosed in [print fonts](docs/print-fonts.md). Session-scoped per-guide print choices feed editor and captured output; selecting all groups includes future groups, while explicit subsets remain revealable. A captured request owns a cloned document/options and generation; source edits require explicit Refresh, and close/guide switches discard pending results. JSON backup remains independent of physical selection/preflight and requires no print font/converter preparation.

Unknown main-picture identity and authored label share one measured `context` caption flow in the fixed lane. PNG files replace existing density metadata with one `pHYs` chunk declaring selected 150/300 DPI (5906/11811 pixels per metre), preserving decoded pixels and every other native chunk. Pixel rounding and the 24M limit remain unchanged. See [functional remediation](docs/phase-3/progress/2026-10-08-functional-remediation.md) for implementation and verification status.

## Offline build

The recursive build manifest includes the shell, all libraries, bundled font/license and lazy converters. A waiting update retains the old client's assets until its last tab closes, then activates and cleans only obsolete product caches. The public `/fonts/` Vary exception is scoped like `/assets/` and `/icons/`; private responses retain their Vary semantics. Production cold/update checks are separate from development browser tests.

## Historical canvas-era terms

The following entries document retired legacy components and their historical decisions. Their source links point to the pre-remediation snapshot. They are useful when reading earlier reports. Current authoring, modal, movement and output behavior is defined above and in the reviewed [specification package](docs/superpowers/specs/2026-10-06-overhaul/README.md).

## Field popover

A **field popover** is the small floating panel a collapsed field's edit
form renders in - the four day/hour/minute/second boxes behind "+ Time",
or the amount/unit pair behind "+ Quantity". It is anchored to the trigger
button that opened it, and it floats above the layout rather than
expanding inside it, because a **collapsed field**'s own footprint must
never change just because its form opened: Token time and Quantity sit in
one row, and either one growing in place shoves the other sideways
mid-edit. See
[src/components/FieldPopover/FieldPopover.tsx](https://github.com/P-Leidel/instruction_builder_v2/blob/3a4b67acf7f246419053c7d7f02ff1b45f196c43/src/components/FieldPopover/FieldPopover.tsx)
for the panel and
[src/components/CollapsedField/CollapsedField.tsx](https://github.com/P-Leidel/instruction_builder_v2/blob/3a4b67acf7f246419053c7d7f02ff1b45f196c43/src/components/CollapsedField/CollapsedField.tsx)
for the collapsed/edit-toggle chrome around it.

It is deliberately **non-modal**: nothing behind it is inert, there is no
backdrop, Tab moves out of it normally, and Escape or a click outside
closes it. Which of the four positions it takes around its trigger
(below or above, left- or right-aligned) is **field placement**, decided
by `resolveFieldPlacement` in
[src/lib/field-placement.ts](https://github.com/P-Leidel/instruction_builder_v2/blob/3a4b67acf7f246419053c7d7f02ff1b45f196c43/src/lib/field-placement.ts) and applied as a
CSS modifier - the arithmetic is kept out of the panel itself so it can be
tested without a browser. _Avoid_: "modal", "dialog", "tooltip" (it is
none of these).

## Confirm dialog

A **confirm dialog** is the app's modal counterpart to the field popover:
the centered panel, over a backdrop, that asks the user to approve
replacing the whole document before it happens. There are exactly two -
Import's "Replace current document?" and New document's "Start a new
document?" - and they share one shell,
[src/components/ConfirmDialog/ConfirmDialog.tsx](https://github.com/P-Leidel/instruction_builder_v2/blob/3a4b67acf7f246419053c7d7f02ff1b45f196c43/src/components/ConfirmDialog/ConfirmDialog.tsx),
with each caller supplying only its own wording and its own go-ahead.

The term exists because this app now decides modality in opposite
directions in two places, and "dialog" alone no longer says which. Calling
something a confirm dialog is a commitment to all four of these, not a
description of how it looks:

- `aria-modal="true"` alongside `role="alertdialog"`.
- Everything outside it is `inert` while it is open, so neither Tab nor a
  screen reader in browse mode can reach the page behind it.
- Escape closes it from anywhere, not only while focus is inside it.
- Closing it returns focus to whatever opened it.

Notably **not** part of it: a hand-written Tab cycle between the dialog's
own controls. Focus containment is a consequence of the page behind being
inert, and a second mechanism enforcing the same rule is what made the
field popover's old `aria-modal="false"`-plus-Tab-trap contradict itself.

_Avoid_: "popover", "modal" on its own (this app has exactly one modal
pattern and one non-modal one - name which), "alert" (that is the toast).

## Canvas point

A **canvas point** is a position in the canvas's own design units - the
coordinate space `computeCanvasLayout` returns every `cardY`, `cx` and `cy`
in, and the space all drop resolution happens in (`CanvasPoint` in
[src/lib/canvas-layout.ts](https://github.com/P-Leidel/instruction_builder_v2/blob/3a4b67acf7f246419053c7d7f02ff1b45f196c43/src/lib/canvas-layout.ts)).

It is deliberately not a client coordinate. The `<svg>` canvas is scaled by
its `viewBox`, scrolled inside its container, and zoomable independently of
the page, so the two spaces agree only by accident. Exactly one function
converts between them: `clientToCanvasPoint` in
[src/lib/pointer-drag.ts](https://github.com/P-Leidel/instruction_builder_v2/blob/3a4b67acf7f246419053c7d7f02ff1b45f196c43/src/lib/pointer-drag.ts), composing the
element's `getScreenCTM()`. That call and the clipping check beside it
(`isInsideViewport`, which decides whether the point is somewhere the canvas
can actually be seen) are the only two DOM reads left in the drag path.

_Avoid_: calling a client pixel a canvas point, or vice versa. Name which
space a coordinate is in whenever both are in scope.

## Drop target / drop slot

A **drop target** is where a dragged token would land: a step id plus a
drop-before index within that step's tokens (`TokenDropTarget` in
[src/lib/canvas-layout.ts](https://github.com/P-Leidel/instruction_builder_v2/blob/3a4b67acf7f246419053c7d7f02ff1b45f196c43/src/lib/canvas-layout.ts)). It is the whole
instruction a move needs - `moveToken` and `addTokenToStep` take exactly
this and nothing more.

A **drop slot** is a drop target plus the row of chips the pointer read as
being in (`TokenDropSlot`, which extends it). The row is redundant for
performing the move and essential for previewing it: on the wrapped desktop
layout, one drop index means two different places on screen at a row
boundary - index 6 on a 6-per-row step is both "after the last chip of row
0" and "before the first chip of row 1" - and the live insertion marker has
to pick one. The `dropTarget` signal
([src/state/drag.ts](https://github.com/P-Leidel/instruction_builder_v2/blob/3a4b67acf7f246419053c7d7f02ff1b45f196c43/src/state/drag.ts)) holds a drop slot for that
reason; the narrower drop target stays what the document mutators consume.

`ChipSlot`, in the same module, is the step-less half of that pair: an
index and a row within *one* step's chips, which is what the resolver
produces before a step id is attached to it, and what
`insertionMarkerPosition` takes. It is deliberately not called a drop slot,
so that term keeps naming exactly one type.

Both are resolved by `resolveDropTarget` from a **canvas point** against the
same `CanvasLayout` the canvas was rendered from - never by hit-testing the
element under the pointer, and, since 2026-09-20, never by measuring a
rendered chip either. Two properties follow, and both are load-bearing. The
gap between two chips has no element of its own, so a hit-test has nothing
to report there, whereas a scan over positioned hit boxes always resolves
every point inside a step to some slot. And a chip's hit box is exactly
`CHIP_WIDTH` by `CHIP_HEIGHT` whatever that chip draws inside itself, so
attaching a time or a quantity to a token cannot shift the slot boundaries
around it - which measuring the rendered box did do. See
[the write-up](./docs/phase-3/progress/architecture-2026-09-20-layout-hit-testing.md)
for what that cost and how it was found.

_Avoid_: "drop zone" (nothing in this app highlights a region as droppable -
every point inside a step resolves to a specific slot), and using "drop
target" for the *step* being hovered (that is the step, which the step card
marks with its own `--drop-target` class).
