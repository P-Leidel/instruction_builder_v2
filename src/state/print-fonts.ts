import { signal } from "@preact/signals";
import type { PreparedFonts } from "../model/output";

/** Prepared print fonts survive editor/reader switches and are shared with
 * successful export preparation, including recovery after a failed fetch. */
export const preparedPrintFonts = signal<PreparedFonts | undefined>(undefined);
