import { migrate } from "../model/migrate";
import type { InstructionDocument } from "../model/instruction";
import { downloadBlob, slugify } from "./download";

export type GuideFileResult =
  | { ok: true; document: InstructionDocument }
  | { ok: false; reason: "read-failed" | "invalid-json" | "invalid-document" };

export type JsonExportResult = { ok: true } | { ok: false; reason: "export-failed" };

/** Parse and migrate editable guide JSON without changing the current session. */
export function parseGuideFile(text: string): GuideFileResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  try {
    return { ok: true, document: migrate(parsed) };
  } catch {
    return { ok: false, reason: "invalid-document" };
  }
}

/** Reading failures are distinct from invalid JSON and invalid document shapes. */
export async function readImportFile(file: Pick<File, "text">): Promise<GuideFileResult> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, reason: "read-failed" };
  }
  return parseGuideFile(text);
}

/** Full editable backup, independent of physical output readiness or empty groups. */
export async function runJsonExport(doc: InstructionDocument): Promise<JsonExportResult> {
  try {
    const json = JSON.stringify(doc, null, 2);
    downloadBlob(new Blob([json], { type: "application/json" }), `${slugify(doc.meta.title)}.json`);
    return { ok: true };
  } catch {
    return { ok: false, reason: "export-failed" };
  }
}
