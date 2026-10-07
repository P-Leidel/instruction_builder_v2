import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../..");
const inventory = JSON.parse(await readFile(path.join(directory, "inventory.json"), "utf8"));
const sources = await Promise.all(inventory.map(async (entry) => {
  const svg = await readFile(path.join(root, "src/assets/pictograms", `${entry.id}.svg`), "utf8");
  return svg.replace("<svg ", `<svg data-icon-id="${entry.id}" `);
}));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`<html><body>${sources.join("")}</body></html>`);
  const outside = await page.evaluate(() => [...document.querySelectorAll("svg")].flatMap((svg) => {
    const box = svg.getBBox();
    return box.x < 2 - 0.001 || box.y < 2 - 0.001 || box.x + box.width > 22 + 0.001 || box.y + box.height > 22 + 0.001
      ? [{ id: svg.dataset.iconId, x: box.x, y: box.y, right: box.x + box.width, bottom: box.y + box.height }] : [];
  }));
  if (outside.length) throw new Error(`Geometry outside 2–22: ${JSON.stringify(outside)}`);
  console.log(`Verified actual rendered geometry bounds for ${inventory.length} original SVGs.`);
} finally {
  await browser.close();
}
