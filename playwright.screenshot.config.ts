/**
 * Playwright configuration for refreshing `images/screenshot.png`.
 *
 * The capture needs everything the smoke suite needs — a Chromium and the built
 * site on a server — so it reuses that configuration wholesale and only swaps
 * which file is collected. It is a separate config rather than an environment
 * variable or a tag so that `npx playwright test` cannot rewrite a tracked
 * image, and so CI never reports a permanently skipped test.
 *
 * Run it with `npm run screenshot`.
 */

import { defineConfig } from "@playwright/test";

import baseConfig from "./playwright.config.ts";

export default defineConfig({
  ...baseConfig,
  testMatch: "**/screenshot.spec.ts",
  testIgnore: [],
  reporter: [["list"]],
});
