import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { DocumentSession } from "../../state/document";
import { authoring, closeAuthoringPanel, toast } from "../../state/ui";
import { preferences } from "../../state/preferences";
import { t } from "../../i18n/messages";
import { TokenPicker } from "../TokenPicker/TokenPicker";
import { TokenDetails } from "../TokenDetails/TokenDetails";
import { StepDetails } from "../StepDetails/StepDetails";
import { AttachmentDraftProvider } from "../TokenDetails/AttachmentFields";
export function ModalDialog({ children, label, onClose, busy = false }: { children: ComponentChildren; label: string; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => { const dialog = ref.current!; const opener = window.document.activeElement; dialog.showModal(); return () => { dialog.close(); if (opener instanceof HTMLElement && opener.isConnected) opener.focus(); }; }, []);
  return <dialog ref={ref} aria-label={label} aria-busy={busy || undefined} class="context-sheet" onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); if (!busy) onClose(); return; }
    if (event.key !== "Tab") return;
    const nodes = [...ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')].filter((node) => {
      if (node.getBoundingClientRect().width <= 0) return false;
      // Closed details may retain layout boxes in the browser. Their hidden
      // controls cannot be tab stops, even when their measured width is > 0.
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement && !parent.open && parent.querySelector(":scope > summary") !== node) return false;
      }
      return true;
    });
    const first = nodes[0]; const last = nodes.at(-1);
    if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}><header class="context-sheet__header"><button type="button" disabled={busy} onClick={onClose}>{t(preferences.value.uiLocale, "dialog.close")}</button></header><div class="context-sheet__body">{children}</div></dialog>;
}
export function AuthoringPanel({ session }: { session: DocumentSession }) {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  const panel = authoring.panel.value; const locale = preferences.value.uiLocale;
  const step = panel.kind === "closed" ? undefined : session.document.value.steps.find((group) => group.id === panel.stepId);
  const missing = panel.kind !== "closed" && (!step || (panel.kind === "picture" && !step.tokens.some((token) => token.id === panel.tokenId)));
  useEffect(() => { const media = window.matchMedia("(max-width: 767px)"); const change = () => setMobile(media.matches); media.addEventListener("change", change); return () => media.removeEventListener("change", change); }, []);
  useEffect(() => { if (missing) { toast.value = { text: t(locale, "editor.targetMissing"), tone: "warning" }; closeAuthoringPanel(); } }, [missing, locale]);
  useEffect(() => { const escape = (event: KeyboardEvent) => { if (!mobile && event.key === "Escape" && !event.defaultPrevented && !window.document.querySelector("dialog[open]") && authoring.panel.peek().kind !== "closed") { event.preventDefault(); closeAuthoringPanel(); } }; window.addEventListener("keydown", escape); return () => window.removeEventListener("keydown", escape); }, [mobile]);
  if (panel.kind === "closed" || missing) return null;
  const content = panel.kind === "picker" ? <TokenPicker session={session} /> : panel.kind === "picture" ? <TokenDetails key={panel.tokenId} session={session} /> : <StepDetails key={panel.stepId} session={session} />;
  const targetKey = panel.kind === "picture" ? `picture:${panel.tokenId}` : `${panel.kind}:${panel.stepId}`;
  return <AttachmentDraftProvider key={targetKey}>{mobile
    ? <ModalDialog label={panel.kind === "picker" ? t(locale, "editor.addPicture") : t(locale, "editor.moreDetails")} onClose={closeAuthoringPanel}>{content}</ModalDialog>
    : <aside class="authoring-panel" aria-label={t(locale, "editor.moreDetails")}><header><button type="button" onClick={closeAuthoringPanel}>{t(locale, "dialog.close")}</button></header>{content}</aside>}
  </AttachmentDraftProvider>;
}
