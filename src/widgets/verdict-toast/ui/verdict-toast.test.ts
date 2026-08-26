// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { spriteIconMarkup } from "#shared/ui/icon.ts";

import { presentVerdictToast, verdictToastTemplate } from "./verdict-toast.ts";
import type { VerdictToastData } from "./verdict-toast.ts";

/** Parses {@link verdictToastTemplate}'s output into a live element a test can query. */
function parse(html: string): HTMLElement {
  const parent = document.createElement("div");
  parent.innerHTML = html;
  const element = parent.firstElementChild;
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected an element");
  }
  return element;
}

/** The path an element's glyph draws, since `spriteIconMarkup` inlines shapes rather than referencing a symbol. */
function glyphOf(element: Element | null): string {
  const path = element?.querySelector("path")?.getAttribute("d");
  if (path === null || path === undefined) {
    throw new Error("expected a drawn glyph");
  }
  return path;
}

/** A won run with no tier, no hint and nowhere to go next, for tests to override. */
function baseData(overrides: Partial<VerdictToastData> = {}): VerdictToastData {
  return {
    won: true,
    title: "Success!",
    message: "Well done",
    hint: "",
    url: "",
    tier: undefined,
    ...overrides,
  };
}

/** A `.feedbackcontainer` standing in for `index.html`'s own live region. */
function container(): HTMLElement {
  const parent = document.createElement("div");
  parent.className = "feedbackcontainer";
  parent.setAttribute("role", "status");
  return parent;
}

describe("presentVerdictToast", () => {
  it("replaces any previous verdict", () => {
    const parent = container();
    presentVerdictToast(parent, baseData({ won: false, title: "Level failed" }));
    presentVerdictToast(parent, baseData({ url: "#level=4" }));

    expect(parent.children).toHaveLength(1);
    expect(parent.querySelector("h3")?.textContent).toBe("Success!");
    expect(parent.querySelector("a")?.getAttribute("href")).toBe("#level=4");
  });

  it("omits the next-level link when there is nowhere to go", () => {
    const parent = container();
    presentVerdictToast(parent, baseData({ won: false, title: "Level failed" }));
    expect(parent.querySelector("a")).toBeNull();
  });

  it("empties the container when the card is dismissed", () => {
    // Emptied, not hidden, so the next verdict is a change the live region announces.
    const parent = container();
    presentVerdictToast(parent, baseData());
    parent.querySelector<HTMLElement>(".verdict-close")?.click();
    expect(parent.innerHTML).toBe("");
  });

  it("hands the keyboard back to the region around the card", () => {
    // Removing the just-pressed button drops focus to <body>; the nearest
    // focusable ancestor is the refuge instead, at `tabIndex = -1` so it's
    // reachable programmatically but not by Tab.
    const world = document.createElement("div");
    world.tabIndex = -1;
    const parent = container();
    world.append(parent);
    document.body.append(world);
    try {
      presentVerdictToast(parent, baseData());
      const close = parent.querySelector<HTMLElement>(".verdict-close");
      close?.focus();
      close?.click();
      expect(document.activeElement).toBe(world);
    } finally {
      world.remove();
    }
  });

  it("survives a container with nowhere to put the focus", () => {
    // No refuge to find in a detached fragment; looking for one must not throw.
    const parent = container();
    presentVerdictToast(parent, baseData());
    expect(() => {
      parent.querySelector<HTMLElement>(".verdict-close")?.click();
    }).not.toThrow();
  });
});

describe("verdictToastTemplate", () => {
  it("draws the card for a win with nothing else to say", () => {
    const element = parse(verdictToastTemplate(baseData()));

    expect(element.className).toBe("verdict");
    expect(element.querySelector("h3")?.textContent).toBe("Success!");
    expect(element.querySelector("p")?.textContent).toBe("Well done");
    expect(element.querySelector(".stars")).toBeNull();
    expect(element.querySelector(".verdict-more")).toBeNull();
  });

  it("marks a win with a check and a loss with a cross", () => {
    // Both halves are asserted: the glyph and `.is-fail`'s color can drift independently.
    const won = parse(verdictToastTemplate(baseData()));
    expect(won.className).toBe("verdict");
    expect(glyphOf(won.querySelector(".verdict-mark"))).toBe(
      glyphOf(parse(`<span>${spriteIconMarkup("check")}</span>`)),
    );

    const lost = parse(verdictToastTemplate(baseData({ won: false, title: "Level failed" })));
    expect(lost.className).toBe("verdict is-fail");
    expect(glyphOf(lost.querySelector(".verdict-mark"))).toBe(
      glyphOf(parse(`<span>${spriteIconMarkup("x")}</span>`)),
    );
  });

  it("draws a tier badge inside the headline when a tier is given", () => {
    const element = parse(verdictToastTemplate(baseData({ tier: "gold" })));

    const stars = element.querySelector(".stars");
    expect(stars).not.toBeNull();
    expect(stars?.getAttribute("data-tier")).toBe("gold");
    expect(element.querySelector("h3")?.contains(stars)).toBe(true);
    const lit = [...(stars?.querySelectorAll(".ds-icon") ?? [])].map((star) =>
      star.classList.contains("is-on"),
    );
    expect(lit).toEqual([true, true, true]);
  });

  it("names the medal beside the badge, for the readers icons do not reach", () => {
    // The stars are `aria-hidden` sprite icons; without this a screen reader never learns the tier.
    const element = parse(verdictToastTemplate(baseData({ tier: "silver" })));

    const name = element.querySelector("h3 > .visually-hidden");
    expect(name?.textContent).toBe("Level stars: Silver");
  });

  it("draws no badge at all when there is no tier", () => {
    const html = verdictToastTemplate(baseData());
    expect(html).not.toContain("stars");
    expect(html).not.toContain("visually-hidden");
  });

  it("writes the hint as the trusted markup it is", () => {
    // Interpolated, not escaped, since the hint carries the game's own markup around figures.
    const element = parse(
      verdictToastTemplate(
        baseData({ hint: "For gold: <span class='emphasis-color'>21.0</span> seconds" }),
      ),
    );
    const more = element.querySelector(".verdict-more");
    expect(more?.querySelector(".emphasis-color")?.textContent).toBe("21.0");
    expect(more?.textContent).toBe("For gold: 21.0 seconds");
  });

  it("escapes the title and the message, which are not markup", () => {
    const element = parse(verdictToastTemplate(baseData({ title: "<b>x</b>", message: "a & b" })));
    expect(element.querySelector("h3")?.textContent).toBe("<b>x</b>");
    expect(element.querySelector("p")?.textContent).toBe("a & b");
  });

  it("offers a close button on every card, next link or no", () => {
    for (const url of ["", "#level=4"]) {
      const element = parse(verdictToastTemplate(baseData({ url })));
      const close = element.querySelector(".acts .verdict-close");
      expect(close?.getAttribute("type")).toBe("button");
      expect(close?.textContent).toBe("Got it");
    }
  });
});
