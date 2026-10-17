/** The reference pages' stylesheet, which the game loads too, so nothing in it may reach past those pages. */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { renderDocsPage } from "../../../docs-page/render.ts";
import { ROOT } from "#shared/styles/test-helpers.ts";

/** Every selector in the file, comments and at-rule preludes aside. */
const selectors = readFileSync(join(ROOT, "src/pages/docs/ui/docs-page.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//gu, "")
  .split("{")
  .map((chunk) => chunk.split(/[;}]/u).at(-1)?.trim() ?? "")
  .filter((prelude) => prelude !== "" && !prelude.startsWith("@"))
  .flatMap((prelude) => prelude.split(",").map((selector) => selector.trim()));

describe("docs-page.css", () => {
  it("scopes every rule to the reference pages' body, leaving the game's help dialog alone", () => {
    expect(selectors.length).toBeGreaterThan(0);
    expect(selectors.filter((selector) => !selector.startsWith(".docs-page "))).toEqual([]);
  });

  it("is matched by the body the renderer writes", () => {
    expect(renderDocsPage("en")).toContain('<body class="docs-page">');
  });
});
