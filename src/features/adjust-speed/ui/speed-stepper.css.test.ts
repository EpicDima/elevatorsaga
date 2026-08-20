/**
 * The speed group stands in the app bar beside the run buttons, and it is the
 * one control there that paints a background of its own — so both its height
 * and its two inks answer to a surface nothing else in the bar uses.
 */

import { describe, expect, it } from "vitest";

import {
  contrast,
  declaration,
  ruleBody,
  THEMES,
  themed,
  token,
} from "#shared/styles/test-helpers.ts";

describe("the speed stepper", () => {
  it("stands the speed group level with the buttons beside it", () => {
    // 28px of button plus 1px of padding and 1px of border on each side is
    // --ds-ctl-h exactly, which is the height .appbar > * gives everything
    // else in the row. Asserted as the arithmetic rather than as 32px,
    // because what would break this is one of the three moving.
    const group = ruleBody(".speed");
    const button = ruleBody(".speed button");
    const height = Number.parseFloat(declaration(button, "height", ".speed button"));
    const padding = Number.parseFloat(declaration(group, "padding", ".speed"));
    const border = Number.parseFloat(declaration(group, "border", ".speed"));
    expect(height + 2 * padding + 2 * border).toBe(Number.parseFloat(token("ds-ctl-h")));
  });

  it.each(THEMES)(
    "holds the speed reading and its arrows readable against the group's own background, %s theme",
    (_, palette) => {
      // .speed paints --ds-bg rather than the page's --ds-panel, so neither
      // pairing is one the sitewide page-background table in
      // `shared/styles/tokens.css.test.ts` covers. The
      // reading is text (1.4.3, 4.5:1); a resting arrow is a graphical control
      // (1.4.11, 3:1), and hovering brightens it to the reading's own colour.
      expect(contrast(themed(palette, "ds-text"), themed(palette, "ds-bg"))).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        contrast(themed(palette, "ds-text-muted"), themed(palette, "ds-bg")),
      ).toBeGreaterThanOrEqual(3);
    },
  );
});
