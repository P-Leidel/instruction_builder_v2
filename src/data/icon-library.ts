/** Trusted original bundled vectors; never consumes imported SVG strings. */
const sources = import.meta.glob("../assets/pictograms/*.svg", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const markup = new Map(Object.entries(sources).map(([path, svg]) => {
  const id = path.split("/").at(-1)!.replace(/\.svg$/, "");
  const inner = svg.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/)?.[1];
  if (inner === undefined) throw new Error(`Invalid bundled pictogram: ${id}`);
  return [id, inner.trim()];
}));

export const QUANTITY_ICON_ID = "quantity.amount";
export const TIME_ICON_ID = "time.duration";
export const ICON_VIEW_BOX = "0 0 24 24";
export const ICON_PRESENTATION_PROPS = {
  fill: "none", stroke: "currentColor", "stroke-width": 2,
  "stroke-linecap": "round" as const, "stroke-linejoin": "round" as const,
};
export const UNKNOWN_ICON_MARKUP = '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 8c0-4 7-4 7 0 0 3-4 3-4 6M12 18h0"/>';

/** Legacy compatibility: unknown IDs remain undefined. */
export function iconMarkup(iconId: string): string | undefined {
  return markup.get(iconId);
}
