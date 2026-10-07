import { describe, it, expect, vi, beforeEach } from "vitest";
import { readImportFile, runJsonExport } from "./document-actions";
import { exportDocumentAsJson } from "./document-file";
import { createEmptyDocument } from "../model/instruction";

vi.mock("./document-file", async (importOriginal) => ({
  ...await importOriginal<typeof import("./document-file")>(),
  exportDocumentAsJson: vi.fn(),
}));
beforeEach(() => vi.mocked(exportDocumentAsJson).mockReset());

// Actual connected-anchor/deferred URL lifetime is checked by the browser
// driver and export-review. These tests preserve JSON/import orchestration.
describe("runJsonExport", () => {
  it("backs up the complete authored document even when physical text is unsupported", async () => {
    const doc = createEmptyDocument();
    doc.meta.title = "日本語";
    doc.steps[0].tokens = [{ id: "full-backup", category: "action", iconId: "action.chop", label: "Chop", note: "日本語" }];
    const original = structuredClone(doc);
    expect(await runJsonExport(doc)).toEqual({ warning: undefined });
    expect(exportDocumentAsJson).toHaveBeenCalledExactlyOnceWith(doc);
    expect(doc).toEqual(original);
  });
  it("downloads an incomplete guide and returns its non-blocking warning", async () => {
    const doc = createEmptyDocument();
    expect(await runJsonExport(doc)).toEqual({ warning: "Exported with 1 empty group." });
    expect(exportDocumentAsJson).toHaveBeenCalledExactlyOnceWith(doc);
  });
  it("returns a failed backup without claiming a successful incomplete-guide warning", async () => {
    vi.mocked(exportDocumentAsJson).mockImplementationOnce(() => { throw new Error("Backup unavailable"); });
    expect(await runJsonExport(createEmptyDocument())).toEqual({ error: "Backup unavailable" });
    vi.mocked(exportDocumentAsJson).mockImplementationOnce(() => { throw "unavailable"; });
    expect(await runJsonExport(createEmptyDocument())).toEqual({ error: "Could not export a JSON file." });
  });
});
describe("readImportFile", () => {
  it("returns the parsed document and its incomplete-step count on success", async () => {
    const doc = createEmptyDocument(); // one step, no tokens - incomplete
    const file = new File([JSON.stringify(doc)], "recipe.json", { type: "application/json" });

    const result = await readImportFile(file);

    expect(result).toEqual({ ok: true, document: doc, incompleteCount: 1 });
  });

  it("returns a user-safe error and no document for unparseable JSON", async () => {
    const file = new File(["{not json"], "recipe.json", { type: "application/json" });

    const result = await readImportFile(file);

    expect(result).toEqual({ ok: false, error: "That file isn't valid JSON." });
  });

  it("returns a user-safe error for valid JSON that isn't a valid document", async () => {
    const file = new File([JSON.stringify({ hello: "world" })], "recipe.json", {
      type: "application/json",
    });

    const result = await readImportFile(file);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/Not a valid instruction file/);
  });
});
