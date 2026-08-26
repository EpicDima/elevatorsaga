/**
 * `dist/` ships code and fonts belonging to other people, under terms that
 * require their notices to travel along - only the built site can say
 * whether the notice file is really there and says what it should.
 */

import { expect, test } from "@playwright/test";

import { openSettingsMenu } from "./game-page.ts";

test("serves the license notices from the About block's copyright line", async ({ page }) => {
  await page.goto("/");

  // The game's only route to the file: the word "MIT" in the copyright notice, not a footer link.
  await openSettingsMenu(page);
  const link = page.locator(".setmenu .sethint a");
  await expect(link).toHaveText("MIT");
  const href = await link.getAttribute("href");
  expect(href).not.toBeNull();

  const response = await page.request.get(new URL(href ?? "", page.url()).toString());
  expect(response.status()).toBe(200);
  const notices = await response.text();

  // MIT for CodeMirror, OFL for the Font Awesome icon outlines; no webfont ships, so none should be claimed.
  expect(notices).toContain("The MIT License (MIT)");
  expect(notices).toContain("Magnus Wolffelt");
  expect(notices).toContain("codemirror");
  expect(notices).toContain("Marijn Haverbeke");
  expect(notices).toContain("Font Awesome 4.1.0");
  expect(notices).toContain("SIL OPEN FONT LICENSE Version 1.1");
  expect(notices).not.toContain("Oswald");
});
