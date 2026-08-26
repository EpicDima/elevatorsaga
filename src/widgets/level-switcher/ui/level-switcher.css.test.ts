/**
 * Whether the level popover can be reached at the smallest window the game
 * promises to fit. Left uncapped, the popover overhangs a short window with
 * no error and no failing test elsewhere, so its height ceiling and scroll
 * behavior are pinned here directly.
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
    // Stated as an expression, not a plain `vh` figure, so resizing the bar
    // can't silently reopen the overhang this fixes.
    expect(declaration(ruleBody(".taskmenu"), "max-height", ".taskmenu")).toBe(
      `calc(100vh - (var(--ds-bar-h) + var(--ds-ctl-h)) / 2 - ${String(GAP)}px - ${String(MARGIN)}px)`,
    );
  });

  it("leaves the whole popover inside the shortest window the page allows", () => {
    // The same arithmetic as the rule, over live tokens, so resizing the bar has to answer for these figures too.
    const top = (Number.parseFloat(token("ds-bar-h")) + Number.parseFloat(token("ds-ctl-h"))) / 2;
    expect(top + GAP).toBe(50);
    expect(FLOOR - top - GAP - MARGIN).toBe(534);
  });

  it("scrolls what it cuts off, down the page only", () => {
    // `hidden auto`, not `auto`: a lone `overflow-y` would hang a needless
    // horizontal scrollbar on a grid that only narrows around one.
    expect(declaration(ruleBody(".taskmenu"), "overflow", ".taskmenu")).toBe("hidden auto");
  });
});
