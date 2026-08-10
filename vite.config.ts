import { defineConfig } from "vitest/config";

export default defineConfig({
  // Repo root is the Vite root; relative base keeps the built site working from
  // any sub-path (e.g. GitHub Pages project pages served from /<repo>/).
  root: ".",
  base: "./",
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: true,
    emptyOutDir: true,
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
      exclude: ["src/**/*.test.ts"],
    },
  },
});
