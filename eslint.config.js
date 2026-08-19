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
      // A parallel agent's own worktree, checked out under the main tree so it
      // can resolve node_modules the same way *.tmp.* scratch does above. Its
      // gates are its own responsibility, run in its own directory; it should
      // not be able to fail this one's.
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
    // Browser-facing sources, which is all of `src/` bar the one directory
    // below. Declaring the globals rather than leaving them undeclared is what
    // keeps this file honest about where each directory runs: no rule enabled
    // here reads the declarations today, because `typescript-eslint` turns
    // `no-undef` off in favour of the compiler, which resolves globals from
    // `tsconfig.json`'s `lib` and from `@types/node`. They are the record of the
    // intent, and the day a globals-reading rule is added -- `no-undef` on a
    // plain-JS corner, `no-restricted-globals` -- it lands on a correct map
    // instead of a stale one.
    files: ["src/**/*.ts"],
    ignores: ["src/cli/**"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // The one part of `src/` that is not browser-facing: the benchmark command
    // and the tests that run it. It sits under `src/` rather than in a scripts
    // directory because it is the same simulation, checked by the same
    // `tsconfig.json` and tested by the same suite as everything it imports --
    // and a benchmark nobody type-checks is a benchmark that stops building the
    // day the engine moves. (Coverage is measured over `src/**` as one figure,
    // so no per-file floor applies to it or to anything else; what covers the
    // parts of the command an in-process test cannot reach -- the entry point,
    // the exit code, the real streams -- is `bench.cli.test.ts`, which spawns
    // it, and coverage cannot see into a subprocess.)
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
  // Feature-Sliced Design layer boundaries: shared < entities < features <
  // widgets < pages < app. Each layer may import from itself and everything
  // below it, never from a layer above. `src/game` and `src/i18n` sit outside
  // this hierarchy entirely (aliased as #game/#i18n) and are importable from
  // any layer. Each group lists both the relative-path form
  // (`**/entities/**`, for a stray `../../entities/x`) and the alias form
  // (`\#entities/**`, backslash-escaped: these are gitignore-style patterns,
  // and a leading `#` is otherwise read as a comment and matches nothing),
  // since a bare `#`-prefixed specifier does not contain a `/` before the
  // layer name and so does not match the relative-path glob.
  // This does not catch a slice reaching into a same-layer sibling's
  // internals instead of its index.ts — a known, accepted gap.
  //
  // "Importable from any layer" above is one-directional in practice too:
  // `src/game`/`src/i18n` production code depends on nothing in the FSD tree
  // except `shared`, which is as dependency-free as they are (confirmed by
  // reading `src/shared/lib/route-query.ts`, `src/i18n/detect.ts`'s one real
  // consumer of it — nothing circles back). Test files get one further
  // allowance, `ui`, matching the one real case
  // (`src/game/challenge-tiers-solutions.test.ts` borrowing the plain string
  // constant `DEV_TEST_CODE` as a reference program): a fixture reaching
  // across a boundary for test data is not the same risk as production code
  // depending on a higher layer.
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
                // Deliberately `../ui/**`, not `**/ui/**`: game/i18n files
                // sit one level under `src/`, so their only possible
                // relative path into the legacy `src/ui/` is `../ui/...`,
                // and the broader glob would also match `shared/ui`'s own
                // directory segment inside `#shared/ui/*` — a real,
                // legitimate import this rule must not catch.
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
