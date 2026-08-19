/**
 * The star badge `design/ui-mockup.html` draws for a challenge's best tier —
 * its `starsBox()`/`starsHtml()` (a level-switcher tile's badge, and a tier
 * popover row's own header use the identical markup: three stars, lit up to
 * the tier earned, tinted by CSS keyed off `data-tier`). One function serves
 * both: the level switcher passes the tile's own best tier (or `undefined`
 * for none earned yet); a tier popover row passes that row's tier, which is
 * always defined.
 */

import { CHALLENGE_TIERS } from "#game/challenge-tiers.ts";
import type { ChallengeTier } from "#game/challenge-tiers.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw } from "#shared/ui/markup.ts";

/** Stars a badge always shows, lit or not — one per tier in {@link CHALLENGE_TIERS}. */
const STAR_COUNT = CHALLENGE_TIERS.length;

/**
 * Markup for a tier badge: {@link STAR_COUNT} stars, the first `n` lit for a
 * tier ranked `n` (bronze = 1 ... gold = {@link STAR_COUNT}), none lit for
 * `undefined`.
 *
 * `data-tier` carries the earned tier for CSS to tint the lit stars by; with
 * no tier earned there is nothing to tint, so it falls back to `"bronze"`,
 * matching the mockup's own `TIER_BY_COUNT[0]`.
 *
 * @param tier - The tier to badge, or `undefined` for none earned yet.
 * @returns The `<span class="stars">` markup.
 */
export function tierBadgeMarkup(tier: ChallengeTier | undefined): string {
  const earned = tier === undefined ? 0 : CHALLENGE_TIERS.indexOf(tier) + 1;
  const dataTier = tier ?? "bronze";
  const stars = Array.from({ length: STAR_COUNT }, (_, index) =>
    spriteIconMarkup("star", `star${index < earned ? " is-on" : ""}`),
  ).join("");
  return markup`<span class="stars" data-tier="${dataTier}">${raw(stars)}</span>`;
}
