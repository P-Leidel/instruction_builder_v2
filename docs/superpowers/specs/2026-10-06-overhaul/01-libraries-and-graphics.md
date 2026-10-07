# Libraries, original pictograms, and bilingual text

**Owner:** Catalog/artwork/localization agent. **Dependencies:** [README](README.md) and [00 Shared contracts](00-shared-contracts.md). **Status:** Specification; no product implementation is authorized by writing this document.

Deliver Kitchen, Daily routines / workplace, and Learning / classroom as offline thematic palettes using one original vector drawing system. Every available meaning has English/German default labels and recognizable artwork; a stock icon's availability does not justify substituting an unrelated object. The inventories below are minimum deliverables, to refine through recorded comprehension tests without silently removing compatibility IDs.

## Ownership and handoff

| Owned production files | Responsibility |
| --- | --- |
| `src/data/catalog-entries.ts`, `src/data/libraries/kitchen.ts`, `src/data/libraries/routines.ts`, `src/data/libraries/learning.ts`, `src/data/libraries/index.ts` | Canonical entries, palette references, immutable ordering, `CONTENT_LIBRARIES` |
| `src/data/guide-examples.ts`, `src/data/guide-examples.test.ts` | Localized blank/example creation inputs using the shipped canonical artwork |
| `src/lib/library-catalog.ts`, `src/lib/library-catalog.test.ts` | Exact shared catalog/search/resolver exports |
| `src/assets/pictograms/*.svg`, `src/data/artwork-provenance.ts`, `src/data/icon-library.ts`, `src/data/icon-library.test.ts` | Original paths, source/license records, resolver compatibility |
| `src/data/sample-tokens.ts`, `src/data/units.ts`, `src/lib/quantity-units.ts`, `src/lib/quantity-units.test.ts` | Legacy vocabulary adapter; suggested units without restricting authored units |
| `src/components/Icon/Icon.tsx` | Shared decorative SVG adapter using known/fallback artwork |
| `src/i18n/messages.ts`, `src/i18n/en.ts`, `src/i18n/de.ts`, `src/i18n/messages.test.ts` | Typed message/parameter contract and both complete message tables |
| `docs/content-libraries.md`, `docs/artwork/` | Inventory/provenance register, review contact sheets and observed limitations |

Foundation owns `src/model/library.ts`, `src/model/preferences.ts`, document/schema/validation files and contract fixtures. Storage owns preference persistence/signals. Editor owns picker/details/quantity form, reader, `src/state/ui.ts`, `src/app.tsx`, and global CSS. Export owns physical renderers/offline assets. Supply their integration requirements; do not edit their files in parallel. Shared `Icon` remains decorative (`aria-hidden`); named enclosing buttons/read content carry accessible meaning.

## Catalog, search, and content rules

Implement the exact `CatalogEntry`, `ContentLibrary`, `ResolvedIcon`, `getLibrary`, `getCatalogEntry`, `findLibraryEntries`, and `resolveIcon` contracts in 00. `CONTENT_LIBRARIES` order is kitchen, routines, learning. English → German names are **Kitchen → Küche**, **Daily routines / workplace → Alltag / Arbeitsplatz**, and **Learning / classroom → Lernen / Klassenzimmer**. Every entry has both label keys and both alias arrays; an alias array may be empty. Category is the existing `TokenCategory`, never a new model category.

Implement `getWarningMeaning` from 00 and add typed `catalog.unknownWarning` with `{ iconId: string }`: **Unknown warning ({iconId}) / Unbekannte Warnung ({iconId})**. Unknown attachment artwork with an authored label retains that label and warning role; without one it uses this named warning fallback, not an ordinary unknown-picture name. Fixtures include both cases and a known warning with an absent label.

All palette references point to canonical entries. An ID has one category, meaning, label pair, and artwork globally, even when it belongs to several palettes. `getCatalogEntry` also covers `quantity.amount` (**Quantity / Menge**) and `time.duration` (**Time / Zeit**) for attachment names; these are form-created values rather than fixed amount/duration presets. Exclude quantity/time from ordinary insertion grids; editor separately consumes warning entries for attachment choices.

Search combines the selected locale's label and explicit aliases, uses Unicode normalization, case folding, and accent-insensitive matching (`Kühlen` matches `kuhlen`). Trim/collapse query whitespace; require each query word to match the combined normalized text. Empty query returns the selected category/all entries in catalog order. Category filtering applies before matching. Return each canonical ID once, preserve catalog order, and return an explicit empty array for no matches. Do not silently search another language; put desired borrowed words in that locale's aliases.

Seed aliases include `object.onion`: en `onions`, de `Zwiebeln`; `tool.fridge`: en `refrigerator`, de `Kühlschrank`; `routines.object.bin`: en `trash`, `rubbish`, de `Mülleimer`, `Abfall`; `routines.action.wash-hands`: en `hand washing`, de `Händewaschen`; `learning.tool.pencil`: en `pen`, de `Stift`; `learning.action.tidy`: en `put away`, de `wegräumen`; `shared.action.finished`: en `done`, de `erledigt`; `shared.action.help`: en `assistance`, de `Unterstützung`. Search spelling alternatives aid discovery without changing the symbol's meaning.

Insertion copies `entry.labels[labelLocale]` into authored text. Preference/palette changes do not change placed labels, attachments, selection, or history. Mixed-library guides resolve every symbol independently. No bulk relabel/translation action belongs to this release. Reader/editor accessible naming uses nonempty authored text, otherwise the canonical localized meaning, otherwise a localized unknown-symbol message including the stored ID. A deliberately hidden visual label still has an accessible name.

## Original vector and compatibility requirements

Retain all **84** legacy Kitchen IDs below and their English labels: 30 actions, 43 objects, 9 tools, 2 warnings. Keep legacy `SAMPLE_TOKENS: SampleToken[]`, `CATEGORY_LABELS`, `QUANTITY_ICON_ID`, `TIME_ICON_ID`, `ICON_VIEW_BOX`, `ICON_PRESENTATION_PROPS`, and `iconMarkup(iconId): string | undefined` available until consumers migrate. `SAMPLE_TOKENS` retains the original 84 IDs/order rather than automatically adding new Kitchen references. English compatibility exports do not drive the bilingual UI. Unknown legacy `iconMarkup` returns undefined; new consumers use `resolveIcon`'s neutral vector question-mark tile and `known: false`.

Replace all offered artwork with original SVG paths, including legacy mappings. Onion is an onion; pan is a pan; oven is an oven. Garlic, tomato, potato, cheese, bread, salt, pepper, sugar, rice, pasta, butter, honey, chocolate, mushroom, corn, avocado, cucumber, cabbage, and yogurt require distinct meaningful pictures. Fry/bake, rinse/boil, oil/pour, and tool thermometer/hot warning must communicate their different meanings. Retaining an ID does not require retaining its misleading stock artwork. Never use a generic utensil or copied neighboring picture as an unnoticed production placeholder.

Use viewBox `0 0 24 24`, outer `fill="none"`, `stroke="currentColor"`, stroke width **2**, round line caps/joins, and geometry within 2–22 so strokes remain inside the box. Scale geometry/strokes uniformly with the pictogram; no fixed screen-size stroke effect. Use paths and SVG geometric primitives, without embedded text/fonts, scripts, remote references, bitmap images, or effects that disappear in PDF. Warning silhouettes and action/object distinctions must survive grayscale, 8 mm small-icon inspection, 15/25 mm print inspection, and enlargement. 8 mm is a drawing stress test, not a claim that every picture is usable at that size.

`resolveIcon` and `Icon` use the same trusted bundled inner markup. Unknown tokens **and unknown attachments** remain visible, retain their stored IDs/authored text, and generate review notices in downstream consumers. The fallback is a neutral rounded outline plus question-mark paths, distinguishable from the warning artwork. New output consumers use `known` to report review, never to discard a token. No imported JSON string is parsed as SVG.

Provenance records contain `id`, `iconIds`, source file paths, creator/origin, creation date, license identifier/text path, and review status. `provenanceIds` resolves to these records. Record the actual license rather than inventing a rights grant; retain existing dependency notices while stock assets remain in use. The release record must establish intended app distribution and exported-print/file use. Include a contact sheet with IDs, bilingual labels, and original paths for semantic review; record confusions and corrections separately from structural SVG checks.

## Complete Kitchen label inventory

Category follows the legacy ID prefix. Preserve existing English labels exactly; use these German defaults.

| ID | English | Deutsch |
| --- | --- | --- |
| action.chop | Chop | Hacken |
| action.slice | Slice | In Scheiben schneiden |
| action.stir | Stir | Rühren |
| action.whisk | Whisk | Verquirlen |
| action.mix | Mix | Mischen |
| action.knead | Knead | Kneten |
| action.bake | Bake | Backen |
| action.fry | Fry | Braten |
| action.roast | Roast | Rösten |
| action.boil | Boil | Kochen |
| action.simmer | Simmer | Köcheln |
| action.steam | Steam | Dämpfen |
| action.pour | Pour | Gießen |
| action.drain | Drain | Abgießen |
| action.rinse | Rinse | Abspülen |
| action.chill | Chill | Kühlen |
| action.freeze | Freeze | Einfrieren |
| action.serve | Serve | Servieren |
| action.add | Add | Hinzufügen |
| action.remove | Remove | Entfernen |
| action.wait | Wait | Warten |
| action.turn | Turn | Drehen |
| action.attach | Attach | Befestigen |
| action.detach | Detach | Lösen |
| action.repeat | Repeat | Wiederholen |
| action.measure | Measure | Messen |
| action.open | Open | Öffnen |
| action.close | Close | Schließen |
| action.check | Check | Prüfen |
| action.adjust | Adjust | Einstellen |
| object.onion | Onion | Zwiebel |
| object.garlic | Garlic | Knoblauch |
| object.egg | Egg | Ei |
| object.flour | Flour | Mehl |
| object.water | Water | Wasser |
| object.apple | Apple | Apfel |
| object.banana | Banana | Banane |
| object.grape | Grape | Traube |
| object.citrus | Citrus | Zitrusfrucht |
| object.tomato | Tomato | Tomate |
| object.potato | Potato | Kartoffel |
| object.leafy-green | Leafy Greens | Blattgemüse |
| object.herbs | Herbs | Kräuter |
| object.beef | Beef | Rindfleisch |
| object.fish | Fish | Fisch |
| object.beans | Beans | Bohnen |
| object.nuts | Nuts | Nüsse |
| object.milk | Milk | Milch |
| object.cheese | Cheese | Käse |
| object.oil | Oil | Öl |
| object.bread | Bread | Brot |
| object.wine | Wine | Wein |
| object.coffee | Coffee | Kaffee |
| object.soup | Soup | Suppe |
| object.ice | Ice | Eis |
| object.salt | Salt | Salz |
| object.pepper | Pepper | Pfeffer |
| object.sugar | Sugar | Zucker |
| object.cherry | Cherry | Kirsche |
| object.chicken | Chicken | Hähnchen |
| object.ham | Ham | Schinken |
| object.wheat | Wheat | Weizen |
| object.rice | Rice | Reis |
| object.pasta | Pasta | Nudeln |
| object.butter | Butter | Butter |
| object.honey | Honey | Honig |
| object.chocolate | Chocolate | Schokolade |
| object.mushroom | Mushroom | Pilz |
| object.corn | Corn | Mais |
| object.avocado | Avocado | Avocado |
| object.cucumber | Cucumber | Gurke |
| object.cabbage | Cabbage | Kohl |
| object.yogurt | Yogurt | Joghurt |
| tool.pan | Pan | Pfanne |
| tool.knife | Knife | Messer |
| tool.oven | Oven | Backofen |
| tool.blender | Blender | Mixer |
| tool.fridge | Fridge | Kühlschrank |
| tool.scale | Scale | Waage |
| tool.timer | Timer | Timer |
| tool.thermometer | Thermometer | Thermometer |
| tool.container | Container | Behälter |
| warning.hot | Hot! | Heiß! |
| warning.sharp | Sharp! | Scharf! |

## Minimum Daily routines / workplace additions

Category is the middle ID segment. These 24 entries join the shared references below; the original artwork must depict the stated action/object rather than merely an abstract control glyph.

| ID | English | Deutsch |
| --- | --- | --- |
| routines.action.wash-hands | Wash hands | Hände waschen |
| routines.action.brush-teeth | Brush teeth | Zähne putzen |
| routines.action.dress | Get dressed | Anziehen |
| routines.action.eat | Eat | Essen |
| routines.action.drink | Drink | Trinken |
| routines.action.use-toilet | Use toilet | Zur Toilette gehen |
| routines.action.rest | Rest | Ausruhen |
| routines.action.clean-surface | Clean surface | Fläche reinigen |
| routines.action.put-away | Put away | Wegräumen |
| routines.action.collect | Collect items | Dinge sammeln |
| routines.action.carry | Carry | Tragen |
| routines.action.bin-waste | Bin waste | Abfall entsorgen |
| routines.object.soap | Soap | Seife |
| routines.object.towel | Towel | Handtuch |
| routines.object.toothbrush | Toothbrush | Zahnbürste |
| routines.object.clothes | Clothes | Kleidung |
| routines.object.cup | Cup | Becher |
| routines.object.plate | Plate | Teller |
| routines.object.chair | Chair | Stuhl |
| routines.object.bed | Bed | Bett |
| routines.tool.cleaning-cloth | Cleaning cloth | Putztuch |
| routines.tool.gloves | Gloves | Handschuhe |
| routines.object.bin | Bin | Mülleimer |
| routines.object.toilet | Toilet | Toilette |

## Minimum Learning / classroom additions

These 24 entries join shared routines objects/actions where the meaning is identical; do not redraw/re-ID cup, chair, toilet, eating, drinking, rest, or putting away.

| ID | English | Deutsch |
| --- | --- | --- |
| learning.action.read | Read | Lesen |
| learning.action.write | Write | Schreiben |
| learning.action.draw | Draw | Zeichnen |
| learning.action.paint | Paint | Malen |
| learning.action.cut | Cut | Schneiden |
| learning.action.glue | Glue | Kleben |
| learning.action.listen | Listen | Zuhören |
| learning.action.speak | Speak | Sprechen |
| learning.action.choose | Choose | Wählen |
| learning.action.count | Count | Zählen |
| learning.action.play | Play | Spielen |
| learning.action.tidy | Tidy | Aufräumen |
| learning.object.book | Book | Buch |
| learning.tool.pencil | Pencil | Bleistift |
| learning.object.paper | Paper | Papier |
| learning.tool.scissors | Scissors | Schere |
| learning.tool.glue | Glue stick | Klebestift |
| learning.tool.paintbrush | Paintbrush | Pinsel |
| learning.object.blocks | Blocks | Bauklötze |
| learning.object.desk | Desk | Tisch |
| learning.object.bag | Bag | Tasche |
| learning.object.ball | Ball | Ball |
| learning.object.puzzle | Puzzle | Puzzle |
| learning.object.quiet-space | Quiet space | Ruheplatz |

## Shared choices and cross-library references

All three libraries include the following six shared choice entries, categorized `action`: `shared.action.yes` **Yes / Ja**, `shared.action.no` **No / Nein**, `shared.action.more` **More / Mehr**, `shared.action.finished` **Finished / Fertig**, `shared.action.help` **Help / Hilfe**, `shared.action.stop` **Stop / Stopp**. Their artwork represents a response/request; test meaning with intended recipients. More is distinct from procedural Add; Finished is distinct from Remove.

Routines and Learning also reference legacy `action.open`, `action.close`, `action.wait`, `action.repeat`, `action.check`, `object.water`, `tool.container`, `warning.hot`, and `warning.sharp`. Learning references `routines.action.eat`, `drink`, `rest`, `put-away`, and `routines.object.cup`, `chair`, `toilet` (expand each abbreviated ID with its stated prefix). Kitchen references `routines.action.wash-hands`, `clean-surface`, `bin-waste`, `routines.tool.gloves`, and `routines.object.bin`. Keep one canonical entry per listed ID and deterministic order: own inventory, shared choices, then these cross-library references.

## Bundled examples

Export `createExampleDocument(exampleId: "prepare-onion" | "ready-to-draw" | "choose-activity", locale: AppLocale): InstructionDocument` from `src/data/guide-examples.ts`. Generate fresh step/token IDs and creation time on every call; return schema v2 with authored localized titles/labels and no guide envelope. Never mutate a saved guide to apply an example.

`prepare-onion` is a sequence: Wash hands (wash-hands + soap); Cut the onion (chop + onion + knife, Sharp warning attached to knife); Put onion in the container (add + onion + container). `ready-to-draw` is a sequence: Choose paper (choose + paper); Draw (draw + pencil); Tidy (tidy + paper + bag). `choose-activity` is a board containing book, paintbrush, puzzle, and ball choices, plus a separate Help / Stop group. Include localized optional description/note in the two sequences so Detailed behavior is demonstrable. Treat these as editable examples, not validated workplace procedures; package 06 uses real tasks from participants for acceptance.

Tests assert each call returns fresh IDs, all pictured IDs resolve, both locales are complete, and board intent survives JSON. Contact sheets and prototype evidence use these examples; human recipients establish whether the pictures communicate the intended meaning.

## English/German controls and arbitrary units

Centralize keys for category/library names, toolbar, My guides, editor/reader, dialogs, labels, instructions, save/conflict/recovery messages, quantity/time/warning forms, output/preflight, and empty/search states. Both catalogs must contain every key with the same placeholders. Use whole messages; do not concatenate translated sentence fragments. Consumer owners supply missing key/copy requirements to this owner; there must be no English-only reachable control in German mode.

`src/i18n/messages.ts` exports `MessageParams` (key-to-parameter type map), `MessageKey = keyof MessageParams`, and the exact helper `t<K extends MessageKey>(locale: AppLocale, key: K, ...args: MessageParams[K] extends undefined ? [] : [params: MessageParams[K]]): string`. Example keys are `editor.addPicture` with undefined params, `catalog.noResults` with `{ query: string }`, `catalog.unknownSymbol` with `{ iconId: string }`, and `output.overflow` with `{ group: string; format: string }`. Locale is explicit; the helper reads no singleton state. Consumers map structured failure/issue codes to typed keys; do not translate by scraping English exception text. Render interpolated values as text, never HTML.

`src/lib/quantity-units.ts` exports `getSuggestedUnits(libraryId: LibraryId, locale: AppLocale): readonly UnitOption[]`. Kitchen retains suggestions `g`, `kg`, `ml`, `l`, `tsp`, `tbsp`, `pinch`, `pcs`; other palettes suggest `pcs`. Dropdown labels are bilingual; these are suggestions, not a whitelist. Editor provides free unit entry and retains an imported/current unit absent from suggestions, including `boxes`, `Stück`, or `small cups`. No palette/locale switch translates or normalizes stored units or quantities. Preserve whole amounts 1–99999 and existing legacy repairs; fractional amounts remain outside scope.

## Acceptance and verification

- Catalog fixtures assert all 84 legacy IDs/English labels, every new minimum ID, both locale labels/aliases, exact category membership, canonical shared references, attribution resolution, and quantity/time artwork. Search fixtures cover category plus query, empty/no matches, German umlauts/case, aliases, duplicate shared membership, and language separation.
- Artwork fixtures assert trusted inline vectors, common viewBox/presentation, no remote/raster/text/script content, unknown main/attachment fallbacks, and legacy resolver behavior. Inspect contact sheets for every available entry at grayscale and the specified sizes; structural checks cannot establish semantic accuracy.
- Localization fixtures assert complete equal key sets, matching placeholders, type-safe key/parameter calls, and interpolation containing German accents/user text. Unit fixtures preserve arbitrary imported strings and stable legacy suggestions without model mutation.
- Editor integration fixtures insert once per keyboard/tap, switch libraries/locales without history/selection/content changes, keep mixed/unknown pictures visible, name hidden-label pictures, and edit object-only sequences/boards. Foundation verifies completeness; reader/output agents verify semantic order and fallback notices.
- Run focused `npm test -- src/lib/library-catalog.test.ts src/data/icon-library.test.ts src/i18n/messages.test.ts src/lib/quantity-units.test.ts`, then `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. After consumers integrate, run `npm run test:browser` and `npm run test:pwa`; verify first-use offline access to every palette/artwork, independent of prior online exports.
- Hand off inventory/provenance, contact sheets, exact command results, and remaining comprehension observations. Real recipient/child-supported tests and actual prints belong to release acceptance; record pending evidence accurately. No placeholder artwork or unresolved glyph/asset dependency can be described as a completed original-vector inventory.
