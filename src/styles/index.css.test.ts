/**
 * The one thing that can be said about `index.css` and about no other
 * stylesheet: it is the whole of the cascade order, so it is the whole of what
 * decides which of two competing rules wins.
 *
 * Everything else the stylesheet is checked for lives beside the slice that
 * declares it, as `<slice>.css.test.ts`, and reads the assembled text through
 * `#shared/styles/test-helpers.ts`.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { IMPORTED, ROOT } from "#shared/styles/test-helpers.ts";

describe("the index", () => {
  it("imports every stylesheet in the source tree, exactly once each", () => {
    // The cascade is stated in one place, and a slice's stylesheet only reaches
    // a browser because the index names it. A new file that nobody wired up is
    // the failure this guards: it costs nothing at build time, breaks no test
    // of its own, and simply is not there on screen -- which reads as a widget
    // whose CSS "did not work" rather than as CSS that was never loaded.
    const found: string[] = [];
    const walk = (directory: string): void => {
      for (const entry of readdirSync(join(ROOT, directory), { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith(".css") && path !== join("src", "styles", "index.css")) {
          found.push(path);
        }
      }
    };
    walk("src");
    expect([...IMPORTED].sort()).toEqual(found.sort());
    expect(new Set(IMPORTED).size, "an @import is repeated").toBe(IMPORTED.length);
  });

  it("puts the tokens first, because a rule cannot read a property not yet declared", () => {
    expect(IMPORTED[0]).toBe(join("src", "shared", "styles", "tokens.css"));
  });
});
