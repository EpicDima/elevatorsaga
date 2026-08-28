// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { renderRobots, renderSitemap, SITE_ORIGIN, SITEMAP_FILE, siteUrl } from "./site.ts";

describe("SITE_ORIGIN", () => {
  it("is an origin and nothing else", () => {
    // A path, a query or a trailing slash here would be doubled by every caller below.
    const url = new URL(SITE_ORIGIN);
    expect(url.origin).toBe(SITE_ORIGIN);
    expect(url.pathname).toBe("/");
  });

  it("is served over https, since a canonical link naming http would demote the site it names", () => {
    expect(SITE_ORIGIN.startsWith("https://")).toBe(true);
  });
});

describe("siteUrl", () => {
  it("addresses the game itself as the root", () => {
    expect(siteUrl()).toBe(`${SITE_ORIGIN}/`);
    expect(siteUrl("")).toBe(`${SITE_ORIGIN}/`);
  });

  it("addresses a page under it", () => {
    expect(siteUrl("documentation.html")).toBe(`${SITE_ORIGIN}/documentation.html`);
    expect(siteUrl("images/screenshot.png")).toBe(`${SITE_ORIGIN}/images/screenshot.png`);
  });

  it("builds an address a crawler can parse", () => {
    expect(new URL(siteUrl("documentation.ru.html")).pathname).toBe("/documentation.ru.html");
  });
});

/** The sitemap parsed as the XML it claims to be; `parsererror` is how jsdom reports a malformed one. */
function parseSitemap(xml: string): Document {
  const parsed = new DOMParser().parseFromString(xml, "text/xml");
  expect(parsed.querySelector("parsererror")?.textContent ?? null).toBeNull();
  return parsed;
}

describe("renderSitemap", () => {
  const paths = ["", "documentation.html", "documentation.ru.html"];

  it("is XML a crawler can parse, under the schema it names", () => {
    const sitemap = parseSitemap(renderSitemap(paths));
    expect(sitemap.documentElement.tagName).toBe("urlset");
    expect(sitemap.documentElement.getAttribute("xmlns")).toBe(
      "http://www.sitemaps.org/schemas/sitemap/0.9",
    );
  });

  it("lists every page it was given, once, at its absolute address", () => {
    const sitemap = parseSitemap(renderSitemap(paths));
    expect([...sitemap.querySelectorAll("url > loc")].map((loc) => loc.textContent)).toEqual(
      paths.map((path) => siteUrl(path)),
    );
  });

  it("stays valid with nothing to list", () => {
    // Not a case the build produces, but an empty urlset is the only honest rendering of one.
    expect(parseSitemap(renderSitemap([])).querySelectorAll("url")).toHaveLength(0);
  });
});

describe("renderRobots", () => {
  it("hides nothing and points at the sitemap, absolutely", () => {
    // A relative Sitemap: line is ignored, so this is the whole point of the file.
    expect(renderRobots()).toBe(
      `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/${SITEMAP_FILE}\n`,
    );
  });
});
