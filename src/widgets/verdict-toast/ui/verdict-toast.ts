/**
 * The end-of-run verdict card: a check or a cross in a circle, the title with
 * the star row beside it, the message, the "what is still missing" hint, and
 * the two things there are to do next.
 *
 * A card at the foot of the stage, not a full-bleed scrim over it: the building
 * underneath is the other half of the verdict. It is drawn into
 * `.feedbackcontainer`, which is `index.html`'s permanent `role="status"` and
 * covers the same box the stage does.
 *
 * Everything this widget knows, it is told. The tier is caller-supplied and
 * already evaluated (by `evaluateLevelTier`), the hint likewise (by
 * `#entities/level-tier`'s `nextTierHint`), and the three sentences are
 * whatever the caller composed — this widget never reaches into `#game` or a
 * `World` to work any of it out itself. That is what lets `App#relocalize`
 * redraw the same verdict in another language by calling its caller again, with
 * no state of its own to keep in step.
 */

import type { LevelTier } from "#entities/level-tier/index.ts";
import { TIER_NAME_KEY, tierBadgeMarkup } from "#entities/level-tier/index.ts";
import { t } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { iconMarkup, spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw, renderElement } from "#shared/ui/markup.ts";

/** What the end-of-run card says. */
export interface VerdictToastData {
  /**
   * Whether the run cleared its level. Drives the check/cross mark and
   * `.is-fail`, and is not inferable from {@link tier}: a level on the learning
   * track wins without one.
   */
  readonly won: boolean;
  /** Headline, e.g. `"Success!"`. */
  readonly title: string;
  /** Explanatory line under the headline. */
  readonly message: string;
  /**
   * What the run would need for its next star, already composed and already
   * translated — `""` for no hint line at all, which is the ordinary case for
   * a loss, for a run already rated gold, and for any run with no tier
   * concept. Trusted markup: it carries the figures wrapped in the span the
   * game paints numbers with.
   */
  readonly hint: string;
  /** Link to the next level, or `""` for no link. */
  readonly url: string;
  /**
   * The tier earned, for a badge beside the title and the medal's name behind
   * it — `undefined` to draw neither (a loss, a tutorial level, or any run with
   * no tier concept).
   */
  readonly tier: LevelTier | undefined;
}

/** The class the close button carries so {@link presentVerdictToast} can find it again. */
const CLOSE_SELECTOR = ".verdict-close";

/**
 * Markup for the end-of-run card.
 *
 * The next-run control is an `<a>` while everything beside it is a `<button>`,
 * because it is one: it changes the address, it is the thing a player
 * middle-clicks or copies, and `App` reads its `href` back out when it relabels
 * the learning track's version of it. It still wears `.btn.btn-primary`, being
 * the card's primary action.
 *
 * @param data - The verdict, its message, its hint and where to go next.
 * @returns The card's markup.
 */
export function verdictToastTemplate(data: VerdictToastData): string {
  const mark = spriteIconMarkup(data.won ? "check" : "x");
  // The badge is icons, and every sprite icon is `aria-hidden`, so the medal a
  // run just won would otherwise reach nobody who is not looking at the stars:
  // the title says "Success!" and the hint says what the *next* star needs. The
  // name beside them is the same one the goal bar's trigger reads, in the same
  // colon shape, which is what keeps a tier's name nominative in Russian.
  const stars =
    data.tier === undefined
      ? ""
      : markup`${raw(tierBadgeMarkup(data.tier))}<span class="visually-hidden">${t(
          "game.feedback.tierEarned",
          { tier: t(TIER_NAME_KEY[data.tier]) },
        )}</span>`;
  // Absent rather than hidden when there is nothing to say, the way the star
  // badge already is: the card is built fresh for every verdict, so there is
  // never an element left over to toggle `hidden` on.
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
 *
 * Closing empties `parent` rather than hiding the card, so that the live
 * region is back to the state `index.html` ships it in and the next verdict
 * arriving in it is a change worth announcing. It promises nothing else: a
 * second control offering to restart the run would be one promise too many,
 * and restarting is what the app bar's own button is for.
 *
 * @param parent - The `.feedbackcontainer` element.
 * @param data - The verdict, its message, its hint and where to go next.
 */
export function presentVerdictToast(parent: HTMLElement, data: VerdictToastData): void {
  const card = renderElement(verdictToastTemplate(data));
  requireElement(CLOSE_SELECTOR, card).addEventListener("click", () => {
    parent.replaceChildren();
    // Removing the button that was just pressed drops the focus to <body>,
    // which lands a keyboard player back at the top of the page -- the same
    // failure `App#startRun` guards against when it tears these regions down.
    // `.world` is the nearest box around the card that can take focus at all
    // (`index.html` gives it `tabindex="-1"` for this, which keeps it out of
    // the tab order), so that is where the keyboard goes instead. Absent in a
    // unit test's detached fragment, where there is no focus to rescue either.
    const refuge = parent.closest("[tabindex]");
    if (refuge instanceof HTMLElement) {
      refuge.focus();
    }
  });
  parent.replaceChildren(card);
}
