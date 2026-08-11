/**
 * The favicon and the link preview: both are files the pages only name, and a
 * name is all a unit test can check. Whether `dist/` actually contains them --
 * whether `public/` was copied, and whether Vite rewrote the leading slash to
 * `base: "./"` rather than leaving an absolute path that breaks under a
 * subdirectory -- is a question only the built site answers.
 */

import type { APIResponse, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * Fetches a URL a page refers to, resolved the way the browser resolves it.
 *
 * @param page - The page carrying the reference.
 * @param url - The value of the `href` or `content` attribute.
 * @returns The response.
 */
async function fetchReference(page: Page, url: string): Promise<APIResponse> {
  // Resolving against page.url() is the point: `./favicon.svg` has to be
  // correct from where the page itself is served, not from the site root.
  return page.request.get(new URL(url, page.url()).toString());
}

for (const path of ["/", "/documentation.html", "/documentation.ru.html"]) {
  test(`serves the favicon ${path} asks for`, async ({ page }) => {
    await page.goto(path);

    const href = await page.locator("link[rel='icon']").getAttribute("href");
    expect(href).toBe("./favicon.svg");

    const response = await fetchReference(page, href ?? "");
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("<svg");
  });
}

test("serves the image its link preview promises", async ({ page }) => {
  await page.goto("/");

  const image = await page.locator("meta[property='og:image']").getAttribute("content");
  expect(image).toBe("./images/screenshot.png");

  const response = await fetchReference(page, image ?? "");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  // A card image is worth having only if it is big enough to be shown as one;
  // Twitter's summary_large_image wants at least 300x157.
  expect((await response.body()).byteLength).toBeGreaterThan(10_000);
});
