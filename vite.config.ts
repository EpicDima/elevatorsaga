import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

import packageJson from "./package.json" with { type: "json" };
import { docsPageFile, renderDocsPage } from "./src/docs-page/render.ts";
import { LOCALES, type Locale } from "./src/i18n/locale.ts";

/**
 * The notice file the build emits beside the pages, linked from every reference
 * page's footer.
 *
 * `dist/` is what players are actually served, and it carries MIT-licensed code
 * (CodeMirror and its Lezer parser, ~500 kB of the bundle) and OFL-licensed
 * artwork (the Font Awesome 4 outlines inlined by `src/shared/ui/icon.ts`).
 * MIT asks for its notice to travel with substantial portions of the software;
 * OFL asks for the copyright notice and license to be bundled with the font
 * software, and those outlines are font software whatever they are drawn as.
 * Neither obligation is met by a license file that only exists in the
 * repository, so the build has to put one in `dist/`.
 *
 * There is no webfont here any more: the interface is set in the platform's own
 * UI face, so the twenty Oswald binaries this used to copy into `dist/assets/`
 * are not built and the OFL entry for them is not printed.
 *
 * Generated rather than committed. A hand-written file under `public/` would be
 * simpler, but it would silently start lying the first time a dependency is
 * added, removed or relicensed, and nothing in the repository would catch it.
 * Reading the terms out of `node_modules` at build time cannot drift: the
 * notice describes the tree the bundle was built from, and a package that ships
 * no license text at all stops the build instead of quietly vanishing from the
 * list. The cost is the hundred-odd lines below, and no new dependency.
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

/**
 * Reads an installed package's manifest.
 *
 * Paths are relative to the Vite root, which is this directory (see `root`
 * below); npm flattens `node_modules`, so every package sits directly under it.
 *
 * @param name - Package name, e.g. `@codemirror/view`.
 * @returns Its manifest.
 */
function readManifest(name: string): DependencyManifest {
  return JSON.parse(
    readFileSync(join("node_modules", name, "package.json"), "utf8"),
  ) as DependencyManifest;
}

/**
 * Every package that reaches the browser: the runtime dependencies, and theirs.
 *
 * `devDependencies` are deliberately not walked. They build, check and test the
 * site; no part of them is copied into it, so nothing about them is distributed
 * and no notice is owed. (Worth re-checking if a dynamic `import()` ever
 * appears: that is what would make Vite inject its own preload helper into a
 * chunk. Today nothing in `dist/` comes from a devDependency.)
 *
 * @returns The manifests, by name.
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
 * The license text a package ships.
 *
 * @param name - Package name.
 * @returns The contents of its `LICENSE` file.
 * @throws If it ships none, leaving nothing to reproduce.
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

/**
 * One titled block of the notice file, underlined the way the rest of it is.
 *
 * @param title - The heading.
 * @param body - Whatever goes under it.
 * @returns The block.
 */
function section(title: string, body: string): string {
  return `${title}\n${"=".repeat(title.length)}\n\n${body.trim()}\n`;
}

/**
 * Builds {@link LICENSES_FILE}.
 *
 * @returns The whole notice, ready to serve as `text/plain`.
 */
function renderLicenses(): string {
  // Nearly all of the bundled packages are MIT, and most of those differ only in
  // the copyright line, so packages whose license text is byte-identical share
  // one copy of it. Reproducing each notice once, against the list of packages
  // it covers, is what MIT asks for and is a third of the length.
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

/**
 * Puts {@link LICENSES_FILE} in the build output, and serves the same bytes
 * from the dev server so the footer link is never dead.
 *
 * @returns The plugin.
 */
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
    // Mirrors tsconfig.json's compilerOptions.paths: TypeScript resolves these
    // for type-checking, but Vite/esbuild/Vitest never read that field, so the
    // same mapping has to be repeated here for the build, dev server and tests.
    // `#`-prefixed to match package.json's "imports" field (see tsconfig.json's
    // comment for why: it is what lets `node src/cli/bench.ts` follow them too).
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
  // Repo root is the Vite root; relative base keeps the built site working from
  // any sub-path (e.g. GitHub Pages project pages served from /<repo>/).
  root: ".",
  base: "./",
  // Off Vite's defaults (5173 / 4173), which every other Vite project on the
  // machine also claims -- so `npm run dev` here no longer has to guess whether
  // the tab already open on 5173 is this game or something else. Both are
  // unregistered and outside the ephemeral range the OS hands out, and they are
  // far enough apart that a dev server bumped forward by a busy port cannot
  // land on the preview one.
  server: { port: 7377 },
  preview: { port: 7477 },
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: true,
    emptyOutDir: true,
    // Never inline a font, whatever its size. Nothing here ships one today --
    // the interface is set in the platform's own UI face and the icons are
    // inline SVG -- but the default 4 kB limit was small enough to base64 a
    // font subset into the stylesheet, where every reader downloads it whether
    // their language needs it or not, and that is worth refusing before it can
    // happen again rather than after. Everything else keeps the default.
    assetsInlineLimit: (filePath: string): boolean | undefined =>
      /\.(?:woff2?|ttf|otf|eot)$/i.test(filePath) ? false : undefined,
    // `rollupOptions` is a deprecated alias Vite 8 folds into this one
    // (`rolldownOptions ??= rollupOptions`), so only one of the two is ever read.
    rolldownOptions: {
      // The game, and the help/API reference in each of its languages. Every
      // page needs its own entry: Vite only processes the HTML files named
      // here, so one left out is simply absent from `dist/` -- and the links
      // between the reference pages would 404 in the built site. The reference
      // entries are absolute paths because no file sits at any of them: they
      // are what `referencePages` above answers `resolveId` with.
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
        // The editor is ~92% of the bundle (CodeMirror and its Lezer parser,
        // ~497 kB raw / ~167 kB gzip; the game, UI and app layers together are
        // ~45 kB). All of it is needed on load -- the editor is primary UI --
        // so none of it is deferred behind a dynamic import: that would only
        // add a round trip in front of the widget the player types into. It is
        // split out so that shipping a change to the game no longer
        // invalidates the dependency bytes in returning players' caches, and
        // so no single chunk sits near the 500 kB warning limit. Both chunks
        // are statically imported, so Vite preloads them from the HTML and
        // they download in parallel with the entry chunk.
        codeSplitting: {
          groups: [
            // The parser and highlighter layer. Listed first, and with the
            // higher priority, because @lezer/* depends on nothing else here:
            // taking it out leaves the two chunks acyclic, `editor-vendor` ->
            // `editor-grammar` and no edge back.
            {
              name: "editor-grammar",
              priority: 2,
              test: /node_modules[\\/]@lezer[\\/]/,
            },
            // CodeMirror itself and its small helpers. Stylesheets are left
            // out: the fontsource CSS is imported by both pages and belongs in
            // the one stylesheet Vite already emits, not in a JS chunk group.
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
  // The fitness benchmark runs in a module worker (src/app/fitness-worker.ts),
  // so worker chunks are emitted as ES modules rather than the default IIFE.
  worker: {
    format: "es",
  },
  test: {
    // Node is the default environment; simulation/domain code needs no DOM.
    // Files that need a DOM opt in per-file with a `// @vitest-environment jsdom`
    // docblock at the top of the test file.
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Loads every message catalog before a test file starts, because the
    // catalogs are fetched at run time now and a fetch is asynchronous, while
    // `setLocale("ru")` followed by an assertion about Russian text is how the
    // tests across src/game, src/app and src/i18n are written. The file itself
    // explains the trade and what covers the loading path instead; it is a
    // Vitest-only file, so nothing it imports reaches a bundle.
    setupFiles: ["src/i18n/test-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/test-helpers.ts", "src/i18n/test-setup.ts"],
      // A ratchet, not a target. CI already runs the whole suite; without a
      // floor it reports a number nobody reads, and code can arrive untested
      // without anything going red. Each figure is a whole percent below what
      // the suite measures today (96.25 statements, 94.6 branches, 95.74
      // functions, 96.18 lines), so ordinary movement passes and a module
      // landing with no tests at all does not.
      //
      // Global rather than per-file on purpose: `src/main.ts` and `src/docs.ts`
      // are the two page entry points, they wire the pieces together and are
      // covered by `e2e/` instead, which this run knows nothing about. A
      // per-file floor would fail on them and be answered by excluding them,
      // which is how a coverage gate stops meaning anything.
      thresholds: {
        statements: 95,
        branches: 93,
        functions: 94,
        lines: 95,
      },
    },
  },
});
