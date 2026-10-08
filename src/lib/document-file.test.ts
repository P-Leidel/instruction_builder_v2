import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parseGuideFile, readImportFile, runJsonExport } from "./document-file";
import { downloadBlob } from "./download";
import type { InstructionDocument } from "../model/instruction";
import { createDefaultOutputOptions } from "./output-options";
import { planOutput } from "./output-plan";
import { prepareFontFromBuffer } from "./print-fonts";

// Only the browser download boundary is replaced; serialization, Blob bytes,
// filename policy, parsing, migration and physical preflight remain real.
vi.mock("./download", async importOriginal => ({
  ...await importOriginal<typeof import("./download")>(),
  downloadBlob: vi.fn(),
}));
beforeEach(() => vi.mocked(downloadBlob).mockReset());

function authoredGuide(): InstructionDocument {
  return {
    schemaVersion: 2,
    meta: { title: "  Café Guide / 日本語!  ", domain: "recipe", createdAt: "2026-10-08T10:00:00.000Z", presentation: "board" },
    steps: [
      {
        id: " group ?[]/ ", title: " 日本語 ", description: "Préparer — العربية",
        time: { iconId: "time.duration", label: "2m", seconds: 120 },
        tokens: [{
          id: " picture ?[]/ ", category: "action", iconId: "action.chop", label: "切る", note: " العربية 日本語 ",
          quantity: { iconId: "quantity.amount", label: "3 kg", amount: 3, unit: "kg" },
          warning: { iconId: "warning.sharp", label: "気をつけて" },
          time: { iconId: "time.duration", label: "1m", seconds: 60 },
          metadata: { authored: "日本語", amount: 3, checked: true },
        }],
      },
      { id: "empty-group", title: " ", tokens: [] },
    ],
  };
}

describe("runJsonExport", () => {
  it("backs up all editable data as pretty UTF-8 JSON despite blocked physical output and empty groups", async () => {
    const doc = authoredGuide(), original = structuredClone(doc);
    const bytes = readFileSync("public/fonts/SourceSans3-Regular-3.052.ttf");
    const fonts = await prepareFontFromBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const options = createDefaultOutputOptions(doc, "en"); options.mode = "detailed";
    const physical = planOutput(doc, options, fonts);
    expect(physical.ok).toBe(false);
    if (physical.ok) throw new Error("Expected unsupported authored text to block physical output");
    expect(physical.issues).toContainEqual(expect.objectContaining({ code: "unsupported-glyph" }));

    expect(await runJsonExport(doc)).toEqual({ ok: true });
    expect(vi.mocked(downloadBlob).mock.calls).toHaveLength(1);
    const [blob, filename] = vi.mocked(downloadBlob).mock.calls[0];
    expect(filename).toBe("caf-guide.json");
    expect(blob.type).toBe("application/json");
    const text = new TextDecoder().decode(await blob.arrayBuffer());
    expect(text).toBe(JSON.stringify(original, null, 2));
    expect(text).toContain('\n  "schemaVersion": 2,\n  "meta": {');
    expect(text).toContain('"note": " العربية 日本語 "');
    expect(JSON.parse(text)).toEqual(original);
    expect(parseGuideFile(text)).toEqual({ ok: true, document: original });
    expect(doc).toEqual(original);
  });

  it("uses the existing untitled slug fallback for a non-Latin-only title", async () => {
    const doc = authoredGuide(); doc.meta.title = "日本語";
    expect(await runJsonExport(doc)).toEqual({ ok: true });
    const [blob, filename] = vi.mocked(downloadBlob).mock.calls[0];
    expect(filename).toBe("untitled-instructions.json");
    expect(JSON.parse(await blob.text())).toEqual(doc);
  });

  it.each([new Error("Download unavailable"), "unavailable"])("returns a typed reason for a download failure: %s", async thrown => {
    const doc = authoredGuide(), original = structuredClone(doc);
    vi.mocked(downloadBlob).mockImplementationOnce(() => { throw thrown; });
    expect(await runJsonExport(doc)).toEqual({ ok: false, reason: "export-failed" });
    expect(doc).toEqual(original);
  });

  it("returns export-failed when document serialization fails before a download", async () => {
    const doc = authoredGuide();
    Object.assign(doc, { circular: doc });
    expect(await runJsonExport(doc)).toEqual({ ok: false, reason: "export-failed" });
    expect(vi.mocked(downloadBlob).mock.calls).toHaveLength(0);
  });
});

describe("parseGuideFile", () => {
  it("retains exact authored strings, identities, attachments and empty groups", () => {
    const doc = authoredGuide(), original = structuredClone(doc);
    expect(parseGuideFile(JSON.stringify(doc))).toEqual({ ok: true, document: original });
    expect(doc).toEqual(original);
  });

  it("returns invalid-json for malformed JSON", () => {
    expect(parseGuideFile("{not json")).toEqual({ ok: false, reason: "invalid-json" });
  });

  it.each([[null], [[]], [{ hello: "world" }]])("returns invalid-document for unrelated JSON: %j", raw => {
    expect(parseGuideFile(JSON.stringify(raw))).toEqual({ ok: false, reason: "invalid-document" });
  });

  it("returns invalid-document for a newer schema", () => {
    const doc = authoredGuide(); doc.schemaVersion = 3;
    expect(parseGuideFile(JSON.stringify(doc))).toEqual({ ok: false, reason: "invalid-document" });
  });

  it.each([1, 2])("rejects empty group and picture IDs in schema %s", schemaVersion => {
    for (const target of ["group", "picture"]) {
      const doc = authoredGuide(); doc.schemaVersion = schemaVersion;
      if (target === "group") doc.steps[0].id = ""; else doc.steps[0].tokens[0].id = "";
      const original = structuredClone(doc);
      expect(parseGuideFile(JSON.stringify(doc))).toEqual({ ok: false, reason: "invalid-document" });
      expect(doc).toEqual(original);
    }
  });

  it.each([
    ["quantity", { iconId: "quantity.amount", label: "3 kg", amount: 1.5, unit: "kg" }],
    ["quantity", { iconId: "quantity.amount", label: "3 kg", amount: 3 }],
    ["time", { iconId: "time.duration", label: "0m", seconds: 0 }],
    ["warning", { iconId: "warning.sharp", label: 17 }],
  ])("rejects malformed %s attachments", (field, value) => {
    const doc = authoredGuide(); Object.assign(doc.steps[0].tokens[0], { [field as string]: value });
    const original = structuredClone(doc);
    expect(parseGuideFile(JSON.stringify(doc))).toEqual({ ok: false, reason: "invalid-document" });
    expect(doc).toEqual(original);
  });

  it("migrates schema 1 sequence and historical quantity without changing the source", () => {
    const doc = authoredGuide();
    const legacyMeta = { title: doc.meta.title, domain: doc.meta.domain, createdAt: doc.meta.createdAt };
    const legacy = { ...doc, schemaVersion: 1, meta: legacyMeta };
    Object.assign(legacy.steps[0].tokens[0], { quantity: { iconId: "quantity.amount", label: "3 kg" } });
    const original = structuredClone(legacy);
    const expected = authoredGuide(); expected.meta.presentation = "sequence";
    expect(parseGuideFile(JSON.stringify(legacy))).toEqual({ ok: true, document: expected });
    expect(legacy).toEqual(original);
  });
});

describe("readImportFile", () => {
  it("reads a valid file into a document-only success result", async () => {
    const doc = authoredGuide(), original = structuredClone(doc);
    const file = new File([JSON.stringify(doc)], "recipe.json", { type: "application/json" });
    expect(await readImportFile(file)).toEqual({ ok: true, document: original });
    expect(doc).toEqual(original);
  });

  it.each([new Error("Read unavailable"), "unavailable"])("returns read-failed for a file read rejection: %s", async thrown => {
    expect(await readImportFile({ text: async () => { throw thrown; } })).toEqual({ ok: false, reason: "read-failed" });
  });

  it("retains invalid-json after a successful file read", async () => {
    expect(await readImportFile({ text: async () => "{not json" })).toEqual({ ok: false, reason: "invalid-json" });
  });

  it("retains invalid-document after a successful file read", async () => {
    expect(await readImportFile({ text: async () => '{"hello":"world"}' })).toEqual({ ok: false, reason: "invalid-document" });
  });
});
