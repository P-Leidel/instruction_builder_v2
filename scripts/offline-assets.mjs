import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export async function prepareOfflineAssets(directory) {
  async function collect(relative = "") {
    const entries = await readdir(path.join(directory, relative), { withFileTypes: true });
    const files = await Promise.all(entries.map((entry) => {
      const name = path.posix.join(relative, entry.name);
      return entry.isDirectory() ? collect(name) : [name];
    }));
    return files.flat();
  }
  const files = (await collect()).filter((name) =>
    !["sw.js", "offline-assets.json", "index.html"].includes(name) && !name.endsWith(".map"),
  ).sort();
  const hash = createHash("sha256");
  for (const name of ["index.html", ...files]) {
    hash.update(name).update(await readFile(path.join(directory, name)));
  }
  const cacheName = `instruction-builder-v2-${hash.digest("hex").slice(0, 16)}`;
  const assets = ["/", ...files.map((name) => `/${name}`)].sort();
  const workerPath = path.join(directory, "sw.js");
  const worker = await readFile(workerPath, "utf8");
  if (!/const CACHE_NAME = "[^"]+";/.test(worker)) throw new Error("Service worker cache declaration was not found");
  await writeFile(workerPath, worker.replace(/const CACHE_NAME = "[^"]+";/, `const CACHE_NAME = "${cacheName}";`));
  await writeFile(path.join(directory, "offline-assets.json"), JSON.stringify({ cacheName, assets }, null, 2) + "\n");
  return { cacheName, assets };
}
