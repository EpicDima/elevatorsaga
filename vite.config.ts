import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

import packageJson from "./package.json" with { type: "json" };
import { docsPageFile, renderDocsPage } from "./src/docs-page/render.ts";
import { LOCALES, type Locale } from "./src/i18n/locale.ts";

/**
 * Notice file emitted into `dist/` for the bundled MIT/OFL-licensed
 * dependencies. Generated at build time so it cannot drift from the tree the
 * bundle was actually built from.
 */
const LICENSES_FILE = "licenses.txt";

/** Separator between one set of terms and the next. */
const RULE = "-".repeat(78);

/** The `package.json` fields of an installed dependency that the notice needs. */
interface DependencyManifest {
  readonly name: string;
  readonly version: string;
  readonly license?: string;
  readonly dependencies?: Record<string, string>;
}

/** Reads an installed package's manifest from `node_modules`. */
function readManifest(name: string): DependencyManifest {
  return JSON.parse(
    readFileSync(join("node_modules", name, "package.json"), "utf8"),
  ) as DependencyManifest;
}

/**
 * Every package that reaches the browser: runtime dependencies and their
 * transitive dependencies. `devDependencies` are excluded since none of them
 * end up in the bundle.
 */
function runtimeDependencies(): DependencyManifest[] {
  const found = new Map<string, DependencyManifest>();
  const visit = (name: string): void => {
    if (found.has(name)) return;
    const manifest = readManifest(name);
    found.set(name, manifest);
    for (const dependency of Object.keys(manifest.dependencies ?? {})) visit(dependency);
  };
  for (const name of Object.keys(packageJson.dependencies)) visit(name);
  return [...found.values()].sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Reads the license text a package ships.
 * @throws If it ships no license file to reproduce.
 */
function readLicenseText(name: string): string {
  const directory = join("node_modules", name);
  const file = readdirSync(directory).find((entry) => /^licen[cs]e/i.test(entry));
  if (file === undefined) {
    throw new Error(
      `${name} ships no license file, so ${LICENSES_FILE} cannot reproduce its terms. ` +
        "Add them to vite.config.ts by hand, or drop the dependency.",
    );
  }
  return readFileSync(join(directory, file), "utf8").trim();
}

/** Formats one titled, underlined block of the notice file. */
function section(title: string, body: string): string {
  return `${title}\n${"=".repeat(title.length)}\n\n${body.trim()}\n`;
}

/** Builds the full contents of {@link LICENSES_FILE}. */
function renderLicenses(): string {
  // Packages with byte-identical license text share one copy of it, since most
  // bundled packages are MIT and differ only in the copyright line.
  const byText = new Map<string, string[]>();
  for (const { name, version, license } of runtimeDependencies()) {
    const entry = `${name} ${version}${license === undefined ? "" : ` (${license})`}`;
    const text = readLicenseText(name);
    const grouped = byText.get(text);
    if (grouped === undefined) byText.set(text, [entry]);
    else grouped.push(entry);
  }
  const packages = [...byText].map(
    ([text, entries]) => `${RULE}\n${entries.join("\n")}\n${RULE}\n\n${text}`,
  );

  return [
    section(
      "Elevator Saga: licenses",
      `Everything this site is made of and the terms it comes under: the game
itself, the icon artwork, the interface font and the code editor. Written by
the build from the dependency tree it built with, so it describes this build
and no other.

Development tooling -- Vite, TypeScript, Vitest, ESLint, Playwright -- is not
listed. It builds and checks the site; none of it is copied into what is
served from here.

Source: ${packageJson.homepage.replace(/#.*$/, "")}`,
    ),
    section("Elevator Saga", readFileSync("LICENSE.txt", "utf8")),
    // Already carries its own heading, in the same style.
    readFileSync("src/shared/ui/fontawesome-license.txt", "utf8").trim() + "\n",
    section(
      "Bundled packages",
      `The editor is CodeMirror 6. It, and the packages it depends on in turn, are
installed from npm and end up inside the JavaScript and CSS this site serves.
Packages that ship identical terms are listed together, above the one copy of
them.

${packages.join("\n\n")}`,
    ),
  ].join("\n\n");
}

/** Vite plugin that emits {@link LICENSES_FILE} in the build and serves it in dev. */
function licenseNotices(): Plugin {
  return {
    name: "elevator-saga-license-notices",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: LICENSES_FILE, source: renderLicenses() });
    },
    configureServer(server) {
      server.middlewares.use(`/${LICENSES_FILE}`, (_request, response) => {
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end(renderLicenses());
      });
    },
  };
}

/**
 * The reference pages, which exist as no file: `src/docs-page/render.ts` builds
 * each from the catalogs at `src/i18n/docs-*.ts`.
 *
 * They are offered to Vite as ordinary HTML entries living at the root, so the
 * build injects their script and stylesheet as it does for `index.html` and
 * writes them out under the addresses they have always had. The dev server
 * reads HTML off disk, so it needs the pages handed to it separately.
 *
 * @returns The plugin.
 */
function referencePages(): Plugin {
  const pathFor = (locale: Locale): string => resolve(import.meta.dirname, docsPageFile(locale));
  const localeFor = (id: string): Locale | undefined =>
    LOCALES.find((locale) => pathFor(locale) === id);
  return {
    name: "elevator-saga-reference-pages",
    // Ahead of Vite's own HTML handling, which would otherwise try to read a
    // file that is not there.
    enforce: "pre",
    resolveId(id) {
      return localeFor(id) === undefined ? null : id;
    },
    load(id) {
      const locale = localeFor(id);
      return locale === undefined ? null : renderDocsPage(locale);
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? "").split("?")[0];
        const locale = LOCALES.find((candidate) => path === `/${docsPageFile(candidate)}`);
        if (locale === undefined) {
          next();
          return;
        }
        server
          .transformIndexHtml(request.url ?? "", renderDocsPage(locale))
          .then((html) => {
            response.setHeader("Content-Type", "text/html; charset=utf-8");
            response.end(html);
          })
          .catch(next);
      });
    },
  };
}

export default defineConfig({
  plugins: [licenseNotices(), referencePages()],
  resolve: {
    // Mirrors tsconfig.json's path aliases; Vite/esbuild/Vitest never read tsconfig.
    alias: [
      { find: "#shared", replacement: resolve(import.meta.dirname, "src/shared") },
      { find: "#entities", replacement: resolve(import.meta.dirname, "src/entities") },
      { find: "#features", replacement: resolve(import.meta.dirname, "src/features") },
      { find: "#widgets", replacement: resolve(import.meta.dirname, "src/widgets") },
      { find: "#pages", replacement: resolve(import.meta.dirname, "src/pages") },
      { find: "#app", replacement: resolve(import.meta.dirname, "src/app") },
      { find: "#game", replacement: resolve(import.meta.dirname, "src/game") },
      { find: "#i18n", replacement: resolve(import.meta.dirname, "src/i18n") },
    ],
  },
  // Relative base so the built site works when served from a sub-path (e.g.
  // a GitHub Pages project page).
  root: ".",
  base: "./",
  // Off Vite's defaults (5173/4173) so this dev server doesn't collide with
  // every other Vite project on the machine.
  server: { port: 7377 },
  preview: { port: 7477 },
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: true,
    emptyOutDir: true,
    // Never inline a font regardless of size, so one can't sneak into the
    // stylesheet as base64 and force every reader to download it.
    assetsInlineLimit: (filePath: string): boolean | undefined =>
      /\.(?:woff2?|ttf|otf|eot)$/i.test(filePath) ? false : undefined,
    // `rollupOptions` is a deprecated alias Vite 8 folds into this one.
    rolldownOptions: {
      // Every HTML entry point must be listed here, or it's simply absent from
      // `dist/`. The reference entries are absolute paths because no file sits
      // at any of them: they are what `referencePages` answers `resolveId` with.
      input: {
        index: "index.html",
        ...Object.fromEntries(
          LOCALES.map((locale) => [
            `documentation-${locale}`,
            resolve(import.meta.dirname, docsPageFile(locale)),
          ]),
        ),
      },
      output: {
        // Splits the editor (~92% of the bundle) into its own chunk so a game
        // change doesn't invalidate the dependency bytes in returning players'
        // caches. Both chunks are statically imported and preload in parallel.
        codeSplitting: {
          groups: [
            // Listed first with higher priority since @lezer/* has no dependency
            // on editor-vendor, keeping the two chunks acyclic.
            {
              name: "editor-grammar",
              priority: 2,
              test: /node_modules[\\/]@lezer[\\/]/,
            },
            // Stylesheets are excluded; CSS belongs in Vite's emitted stylesheet, not a JS chunk.
            {
              name: "editor-vendor",
              priority: 1,
              test: (id: string): boolean => id.includes("node_modules") && !id.endsWith(".css"),
            },
          ],
        },
      },
    },
  },
  // The fitness benchmark runs in a module worker, so worker chunks build as ES modules.
  worker: {
    format: "es",
  },
  test: {
    // Simulation/domain code needs no DOM; files that do opt in per-file with
    // a `// @vitest-environment jsdom` docblock.
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Loads every message catalog before tests run, since catalogs are fetched
    // asynchronously and tests assert on translated text after setLocale().
    setupFiles: ["src/i18n/test-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/test-helpers.ts", "src/i18n/test-setup.ts"],
      // A ratchet, not a target: each threshold sits a whole percent below
      // current coverage, so ordinary drift passes but untested code doesn't
      // land. Global rather than per-file since main.ts/docs.ts are covered by e2e/ instead.
      thresholds: {
        statements: 95,
        branches: 93,
        functions: 94,
        lines: 95,
      },
    },
  },
});
