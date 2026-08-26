/**
 * Pins the fullscreen demo's selector chain: nothing in the built page fails when a link
 * stops matching, since the demo is a route flag with no assertion of its own.
 */

import { describe, expect, it } from "vitest";

import { styleSource } from "#shared/styles/test-helpers.ts";

describe("the fullscreen demo", () => {
  it("hides everything beside the building, starting at the body's own children", () => {
    const chain = /\.fullscreen-demo body > \*:not\(main\),\s*\.fullscreen-demo main > \*/;
    expect(styleSource).toMatch(chain);
    // Same hazard one box deeper: a chain that stopped at `.pane-game > *:not(.world)` would
    // hide the building along with the pane, since `.world` sits inside `.stagearea` now.
    expect(styleSource).toMatch(
      /\.fullscreen-demo \.pane-game > \*:not\(\.stagearea\),\s*\.fullscreen-demo \.stagearea > \*:not\(\.world\)/,
    );
    // A leftover `.fullscreen-demo .container` selector would be dead, but would misleadingly
    // suggest the demo still covers a wrapper the game page no longer has.
    expect(styleSource).not.toMatch(/\.fullscreen-demo[^,{]*\.container/);
  });

  it("takes the lesson card out of the flow rather than merely hiding it", () => {
    // Everything else keeps its box so the building lands where it does in
    // play. The card can't: `.world` is a screenful, so the card's own height
    // would push the building's foot below the demo's bottom edge.
    expect(styleSource).toMatch(
      /\.fullscreen-demo \.stagearea > \.tutorial \{\n {2}display: none;\n\}/,
    );
  });
});
