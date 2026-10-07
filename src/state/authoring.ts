import { signal } from "@preact/signals";
import { sessionActions, type DocumentSession } from "./document";
import type { AppLocale, CatalogEntry } from "../model/library";
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
  function insert(entry: CatalogEntry, locale: AppLocale): { ok: true; stepId: string; tokenId: string } | { ok: false; reason: "closed" | "target-missing" } {
    const target = panel.peek(); if (target.kind !== "picker") return { ok: false, reason: "closed" };
    if (!group(target.stepId)) { close(); sessionActions.selectStep(session, session.document.peek().steps[0]?.id ?? ""); return { ok: false, reason: "target-missing" }; }
    const tokenId = crypto.randomUUID();
    sessionActions.addTokenToStep(session, target.stepId, { id: tokenId, iconId: entry.iconId, category: entry.category, label: entry.labels[locale] });
    sessionActions.selectToken(session, target.stepId, tokenId); close(); return { ok: true, stepId: target.stepId, tokenId };
  }
  function movePicture(stepId: string, tokenId: string, destinationId: string, finalIndex: number) {
    sessionActions.moveTokenTo(session, stepId, tokenId, destinationId, finalIndex);
    if (panel.peek().kind === "picture" && session.selectedTokenId.peek() === tokenId) panel.value = { kind: "picture", stepId: session.selectedStepId.peek()!, tokenId };
  }
  function duplicatePicture(stepId: string, tokenId: string): string | undefined {
    const token = group(stepId)?.tokens.find((picture) => picture.id === tokenId); if (!token) return;
    const id = crypto.randomUUID(); sessionActions.addTokenToStep(session, stepId, { ...structuredClone(token), id }); sessionActions.selectToken(session, stepId, id); return id;
  }
  function copyPicture(stepId: string, tokenId: string) {
    sessionActions.copyToken(session, stepId, tokenId);
    if (session.copiedToken.peek()) session.copiedToken.value = structuredClone(session.copiedToken.peek());
  }
  function pastePicture(stepId: string): string | undefined {
    const copied = session.copiedToken.peek(); if (!copied || !group(stepId)) return;
    const id = crypto.randomUUID(); sessionActions.addTokenToStep(session, stepId, { ...structuredClone(copied), id }); sessionActions.selectToken(session, stepId, id); return id;
  }
  return { panel, close, openPicker, openPicture, openGroup, insert, movePicture, duplicatePicture, copyPicture, pastePicture };
}
export type AuthoringController = ReturnType<typeof createAuthoringController>;
