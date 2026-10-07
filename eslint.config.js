import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  // Evidence and skill instructions are separate from maintained browser drivers.
  { ignores: ["dist", "node_modules", "artifacts", ".claude"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
    },
    rules: {
      // Preact's JSX runtime (jsxImportSource: "preact") means unused
      // React-style imports are never expected here.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["scripts/**/*.mjs", "tests/browser/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    // Task 23: the hand-written service worker runs in its own global
    // scope (self/caches/clients), not a browser window - it's real
    // shipped code, so
    // it still gets linted, just with the right globals for where it runs.
    files: ["public/sw.js"],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
);
