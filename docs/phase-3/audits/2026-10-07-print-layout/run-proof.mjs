import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";

// Uses the existing isolated OutputDialog/planner/file adapter; never modifies
// the user's browser profile or stored guides. Start npm run dev first.
const directory = path.dirname(fileURLToPath(import.meta.url));
const source = {
  schemaVersion: 2,
  meta: { title: "Kitchen picture instructions", domain: "proof", presentation: "sequence", createdAt: "2026-10-07T00:00:00Z" },
  steps: [{ id: "kitchen", tokens: [
    ["object.grape", "object", "Grape"], ["object.banana", "object", "Banana"],
    ["object.potato", "object", "Potato"], ["object.apple", "object", "Apple"],
    ["action.simmer", "action", "Simmer"], ["action.bake", "action", "Bake"],
    ["action.fry", "action", "Fry"], ["object.fish", "object", "Fish"],
  ].map(([iconId, category, label], index) => ({ id: `picture-${index}`, iconId, category, label,
    ...(index === 1 ? { quantity: { iconId: "quantity.amount", label: "5435 g", amount: 5435, unit: "g" },
      warning: { iconId: "warning.sharp", label: "Sharp!" }, time: { iconId: "time.duration", label: "9m 3s", seconds: 543 } } : {}),
  })) }],
};
const browser = await chromium.launch(), errors = [], checks = {};
function check(name, value) { assert.equal(value, true, name); checks[name] = true; }
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 2000 } });
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("http://127.0.0.1:5173/docs/phase-3/audits/2026-10-06-overhaul/export-proof/index.html");
  await page.waitForFunction(() => document.documentElement.dataset.proofReady === "true");
  const plain = structuredClone(source);
  delete plain.steps[0].tokens[1].quantity; delete plain.steps[0].tokens[1].warning; delete plain.steps[0].tokens[1].time;
  const plans = await page.evaluate(async ([plain, source]) => [await window.prepareOutputProof(plain, { locale: "en" }), await window.prepareOutputProof(source, { locale: "en" })], [plain, source]);
  check("both_sources_fit", plans.every(result => result.ok));
  const main = (plan, id) => plan.pages.flatMap(page => page.fragments).find(fragment => fragment.kind === "symbol" && fragment.role === "token" && fragment.source.tokenId === id);
  const rowGap = plan => main(plan, "picture-4").box.yMm - main(plan, "picture-0").box.yMm;
  check("details_do_not_increase_row_spacing", Math.abs(rowGap(plans[0].plan) - rowGap(plans[1].plan)) < 1e-7);
  const plan = plans[1].plan, banana = main(plan, "picture-1");
  check("all_eight_main_pictures_once_in_order", JSON.stringify(plan.pages.flatMap(page => page.fragments.filter(fragment => fragment.kind === "symbol" && fragment.role === "token").map(fragment => fragment.source.tokenId))) === JSON.stringify(source.steps[0].tokens.map(token => token.id)));
  check("details_beside_banana", plan.pages.flatMap(page => page.fragments).filter(fragment => fragment.source.tokenId === "picture-1" && ["quantity", "warning", "time"].includes(fragment.role)).every(fragment => fragment.box.xMm > banana.box.xMm + banana.box.widthMm));
  check("content_boxes_inside_10mm_padding", plan.pages.every(page => page.fragments.every(fragment => fragment.kind === "connector" ? [fragment.from, fragment.to].every(point => point.xMm >= 10 && point.xMm <= 200 && point.yMm >= 10 && point.yMm <= 287) : fragment.box.xMm >= 10 && fragment.box.yMm >= 10 && fragment.box.xMm + fragment.box.widthMm <= 200 + 1e-7 && fragment.box.yMm + fragment.box.heightMm <= 287 + 1e-7)));
  for (const format of ["svg", "png", "pdf"]) {
    const bytes = Buffer.from(await page.evaluate(format => window.outputProofArtifact(format), format));
    await writeFile(path.join(directory, `banana-layout.${format}`), bytes);
    check(`${format}_nonempty`, bytes.length > 1000);
  }
  await page.evaluate(source => window.replaceOutputProof(source), source);
  await page.locator('[data-output-status="ready"]').waitFor();
  await page.getByLabel("Show printable content bounds").check();
  check("preview_explains_10mm_paper_border", await page.getByText("Blank paper border: at least 10 mm on every side.", { exact: true }).isVisible());
  await page.locator(".output-preview").screenshot({ path: path.join(directory, "preview.png") });
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  const labelSource = structuredClone(source); labelSource.steps[0].tokens = [labelSource.steps[0].tokens[0]];
  await page.evaluate(source => window.replaceOutputProof(source), labelSource);
  await page.locator('[data-output-status="ready"]').waitFor();
  await page.getByLabel("Output size", { exact: true }).selectOption("label");
  await page.locator('[data-output-status="ready"]').waitFor();
  await page.getByLabel("Arrange labels on sheets").check();
  await page.getByLabel("Sheet margin (mm)", { exact: true }).fill("0.06");
  await page.locator('[data-output-status="ready"]').waitFor();
  check("fractional_label_sheet_caption_never_overstates_padding", await page.getByText("Blank paper border: at least 2 mm on every side.", { exact: true }).isVisible());
  check("zero_console_and_page_errors", errors.length === 0);
  await writeFile(path.join(directory, "source.json"), JSON.stringify(source, null, 2) + "\n");
  await writeFile(path.join(directory, "plan.json"), JSON.stringify(plan, null, 2) + "\n");
  await writeFile(path.join(directory, "results.json"), JSON.stringify({ runAt: new Date().toISOString(), checks, errors, rowSpacingMm: rowGap(plan), pages: plan.pages.length, practicalAcceptance: "Pending" }, null, 2) + "\n");
  console.log(JSON.stringify({ status: "PASS", checks: Object.keys(checks).length, rowSpacingMm: rowGap(plan) }));
} finally { await browser.close(); }
