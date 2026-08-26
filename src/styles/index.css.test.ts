/** index.css alone decides the cascade order; per-slice CSS is checked beside the slice that declares it. */

import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { IMPORTED, ROOT } from "#shared/styles/test-helpers.ts";

describe("the index", () => {
  it("imports every stylesheet in the source tree, exactly once each", () => {
    // Guards a stylesheet that got created but never imported: it costs nothing at build
    // time and simply never renders, reading as broken CSS rather than CSS never loaded.
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
