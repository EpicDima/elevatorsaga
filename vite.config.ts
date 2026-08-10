import { defineConfig } from "vitest/config";

import packageJson from "./package.json" with { type: "json" };

export default defineConfig({
  // package.json is the only place the version is written down; src/ui/version.ts
  // reads it from here and puts it in the footer. This is a compile-time
  // substitution, so it reaches the built bundle and the test run alike.
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  // Repo root is the Vite root; relative base keeps the built site working from
  // any sub-path (e.g. GitHub Pages project pages served from /<repo>/).
  root: ".",
  base: "./",
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: true,
    emptyOutDir: true,
    // `rollupOptions` is a deprecated alias Vite 8 folds into this one
    // (`rolldownOptions ??= rollupOptions`), so only one of the two is ever read.
    rolldownOptions: {
      // Two pages: the game and the help/API reference.
      input: {
        index: "index.html",
        documentation: "documentation.html",
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
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/test-helpers.ts"],
    },
  },
});
