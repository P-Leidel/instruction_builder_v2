# Task 4 independent review — changes requested

Reviewed frozen range **9919893..bcdb541**, including the verbatim-license correction. Reviewer: `/root/import_hardening` (Task 2 author, independent of Task 4). No production or Git mutations, child agents, or broad gate reruns. The supplied diff was read once; its transport truncated large artifact sections, so named composition/font/proof sources and tests were inspected at `bcdb541`. Later catalog/storage commits are outside this review. The probed production files and migration helper have no changes relative to that frozen head.

## Actionable findings

### [P2] Preserve required numeric attachment meaning when its stored display label is blank

**Locations:** `src/lib/output-plan.ts:65`, `:70`, and `:98`.

A validated document can contain `{ amount: 2, unit: "cups", label: "" }`, token `{ seconds: 60, label: "" }`, and explicit group `{ seconds: 120, label: "" }`. Migration accepts these records, preserving their positive numeric fields and string labels. The composer uses those labels verbatim; the group expression uses `??`, which also retains an empty string. Planning succeeds in Pictures, Pictures + labels, and Detailed, but quantity and both duration text fragments are empty. Only generic attachment symbols remain. Disabling total-time metadata makes the group time invisible as well. Thus required value/unit/time content silently disappears from otherwise successful output.

**Requirement/impact:** Spec 04 “Typography, metadata, and selected content” requires structured quantity value/unit and token/group time in every mode, independently of metadata. Blank stored display labels are within the preserved import contract; this must be resolved in composition without changing the document or rejecting older imports.

**Minimal fix:** Preserve a nonblank stored display label, but fall back to formatting the structured quantity amount/unit or duration seconds when it is blank (including whitespace-only labels). Apply the same policy to explicit group time. Add all-mode regressions with valid blank labels and total-time metadata disabled; keep authored document data unchanged.

### [P2] Avoid attributing a later oversized unit to the row's first token

**Location:** `src/lib/output-plan.ts:81-84`.

Each row captures the first token as its source, while its height is the maximum of all unit heights. When the second token carries an unfit required warning, the planner correctly fails, but reports `source.tokenId: "fits"` for the first, fitting token rather than the oversized second token. The source is then consumed by the first-row/continuation overflow paths. Existing oversized-warning coverage only makes the first token oversized and misses this case.

**Requirement/impact:** Spec 04 “Composition and continuation” requires an actionable overflow for the source group/token when a required unit or row cannot fit. A supplied token ID for an unrelated fitting unit directs recovery/highlighting at the wrong picture.

**Minimal fix:** Track the height-determining unit's source while constructing the row, or emit only the group source for an aggregate row failure instead of a misleading token ID. Keep correct token sources for individual unit impossibility and test an oversized later column, including continuation handling.

## Focused reproduction

Review artifacts: `task-4-review-probe.test.ts` and `task-4-review-probe.config.mts` in this directory. They do not edit or replace production tests.

`npm test -- --config .superpowers/sdd/2026-10-06-agent-implementation/task-4-review-probe.config.mts` at **17:13 Europe/Berlin, 2026-10-06** — exit **1**, **4 cases failed**. The three mode cases each confirm empty quantity, token-time, and explicit-group-time text (nine failed soft assertions). The fourth confirms that an oversized second token is reported as the fitting first token. `git diff bcdb541 --` the probed planner/options/font adapters/text layout/migration sources returned no delta.

## Other reviewed requirements

No further actionable issue was found in preset/custom dimensions and orientation, finite physical grids, selected order/captured options, pure viewport-independent planning, shared projection use, board procedural omissions, whole label/card failures, continuation at complete row boundaries, warning roles/fallbacks, selected duration totals, supported-glyph preflight, or identical measurement/outline paths. Font preparation validates the bundled face's hash/revision/coverage, waits for browser readiness, memoizes success and retries failures. The bundled Adobe font has its local OFL/copyright notice and fixed upstream provenance; `.gitattributes` preserves PDF and literal license bytes.

The actual four-renderer/22-line comparison, canonical artwork inspection, and cold first-use offline isolated production proof were already inspected and cleared by root; this review inspected their implementation/evidence and did not repeat those renders. Recorded full 411/type/lint evidence and subsequent integrated 416/build evidence remain valid for their snapshots. Outlined PDF text's lack of search/copy is explicitly documented, with semantic reader/plan text retained. Actual prints, recipient comprehension, and physical/device acceptance remain pending release evidence, not technical failures of this package.

**Verdict:** Request the two scoped composition fixes and independent re-review before Task 5 consumes the frozen package. Font preparation/proof strategy is accepted.
