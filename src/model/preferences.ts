import type { AppLocale, LibraryId } from "./library";

export interface AppPreferences {
  uiLocale: AppLocale;
  labelLocale: AppLocale;
  theme: "light" | "dark";
  activeLibraryId: LibraryId;
  lastGuideId?: string;
}
