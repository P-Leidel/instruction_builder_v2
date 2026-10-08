import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutputPlan } from "../model/output";
import { createPdfFile, createPngFile, createSvgFile } from "./output-export";
import { svg2pdf } from "svg2pdf.js";
import { prepareFonts } from "./print-fonts";
import { Buffer } from "node:buffer";
import { crc32 } from "node:zlib";
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
// A hand-checked 1x1 greyscale/alpha PNG; all three stored CRCs are validated below.
const pngFixture = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010804000000b51c0c020000000b4944415478da63fcff1f0003030200efa2a75b0000000049454e44ae426082", "hex");
const defaultDensity = Buffer.from("000000097048597300000ec400000ec401952b0e1b", "hex");
function pngBlob(bytes: Uint8Array = pngFixture): Blob { return new Blob([new Uint8Array(bytes).buffer], { type: "image/png" }); }
function pngChunks(bytes: Buffer) {
  expect(bytes.subarray(0, 8)).toEqual(pngFixture.subarray(0, 8));
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset), end = offset + length + 12;
    expect(end).toBeLessThanOrEqual(bytes.length);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    expect(bytes.readUInt32BE(end - 4)).toBe(crc32(bytes.subarray(offset + 4, end - 4)));
    chunks.push({ type, raw: bytes.subarray(offset, end), data: bytes.subarray(offset + 8, end - 4) }); offset = end;
  }
  return chunks;
}
beforeEach(() => {
  vi.clearAllMocks(); allocations = []; imageFails = false;
  canvas = { width: 0, height: 0, getContext: vi.fn(() => ({ drawImage() {}, fillRect })), toBlob: vi.fn((callback: BlobCallback) => callback(pngBlob())) };
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
  it.each([[150, 5906, "0000000970485973000017120000171201679fd252"], [300, 11811, "000000097048597300002e2300002e230178a53f76"]] as const)("records %s dpi as one valid physical-density chunk without changing pixels", async (dpi, ppm, hex) => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
    const chunks = pngChunks(Buffer.from(await (await createPngFile(plan, 0, dpi)).arrayBuffer()));
    expect(chunks.map(chunk => chunk.type)).toEqual(["IHDR", "pHYs", "IDAT", "IEND"]);
    const density = chunks.find(chunk => chunk.type === "pHYs")!;
    expect(density.raw.toString("hex")).toBe(hex);
    expect([density.data.readUInt32BE(0), density.data.readUInt32BE(4), density.data[8]]).toEqual([ppm, ppm, 1]);
    expect(chunks.filter(chunk => chunk.type !== "pHYs").map(chunk => chunk.raw)).toEqual(pngChunks(pngFixture).map(chunk => chunk.raw));
  });
  it("replaces existing canvas density, including duplicates, with the selected density", async () => {
    const native = Buffer.concat([pngFixture.subarray(0, 33), defaultDensity, defaultDensity, pngFixture.subarray(33)]);
    canvas.toBlob.mockImplementation((callback: BlobCallback) => callback(pngBlob(native)));
    const chunks = pngChunks(Buffer.from(await (await createPngFile(plan, 1, 300)).arrayBuffer()));
    expect(chunks.filter(chunk => chunk.type === "pHYs").map(chunk => chunk.raw.toString("hex"))).toEqual(["000000097048597300002e2300002e230178a53f76"]);
    expect(chunks.filter(chunk => chunk.type !== "pHYs").map(chunk => chunk.raw)).toEqual(pngChunks(pngFixture).map(chunk => chunk.raw));
  });
  it("reports metadata read failure and releases its SVG URL", async () => {
    const blob = pngBlob(); vi.spyOn(blob, "arrayBuffer").mockRejectedValue(new Error("read failed"));
    canvas.toBlob.mockImplementation((callback: BlobCallback) => callback(blob));
    await expect(createPngFile(plan, 0, 150)).rejects.toMatchObject({ messageKey: "output.canvasUnavailable", diagnostic: expect.any(Error) });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:proof");
  });
  it.each(["signature", "truncated", "length", "end"] as const)("rejects malformed native PNG %s instead of downloading damaged output", async failure => {
    let bytes = Buffer.from(pngFixture);
    if (failure === "signature") bytes[0] = 0;
    if (failure === "truncated") bytes = bytes.subarray(0, bytes.length - 1);
    if (failure === "length") bytes.writeUInt32BE(0x7fffffff, 33);
    if (failure === "end") bytes = bytes.subarray(0, bytes.length - 12);
    canvas.toBlob.mockImplementation((callback: BlobCallback) => callback(pngBlob(bytes)));
    await expect(createPngFile(plan, 0, 150)).rejects.toMatchObject({ messageKey: "output.canvasUnavailable", diagnostic: expect.any(Error) });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:proof");
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
