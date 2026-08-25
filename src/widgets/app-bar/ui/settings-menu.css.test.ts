/**
 * Whether the settings popover can be reached at the smallest window the game
 * promises to fit.
 *
 * Closed, this popover is 528px and clears the 1040x600 floor
 * `app/styles/document.css` states by 22px, which is why it reads as fine in a
 * screenshot. Opening the seed block's disclosure -- one click, on a `<summary>`
 * that invites it -- grows it to 673px in English and 708px in Russian, ending
 * 123px and 158px below the window. `body.app` is `overflow: hidden`, so the
 * About block underneath, its license notice and both source links, cannot be
 * scrolled to.
 *
 * The 22px of headroom is what makes this worth pinning: the popover is one
 * translated string or one added row away from overflowing while closed, and
 * nothing about that would be visible to whoever added the row.
 */

import { describe, expect, it } from "vitest";

import { declaration, ruleBody, token } from "#shared/styles/test-helpers.ts";

/** The shortest window the game page promises to fit (`app/styles/document.css`). */
const FLOOR = 600;

/** The gap `.setmenu`'s own `top` leaves between the button and the popover. */
const GAP = 8;

/** The air the ceiling leaves under the popover, for its shadow. */
const MARGIN = 16;

describe("the settings popover's ceiling", () => {
  it("is the one the level popover carries, measured the same way", () => {
    // Deliberately the same expression as `.taskmenu`'s, not a number of its
    // own: both open under the same bar, at the same offset, and a popover that
    // agreed with the other only by coincidence would drift the first time one
    // of them was touched.
    expect(declaration(ruleBody(".setmenu"), "max-height", ".setmenu")).toBe(
      `calc(100vh - (var(--ds-bar-h) + var(--ds-ctl-h)) / 2 - ${String(GAP)}px - ${String(MARGIN)}px)`,
    );
  });

  it("leaves the whole popover inside the shortest window the page allows", () => {
    const top = (Number.parseFloat(token("ds-bar-h")) + Number.parseFloat(token("ds-ctl-h"))) / 2;
    expect(top + GAP).toBe(50);
    expect(FLOOR - top - GAP - MARGIN).toBe(534);
  });

  it("scrolls what it cuts off, down the page only", () => {
    // `hidden auto` for the reason `level-switcher.css.test.ts` gives: an
    // `overflow` on one axis leaves the other computing to `auto` too, and this
    // column never overflows sideways.
    expect(declaration(ruleBody(".setmenu"), "overflow", ".setmenu")).toBe("hidden auto");
  });
});
