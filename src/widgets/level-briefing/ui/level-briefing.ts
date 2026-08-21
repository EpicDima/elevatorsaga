/**
 * The Skyscraper block's briefing card: a level's name, and one paragraph
 * saying what idea the level is built on.
 *
 * Those levels are each built on a real lift-dispatch idea -- traffic profiles,
 * zoning, destination dispatch -- that the numbered levels 1 to 19 know nothing
 * about, so a player meeting one of those ideas for the first time needs a
 * sentence about it before the goal bar's "deliver 20 people in 60 seconds"
 * means anything. That sentence is the whole of this widget.
 *
 * Drawn on the level where an idea is introduced and on no other, which is why
 * `SkyscraperLevel.card` is optional and most levels answer `undefined`: the
 * levels that follow are the idea being asked for rather than explained again,
 * and this card is the widest column on the screen to spend on saying so twice.
 * The page simply does not call this function for them, and the region it would
 * have drawn into stays empty and hidden, so the building takes the width.
 *
 * It is not the learning track's lesson card, and the difference is machinery
 * rather than size. `widgets/tutorial-panel` carries three disclosures a player
 * opens and closes, a syntax-highlighted answer, a button that copies it and a
 * live region reporting what that button did; it therefore has to read state
 * back off the markup it is about to destroy and put it back afterwards. This
 * card has a heading and a paragraph. Nothing in it can be open or closed,
 * nothing in it can hold the focus, and so a redraw is a plain replacement with
 * nothing to carry across -- see {@link presentLevelBriefing}. The shortness of
 * this file is that fact, not an unfinished version of the other one.
 *
 * The two share a surface without sharing anything else. Both are drawn into
 * `index.html`'s `<div class="tutorial">`, which `src/main.ts` moves into the
 * stage area, and exactly one of them is ever on screen: the game page empties
 * that element and calls whichever presenter the level in front of the player
 * needs. The card a reader sees -- the padding, the hairline, the large radius
 * and `--ds-panel` behind it -- is painted on that shared element by
 * `tutorial-panel.css` rather than by either widget, so a briefing and a lesson
 * cannot drift into looking like two different games. `level-briefing.css` says
 * so at greater length, because it is the file where the absence of those
 * declarations would otherwise look like an omission.
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
 * Takes the two strings rather than a level id, which is the one decision the
 * rest of this file follows from, and it is deliberately the opposite of the
 * choice `presentTutorial` makes. That function takes a `levelIndex` and looks
 * the level's prose up in a table it owns, which is right for it: the learning
 * track is eight fixed lessons whose text exists nowhere else, and the table is
 * where it lives. A Skyscraper level's title and briefing are already on the
 * level itself, as getters that ask the catalog at the moment they are read --
 * the same shape `src/game/levels.ts` gives every level's `description` -- so a
 * lookup table here would be a second home for prose that already has one, and
 * the two would be free to disagree about a level that had been renamed.
 *
 * Being handed finished strings would normally cost this card its language:
 * changing language redraws the page by calling every region's presenter again,
 * and a card holding sentences it was given in English would be the one column
 * still in English afterwards. It does not, and the getters are why -- the
 * caller reads `level.title` and `level.briefing` on the way in, so the strings
 * are composed in the language being drawn, at the moment of drawing, exactly as
 * they would be if this function looked them up itself.
 *
 * The two are written differently and the difference is load-bearing.
 * {@link LevelBriefingData.title} is text and is escaped by {@link markup}; a
 * level called `<script>` is a heading that says `<script>`. The briefing is a
 * `.html` message of this repository's own catalog and is inserted verbatim
 * through {@link raw}, because it carries `<code>`, `<em>` and
 * `<span class="emphasis-color">` around the terms it introduces, and escaping
 * it would print the tags at the player. Nothing a player typed reaches either
 * field: the editor's contents never come near this widget, and both strings
 * come off the level table.
 *
 * Drawn as a `<section>` with a name, which is what makes it a region landmark,
 * and with an `<h2>` inside it, for the reasons `presentTutorial` sets out about
 * the card that shares this element: a block of prose standing beside the
 * building needs to be something a screen-reader player can jump over to reach
 * the game, and a `<section>` with no name is not a landmark at all. The name is
 * the level's own title, which is also the heading immediately inside it, so the
 * words announced on the way in are the words on the screen. `<h2>` and not
 * `<h1>` because the page's `<h1>` is the game's, and the two cards that mount
 * here must not disagree about the outline of a document neither of them owns.
 *
 * `parent.replaceChildren(...)` rather than `parent.append(...)`, which is the
 * same call `presentTutorial` ends on and for the same reason: this is safe to
 * call over a card that is already there, and that is the only way it is ever
 * called after the first time -- the page redraws it at the start of every run
 * and again whenever the language changes. Appending would leave the previous
 * briefing above the new one and stack a fresh copy on every redraw. Replacing
 * also empties the element of whatever the other presenter drew into it, so a
 * player moving from a lesson to a Skyscraper level does not keep the lesson.
 *
 * @param parent - The `.tutorial` element of the page shell.
 * @param data - The level's name, and what it is about.
 */
export function presentLevelBriefing(parent: HTMLElement, data: LevelBriefingData): void {
  parent.replaceChildren(
    renderElement(
      markup`<section class="briefingpanel" aria-label="${data.title}"><h2 class="briefingtitle">${data.title}</h2><p class="briefingtext">${raw(data.briefing)}</p></section>`,
    ),
  );
}
