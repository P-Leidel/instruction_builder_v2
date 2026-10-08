import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";
import { boot, createBlank, fixture, importDocument, snapshot } from "./editor-browser-helpers.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = path.resolve(process.argv[2] ?? path.join(root, "artifacts/functional-remediation/unknown-browser"));
const checks = {}, errors = [];
let browser, server, failure, observations;
try {
  await mkdir(output, { recursive: true });
  if (!process.argv[3]) {
    server = await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false, watch: { ignored: ["**/artifacts/**"] } } });
    await server.listen();
  }
  browser = await chromium.launch();
  const url = process.argv[3] ?? `http://127.0.0.1:${server.httpServer.address().port}/`;
  const { page, context } = await boot(browser, url, errors);
  try {
    await createBlank(page);
    const doc = fixture([1]);
    doc.steps[0].tokens[0] = { id: "unknown-cup", iconId: "x", category: "object", label: "Cup" };
    await importDocument(page, doc);
    const before = JSON.stringify(await snapshot(page));
    observations = await page.evaluate(async doc => {
      const { prepareFonts } = await import("/src/lib/print-fonts.ts");
      const { planOutput } = await import("/src/lib/output-plan.ts");
      const { createDefaultOutputOptions } = await import("/src/lib/output-options.ts");
      const fonts = await prepareFonts();
      const cases = [];
      for (const locale of ["en", "de"]) for (const mode of ["labels", "pictures", "detailed"]) {
        const options = createDefaultOutputOptions(doc, locale); options.mode = mode;
        const result = planOutput(doc, options, fonts);
        cases.push({ locale, mode, result });
      }
      return { lineHeightMm: fonts.lineHeightMm(9), contextWidthMm: fonts.measureWidthMm("Unknown picture (x)", 9), cases };
    }, doc);
    await page.getByRole("button", { name: "Print / Download", exact: true }).click();
    await page.waitForFunction(() => ["ready", "blocked"].includes(document.querySelector(".output-dialog")?.getAttribute("data-output-status")));
    await page.screenshot({ path: path.join(output, "unknown-caption-modal.png") });
    checks.SHORT_UNKNOWN_CAPTION_READY = await page.locator(".output-dialog").getAttribute("data-output-status") === "ready";
    assert.equal(checks.SHORT_UNKNOWN_CAPTION_READY, true, "Short unknown caption should permit the default A4 export");
    const dialog = page.locator(".output-dialog");
    checks.PDF_DOWNLOAD_ENABLED = await dialog.getByRole("button", { name: "Download PDF", exact: true }).isEnabled();
    assert.equal(checks.PDF_DOWNLOAD_ENABLED, true);
    const printed = await dialog.locator("svg [data-output-text][data-token-id='unknown-cup']").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-output-text")).join(" "));
    assert.ok(printed.includes("Unknown picture (x)")); assert.ok(printed.includes("Cup"));
    checks.LOCALIZED_CONTEXT_AND_AUTHORED_LABEL_VISIBLE = true;
    assert.equal(await dialog.locator("svg g[data-output-role='token'][data-token-id='unknown-cup'] rect").count(), 1);
    assert.equal(await dialog.locator("svg g[data-output-role='token'][data-token-id='unknown-cup'] path").getAttribute("d"), "M9 8c0-4 7-4 7 0 0 3-4 3-4 6M12 18h0");
    checks.VISIBLE_UNKNOWN_FALLBACK_RETAINED = true;
    await dialog.getByText("Selected content", { exact: true }).click();
    assert.equal(await dialog.locator(".reading-content").getByRole("img", { name: "Cup", exact: true }).count(), 1);
    checks.AUTHORED_ACCESSIBLE_NAME_RETAINED = true;
    const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download SVG page 1 of 1", exact: true }).click()]);
    assert.equal(await download.failure(), null);
    await download.saveAs(path.join(output, "unknown-caption.svg"));
    checks.SVG_EXPORT_SUCCEEDED = true;
    assert.equal(JSON.stringify(await snapshot(page)), before); checks.SOURCE_PRESERVED = true;
    const [backup] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download JSON backup", exact: true }).click()]);
    const backupPath = path.join(output, "unknown-caption-backup.json"); await backup.saveAs(backupPath);
    assert.equal(JSON.stringify(JSON.parse(await readFile(backupPath, "utf8"))), before);
    checks.BACKUP_PRESERVES_AUTHORED_LABEL_AND_UNKNOWN_ID = true;
    for (const observation of observations.cases) {
      assert.equal(observation.result.ok, true, `${observation.locale} ${observation.mode} should fit`);
      const symbols = observation.result.plan.pages.flatMap(p => p.fragments).filter(f => f.kind === "symbol" && f.role === "token");
      assert.equal(symbols[0].iconId, "x");
    }
    checks.ALL_MODES_AND_LOCALES_PRESERVE_UNKNOWN_ID = true;
    await page.keyboard.press("Escape");
    const longLabel = "Complete authored meaning ".repeat(30);
    await page.evaluate(async label => {
      const { documentSession, sessionActions } = await import("/src/state/document.ts");
      sessionActions.updateTokenLabel(documentSession, "group-0", "unknown-cup", label);
    }, longLabel);
    await page.locator(".editor-layout-issues").waitFor();
    await page.locator(".editor-layout-issues button").click();
    assert.equal(await page.getByLabel("Picture label", { exact: true }).inputValue(), longLabel);
    checks.COMPOSITE_CONTEXT_ISSUE_OPENS_EXACT_PICTURE_REPAIR = true;
    await page.screenshot({ path: path.join(output, "unknown-caption-repair.png") });
    assert.deepEqual(errors, []); checks.NO_BROWSER_ERRORS = true;
  } finally { await context.close(); }
} catch (error) { failure = String(error); throw error; }
finally {
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "unknown-caption-result.json"), JSON.stringify({ runAt: new Date().toISOString(), checks, errors, failure, observations }, null, 2));
  await browser?.close(); await server?.close();
}
