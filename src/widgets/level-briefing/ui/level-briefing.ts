/**
 * The Skyscraper block's briefing card: a level's name and one paragraph
 * explaining the lift-dispatch idea it introduces. Drawn only on the level
 * where an idea first appears; `SkyscraperLevel.card` is `undefined` elsewhere.
 * Shares `.tutorial`'s card surface with `widgets/tutorial-panel`, which
 * paints it, so the two widgets never draw at once.
 */

import { markup, raw, renderElement } from "#shared/ui/markup.ts";

/** Everything the card needs in order to draw itself. */
export interface LevelBriefingData {
  /** The level's name. Text, written escaped. */
  readonly title: string;
  /** What the level is about. Trusted catalog markup, written raw. */
  readonly briefing: string;
}

/**
 * Draws the briefing card for one Skyscraper level.
 *
 * `title` is text, escaped by {@link markup}. `briefing` is trusted catalog
 * HTML inserted raw via {@link raw}, since it carries `<code>`/`<em>` markup
 * around the terms it introduces. Uses `replaceChildren`, not `append`, so a
 * redraw (run start, language change) replaces rather than stacks, and clears
 * out whatever the tutorial card left behind.
 */
export function presentLevelBriefing(parent: HTMLElement, data: LevelBriefingData): void {
  parent.replaceChildren(
    renderElement(
      markup`<section class="briefingpanel" aria-label="${data.title}"><h2 class="briefingtitle">${data.title}</h2><p class="briefingtext">${raw(data.briefing)}</p></section>`,
    ),
  );
}
