/**
 * Whether the level popover can be reached at the smallest window the game
 * promises to fit, and whether its tiles still stand eight to a row. Left
 * uncapped, the popover overhangs a short window with no error and no failing
 * test elsewhere, so its height ceiling, scroll behavior, and the width its
 * column count depends on are pinned here directly.
 */

import { describe, expect, it } from "vitest";

import { LEVEL_TIERS } from "#game/level-tiers.ts";
import { declaration, ruleBody, token } from "#shared/styles/test-helpers.ts";

/** The shortest window the game page promises to fit (`app/styles/document.css`). */
const FLOOR = 600;

/** The gap `.taskmenu`'s own `top` leaves between the trigger and the popover. */
const GAP = 8;

/** The air the ceiling leaves under the popover, for its shadow. */
const MARGIN = 16;

/** Tiles a row, which `.taskmenu`'s width is cut to hold. */
const COLUMNS = 8;

/** Reads a rule's declaration as a number of pixels. */
function pixels(selector: string, property: string): number {
  return Number.parseFloat(declaration(ruleBody(selector), property, selector));
}

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

describe("the tint a cleared tile is drawn in", () => {
  it("is mixed from a value only a `data-tier` defines", () => {
    // `.tasklink.is-done` passes no fallback, so a tile marked done without a
    // `data-tier` mixes an undefined property and loses both declarations. The
    // markup keeps the two together; these rules are what that rests on.
    for (const tier of LEVEL_TIERS) {
      const selector = `.tasklink[data-tier="${tier}"]`;
      expect(declaration(ruleBody(selector), "--tier-tint", selector)).toBe(
        token(`ds-tier-${tier}`),
      );
    }
    const done = ruleBody(".tasklink.is-done");
    expect(declaration(done, "border-color", ".tasklink.is-done")).toContain("var(--tier-tint)");
    expect(declaration(done, "background", ".tasklink.is-done")).toContain("var(--tier-tint)");
  });
});

describe("the level popover's tile grid", () => {
  it("stands its tiles eight to a row", () => {
    expect(declaration(ruleBody(".taskmenu-grid"), "grid-template-columns", ".taskmenu-grid")).toBe(
      `repeat(${String(COLUMNS)}, 1fr)`,
    );
  });

  it("is as wide as those eight tiles, near enough square, need", () => {
    // `1fr` columns absorb any width, so nothing else would catch a popover
    // cut too narrow: the tiles would just squeeze into slots.
    const gaps = (COLUMNS - 1) * pixels(".taskmenu-grid", "gap");
    const tile =
      (pixels(".taskmenu", "width") - 2 * pixels(".taskmenu", "padding") - gaps) / COLUMNS;
    const height = pixels(".tasklink", "height");
    expect(tile).toBeGreaterThan(height);
    expect(tile - height).toBeLessThan(4);
  });
});
