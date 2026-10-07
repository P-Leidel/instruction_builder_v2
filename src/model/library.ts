import type { TokenCategory } from "./instruction";

export type AppLocale = "en" | "de";
export type LibraryId = "kitchen" | "routines" | "learning";

export interface CatalogEntry {
  iconId: string;
  category: TokenCategory;
  labels: Record<AppLocale, string>;
  aliases: Record<AppLocale, readonly string[]>;
}

export interface ContentLibrary {
  id: LibraryId;
  names: Record<AppLocale, string>;
  entries: readonly CatalogEntry[];
  provenanceIds: readonly string[];
}

export interface ResolvedIcon {
  iconId: string;
  known: boolean;
  viewBox: "0 0 24 24";
  markup: string;
}
