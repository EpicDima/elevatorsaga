/**
 * The learning track's panel, and the three surfaces stacked inside it.
 */

import { describe, expect, it } from "vitest";

import { contrast, THEMES, themed } from "#shared/styles/test-helpers.ts";

describe("ds palette on the lesson card", () => {
  // The panel is drawn on --ds-panel, with three surfaces
  // inside it: the card itself, the --ds-raised box of an open hint, and the
  // --ds-n-3 fill of the button that copies the answer. Every pair below was
  // measured with `getComputedStyle` in Chromium before it was written down --
  // the figures are in the rules' own comments -- and this is what
  // keeps a later change to a token from quietly taking one of them under the
  // bar. Listed as pairs rather than as rules because what fails here is
  // arithmetic, and arithmetic is what a test without a browser can do.
  it.each([
    // The panel's own ink, and the muted one the goal line under the title is
    // written in: 14.04:1 and 6.70:1 dark, 15.99:1 and 5.90:1 light. The
    // mockup's --text-faint was measured on the same surface and refused at
    // 3.62:1 dark / 3.14:1 light.
    ["ds-text", "ds-panel", 4.5],
    ["ds-text-muted", "ds-panel", 4.5],
    // The same muted ink one surface up, on the --ds-raised of a hint box: its
    // summary's marker, the prose the summary opens onto, and the receipt beside
    // the copy button all sit there, and none of them on the card. 6.19:1 dark,
    // 5.56:1 light. (--ds-text on --ds-raised is the shared control pairing,
    // measured in `shared/styles/tokens.css.test.ts`.)
    ["ds-text-muted", "ds-raised", 4.5],
    // The copy button's label on the button's own fill: 11.54:1 dark, 13.43:1
    // light. It carries the whole of that control -- the 1px --ds-line-strong
    // ring around it is 1.38:1 dark and 1.49:1 light against the hint, nowhere
    // near 1.4.11's 3:1, so a label that stopped clearing 1.4.3 would leave a
    // button with nothing left to find it by.
    ["ds-text", "ds-n-3", 4.5],
    // The 3px rule down the start edge of a line the player has to write,
    // inside the answer -- the one thing this panel paints on the code
    // background rather than on its own card, so a pairing neither the card
    // above nor `shared/styles/code.css.test.ts` covers: 8.25:1 dark, 4.33:1
    // light. A graphical indicator, so 1.4.11's 3:1; `.tutoriallinechanged`'s
    // own comment says the same numbers, and this is what holds them.
    ["ds-accent", "ds-code-bg", 3],
  ])("has --%s readable on --%s in both themes", (foreground, background, required) => {
    for (const [, palette] of THEMES) {
      expect(
        contrast(themed(palette, foreground), themed(palette, background)),
      ).toBeGreaterThanOrEqual(required);
    }
  });
});
