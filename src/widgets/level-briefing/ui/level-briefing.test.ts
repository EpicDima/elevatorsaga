// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { presentLevelBriefing } from "./level-briefing.ts";
import type { LevelBriefingData } from "./level-briefing.ts";
import { query, queryAll, requireElement } from "#shared/lib/dom.ts";

import { createElement } from "../../../ui/test-helpers.ts";

/** The `.tutorial` region of the page shell, the element both cards mount into. */
let parent: HTMLElement;

beforeEach(() => {
  parent = createElement("div", { className: "tutorial" });
  document.body.replaceChildren(parent);
});

/** A briefing to draw, with only the fields a spec cares about overridden. */
function briefingData(overrides: Partial<LevelBriefingData> = {}): LevelBriefingData {
  return {
    title: "Morning rush",
    briefing: "Everyone arrives at the lobby and wants to go up.",
    ...overrides,
  };
}

describe("presentLevelBriefing", () => {
  it("draws the level's name and what the level is about", () => {
    presentLevelBriefing(parent, briefingData());

    expect(requireElement(".briefingtitle", parent).textContent).toBe("Morning rush");
    expect(requireElement(".briefingtext", parent).textContent).toBe(
      "Everyone arrives at the lobby and wants to go up.",
    );
  });

  it("names the card after the level, so the region is a landmark a reader can find", () => {
    // A <section> with no accessible name isn't a landmark at all.
    presentLevelBriefing(parent, briefingData({ title: "Zoned dispatch" }));

    const card = requireElement(".briefingpanel", parent);
    expect(card.tagName).toBe("SECTION");
    expect(card.getAttribute("aria-label")).toBe("Zoned dispatch");
  });

  it("puts the title at the heading level the rest of the page leaves for it", () => {
    // Matches the lesson card's own heading level, since both share this region's document outline.
    presentLevelBriefing(parent, briefingData());

    expect(requireElement(".briefingtitle", parent).tagName).toBe("H2");
  });

  it("writes the title as text, whatever it looks like", () => {
    // Escaped so a level name containing `<` doesn't silently lose the rest of its title to the parser.
    presentLevelBriefing(parent, briefingData({ title: "<script>alert(1)</script>" }));

    expect(query("script", parent)).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect(requireElement(".briefingtitle", parent).textContent).toBe("<script>alert(1)</script>");
  });

  it("writes the briefing as the catalog markup it is", () => {
    // Deliberately unescaped: a briefing is trusted catalog HTML that carries markup around its terms.
    presentLevelBriefing(parent, briefingData({ briefing: "<em>lift</em> dispatch" }));

    const prose = requireElement(".briefingtext", parent);
    expect(requireElement("em", prose).textContent).toBe("lift");
    expect(prose.textContent).toBe("lift dispatch");
  });

  it("replaces the card it drew last time rather than stacking another on it", () => {
    // `replaceChildren`, not `append`: this redraws on every run start and language change.
    presentLevelBriefing(parent, briefingData({ title: "Morning rush" }));
    presentLevelBriefing(parent, briefingData({ title: "Evening rush" }));

    expect(queryAll(".briefingpanel", parent)).toHaveLength(1);
    expect(requireElement(".briefingtitle", parent).textContent).toBe("Evening rush");
  });

  it("clears whatever was in the region before it, including the other card", () => {
    // The region is shared with the lesson card; exactly one of the two is ever drawn.
    parent.replaceChildren(
      createElement("div", { className: "tutorialpanel", text: "a lesson from before" }),
      createElement("p", { text: "and something else" }),
    );

    presentLevelBriefing(parent, briefingData());

    expect(query(".tutorialpanel", parent)).toBeNull();
    expect(parent.children).toHaveLength(1);
    expect(requireElement(".briefingpanel", parent).textContent).toContain("Everyone arrives");
  });
});
