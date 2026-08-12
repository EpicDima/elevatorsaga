import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    // Build output, generated reports, and scratch. Everything else in the tree
    // is first-party and gets linted.
    //
    // `*.tmp.*` is the scratch convention. A throwaway measuring script has to
    // sit in the repo root to resolve `@playwright/test` and the rest of
    // `node_modules`, so it cannot live in `/tmp` the way scratch is supposed
    // to — and while it sits there, `npx eslint .` fails on a file nobody
    // intends to keep, because it is outside `tsconfig.json` and the type-aware
    // rules refuse to run on it. That failure is indistinguishable from a real
    // one at a glance, and it lands on whoever runs the gate next rather than
    // on whoever left the file.
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "*.tmp.*",
      "**/*.tmp.*",
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
    // The one part of `src/` that is not browser-facing: the command that runs
    // the benchmark from a terminal. It sits under `src/` rather than in a
    // scripts directory because it is the same simulation, checked by the same
    // `tsconfig.json`, tested by the same suite and held to the same coverage
    // floor as everything it imports -- and a benchmark nobody type-checks is a
    // benchmark that stops building the day the engine moves.
    files: ["src/cli/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
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
    files: ["*.config.ts", "*.config.js"],
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
