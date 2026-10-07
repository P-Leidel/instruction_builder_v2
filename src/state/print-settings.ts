import { signal } from "@preact/signals";
import type { InstructionDocument } from "../model/instruction";
import type { AppLocale } from "../model/library";
import type { OutputOptions } from "../model/output";
import { createDefaultOutputOptions } from "../lib/output-options";

export function createPrintSettingsStore() {
  const records = signal(new Map<string | null, { options: OutputOptions; allGroups: boolean }>());
  return { records,
    getOptions(doc: InstructionDocument, guideId: string | null, locale: AppLocale): OutputOptions {
      const record = records.value.get(guideId);
      if (!record) return createDefaultOutputOptions(doc, locale);
      const options = structuredClone(record.options);
      return { ...options, locale, selectedStepIds: doc.steps.filter(step => record.allGroups || options.selectedStepIds.includes(step.id)).map(step => step.id) };
    },
    setOptions(doc: InstructionDocument, guideId: string | null, options: OutputOptions) {
      const selected = new Set(options.selectedStepIds);
      const allGroups = selected.size === doc.steps.length && doc.steps.every(step => selected.has(step.id));
      records.value = new Map(records.value).set(guideId, { options: structuredClone(options), allGroups });
    },
  };
}
export const printSettings = createPrintSettingsStore();
