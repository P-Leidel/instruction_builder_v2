# Mobile picker tap diagnosis

The picker accepts a native touch tap in a fresh mobile context. The failure is caused by Chromium click synthesis after the check driver's low-level CDP touch gesture sequence. A static HTML control reproduces the missing click with no application code loaded.

Every application case used a fresh isolated Chromium context with a 390 × 900 viewport, `isMobile: true`, `hasTouch: true`, and English locale. Production source and user browser profiles were untouched.

| Application sequence before picker tap | Tap driver | Apple inserted |
| --- | --- | --- |
| Fresh context | Playwright `.tap()` | Yes |
| Fresh context | CDP touch start/end | Yes |
| CDP picture drag | Playwright `.tap()` | No |
| CDP picture drag, then pointer cancellation | Playwright `.tap()` | Yes |
| CDP ordinary page scroll | Playwright `.tap()` | No |
| Original drag, screenshot, cancellation, backup downloads, scroll sequence | Playwright `.tap()` | No |
| Original sequence | CDP touch start/end | No |
| Original sequence | CDP touch start/end with a new touch ID | No |

For failed taps, the Apple button received trusted `pointerdown`, `touchstart`, `pointerup`, and `touchend` events through both capture and bubble phases. None were prevented. No click event reached the window capture listener, and runtime instrumentation recorded no prevention or propagation suppression calls during the tap. CDP listener inspection found no lingering application drag release listener. The modal and pointer coordinates were valid. Switching input drivers or touch IDs did not restore click synthesis.

The static control uses a plain scrollable page, a native dialog, and a button with an ordinary click handler. After rendering settles, it sends one CDP touch move from `(100, 500)` to `(100, 200)`, ends the gesture, and waits for five stable scroll frames. It opens the dialog with a mouse click and taps its button.

| Static HTML control | Button clicked |
| --- | --- |
| Fresh native tap | Yes |
| Tap after CDP scroll | No |
| Tap after CDP scroll plus 500 ms | No |
| Tap after CDP scroll plus 1000 ms | No |

The static failure has the same unprevented pointer/touch events and absent click. This isolates the failure to browser/input gesture state established by the synthetic scroll. The exact Chromium internal suppression mechanism has not been established; the evidence does not support changing the picker or drag controller to manufacture clicks.

The minimal check correction is to verify the modal picker tap before the low-level CDP scroll case, then run scrolling as the final mobile case. Alternatively, run picker activation in its own fresh mobile context. Keep the original failure evidence and this comparison with the acceptance results. These Chromium checks do not establish physical-device release acceptance.

Evidence:

- `touch-picker-results.json`: full application capture/bubble event traces, prevention call stacks, element geometry, document state, and CDP event listener inspection for all eight cases.
- `static-touch-results.json`: independent static control traces for all four cases.
- `touch-picker-diagnosis.mjs` and `static-touch-control.mjs`: reproducible isolated diagnostic drivers.
- The original failing acceptance trace remains in `../proof/touch-diagnostics.json`.
