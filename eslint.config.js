import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    // Build output and generated reports. Everything else in the tree is
    // first-party and gets linted.
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      ".vite/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Browser-facing sources.
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // Simulation event maps must be `type` aliases, not interfaces: only type
    // aliases get the implicit index signature required to satisfy the
    // `EventArgsMap` (`Record<string, readonly unknown[]>`) constraint of
    // `Observable<E>`.
    files: ["src/game/**/*.ts"],
    rules: { "@typescript-eslint/consistent-type-definitions": "off" },
  },
  {
    // Config files run in Node.
    files: ["*.config.ts", "*.config.js", "eslint.config.js"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // End-to-end tests drive a browser from Node, and the callbacks they hand
    // to `page.evaluate` are evaluated inside the page, so both sets of globals
    // are legitimately in scope in one file.
    files: ["e2e/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    // Plain JS config files are not covered by the typed project service.
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
