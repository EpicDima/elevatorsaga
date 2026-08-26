import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    // Build output, generated reports, and scratch; everything else gets linted.
    // `*.tmp.*` covers throwaway scripts kept in the repo root (to resolve
    // node_modules) that would otherwise fail lint as files outside tsconfig.json.
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "*.tmp.*",
      "**/*.tmp.*",
      // A parallel agent's own worktree, checked out under the main tree; its gates run separately.
      ".claude/worktrees/**",
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
    // Declares intent even though no active rule reads these globals today
    // (typescript-eslint defers to the compiler for undefined-global checks).
    files: ["src/**/*.ts"],
    ignores: ["src/cli/**"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // The one part of `src/` that isn't browser-facing: the benchmark command
    // and its tests, type-checked with the rest of the simulation it imports.
    files: ["src/cli/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Event maps must be `type` aliases, not interfaces: only type aliases get
    // the implicit index signature `Observable<E>`'s `EventArgsMap` constraint needs.
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
  // Feature-Sliced Design layers: shared < entities < features < widgets <
  // pages < app; each may import itself and anything below, never above.
  // src/game and src/i18n sit outside this hierarchy and are importable from any layer.
  {
    files: ["src/game/**/*.ts", "src/i18n/**/*.ts"],
    ignores: ["src/game/**/*.test.ts", "src/i18n/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/entities/**",
                "\\#entities/**",
                "**/features/**",
                "\\#features/**",
                "**/widgets/**",
                "\\#widgets/**",
                "**/pages/**",
                "\\#pages/**",
                "**/app/**",
                "\\#app/**",
                // Deliberately `../ui/**`, not `**/ui/**`: the broader glob would
                // also match the legitimate `#shared/ui/*` import.
                "../ui/**",
              ],
              message:
                "game/i18n may not import from entities, features, widgets, pages, app or ui — only shared.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/game/**/*.test.ts", "src/i18n/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/entities/**",
                "\\#entities/**",
                "**/features/**",
                "\\#features/**",
                "**/widgets/**",
                "\\#widgets/**",
                "**/pages/**",
                "\\#pages/**",
                "**/app/**",
                "\\#app/**",
              ],
              message:
                "game/i18n tests may not import from entities, features, widgets, pages or app — only shared or ui.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/entities/**",
                "\\#entities/**",
                "**/features/**",
                "\\#features/**",
                "**/widgets/**",
                "\\#widgets/**",
                "**/pages/**",
                "\\#pages/**",
                "**/app/**",
                "\\#app/**",
              ],
              message: "shared may not import from entities, features, widgets, pages or app.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/entities/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/features/**",
                "\\#features/**",
                "**/widgets/**",
                "\\#widgets/**",
                "**/pages/**",
                "\\#pages/**",
                "**/app/**",
                "\\#app/**",
              ],
              message: "entities may not import from features, widgets, pages or app.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/features/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/widgets/**",
                "\\#widgets/**",
                "**/pages/**",
                "\\#pages/**",
                "**/app/**",
                "\\#app/**",
              ],
              message: "features may not import from widgets, pages or app.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/widgets/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/pages/**", "\\#pages/**", "**/app/**", "\\#app/**"],
              message: "widgets may not import from pages or app.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/pages/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/app/**", "\\#app/**"],
              message: "pages may not import from app.",
            },
          ],
        },
      ],
    },
  },
  {
    // e2e tests drive a browser from Node, and page.evaluate callbacks run
    // inside the page, so both sets of globals are in scope in one file.
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
