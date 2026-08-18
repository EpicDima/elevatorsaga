// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { seedPanelTemplate } from "./seed-panel.ts";
import { renderElement } from "../../../ui/templates.ts";
import type { SeedLinkData } from "../../../ui/templates.ts";

describe("seedPanelTemplate", () => {
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
    // built with a ready-made random stream -- see `src/app/app.ts`'s
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

  it("offers to pin an unpinned run's seed", () => {
    const block = renderElement(seedPanelTemplate(SEED));
    const seedLink = block.querySelector("a.seedlink");

    expect(seedLink?.textContent).toBe("1234567890");
    expect(seedLink?.getAttribute("href")).toBe("#challenge=1,seed=1234567890");
    expect(seedLink?.getAttribute("aria-label")).toBe(
      "Seed 1234567890: start another run from this seed",
    );
    // WCAG 2.5.3: whatever is on screen has to be part of the spoken name.
    expect(seedLink?.getAttribute("aria-label")).toContain(seedLink?.textContent);
    expect(block.querySelector(".seedvalue")).toBeNull();
    expect(block.querySelector("a.seednewdraw")).toBeNull();
  });

  it("offers a way out of a pinned run, in place of the offer to pin it", () => {
    const block = renderElement(seedPanelTemplate(PINNED_SEED));
    const newDraw = block.querySelector("a.seednewdraw");

    expect(block.querySelector(".seedvalue")?.textContent).toBe("1234567890");
    expect(newDraw?.textContent).toBe("new draw");
    expect(newDraw?.getAttribute("href")).toBe("#challenge=1");
    expect(newDraw?.getAttribute("aria-label")).toBe(
      "Seed 1234567890: new draw, start again without it",
    );
    expect(newDraw?.getAttribute("aria-label")).toContain(newDraw?.textContent);
    // Following the seed itself would go where the player already is: no
    // hashchange, no restart, nothing at all -- while its name promises
    // another run.
    expect(block.querySelector("a.seedlink")).toBeNull();
  });

  it("carries the same help disclosure the challenge bar's seed line does", () => {
    const help = renderElement(seedPanelTemplate(SEED)).querySelector(".seedhelp");

    expect(help?.tagName).toBe("DETAILS");
    expect(help?.querySelector("summary")?.textContent).toBe("what a seed does");
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
