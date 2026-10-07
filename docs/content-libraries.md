# Content libraries and original artwork

All three palettes share one canonical catalog and artwork resolver. The 140 canonical entries comprise 84 retained Kitchen meanings, 24 Daily routines / workplace meanings, 24 Learning / classroom meanings, 6 shared responses/requests, and 2 quantity/time attachment symbols. Kitchen offers 95 references, Routines 39, and Learning 46, in own-inventory, shared-choice, cross-library order. Quantity/time are form-created attachments and are not insertion-grid entries.

English compatibility `SAMPLE_TOKENS` retains its original 84 IDs, order and labels. New consumers use `CONTENT_LIBRARIES`, `getLibrary`, `getCatalogEntry`, `findLibraryEntries`, and `resolveIcon`. Search uses only the selected locale's label/aliases, folds Unicode accents/case, matches every collapsed query word, and retains order. A library/locale switch must never rewrite placed labels or entered quantity units.

`getWarningMeaning` preserves a nonblank authored warning label; otherwise it returns a known warning's localized meaning or the typed unknown-warning message with the stored ID. Unknown/non-warning attachment references keep their warning role and require a downstream review notice. `Icon` is decorative and renders the same known/fallback markup; enclosing controls/read content supply accessible names.

All artwork sources are original SVG primitives under `src/assets/pictograms`, loaded eagerly without remote references or fonts. Provenance is `src/data/artwork-provenance.ts`, ID `original-pictograms-2026-10-06`; actual license status is [LICENSE-STATUS.md](artwork/LICENSE-STATUS.md), with no invented ownership or distribution grant. Existing third-party dependency notices remain applicable. Intended app/export/print use is recorded; the project owner still needs an explicit distribution-license decision.

The complete [contact sheet index](artwork/contact-sheets.html) links six SVG sheets and corresponding PNG review captures. Each entry shows canonical ID, bilingual labels and its original source filename, in grayscale at 8/15/25 mm nominal geometry. Actual physical size requires a calibrated display or printed page. Regenerate with `node docs/artwork/generate-contact-sheets.mjs`; render PNGs with `node docs/artwork/render-contact-sheets.mjs`.

## Review observations and pending evidence

Agent visually inspected every one of the six rendered sheets on 6 October 2026. No food/tool placeholder substitutions remain; distinct drawings separate onion/garlic/tomato, pan/oven, frying/baking, rinse/boil, oil/pour, thermometer/hot warning, procedural add/request-more, and remove/finished. Structural checks confirm the common box/presentation and forbid remote/raster/text/script dependencies.

Root's independent screen review identified the first Count drawing as a bar-chart proxy. It was replaced by an original framed abacus with 1/2/3 grouped beads, and root's delta review confirmed the distinction. A browser `getBBox()` pass then detected five slightly outlying curves (beans, chicken, thermometer, drinking, Stop); they were corrected without changing the common stroke or shrinking the drawing system. `node docs/artwork/verify-vector-geometry.mjs` now verifies all 140 source drawings remain in the specified 2–22 geometry region. Sheets were regenerated and affected entries re-inspected after both corrections.

At the 8 mm screen rendering, dense internal detail in whisk, gloves and hand actions is harder to distinguish than at 15/25 mm. That is a stress observation, not an accessibility or comprehension claim. Onion versus garlic (stem/bulb details), salt versus sugar (shaker versus bag/cubes), and the abstract shared choices need recipient interpretation testing. Quiet-space uses a seated room/nook; its meaning must be checked with recipients rather than assumed from its label. Screenshots cannot establish print legibility, user recognition, child accessibility, or grayscale physical readability. Recipient-supported comprehension testing and actual prints at all stated sizes remain pending release evidence.

## Complete canonical inventory

| ID | Category | English | Deutsch | Original source |
| --- | --- | --- | --- | --- |
| action.chop | action | Chop | Hacken | `src/assets/pictograms/action.chop.svg` |
| action.slice | action | Slice | In Scheiben schneiden | `src/assets/pictograms/action.slice.svg` |
| action.stir | action | Stir | Rühren | `src/assets/pictograms/action.stir.svg` |
| action.whisk | action | Whisk | Verquirlen | `src/assets/pictograms/action.whisk.svg` |
| action.mix | action | Mix | Mischen | `src/assets/pictograms/action.mix.svg` |
| action.knead | action | Knead | Kneten | `src/assets/pictograms/action.knead.svg` |
| action.bake | action | Bake | Backen | `src/assets/pictograms/action.bake.svg` |
| action.fry | action | Fry | Braten | `src/assets/pictograms/action.fry.svg` |
| action.roast | action | Roast | Rösten | `src/assets/pictograms/action.roast.svg` |
| action.boil | action | Boil | Kochen | `src/assets/pictograms/action.boil.svg` |
| action.simmer | action | Simmer | Köcheln | `src/assets/pictograms/action.simmer.svg` |
| action.steam | action | Steam | Dämpfen | `src/assets/pictograms/action.steam.svg` |
| action.pour | action | Pour | Gießen | `src/assets/pictograms/action.pour.svg` |
| action.drain | action | Drain | Abgießen | `src/assets/pictograms/action.drain.svg` |
| action.rinse | action | Rinse | Abspülen | `src/assets/pictograms/action.rinse.svg` |
| action.chill | action | Chill | Kühlen | `src/assets/pictograms/action.chill.svg` |
| action.freeze | action | Freeze | Einfrieren | `src/assets/pictograms/action.freeze.svg` |
| action.serve | action | Serve | Servieren | `src/assets/pictograms/action.serve.svg` |
| action.add | action | Add | Hinzufügen | `src/assets/pictograms/action.add.svg` |
| action.remove | action | Remove | Entfernen | `src/assets/pictograms/action.remove.svg` |
| action.wait | action | Wait | Warten | `src/assets/pictograms/action.wait.svg` |
| action.turn | action | Turn | Drehen | `src/assets/pictograms/action.turn.svg` |
| action.attach | action | Attach | Befestigen | `src/assets/pictograms/action.attach.svg` |
| action.detach | action | Detach | Lösen | `src/assets/pictograms/action.detach.svg` |
| action.repeat | action | Repeat | Wiederholen | `src/assets/pictograms/action.repeat.svg` |
| action.measure | action | Measure | Messen | `src/assets/pictograms/action.measure.svg` |
| action.open | action | Open | Öffnen | `src/assets/pictograms/action.open.svg` |
| action.close | action | Close | Schließen | `src/assets/pictograms/action.close.svg` |
| action.check | action | Check | Prüfen | `src/assets/pictograms/action.check.svg` |
| action.adjust | action | Adjust | Einstellen | `src/assets/pictograms/action.adjust.svg` |
| object.onion | object | Onion | Zwiebel | `src/assets/pictograms/object.onion.svg` |
| object.garlic | object | Garlic | Knoblauch | `src/assets/pictograms/object.garlic.svg` |
| object.egg | object | Egg | Ei | `src/assets/pictograms/object.egg.svg` |
| object.flour | object | Flour | Mehl | `src/assets/pictograms/object.flour.svg` |
| object.water | object | Water | Wasser | `src/assets/pictograms/object.water.svg` |
| object.apple | object | Apple | Apfel | `src/assets/pictograms/object.apple.svg` |
| object.banana | object | Banana | Banane | `src/assets/pictograms/object.banana.svg` |
| object.grape | object | Grape | Traube | `src/assets/pictograms/object.grape.svg` |
| object.citrus | object | Citrus | Zitrusfrucht | `src/assets/pictograms/object.citrus.svg` |
| object.tomato | object | Tomato | Tomate | `src/assets/pictograms/object.tomato.svg` |
| object.potato | object | Potato | Kartoffel | `src/assets/pictograms/object.potato.svg` |
| object.leafy-green | object | Leafy Greens | Blattgemüse | `src/assets/pictograms/object.leafy-green.svg` |
| object.herbs | object | Herbs | Kräuter | `src/assets/pictograms/object.herbs.svg` |
| object.beef | object | Beef | Rindfleisch | `src/assets/pictograms/object.beef.svg` |
| object.fish | object | Fish | Fisch | `src/assets/pictograms/object.fish.svg` |
| object.beans | object | Beans | Bohnen | `src/assets/pictograms/object.beans.svg` |
| object.nuts | object | Nuts | Nüsse | `src/assets/pictograms/object.nuts.svg` |
| object.milk | object | Milk | Milch | `src/assets/pictograms/object.milk.svg` |
| object.cheese | object | Cheese | Käse | `src/assets/pictograms/object.cheese.svg` |
| object.oil | object | Oil | Öl | `src/assets/pictograms/object.oil.svg` |
| object.bread | object | Bread | Brot | `src/assets/pictograms/object.bread.svg` |
| object.wine | object | Wine | Wein | `src/assets/pictograms/object.wine.svg` |
| object.coffee | object | Coffee | Kaffee | `src/assets/pictograms/object.coffee.svg` |
| object.soup | object | Soup | Suppe | `src/assets/pictograms/object.soup.svg` |
| object.ice | object | Ice | Eis | `src/assets/pictograms/object.ice.svg` |
| object.salt | object | Salt | Salz | `src/assets/pictograms/object.salt.svg` |
| object.pepper | object | Pepper | Pfeffer | `src/assets/pictograms/object.pepper.svg` |
| object.sugar | object | Sugar | Zucker | `src/assets/pictograms/object.sugar.svg` |
| object.cherry | object | Cherry | Kirsche | `src/assets/pictograms/object.cherry.svg` |
| object.chicken | object | Chicken | Hähnchen | `src/assets/pictograms/object.chicken.svg` |
| object.ham | object | Ham | Schinken | `src/assets/pictograms/object.ham.svg` |
| object.wheat | object | Wheat | Weizen | `src/assets/pictograms/object.wheat.svg` |
| object.rice | object | Rice | Reis | `src/assets/pictograms/object.rice.svg` |
| object.pasta | object | Pasta | Nudeln | `src/assets/pictograms/object.pasta.svg` |
| object.butter | object | Butter | Butter | `src/assets/pictograms/object.butter.svg` |
| object.honey | object | Honey | Honig | `src/assets/pictograms/object.honey.svg` |
| object.chocolate | object | Chocolate | Schokolade | `src/assets/pictograms/object.chocolate.svg` |
| object.mushroom | object | Mushroom | Pilz | `src/assets/pictograms/object.mushroom.svg` |
| object.corn | object | Corn | Mais | `src/assets/pictograms/object.corn.svg` |
| object.avocado | object | Avocado | Avocado | `src/assets/pictograms/object.avocado.svg` |
| object.cucumber | object | Cucumber | Gurke | `src/assets/pictograms/object.cucumber.svg` |
| object.cabbage | object | Cabbage | Kohl | `src/assets/pictograms/object.cabbage.svg` |
| object.yogurt | object | Yogurt | Joghurt | `src/assets/pictograms/object.yogurt.svg` |
| tool.pan | tool | Pan | Pfanne | `src/assets/pictograms/tool.pan.svg` |
| tool.knife | tool | Knife | Messer | `src/assets/pictograms/tool.knife.svg` |
| tool.oven | tool | Oven | Backofen | `src/assets/pictograms/tool.oven.svg` |
| tool.blender | tool | Blender | Mixer | `src/assets/pictograms/tool.blender.svg` |
| tool.fridge | tool | Fridge | Kühlschrank | `src/assets/pictograms/tool.fridge.svg` |
| tool.scale | tool | Scale | Waage | `src/assets/pictograms/tool.scale.svg` |
| tool.timer | tool | Timer | Timer | `src/assets/pictograms/tool.timer.svg` |
| tool.thermometer | tool | Thermometer | Thermometer | `src/assets/pictograms/tool.thermometer.svg` |
| tool.container | tool | Container | Behälter | `src/assets/pictograms/tool.container.svg` |
| warning.hot | warning | Hot! | Heiß! | `src/assets/pictograms/warning.hot.svg` |
| warning.sharp | warning | Sharp! | Scharf! | `src/assets/pictograms/warning.sharp.svg` |
| routines.action.wash-hands | action | Wash hands | Hände waschen | `src/assets/pictograms/routines.action.wash-hands.svg` |
| routines.action.brush-teeth | action | Brush teeth | Zähne putzen | `src/assets/pictograms/routines.action.brush-teeth.svg` |
| routines.action.dress | action | Get dressed | Anziehen | `src/assets/pictograms/routines.action.dress.svg` |
| routines.action.eat | action | Eat | Essen | `src/assets/pictograms/routines.action.eat.svg` |
| routines.action.drink | action | Drink | Trinken | `src/assets/pictograms/routines.action.drink.svg` |
| routines.action.use-toilet | action | Use toilet | Zur Toilette gehen | `src/assets/pictograms/routines.action.use-toilet.svg` |
| routines.action.rest | action | Rest | Ausruhen | `src/assets/pictograms/routines.action.rest.svg` |
| routines.action.clean-surface | action | Clean surface | Fläche reinigen | `src/assets/pictograms/routines.action.clean-surface.svg` |
| routines.action.put-away | action | Put away | Wegräumen | `src/assets/pictograms/routines.action.put-away.svg` |
| routines.action.collect | action | Collect items | Dinge sammeln | `src/assets/pictograms/routines.action.collect.svg` |
| routines.action.carry | action | Carry | Tragen | `src/assets/pictograms/routines.action.carry.svg` |
| routines.action.bin-waste | action | Bin waste | Abfall entsorgen | `src/assets/pictograms/routines.action.bin-waste.svg` |
| routines.object.soap | object | Soap | Seife | `src/assets/pictograms/routines.object.soap.svg` |
| routines.object.towel | object | Towel | Handtuch | `src/assets/pictograms/routines.object.towel.svg` |
| routines.object.toothbrush | object | Toothbrush | Zahnbürste | `src/assets/pictograms/routines.object.toothbrush.svg` |
| routines.object.clothes | object | Clothes | Kleidung | `src/assets/pictograms/routines.object.clothes.svg` |
| routines.object.cup | object | Cup | Becher | `src/assets/pictograms/routines.object.cup.svg` |
| routines.object.plate | object | Plate | Teller | `src/assets/pictograms/routines.object.plate.svg` |
| routines.object.chair | object | Chair | Stuhl | `src/assets/pictograms/routines.object.chair.svg` |
| routines.object.bed | object | Bed | Bett | `src/assets/pictograms/routines.object.bed.svg` |
| routines.tool.cleaning-cloth | tool | Cleaning cloth | Putztuch | `src/assets/pictograms/routines.tool.cleaning-cloth.svg` |
| routines.tool.gloves | tool | Gloves | Handschuhe | `src/assets/pictograms/routines.tool.gloves.svg` |
| routines.object.bin | object | Bin | Mülleimer | `src/assets/pictograms/routines.object.bin.svg` |
| routines.object.toilet | object | Toilet | Toilette | `src/assets/pictograms/routines.object.toilet.svg` |
| learning.action.read | action | Read | Lesen | `src/assets/pictograms/learning.action.read.svg` |
| learning.action.write | action | Write | Schreiben | `src/assets/pictograms/learning.action.write.svg` |
| learning.action.draw | action | Draw | Zeichnen | `src/assets/pictograms/learning.action.draw.svg` |
| learning.action.paint | action | Paint | Malen | `src/assets/pictograms/learning.action.paint.svg` |
| learning.action.cut | action | Cut | Schneiden | `src/assets/pictograms/learning.action.cut.svg` |
| learning.action.glue | action | Glue | Kleben | `src/assets/pictograms/learning.action.glue.svg` |
| learning.action.listen | action | Listen | Zuhören | `src/assets/pictograms/learning.action.listen.svg` |
| learning.action.speak | action | Speak | Sprechen | `src/assets/pictograms/learning.action.speak.svg` |
| learning.action.choose | action | Choose | Wählen | `src/assets/pictograms/learning.action.choose.svg` |
| learning.action.count | action | Count | Zählen | `src/assets/pictograms/learning.action.count.svg` |
| learning.action.play | action | Play | Spielen | `src/assets/pictograms/learning.action.play.svg` |
| learning.action.tidy | action | Tidy | Aufräumen | `src/assets/pictograms/learning.action.tidy.svg` |
| learning.object.book | object | Book | Buch | `src/assets/pictograms/learning.object.book.svg` |
| learning.tool.pencil | tool | Pencil | Bleistift | `src/assets/pictograms/learning.tool.pencil.svg` |
| learning.object.paper | object | Paper | Papier | `src/assets/pictograms/learning.object.paper.svg` |
| learning.tool.scissors | tool | Scissors | Schere | `src/assets/pictograms/learning.tool.scissors.svg` |
| learning.tool.glue | tool | Glue stick | Klebestift | `src/assets/pictograms/learning.tool.glue.svg` |
| learning.tool.paintbrush | tool | Paintbrush | Pinsel | `src/assets/pictograms/learning.tool.paintbrush.svg` |
| learning.object.blocks | object | Blocks | Bauklötze | `src/assets/pictograms/learning.object.blocks.svg` |
| learning.object.desk | object | Desk | Tisch | `src/assets/pictograms/learning.object.desk.svg` |
| learning.object.bag | object | Bag | Tasche | `src/assets/pictograms/learning.object.bag.svg` |
| learning.object.ball | object | Ball | Ball | `src/assets/pictograms/learning.object.ball.svg` |
| learning.object.puzzle | object | Puzzle | Puzzle | `src/assets/pictograms/learning.object.puzzle.svg` |
| learning.object.quiet-space | object | Quiet space | Ruheplatz | `src/assets/pictograms/learning.object.quiet-space.svg` |
| shared.action.yes | action | Yes | Ja | `src/assets/pictograms/shared.action.yes.svg` |
| shared.action.no | action | No | Nein | `src/assets/pictograms/shared.action.no.svg` |
| shared.action.more | action | More | Mehr | `src/assets/pictograms/shared.action.more.svg` |
| shared.action.finished | action | Finished | Fertig | `src/assets/pictograms/shared.action.finished.svg` |
| shared.action.help | action | Help | Hilfe | `src/assets/pictograms/shared.action.help.svg` |
| shared.action.stop | action | Stop | Stopp | `src/assets/pictograms/shared.action.stop.svg` |
| quantity.amount | quantity | Quantity | Menge | `src/assets/pictograms/quantity.amount.svg` |
| time.duration | time | Time | Zeit | `src/assets/pictograms/time.duration.svg` |

## Integration exports

- Catalog: `src/model/library.ts` types; `src/data/libraries/index.ts` exports `CONTENT_LIBRARIES`; `src/lib/library-catalog.ts` exports exact shared APIs and `getWarningMeaning`.
- Messages: `src/i18n/messages.ts` exports `MessageParams`, `MessageKey`, `t(locale, key, ...params)`. `en.ts` and `de.ts` have complete equal key/placeholder sets. Locale is explicit and no preference singleton is read. Interpolated values are plain text, not HTML.
- Quantity suggestions: `getSuggestedUnits(libraryId, locale)` returns bilingual Kitchen suggestions or pcs elsewhere. Units such as boxes, Stück and small cups remain authored verbatim; amount bounds remain 1–99999 via the existing model/migration engine.
- Examples: `createExampleDocument(exampleId, locale)` creates fresh schema-2 bare documents for prepare-onion, ready-to-draw and choose-activity. Step/token IDs and creation time are new each call. Sequences include localized optional description/note and knife warning; the board has four activity objects plus Help/Stop. Examples are editable, not validated real-world procedures.
