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
