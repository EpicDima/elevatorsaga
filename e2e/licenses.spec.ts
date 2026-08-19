/**
 * The licence notices: `dist/` ships code and fonts belonging to other people,
 * under terms that ask for their notices to travel with them. Unit tests can
 * check that the pages link to `licenses.txt`, but only the built site can say
 * whether the file is really there and really says what it should.
 */

import { expect, test } from "@playwright/test";

import { openSettingsMenu } from "./game-page.ts";

test("serves the licence notices from the About block's copyright line", async ({ page }) => {
  await page.goto("/");

  // The footer that used to carry a "Licences" link went with the app bar, and
  // a row of its own in the About block would have changed the shape
  // `design/ui-mockup.html` draws -- so the word "MIT", already in the
  // copyright notice, is the link. This is the game's only route to the file,
  // which is what makes it worth an end-to-end test of its own.
  await openSettingsMenu(page);
  const link = page.locator(".setmenu .sethint a");
  await expect(link).toHaveText("MIT");
  const href = await link.getAttribute("href");
  expect(href).not.toBeNull();

  const response = await page.request.get(new URL(href ?? "", page.url()).toString());
  expect(response.status()).toBe(200);
  const notices = await response.text();

  // The game's own terms, and the two obligations that made this file exist:
  // MIT for CodeMirror and the packages under it, OFL for the Oswald webfont
  // and for the Font Awesome outlines the icons are drawn from.
  expect(notices).toContain("The MIT License (MIT)");
  expect(notices).toContain("Magnus Wolffelt");
  expect(notices).toContain("codemirror");
  expect(notices).toContain("Marijn Haverbeke");
  expect(notices).toContain("@fontsource/oswald");
  expect(notices).toContain("The Oswald Project Authors");
  expect(notices).toContain("Font Awesome 4.1.0");
  expect(notices).toContain("SIL OPEN FONT LICENSE Version 1.1");
});
