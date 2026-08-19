/**
 * The end-of-run overlay, `design/ui-mockup.html`'s `showVerdict()` (its
 * `#verdict` panel: a title with a star row beside it, a message and a link
 * to whatever comes next).
 *
 * Mounted live from `App#showOutcome`/`App#showTutorialOutcome` since Phase
 * 12.2, replacing `../../../ui/presenters.ts`'s `presentFeedback` and
 * `../../../ui/templates.ts`'s `feedbackTemplate`, both since deleted.
 * `verdictToastTemplate` reproduced their markup byte-for-byte for {@link
 * VerdictToastData.tier | tier: undefined}, so every existing caller's shape
 * kept working unchanged across the cutover; the one new capability is an
 * additive star badge, rendered beside the title, for callers that pass a
 * `tier`.
 *
 * `tier` is caller-supplied, already-evaluated (e.g. by
 * `evaluateChallengeTier`) — this widget never reaches into `#game` or a
 * `World` to work one out itself, the same division of labour
 * `#entities/challenge-tier/ui/tier-badge.ts` already keeps.
 *
 * Deliberately left for a later phase, not reproduced here: the mockup's
 * check/x verdict icon, its `.verdict-more` "what's missing for the next
 * tier" hint paragraph (which needs `#widgets/goal-bar/ui/goal-bar.ts`'s
 * currently module-private `REQ_TEXT`/`TIER_NOW` formatting tables exported
 * or relocated first — an open design decision, not this widget's job), and
 * its richer stats line (transported count, average wait, failure reason).
 * The title and message text stay exactly whatever the caller already
 * composes today.
 */

import type { ChallengeTier } from "#entities/challenge-tier/index.ts";
import { tierBadgeMarkup } from "#entities/challenge-tier/index.ts";
import { t } from "#i18n/index.ts";
import { iconMarkup } from "#shared/ui/icon.ts";

import { markup, raw, renderElement } from "../../../ui/templates.ts";

/** What the end-of-run overlay says. */
export interface VerdictToastData {
  /** Headline, e.g. `"Success!"`. */
  readonly title: string;
  /** Explanatory line under the headline. */
  readonly message: string;
  /** Link to the next challenge, or `""` for no link. */
  readonly url: string;
  /**
   * The tier earned, for a badge beside the title — `undefined` to draw no
   * badge at all (a loss, a tutorial task, or any run with no tier concept).
   */
  readonly tier: ChallengeTier | undefined;
}

/**
 * Markup for the end-of-run overlay.
 *
 * @param data - Headline, message, next-run link and the earned tier, if any.
 * @returns The overlay markup.
 */
export function verdictToastTemplate(data: VerdictToastData): string {
  const link =
    data.url === ""
      ? ""
      : markup`<a href="${data.url}" class="emphasis-color">${t("game.feedback.next")} ${raw(iconMarkup("caret-right", "blink"))}</a>`;
  const stars = data.tier === undefined ? "" : tierBadgeMarkup(data.tier);
  return markup`<div class="feedback"><h2 class="emphasis-color">${data.title}${raw(stars)}</h2><p class="emphasis-color">${data.message}</p>${raw(link)}</div>`;
}

/**
 * Draws the overlay shown when a run ends.
 *
 * @param parent - The `.feedbackcontainer` element.
 * @param data - Headline, message, next-run link and the earned tier, if any.
 */
export function presentVerdictToast(parent: HTMLElement, data: VerdictToastData): void {
  parent.replaceChildren(renderElement(verdictToastTemplate(data)));
}
