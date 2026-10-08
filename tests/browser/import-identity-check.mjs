import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { boot, fixture, importDocument, records, snapshot } from "./editor-browser-helpers.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const server = process.argv[2] ? undefined : await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false } });
await server?.listen();
const url = process.argv[2] ?? `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await chromium.launch(), errors = [];
const sessionState = page => page.evaluate(async () => {
  const { documentSession: session } = await import("/src/state/document.ts");
  return { document: session.document.peek(), past: session.past.peek(), future: session.future.peek(),
    step: session.selectedStepId.peek(), token: session.selectedTokenId.peek(), copied: session.copiedToken.peek() };
});
try {
  const { page, context } = await boot(browser, url, errors);
  try {
    const original = fixture([1]); original.meta.title = "Keep this authored guide";
    await importDocument(page, original);
    await page.evaluate(async () => {
      const { documentSession: session, sessionActions } = await import("/src/state/document.ts");
      sessionActions.updateTitle(session, "Keep edited authored guide");
      // A structural edit forms its own undo step; rapid title edits coalesce.
      sessionActions.addStep(session);
      sessionActions.undo(session);
      sessionActions.selectToken(session, "group-0", "picture-0-0");
      sessionActions.copyToken(session, "group-0", "picture-0-0");
      await (await import("/src/state/guide-bootstrap.ts")).guideBootstrap.controller().flushActiveGuide();
    });
    const before = await sessionState(page), committed = await records(page);
    assert.ok(before.past.length > 0); assert.ok(before.future.length > 0);
    for (const schemaVersion of [1, 2]) for (const field of ["step", "token"]) {
      const invalid = fixture([1]); invalid.schemaVersion = schemaVersion;
      if (field === "step") invalid.steps[0].id = ""; else invalid.steps[0].tokens[0].id = "";
      await page.getByLabel("Choose a JSON guide file", { exact: true }).setInputFiles({ name: "empty-id.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(invalid)) });
      await page.getByText("This JSON file could not be opened. Your current guide is unchanged.", { exact: true }).waitFor();
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.deepEqual(await sessionState(page), before);
      assert.deepEqual(await records(page), committed);
      await page.locator(".toast").getByRole("button", { name: "Close", exact: true }).click();
      console.log(`EMPTY_${field.toUpperCase()}_ID_SCHEMA_${schemaVersion}_REJECTED_WITH_SESSION_INTACT=PASS`);
    }
    const valid = fixture([1]); valid.meta.title = "Nonempty identities";
    valid.steps[0].id = " "; valid.steps[0].tokens[0].id = " ?[]/ ";
    await importDocument(page, valid); assert.deepEqual(await snapshot(page), valid);
    const copied = await page.evaluate(async () => {
      const { documentSession: session, sessionActions } = await import("/src/state/document.ts");
      sessionActions.selectToken(session, " ", " ?[]/ "); sessionActions.copyToken(session, " ", " ?[]/ ");
      (await import("/src/state/ui.ts")).authoring.pastePicture(session.selectedStepId.peek());
      await (await import("/src/state/guide-bootstrap.ts")).guideBootstrap.controller().flushActiveGuide();
      return session.document.peek().steps[0].tokens;
    });
    assert.equal(copied.length, 2); assert.equal(copied[0].id, " ?[]/ ");
    assert.ok(copied[1].id.length > 0); assert.notEqual(copied[1].id, copied[0].id);
    assert.deepEqual({ ...copied[1], id: copied[0].id }, copied[0]);
    console.log("NONEMPTY_IDENTITIES_RETAINED_AND_CLIPBOARD_WORKS=PASS");
  } finally { await context.close(); }

  for (const source of ["legacy", "guide"]) for (const field of ["step", "token"]) {
    const raw = fixture([1]); raw.schemaVersion = 1;
    if (field === "step") raw.steps[0].id = ""; else raw.steps[0].tokens[0].id = "";
    const key = source === "legacy" ? "instruction-builder:document" : "instruction-builder:guide:broken";
    const value = source === "legacy" ? raw : { id: "broken", revision: 1, createdAt: raw.meta.createdAt, updatedAt: raw.meta.createdAt, document: raw, future: { kept: true } };
    const { page, context } = await boot(browser, url, errors, undefined, [[key, value]]);
    try {
      await page.getByRole("heading", { name: "My guides", exact: true }).waitFor();
      const stored = await records(page);
      assert.deepEqual(stored.find(([id]) => id === key)?.[1], value);
      assert.deepEqual(stored.filter(([key]) => key.startsWith("instruction-builder:recovery:")).map(([, value]) => value), [value]);
      assert.equal(await page.getByRole("button", { name: /^Open / }).count(), 0);
      assert.equal(stored.some(([id]) => id === "instruction-builder:guides-migration:v1"), false);
      console.log(`EMPTY_${field.toUpperCase()}_ID_${source.toUpperCase()}_EXACT_RAW_RECOVERY=PASS`);
    } finally { await context.close(); }
  }
  assert.deepEqual(errors, []); console.log("IMPORT_IDENTITY_CHECKS=9 PASS");
} finally { await browser.close(); await server?.close(); }
