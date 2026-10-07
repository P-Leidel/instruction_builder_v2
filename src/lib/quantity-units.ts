import type { AppLocale, LibraryId } from "../model/library";
import { EU_FOOD_UNITS, type UnitOption } from "../data/units";

const german: readonly UnitOption[] = Object.freeze([
  { value: "g", label: "g (Gramm)" }, { value: "kg", label: "kg (Kilogramm)" },
  { value: "ml", label: "ml (Milliliter)" }, { value: "l", label: "l (Liter)" },
  { value: "tsp", label: "TL (Teelöffel)" }, { value: "tbsp", label: "EL (Esslöffel)" },
  { value: "pinch", label: "Prise" }, { value: "pcs", label: "Stück" },
].map((unit) => Object.freeze(unit)));
const english: readonly UnitOption[] = Object.freeze(EU_FOOD_UNITS.map((unit) => Object.freeze({ ...unit })));

/** Suggestions only: never transforms or validates an authored unit string. */
export function getSuggestedUnits(libraryId: LibraryId, locale: AppLocale): readonly UnitOption[] {
  const units = locale === "de" ? german : english;
  return libraryId === "kitchen" ? units : units.slice(-1);
}
