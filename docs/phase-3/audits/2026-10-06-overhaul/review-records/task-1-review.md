# Task 1 independent review — one P2 correction

Reviewed frozen head `34863d1` against task-1-brief, global constraints, specs 00/01, author report, and the supplied `cfa9f4a..34863d1` review diff. The diff was read once; transport truncated middle sections, so missing named catalog/provenance/test sections were inspected directly at the frozen Git head. No production/Git edits or repeated full gates were made.

## Finding

**[P2] German sharp-s is not case-folded in search — `src/lib/library-catalog.ts:20`.** The normalizer uses NFKD, accent removal and `toLowerCase()`. Lowercasing leaves `ß` unchanged, so the actual German catalog label `Heiß!` normalizes to `heiß!`, while query `HEISS` normalizes to `heiss` and returns no matching Hot warning. Spec 01's Catalog/search rules require Unicode normalization, case folding and accent-insensitive matching. This affects discovery in the shipped German palette, especially typing without a sharp-s key. Minimal fix: fold `ß` to `ss` after lowercasing, and pin selected-language `HEISS` / `heiß` search alongside the existing `KÜHLEN` / `kuhlen` cases. Keep locale isolation and source order unchanged.

Read-only targeted reproduction of the exact normalizer returned `{ label: "heiß!", query: "heiss", matches: false, umlaut: true }`; this is an observed search-comparison defect, not a speculative requirement.

## Compliance and quality checks

- All 140 canonical entries, required categories, exact English/German labels and seeded aliases match 01. The 84 legacy Kitchen IDs/English labels/order remain unchanged; quantity/time are canonical and absent from insertion grids.
- Library order, own/shared/cross-reference order, global shared object identity and deep-frozen label/alias references are correct. Palette counts are 95/39/46. Search otherwise filters categories first, collapses whitespace, requires all words, preserves order, deduplicates canonical IDs and reads only the selected language.
- Resolver/legacy adapter use bundled eager SVG sources and Maps; imported text cannot become SVG markup. Prototype-like IDs resolve as unknown. The neutral question tile is visible through `Icon`, whose decorative `aria-hidden` contract is preserved. Canonical and fallback artwork follow the shared presentation; structural tests cover every source.
- Warning meaning preserves nonblank authored text, otherwise a known warning label, otherwise the localized named unknown warning, including non-warning IDs. Downstream warning-role/review notices are correctly left to consumers.
- Both whole-message tables and exact generic parameter contract are complete, parameter-parity fixtures are present, interpolation uses text values and explicit locale, and unknown/missing/wrong-param compile fixtures are meaningful. Legacy suggested unit values remain unchanged; bilingual suggestions do not transform arbitrary authored units.
- All three localized examples match the specified pictures/groups, sequence/board intent, knife warning and optional sequence details; each construction generates fresh document time/step/token IDs without modifying a saved guide.
- Provenance resolves all canonical paths. `LicenseRef-Original-Project-Work` records the actual pending distribution-license status and does not invent a license or rights grant. Reproducible contact/bounds tools and complete inventories are present.

Root already inspected all six contact PNGs and cleared Count's abacus correction; this review does not repeat or inflate that evidence. Recipient comprehension, calibrated physical prints and the owner licensing decision remain accurately documented release evidence, not additional technical findings.

**Verdict:** correct the single search case-folding defect, then approve Task 1. No other actionable compliance or quality issue found. Existing current full409/type/lint/build evidence supplied by root remains applicable outside this concrete search correction; its author should run focused search tests after the fix.
