import { h, render } from "preact";
import { OutputDialog } from "../../../../../src/components/OutputDialog/OutputDialog";
import type { InstructionDocument } from "../../../../../src/model/instruction";
import type { AppLocale } from "../../../../../src/model/library";
import { prepareFonts } from "../../../../../src/lib/print-fonts";
import { planOutput } from "../../../../../src/lib/output-plan";
import { createDefaultOutputOptions, createDefaultLabelSheet } from "../../../../../src/lib/output-options";
import { createSvgFile, createPngFile, createPdfFile } from "../../../../../src/lib/output-export";
import type { OutputOptions, OutputPlan } from "../../../../../src/model/output";

declare global { interface Window { openOutputProof(locale?: AppLocale): void; updateOutputProof(title: string): void; replaceOutputProof(source: InstructionDocument): void; prepareOutputProof(source: InstructionDocument, patch?: Partial<OutputOptions>): Promise<ReturnType<typeof planOutput>>; outputProofArtifact(format: "svg" | "png" | "pdf", index?: number, dpi?: 150 | 300): Promise<number[]> } }
let document: InstructionDocument = { schemaVersion: 2, meta: { title: "Äß Proof", presentation: "sequence", domain: "proof", createdAt: "2026-10-06T00:00:00Z" }, steps: [{ id: "proof-group", title: "Proof group", tokens: [{ id: "proof-token", category: "object", iconId: "object.onion", label: "Onion Äß" }] }] };
let locale: AppLocale = "en";
const host = window.document.getElementById("proof")!;
function show() { render(h(OutputDialog, { sourceDocument: document, guideId: "proof-guide", locale, onClose: () => { render(null, host); window.document.getElementById("opener")!.focus(); } }), host); }
window.openOutputProof = nextLocale => { locale = nextLocale ?? "en"; show(); };
window.updateOutputProof = title => { document = { ...document, meta: { ...document.meta, title } }; show(); };
window.replaceOutputProof = source => { document = structuredClone(source); locale = "en"; show(); };
let plan: OutputPlan | undefined;
window.prepareOutputProof = async (source, patch = {}) => {
  const options = { ...createDefaultOutputOptions(source, "de", patch.preset), ...patch };
  if (patch.preset === "label" && patch.labelSheet) options.labelSheet = { ...createDefaultLabelSheet(), ...patch.labelSheet };
  const result = planOutput(source, options, await prepareFonts()); plan = result.ok ? result.plan : undefined; return result;
};
window.outputProofArtifact = async (format, index = 0, dpi = 150) => {
  if (!plan) throw new Error("No successful plan");
  const blob = format === "svg" ? await createSvgFile(plan, index) : format === "png" ? await createPngFile(plan, index, dpi) : await createPdfFile(plan);
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
};
window.document.getElementById("opener")!.addEventListener("click", () => window.openOutputProof());
window.document.documentElement.dataset.proofReady = "true";
if (import.meta.env.PROD) void navigator.serviceWorker.register("/sw.js").then(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true })); window.document.documentElement.dataset.offlineReady = "true"; });
