/** How `<kbd>` is drawn as a key cap, and where `.btn`'s hover breaks from the accent button whose shape it shares. */

import { describe, expect, it } from "vitest";

import { declaration, ruleBody, token } from "#shared/styles/test-helpers.ts";

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
    expect(declaration(ruleBody(".btn:hover"), "border-color", ".btn:hover")).toBe(token("ds-n-5"));
  });
});
