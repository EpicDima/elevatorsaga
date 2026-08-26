/** How `<kbd>` is drawn as a key cap, and where `.btn`'s hover breaks from the accent button whose shape it shares. */

import { describe, expect, it } from "vitest";

import {
  contrast,
  declaration,
  ruleBody,
  THEMES,
  themed,
  token,
} from "#shared/styles/test-helpers.ts";

describe("kbd", () => {
  it("draws a key cap instead of the browser default", () => {
    // Matched with a regex, not declaration()/token(): both are themed, and
    // token() would silently collapse to only the light theme's value.
    const body = ruleBody("kbd");
    expect(declaration(body, "border-radius", "kbd")).toBe("4px");
    expect(body).toMatch(/^\s*color:\s*var\(--ds-text\);/m);
    expect(body).toMatch(/^\s*background-color:\s*var\(--ds-raised\);/m);
    expect(body).toMatch(/^\s*font-weight:\s*bold;/m);
  });
});

describe(".btn", () => {
  it("brightens .docsclose/.keysclose's border to the neutral --ds-n-5 on hover, not the accent", () => {
    // .btn shares its resting shape with .task-open but diverges on hover
    // color, since .task-open draws the eye toward the accent while .btn
    // merely closes a dialog. Guards the two against drifting onto one token.
    const selector = ".btn:hover:not(:disabled)";
    expect(declaration(ruleBody(selector), "border-color", selector)).toBe(token("ds-n-5"));
  });
});

describe(".btn-primary", () => {
  it("wears the accent as an outline, leaving the label on .btn's own surface", () => {
    const body = ruleBody(".btn-primary");
    expect(declaration(body, "border-color", ".btn-primary")).toBe(token("ds-accent"));
    expect(declaration(body, "color", ".btn-primary")).toBe(token("ds-accent-hi"));
    // A `background` here would put the fill back and make the two checks below measure the wrong surface.
    expect(body).not.toMatch(/^\s*background:/m);
  });

  it("moves the fill to hover, and only where the button can be pressed", () => {
    const selector = ".btn-primary:hover:not(:disabled)";
    const body = ruleBody(selector);
    expect(declaration(body, "background", selector)).toBe(token("ds-accent"));
    expect(declaration(body, "color", selector)).toBe(token("ds-accent-ink"));
  });

  it.each(THEMES)("keeps the resting label readable on that surface, %s theme", (_, palette) => {
    expect(
      contrast(themed(palette, "ds-accent-hi"), themed(palette, "ds-raised")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)("keeps the label readable once hover fills it, %s theme", (_, palette) => {
    expect(
      contrast(themed(palette, "ds-accent-ink"), themed(palette, "ds-accent")),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
