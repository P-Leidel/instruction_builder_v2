import { readFileSync } from "node:fs";
import { Path } from "opentype.js";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { InstructionDocument, InstructionToken } from "../model/instruction";
import type { MmBox, OutputOptions, OutputPlan, OutputPreset, PreparedFonts } from "../model/output";
import { planOutput } from "./output-plan";
import { createDefaultOutputOptions, normalizeOutputOptions } from "./output-options";
import { prepareFontFromBuffer } from "./print-fonts";
import { outlineText } from "./print-font-adapters";
import { renderOutputPage } from "./output-svg";

const EPSILON = 1e-6;
const orientations = ["portrait", "landscape"] as const;
let fonts: PreparedFonts;
beforeAll(async () => {
  const bytes = readFileSync("public/fonts/SourceSans3-Regular-3.052.ttf");
  fonts = await prepareFontFromBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
});
afterEach(() => vi.unstubAllGlobals());

// Observe the production renderer's attributes, without inventing DOM layout
// or font metrics. Actual standalone raster/vector reopening has separate proof.
class RenderedElement {
  attributes = new Map<string, string>();
  children: RenderedElement[] = [];
  innerHTML = "";
  constructor(readonly tagName: string) {}
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  append(...nodes: RenderedElement[]) { this.children.push(...nodes); }
}
// opentype.js 2 provides this parser; its older declaration package omits it.
const svgPath = Path as typeof Path & {
  fromSVG(data: string, options: { flipY: boolean; decimalPlaces: number }): Path;
};

function documentWith(groups: number, pictures: number, attachments = false): InstructionDocument {
  const token = (group: number, index: number): InstructionToken => ({
    id: `margin-${group}-${index}`, category: "object", iconId: "object.banana", label: "jÄÖÜ ß j",
    ...(attachments ? {
      quantity: { iconId: "quantity.amount", label: "5435 g", amount: 5435, unit: "g" },
      warning: { iconId: "warning.sharp", label: "Sharp!" },
      time: { iconId: "time.duration", label: "9m 3s", seconds: 543 },
    } : {}),
  });
  return {
    schemaVersion: 2,
    meta: { title: "jÄÖÜ ß – café j", domain: "margin-fixture", presentation: "sequence", createdAt: "2026-10-07T00:00:00Z" },
    steps: Array.from({ length: groups }, (_, group) => ({ id: `margin-group-${group}`, tokens: Array.from({ length: pictures }, (_, index) => token(group, index)) })),
  };
}
function noMetadata(options: OutputOptions) {
  options.metadata = { documentTitle: false, groupTitles: false, stepNumbers: false, totalTime: false };
}
function planned(doc: InstructionDocument, options: OutputOptions): OutputPlan {
  const result = planOutput(doc, options, fonts);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  expect(result.plan.pages.flatMap(page => page.fragments.filter(fragment => fragment.kind === "symbol" && fragment.role === "token").map(fragment => fragment.source.tokenId)))
    .toEqual(doc.steps.flatMap(group => group.tokens.map(token => token.id)));
  return result.plan;
}
function inset(box: MmBox, margin: number): MmBox {
  return { xMm: box.xMm + margin, yMm: box.yMm + margin, widthMm: box.widthMm - 2 * margin, heightMm: box.heightMm - 2 * margin };
}
function within(bounds: { x1: number; y1: number; x2: number; y2: number }, region: MmBox) {
  expect(Object.values(bounds).every(Number.isFinite)).toBe(true);
  expect(bounds.x1).toBeGreaterThanOrEqual(region.xMm - EPSILON);
  expect(bounds.y1).toBeGreaterThanOrEqual(region.yMm - EPSILON);
  expect(bounds.x2).toBeLessThanOrEqual(region.xMm + region.widthMm + EPSILON);
  expect(bounds.y2).toBeLessThanOrEqual(region.yMm + region.heightMm + EPSILON);
}
function checkPaintedMargins(plan: OutputPlan, regionFor: (page: number, stepId?: string) => MmBox) {
  vi.stubGlobal("document", { createElementNS: (_namespace: string, tag: string) => new RenderedElement(tag) });
  let textCount = 0, symbolCount = 0, connectorCount = 0;
  for (const page of plan.pages) {
    const svg = renderOutputPage(page, fonts) as unknown as RenderedElement;
    const nodes = svg.children.filter(node => node.getAttribute("data-output-role") !== null);
    expect(nodes).toHaveLength(page.fragments.length);
    page.fragments.forEach((fragment, index) => {
      const region = regionFor(page.index, fragment.source.stepId), node = nodes[index];
      if (fragment.kind === "connector") {
        // Parse the actual emitted arrow path, including its head, and expand
        // by the actual stroke radius. Do not reconstruct planner arrows.
        const path = svgPath.fromSVG(node.getAttribute("d")!, { flipY: false, decimalPlaces: 8 }).getBoundingBox();
        const radius = Number(node.getAttribute("stroke-width")) / 2;
        expect(radius).toBeGreaterThan(0);
        within({ x1: path.x1 - radius, y1: path.y1 - radius, x2: path.x2 + radius, y2: path.y2 + radius }, region);
        connectorCount++;
      } else {
        const box = fragment.box;
        // Canonical artwork fits its 24-unit viewBox including strokes; its
        // assigned symbol box is a conservative painted envelope.
        within({ x1: box.xMm, y1: box.yMm, x2: box.xMm + box.widthMm, y2: box.yMm + box.heightMm }, region);
        if (fragment.kind === "text") {
          const glyph = outlineText(fragment.text, fragment.fontSizePt, fonts).bounds;
          expect(node.tagName).toBe("path");
          expect(node.getAttribute("transform")).toBe(`translate(${box.xMm} ${fragment.baselineMm})`);
          within({ x1: box.xMm + glyph.x1, y1: fragment.baselineMm + glyph.y1, x2: box.xMm + glyph.x2, y2: fragment.baselineMm + glyph.y2 }, region);
          textCount++;
        } else { expect(node.tagName).toBe("g"); symbolCount++; }
      }
    });
  }
  expect(textCount).toBeGreaterThan(0);
  expect(symbolCount).toBeGreaterThan(0);
  return connectorCount;
}
function normalized(doc: InstructionDocument, options: OutputOptions) {
  const result = normalizeOutputOptions(doc, options);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result;
}

describe("physical padding of painted output", () => {
  it.each(orientations)("retains 2 mm inside a standalone label in %s", orientation => {
    const doc = documentWith(1, 1), options = createDefaultOutputOptions(doc, "de", "label");
    options.orientation = orientation; noMetadata(options);
    const geometry = normalized(doc, options), plan = planned(doc, options);
    expect(geometry.marginMm).toBe(2);
    expect(plan.pages).toHaveLength(1);
    checkPaintedMargins(plan, () => inset(geometry.regions[0], 2));
  });

  it.each(orientations)("insets each assigned cell by 2 mm on a zero-outer-margin %s label sheet", orientation => {
    const doc = documentWith(5, 1), options = createDefaultOutputOptions(doc, "de", "label");
    options.orientation = orientation; noMetadata(options);
    const label = normalized(doc, options).regions[0];
    options.labelSheet = { pageSize: { widthMm: 2 * label.widthMm, heightMm: 2 * label.heightMm }, marginMm: 0, gapMm: 0, columns: 2, rows: 2 };
    const geometry = normalized(doc, options), plan = planned(doc, options);
    expect(geometry.marginMm).toBe(2);
    expect(geometry.regions[0].xMm).toBe(0); expect(geometry.regions[0].yMm).toBe(0);
    const last = geometry.regions[3];
    expect(last.xMm + last.widthMm).toBe(geometry.pageSize.widthMm);
    expect(last.yMm + last.heightMm).toBe(geometry.pageSize.heightMm);
    expect(plan.pages).toHaveLength(2);
    checkPaintedMargins(plan, (page, stepId) => {
      const index = doc.steps.findIndex(group => group.id === stepId);
      expect(index).toBeGreaterThanOrEqual(0); expect(Math.floor(index / 4)).toBe(page);
      return inset(geometry.regions[index % 4], 2);
    });
  });

  it.each(orientations)("retains 5 mm around complete attachment-bearing cards in %s", orientation => {
    const doc = documentWith(3, 2, true), options = createDefaultOutputOptions(doc, "en", "card");
    options.orientation = orientation; noMetadata(options);
    const geometry = normalized(doc, options), plan = planned(doc, options);
    expect(geometry.marginMm).toBe(5); expect(plan.pages).toHaveLength(3);
    expect(checkPaintedMargins(plan, () => inset(geometry.regions[0], 5))).toBeGreaterThan(0);
  });

  it.each((["sheet", "large", "custom"] as const).flatMap(preset => orientations.map(orientation => ({ preset, orientation }))))("retains 10 mm around continued $preset pages in $orientation", ({ preset, orientation }: { preset: OutputPreset; orientation: OutputOptions["orientation"] }) => {
      const doc = documentWith(1, 85, true), options = createDefaultOutputOptions(doc, "en", preset);
      options.orientation = orientation;
      if (preset === "custom") options.customSize = { widthMm: 120, heightMm: 140 };
      const geometry = normalized(doc, options), plan = planned(doc, options);
      expect(geometry.marginMm).toBe(10); expect(plan.pages.length).toBeGreaterThan(1);
      for (const page of plan.pages.slice(1)) expect(page.fragments.some(fragment => fragment.kind === "text" && fragment.role === "context" && fragment.text.includes("continued"))).toBe(true);
      expect(checkPaintedMargins(plan, () => inset({ xMm: 0, yMm: 0, ...geometry.pageSize }, 10))).toBeGreaterThan(0);
    });

  it("protects the right edge on a narrow custom page while wrapping real overhang glyphs", () => {
    const doc = documentWith(1, 1), options = createDefaultOutputOptions(doc, "de", "custom");
    doc.steps[0].tokens[0].label = "jWWWWWWWWWWWWWWWWWWWWj";
    options.customSize = { widthMm: 64, heightMm: 116 }; noMetadata(options);
    const geometry = normalized(doc, options), plan = planned(doc, options);
    const main = plan.pages[0].fragments.find(fragment => fragment.kind === "symbol" && fragment.role === "token");
    expect(main).toMatchObject({ box: { xMm: 24.5, widthMm: 15 } });
    const lines = plan.pages[0].fragments.filter(fragment => fragment.kind === "text");
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map(fragment => fragment.text).join("")).toBe(doc.steps[0].tokens[0].label);
    checkPaintedMargins(plan, () => inset(geometry.regions[0], 10));
  });
});
