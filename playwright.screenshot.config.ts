/**
 * Playwright configuration for refreshing `public/images/screenshot.png`.
 * A separate config, not an environment variable or a tag, so a plain
 * `npx playwright test` can't rewrite the tracked image. Run via `npm run screenshot`.
 */

import { defineConfig } from "@playwright/test";

import baseConfig from "./playwright.config.ts";

export default defineConfig({
  ...baseConfig,
  testMatch: "**/screenshot.spec.ts",
  testIgnore: [],
  reporter: [["list"]],
});
