/**
 * The favicon and the link preview: files the pages only name, so whether
 * `dist/` really contains them is a question only the built site answers.
 * Whether the favicon is a drawing or a parse error is a question only a
 * browser answers; the last test here asks it.
 */

import type { APIResponse, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/** Fetches a URL a page refers to, resolved against the page's own URL, not the site root. */
async function fetchReference(page: Page, url: string): Promise<APIResponse> {
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

test("serves a favicon the browser can actually draw", async ({ page }) => {
  // Serving the bytes isn't the same as drawing them: an SVG can fail strict
  // XML parsing (breaking every tab's favicon) while still passing a text
  // search for `<svg`, so this opens the file as a page instead of fetching it.
  await page.goto("/");
  const href = await page.locator("link[rel='icon']").getAttribute("href");
  await page.goto(new URL(href ?? "", page.url()).toString());

  const drawn = await page.evaluate(() => ({
    root: document.documentElement.tagName,
    title: document.querySelector("title")?.textContent ?? null,
    shapes: document.querySelectorAll("rect").length,
  }));
  // An error document's root is `html`, not `svg`.
  expect(drawn).toEqual({ root: "svg", title: "Elevator Saga", shapes: 3 });
});

test("serves the image its link preview promises", async ({ page }) => {
  await page.goto("/");

  const image = await page.locator("meta[property='og:image']").getAttribute("content");
  expect(image).toBe("./images/screenshot.png");

  const response = await fetchReference(page, image ?? "");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  // A rough floor for "big enough to actually be shown as a card image."
  expect((await response.body()).byteLength).toBeGreaterThan(10_000);
});
