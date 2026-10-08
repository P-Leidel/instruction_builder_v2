import { describe, it, expect } from "vitest";
import { createAuthoringController } from "./authoring";
import { createDocumentSession, sessionActions, openDocumentInSession } from "./document";
import { sequenceFixture } from "../test/fixtures/overhaul";
import { getCatalogEntry } from "../lib/library-catalog";
function fixture() { const session = createDocumentSession(); const doc = sequenceFixture(); doc.steps.push({ id: "second-group", tokens: [] }); openDocumentInSession(session, doc); return { session, authoring: createAuthoringController(session) }; }
describe("contextual authoring", () => {
  it("reports successful copy and rejects missing targets without replacing the clipboard", () => {
    const { session, authoring } = fixture(); const step = session.document.peek().steps[0]; const token = step.tokens[0];
    const document = session.document.peek(), past = session.past.peek(), future = session.future.peek();
    expect(authoring.copyPicture(step.id, token.id)).toBe(true);
    const copied = session.copiedToken.peek(); expect(copied).not.toBeNull();
    expect(authoring.copyPicture("missing-group", token.id)).toBe(false);
    expect(session.copiedToken.peek()).toBe(copied);
    expect(authoring.copyPicture(step.id, "missing-picture")).toBe(false);
    expect(session.copiedToken.peek()).toBe(copied);
    expect(session.document.peek()).toBe(document); expect(session.past.peek()).toBe(past); expect(session.future.peek()).toBe(future);
  });
  it("leaves an existing clipboard snapshot intact when a copy target is stale", () => {
    const { session, authoring } = fixture(); const step = session.document.peek().steps[0];
    authoring.copyPicture(step.id, step.tokens[0].id); const copied = session.copiedToken.peek();
    const result = authoring.copyPicture(step.id, "missing-picture");
    expect(session.copiedToken.peek()).toBe(copied);
    expect(result).toBe(false);
  });
  it("inserts exactly once into the captured group regardless of ambient selection", () => {
    const { session, authoring } = fixture(); const [a, b] = session.document.value.steps;
    authoring.openPicker(a.id); sessionActions.selectStep(session, b.id);
    expect(session.past.value).toHaveLength(0);
    const result = authoring.insert(getCatalogEntry("learning.object.book")!, "de");
    expect(result.ok).toBe(true); const newPicture = session.document.value.steps[0].tokens.at(-1)!;
    expect(newPicture.label).toBe("Buch"); expect(session.selectedTokenId.value).toBe(newPicture.id);
    expect(session.document.value.steps[1].tokens).toEqual(b.tokens); expect(session.past.value).toHaveLength(1);
    expect(authoring.insert(getCatalogEntry("object.onion")!, "en")).toEqual({ ok: false, reason: "closed" });
  });
  it("never redirects a deleted picker target and leaves history untouched", () => {
    const { session, authoring } = fixture(); const id = session.document.value.steps[0].id;
    authoring.openPicker(id); sessionActions.removeStep(session, id); const before = session.document.peek(); const past = session.past.peek();
    expect(authoring.insert(getCatalogEntry("object.onion")!, "en")).toEqual({ ok: false, reason: "target-missing" });
    expect(session.document.peek()).toBe(before); expect(session.past.peek()).toBe(past); expect(authoring.panel.value.kind).toBe("closed");
  });
  it("moves with final indices and duplicates/copies attachments with fresh IDs", () => {
    const { session, authoring } = fixture(); const step = session.document.value.steps[0]; const token = step.tokens[0];
    token.warning = { iconId: "warning.sharp", label: "Careful" };
    authoring.movePicture(step.id, token.id, step.id, 1);
    expect(session.document.value.steps[0].tokens[1].id).toBe(token.id); expect(session.past.value).toHaveLength(1);
    const id = authoring.duplicatePicture(step.id, token.id)!;
    const duplicate = session.document.value.steps[0].tokens.at(-1)!;
    expect(duplicate.id).toBe(id); expect(id).not.toBe(token.id); expect(duplicate.warning).toEqual(token.warning); expect(duplicate.warning).not.toBe(token.warning);
    authoring.copyPicture(step.id, token.id); expect(session.copiedToken.value?.warning).not.toBe(token.warning);
    const pastedId = authoring.pastePicture(step.id)!;
    expect(session.document.value.steps[0].tokens.at(-1)?.id).toBe(pastedId);
    expect(session.document.value.steps[0].tokens.at(-1)?.warning).not.toBe(session.copiedToken.value?.warning);
    const past = session.past.peek(); authoring.movePicture("stale", token.id, step.id, 0); expect(session.past.peek()).toBe(past);
  });
});
