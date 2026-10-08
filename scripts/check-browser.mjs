import { createServer, preview } from "vite";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const mode = process.argv[2];
if (!["browser", "pwa"].includes(mode)) throw new Error("Expected browser or pwa check mode");
const directory = fileURLToPath(new URL("../", import.meta.url));
const output = path.resolve(process.argv[3] ?? path.join(directory, "artifacts", mode));
const server = mode === "browser"
  ? await createServer({ root: directory, server: { host: "127.0.0.1", port: 0, open: false } })
  : await preview({ root: directory, preview: { host: "127.0.0.1", port: 0, open: false } });
try {
  if (mode === "browser") await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === "string") throw new Error("Preview server did not expose a port");
  const url = `http://127.0.0.1:${address.port}/`;
  const scripts = mode === "browser"
    ? [["driver.mjs", output, url], ["review-check.mjs", output, url], ["responsive-editor-check.mjs", output, url],
      ["editor-transition-check.mjs", output, url], ["editor-output-integration-check.mjs", output, url],
      ["export-review.mjs", output, url], ["reliability-check.mjs", url], ["storage-check.mjs", url], ["preferences-merge-check.mjs", url], ["startup-retry-check.mjs", url], ["import-identity-check.mjs", url],
      ["unknown-caption-check.mjs", path.join(output, "unknown-caption"), url],
      ["png-density-check.mjs", path.join(output, "png-density"), url],
      ["transition-focus-check.mjs", url],
      ["board-semantics-check.mjs", path.join(output, "board-semantics"), url],
      ["reading-reference-check.mjs", path.join(output, "reading-references"), url],
      ["copy-feedback-check.mjs", path.join(output, "copy-feedback"), url],
      ["check-header-theme.mjs", path.join(output, "header-theme"), url],
      ["check-review-regressions.mjs", path.join(output, "review-regressions"), url],
      ["check-editor-drag.mjs", path.join(output, "editor-drag"), url],
      ["check-print-faithful-editor.mjs", path.join(output, "print-faithful-editor"), url],
      ["check-centered-pictograms.mjs", path.join(output, "centered-pictograms"), url]]
    : [["pwa-check.mjs", url, output], ["pwa-update-check.mjs", output]];
  for (const [name, ...args] of scripts) {
    const code = await new Promise((resolve, reject) => {
      const script = path.join(directory, "tests", "browser", name);
      const child = spawn(process.execPath, [script, ...args], { cwd: directory, stdio: "inherit" });
      child.once("error", reject);
      child.once("exit", (value) => resolve(value ?? 1));
    });
    if (code !== 0) {
      process.exitCode = code;
      break;
    }
  }
} finally {
  await server.close();
}
