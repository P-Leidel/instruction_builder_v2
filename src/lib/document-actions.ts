import { validateDocument } from "../model/validate";
import type { InstructionDocument } from "../model/instruction";
import { exportDocumentAsJson, parseImportedDocument } from "./document-file";

/**
 * Full editable JSON backup/import orchestration. Physical output belongs
 * to OutputDialog and its captured finite plan; these actions require no
 * canvas, font preparation, or live UI state.
 */

/**
 * A non-blocking JSON backup warning naming
 * how many steps are incomplete. The file has always already downloaded by
 * the time this is computed - it only informs, it never gates an export.
 */
function incompleteStepsWarning(doc: InstructionDocument): string | undefined {
  const issues = validateDocument(doc).filter((result) => !result.isComplete);
  if (issues.length === 0) return undefined;
  return `Exported with ${issues.length} empty group${issues.length === 1 ? "" : "s"}.`;
}

/**
 * `error` is set only if the export failed outright and nothing
 * downloaded; `warning` is set if it succeeded but the document has
 * incomplete steps. At most one of the two is ever set.
 */
export interface ExportResult {
  error?: string;
  warning?: string;
}

/**
 * Runs one format's actual export work and turns the outcome into an
 * `ExportResult`: a thrown error becomes `error` (falling back to
 * `fallbackError` if what was thrown isn't an `Error`), a clean run gets
 * `incompleteStepsWarning`'s non-blocking warning. Previously each format
 * wrote its own copy of this try/catch/warning shape, unevenly - JSON had
 * none of it - which is exactly what let JSON silently skip the pattern the
 * other three shared (2026-09-17 remediation - see
 * docs/phase-3/reviews/2026-09-17-whole-codebase-audit-evaluation.md item 7).
 */
async function runExport(
  doc: InstructionDocument,
  fallbackError: string,
  perform: () => void | Promise<void>,
): Promise<ExportResult> {
  try {
    await perform();
    return { warning: incompleteStepsWarning(doc) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : fallbackError };
  }
}

/** Task 18 (JSON Export): downloads the current document as pretty-printed JSON. */
export function runJsonExport(doc: InstructionDocument): Promise<ExportResult> {
  return runExport(doc, "Could not export a JSON file.", () => exportDocumentAsJson(doc));
}

export type ImportFileResult =
  | { ok: true; document: InstructionDocument; incompleteCount: number }
  | { ok: false; error: string };

/**
 * Task 19 (Import): reads the chosen file and parses+shape-validates it
 * (see `parseImportedDocument`) - does not replace the document itself.
 * On success, the caller hands the result to `ImportConfirmDialog` for the
 * user's explicit go/no-go rather than replacing anything immediately; on
 * failure (bad JSON, missing fields, unsupported schema version), the
 * caller shows `error` and the current document is left untouched either
 * way.
 */
export async function readImportFile(file: File): Promise<ImportFileResult> {
  try {
    const text = await file.text();
    const imported = parseImportedDocument(text);
    const incompleteCount = validateDocument(imported).filter((result) => !result.isComplete).length;
    return { ok: true, document: imported, incompleteCount };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not read that file." };
  }
}
