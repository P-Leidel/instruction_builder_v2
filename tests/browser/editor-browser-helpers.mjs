import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
export async function boot(browser, url, errors, viewport = { width: 1440, height: 1000 }, seed = []) {
  const context = await browser.newContext({ viewport, locale: "en-US", acceptDownloads: true, serviceWorkers: "block" });
  const page = await context.newPage(); page.on("pageerror", (error) => errors.push(error.message)); page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  if (seed.length) {
    await page.route(url, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Seed before bootstrap</title>" })); await page.goto(url);
    await page.evaluate((entries) => new Promise((resolve, reject) => { const request = indexedDB.open("keyval-store", 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("keyval")) request.result.createObjectStore("keyval"); };
      request.onerror = () => reject(request.error); request.onsuccess = () => { const db = request.result; const tx = db.transaction("keyval", "readwrite"); for (const [key, value] of entries) tx.objectStore("keyval").put(value, key); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error); };
    }), seed); await page.unroute(url);
  }
  await page.goto(url); await page.locator(".app-brand").waitFor(); return { page, context };
}
export async function createBlank(page, presentation = "sequence") { await page.getByRole("button", { name: "New guide", exact: true }).click(); await page.getByLabel("Guide type").selectOption(presentation); await page.getByRole("button", { name: "Start blank", exact: true }).click(); await page.getByLabel("Guide title", { exact: true }).waitFor(); }
export async function insert(page, name, group = 0) { await page.locator("[data-add-picture]").nth(group).click(); await page.getByRole("searchbox", { name: "Search pictures", exact: true }).fill(name); await page.locator(".token-picker").getByRole("button", { name, exact: true }).click(); await page.waitForFunction(() => !document.querySelector(".token-picker")); }
export async function openActions(page) {
  const summary = page.locator(".editor-actions > summary"); await summary.waitFor();
  if (!await summary.evaluate(node => node.parentElement.open)) await summary.click();
}
export async function groupEditControl(page, id) {
  const escaped = await page.evaluate(id => CSS.escape(id), id);
  return page.locator(`[data-group-drag="${escaped}"],[data-group-edit="${escaped}"]`).first();
}
export async function openGroup(page, group = 0) {
  const id = typeof group === "number" ? (await snapshot(page)).steps[group].id : group;
  await (await groupEditControl(page, id)).click(); await page.getByLabel("Group title", { exact: true }).waitFor();
}
export async function fillDuration(group, total) {
  const days = Math.floor(total / 86400), hours = Math.floor(total % 86400 / 3600), minutes = Math.floor(total % 3600 / 60), seconds = total % 60;
  for (const [name, value] of [["Days", days], ["Hours", hours], ["Minutes", minutes], ["Seconds", seconds]]) await group.getByLabel(name, { exact: true }).fill(String(value));
}
export async function durationInputTotal(group) {
  const parts = await Promise.all(["Days", "Hours", "Minutes", "Seconds"].map(name => group.getByLabel(name, { exact: true }).inputValue()));
  return parts.reduce((sum, value, index) => sum + Number(value) * [86400, 3600, 60, 1][index], 0);
}
export async function snapshot(page) { return page.evaluate(async () => (await import("/src/state/document.ts")).documentSession.document.peek()); }
export async function records(page) { return page.evaluate(async () => (await import("/src/lib/guide-repository.ts")).createIndexedDbGuideStore().transaction((tx) => tx.entries())); }
export async function importDocument(page, document) { await page.getByLabel("Choose a JSON guide file", { exact: true }).setInputFiles({ name: "fixture.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(document)) }); await page.getByRole("dialog").getByRole("button", { name: "Confirm", exact: true }).click(); await page.getByLabel("Guide title", { exact: true }).waitFor(); await page.waitForFunction((title) => document.querySelector('.guide-title input')?.value === title, document.meta.title); }
export async function downloadJson(page, button = page.getByRole("button", { name: "Download JSON backup", exact: true })) { const openedSettings = !await button.isVisible(); if (openedSettings) await page.getByRole("button", { name: "Settings", exact: true }).click(); const [download] = await Promise.all([page.waitForEvent("download"), button.click()]); assert.equal(await download.failure(), null); const stream = await download.createReadStream(); assert.ok(stream); const chunks = []; for await (const chunk of stream) chunks.push(chunk); if (openedSettings) await page.getByRole("dialog", { name: "Settings", exact: true }).getByRole("button", { name: "Close", exact: true }).click(); return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
export function fixture(counts = [1, 1, 1, 1, 1], presentation = "sequence") {
  return { schemaVersion: 2, meta: { title: "Workplace guide", domain: "recipe", createdAt: "2026-10-06T00:00:00Z", presentation }, steps: counts.map((count, index) => ({ id: `group-${index}`, title: `Group ${index + 1}`, tokens: Array.from({ length: count }, (_, token) => ({ id: `picture-${index}-${token}`, iconId: index === 0 ? "routines.action.wash-hands" : "object.onion", category: index === 0 ? "action" : "object", label: index === 0 ? "Wash hands" : "Onion" })) })) };
}
