/**
 * Whether the level popover can be reached at the smallest window the game
 * promises to fit.
 *
 * The popover is as tall as its blocks of tiles make it, and nothing scrolls the
 * page to reach the rest of it -- `body.app` is `overflow: hidden`. Left
 * uncapped it is 729px, which at the 1040x600 floor `app/styles/document.css`
 * states ends 179px below the window: the last Skyscraper tile and the whole
 * "Other" block sit off screen, with no wheel, key or pointer that reaches them.
 *
 * None of that shows up as an error. The popover opens, every tile is in the
 * DOM, `level-switcher.test.ts` passes and a screenshot taken on a tall monitor
 * looks right; only a player on a short one cannot get to the last level. So
 * what is pinned here is the ceiling and the scroll, and that the ceiling is
 * still measured from the popover's own top edge rather than from the whole
 * viewport -- the one mistake that would look correct and be 50px wrong.
 */

import { describe, expect, it } from "vitest";

import { declaration, ruleBody, token } from "#shared/styles/test-helpers.ts";

/** The shortest window the game page promises to fit (`app/styles/document.css`). */
const FLOOR = 600;

/** The gap `.taskmenu`'s own `top` leaves between the trigger and the popover. */
const GAP = 8;

/** The air the ceiling leaves under the popover, for its shadow. */
const MARGIN = 16;

describe("the level popover's ceiling", () => {
  it("is measured from its own top edge, not from the whole viewport", () => {
    // Stated as one expression rather than a number so that the bar and the
    // controls in it can be resized without leaving this popover hanging off
    // the bottom of a short window. A ceiling in plain `vh` -- `82vh`, the
    // figure the API reference window uses -- would be the popover's own
    // 50px offset too tall, which is exactly the overhang being fixed.
    expect(declaration(ruleBody(".taskmenu"), "max-height", ".taskmenu")).toBe(
      `calc(100vh - (var(--ds-bar-h) + var(--ds-ctl-h)) / 2 - ${String(GAP)}px - ${String(MARGIN)}px)`,
    );
  });

  it("leaves the whole popover inside the shortest window the page allows", () => {
    // The same arithmetic the rule states, over the tokens it names: the
    // trigger is centered in the bar, so the popover opens half of each below
    // the top of the page, plus the gap. 50px today, and 534px of tiles left
    // under it at a 600px window -- the two figures the rule's own comment
    // quotes, kept honest here so that resizing the bar has to answer for them.
    const top = (Number.parseFloat(token("ds-bar-h")) + Number.parseFloat(token("ds-ctl-h"))) / 2;
    expect(top + GAP).toBe(50);
    expect(FLOOR - top - GAP - MARGIN).toBe(534);
  });

  it("scrolls what it cuts off, down the page only", () => {
    // `hidden auto` and not `auto`: an `overflow` stated on one axis leaves the
    // other computing to `auto` as well, and the tile grid is `1fr` columns
    // that merely narrow around a scrollbar -- so a lone `overflow-y` here
    // would hang a horizontal scrollbar on a menu that never overflows
    // sideways. Silence is worse than either: a ceiling with no scroll clips
    // the tiles off instead of moving them, which is the same unreachable
    // block by a shorter route.
    expect(declaration(ruleBody(".taskmenu"), "overflow", ".taskmenu")).toBe("hidden auto");
  });
});
