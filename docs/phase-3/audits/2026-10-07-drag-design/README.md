# Drag and drop restoration and final spacing sweep

**7 October 2026.** The user requested restoring drag and drop, followed by a desktop/mobile spacing and design sweep. The responsive HTML editor had replaced the legacy SVG canvas and explicitly deferred drag; its picture/group controls had no pointer drag handlers. This refinement restores the convenience in the running editor while retaining complete tap and keyboard alternatives.

## Delivered behavior

- Drag a picture with a mouse or pen to reorder it or move it into another group, including an empty group. On a phone, drag its six-dot handle; ordinary picture touches continue to scroll the page.
- Drag a group's heading handle to reorder groups. Clicking/tapping a handle or activating it with Enter/Space opens the existing move controls.
- Drag a picture from the desktop library into the actual marked destination. The mobile library remains a contained modal with tap-to-add.
- Before/after markers, an empty-group outline and a floating label show the target. Document scrolling near the screen edge keeps long guides reachable. Live CSS-pixel geometry is recalculated during scrolling/resizing and on release.
- One valid release commits one session action. IDs and attachments survive moves; Undo/Redo and local saving remain available. Own-position and invalid drops make no document/history change. Escape, pointer cancellation, lost capture, blur and editor/document changes cancel the gesture. The cancelled release cannot accidentally open details or insert a library picture; the next intentional click still works.
- An open picture panel follows a successful cross-group move. Drag handles are anchored inside the picture tile, above unknown imported-picture/warning review notices.

The spacing sweep makes editor/picker grids fit two columns at normal phone text sizes, removes redundant nested panel padding, separates headings/actions, and tightens Settings and output-control spacing. All controls retain at least 44 px hit areas. Document/reading/paper colors and physical exports remain independent of interface themes. There is no new top-level menu.

## Verification and evidence

Fresh commands were run against the finished product source. Testing used isolated browser profiles and temporary servers; the user's guides/settings and development server were not modified.

| Check | Result |
| --- | --- |
| Unit suite | 543 tests in 38 files passed, including 56 insertion-geometry cases |
| Tooling suite | 7 tests passed |
| ESLint / TypeScript / production build / whitespace check | Passed |
| Existing browser acceptance | 271 named checks plus storage/recovery gates passed |
| [New drag acceptance](browser/editor-drag/results.json) | 30 strict checks passed; errors empty |
| [Spacing sweep](design/README.md) | 80 layout cases; EN/DE, light/dark, 320/390/768/1440 px; no overflow/undersized controls/errors |
| Imported-picture handle correction | 6 cases passed, errors empty |
| Theme/output invariance | All 16 SVG hashes and 80 sampled document-color comparisons match the clean spacing baseline |
| Cold offline output | 45 checks / PDF, PNG, SVG and JSON passed |
| Waiting-update acceptance | Synthetic and actual old/new first-offline-PDF proofs passed |
| [Independent review](review.md) | Original findings preserved; cancellation/notice corrections approved with 15 passing assertions |

The new drag checker is included in `npm run test:browser`, bringing the browser gate to **301 named checks** plus real storage/recovery checks. The preexisting adapter completed before the final checker was added; the same final-source drag checker then completed separately in `browser/editor-drag`. This records the actual verification boundary without claiming an unnecessary repeated adapter run.

The rebuilt shell contains 432 transformed modules, a 450.60 kB main bundle (127.06 kB gzip), and 16 offline assets using cache `instruction-builder-v2-77c2da7433150c89`. The user-facing development server remained available at `http://127.0.0.1:5173/`.

Reproduce from the repository root using a supported Node runtime:

```powershell
npm test
npm run test:tooling
npm run lint
npm run typecheck
npm run build
npm run test:browser -- artifacts/drag-design/browser
npm run test:pwa -- artifacts/drag-design/pwa
```

The [initial failing check](red/results.json) confirms missing picture drag handles before implementation. [Pure geometry tests](../../../../src/lib/editor-drop.test.ts) cover wrapped rows, unequal heights, before/after gaps, empty targets, original insertion indices and invalid geometry. The design index preserves representative before/after screenshots and reproducible sweep scripts. The review retains its original cancellation finding and the approved correction rather than replacing the record with a green-only summary.

The [mobile input diagnosis](diagnostics/README.md) also preserves an intermediate driver failure: after a low-level synthetic CDP scroll, Chromium omitted a later click even on a plain HTML control with no app code. Fresh picker taps passed through both drivers. The final checker verifies picker tapping before that synthetic scroll, with scrolling last; no product click workaround was added.

## Remaining practical acceptance

Headless Chromium touch events verify the browser pointer path; they are not physical iOS/Android or assistive-technology acceptance. Continue the existing [creator/recipient and actual-device trials](../2026-10-06-overhaul/creator-and-recipient-tasks.md) before release. Reload persistence is checked after the app reports Saved; this refinement does not promise completion of an IndexedDB transaction during immediate page termination.

No push, merge or deployment was performed.
