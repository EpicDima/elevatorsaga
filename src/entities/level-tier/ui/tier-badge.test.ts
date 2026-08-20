// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { tierBadgeMarkup } from "./tier-badge.ts";

/** Parses {@link tierBadgeMarkup}'s output into a live `.stars` element a test can query. */
function parse(html: string): HTMLElement {
  const parent = document.createElement("div");
  parent.innerHTML = html;
  const stars = parent.querySelector(".stars");
  if (stars === null) {
    throw new Error("expected a .stars element");
  }
  return stars as HTMLElement;
}

describe("tierBadgeMarkup", () => {
  it("lights no stars and falls back to the bronze tint for no tier earned", () => {
    const stars = parse(tierBadgeMarkup(undefined));
    expect(stars.getAttribute("data-tier")).toBe("bronze");
    const lit = [...stars.querySelectorAll(".ds-icon")].map((star) =>
      star.classList.contains("is-on"),
    );
    expect(lit).toEqual([false, false, false]);
  });

  it("lights one star for bronze", () => {
    const stars = parse(tierBadgeMarkup("bronze"));
    expect(stars.getAttribute("data-tier")).toBe("bronze");
    const lit = [...stars.querySelectorAll(".ds-icon")].map((star) =>
      star.classList.contains("is-on"),
    );
    expect(lit).toEqual([true, false, false]);
  });

  it("lights two stars for silver", () => {
    const stars = parse(tierBadgeMarkup("silver"));
    expect(stars.getAttribute("data-tier")).toBe("silver");
    const lit = [...stars.querySelectorAll(".ds-icon")].map((star) =>
      star.classList.contains("is-on"),
    );
    expect(lit).toEqual([true, true, false]);
  });

  it("lights all three stars for gold", () => {
    const stars = parse(tierBadgeMarkup("gold"));
    expect(stars.getAttribute("data-tier")).toBe("gold");
    const lit = [...stars.querySelectorAll(".ds-icon")].map((star) =>
      star.classList.contains("is-on"),
    );
    expect(lit).toEqual([true, true, true]);
  });

  it("draws every star from the sprite icon, not the legacy font icon", () => {
    const stars = parse(tierBadgeMarkup("gold"));
    for (const star of stars.querySelectorAll(".ds-icon")) {
      expect(star.classList.contains("star")).toBe(true);
      expect(star.getAttribute("viewBox")).toBe("0 0 16 16");
    }
  });
});
