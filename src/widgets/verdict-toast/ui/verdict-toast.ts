/**
 * The end-of-run verdict card: a check or cross, the title with the star row,
 * the message, the "what is still missing" hint, and what to do next.
 * Everything shown is caller-supplied and pre-evaluated; the widget holds no
 * state of its own, so a caller can redraw the same verdict in another language.
 */

import type { LevelTier } from "#entities/level-tier/index.ts";
import { TIER_NAME_KEY, tierBadgeMarkup } from "#entities/level-tier/index.ts";
import { t } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { iconMarkup, spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw, renderElement } from "#shared/ui/markup.ts";

/** What the end-of-run card says. */
export interface VerdictToastData {
  /** Whether the run cleared its level; not inferable from {@link tier} alone. */
  readonly won: boolean;
  /** Headline, e.g. `"Success!"`. */
  readonly title: string;
  /** Explanatory line under the headline. */
  readonly message: string;
  /** What the run needs for its next star, pre-translated trusted markup, or `""` for none. */
  readonly hint: string;
  /** Link to the next level, or `""` for no link. */
  readonly url: string;
  /** The tier earned, for a badge beside the title, or `undefined` to draw neither. */
  readonly tier: LevelTier | undefined;
}

/** The class the close button carries so {@link presentVerdictToast} can find it again. */
const CLOSE_SELECTOR = ".verdict-close";

/**
 * Markup for the end-of-run card. The next-run control is an `<a>`, not a
 * `<button>` like the rest, since it is a real navigation a player can
 * middle-click or copy.
 */
export function verdictToastTemplate(data: VerdictToastData): string {
  const mark = spriteIconMarkup(data.won ? "check" : "x");
  // Sprite icons are `aria-hidden`, so the tier name is spelled out in a
  // visually-hidden span for the medal to reach a screen reader.
  const stars =
    data.tier === undefined
      ? ""
      : markup`${raw(tierBadgeMarkup(data.tier))}<span class="visually-hidden">${t(
          "game.feedback.tierEarned",
          { tier: t(TIER_NAME_KEY[data.tier]) },
        )}</span>`;
  const hint = data.hint === "" ? "" : markup`<p class="verdict-more">${raw(data.hint)}</p>`;
  const next =
    data.url === ""
      ? ""
      : markup`<a href="${data.url}" class="btn btn-primary">${t("game.feedback.next")} ${raw(iconMarkup("caret-right", "blink"))}</a>`;
  return markup`<div class="${data.won ? "verdict" : "verdict is-fail"}"><span class="verdict-mark">${raw(
    mark,
  )}</span><div><h3>${data.title}${raw(stars)}</h3><p>${data.message}</p>${raw(
    hint,
  )}</div><div class="acts"><button type="button" class="btn verdict-close">${t(
    "game.feedback.dismiss",
  )}</button>${raw(next)}</div></div>`;
}

/**
 * Draws the card shown when a run ends, and wires its close button.
 * Closing empties `parent` rather than hiding the card, so the live region
 * is reset and the next verdict is a change worth announcing.
 */
export function presentVerdictToast(parent: HTMLElement, data: VerdictToastData): void {
  const card = renderElement(verdictToastTemplate(data));
  requireElement(CLOSE_SELECTOR, card).addEventListener("click", () => {
    parent.replaceChildren();
    // Removing the focused close button would drop focus to <body>. Instead,
    // send it to the nearest ancestor with a `tabindex` (`.world`'s
    // `tabindex="-1"`), which acts as a focus refuge for a keyboard player.
    const refuge = parent.closest("[tabindex]");
    if (refuge instanceof HTMLElement) {
      refuge.focus();
    }
  });
  parent.replaceChildren(card);
}
