export type EntryView = "editor" | "reader" | "guides";

const entrySelectors: Record<EntryView, string> = {
  editor: ".guide-title input",
  reader: '[data-view-entry="reader"]',
  guides: '[data-view-entry="guides"]',
};

/** Wait for the destination render and modal cleanup after a successful action. */
export function focusViewEntry(view: EntryView, isCurrent: () => boolean) {
  requestAnimationFrame(() => {
    if (!isCurrent() || document.querySelector("dialog[open]")) return;
    document.querySelector<HTMLElement>(entrySelectors[view])?.focus({ preventScroll: true });
  });
}
