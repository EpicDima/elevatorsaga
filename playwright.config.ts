/**
 * Playwright configuration for the end-to-end smoke tests.
 *
 * These tests are deliberately few. The 691 Vitest tests already cover the
 * simulation, the presenters and the editor in depth, in isolation and without
 * a browser; what they cannot cover is whether the *built* site boots at all —
 * whether the entry chunk, the two split editor chunks and the stylesheet
 * actually load and wire themselves together. That is what `e2e/` is for, and
 * why it stays a handful of journeys rather than a second suite.
 *
 * The two runners cannot collect each other's files: Vitest's `include` (see
 * `vite.config.ts`) reaches only into `src/` and only for `.test.ts`, and
 * Playwright looks only inside `e2e/` and only for `.spec.ts`.
 */

import { defineConfig } from "@playwright/test";

/** Port `vite preview` serves the built site on for the duration of a run. */
const PORT = 4173;

/** Where the tests point the browser. */
const BASE_URL = `http://localhost:${String(PORT)}`;

/** Whether this run is happening on CI. */
const isCI = process.env["CI"] !== undefined;

export default defineConfig({
  testDir: "e2e",
  // `e2e/game-page.ts` holds shared locators, not tests; only `*.spec.ts` is
  // collected.
  testMatch: "**/*.spec.ts",
  // The README screenshot is captured by a spec too — it needs the same browser
  // and the same server — but it writes a tracked file, so it is not something
  // a plain test run should do. `playwright.screenshot.config.ts` runs it.
  testIgnore: "**/screenshot.spec.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  // No retries, on purpose. This suite exists to answer "does the built site
  // work"; a retry would turn a real race into an intermittent pass and hide
  // exactly the kind of breakage it is here to catch. The tests are written
  // with web-first assertions and no fixed sleeps so they do not need one.
  retries: 0,
  reporter: [[isCI ? "github" : "list"], ["html", { open: "never" }]],
  // Generous, because a run may have to wait on a simulated minute of elevator
  // traffic on a busy CI runner. Nothing here is expected to come near it.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // Not `devices["Desktop Chrome"]`: that descriptor spoofs a Windows user
      // agent, and CodeMirror decides whether `Mod-` means Ctrl or Command by
      // sniffing it. Faking Windows on macOS would put the editor's key
      // bindings and Playwright's `ControlOrMeta` on different keys.
      use: { browserName: "chromium", viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    // The production build, not the dev server. The dev server hands over
    // unbundled ES modules with no code splitting, so it would answer a
    // question nobody is asking: the artifact that ships is `dist/`, complete
    // with the `editor-vendor` / `editor-grammar` chunks and the relative base
    // path, and that is what should be smoke-tested.
    command: `npm run build && npm run preview -- --port ${String(PORT)} --strictPort`,
    url: BASE_URL,
    // A cold `tsc --noEmit` plus a Vite build takes a while on a cold cache.
    timeout: 180_000,
    reuseExistingServer: !isCI,
  },
});
