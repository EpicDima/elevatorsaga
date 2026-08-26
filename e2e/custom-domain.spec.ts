/**
 * The `CNAME` file claiming the custom domain: nothing imports or links to
 * it, so a build that silently stopped copying it would only show up here.
 */

import { expect, test } from "@playwright/test";

test("publishes the custom domain in a CNAME file at the site root", async ({ page }) => {
  const response = await page.request.get("/CNAME");

  expect(response.status()).toBe(200);
  // GitHub reads the whole file as one hostname: a stray comment or second line voids the claim entirely.
  expect((await response.text()).trim()).toBe("elevatorsaga.epicdima.com");
});
