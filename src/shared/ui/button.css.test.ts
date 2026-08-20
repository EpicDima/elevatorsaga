/**
 * The shared control chrome: what a `<kbd>` is drawn as, and where `.btn`'s
 * hover parts company with the accent button it shares its resting shape with.
 */

import { describe, expect, it } from "vitest";

import { declaration, ruleBody, token } from "#shared/styles/test-helpers.ts";

describe("kbd", () => {
  it("draws a key cap instead of the browser default", () => {
    // <kbd> ships with no border, background or radius of its own -- only a
    // monospace font, which the rule above already sets. Reusing the shared
    // control chrome's own tokens means a key reads as the same kind of
    // control-shaped mark .btn and .task-open draw, rather than a colour
    // nothing would have a test for. The pair is --ds-text
    // on --ds-raised, which the shared control-surface case in
    // `shared/styles/tokens.css.test.ts` already holds to 4.5:1 -- not read
    // through declaration()/token() here, since both are themed and token()
    // would silently collapse to the light theme's value only.
    const body = ruleBody("kbd");
    expect(declaration(body, "border-radius", "kbd")).toBe("4px");
    expect(body).toMatch(/^\s*color:\s*var\(--ds-text\);/m);
    expect(body).toMatch(/^\s*background-color:\s*var\(--ds-raised\);/m);
    expect(body).toMatch(/^\s*font-weight:\s*bold;/m);
  });
});

describe(".btn", () => {
  it("brightens .docsclose/.keysclose's border to the neutral --ds-n-5 on hover, not the accent", () => {
    // .btn shares its resting shape with .task-open (button.css's own comment
    // says so), but not its hover colour: .task-open opens the level switcher
    // and brightens to the themed accent to draw the eye; .btn only ever
    // closes a dialog the player already opened, and design/ui-mockup.html's
    // own .btn:hover reaches for the neutral --n-5 instead. Regression guard
    // for the two reading the same token by coincidence of an early port.
    expect(declaration(ruleBody(".btn:hover"), "border-color", ".btn:hover")).toBe(token("ds-n-5"));
  });
});
