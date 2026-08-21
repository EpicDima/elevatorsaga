/**
 * The two things the editor pane draws that the player's own text can break:
 * the mark under a failing line, and the banner quoting what failed.
 *
 * The eight syntax colors and the surfaces under them are the shared code
 * palette, measured in `shared/styles/code.css.test.ts`; the banner's own soft
 * badge is measured with the rest of that token family in
 * `shared/styles/tokens.css.test.ts`.
 */

import { describe, expect, it } from "vitest";

import { contrast, declaration, ruleBody, THEMES, themed } from "#shared/styles/test-helpers.ts";

describe("the failing line's own mark", () => {
  it.each(THEMES)(
    "keeps the error squiggle readable on the editor's background, %s theme",
    (_, palette) => {
      // `.cm-errorMark` (`src/ui/editor.ts`) underlines the failing text in
      // --ds-bad, on --ds-code-bg. A graphical indicator, so 1.4.11's 3:1 rather
      // than 1.4.3's 4.5 -- and it clears the stricter bar anyway, 5.74:1 dark
      // and 4.94:1 light, which is why the mark needs no size or weight of its
      // own to be found.
      expect(
        contrast(themed(palette, "ds-bad"), themed(palette, "ds-code-bg")),
      ).toBeGreaterThanOrEqual(3);
    },
  );
});

describe("the error banner", () => {
  it("wraps a failure that has nowhere to break", () => {
    // The quoted failure is the player's own text and can be one unbroken
    // token of any length -- a thrown 400-character string with no spaces in
    // it. Nothing between the <code> and the document clips: a banner without
    // this laid that string out 3010px wide inside a 463px pane and gave the
    // whole page a horizontal scrollbar, which on a frame that is otherwise
    // exactly the window is the one overflow that cannot be lived with.
    expect(
      declaration(ruleBody(".errorline .errormessage"), "overflow-wrap", ".errormessage"),
    ).toBe("anywhere");
  });
});
