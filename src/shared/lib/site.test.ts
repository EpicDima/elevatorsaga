import { describe, expect, it } from "vitest";

import { SITE_ORIGIN, siteUrl } from "./site.ts";

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
