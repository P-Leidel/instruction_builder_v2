import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutputPlan } from "../model/output";
import { createPdfFile, createPngFile, createSvgFile } from "./output-export";
import { svg2pdf } from "svg2pdf.js";
import { prepareFonts } from "./print-fonts";
vi.mock("./print-fonts", () => ({ prepareFonts: vi.fn(async () => ({ fontId: "prepared" })) }));
vi.mock("./print-font-adapters", () => ({ registerPdfFonts() {} }));
vi.mock("./output-svg", () => ({ renderOutputPage: (page: OutputPlan["pages"][number]) => ({ tagName: "svg", page, style: {}, setAttribute() {}, remove() {} }) }));
vi.mock("svg2pdf.js", () => ({ svg2pdf: vi.fn(async () => undefined) }));
const plan: OutputPlan = { documentTitle: "Captured Ä", presentation: "sequence", options: { preset: "label", locale: "en", orientation: "portrait", mode: "pictures", selectedStepIds: ["g"], background: "transparent", metadata: { documentTitle: false, groupTitles: false, stepNumbers: false, totalTime: false } }, notices: [], pages: [
  { index: 0, size: { widthMm: 50, heightMm: 30 }, background: "transparent", fragments: [] },
  { index: 1, size: { widthMm: 210, heightMm: 297 }, background: "white", fragments: [] },
] };
let allocations: string[], canvas: { width: number; height: number; getContext: ReturnType<typeof vi.fn>; toBlob: ReturnType<typeof vi.fn> };
let imageFails = false; const fillRect = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); allocations = []; imageFails = false;
  canvas = { width: 0, height: 0, getContext: vi.fn(() => ({ drawImage() {}, fillRect })), toBlob: vi.fn((callback: BlobCallback) => callback(new Blob(["png"], { type: "image/png" }))) };
  vi.stubGlobal("document", { body: { append() {} }, createElement: (tag: string) => { allocations.push(tag); return canvas; } });
  vi.stubGlobal("XMLSerializer", class { serializeToString(node: { page: OutputPlan["pages"][number] }) { return `<svg width="${node.page.size.widthMm}mm" height="${node.page.size.heightMm}mm"/>`; } });
  vi.stubGlobal("Image", class { onload?: () => void; onerror?: () => void; constructor() { allocations.push("Image"); } set src(_value: string) { queueMicrotask(() => imageFails ? this.onerror?.() : this.onload?.()); } });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:proof"); vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("physical artifact creation without downloads", () => {
  it("serializes only the selected physical page and rejects invalid indices", async () => {
    const blob = await createSvgFile(plan, 1); expect(blob.type).toBe("image/svg+xml"); expect(await blob.text()).toContain('width="210mm"');
    for (const index of [-1, 2, .5, NaN, Infinity]) await expect(createSvgFile(plan, index)).rejects.toMatchObject({ issue: { code: "invalid-options" } });
    expect(allocations).toEqual([]);
  });
  it.each([[150, 295, 177], [300, 591, 354]] as const)("rasterizes the chosen vector page at %s dpi", async (dpi, width, height) => {
    const blob = await createPngFile(plan, 0, dpi); expect(blob.type).toBe("image/png");
    expect([canvas.width, canvas.height]).toEqual([width, height]); expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:proof");
  });
  it("rejects unsupported density and over-limit pages before any Image or canvas allocation", async () => {
    for (const dpi of [0, 72, NaN, 600]) await expect(createPngFile(plan, 0, dpi as 150)).rejects.toMatchObject({ issue: { code: "invalid-options" } });
    const huge = { ...plan, pages: [{ ...plan.pages[0], size: { widthMm: 1000, heightMm: 1000 } }] };
    await expect(createPngFile(huge, 0, 150)).rejects.toMatchObject({ issue: { code: "raster-limit" } });
    expect(allocations).toEqual([]); expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it("accepts the 24M pixel boundary and refuses the first pixel above it", async () => {
    const atLimit = { ...plan, pages: [{ ...plan.pages[0], size: { widthMm: 6000 * 25.4 / 150, heightMm: 4000 * 25.4 / 150 } }] };
    await createPngFile(atLimit, 0, 150); expect([canvas.width, canvas.height]).toEqual([6000, 4000]);
    allocations = []; const above = { ...atLimit, pages: [{ ...atLimit.pages[0], size: { widthMm: 6001 * 25.4 / 150, heightMm: 4000 * 25.4 / 150 } }] };
    await expect(createPngFile(above, 0, 150)).rejects.toMatchObject({ issue: { code: "raster-limit" } }); expect(allocations).toEqual([]);
  });
  it("fills a white destination through its pixel edges while keeping transparent pages unfilled", async () => {
    await createPngFile(plan, 1, 150); expect(fillRect).toHaveBeenCalledWith(0, 0, 1240, 1754);
    fillRect.mockClear(); await createPngFile(plan, 0, 150); expect(fillRect).not.toHaveBeenCalled();
  });
  it.each(["image", "context", "blob", "dimensions"] as const)("rejects failed %s raster output and releases its URL", async failure => {
    if (failure === "image") imageFails = true;
    if (failure === "context") canvas.getContext.mockReturnValue(null);
    if (failure === "blob") canvas.toBlob.mockImplementation((callback: BlobCallback) => callback(null));
    if (failure === "dimensions") Object.defineProperty(canvas, "width", { get: () => 0, set: () => undefined });
    await expect(createPngFile(plan, 0, 150)).rejects.toThrow(); expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:proof");
  });
  it("includes every page at its own mm dimensions with no independent PDF heading", async () => {
    const blob = await createPdfFile(plan), raw = await blob.text();
    expect(blob.type).toBe("application/pdf"); expect(raw).toMatch(/^%PDF-/);
    expect([...raw.matchAll(/\/Type \/Page\b/g)]).toHaveLength(2); expect(raw).not.toContain("Captured");
    expect(vi.mocked(svg2pdf).mock.calls.map(call => call[2])).toEqual([{ x: 0, y: 0, width: 50, height: 30 }, { x: 0, y: 0, width: 210, height: 297 }]);
    await expect(createPdfFile({ ...plan, pages: [] })).rejects.toThrow();
  });
  it("rejects a converter error instead of returning a partial PDF", async () => {
    vi.mocked(svg2pdf).mockRejectedValueOnce(new Error("converter failed"));
    await expect(createPdfFile(plan)).rejects.toThrow("converter failed");
  });
  it("reports font preparation failure as a shared issue without losing its diagnostics", async () => {
    vi.mocked(prepareFonts).mockRejectedValueOnce(new Error("offline missing font"));
    await expect(createSvgFile(plan, 0)).rejects.toMatchObject({ issue: { code: "font-unavailable" }, diagnostic: expect.any(Error) });
  });
});
