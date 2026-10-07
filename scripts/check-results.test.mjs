import { test } from "node:test";
import assert from "node:assert/strict";
import { assertChecks } from "./check-results.mjs";

test("browser expectations reject false results and identify all failed checks", () => {
  assert.throws(() => assertChecks({ offline: false, overflow: true, errors: false }), /offline, errors/);
});
test("missing or numeric results cannot silently satisfy boolean expectations", () => {
  assert.throws(() => assertChecks({ missing: undefined, count: 0 }), /missing, count/);
});
