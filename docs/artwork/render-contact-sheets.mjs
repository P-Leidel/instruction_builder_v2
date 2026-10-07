import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";

const directory = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1320 } });
  for (let number = 1; number <= 6; number++) {
    const svg = await readFile(path.join(directory, `contact-sheet-${number}.svg`), "utf8");
    await page.setContent(`<html><style>body{margin:0;background:white}</style><body>${svg}</body></html>`);
    await page.screenshot({ path: path.join(directory, `contact-sheet-${number}.png`), fullPage: true });
  }
  console.log("Rendered all 6 complete contact sheets to PNG.");
} finally {
  await browser.close();
}
