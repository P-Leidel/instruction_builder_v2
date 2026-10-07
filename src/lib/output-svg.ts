import type { OutputPage, PreparedFonts } from "../model/output";
import { ICON_PRESENTATION_PROPS } from "../data/icon-library";
import { resolveIcon } from "./library-catalog";
import { createSvgText, prepareSvgText } from "./print-font-adapters";

const NS = "http://www.w3.org/2000/svg";
const EPSILON = 1e-7;
/** One detached physical display list, shared by preview and every file format. */
export function renderOutputPage(page: OutputPage, fonts: PreparedFonts): SVGSVGElement {
  const { widthMm, heightMm } = page.size;
  if (![widthMm, heightMm].every(value => Number.isFinite(value) && value > 0)) throw new Error("Invalid output page bounds");
  const inside = (x: number, y: number, padding = 0) => Number.isFinite(x) && Number.isFinite(y) && x >= padding - EPSILON && y >= padding - EPSILON && x <= widthMm - padding + EPSILON && y <= heightMm - padding + EPSILON;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", `${widthMm}mm`); svg.setAttribute("height", `${heightMm}mm`);
  svg.setAttribute("viewBox", `0 0 ${widthMm} ${heightMm}`);
  if (page.background === "white") {
    const background = document.createElementNS(NS, "rect");
    background.setAttribute("width", String(widthMm)); background.setAttribute("height", String(heightMm)); background.setAttribute("fill", "#ffffff"); svg.append(background);
  }
  for (const fragment of page.fragments) {
    let node: SVGElement;
    if (fragment.kind === "connector") {
      const { from, to } = fragment;
      const points = [from, ...(fragment.via ?? []), to];
      if (!points.every(point => inside(point.xMm, point.yMm, .1))) throw new Error("Output connector exceeds page bounds");
      const finalStart = points.slice(0, -1).reverse().find(point => point.xMm !== to.xMm || point.yMm !== to.yMm) ?? from;
      const angle = Math.atan2(to.yMm - finalStart.yMm, to.xMm - finalStart.xMm), head = .55;
      const left = { x: to.xMm - head * Math.cos(angle - Math.PI / 6), y: to.yMm - head * Math.sin(angle - Math.PI / 6) };
      const right = { x: to.xMm - head * Math.cos(angle + Math.PI / 6), y: to.yMm - head * Math.sin(angle + Math.PI / 6) };
      if (![left, right].every(point => inside(point.x, point.y, .1))) throw new Error("Output connector exceeds page bounds");
      node = document.createElementNS(NS, "path");
      node.setAttribute("d", `M${points.map(point => `${point.xMm} ${point.yMm}`).join("L")}M${left.x} ${left.y}L${to.xMm} ${to.yMm}L${right.x} ${right.y}`);
      node.setAttribute("fill", "none"); node.setAttribute("stroke", "#475569"); node.setAttribute("stroke-width", ".2"); node.setAttribute("stroke-linecap", "round"); node.setAttribute("stroke-linejoin", "round");
    } else {
      const box = fragment.box;
      if (!Number.isFinite(box.widthMm) || !Number.isFinite(box.heightMm) || box.widthMm < 0 || box.heightMm <= 0 || !inside(box.xMm, box.yMm) || !inside(box.xMm + box.widthMm, box.yMm + box.heightMm)) throw new Error("Output fragment exceeds page bounds");
      if (fragment.kind === "text") {
        if (!Number.isFinite(fragment.baselineMm)) throw new Error("Invalid text baseline bounds");
        node = createSvgText(fragment, fonts);
        node.setAttribute("data-output-text", fragment.text);
      } else {
        if (box.widthMm <= 0) throw new Error("Invalid symbol bounds");
        node = document.createElementNS(NS, "g");
        node.setAttribute("transform", `translate(${box.xMm} ${box.yMm}) scale(${box.widthMm / 24} ${box.heightMm / 24})`);
        for (const [name, value] of Object.entries(ICON_PRESENTATION_PROPS)) node.setAttribute(name, String(value));
        node.setAttribute("color", "#111827");
        // Only bundled resolver markup reaches innerHTML; authored content is
        // outlined or assigned through escaped DOM attribute operations.
        node.innerHTML = resolveIcon(fragment.iconId).markup;
      }
    }
    node.setAttribute("data-output-role", fragment.role);
    if (fragment.source.stepId !== undefined) node.setAttribute("data-step-id", fragment.source.stepId);
    if (fragment.source.tokenId !== undefined) node.setAttribute("data-token-id", fragment.source.tokenId);
    svg.append(node);
  }
  prepareSvgText(svg, fonts);
  return svg;
}
