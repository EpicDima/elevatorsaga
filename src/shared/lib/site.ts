/**
 * Where this site is published.
 *
 * Everything else the build emits is site-relative -- `vite.config.ts` sets
 * `base: "./"` so `dist/` runs from whatever directory it is dropped into --
 * but a canonical link, an Open Graph URL and a sitemap entry are absolute by
 * definition: each names which address is the real one, and a relative URL
 * names no particular copy. A copy served from anywhere else points back here,
 * which is what a mirror should say about itself.
 */

/** The origin the site is served from, with no trailing slash. */
export const SITE_ORIGIN = "https://elevatorsaga.epicdima.com";

/** The picture a chat client shows for a pasted link, as a path from the site root. */
export const PREVIEW_IMAGE = "images/screenshot.png";

/** What the sitemap is published as, which is also where `robots.txt` says it is. */
export const SITEMAP_FILE = "sitemap.xml";

/**
 * The absolute address of one published page or file.
 *
 * @param path - Its path from the site root, with no leading slash; the empty
 * string for the game itself, which is served as the root.
 * @returns The address, origin included.
 */
export function siteUrl(path = ""): string {
  return `${SITE_ORIGIN}/${path}`;
}

/**
 * The sitemap: every page a crawler should know exists.
 *
 * No `lastmod`, `changefreq` or `priority`. The first would be the build's own
 * clock rather than the day a page changed, and search engines discount the
 * other two entirely; a list of addresses is the part that is read.
 *
 * @param paths - The pages, as {@link siteUrl} takes them.
 * @returns The XML document.
 */
export function renderSitemap(paths: readonly string[]): string {
  const entries = paths.map((path) => `  <url>\n    <loc>${siteUrl(path)}</loc>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

/**
 * `robots.txt`: nothing here is worth hiding, so all it does is point at the
 * sitemap, which is the one thing a crawler cannot guess.
 *
 * @returns The file's contents.
 */
export function renderRobots(): string {
  return `User-agent: *
Allow: /

Sitemap: ${siteUrl(SITEMAP_FILE)}
`;
}
