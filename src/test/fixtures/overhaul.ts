import type { InstructionDocument, InstructionToken } from "../../model/instruction";

// Deterministic test documents only: never production library/sample content.
function fixtureDocument(presentation: "sequence" | "board", tokens: InstructionToken[]): InstructionDocument {
  return {
    schemaVersion: 2,
    meta: { title: "Fixture guide", domain: "fixture", createdAt: "2026-10-06T00:00:00.000Z", presentation },
    steps: [{ id: "fixture-group-1", title: "Fixture group", description: "Optional group description", tokens }],
  };
}

export function sequenceFixture(): InstructionDocument {
  return fixtureDocument("sequence", [{
    id: "fixture-token-1", iconId: "action.chop", category: "action", label: "Prepare ingredients",
    note: "Optional detailed preparation note",
    quantity: { iconId: "quantity.amount", label: "2 cups", amount: 2, unit: "cups" },
    warning: { iconId: "warning.sharp", label: "Sharp blade" },
    time: { iconId: "time.duration", label: "5m", seconds: 300 },
  }, { id: "fixture-token-2", iconId: "object.onion", category: "object", label: "Onion" }]);
}

export function boardFixture(): InstructionDocument {
  return fixtureDocument("board", [{
    id: "fixture-choice-1", iconId: "learning.object.book", category: "object", label: "Read",
    time: { iconId: "time.duration", label: "5m", seconds: 300 },
  }, {
    id: "fixture-choice-2", iconId: "learning.action.play", category: "action", label: "Play",
    time: { iconId: "time.duration", label: "10m", seconds: 600 },
  }]);
}

export function mixedLibraryFixture(): InstructionDocument {
  return fixtureDocument("sequence", [{ id: "fixture-kitchen", iconId: "object.onion", category: "object", label: "Onion" },
    { id: "fixture-routines", iconId: "routines.action.wash-hands", category: "action", label: "Wash hands" },
    { id: "fixture-learning", iconId: "learning.object.book", category: "object", label: "Book" }]);
}

export function longGroupFixture(tokenCount: number): InstructionDocument {
  return fixtureDocument("sequence", Array.from({ length: tokenCount }, (_, index) => ({
    id: `fixture-long-token-${index + 1}`, iconId: "object.onion", category: "object",
    label: `Gemüse gründlich unter fließendem Wasser waschen und sorgfältig vorbereiten ${index + 1}`,
  })));
}

export function unsupportedTextFixture(): InstructionDocument {
  const doc = sequenceFixture();
  doc.steps[0].tokens[0].label = "日本語の説明";
  return doc;
}
