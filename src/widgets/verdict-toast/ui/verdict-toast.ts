/**
 * The end-of-run verdict, `design/ui-mockup.html`'s own `.verdict` card and
 * its `showVerdict()`: a check or a cross in a circle, the title with the star
 * row beside it, the message, the "what is still missing" hint, and the two
 * things there are to do next.
 *
 * Mounted live from `App#showOutcome`/`App#showTutorialOutcome` since Phase
 * 12.2, replacing what was `../../../ui/presenters.ts`'s `presentFeedback`
 * and `../../../ui/templates.ts`'s `feedbackTemplate`, both since deleted.
 *
 * A card at the foot of the stage, not the full-bleed scrim the legacy
 * overlay drew: the mockup's own comment on the section is "итог прогона —
 * карточка, а не полноэкранный занавес", and the reason is that the building
 * underneath is the other half of the verdict. It is still drawn into
 * `.feedbackcontainer`, which is `index.html`'s permanent `role="status"` and
 * covers the same box the stage does — see that element's own comment, and
 * `.verdict`'s in `src/styles/style.css`.
 *
 * Everything this widget knows, it is told. The tier is caller-supplied and
 * already evaluated (by `evaluateChallengeTier`), the hint likewise (by
 * `#entities/challenge-tier`'s `nextTierHint`), and the three sentences are
 * whatever the caller composed — this widget never reaches into `#game` or a
 * `World` to work any of it out itself, the same division of labour
 * `#entities/challenge-tier/ui/tier-badge.ts` already keeps. That is what lets
 * `App#relocalise` redraw the same verdict in another language by calling its
 * caller again, with no state of its own to keep in step.
 *
 * Still not reproduced from the mockup: its richer stats line (transported
 * count, average wait, failure reason). `showVerdict` writes that into the
 * same `<p>` this draws {@link VerdictToastData.message} in, so it is a change
 * of what the caller composes rather than of anything here.
 */

import type { ChallengeTier } from "#entities/challenge-tier/index.ts";
import { tierBadgeMarkup } from "#entities/challenge-tier/index.ts";
import { t } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { iconMarkup, spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw, renderElement } from "#shared/ui/markup.ts";

/** What the end-of-run card says. */
export interface VerdictToastData {
  /**
   * Whether the run cleared its challenge. Drives the check/cross mark and
   * `.is-fail`, and is not inferable from {@link tier}: a task on the learning
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
  /** Link to the next challenge, or `""` for no link. */
  readonly url: string;
  /**
   * The tier earned, for a badge beside the title — `undefined` to draw no
   * badge at all (a loss, a tutorial task, or any run with no tier concept).
   */
  readonly tier: ChallengeTier | undefined;
}

/** The class the close button carries so {@link presentVerdictToast} can find it again. */
const CLOSE_SELECTOR = ".verdict-close";

/**
 * Markup for the end-of-run card.
 *
 * The next-run control stays an `<a>` while everything beside it is a
 * `<button>`, and the mockup's own `#verdictNext` is a button. It is a link
 * here because it is one: it changes the address, it is the thing a player
 * middle-clicks or copies, and `App` reads its `href` back out when it
 * relabels the learning track's version of it. `.btn.btn-primary` is what the
 * mockup paints that control, so the link wears it.
 *
 * @param data - The verdict, its message, its hint and where to go next.
 * @returns The card's markup.
 */
export function verdictToastTemplate(data: VerdictToastData): string {
  const mark = spriteIconMarkup(data.won ? "check" : "x");
  const stars = data.tier === undefined ? "" : tierBadgeMarkup(data.tier);
  // Absent rather than hidden when there is nothing to say, the way the star
  // badge already is: the mockup keeps one `#verdictMore` element and toggles
  // `hidden` on it because it draws its card once and patches it forever,
  // which is not how this one is drawn.
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
 * arriving in it is a change worth announcing. It promises nothing else — the
 * mockup's comment on `#verdictClose` is explicit that a second control
 * offering to restart the run would be one promise too many, "перезапуск —
 * это «Заново» в шапке", and the same button is in this app's bar.
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
    // (`index.html` puts it in the tab order so its scroll container is
    // reachable), so that is where the keyboard goes instead. Absent in a unit
    // test's detached fragment, where there is no focus to rescue either.
    const refuge = parent.closest("[tabindex]");
    if (refuge instanceof HTMLElement) {
      refuge.focus();
    }
  });
  parent.replaceChildren(card);
}
