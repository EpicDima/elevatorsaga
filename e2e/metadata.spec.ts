/**
 * The favicon, the link preview and the two files crawlers ask for: things the
 * pages only name or nothing names at all, so whether `dist/` really contains
 * them is a question only the built site answers. Whether the favicon is a
 * drawing or a parse error is a question only a browser answers; one of the
 * tests here asks it.
 */

import type { APIResponse, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { PREVIEW_IMAGE, SITEMAP_FILE, siteUrl } from "#shared/lib/site.ts";

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
  expect(image).toBe(siteUrl(PREVIEW_IMAGE));

  // Fetched from the server under test by path, not from the address the tag names: whether the
  // published site has the file is not a question this run can ask, or should hit the network to.
  const response = await fetchReference(page, new URL(image ?? "").pathname);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  // A rough floor for "big enough to actually be shown as a card image."
  expect((await response.body()).byteLength).toBeGreaterThan(10_000);
});

test("serves a shell with prose in it and none of the notes around it", async ({ page }) => {
  await page.goto("/");

  // The file as it is served, not the document the bundle has since rewritten: this is what a
  // crawler that runs no JavaScript is given, and all it will ever have of this page.
  const shell = (await (await fetchReference(page, "/index.html")).text()).replace(/\s+/g, " ");

  expect(shell).toContain("A programming game: you write JavaScript that drives");
  // index.html explains itself at length to whoever edits it; vite.config.ts keeps that out.
  expect(shell).not.toContain("<!--");
});

test("serves the file Google verifies the site's owner by", async ({ page }) => {
  // Nothing links to it and nothing imports it, so only this notices a build that stopped
  // copying it -- and Search Console rechecks the file long after the day it was added, so
  // losing it silently un-verifies the site and stops the reporting that came with it.
  const response = await page.request.get("/googlee79b527f86e1502f.html");

  expect(response.status()).toBe(200);
  expect((await response.text()).trim()).toBe(
    "google-site-verification: googlee79b527f86e1502f.html",
  );
});

test("serves robots.txt, and a sitemap whose every page is really there", async ({ page }) => {
  // Nothing links to either file, so a build that stopped emitting them would go unnoticed
  // everywhere else; and a sitemap listing an address that 404s is worse than no sitemap.
  await page.goto("/");

  const robots = await fetchReference(page, "/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain(`Sitemap: ${siteUrl(SITEMAP_FILE)}`);

  const sitemap = await fetchReference(page, `/${SITEMAP_FILE}`);
  expect(sitemap.status()).toBe(200);
  const listed = [...(await sitemap.text()).matchAll(/<loc>(.+?)<\/loc>/g)].map(
    (match) => new URL(match[1] ?? "").pathname,
  );
  expect(listed).toEqual(["/", "/documentation.html", "/documentation.ru.html"]);

  for (const path of listed) {
    // By path against the server under test: whether the published site answers is not a
    // question this run can ask.
    expect((await fetchReference(page, path)).status(), path).toBe(200);
  }
});
