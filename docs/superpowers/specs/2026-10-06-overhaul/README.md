# Visual instruction overhaul agent specifications

**Date:** 6 October 2026. **Status:** Reviewed and authorized; local technical delivery, automated gates and final independent review passed. Practical release acceptance remains pending. This package defines the requested overhaul. See the [implementation report](../../../phase-3/audits/2026-10-06-overhaul/implementation-report.md) for delivered features, review status and pending acceptance; a specification alone does not establish implementation.

Build a practical tool for making visual reminders across language barriers, especially in kitchens and repetitive physical work. The same authoring tools must serve teachers, parents, nonverbal children, and people with cognitive disabilities. Prioritize understandable pictures, recoverable editing, and physical output from labels to large prints. Test child usability with the support customary for each participant.

## Confirmed product decisions

| Decision | Release requirement |
| --- | --- |
| Content libraries | Kitchen, Daily routines / workplace, and Learning / classroom |
| Languages | English and German app controls and default picture labels |
| Graphics | One consistent original vector pictogram system |
| Content types | Ordered instructions and picture-only routines; unordered choice boards |
| Saved work | A local **My guides** list with several guides; offline operation and JSON exchange |
| Physical use | Labels, cards, A4 guides, A3 prints, and custom physical sizes |
| Interaction | Direct tap/click and keyboard creation; dragging is optional |

Library selection chooses thematic content, not a different artwork system. App language and default-label language are separate preferences. Neither preference translates authored content. The app uses one document engine and one artwork resolver.

## Product flow

Open My guides, create a **Sequence** or **Choice board**, and start blank or from an example. A sequence has ordered steps; a board has picture groups without arrows or numbered instructions. Both use the existing tokens and attachments. A visible **Add picture** action opens a nearby searchable library. Selecting a placed picture exposes its label and deliberate **More details** controls. Read shows recipient content. **Print / Download** shows exact physical pages before export.

New examples and JSON imports create another guide by default. They do not replace the current guide. Closing the app retains every committed local guide. Local storage remains specific to the browser/device; the interface makes JSON backup discoverable.

## Specification map

| Agent package | Deliverable | Main dependency |
| --- | --- | --- |
| [00 Shared contracts](00-shared-contracts.md) | Schema, session, catalog, storage, and output contracts | Existing engine and maintenance |
| [01 Libraries and graphics](01-libraries-and-graphics.md) | Three palettes, accurate vector artwork, English/German text | 00 |
| [02 Local guides](02-local-guides.md) | Local list, save state, legacy migration, conflict/recovery | 00 |
| [03 Editor and reader](03-editor-and-reader.md) | Responsive authoring, ordering, semantic reading, board mode | 00 and 01; storage adapter from 02 |
| [04 Physical layout](04-physical-layout.md) | Measured physical composition, fonts, continuation and overflow | 00; artwork from 01 |
| [05 Export and preview](05-export-and-preview.md) | Exact preview, vector/raster formats, offline preparation | 01, 03, 04; storage actions from 02 |
| [06 Release acceptance](06-release-acceptance.md) | Integration checks, physical/user/device evidence, handoff | All packages |

Read the [dispatch and implementation plan](../../plans/2026-10-06-agent-implementation.md) for ownership, sequence, and checks. Each agent reads this index, shared contracts, and its own package. The [original audit](../../../phase-3/audits/2026-10-06-takeover-review.md) supplies reproduction evidence; the [maintenance report](../../../phase-3/progress/2026-10-06-reliability-maintenance.md) describes the fixes to preserve.

## Shared product requirements

- Controls are at least **44 × 44 CSS px**; ordinary authoring text is at least **16 CSS px**. At 320 CSS px and 200% text zoom, content wraps without shrinking the rest of the guide. A 20-picture group does not make another group's controls smaller.
- Use quiet neutral surfaces, one accent, consistent selection/focus, and clear text. Normal text targets **4.5:1** contrast; large text and meaningful control boundaries target **3:1**. Warnings use meaning and shape as well as color.
- Pictures retain vector paths in SVG/PDF. Default print labels are at least **10 pt**, secondary text **9 pt**, A6/A4 pictures **15 mm** in the shorter dimension, and A3 pictures **25 mm**. These are implementation starting values to verify in physical tests.
- Presets are **50 × 30 mm** labels, **105 × 148 mm** A6 cards, **210 × 297 mm** A4 sheets, and **297 × 420 mm** A3 large prints. Custom dimensions accept finite values from **20 to 1000 mm**. Printer-specific stock alignment is outside the release.
- Output modes are **Pictures + labels**, **Pictures only**, and **Detailed**. Only Detailed includes optional notes/descriptions. Structured warnings, quantities, and times remain in every mode; omission of optional text is explained before download.
- Preview, SVG, PNG, and PDF consume one physical output plan and the same document snapshot. No silent clipping, omission, glyph substitution, or global shrinking below the minimum.
- PNG supports **150 and 300 dpi**, with a **24 million pixel per page** allocation limit. Larger physical prints remain available through vector formats.
- All initial libraries, original artwork, and supported print fonts work offline after installation is ready. An update waits for old clients to close before deleting their version's cached lazy assets.
- Existing IDs, authored labels/notes, arbitrary quantity units, attachments, legacy repair, immutable history, JSON import, recovery copies, and stale-tab protection survive the overhaul.

## Chosen defaults and scope

Use the same simple flow for adults and children. Mobile editing uses one modal contextual sheet at a time, with explicit Close, Escape, focus return, and software-keyboard-safe scrolling; desktop uses an adjacent nonmodal panel. A prototype checks these choices before final styling. Do not claim the interface is child accessible solely from automated checks or large buttons.

English/German print coverage includes Latin accents. Other text remains accepted in editable documents. Unsupported glyphs block affected output with a clear explanation; Japanese remains an unsupported-font regression fixture for this release. Additional languages and right-to-left shaping need separate rendered acceptance before being advertised.

My guides is local, without accounts or a backend. Choice boards are structured grids of pictures/groups, without speech generation, arbitrary spatial placement, or a separate AAC document system. Fractional quantities, automatic translation, uploaded artwork, collaboration, gamification, and marketplaces remain outside this release.

Agents can implement and automate the technical acceptance cases. Human participation, actual prints, and real device/screen-reader observations remain explicit release work; agents must record pending evidence accurately.

## Review before execution

Review this index for product scope, then the packages relevant to your changes. Agent execution starts from the reviewed contracts and plan. Any interface change must identify dependent packages and update their tests/specifications before parallel workers use it.
