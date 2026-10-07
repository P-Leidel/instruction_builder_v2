import type { AppLocale, CatalogEntry, ContentLibrary, LibraryId, ResolvedIcon } from "../model/library";
import type { TokenAttachment, TokenCategory } from "../model/instruction";
import { CATALOG_ENTRIES } from "../data/catalog-entries";
import { CONTENT_LIBRARIES } from "../data/libraries";
import { iconMarkup, ICON_VIEW_BOX, UNKNOWN_ICON_MARKUP } from "../data/icon-library";
import { t } from "../i18n/messages";

const entries = new Map(CATALOG_ENTRIES.map((entry) => [entry.iconId, entry]));
const libraries = new Map(CONTENT_LIBRARIES.map((library) => [library.id, library]));

export function getLibrary(id: LibraryId): ContentLibrary {
  const library = libraries.get(id);
  if (!library) throw new Error(`Unknown bundled library: ${id}`);
  return library;
}
export function getCatalogEntry(iconId: string): CatalogEntry | undefined {
  return entries.get(iconId);
}
function normalize(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/ß/g, "ss").trim().replace(/\s+/g, " ");
}
export function findLibraryEntries(library: ContentLibrary, query: string, locale: AppLocale,
  category?: TokenCategory): readonly CatalogEntry[] {
  const words = normalize(query).split(" ").filter(Boolean);
  const seen = new Set<string>();
  return library.entries.filter((entry) => {
    if (seen.has(entry.iconId) || (category && entry.category !== category)) return false;
    seen.add(entry.iconId);
    const text = normalize([entry.labels[locale], ...entry.aliases[locale]].join(" "));
    return words.every((word) => text.includes(word));
  });
}
export function resolveIcon(iconId: string): ResolvedIcon {
  const markup = iconMarkup(iconId);
  return { iconId, known: markup !== undefined, viewBox: ICON_VIEW_BOX, markup: markup ?? UNKNOWN_ICON_MARKUP };
}
export function getWarningMeaning(warning: TokenAttachment, locale: AppLocale): string {
  if (warning.label?.trim()) return warning.label;
  const entry = getCatalogEntry(warning.iconId);
  return entry?.category === "warning" ? entry.labels[locale] : t(locale, "catalog.unknownWarning", { iconId: warning.iconId });
}
