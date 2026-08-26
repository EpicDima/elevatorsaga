/**
 * Whether the settings popover can be reached at the smallest window the game
 * promises to fit. It reads as fine closed, but opening the seed block's
 * disclosure can push the source block below the window with no visible error.
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
    // Deliberately the same expression as `.taskmenu`'s, not a coincidental match, since both open under the same bar.
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
    // `hidden auto`, not `auto`: a lone `overflow-y` would hang a needless horizontal scrollbar on this column.
    expect(declaration(ruleBody(".setmenu"), "overflow", ".setmenu")).toBe("hidden auto");
  });
});
