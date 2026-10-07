import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const scope = { self: { location: { origin: "https://instructions.test" }, addEventListener() {} }, URL };
vm.runInNewContext(source, scope);
test("reload requests consult the offline cache even with browser-only cache flags", () => {
  const request = { method: "GET", url: "https://instructions.test/assets/app.js", cache: "only-if-cached", mode: "cors" };
  assert.equal(scope.chooseStrategy(request), "cache-first");
  assert.equal(scope.chooseStrategy({ ...request, url: "https://instructions.test/", mode: "navigate" }), "network-first");
});
test("service worker leaves other origins and non-GET requests alone", () => {
  assert.equal(scope.chooseStrategy({ method: "POST", url: "https://instructions.test/" }), "passthrough");
  assert.equal(scope.chooseStrategy({ method: "GET", url: "https://elsewhere.test/" }), "passthrough");
});
test("public build assets match despite Origin variants, while other resources keep Vary semantics", async () => {
  const lookups = [];
  scope.caches = { match: async (request, options) => { lookups.push({ url: request.url, ignoreVary: options.ignoreVary }); } };
  await scope.matchCached({ url: "https://instructions.test/assets/app.js" });
  await scope.matchCached({ url: "https://instructions.test/icons/icon.png" });
  await scope.matchCached({ url: "https://instructions.test/fonts/source-sans-3/SourceSans3-Regular.ttf" });
  await scope.matchCached({ url: "https://instructions.test/font-preferences" });
  await scope.matchCached({ url: "https://instructions.test/private-data" });
  assert.deepEqual(lookups.map((lookup) => lookup.ignoreVary), [true, true, true, false, false]);
});
