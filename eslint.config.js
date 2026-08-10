import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    // Build output, vendored code, and the legacy game sources that a later
    // modernization stage deletes outright.
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      ".vite/**",
      "playwright-report/**",
      "test-results/**",
      "libs/**",
      "font-awesome-4.1-1.0/**",
      "test/**",
      "app.js",
      "base.js",
      "challenges.js",
      "elevator.js",
      "fitness.js",
      "fitnessworker.js",
      "floor.js",
      "interfaces.js",
      "movable.js",
      "presenters.js",
      "user.js",
      "world.js",
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
    // Plain JS config files are not covered by the typed project service.
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
