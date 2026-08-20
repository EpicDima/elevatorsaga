// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { seedPanelTemplate } from "./seed-panel.ts";
import type { SeedLinkData } from "../../../ui/templates.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { renderElement } from "#shared/ui/markup.ts";

describe("seedPanelTemplate", () => {
  /**
   * A sprite as the document serialises it.
   *
   * `spriteIconMarkup` writes XML-style self-closing tags (`<rect …/>`), which
   * the HTML parser reads as open tags and writes back out with a close tag of
   * their own. Comparing the rendered link against the rendered sprite rather
   * than against the string keeps the two on the same side of that.
   *
   * @param name - The sprite to draw.
   * @returns Its markup, round-tripped through the document.
   */
  function iconHtml(name: "copy" | "dice"): string {
    const host = document.createElement("div");
    host.innerHTML = spriteIconMarkup(name);
    return host.innerHTML;
  }

  /** A run nobody pinned, and the URL that starts another run from its seed. */
  const SEED: SeedLinkData = {
    seed: "1234567890",
    url: "#challenge=1,seed=1234567890",
    newDrawUrl: null,
  };

  /** The same run once its seed is pinned, and the URL that unpins it. */
  const PINNED_SEED: SeedLinkData = { ...SEED, newDrawUrl: "#challenge=1" };

  it("renders nothing for a run with no seed to offer", () => {
    // `data` is `null` for a learning-track task and for the test-only worlds
    // built with a ready-made random stream -- see `src/pages/game/index.ts`'s
    // `#seedLink` -- and there is nothing this block could usefully say about
    // either, the same reason `challengeTemplate` leaves the challenge bar's
    // own seed line out under the same condition.
    expect(seedPanelTemplate(null)).toBe("");
  });

  it("wraps the block in the settings popover's own shape, captioned", () => {
    const block = renderElement(seedPanelTemplate(SEED));

    expect(block.className).toBe("setblock");
    expect(block.querySelector(".cap")?.textContent).toBe("Seed");
  });

  it("shows the seed itself in the row's box, pinned or not", () => {
    // The mockup's `#seedVal` field, with the caret taken out: the seed is a
    // token to transcribe, and nothing in this build reads one back. Following
    // the seed itself would be worse than useless in the pinned state -- the
    // URL it would carry is the one the player is already on -- which is why
    // this is a `<span>` in both states rather than a link in one of them.
    for (const data of [SEED, PINNED_SEED]) {
      const value = renderElement(seedPanelTemplate(data)).querySelector(".seedrow > .val");

      expect(value?.tagName).toBe("SPAN");
      expect(value?.classList.contains("seedvalue")).toBe(true);
      expect(value?.textContent).toBe("1234567890");
    }
  });

  it("offers to pin an unpinned run's seed", () => {
    const block = renderElement(seedPanelTemplate(SEED));
    const seedLink = block.querySelector("a.seedlink");

    expect(seedLink?.getAttribute("href")).toBe("#challenge=1,seed=1234567890");
    // The mockup's `#seedCopy`, glyph and all: pinning a draw into the address
    // bar is the same gesture its copy button offers.
    expect(seedLink?.innerHTML).toBe(iconHtml("copy"));
    expect(block.querySelector("a.seednewdraw")).toBeNull();
  });

  it("offers a way out of a pinned run, in place of the offer to pin it", () => {
    const block = renderElement(seedPanelTemplate(PINNED_SEED));
    const newDraw = block.querySelector("a.seednewdraw");

    expect(newDraw?.getAttribute("href")).toBe("#challenge=1");
    // The mockup's `#seedRoll`: throwing this draw away and starting again is
    // the same gesture its dice button offers.
    expect(newDraw?.innerHTML).toBe(iconHtml("dice"));
    expect(block.querySelector("a.seedlink")).toBeNull();
  });

  it("names the icon it draws, for a screen reader and for a pointer alike", () => {
    // Nothing but the glyph is on screen, so the name is the whole of what
    // either kind of visitor is given -- and it has to say which seed as well
    // as which gesture, because the glyph says neither. WCAG 2.5.3 has nothing
    // to hold these against: it constrains a name against *visible* text.
    const names: readonly (readonly [SeedLinkData, string, string])[] = [
      [SEED, "a.seedlink", "Seed 1234567890: start another run from this seed"],
      [PINNED_SEED, "a.seednewdraw", "Seed 1234567890: new draw, start again without it"],
    ];

    for (const [data, selector, name] of names) {
      const action = renderElement(seedPanelTemplate(data)).querySelector(selector);

      expect(action?.textContent).toBe("");
      expect(action?.getAttribute("aria-label")).toBe(name);
      expect(action?.getAttribute("title")).toBe(name);
      expect(action?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("carries the same help disclosure the challenge bar's seed line does", () => {
    const help = renderElement(seedPanelTemplate(SEED)).querySelector(".seedhelp");

    expect(help?.tagName).toBe("DETAILS");
    expect(help?.querySelector("summary")?.textContent).toBe("what a seed does");
    // Dressed as the mockup's one-line `.sethint` under the row, since that is
    // the line it stands in for -- `src/styles/style.css` takes the disclosure
    // triangle off it there.
    expect(help?.querySelector("summary")?.className).toBe("sethint");
    expect(help?.querySelector(".seedcaveat")?.textContent).toContain("The same seed brings");
    // Closed to begin with, the same reason the challenge bar's own copy is:
    // a player who has read it once does not need it open for the rest of
    // the evening.
    expect(help?.hasAttribute("open")).toBe(false);
  });

  it("carries the same disclosure whether or not the run is pinned", () => {
    const help = renderElement(seedPanelTemplate(PINNED_SEED)).querySelector(".seedhelp");

    expect(help?.tagName).toBe("DETAILS");
    expect(help?.querySelector("summary")?.textContent).toBe("what a seed does");
  });
});
