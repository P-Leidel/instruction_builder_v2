import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OutputPage } from "../model/output";
import { prepareFontFromBuffer } from "./print-fonts";
import { renderOutputPage } from "./output-svg";

// Node has no DOM. This double observes renderer output; actual XML/paint is
// also checked by the browser artifact proof, rather than emulated here.
class NodeElement {
  attributes = new Map<string, string>();
  children: NodeElement[] = [];
  innerHTML = "";
  constructor(readonly tagName: string) {}
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  append(...children: NodeElement[]) { this.children.push(...children); }
}
afterEach(() => vi.unstubAllGlobals());
async function fonts() {
  const bytes = readFileSync("public/fonts/SourceSans3-Regular-3.052.ttf");
  return prepareFontFromBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
function dom() { vi.stubGlobal("document", { createElementNS: (_ns: string, tag: string) => new NodeElement(tag) }); }
const page: OutputPage = { index: 0, size: { widthMm: 50, heightMm: 30 }, background: "white", fragments: [
  { kind: "symbol", role: "token", source: { stepId: "g", tokenId: "t" }, iconId: "object.onion", box: { xMm: 2, yMm: 2, widthMm: 10, heightMm: 10 } },
  { kind: "text", role: "warning", source: { stepId: "g", tokenId: "t" }, text: "Äß & <script>", fontId: "source-sans-3-regular-3.052", fontSizePt: 9, box: { xMm: 2, yMm: 14, widthMm: 46, heightMm: 10 }, baselineMm: 22 },
  { kind: "connector", role: "context", source: { stepId: "g" }, from: { xMm: 15, yMm: 6 }, to: { xMm: 18, yMm: 6 } },
] };
describe("detached physical output renderer", () => {
  it("uses exact mm geometry, canonical artwork and captured source order without app CSS", async () => {
    dom(); const svg = renderOutputPage(page, await fonts()) as unknown as NodeElement;
    expect(svg.getAttribute("width")).toBe("50mm"); expect(svg.getAttribute("height")).toBe("30mm");
    expect(svg.getAttribute("viewBox")).toBe("0 0 50 30");
    expect(svg.children.map(node => node.getAttribute("data-output-role"))).toEqual([null, "token", "warning", "context"]);
    expect(svg.children[1].getAttribute("data-token-id")).toBe("t");
    expect(svg.children[1].getAttribute("stroke")).toBe("currentColor");
    expect(svg.children[1].getAttribute("color")).toBe("#111827");
    expect(svg.children[2].tagName).toBe("path"); expect(svg.children[2].innerHTML).toBe("");
    expect(svg.children[2].getAttribute("data-output-text")).toBe("Äß & <script>");
    expect(svg.children[3].getAttribute("stroke")).toBe("#475569");
  });
  it("omits the background fill on transparent pages and keeps unknown warnings as warnings", async () => {
    dom(); const svg = renderOutputPage({ ...page, background: "transparent", fragments: [{ ...page.fragments[0], kind: "symbol", role: "warning", iconId: "missing-warning", source: { tokenId: "t" }, box: { xMm: 2, yMm: 2, widthMm: 6, heightMm: 6 } }] }, await fonts()) as unknown as NodeElement;
    expect(svg.children).toHaveLength(1); expect(svg.children[0].getAttribute("data-output-role")).toBe("warning");
    expect(svg.children[0].innerHTML).toContain("path");
  });
  it("follows the orthogonal row route and points its arrow down into the next cell", async () => {
    dom();
    const routedPage = { ...page, background: "transparent" as const, fragments: [{
      kind: "connector" as const, role: "context" as const, source: { stepId: "g" },
      from: { xMm: 40, yMm: 12 }, to: { xMm: 10, yMm: 20 },
      via: [{ xMm: 40, yMm: 16 }, { xMm: 10, yMm: 16 }],
    }] };
    const svg = renderOutputPage(routedPage, await fonts()) as unknown as NodeElement;
    const path = svg.children[0];
    const points = [...path.getAttribute("d")!.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(match => [Number(match[1]), Number(match[2])]);
    expect(points.slice(0, 4)).toEqual([[40, 12], [40, 16], [10, 16], [10, 20]]);
    expect(points[4][0]).toBeLessThan(10); expect(points[4][1]).toBeLessThan(20);
    expect(points[5]).toEqual([10, 20]);
    expect(points[6][0]).toBeGreaterThan(10); expect(points[6][1]).toBeLessThan(20);
    expect(path.getAttribute("stroke-linejoin")).toBe("round");
  });
  it("refuses nonfinite or clipped connector waypoints before rendering the route", async () => {
    dom(); const prepared = await fonts();
    for (const via of [[{ xMm: 51, yMm: 16 }], [{ xMm: 10, yMm: NaN }]]) {
      const routedPage = { ...page, fragments: [{
        kind: "connector" as const, role: "context" as const, source: {},
        from: { xMm: 40, yMm: 12 }, to: { xMm: 10, yMm: 20 }, via,
      }] };
      expect(() => renderOutputPage(routedPage, prepared)).toThrow(/bounds/);
    }
  });
  it("refuses nonfinite or clipped fragments instead of relying on the SVG viewBox crop", async () => {
    dom(); const prepared = await fonts();
    for (const box of [{ xMm: -1, yMm: 2, widthMm: 10, heightMm: 10 }, { xMm: 49, yMm: 2, widthMm: 10, heightMm: 10 }, { xMm: NaN, yMm: 2, widthMm: 10, heightMm: 10 }]) {
      expect(() => renderOutputPage({ ...page, fragments: [{ ...page.fragments[0], kind: "symbol", role: "token", source: {}, iconId: "object.onion", box }] }, prepared)).toThrow(/bounds/);
    }
  });
});
