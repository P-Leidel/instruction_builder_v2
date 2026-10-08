import { batch, signal } from "@preact/signals";
import { sessionActions, type DocumentSession } from "./document";
import type { AppLocale, CatalogEntry } from "../model/library";
import type { InstructionToken } from "../model/instruction";
import type { GroupPlacement, PictureCommand, PictureCommandResult, PictureFollowUp } from "../model/editor-command";
import { resolveGroupPlacement, resolvePicturePlacement } from "../lib/editor-drop";

export type AuthoringPanelState = { kind: "closed" } | { kind: "picker"; stepId: string } |
  { kind: "picture"; stepId: string; tokenId: string } | { kind: "group"; stepId: string };

export function createAuthoringController(session: DocumentSession) {
  const panel = signal<AuthoringPanelState>({ kind: "closed" });
  const close = () => { panel.value = { kind: "closed" }; };
  const group = (id: string) => session.document.peek().steps.find((step) => step.id === id);
  function openPicker(stepId: string) { if (group(stepId)) panel.value = { kind: "picker", stepId }; }
  function openPicture(stepId: string, tokenId: string) {
    if (!group(stepId)?.tokens.some((token) => token.id === tokenId)) return;
    sessionActions.selectToken(session, stepId, tokenId); panel.value = { kind: "picture", stepId, tokenId };
  }
  function openGroup(stepId: string) { if (group(stepId)) { sessionActions.selectStep(session, stepId); panel.value = { kind: "group", stepId }; } }

  /** One live command path owns data, selection and panel follow-ups. DOM focus
   * stays with callers and runs only for a returned changed target. */
  function executePicture(command: PictureCommand, followUp: PictureFollowUp = { panel: "preserve" }): PictureCommandResult {
    const before = session.document.peek();
    const source = "source" in command ? group(command.source.stepId)?.tokens.find(token => token.id === command.source.tokenId) : undefined;
    if ("source" in command && !source) return { status: "rejected", reason: "source-missing" };
    if (command.kind === "copy") {
      sessionActions.copyToken(session, command.source.stepId, command.source.tokenId);
      return { status: "copied" };
    }
    const destination = command.kind === "duplicate" ? { kind: "append" as const, stepId: command.source.stepId } : command.destination;
    const index = resolvePicturePlacement(before, destination, command.kind === "move" ? command.source : undefined);
    if (index === null) return { status: "rejected", reason: "target-missing" };
    const copied = command.kind === "paste" ? session.copiedToken.peek() : null;
    if (command.kind === "paste" && !copied) return { status: "rejected", reason: "clipboard-empty" };
    const tokenId = command.kind === "move" ? command.source.tokenId : crypto.randomUUID();
    let result: PictureCommandResult = { status: "unchanged" };
    batch(() => {
      if (command.kind === "move") {
        sessionActions.moveToken(session, command.source.stepId, tokenId, destination.stepId, index);
      } else {
        const token: InstructionToken = command.kind === "insert"
          ? { id: tokenId, iconId: command.entry.iconId, category: command.entry.category, label: command.entry.labels[command.locale] }
          : { ...structuredClone(command.kind === "duplicate" ? source! : copied!), id: tokenId };
        sessionActions.addTokenToStep(session, destination.stepId, token, index);
      }
      if (session.document.peek() === before) return;
      sessionActions.selectToken(session, destination.stepId, tokenId);
      const current = panel.peek();
      if (followUp.panel === "close") close();
      else if (command.kind === "move" && current.kind === "picture" && current.tokenId === tokenId && current.stepId !== destination.stepId) {
        panel.value = { ...current, stepId: destination.stepId };
      }
      result = { status: "changed", stepId: destination.stepId, tokenId };
    });
    return result;
  }

  function insert(entry: CatalogEntry, locale: AppLocale): { ok: true; stepId: string; tokenId: string } | { ok: false; reason: "closed" | "target-missing" } {
    const target = panel.peek(); if (target.kind !== "picker") return { ok: false, reason: "closed" };
    const result = executePicture({ kind: "insert", entry, locale, destination: { kind: "append", stepId: target.stepId } }, { panel: "close" });
    if (result.status === "changed") return { ok: true, stepId: result.stepId, tokenId: result.tokenId };
    close(); sessionActions.selectStep(session, session.document.peek().steps[0]?.id ?? "");
    return { ok: false, reason: "target-missing" };
  }
  function movePicture(stepId: string, tokenId: string, destinationId: string, finalIndex: number, followUp?: PictureFollowUp) {
    return executePicture({ kind: "move", source: { stepId, tokenId }, destination: { kind: "final-index", stepId: destinationId, index: finalIndex } }, followUp);
  }
  function duplicatePicture(stepId: string, tokenId: string, followUp?: PictureFollowUp): string | undefined {
    const result = executePicture({ kind: "duplicate", source: { stepId, tokenId } }, followUp);
    return result.status === "changed" ? result.tokenId : undefined;
  }
  function copyPicture(stepId: string, tokenId: string): boolean {
    return executePicture({ kind: "copy", source: { stepId, tokenId } }).status === "copied";
  }
  function pastePicture(stepId: string, followUp?: PictureFollowUp): string | undefined {
    const result = executePicture({ kind: "paste", destination: { kind: "append", stepId } }, followUp);
    return result.status === "changed" ? result.tokenId : undefined;
  }
  /** A rejected target returns undefined; a valid no-op returns false so the
   * gesture adapter can retain heading focus without announcing a change. */
  function moveGroup(sourceStepId: string, destination: GroupPlacement): boolean | undefined {
    const before = session.document.peek(), index = resolveGroupPlacement(before, sourceStepId, destination);
    if (index === null) return undefined;
    sessionActions.reorderSteps(session, before.steps.findIndex(step => step.id === sourceStepId), index);
    return session.document.peek() !== before;
  }
  return { panel, close, openPicker, openPicture, openGroup, executePicture, moveGroup, insert, movePicture, duplicatePicture, copyPicture, pastePicture };
}
export type AuthoringController = ReturnType<typeof createAuthoringController>;
