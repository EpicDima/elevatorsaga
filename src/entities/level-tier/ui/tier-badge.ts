/** The star badge for a level's best tier: stars lit up to the tier earned, tinted by CSS keyed off `data-tier`. */

import { LEVEL_TIERS } from "#game/level-tiers.ts";
import type { LevelTier } from "#game/level-tiers.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw } from "#shared/ui/markup.ts";

/** Stars a badge always shows, lit or not — one per tier in {@link LEVEL_TIERS}. */
const STAR_COUNT = LEVEL_TIERS.length;

/**
 * Markup for a tier badge: the first `n` of {@link STAR_COUNT} stars lit for a
 * tier ranked `n`, none lit for `undefined`. `data-tier` falls back to
 * `"bronze"` when nothing is earned, since CSS needs some tier to tint by.
 */
export function tierBadgeMarkup(tier: LevelTier | undefined): string {
  const earned = tier === undefined ? 0 : LEVEL_TIERS.indexOf(tier) + 1;
  const dataTier = tier ?? "bronze";
  const stars = Array.from({ length: STAR_COUNT }, (_, index) =>
    spriteIconMarkup("star", `star${index < earned ? " is-on" : ""}`),
  ).join("");
  return markup`<span class="stars" data-tier="${dataTier}">${raw(stars)}</span>`;
}
