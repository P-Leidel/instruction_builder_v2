import { signal } from "@preact/signals";
import type { InstructionDocument } from "../model/instruction";
import { documentSession } from "./document";
import { createAuthoringController } from "./authoring";
export const appView = signal<"guides" | "editor" | "reader">("guides");
export const authoring = createAuthoringController(documentSession);
let panelOpener: HTMLElement | null = null;
export function capturePanelOpener() { panelOpener = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null; }
export function focusPicture(tokenId: string) { requestAnimationFrame(() => { const picture = window.document.querySelector<HTMLElement>(`[data-editor-picture="${CSS.escape(tokenId)}"]`); picture?.focus(); picture?.scrollIntoView({ block: "nearest" }); }); }
export function closeAuthoringPanel() {
  authoring.close(); requestAnimationFrame(() => {
    if (panelOpener?.isConnected) panelOpener.focus();
    else window.document.querySelector<HTMLElement>("[data-add-picture], [data-add-group]")?.focus();
  });
}

/** A single dismissible status message, replaced or cleared by its caller. */
export type ToastTone = "info" | "warning" | "error";
export interface Toast {
  text: string;
  tone: ToastTone;
}
export const toast = signal<Toast | null>(null);

/** A validated import awaiting confirmation before creating a new guide. */
export interface PendingImport {
  document: InstructionDocument;
  incompleteCount: number;
}
export const pendingImport = signal<PendingImport | null>(null);
