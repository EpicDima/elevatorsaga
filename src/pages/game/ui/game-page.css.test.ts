/**
 * The demo route hides the page a link at a time, and each link is a selector
 * that has to name the box the one above it actually has. Nothing in the built
 * page fails a check when one of them stops matching — the demo is a route flag
 * with no assertion of its own — so the chain is pinned here.
 */

import { describe, expect, it } from "vitest";

import { styleSource } from "#shared/styles/test-helpers.ts";

describe("the fullscreen demo", () => {
  it("hides everything beside the building, starting at the body's own children", () => {
    // `#fullscreen` hides the page a link at a time -- body, main, workspace,
    // pane -- and each link is a selector that has to name the box the one
    // above it actually has. The first link is the one that has already been
    // wrong once: it read `.container > *:not(main)` while the game page still
    // wrapped its contents in one, and unwrapping that wrapper left it
    // matching nothing at all, so the app bar and the skip link stayed on
    // screen through a mode whose whole purpose is that they do not.
    const chain = /\.fullscreen-demo body > \*:not\(main\),\s*\.fullscreen-demo main > \*/;
    expect(styleSource).toMatch(chain);
    // The last two links are the same hazard one box deeper. `.world` is a
    // child of `.stagearea` now, so a chain that stopped at
    // `.pane-game > *:not(.world)` would match the box the building is inside
    // and hide the building with it -- the demo showing an empty pane, again
    // with nothing in the built page to fail.
    expect(styleSource).toMatch(
      /\.fullscreen-demo \.pane-game > \*:not\(\.stagearea\),\s*\.fullscreen-demo \.stagearea > \*:not\(\.world\)/,
    );
    // And the wrapper is not named anywhere in the demo's rules any more. A
    // leftover `.fullscreen-demo .container` would be dead rather than wrong,
    // but dead in a way that reads as though the mode still covers a box the
    // game page has not had since the app bar landed.
    expect(styleSource).not.toMatch(/\.fullscreen-demo[^,{]*\.container/);
  });
});
