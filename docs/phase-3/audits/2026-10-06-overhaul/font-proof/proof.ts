import { prepareFonts } from "../../../../../src/lib/print-fonts";
import { createSvgText, prepareSvgText, registerPdfFonts, outlineText } from "../../../../../src/lib/print-font-adapters";
import { createDefaultOutputOptions, createDefaultLabelSheet } from "../../../../../src/lib/output-options";
import { planOutput } from "../../../../../src/lib/output-plan";
import { resolveIcon } from "../../../../../src/lib/library-catalog";
import { ICON_PRESENTATION_PROPS } from "../../../../../src/data/icon-library";
import { wrapPrintText } from "../../../../../src/lib/text-layout";
import { sequenceFixture, mixedLibraryFixture, longGroupFixture, boardFixture } from "../../../../../src/test/fixtures/overhaul";
import type { OutputFragment, OutputPage, OutputPlan, PreparedFonts } from "../../../../../src/model/output";

const NS = "http://www.w3.org/2000/svg";
interface ProofArtifact { name: string; svg: string; png: string; pdf: string; size: OutputPage["size"]; painted: unknown[] }
declare global { interface Window { runFontProof: () => Promise<{ artifacts: ProofArtifact[]; plans: Record<string, OutputPlan>; coverage: { fontId: string; unsupportedJapanese: readonly number[] }; fontFaceCount: number }> } }
function svgPage(page: OutputPage, fonts: PreparedFonts): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", `${page.size.widthMm}mm`); svg.setAttribute("height", `${page.size.heightMm}mm`);
  svg.setAttribute("viewBox", `0 0 ${page.size.widthMm} ${page.size.heightMm}`);
  if (page.background === "white") { const bg = document.createElementNS(NS, "rect"); bg.setAttribute("width", String(page.size.widthMm)); bg.setAttribute("height", String(page.size.heightMm)); bg.setAttribute("fill", "white"); svg.append(bg); }
  for (const fragment of page.fragments) {
    if (fragment.kind === "text") svg.append(createSvgText(fragment, fonts));
    else if (fragment.kind === "symbol") {
      const icon = resolveIcon(fragment.iconId), group = document.createElementNS(NS, "g");
      group.setAttribute("transform", `translate(${fragment.box.xMm} ${fragment.box.yMm}) scale(${fragment.box.widthMm / 24} ${fragment.box.heightMm / 24})`);
      for (const [key, value] of Object.entries(ICON_PRESENTATION_PROPS)) group.setAttribute(key, String(value));
      group.setAttribute("color", "#111827");
      group.innerHTML = icon.markup; svg.append(group);
    } else {
      const line = document.createElementNS(NS, "line"); line.setAttribute("x1", String(fragment.from.xMm)); line.setAttribute("y1", String(fragment.from.yMm)); line.setAttribute("x2", String(fragment.to.xMm)); line.setAttribute("y2", String(fragment.to.yMm)); line.setAttribute("stroke", "#475569"); line.setAttribute("stroke-width", ".2"); svg.append(line);
    }
  }
  prepareSvgText(svg, fonts); return svg;
}
async function artifact(name: string, page: OutputPage, fonts: PreparedFonts): Promise<ProofArtifact> {
  const svg = svgPage(page, fonts), serialized = new XMLSerializer().serializeToString(svg);
  const image = new Image(); await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = URL.createObjectURL(new Blob([serialized], { type: "image/svg+xml" })); });
  const canvas = document.createElement("canvas"); canvas.width = Math.round(page.size.widthMm / 25.4 * 150); canvas.height = Math.round(page.size.heightMm / 25.4 * 150);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(image.src);
  const { jsPDF } = await import("jspdf"); await import("svg2pdf.js");
  const pdf = new jsPDF({ unit: "mm", format: [page.size.widthMm, page.size.heightMm], orientation: page.size.widthMm > page.size.heightMm ? "landscape" : "portrait", compress: false });
  registerPdfFonts(pdf, fonts); document.body.append(svg); await pdf.svg(svg, { x: 0, y: 0, width: page.size.widthMm, height: page.size.heightMm }); svg.remove();
  const bytes = new Uint8Array(pdf.output("arraybuffer")); let raw = ""; for (const byte of bytes) raw += String.fromCharCode(byte);
  return { name, svg: serialized, png: canvas.toDataURL("image/png").split(",")[1], pdf: btoa(raw), size: page.size,
    painted: page.fragments.filter(fragment => fragment.kind === "text").map(fragment => ({ text: fragment.text, box: fragment.box, baselineMm: fragment.baselineMm, sizePt: fragment.fontSizePt, measureMm: fonts.measureWidthMm(fragment.text, fragment.fontSizePt), bounds: outlineText(fragment.text, fragment.fontSizePt, fonts).bounds })) };
}
window.runFontProof = async () => {
  const fonts = await prepareFonts(), plans: Record<string, OutputPlan> = {};
  const mixed = mixedLibraryFixture(); mixed.meta.title = "ÄÖÜ äöü ß ẞ – “Größe” — café déjà vu";
  mixed.steps[0].tokens[0].label = "jWWWWWWWWWWWWWWWWWWj\nDonaudampfschifffahrtsgesellschaft";
  mixed.steps[0].tokens[0].quantity = { iconId: "quantity.amount", amount: 2, unit: "small cups", label: "" };
  mixed.steps[0].tokens[0].warning = { iconId: "missing-warning", label: "Beware: sharp edge — j" };
  mixed.steps[0].tokens[0].time = { iconId: "time.duration", seconds: 300, label: " \t\n " };
  mixed.steps[0].time = { iconId: "time.duration", seconds: 300, label: "" };
  mixed.steps[0].tokens[1].label = "A\u0308 e\u0301 ’j café j";
  for (const [name, doc] of [["mixed", mixed], ["board", boardFixture()], ["long20", longGroupFixture(20)], ["long85", longGroupFixture(85)]] as const) {
    const result = planOutput(doc, createDefaultOutputOptions(doc, "de"), fonts); if (!result.ok) throw new Error(JSON.stringify(result.issues)); plans[name] = result.plan;
  }
  const labels = sequenceFixture(); labels.steps = Array.from({ length: 25 }, (_, index) => ({ id: `group-${index}`, tokens: [{ id: `token-${index}`, category: "object", iconId: "object.onion" }] }));
  const options = createDefaultOutputOptions(labels, "en", "label"); options.metadata.groupTitles = false; options.metadata.stepNumbers = false; options.labelSheet = createDefaultLabelSheet();
  const labelPlan = planOutput(labels, options, fonts); if (!labelPlan.ok) throw new Error(JSON.stringify(labelPlan.issues)); plans.labels25 = labelPlan.plan;
  const diagnostic: OutputPage = { index: 0, size: { widthMm: 190, heightMm: 120 }, background: "white", fragments: [] };
  const fragments: OutputFragment[] = []; let y = 3;
  for (const [value, width] of [["English: prepare 2 small cups", 180], ["ÄÖÜ äöü ß ẞ – “Größe” — café déjà vu", 180], ["A\u0308 e\u0301 0123456789 & < > ’j j", 180], ["WWWWWWWWWWWWWWWWWW", 25], ["Donaudampfschifffahrtsgesellschaft", 30], ["jÄ café j", 180]] as const) {
    const wrapped = wrapPrintText(value, width, 10, fonts); if (!wrapped.ok) throw new Error("Diagnostic wrap failed");
    for (const line of wrapped.lines) { const height = fonts.lineHeightMm(10); fragments.push({ kind: "text", source: {}, role: "label", box: { xMm: 3, yMm: y, widthMm: width, heightMm: height }, text: line, fontId: fonts.fontId, fontSizePt: 10, baselineMm: y + height * .8 }); y += height; } y += 3;
  }
  const boundary = "jÄÖÜ ß café j", width = fonts.measureWidthMm(boundary, 10), height = fonts.lineHeightMm(10);
  fragments.push({ kind: "text", source: {}, role: "label", box: { xMm: 188 - width, yMm: 118 - height, widthMm: width, heightMm: height }, text: boundary, fontId: fonts.fontId, fontSizePt: 10, baselineMm: 118 - height * .2 });
  diagnostic.fragments = fragments;
  return { artifacts: [await artifact("diagnostic", diagnostic, fonts), await artifact("composition", plans.mixed.pages[0], fonts)], plans, coverage: { fontId: fonts.fontId, unsupportedJapanese: fonts.unsupportedCodePoints("日本語") }, fontFaceCount: document.fonts.size };
};
async function readiness() {
  await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
  document.documentElement.dataset.ready = "true";
}
void readiness();
