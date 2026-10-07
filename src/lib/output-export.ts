import type { OutputIssue, OutputPage, OutputPlan, PreparedFonts } from "../model/output";
import { prepareFonts } from "./print-fonts";
import { registerPdfFonts } from "./print-font-adapters";
import { renderOutputPage } from "./output-svg";

/** Localized expected failure plus preserved technical context for diagnostics. */
export class OutputExportError extends Error {
  constructor(readonly issue?: OutputIssue, readonly messageKey: "output.failed" | "output.canvasUnavailable" = "output.failed", readonly diagnostic?: unknown) { super(issue?.code ?? messageKey); }
}
function invalid(): never { throw new OutputExportError({ code: "invalid-options", messageKey: "output.invalidOptions" }); }
function selectedPage(plan: OutputPlan, index: number): OutputPage {
  if (!Number.isInteger(index) || index < 0 || index >= plan.pages.length) return invalid();
  const page = plan.pages[index];
  if (![page.size.widthMm, page.size.heightMm].every(value => Number.isFinite(value) && value > 0)) return invalid();
  return structuredClone(page);
}
async function fonts(): Promise<PreparedFonts> {
  try { return await prepareFonts(); }
  catch (error) { throw new OutputExportError({ code: "font-unavailable", messageKey: "output.fontUnavailable" }, "output.failed", error); }
}
function serialize(svg: SVGSVGElement): Blob {
  return new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`], { type: "image/svg+xml" });
}

export async function createSvgFile(plan: OutputPlan, pageIndex: number): Promise<Blob> {
  const page = selectedPage(plan, pageIndex);
  return serialize(renderOutputPage(page, await fonts()));
}

export async function createPngFile(plan: OutputPlan, pageIndex: number, dpi: 150 | 300): Promise<Blob> {
  const page = selectedPage(plan, pageIndex);
  if (dpi !== 150 && dpi !== 300) return invalid();
  const width = Math.round(page.size.widthMm / 25.4 * dpi), height = Math.round(page.size.heightMm / 25.4 * dpi);
  if (![width, height].every(value => Number.isSafeInteger(value) && value > 0)) return invalid();
  if (width * height > 24_000_000) throw new OutputExportError({ code: "raster-limit", messageKey: "output.rasterLimit" });
  // Budget validation precedes font rendering and every Image/canvas allocation.
  const source = serialize(renderOutputPage(page, await fonts())), url = URL.createObjectURL(source);
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const image = new Image();
      const fail = (error?: unknown) => reject(new OutputExportError(undefined, "output.canvasUnavailable", error));
      image.onerror = fail;
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
          if (canvas.width !== width || canvas.height !== height) { fail(); return; }
          const context = canvas.getContext("2d");
          if (!context) { fail(); return; }
          if (page.background === "white") { context.fillStyle = "#ffffff"; context.fillRect(0, 0, width, height); }
          context.drawImage(image, 0, 0, width, height);
          canvas.toBlob(blob => blob ? resolve(blob) : fail(), "image/png");
        } catch (error) { fail(error); }
      };
      image.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

export async function createPdfFile(plan: OutputPlan): Promise<Blob> {
  if (!plan.pages.length) return invalid();
  const pages = plan.pages.map((_page, index) => selectedPage(plan, index));
  const prepared = await fonts();
  // The editor/dialog can prepare SVG without executing any converter module.
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import("jspdf"), import("svg2pdf.js")]);
  const orientation = (page: OutputPage) => page.size.widthMm > page.size.heightMm ? "landscape" as const : "portrait" as const;
  const pdf = new jsPDF({ unit: "mm", format: [pages[0].size.widthMm, pages[0].size.heightMm], orientation: orientation(pages[0]) });
  registerPdfFonts(pdf, prepared);
  for (const [index, page] of pages.entries()) {
    if (index) pdf.addPage([page.size.widthMm, page.size.heightMm], orientation(page));
    const svg = renderOutputPage(page, prepared);
    // svg2pdf reads SVG presentation in a document. Offscreen placement keeps
    // this temporary vector source out of the dialog and keyboard traversal.
    svg.setAttribute("aria-hidden", "true"); svg.style.position = "absolute"; svg.style.left = "-10000px";
    document.body.append(svg);
    try { await svg2pdf(svg, pdf, { x: 0, y: 0, width: page.size.widthMm, height: page.size.heightMm }); }
    finally { svg.remove(); }
  }
  return pdf.output("blob");
}
