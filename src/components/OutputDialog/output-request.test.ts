import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { sequenceFixture } from "../../test/fixtures/overhaul";
import { prepareFontFromBuffer } from "../../lib/print-fonts";
import type { PreparedFonts } from "../../model/output";
import { createDefaultOutputOptions } from "../../lib/output-options";
import { createOutputRequestController, type OutputRequestDependencies } from "./output-request";

let fonts: PreparedFonts;
beforeAll(async () => {
  const bytes = readFileSync("public/fonts/SourceSans3-Regular-3.052.ttf");
  fonts = await prepareFontFromBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
});
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
function fixture(overrides: Partial<OutputRequestDependencies> = {}) {
  const doc = sequenceFixture(); doc.meta.title = "Captured Guide";
  const downloads: { blob: Blob; filename: string }[] = [];
  const dependencies: OutputRequestDependencies = {
    prepareFonts: async () => fonts,
    createSvgFile: async (plan, index) => new Blob([JSON.stringify({ title: plan.documentTitle, index, mode: plan.options.mode })]),
    createPngFile: async (plan, index, dpi) => new Blob([JSON.stringify({ title: plan.documentTitle, index, dpi })]),
    createPdfFile: async plan => new Blob([JSON.stringify({ title: plan.documentTitle, pages: plan.pages.length })]),
    downloadBlob: (blob, filename) => downloads.push({ blob, filename }), ...overrides,
  };
  return { doc, downloads, controller: createOutputRequestController(doc, "guide-a", "en", dependencies), options: createDefaultOutputOptions(doc, "en") };
}
describe("captured output request consent", () => {
  it("captures shared editor choices without sharing a mutable options object", async () => {
    const { doc } = fixture();
    const shared = { ...createDefaultOutputOptions(doc, "en"), preset: "large" as const, orientation: "landscape" as const };
    const controller = createOutputRequestController(doc, "guide", "en", { prepareFonts: async () => fonts }, shared);
    shared.metadata.documentTitle = false;
    expect(controller.state.peek().options).toMatchObject({ preset: "large", orientation: "landscape", metadata: { documentTitle: true } });
    await controller.requestOptions(controller.state.peek().options);
    expect(controller.state.peek().plan?.options.preset).toBe("large");
  });
  it("accepts only the newest settings request and clones settings before asynchronous preparation", async () => {
    const first = deferred<PreparedFonts>(), second = deferred<PreparedFonts>(); let calls = 0;
    const { controller, options } = fixture({ prepareFonts: () => (++calls === 1 ? first : second).promise });
    const older = controller.requestOptions(options), newer = controller.requestOptions({ ...options, mode: "pictures" });
    options.metadata.documentTitle = false;
    second.resolve(fonts); await newer; expect(controller.state.peek().status).toBe("ready");
    first.resolve(fonts); await older;
    expect(controller.state.peek().plan?.options.mode).toBe("pictures"); expect(controller.state.peek().plan?.options.metadata.documentTitle).toBe(true);
  });
  it("requires explicit Refresh after a source change, even when settings change while stale", async () => {
    const pending = deferred<PreparedFonts>(); let calls = 0;
    const { controller, doc, options } = fixture({ prepareFonts: () => ++calls === 1 ? pending.promise : Promise.resolve(fonts) });
    const preparing = controller.requestOptions(options), next = structuredClone(doc); next.meta.title = "New source";
    controller.observeSource(next, "guide-a"); pending.resolve(fonts); await preparing;
    expect(controller.state.peek().status).toBe("stale"); expect(controller.state.peek().plan).toBeUndefined();
    await controller.requestOptions({ ...options, mode: "pictures" }); expect(controller.state.peek().status).toBe("stale"); expect(calls).toBe(1);
    await controller.refreshSource(); expect(controller.state.peek().status).toBe("ready"); expect(controller.state.peek().plan?.documentTitle).toBe("New source"); expect(controller.state.peek().plan?.options.mode).toBe("pictures");
  });
  it.each(["close", "guide switch"] as const)("cannot restore a prepared plan after %s", async event => {
    const pending = deferred<PreparedFonts>(), { controller, doc, options } = fixture({ prepareFonts: () => pending.promise });
    const preparing = controller.requestOptions(options);
    if (event === "close") controller.dispose(); else controller.observeSource(doc, "guide-b");
    pending.resolve(fonts); await preparing;
    expect(controller.state.peek().status).toBe("closed"); expect(controller.state.peek().plan).toBeUndefined();
  });
  it.each(["settings", "source", "close", "guide switch"] as const)("discards a file completion superseded by %s without downloading", async event => {
    const artifact = deferred<Blob>(), { controller, doc, downloads, options } = fixture({ createSvgFile: () => artifact.promise });
    await controller.requestOptions(options); const exporting = controller.download("svg", 0);
    if (event === "settings") await controller.requestOptions({ ...options, mode: "pictures" });
    if (event === "source") controller.observeSource(structuredClone(doc), "guide-a");
    if (event === "close") controller.dispose();
    if (event === "guide switch") controller.observeSource(doc, "guide-b");
    artifact.resolve(new Blob(["old file"])); await exporting;
    expect(downloads).toEqual([]); expect(controller.state.peek().downloadedFilename).toBeUndefined();
  });
  it("requests one numbered page with its captured plan and density", async () => {
    const { controller, options, downloads } = fixture(); await controller.requestOptions(options);
    await controller.download("png", 0, 300);
    expect(downloads).toHaveLength(1); expect(downloads[0].filename).toBe("captured-guide-page-01-of-01.png");
    expect(JSON.parse(await downloads[0].blob.text())).toEqual({ title: "Captured Guide", index: 0, dpi: 300 });
    expect(controller.state.peek().status).toBe("ready");
  });
  it("blocks missing plans and retains the full latest document for JSON backup despite glyph failure", async () => {
    const { controller, doc, options, downloads } = fixture();
    await controller.download("svg", 0); expect(downloads).toEqual([]);
    const japanese = structuredClone(doc); japanese.steps[0].tokens[0].note = "日本語";
    controller.observeSource(japanese, "guide-a"); await controller.requestOptions({ ...options, mode: "detailed" }); await controller.refreshSource();
    expect(controller.state.peek().status).toBe("blocked"); expect(controller.state.peek().issues[0].code).toBe("unsupported-glyph");
    expect(controller.backupDocument()).toEqual(japanese); expect(JSON.stringify(controller.backupDocument())).toContain("日本語");
  });
  it("retries a failed font preparation without resetting source/settings", async () => {
    let calls = 0; const { controller, options } = fixture({ prepareFonts: async () => { if (++calls === 1) throw new Error("offline font unavailable"); return fonts; } });
    await controller.requestOptions({ ...options, mode: "pictures" });
    expect(controller.state.peek().issues[0].code).toBe("font-unavailable");
    await controller.retryPreparation(); expect(controller.state.peek().status).toBe("ready"); expect(controller.state.peek().plan?.options.mode).toBe("pictures");
  });
  it("keeps selected semantic meaning from the captured document and mode", async () => {
    const { controller, doc, options } = fixture(); doc.steps.push({ id: "selected", tokens: [{ id: "custom", category: "object", iconId: "object.onion" }] });
    controller.observeSource(doc, "guide-a"); await controller.requestOptions({ ...options, selectedStepIds: ["selected"], mode: "pictures" });
    // Source prop is immutable in production: use a fresh reference for consent.
    controller.observeSource(structuredClone(doc), "guide-a"); await controller.refreshSource();
    const groups = controller.state.peek().readingGroups;
    expect(groups?.map(group => group.stepId)).toEqual(["selected"]); expect(groups?.[0].pictures[0].accessibleName).toBe("Onion"); expect(groups?.[0].pictures[0].label).toBeUndefined();
  });
  it("keeps converter diagnostics separate and leaves vector retries available", async () => {
    const problem = new Error("secret technical stack"), { controller, downloads, options } = fixture({ createPdfFile: async () => { throw problem; } });
    await controller.requestOptions(options); await controller.download("pdf");
    expect(downloads).toEqual([]); expect(controller.state.peek().errorKey).toBe("output.failed"); expect(controller.state.peek().diagnostic).toBe(problem); expect(controller.state.peek().status).toBe("ready");
    await controller.download("svg", 0); expect(downloads).toHaveLength(1);
  });
});
