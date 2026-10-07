import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../..");
const inventory = JSON.parse(await readFile(path.join(directory, "inventory.json"), "utf8"));
const escape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const pages = [];
for (let offset = 0; offset < inventory.length; offset += 24) {
  const entries = inventory.slice(offset, offset + 24);
  const cells = await Promise.all(entries.map(async (entry, index) => {
    const source = await readFile(path.join(root, "src/assets/pictograms", `${entry.id}.svg`), "utf8");
    const inner = source.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/)[1];
    const x = (index % 4) * 320;
    const y = Math.floor(index / 4) * 208 + 55;
    const pictures = [8, 15, 25].map((mm, sizeIndex) => {
      const left = [20, 100, 205][sizeIndex];
      return `<svg x="${left}" y="50" width="${mm * 4}" height="${mm * 4}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg><text x="${left}" y="167" font-size="11">${mm} mm</text>`;
    }).join("");
    return `<g transform="translate(${x} ${y})"><rect x="1" y="1" width="318" height="206" fill="white" stroke="#aaa" stroke-width="1"/><text x="10" y="19" font-size="12">${escape(entry.id)}</text><text x="10" y="36" font-size="12">${escape(entry.en)} / ${escape(entry.de)}</text>${pictures}<text x="10" y="193" font-size="10">Original: ${escape(entry.id)}.svg</text></g>`;
  }));
  const number = offset / 24 + 1;
  const name = `contact-sheet-${number}.svg`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 1320" width="320mm" height="330mm" color="#111" font-family="Arial, sans-serif"><rect width="1280" height="1320" fill="white"/><text x="10" y="26" font-size="20">Original pictograms — grayscale review ${number} / 6 — 8, 15 and 25 mm</text>${cells.join("")}</svg>`;
  await writeFile(path.join(directory, name), svg);
  pages.push(name);
}
await writeFile(path.join(directory, "contact-sheets.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Original pictogram contact sheets</title><style>body{font:16px system-ui;margin:24px;background:#eee}img{display:block;max-width:100%;background:white;margin:24px auto}p{max-width:70ch}a{color:#174699}@media print{img{break-after:page}}</style><h1>Original pictograms: complete review inventory</h1><p>All 140 canonical meanings, bilingual labels, source IDs, and grayscale pictures at 8, 15 and 25 mm. Screen sizes depend on zoom/display calibration; the millimeter sizes are intended for physical output. Recipient comprehension and actual print inspection are pending.</p>${pages.map((name) => `<a href="${name}">${name}</a><img src="${name}" alt="${name}: original pictograms, bilingual labels and source paths">`).join("")}</html>`);
console.log(`Generated ${pages.length} contact sheets covering ${inventory.length} meanings.`);
