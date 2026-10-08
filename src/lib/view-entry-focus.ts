export type EntryView = "editor" | "reader" | "guides";
export type FocusTarget = Pick<HTMLElement, "isConnected" | "focus" | "scrollIntoView">;
export interface ReaderReturnDestination { pictureId: string | null; groupId: string | null; opener: FocusTarget | null }
export interface ShellFocusAdapter {
  captureOpener(): FocusTarget | null;
  enter(view: EntryView, isCurrent: () => boolean): void;
  returnToEditor(destination: ReaderReturnDestination, isCurrent: () => boolean): void;
  restore(opener: FocusTarget | null, isCurrent: () => boolean): void;
}
interface FocusEnvironment {
  schedule(callback: () => void): void;
  hasModal(): boolean;
  captureOpener(): FocusTarget | null;
  entry(view: EntryView): FocusTarget | null;
  picture(id: string): FocusTarget | null;
  group(id: string): FocusTarget | null;
  firstAdd(): FocusTarget | null;
}

const entrySelectors: Record<EntryView, string> = {
  editor: ".guide-title input",
  reader: '[data-view-entry="reader"]',
  guides: '[data-view-entry="guides"]',
};

const browserFocus: FocusEnvironment = {
  schedule: (callback) => { requestAnimationFrame(callback); },
  hasModal: () => document.querySelector("dialog[open]") !== null,
  captureOpener: () => document.activeElement instanceof HTMLElement ? document.activeElement : null,
  entry: (view) => document.querySelector<HTMLElement>(entrySelectors[view]),
  picture: (id) => document.querySelector<HTMLElement>(`[data-editor-picture="${CSS.escape(id)}"]`),
  group: (id) => document.querySelector<HTMLElement>(`[data-add-picture="${CSS.escape(id)}"]`),
  firstAdd: () => document.querySelector<HTMLElement>("[data-add-picture], [data-add-group]"),
};

/** DOM reads happen after rendering, using the destination captured by the shell. */
export function createShellFocusAdapter(environment: FocusEnvironment = browserFocus): ShellFocusAdapter {
  function schedule(isCurrent: () => boolean, focus: () => void) {
    environment.schedule(() => { if (isCurrent() && !environment.hasModal()) focus(); });
  }
  return {
    captureOpener: environment.captureOpener,
    enter: (view, current) => schedule(current, () => environment.entry(view)?.focus({ preventScroll: true })),
    returnToEditor: ({ pictureId, groupId, opener }, current) => schedule(current, () => {
      const target = (pictureId ? environment.picture(pictureId) : null) ?? (groupId ? environment.group(groupId) : null);
      if (target) { target.focus(); target.scrollIntoView({ block: "nearest" }); }
      else if (opener?.isConnected) opener.focus();
      else environment.firstAdd()?.focus();
    }),
    restore: (opener, current) => schedule(current, () => { if (opener?.isConnected) opener.focus(); }),
  };
}

export const shellFocus = createShellFocusAdapter();
