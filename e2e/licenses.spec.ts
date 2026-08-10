/**
 * The licence notices: `dist/` ships code and fonts belonging to other people,
 * under terms that ask for their notices to travel with them. Unit tests can
 * check that the pages link to `licenses.txt`, but only the built site can say
 * whether the file is really there and really says what it should.
 */

import { expect, test } from "@playwright/test";

test("serves the licence notices from a link in the footer", async ({ page }) => {
  await page.goto("/");

  const link = page.getByRole("contentinfo").getByRole("link", { name: "Licences" });
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
