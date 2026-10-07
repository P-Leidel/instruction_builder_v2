import { createEmptyDocument, newId, type InstructionDocument, type InstructionStep, type InstructionToken } from "../model/instruction";
import type { AppLocale } from "../model/library";
import { getCatalogEntry } from "../lib/library-catalog";
import { t, type MessageKey } from "../i18n/messages";

export type ExampleId = "prepare-onion" | "ready-to-draw" | "choose-activity";

export function createExampleDocument(exampleId: ExampleId, locale: AppLocale): InstructionDocument {
  const doc = createEmptyDocument(exampleId === "choose-activity" ? "board" : "sequence");
  function token(iconId: string): InstructionToken {
    const entry = getCatalogEntry(iconId);
    if (!entry) throw new Error(`Missing example picture: ${iconId}`);
    return { id: newId(), iconId, category: entry.category, label: entry.labels[locale] };
  }
  type ExampleMessage = Extract<MessageKey, `example.${string}`>;
  function group(title: ExampleMessage, ids: string[]): InstructionStep {
    return { id: newId(), title: t(locale, title), tokens: ids.map(token) };
  }
  if (exampleId === "prepare-onion") {
    doc.meta.title = t(locale, "example.prepareOnion.title");
    doc.steps = [group("example.washHands", ["routines.action.wash-hands", "routines.object.soap"]),
      group("example.cutOnion", ["action.chop", "object.onion", "tool.knife"]),
      group("example.storeOnion", ["action.add", "object.onion", "tool.container"])];
    doc.steps[0].description = t(locale, "example.kitchenDescription");
    doc.steps[1].tokens[2].warning = { iconId: "warning.sharp", label: getCatalogEntry("warning.sharp")!.labels[locale] };
    doc.steps[1].tokens[2].note = t(locale, "example.kitchenNote");
  } else if (exampleId === "ready-to-draw") {
    doc.meta.title = t(locale, "example.readyToDraw.title");
    doc.steps = [group("example.choosePaper", ["learning.action.choose", "learning.object.paper"]),
      group("example.draw", ["learning.action.draw", "learning.tool.pencil"]),
      group("example.tidy", ["learning.action.tidy", "learning.object.paper", "learning.object.bag"])];
    doc.steps[0].description = t(locale, "example.learningDescription");
    doc.steps[0].tokens[0].note = t(locale, "example.learningNote");
  } else {
    doc.meta.title = t(locale, "example.chooseActivity.title");
    doc.steps = [group("example.activities", ["learning.object.book", "learning.tool.paintbrush", "learning.object.puzzle", "learning.object.ball"]),
      group("example.helpStop", ["shared.action.help", "shared.action.stop"])];
  }
  return doc;
}
