import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { sequenceFixture, boardFixture, longGroupFixture, mixedLibraryFixture, unsupportedTextFixture } from "../test/fixtures/overhaul";
import type { InstructionDocument } from "../model/instruction";
import type { EditorLayout, OutputPlan, OutputOptions, OutputPlanResult } from "../model/output";
import { planOutput as compose } from "./output-plan";
import { createDefaultOutputOptions, createDefaultLabelSheet } from "./output-options";
import { prepareFontFromBuffer } from "./print-fonts";
import { outlineText } from "./print-font-adapters";
import { migrate } from "../model/migrate";
function successful(result: OutputPlanResult) {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result;
}
afterEach(() => vi.unstubAllGlobals());
async function planner() {
  const bytes = readFileSync("public/fonts/SourceSans3-Regular-3.052.ttf");
  const fonts = await prepareFontFromBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return { planOutput: compose, createDefaultOutputOptions, createDefaultLabelSheet, fonts };
}
function mainIds(plan: OutputPlan) { return plan.pages.flatMap(page => page.fragments.filter(fragment => fragment.kind === "symbol" && fragment.role === "token").map(fragment => fragment.source.tokenId)); }
function assertBounds(plan: OutputPlan) {
  for (const page of plan.pages) for (const fragment of page.fragments) {
    if (fragment.kind === "connector") {
      for (const point of [fragment.from, ...(fragment.via ?? []), fragment.to]) { expect(point.xMm).toBeGreaterThanOrEqual(0); expect(point.yMm).toBeGreaterThanOrEqual(0); expect(point.xMm).toBeLessThanOrEqual(page.size.widthMm); expect(point.yMm).toBeLessThanOrEqual(page.size.heightMm); }
    } else {
      expect(fragment.box.xMm).toBeGreaterThanOrEqual(0); expect(fragment.box.yMm).toBeGreaterThanOrEqual(0);
      expect(fragment.box.xMm + fragment.box.widthMm).toBeLessThanOrEqual(page.size.widthMm + 1e-7);
      expect(fragment.box.yMm + fragment.box.heightMm).toBeLessThanOrEqual(page.size.heightMm + 1e-7);
      if (fragment.kind === "text") { expect(fragment.fontSizePt).toBeGreaterThanOrEqual(9); expect(fragment.baselineMm).toBeGreaterThanOrEqual(fragment.box.yMm); expect(fragment.baselineMm).toBeLessThanOrEqual(fragment.box.yMm + fragment.box.heightMm); }
    }
  }
}

function editing(result: OutputPlanResult): EditorLayout {
  const layout = result.ok ? result.plan.editorLayout : result.editorLayout;
  expect(layout, "Physical repair geometry must be available").toBeDefined();
  return layout!;
}
function placedPictures(layout: EditorLayout) {
  return layout.pages.flatMap(page => page.groups.flatMap(group => group.pictures));
}

describe("fixed physical editing layout", () => {
  it("carries canonical A4 content regions on composed plans", async () => {
    const api = await planner(), doc = sequenceFixture();
    const result = successful(api.planOutput(doc, api.createDefaultOutputOptions(doc, "en"), api.fonts));
    expect(result.plan.contentRegions).toEqual([{ xMm: 10, yMm: 10, widthMm: 190, heightMm: 277 }]);
  });
  it("carries all label-sheet content regions when only one cell is assigned", async () => {
    const api = await planner(), doc = sequenceFixture(); doc.steps[0].tokens = [doc.steps[0].tokens[1]];
    const options = api.createDefaultOutputOptions(doc, "en", "label"); options.labelSheet = api.createDefaultLabelSheet();
    const result = successful(api.planOutput(doc, options, api.fonts));
    expect(result.plan.contentRegions).toHaveLength(24);
    expect(result.plan.contentRegions?.[23]).toEqual({ xMm: 116, yMm: 236, widthMm: 46, heightMm: 26 });
  });
  it.each(["note", "label", "warning", "quantity", "time", "documentTitle", "groupTitle", "description", "groupTime"] as const)("returns exact repairs for valid oversized %s text without throwing or changing geometry", async field => {
    const api = await planner(), doc = sequenceFixture();
    doc.steps[0].description = undefined;
    doc.steps[0].tokens[0].note = "Prep";
    const options = api.createDefaultOutputOptions(doc, "en"); options.mode = "detailed";
    const baseline = editing(successful(api.planOutput(doc, options, api.fonts)));
    const content = "A" + "\n".repeat(150000);
    const token = doc.steps[0].tokens[0];
    if (field === "note" || field === "label") token[field] = content;
    else if (field === "warning" || field === "quantity" || field === "time") token[field]!.label = content;
    else if (field === "documentTitle") doc.meta.title = content;
    else if (field === "groupTitle") doc.steps[0].title = content;
    else if (field === "description") doc.steps[0].description = content;
    else doc.steps[0].time = { iconId: "time.duration", seconds: 300, label: content };
    const validated = migrate(doc), before = structuredClone(validated);
    const result = api.planOutput(validated, options, api.fonts);
    expect(result.ok).toBe(false); if (result.ok) throw new Error("Expected text overflow");
    const source = field === "documentTitle" ? {} : ["groupTitle", "description", "groupTime"].includes(field) ? { stepId: "fixture-group-1" } : { stepId: "fixture-group-1", tokenId: "fixture-token-1" };
    const role = field === "documentTitle" || field === "groupTitle" ? "heading" : field === "groupTime" ? "time" : field;
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "overflow", source, messageKey: "output.cellOverflow", params: expect.objectContaining({ field: role }) }));
    expect(result).not.toHaveProperty("plan"); expect(editing(result)).toEqual(baseline); expect(validated).toEqual(before);
    expect(result.issues.find(issue => issue.code === "overflow" && issue.params?.field === role)?.params?.content).toBe(field === "groupTitle" ? "Step 1: " + content : content);
  });
  it("excludes huge optional notes in Labels and Pictures and checks glyphs beyond the fitting prefix", async () => {
    const api = await planner(), doc = sequenceFixture();
    doc.steps[0].tokens[0].note = "\n".repeat(150000);
    for (const mode of ["labels", "pictures"] as const) {
      const options = api.createDefaultOutputOptions(doc, "en"); options.mode = mode;
      assertBounds(successful(api.planOutput(migrate(doc), options, api.fonts)).plan);
    }
    doc.steps[0].tokens[0].note += "日";
    const options = api.createDefaultOutputOptions(doc, "en"); options.mode = "detailed";
    const result = api.planOutput(migrate(doc), options, api.fonts);
    expect(result.ok).toBe(false); if (result.ok) throw new Error("Expected unsupported glyph");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "unsupported-glyph", source: { stepId: "fixture-group-1", tokenId: "fixture-token-1" }, params: expect.objectContaining({ codePoints: "U+65E5" }) }));
  });
  it("keeps every cell and row position unchanged when short attachments or viewport width change", async () => {
    const api = await planner(), doc = sequenceFixture();
    doc.steps[0].tokens = Array.from({ length: 9 }, (_, index) => ({ id: `fixed-${index}`, category: "object", iconId: "object.onion", label: "Banana" }));
    const options = api.createDefaultOutputOptions(doc, "en");
    const plain = successful(api.planOutput(doc, options, api.fonts));
    doc.steps[0].tokens[1].quantity = { iconId: "quantity.amount", amount: 5435, unit: "g", label: "" };
    doc.steps[0].tokens[1].warning = { iconId: "warning.sharp", label: "Sharp!" };
    doc.steps[0].tokens[1].time = { iconId: "time.duration", seconds: 543, label: "" };
    // Inferred group time has a reserved header band too.
    const attached = successful(api.planOutput(doc, options, api.fonts));
    expect(editing(attached)).toEqual(editing(plain));
    for (const width of [320, 390, 768, 1440]) {
      vi.stubGlobal("innerWidth", width);
      expect(editing(api.planOutput(doc, options, api.fonts))).toEqual(editing(plain));
    }
    const placements = placedPictures(editing(attached));
    const pitch = placements[4].cellBox.yMm - placements[0].cellBox.yMm;
    expect(pitch).toBe(editing(attached).cell.heightMm + editing(attached).cell.rowGapMm);
    expect(placements.every(picture => picture.cellBox.widthMm === editing(attached).cell.widthMm)).toBe(true);
  });

  it("keeps compact known warning meaning with its symbol and retains explicit unknown warning context", async () => {
    const api = await planner(), doc = sequenceFixture();
    doc.steps[0].tokens = [{ id: "warning", iconId: "object.onion", category: "object", label: "Onion", warning: { iconId: "warning.sharp", label: "Sharp!" } }];
    let result = successful(api.planOutput(doc, api.createDefaultOutputOptions(doc, "en"), api.fonts));
    let warnings = result.plan.pages.flatMap(page => page.fragments).filter(fragment => fragment.role === "warning");
    expect(warnings.filter(fragment => fragment.kind === "text").map(fragment => fragment.text).join("")).toBe("Sharp!");
    expect(warnings.some(fragment => fragment.kind === "symbol" && fragment.iconId === "warning.sharp")).toBe(true);
    doc.steps[0].tokens[0].warning = { iconId: "missing", label: "Keep clear" };
    result = successful(api.planOutput(doc, api.createDefaultOutputOptions(doc, "en"), api.fonts));
    warnings = result.plan.pages.flatMap(page => page.fragments).filter(fragment => fragment.role === "warning");
    expect(warnings.filter(fragment => fragment.kind === "text").map(fragment => fragment.text).join("")).toBe("Warning: Keep clear");
  });

  it("returns every original picture repair target after multiple cell failures and continuation", async () => {
    const api = await planner(), doc = sequenceFixture();
    doc.steps[0].tokens = Array.from({ length: 85 }, (_, index) => ({ id: `repair-${index}`, category: "object", iconId: "object.onion", label: index === 0 ? "日本語" : "Onion", ...(index === 84 ? { warning: { iconId: "warning.sharp", label: "Required authored warning ".repeat(40) } } : {}) }));
    const before = structuredClone(doc), result = api.planOutput(doc, api.createDefaultOutputOptions(doc, "en"), api.fonts);
    expect(result.ok).toBe(false); if (result.ok) throw new Error("Expected blocked output");
    expect(result).not.toHaveProperty("plan");
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "unsupported-glyph", source: { stepId: doc.steps[0].id, tokenId: "repair-0" } }),
      expect.objectContaining({ code: "overflow", messageKey: "output.cellOverflow", source: { stepId: doc.steps[0].id, tokenId: "repair-84" }, params: expect.objectContaining({ field: "warning" }) }),
    ]));
    expect(placedPictures(editing(result)).map(picture => [picture.tokenId, picture.index])).toEqual(doc.steps[0].tokens.map((token, index) => [token.id, index]));
    expect(editing(result).pages.length).toBeGreaterThan(1);
    expect(editing(result).pages.slice(1).flatMap(page => page.groups).every(group => group.stepId === doc.steps[0].id && group.continued)).toBe(true);
    expect(doc).toEqual(before);
  });

  it("keeps empty targets and continued compact-group repairs inside valid page bounds", async () => {
    const api = await planner(), doc = sequenceFixture();
    doc.steps[0].tokens = Array.from({ length: 12 }, (_, index) => ({ id: `compact-${index}`, category: "object", iconId: "object.onion", label: "Onion" }));
    doc.steps.push({ id: "empty", tokens: [] });
    for (const preset of ["label", "card", "custom"] as const) {
      const options = api.createDefaultOutputOptions(doc, "en", preset);
      if (preset === "custom") options.customSize = { widthMm: 20, heightMm: 20 };
      const result = api.planOutput(doc, options, api.fonts);
      expect(result.ok).toBe(false);
      const layout = editing(result);
      expect(placedPictures(layout).map(picture => picture.tokenId)).toEqual(doc.steps[0].tokens.map(token => token.id));
      expect(layout.pages.flatMap(page => page.groups).find(group => group.stepId === "empty")?.emptyDropBox).toBeDefined();
      for (const page of layout.pages) for (const group of page.groups) {
        for (const region of [group.groupBox, group.headingBox, group.emptyDropBox, ...group.pictures.map(picture => picture.cellBox)].filter(Boolean)) {
          expect(region!.xMm).toBeGreaterThanOrEqual(0); expect(region!.yMm).toBeGreaterThanOrEqual(0);
          expect(region!.xMm + region!.widthMm).toBeLessThanOrEqual(page.size.widthMm + 1e-7);
          expect(region!.yMm + region!.heightMm).toBeLessThanOrEqual(page.size.heightMm + 1e-7);
        }
      }
    }
  });

  it("uses fixed columns independent of surplus landscape width", async () => {
    const api = await planner(), doc = mixedLibraryFixture();
    const portrait = successful(api.planOutput(doc, api.createDefaultOutputOptions(doc, "en"), api.fonts));
    const options = api.createDefaultOutputOptions(doc, "en"); options.orientation = "landscape";
    const landscape = successful(api.planOutput(doc, options, api.fonts));
    expect(editing(landscape).cell).toEqual(editing(portrait).cell);
    expect(placedPictures(editing(landscape)).map(picture => picture.cellBox.widthMm)).toEqual([44, 44, 44]);
    for (const result of [portrait, landscape]) assertBounds(result.plan);
  });

  it("fits a simple label in either orientation with fixed orientation-specific lanes", async () => {
    const api = await planner(), doc = mixedLibraryFixture();
    doc.steps[0].tokens = [{ id: "banana-label", category: "object", iconId: "object.banana", label: "Banana" }];
    for (const orientation of ["portrait", "landscape"] as const) {
      const options = api.createDefaultOutputOptions(doc, "en", "label"); options.orientation = orientation;
      const result = successful(api.planOutput(doc, options, api.fonts));
      expect(editing(result).cell).toMatchObject(orientation === "portrait" ? { widthMm: 46, heightMm: 25 } : { widthMm: 26, heightMm: 46 });
      expect(mainIds(result.plan)).toEqual(["banana-label"]); assertBounds(result.plan);
      const labels = result.plan.pages[0].fragments.filter(fragment => fragment.kind === "text" && fragment.role === "label");
      expect(labels.map(fragment => fragment.kind === "text" ? fragment.text : "").join("")).toBe("Banana");
    }
  });

  it("blocks a long authored caption without truncation and keeps its exact repair identity", async () => {
    const api = await planner(), doc = mixedLibraryFixture();
    const content = "jWWWWWWWWWWWWWWWWWWj\nDonaudampfschifffahrtsgesellschaft";
    doc.steps[0].tokens[1].label = content;
    const before = structuredClone(doc), result = api.planOutput(doc, api.createDefaultOutputOptions(doc, "en"), api.fonts);
    expect(result.ok).toBe(false); if (result.ok) throw new Error("Expected fixed caption overflow");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "overflow", source: { stepId: doc.steps[0].id, tokenId: "fixture-routines" }, messageKey: "output.cellOverflow", params: expect.objectContaining({ field: "label", content }) }));
    expect(placedPictures(editing(result)).map(picture => picture.tokenId)).toEqual(doc.steps[0].tokens.map(token => token.id));
    expect(result).not.toHaveProperty("plan"); expect(doc).toEqual(before);
  });

  it("preserves fixed hit regions when metadata and content modes change", async () => {
    const api = await planner(), doc = mixedLibraryFixture(), options = api.createDefaultOutputOptions(doc, "en");
    doc.steps[0].tokens[0].note = "Prep";
    const original = editing(successful(api.planOutput(doc, options, api.fonts)));
    for (const mode of ["pictures", "labels", "detailed"] as const) for (const visible of [true, false]) {
      options.mode = mode; options.metadata = { documentTitle: visible, groupTitles: visible, stepNumbers: visible, totalTime: visible };
      expect(editing(successful(api.planOutput(doc, options, api.fonts)))).toEqual(original);
    }
  });

  it("keeps every label-sheet repair target across regions and a sheet continuation", async () => {
    const api = await planner(), doc = mixedLibraryFixture();
    doc.steps[0].tokens = Array.from({ length: 25 }, (_, index) => ({ id: `label-repair-${index}`, category: "object", iconId: "object.onion", label: "Onion" }));
    const options = api.createDefaultOutputOptions(doc, "en", "label"); options.labelSheet = api.createDefaultLabelSheet();
    const result = api.planOutput(doc, options, api.fonts);
    expect(result.ok).toBe(false);
    const layout = editing(result);
    expect(layout.pages).toHaveLength(2);
    expect(layout.pages[0].groups).toHaveLength(24);
    expect(placedPictures(layout).map(picture => [picture.tokenId, picture.index])).toEqual(doc.steps[0].tokens.map((token, index) => [token.id, index]));
    expect(layout.pages[1].groups[0]).toMatchObject({ stepId: doc.steps[0].id, segment: 24, continued: true });
  });

  it("blocks label document metadata that cannot fit rather than silently omitting it", async () => {
    const api = await planner(), doc = mixedLibraryFixture(); doc.steps[0].tokens = doc.steps[0].tokens.slice(0, 1);
    const options = api.createDefaultOutputOptions(doc, "en", "label"); options.metadata.documentTitle = true;
    const result = api.planOutput(doc, options, api.fonts);
    expect(result.ok).toBe(false); if (result.ok) throw new Error("Expected zero-height label heading overflow");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "overflow", source: {}, params: expect.objectContaining({ content: doc.meta.title }) }));
    expect(placedPictures(editing(result))).toHaveLength(1);
  });

  it("supplies a blank physical editing page for an empty guide while blocking output", async () => {
    const api = await planner(), doc = mixedLibraryFixture(); doc.steps = [];
    const result = api.planOutput(doc, api.createDefaultOutputOptions(doc, "en"), api.fonts);
    expect(result.ok).toBe(false); if (result.ok) throw new Error("Expected empty selection");
    expect(result.issues[0].code).toBe("empty-selection");
    expect(editing(result).pages).toEqual([{ pageIndex: 0, size: { widthMm: 210, heightMm: 297 }, groups: [] }]);
  });
});
describe("measured physical composition", () => {
  it("preserves 20/85 pictures exactly once through continuation within physical bounds", async () => {
    const api = await planner();
    for (const count of [20, 85]) {
      const doc = longGroupFixture(count);
      doc.steps[0].tokens.forEach((token, index) => { token.label = `Vegetables ${index + 1}`; });
      const result = api.planOutput(doc, api.createDefaultOutputOptions(doc, "de"), api.fonts);
      expect(result.ok).toBe(true); if (!result.ok) throw new Error(JSON.stringify(result.issues)); expect(mainIds(result.plan)).toEqual(doc.steps[0].tokens.map(token => token.id));
      assertBounds(result.plan);
      if (count === 85) { expect(result.plan.pages.length).toBeGreaterThan(1); expect(result.plan.pages.slice(1).every((page: OutputPlan["pages"][number]) => page.fragments.some(fragment => fragment.kind === "text" && fragment.role === "context" && fragment.text.includes("Fortsetzung")))).toBe(true); }
    }
  });

  it("uses 24 label cells and starts a 25th on a fresh independent sheet", async () => {
    const api = await planner();
    for (const count of [24, 25]) {
      const doc = sequenceFixture(); doc.steps = Array.from({ length: count }, (_, index) => ({ id: `g-${index}`, tokens: [{ id: `t-${index}`, category: "object", iconId: "object.onion" }] }));
      const options = api.createDefaultOutputOptions(doc, "en", "label"); options.metadata.groupTitles = false; options.metadata.stepNumbers = false;
      options.labelSheet = api.createDefaultLabelSheet(); const result = api.planOutput(doc, options, api.fonts);
      expect(result.ok).toBe(true); if (!result.ok) throw new Error(JSON.stringify(result.issues)); expect(result.plan.pages).toHaveLength(count === 24 ? 1 : 2); expect(mainIds(result.plan)).toHaveLength(count); assertBounds(result.plan);
      expect(result.plan.pages[0].size).toEqual({ widthMm: 210, heightMm: 297 });
    }
  });

  it("refuses whole-label/card and single-unit overflow without partial pages", async () => {
    const api = await planner(), doc = longGroupFixture(85);
    for (const preset of ["label", "card"] as const) { const result = api.planOutput(doc, api.createDefaultOutputOptions(doc, "en", preset), api.fonts); expect(result.ok).toBe(false); if (result.ok) throw new Error("Expected overflow"); expect(result.issues[0].code).toBe("overflow"); expect(result).not.toHaveProperty("plan"); }
    const options = api.createDefaultOutputOptions(sequenceFixture(), "en", "custom"); options.customSize = { widthMm: 20, heightMm: 20 };
    expect(api.planOutput(sequenceFixture(), options, api.fonts).ok).toBe(false);
  });

  it("retains required attachments and warning context in every mode, including unknown warnings", async () => {
    const api = await planner(), doc = sequenceFixture();
    doc.steps[0].tokens[0].note = "Prep";
    for (const warning of [{ iconId: "x", label: "Beware the edge" }, { iconId: "x" }]) {
      doc.steps[0].tokens[0].warning = warning;
      for (const mode of ["labels", "pictures", "detailed"] as const) {
        const options = api.createDefaultOutputOptions(doc, "en"); options.mode = mode;
        const result = successful(api.planOutput(doc, options, api.fonts));
        const fragments = result.plan.pages.flatMap((page: OutputPlan["pages"][number]) => page.fragments);
        expect(fragments.filter(fragment => fragment.kind === "text" && fragment.role === "warning").map(fragment => fragment.kind === "text" ? fragment.text : "").join("")).toContain("Warning:");
        expect(fragments.some((fragment: OutputPlan["pages"][number]["fragments"][number]) => fragment.role === "quantity")).toBe(true);
        expect(fragments.some((fragment: OutputPlan["pages"][number]["fragments"][number]) => fragment.role === "time")).toBe(true);
        expect(result.plan.notices.some((notice: OutputPlan["notices"][number]) => notice.code === "unknown-symbol")).toBe(true);
      }
    }
  });

  it("omits unsupported optional text by mode while blocking unsupported selected visible content", async () => {
    const api = await planner(), doc = sequenceFixture(); doc.steps[0].tokens[0].note = "日本語";
    for (const mode of ["labels", "pictures", "detailed"] as const) { const options = api.createDefaultOutputOptions(doc, "en"); options.mode = mode; const result = api.planOutput(doc, options, api.fonts); expect(result.ok).toBe(mode !== "detailed"); if (!result.ok) expect(result.issues[0]).toMatchObject({ code: "unsupported-glyph", source: { tokenId: "fixture-token-1" } }); }
    const japanese = unsupportedTextFixture(); expect(api.planOutput(japanese, api.createDefaultOutputOptions(japanese, "en"), api.fonts).ok).toBe(false);
    const pictureOptions = api.createDefaultOutputOptions(japanese, "en"); pictureOptions.mode = "pictures";
    expect(api.planOutput(japanese, pictureOptions, api.fonts).ok).toBe(true);
  });

  it("keeps boards unordered without alternative sums and preserves mixed known pictures", async () => {
    const api = await planner(), doc = boardFixture(), options = api.createDefaultOutputOptions(doc, "en");
    options.metadata.stepNumbers = true; options.metadata.totalTime = true;
    const result = successful(api.planOutput(doc, options, api.fonts));
    const fragments = result.plan.pages.flatMap((page: OutputPlan["pages"][number]) => page.fragments);
    expect(fragments.some((fragment: OutputPlan["pages"][number]["fragments"][number]) => fragment.kind === "connector")).toBe(false);
    expect(fragments.some((fragment: OutputPlan["pages"][number]["fragments"][number]) => fragment.kind === "text" && (fragment.text.includes("15m") || fragment.text.includes("Step 1")))).toBe(false);
    const mixed = mixedLibraryFixture(), mixedResult = successful(api.planOutput(mixed, api.createDefaultOutputOptions(mixed, "de"), api.fonts));
    expect(mixedResult.ok).toBe(true); expect(mixedResult.plan.notices).toEqual([]); expect(mainIds(mixedResult.plan)).toEqual(["fixture-kitchen", "fixture-routines", "fixture-learning"]);
  });

  it("normalizes selections and captures immutable options independently of viewport", async () => {
    const api = await planner(), doc = sequenceFixture(); doc.steps.push({ id: "other", title: "Other", time: { iconId: "time.duration", label: "10m", seconds: 600 }, tokens: [{ id: "other-token", category: "object", iconId: "object.onion" }] });
    const options: OutputOptions = api.createDefaultOutputOptions(doc, "en"); options.selectedStepIds = ["other"];
    const before = structuredClone(doc), result = successful(api.planOutput(doc, options, api.fonts)); expect(mainIds(result.plan)).toEqual(["other-token"]);
    expect(result.plan.pages[0].fragments.some((fragment: OutputPlan["pages"][number]["fragments"][number]) => fragment.kind === "text" && fragment.text.includes("10m"))).toBe(true);
    options.metadata.documentTitle = false; expect(result.plan.options.metadata.documentTitle).toBe(true); expect(doc).toEqual(before);
    const plans = [320, 390, 768, 1440].map(width => { vi.stubGlobal("innerWidth", width); return api.planOutput(doc, api.createDefaultOutputOptions(doc, "en"), api.fonts); });
    expect(plans.every(plan => JSON.stringify(plan) === JSON.stringify(plans[0]))).toBe(true);
  });

  it("keeps selected empty groups and unknown main pictures as named notices", async () => {
    const api = await planner(), doc: InstructionDocument = sequenceFixture(); doc.steps = [{ id: "empty", tokens: [] }, { id: "unknown", tokens: [{ id: "u", category: "object", iconId: "missing" }] }];
    const result = successful(api.planOutput(doc, api.createDefaultOutputOptions(doc, "de"), api.fonts));
    expect(result.plan.notices.map((notice: OutputPlan["notices"][number]) => notice.code)).toEqual(["empty-group", "unknown-symbol"]); expect(mainIds(result.plan)).toEqual(["u"]); assertBounds(result.plan);
  });

  it("keeps full-size artwork and painted text inside internal margins across presets and orientations", async () => {
    const api = await planner(), doc = mixedLibraryFixture();
    doc.steps[0].title = "jÄÖÜ ß ẞ – café — j";
    doc.steps[0].tokens.forEach(token => { token.label = "jÄ café\nWWWWWWWWWWj"; });
    for (const preset of ["card", "sheet", "large", "custom"] as const) for (const orientation of ["portrait", "landscape"] as const) {
      const fitting = structuredClone(doc);
      if (preset === "large") fitting.steps[0].tokens.forEach(token => { token.label = "jÄ café WWWWWWWWWWj"; });
      if (preset === "card" && orientation === "landscape") fitting.steps[0].tokens = fitting.steps[0].tokens.slice(0, 2);
      const options = api.createDefaultOutputOptions(fitting, "de", preset); options.orientation = orientation;
      const result = successful(api.planOutput(fitting, options, api.fonts)); assertBounds(result.plan);
      expect(mainIds(result.plan)).toEqual(fitting.steps[0].tokens.map(token => token.id));
      const minimum = preset === "large" ? 25 : 15, margin = preset === "card" ? 5 : 10;
      for (const page of result.plan.pages) for (const fragment of page.fragments) {
        if (fragment.kind === "symbol" && fragment.role === "token") expect(Math.min(fragment.box.widthMm, fragment.box.heightMm)).toBeGreaterThanOrEqual(minimum);
        if (fragment.kind === "text") {
          const glyph = outlineText(fragment.text, fragment.fontSizePt, api.fonts).bounds;
          expect(fragment.box.xMm + glyph.x1).toBeGreaterThanOrEqual(margin - 1e-7);
          expect(fragment.box.xMm + glyph.x2).toBeLessThanOrEqual(fragment.box.xMm + fragment.box.widthMm + 1e-7);
          expect(fragment.baselineMm + glyph.y1).toBeGreaterThanOrEqual(fragment.box.yMm - 1e-7);
          expect(fragment.baselineMm + glyph.y2).toBeLessThanOrEqual(fragment.box.yMm + fragment.box.heightMm + 1e-7);
        }
      }
      const lines = result.plan.pages.flatMap(page => page.fragments.filter(fragment => fragment.kind === "text" && fragment.role === "label" && fragment.source.tokenId === "fixture-kitchen"));
      expect(lines.map(fragment => fragment.kind === "text" ? fragment.text : "").join("")).toBe(preset === "large" ? "jÄ café WWWWWWWWWWj" : "jÄ caféWWWWWWWWWWj");
    }
  });

  it("shows explicit-over-inferred group time and keeps timed alternatives independent", async () => {
    const api = await planner(), sequence = sequenceFixture();
    sequence.steps[0].time = { iconId: "time.duration", label: "2m", seconds: 120 };
    const result = successful(api.planOutput(sequence, api.createDefaultOutputOptions(sequence, "en"), api.fonts));
    expect(result.plan.pages.flatMap(page => page.fragments).filter(fragment => fragment.kind === "text" && fragment.role === "time" && !fragment.source.tokenId).map(fragment => fragment.kind === "text" ? fragment.text : "")).toEqual(["Total time: 2m", "2m"]);
    const board = boardFixture(), options = api.createDefaultOutputOptions(board, "en");
    const boardResult = successful(api.planOutput(board, options, api.fonts));
    expect(boardResult.plan.pages.flatMap(page => page.fragments).filter(fragment => fragment.kind === "text" && fragment.role === "time").map(fragment => fragment.kind === "text" ? fragment.text : "")).toEqual(["5m", "10m"]);
  });

  it("keeps a picture and all required attachments on one page and reports an unfit unit source", async () => {
    const api = await planner(), doc = sequenceFixture();
    doc.steps[0].tokens = Array.from({ length: 20 }, (_, index) => ({ ...structuredClone(doc.steps[0].tokens[0]), id: `attached-${index}` }));
    const result = successful(api.planOutput(doc, api.createDefaultOutputOptions(doc, "en"), api.fonts));
    for (const token of doc.steps[0].tokens) {
      const containing = result.plan.pages.filter(page => page.fragments.some(fragment => fragment.source.tokenId === token.id));
      expect(containing).toHaveLength(1);
      expect(containing[0].fragments.filter(fragment => fragment.source.tokenId === token.id).map(fragment => fragment.role)).toEqual(expect.arrayContaining(["token", "quantity", "warning", "time"]));
    }
    doc.steps[0].tokens[0].warning = { iconId: "warning.sharp", label: "Very long warning ".repeat(300) };
    const failure = api.planOutput(doc, api.createDefaultOutputOptions(doc, "en"), api.fonts);
    expect(failure.ok).toBe(false);
    if (failure.ok) throw new Error("Expected required-unit overflow");
    expect(failure.issues[0]).toMatchObject({ code: "overflow", source: { tokenId: "attached-0" } }); expect(failure).not.toHaveProperty("plan");
  });

  it("treats a non-warning catalog reference as an unknown warning and never translates authored content", async () => {
    const api = await planner(), doc = sequenceFixture(); doc.steps[0].tokens[0].warning = { iconId: "object.onion" };
    delete doc.steps[0].tokens[0].quantity; delete doc.steps[0].tokens[0].time;
    const options = api.createDefaultOutputOptions(doc, "de", "large"); options.mode = "pictures";
    const result = successful(api.planOutput(doc, options, api.fonts));
    const warningLines = result.plan.pages.flatMap(page => page.fragments).filter(fragment => fragment.kind === "text" && fragment.role === "warning").map(fragment => fragment.kind === "text" ? fragment.text : "").join("");
    expect(warningLines).toContain("Warnung"); expect(warningLines).toContain("object.onion"); expect(result.plan.notices).toHaveLength(1);
    doc.steps[0].tokens[0].warning.label = "Authored English warning";
    const authored = successful(api.planOutput(doc, options, api.fonts));
    expect(authored.plan.pages.flatMap(page => page.fragments).filter(fragment => fragment.kind === "text" && fragment.role === "warning").map(fragment => fragment.kind === "text" ? fragment.text : "").join("")).toContain("Authored English warning");
  });

  it("connects adjacent sequence units across rows on the same page without crossing their content", async () => {
    const api = await planner(), doc = longGroupFixture(6), options = api.createDefaultOutputOptions(doc, "en"); options.mode = "pictures";
    const result = successful(api.planOutput(doc, options, api.fonts));
    const connectors = result.plan.pages[0].fragments.filter(fragment => fragment.kind === "connector");
    expect(connectors).toHaveLength(5);
    const transition = connectors.find(fragment => fragment.from.xMm > fragment.to.xMm);
    expect(transition).toBeDefined();
    const mains = result.plan.pages[0].fragments.filter(fragment => fragment.kind === "symbol" && fragment.role === "token");
    const before = mains.filter(fragment => fragment.kind === "symbol" && fragment.box.yMm < transition!.from.yMm);
    const after = mains.filter(fragment => fragment.kind === "symbol" && fragment.box.yMm > transition!.to.yMm);
    expect(before.length).toBeGreaterThan(0); expect(after.length).toBeGreaterThan(0);
    expect(before.every(fragment => fragment.kind === "symbol" && fragment.box.yMm + fragment.box.heightMm < transition!.from.yMm)).toBe(true);
    expect(after.every(fragment => fragment.kind === "symbol" && fragment.box.yMm > transition!.to.yMm)).toBe(true);
  });

  it("reserves fixed heading and cell bands even when printed heading text is absent", async () => {
    const api = await planner(), doc = sequenceFixture(); doc.steps = [{ id: "exact", tokens: [{ id: "exact-token", category: "object", iconId: "object.onion" }] }];
    const options = api.createDefaultOutputOptions(doc, "en", "custom"); options.customSize = { widthMm: 64, heightMm: 116 }; options.mode = "pictures";
    options.metadata = { documentTitle: false, groupTitles: false, stepNumbers: false, totalTime: false };
    const result = successful(api.planOutput(doc, options, api.fonts));
    expect(result.plan.pages).toHaveLength(1); expect(result.plan.pages[0].fragments).toHaveLength(1);
    expect(result.plan.pages[0].fragments[0]).toMatchObject({ kind: "symbol", box: { xMm: 24.5, yMm: 78.5, widthMm: 15, heightMm: 15 } });
    expect(editing(result).cell).toMatchObject({ widthMm: 44, heightMm: 40 });
  });

  it.each(["pictures", "labels", "detailed"] as const)("retains required structured values for blank and whitespace attachment labels in %s", async mode => {
    const api = await planner();
    for (const label of ["", " \t\n "]) {
      const doc = sequenceFixture();
      doc.steps[0].tokens[0].note = "Prep";
      doc.steps[0].time = { iconId: "time.duration", seconds: 120, label };
      doc.steps[0].tokens[0].quantity = { iconId: "quantity.amount", amount: 2, unit: "small cups", label };
      doc.steps[0].tokens[0].time = { iconId: "time.duration", seconds: 60, label };
      const validated = migrate(doc), before = structuredClone(validated);
      const options = api.createDefaultOutputOptions(validated, "en"); options.mode = mode; options.metadata.totalTime = false;
      const result = successful(api.planOutput(validated, options, api.fonts));
      const lines = result.plan.pages.flatMap(page => page.fragments).filter(fragment => fragment.kind === "text");
      expect(lines.filter(fragment => fragment.role === "quantity").map(fragment => fragment.text).join("")).toContain("2 small cups");
      expect(lines.filter(fragment => fragment.role === "time" && fragment.source.tokenId).map(fragment => fragment.text).join("")).toContain("1m");
      expect(lines.filter(fragment => fragment.role === "time" && !fragment.source.tokenId).map(fragment => fragment.text).join("")).toContain("2m");
      expect(validated).toEqual(before); assertBounds(result.plan);
    }
  });

  it.each([1, 5])("reports the actual oversized later-column token at index %s, including a continuation row", async oversizedIndex => {
    const api = await planner(), doc = sequenceFixture();
    doc.steps[0].tokens = Array.from({ length: oversizedIndex + 1 }, (_, index) => ({ id: `column-${index}`, category: "object", iconId: "object.onion", ...(index === oversizedIndex ? { warning: { iconId: "warning.sharp", label: "Required warning ".repeat(300) } } : {}) }));
    const result = api.planOutput(doc, api.createDefaultOutputOptions(doc, "en"), api.fonts);
    expect(result.ok).toBe(false); if (result.ok) throw new Error("Expected required-unit overflow");
    expect(result.issues[0]).toMatchObject({ code: "overflow", source: { stepId: doc.steps[0].id, tokenId: `column-${oversizedIndex}` } });
    expect(result).not.toHaveProperty("plan");
  });
});
