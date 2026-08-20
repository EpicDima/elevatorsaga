/**
 * The `CNAME` file that claims the custom domain.
 *
 * It is one line of text in `public/`, which is the kind of file a build can
 * stop copying without anything else noticing: nothing imports it, no page
 * links to it, and a bundler that quietly changed where it looks for static
 * assets would break it silently. What that costs is the whole site — the
 * domain stops resolving to this repository's pages and every link to it
 * 404s — so the one place it can be checked is the built output, served the
 * way GitHub Pages serves it.
 */

import { expect, test } from "@playwright/test";

test("publishes the custom domain in a CNAME file at the site root", async ({ page }) => {
  const response = await page.request.get("/CNAME");

  expect(response.status()).toBe(200);
  // Exactly the domain and nothing else. GitHub reads the whole file as one
  // hostname, so a comment, a second line or a stray `https://` does not
  // degrade the claim, it voids it.
  expect((await response.text()).trim()).toBe("elevatorsaga.epicdima.com");
});
