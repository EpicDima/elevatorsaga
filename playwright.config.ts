/** Playwright configuration for the end-to-end smoke tests: does the built site boot at all. */

import { defineConfig } from "@playwright/test";

/**
 * Port `vite preview` serves the built site on. Overridable via `E2E_PORT`
 * since concurrent runs (e.g. multiple `git worktree`s) would otherwise
 * collide on a fixed port.
 */
const PORT = Number(process.env["E2E_PORT"] ?? 7477);

/** Where the tests point the browser. */
const BASE_URL = `http://localhost:${String(PORT)}`;

const isCI = process.env["CI"] !== undefined;

export default defineConfig({
  testDir: "e2e",
  // game-page.ts holds shared locators, not tests, so it doesn't match here.
  testMatch: "**/*.spec.ts",
  // Writes a tracked file (the README screenshot); run separately via playwright.screenshot.config.ts.
  testIgnore: "**/screenshot.spec.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  // No retries: a retry would hide the exact race this suite exists to catch.
  retries: 0,
  // A worker per core on CI, not Playwright's default half of them: these
  // specs mostly wait on a simulated building, so half the runner sat idle.
  // Spread because `exactOptionalPropertyTypes` won't take `undefined` for
  // "leave it to Playwright", which is what a developer's machine wants.
  ...(isCI ? { workers: "100%" } : {}),
  reporter: [[isCI ? "github" : "list"], ["html", { open: "never" }]],
  // Generous: a run may wait out a simulated minute of elevator traffic on a busy CI runner.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    // Recorded for every test and thrown away on a pass, since with no
    // retries a failure gets one chance to explain itself. `screenshots` off
    // costs only the viewer's filmstrip - it still replays the DOM snapshots,
    // and the frame that failed is kept below - and saves a fifth of the run.
    trace: { mode: "retain-on-failure", screenshots: false },
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // Not devices["Desktop Chrome"]: it spoofs a Windows UA, and CodeMirror's `Mod-`
      // sniffing would then put its bindings on a different key than Playwright's ControlOrMeta.
      use: { browserName: "chromium", viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    // The production build, not the dev server: the dev server serves unbundled modules with no
    // code splitting, which isn't what ships.
    command: `npm run build && npm run preview -- --port ${String(PORT)} --strictPort`,
    url: BASE_URL,
    // A cold `tsc --noEmit` plus a Vite build takes a while on a cold cache.
    timeout: 180_000,
    // Never reuses a listening server, so a stale dist/ can't slip through
    // untested; --strictPort makes a squatting server fail loudly instead.
    reuseExistingServer: false,
  },
});
