import { describe, it, expect } from "vitest";
import { iconMarkup, ICON_VIEW_BOX, ICON_PRESENTATION_PROPS } from "./icon-library";
import { SAMPLE_TOKENS } from "./sample-tokens";
import { CATALOG_ENTRIES } from "./catalog-entries";
import { ARTWORK_PROVENANCE } from "./artwork-provenance";
import { CONTENT_LIBRARIES } from "./libraries";

describe("original trusted pictograms", () => {
  it("depicts counting as grouped abacus beads instead of a bar chart", () => {
    const markup = iconMarkup("learning.action.count")!;
    expect([...markup.matchAll(/<circle\b/g)]).toHaveLength(6);
    expect(markup).toContain('<rect');
  });
  it("distinguishes pictures previously sharing unrelated stock artwork", () => {
    const ids = ["object.garlic", "object.tomato", "object.potato", "object.cheese", "object.bread", "object.salt", "object.pepper", "object.sugar", "object.rice", "object.pasta", "object.butter", "object.honey", "object.chocolate", "object.mushroom", "object.corn", "object.avocado", "object.cucumber", "object.cabbage", "object.yogurt"];
    expect(new Set(ids.map(iconMarkup)).size).toBe(ids.length);
    for (const [a, b] of [["action.fry", "action.bake"], ["action.rinse", "action.boil"], ["object.oil", "action.pour"], ["tool.thermometer", "warning.hot"], ["shared.action.more", "action.add"], ["shared.action.finished", "action.remove"]]) {
      expect(iconMarkup(a)).not.toBe(iconMarkup(b));
    }
  });
  it("keeps legacy vector presentation and no imported/remote markup", () => {
    expect(ICON_VIEW_BOX).toBe("0 0 24 24");
    expect(ICON_PRESENTATION_PROPS).toMatchObject({ fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" });
    for (const entry of SAMPLE_TOKENS) {
      expect(iconMarkup(entry.iconId)).toMatch(/<(path|circle|rect|ellipse|line|polyline|polygon)\b/);
      expect(iconMarkup(entry.iconId)).not.toMatch(/<(script|image|text|foreignObject)|href=|url\(|vector-effect/i);
    }
    expect(iconMarkup("__proto__")).toBeUndefined();
    expect(iconMarkup("unknown")).toBeUndefined();
  });

  it("bundles every canonical meaning with original source and resolved provenance", () => {
    expect(CATALOG_ENTRIES).toHaveLength(140);
    const sources = import.meta.glob("../assets/pictograms/*.svg", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
    expect(Object.keys(sources)).toHaveLength(140);
    for (const entry of CATALOG_ENTRIES) {
      const source = sources[`../assets/pictograms/${entry.iconId}.svg`];
      expect(source).toContain('viewBox="0 0 24 24"');
      expect(source).toContain('fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"');
      expect(source).not.toMatch(/<(script|image|text|foreignObject)|href=|url\(|vector-effect/i);
      expect(iconMarkup(entry.iconId)).toMatch(/<(path|circle|rect|ellipse|line|polyline|polygon)\b/);
      expect(ARTWORK_PROVENANCE[0].iconIds).toContain(entry.iconId);
      expect(ARTWORK_PROVENANCE[0].sourceFilePaths).toContain(`src/assets/pictograms/${entry.iconId}.svg`);
    }
    for (const library of CONTENT_LIBRARIES) for (const provenanceId of library.provenanceIds) {
      expect(ARTWORK_PROVENANCE.some((record) => record.id === provenanceId)).toBe(true);
    }
  });
});
