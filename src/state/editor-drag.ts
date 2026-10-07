import { signal } from "@preact/signals";
import type { CatalogEntry } from "../model/library";
import type { DocumentSession } from "./document";
import { sessionActions } from "./document";
import { activeGuideId } from "./guides";
import { authoring, focusPicture } from "./ui";
import { preferences } from "./preferences";
import { t } from "../i18n/messages";
import { dragThresholdFor } from "../lib/pointer-drag";
import { resolveEditorPictureDrop, resolveEditorGroupDrop, type EditorGroupRect, type EditorPictureDrop } from "../lib/editor-drop";
import { groupDropIndex, pictureDropIndex } from "../lib/editor-drop-index";

type Source = { kind: "picture"; groupId: string; tokenId: string } | { kind: "group"; groupId: string } | { kind: "library"; entry: CatalogEntry };
type GroupDrop = NonNullable<ReturnType<typeof resolveEditorGroupDrop>>;
export const editorDrag = signal<{ source: Source; x: number; y: number; label: string; pictureDrop: EditorPictureDrop | null; groupDrop: GroupDrop | null } | null>(null);
export const editorDragAnnouncement = signal("");
export const armedPictureMove = signal<{ groupId: string; tokenId: string } | null>(null);
let cancelActive: (() => void) | null = null;
let clearCancelledRelease: (() => void) | null = null;
export function cancelEditorDrag() { cancelActive?.(); armedPictureMove.value = null; }
export function armPictureMove(groupId: string, tokenId: string) { cancelEditorDrag(); armedPictureMove.value = { groupId, tokenId }; focusPicture(tokenId); }

function rectangles(): EditorGroupRect[] {
  return [...document.querySelectorAll<HTMLElement>("[data-editor-group]")].map(group => ({
    id: group.dataset.editorGroup!, rect: group.getBoundingClientRect(),
    pictures: [...group.querySelectorAll<HTMLElement>("[data-editor-picture]")].map(picture => ({ id: picture.dataset.editorPicture!, rect: picture.closest(".editor-picture")!.getBoundingClientRect() })),
  }));
}

/** Swallow only the compatibility click dispatched with this release.
 * Clearing at the end of the event turn leaves the next intentional click intact. */
function suppressReleaseClick() {
  const suppress = (event: MouseEvent) => { if (event.detail > 0) { event.preventDefault(); event.stopImmediatePropagation(); } };
  document.addEventListener("click", suppress, true);
  setTimeout(() => document.removeEventListener("click", suppress, true), 0);
}

/** A cancelled held pointer may still release over a button. A fresh press
 * clears this guard, so it can never consume the next intentional gesture. */
function suppressCancelledRelease(pointerId: number) {
  clearCancelledRelease?.();
  const clear = () => {
    window.removeEventListener("pointerup", release, true); window.removeEventListener("pointercancel", clear, true);
    window.removeEventListener("pointerdown", clear, true);
    if (clearCancelledRelease === clear) clearCancelledRelease = null;
  };
  const release = (event: PointerEvent) => { if (event.pointerId === pointerId) { suppressReleaseClick(); clear(); } };
  clearCancelledRelease = clear;
  window.addEventListener("pointerup", release, true); window.addEventListener("pointercancel", clear, true); window.addEventListener("pointerdown", clear, true);
}

/** Owns one pointer gesture; document data changes only on a valid release. */
export function beginEditorDrag(event: PointerEvent, session: DocumentSession, source: Source, label: string, handle = false) {
  const armed = armedPictureMove.peek();
  const touchMove = source.kind === "picture" && armed?.groupId === source.groupId && armed.tokenId === source.tokenId;
  if (!event.isPrimary || event.button !== 0 || (event.pointerType === "touch" && !handle && !touchMove) || document.querySelector("dialog[open]")) return;
  cancelActive?.();
  clearCancelledRelease?.();
  editorDragAnnouncement.value = "";
  const element = event.currentTarget as HTMLElement;
  const pointerId = event.pointerId, initial = session.document.peek(), guideId = activeGuideId.peek();
  const locale = preferences.peek().uiLocale, labelLocale = preferences.peek().labelLocale;
  let x = event.clientX, y = event.clientY, moved = false, cancelled = false, ended = false, frame = 0;
  const startX = x, startY = y;
  if (handle || touchMove) { event.preventDefault(); element.focus({ preventScroll: true }); }
  element.setPointerCapture(pointerId);

  const valid = () => element.isConnected && session.document.peek() === initial && activeGuideId.peek() === guideId && !document.querySelector("dialog[open]");
  function update() {
    const groups = rectangles();
    const hit = document.elementFromPoint(x, y);
    const inside = x >= 0 && x < innerWidth && y >= 0 && y < innerHeight && !hit?.closest(".authoring-panel, dialog, .editor-group-tools");
    editorDrag.value = { source, x, y, label,
      pictureDrop: inside && source.kind !== "group" ? resolveEditorPictureDrop(groups, x, y) : null,
      groupDrop: inside && source.kind === "group" ? resolveEditorGroupDrop(groups, x, y) : null,
    };
  }
  function tick() {
    if (ended || cancelled) return;
    if (!valid()) { abort(); return; }
    if (moved) {
      const edge = 56;
      // Reading fresh rectangles every frame also handles scrolling/resizing
      // without another pointermove, including this edge auto-scroll.
      const editor = document.querySelector<HTMLElement>(".instruction-editor")?.getBoundingClientRect();
      if (editor && x >= editor.left && x <= editor.right && y >= 0 && y < innerHeight) {
        const delta = y < edge ? -Math.ceil((edge - y) / 3) : y > innerHeight - edge ? Math.ceil((y - innerHeight + edge) / 3) : 0;
        if (delta) window.scrollBy(0, delta);
      }
      update();
    }
    frame = requestAnimationFrame(tick);
  }
  function move(e: PointerEvent) {
    if (e.pointerId !== pointerId || cancelled) return;
    x = e.clientX; y = e.clientY;
    if (!moved && Math.hypot(x - startX, y - startY) > dragThresholdFor(event.pointerType)) moved = true;
    if (moved) { e.preventDefault(); update(); }
  }
  function up(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    x = e.clientX; y = e.clientY;
    if (moved || cancelled || !valid()) suppressReleaseClick();
    if (!moved || cancelled || !valid()) { cleanup(); return; }
    update(); const drop = editorDrag.peek(); cleanup();
    if (!drop) return;
    const before = session.document.peek();
    if (source.kind === "group" && drop.groupDrop) {
      const index = groupDropIndex(before, drop.groupDrop); if (index === null) return;
      sessionActions.reorderSteps(session, before.steps.findIndex(group => group.id === source.groupId), index);
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-group-drag="${CSS.escape(source.groupId)}"]`)?.focus({ preventScroll: true }));
    } else if (source.kind !== "group" && drop.pictureDrop) {
      const target = drop.pictureDrop;
      const index = pictureDropIndex(before, target); if (index === null) return;
      if (source.kind === "library") {
        const tokenId = crypto.randomUUID();
        sessionActions.addTokenToStep(session, target.groupId, { id: tokenId, iconId: source.entry.iconId, category: source.entry.category, label: source.entry.labels[labelLocale] }, index);
        sessionActions.selectToken(session, target.groupId, tokenId); authoring.close(); focusPicture(tokenId);
      } else {
        sessionActions.moveToken(session, source.groupId, source.tokenId, target.groupId, index);
        if (session.document.peek() !== before) {
          sessionActions.selectToken(session, target.groupId, source.tokenId);
          const panel = authoring.panel.peek();
          if (panel.kind === "picture" && panel.tokenId === source.tokenId) authoring.panel.value = { ...panel, stepId: target.groupId };
          focusPicture(source.tokenId);
        }
      }
    }
    if (session.document.peek() !== before) editorDragAnnouncement.value = t(locale, source.kind === "group" ? "editor.groupMoved" : "editor.pictureMoved");
  }
  function pointerCancel(e: PointerEvent) { if (e.pointerId === pointerId) cleanup(); }
  function lostCapture(e: PointerEvent) { if (e.pointerId === pointerId) abort(); }
  function abort() { if (!ended) { suppressCancelledRelease(pointerId); cleanup(); } }
  function escape(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    e.preventDefault(); e.stopImmediatePropagation(); cancelled = true;
    editorDrag.value = null; cancelAnimationFrame(frame);
    // Keep the release listener until the cancelled gesture finishes, so its
    // compatibility click cannot open details after Escape.
  }
  function cleanup() {
    if (ended) return; ended = true; cancelAnimationFrame(frame); editorDrag.value = null; armedPictureMove.value = null;
    window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", up, true);
    window.removeEventListener("pointercancel", pointerCancel, true); window.removeEventListener("keydown", escape, true);
    window.removeEventListener("blur", abort); element.removeEventListener("lostpointercapture", lostCapture);
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    if (cancelActive === abort) cancelActive = null;
  }
  cancelActive = abort;
  window.addEventListener("pointermove", move, { capture: true, passive: false }); window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", pointerCancel, true); window.addEventListener("keydown", escape, true);
  window.addEventListener("blur", abort); element.addEventListener("lostpointercapture", lostCapture);
  frame = requestAnimationFrame(tick);
}
