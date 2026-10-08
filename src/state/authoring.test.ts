import { describe, it, expect } from "vitest";
import { createAuthoringController } from "./authoring";
import { createDocumentSession, sessionActions, openDocumentInSession } from "./document";
import { sequenceFixture } from "../test/fixtures/overhaul";
import { getCatalogEntry } from "../lib/library-catalog";
import { createEmptyDocument } from "../model/instruction";
import { resolveEditorDropCommand, resolveEditorPictureDrop } from "../lib/editor-drop";
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

// These checks catch anchor conversion done against a rendered segment or twice,
// and follow-ups bypassed by the drag path. They exercise the running controller.
describe("picture command composition", () => {
  function commands() {
    const doc = createEmptyDocument();
    doc.steps = [{ id: "a", tokens: ["x", "y", "z"].map(id => ({ id, category: "object", iconId: id })) }, { id: "b", tokens: [] }];
    const session = createDocumentSession(doc);
    return { session, authoring: createAuthoringController(session) };
  }
  const permission = { inViewport: true, blockedTarget: false, modalOpen: false, sourceConnected: true, guideUnchanged: true, documentUnchanged: true };

  it("commits a same-group anchor once and selects the moved picture", () => {
    const { session, authoring } = commands(); authoring.openPicture("a", "x");
    const command = resolveEditorDropCommand({ kind: "picture", groupId: "a", tokenId: "x" }, { pictureDrop: { groupId: "a", anchorId: "z", edge: "after" }, groupDrop: null }, permission, "en");
    expect(command).not.toBeNull();
    expect(authoring.executePicture(command!)).toEqual({ status: "changed", stepId: "a", tokenId: "x" });
    expect(session.document.peek().steps[0].tokens.map(token => token.id)).toEqual(["y", "z", "x"]);
    expect(session.past.peek()).toHaveLength(1); expect(session.selectedToken.peek()?.id).toBe("x");
    expect(authoring.panel.peek()).toEqual({ kind: "picture", stepId: "a", tokenId: "x" });
  });

  it("selects and retargets matching details after a cross-group move", () => {
    const { session, authoring } = commands(); authoring.openPicture("a", "x");
    expect(authoring.executePicture({ kind: "move", source: { stepId: "a", tokenId: "x" }, destination: { stepId: "b", kind: "empty" } }).status).toBe("changed");
    expect(session.selectedStepId.peek()).toBe("b"); expect(session.selectedTokenId.peek()).toBe("x");
    expect(authoring.panel.peek()).toEqual({ kind: "picture", stepId: "b", tokenId: "x" });
    expect(session.past.peek()).toHaveLength(1);
  });

  it("resolves continued-page geometry against the whole group", () => {
    const { session, authoring } = commands();
    session.document.value.steps[0].tokens = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, category: "object", iconId: "object.onion" }));
    const target = resolveEditorPictureDrop([{ id: "a", rect: { left: 0, right: 100, top: 0, bottom: 100 }, pictures: [{ id: "p24", rect: { left: 10, right: 50, top: 10, bottom: 50 } }] }], 20, 20);
    const command = resolveEditorDropCommand({ kind: "picture", groupId: "a", tokenId: "p0" }, { pictureDrop: target, groupDrop: null }, permission, "en");
    expect(authoring.executePicture(command!).status).toBe("changed");
    expect(session.document.peek().steps[0].tokens.slice(22, 25).map(token => token.id)).toEqual(["p23", "p0", "p24"]);
    expect(session.past.peek()).toHaveLength(1);
  });

  it.each(["before", "after"] as const)("self-%s preserves document, redo, selection and panel identities", edge => {
    const { session, authoring } = commands();
    sessionActions.updateTitle(session, "edited"); sessionActions.undo(session); authoring.openPicture("a", "y");
    const document = session.document.peek(), past = session.past.peek(), future = session.future.peek(), panel = authoring.panel.peek();
    expect(authoring.executePicture({ kind: "move", source: { stepId: "a", tokenId: "x" }, destination: { stepId: "a", kind: "anchor", anchorId: "x", edge } }, { panel: "close" })).toEqual({ status: "unchanged" });
    expect(session.document.peek()).toBe(document); expect(session.past.peek()).toBe(past); expect(session.future.peek()).toBe(future);
    expect(session.selectedTokenId.peek()).toBe("y"); expect(authoring.panel.peek()).toBe(panel);
  });

  it.each([
    { tokenId: "x", anchorId: "y", edge: "before" },
    { tokenId: "y", anchorId: "x", edge: "after" },
  ] as const)("equivalent neighboring anchor preserves redo and unrelated selection: %j", ({ tokenId, anchorId, edge }) => {
    const { session, authoring } = commands(); sessionActions.updateTitle(session, "edited"); sessionActions.undo(session); authoring.openPicture("a", "z");
    const document = session.document.peek(), past = session.past.peek(), future = session.future.peek(), panel = authoring.panel.peek();
    expect(authoring.executePicture({ kind: "move", source: { stepId: "a", tokenId }, destination: { stepId: "a", kind: "anchor", anchorId, edge } })).toEqual({ status: "unchanged" });
    expect(session.document.peek()).toBe(document); expect(session.past.peek()).toBe(past); expect(session.future.peek()).toBe(future);
    expect(session.selectedTokenId.peek()).toBe("z"); expect(authoring.panel.peek()).toBe(panel);
  });

  it("moves backward to a stable anchor while preserving its authored content", () => {
    const { session, authoring } = commands(); const token = session.document.peek().steps[0].tokens[2]; token.label = " Z authored "; token.note = "keep";
    authoring.executePicture({ kind: "move", source: { stepId: "a", tokenId: "z" }, destination: { stepId: "a", kind: "anchor", anchorId: "x", edge: "before" } });
    expect(session.document.peek().steps[0].tokens.map(item => item.id)).toEqual(["z", "x", "y"]);
    expect(session.selectedToken.peek()).toBe(token); expect(token.label).toBe(" Z authored "); expect(token.note).toBe("keep");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])("rejects nonfinite final index %s without selecting the source", index => {
    const { session, authoring } = commands(); authoring.openPicture("a", "y"); const document = session.document.peek(), panel = authoring.panel.peek();
    expect(authoring.movePicture("a", "x", "b", index, { panel: "close" })).toEqual({ status: "rejected", reason: "target-missing" });
    expect(session.document.peek()).toBe(document); expect(session.past.peek()).toHaveLength(0); expect(session.selectedTokenId.peek()).toBe("y"); expect(authoring.panel.peek()).toBe(panel);
  });

  it("truncates a finite final index before moving and keeps one undo entry", () => {
    const { session, authoring } = commands(); authoring.movePicture("a", "x", "a", 1.9);
    expect(session.document.peek().steps[0].tokens.map(token => token.id)).toEqual(["y", "x", "z"]); expect(session.past.peek()).toHaveLength(1);
  });

  it.each([
    { source: { stepId: "gone", tokenId: "x" }, destination: { stepId: "b", kind: "empty" } },
    { source: { stepId: "a", tokenId: "gone" }, destination: { stepId: "b", kind: "empty" } },
    { source: { stepId: "a", tokenId: "x" }, destination: { stepId: "gone", kind: "append" } },
    { source: { stepId: "a", tokenId: "x" }, destination: { stepId: "a", kind: "anchor", anchorId: "gone", edge: "before" } },
    { source: { stepId: "a", tokenId: "x" }, destination: { stepId: "a", kind: "empty" } },
  ] as const)("rejects stale or false-empty intent without side effects: %j", ({ source, destination }) => {
    const { session, authoring } = commands(); authoring.openPicture("a", "x");
    const document = session.document.peek(), past = session.past.peek(), panel = authoring.panel.peek();
    expect(authoring.executePicture({ kind: "move", source, destination }).status).toBe("rejected");
    expect(session.document.peek()).toBe(document); expect(session.past.peek()).toBe(past); expect(authoring.panel.peek()).toBe(panel);
    expect(session.selectedTokenId.peek()).toBe("x");
  });

  it("inserts a library drop into the actual target and closes the picker", () => {
    const { session, authoring } = commands(); authoring.openPicker("a");
    const command = resolveEditorDropCommand({ kind: "library", entry: getCatalogEntry("learning.object.book")! }, { pictureDrop: { groupId: "b", edge: "empty" }, groupDrop: null }, permission, "de");
    expect(authoring.executePicture(command!, { panel: "close" }).status).toBe("changed");
    expect(session.document.peek().steps[1].tokens[0].label).toBe("Buch");
    expect(session.selectedTokenId.peek()).toBe(session.document.peek().steps[1].tokens[0].id);
    expect(authoring.panel.peek()).toEqual({ kind: "closed" }); expect(session.past.peek()).toHaveLength(1);
  });

  it("keeps unrelated panels and distinguishes keyboard paste from details paste", () => {
    const { session, authoring } = commands(); authoring.openPicture("a", "y"); const panel = authoring.panel.peek();
    authoring.executePicture({ kind: "move", source: { stepId: "a", tokenId: "x" }, destination: { stepId: "b", kind: "append" } });
    expect(authoring.panel.peek()).toBe(panel);
    authoring.copyPicture("a", "y"); authoring.pastePicture("b"); expect(authoring.panel.peek()).toBe(panel);
    authoring.executePicture({ kind: "paste", destination: { stepId: "b", kind: "append" } }, { panel: "close" });
    expect(authoring.panel.peek()).toEqual({ kind: "closed" }); expect(session.document.peek().steps[1].tokens).toHaveLength(3);
  });

  it("moves a group by stable anchor without changing picture selection", () => {
    const { session, authoring } = commands(); authoring.openPicture("a", "x");
    expect(authoring.moveGroup("a", { anchorId: "b", edge: "after" })).toBe(true);
    expect(session.document.peek().steps.map(step => step.id)).toEqual(["b", "a"]);
    expect(session.selectedTokenId.peek()).toBe("x"); expect(session.past.peek()).toHaveLength(1);
    // A rejected target must not trigger the adapter's valid-drop focus request.
    expect(authoring.moveGroup("a", { anchorId: "gone", edge: "before" })).toBeUndefined();
    expect(authoring.moveGroup("gone", { anchorId: "a", edge: "after" })).toBeUndefined();
    expect(session.past.peek()).toHaveLength(1);
  });

  it.each(["before", "after"] as const)("group self-%s remains a valid no-op with redo and selection intact", edge => {
    const { session, authoring } = commands(); sessionActions.updateTitle(session, "edited"); sessionActions.undo(session); authoring.openPicture("a", "x");
    const document = session.document.peek(), past = session.past.peek(), future = session.future.peek(), panel = authoring.panel.peek();
    expect(authoring.moveGroup("a", { anchorId: "a", edge })).toBe(false);
    expect(session.document.peek()).toBe(document); expect(session.past.peek()).toBe(past); expect(session.future.peek()).toBe(future);
    expect(session.selectedTokenId.peek()).toBe("x"); expect(authoring.panel.peek()).toBe(panel);
  });

  it("deep clipboard snapshots survive source mutation/removal and repeated paste", () => {
    const { session, authoring } = commands(); const token = session.document.peek().steps[0].tokens[0];
    token.quantity = { iconId: "quantity.amount", amount: 2, unit: "cup", label: "Two cups" };
    token.time = { iconId: "time.duration", seconds: 60, label: "Minute" }; token.warning = { iconId: "warning.sharp", label: "Sharp" }; token.metadata = { custom: "retained" }; token.note = "authored";
    authoring.openPicture("a", "x"); const document = session.document.peek(), past = session.past.peek(), panel = authoring.panel.peek();
    expect(authoring.executePicture({ kind: "copy", source: { stepId: "a", tokenId: "x" } }, { panel: "close" })).toEqual({ status: "copied" });
    expect(session.document.peek()).toBe(document); expect(session.past.peek()).toBe(past); expect(authoring.panel.peek()).toBe(panel); expect(session.selectedTokenId.peek()).toBe("x");
    const copied = session.copiedToken.peek()!;
    authoring.duplicatePicture("a", "x"); const duplicate = session.document.peek().steps[0].tokens.at(-1)!;
    token.quantity.amount = 9; token.time.seconds = 90; token.warning.label = "changed"; token.metadata.custom = "changed";
    sessionActions.removeTokenFromStep(session, "a", "x");
    const first = authoring.pastePicture("b")!, second = authoring.pastePicture("b")!;
    const [one, two] = session.document.peek().steps[1].tokens;
    expect(new Set([token.id, copied.id, duplicate.id, first, second]).size).toBe(5);
    for (const item of [copied, duplicate, one, two]) {
      expect(item.quantity?.amount).toBe(2); expect(item.time?.seconds).toBe(60); expect(item.warning?.label).toBe("Sharp"); expect(item.metadata).toEqual({ custom: "retained" }); expect(item.note).toBe("authored");
    }
    one.quantity!.amount = 7; one.time!.seconds = 7; one.warning!.label = "paste changed"; one.metadata!.custom = "paste changed";
    expect(two.quantity?.amount).toBe(2); expect(copied.time?.seconds).toBe(60); expect(two.warning?.label).toBe("Sharp"); expect(copied.metadata?.custom).toBe("retained");
  });
});
