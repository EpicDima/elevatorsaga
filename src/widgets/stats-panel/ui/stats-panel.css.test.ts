/**
 * The strip's own wiring, which fails silently rather than loudly: an
 * `@container` naming a container nobody opens does not error, it simply never
 * matches, and the wide layouts above it are then the only ones a narrow pane
 * ever gets.
 *
 * Whether a browser then draws the strip whole is `e2e/statistics-panel.spec.ts`.
 */

import { describe, expect, it } from "vitest";

import { declaration, ruleBody, styleSource } from "#shared/styles/test-helpers.ts";

describe("statistics strip", () => {
  it("measures the tile grids against the pane rather than the window", () => {
    // The figures are as wide as the game pane, and the splitter can take two
    // thirds of that away without the window changing by a pixel -- so the
    // two-column fallback the grids drop to has to be asked of the strip
    // itself. A `@media` query in its place would collapse the strip only
    // when the whole window narrowed, which on this page is the one thing
    // that cannot happen: `body.app` floors it at 1040px.
    expect(declaration(ruleBody(".statscontainer"), "container", ".statscontainer")).toBe(
      "panel / inline-size",
    );
    // Same name in the query as in the container, which is the whole of the
    // wiring: an `@container` naming something no ancestor opens does not
    // fail, it silently never matches, and the four- and three-column layouts
    // above it would then be the only ones a narrow pane ever got.
    expect(styleSource).toMatch(/^@container panel \(max-width: 520px\) \{$/m);
  });
});
