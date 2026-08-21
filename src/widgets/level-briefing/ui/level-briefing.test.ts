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

/**
 * A briefing to draw.
 *
 * Barely a helper, and here for the reason `tutorial-panel.test.ts` keeps its
 * own: so that a spec reads as "the card, drawn with a title that looks like
 * markup" rather than as an object literal with one interesting field in it.
 *
 * @param overrides - The fields the spec is about.
 * @returns Data for one draw of the card.
 */
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
    // A <section> with no accessible name is not a landmark at all, which is
    // the whole reason the element is a <section> rather than a <div>. The name
    // is the level's own title, so the words announced on the way in are the
    // words on the screen.
    presentLevelBriefing(parent, briefingData({ title: "Zoned dispatch" }));

    const card = requireElement(".briefingpanel", parent);
    expect(card.tagName).toBe("SECTION");
    expect(card.getAttribute("aria-label")).toBe("Zoned dispatch");
  });

  it("puts the title at the heading level the rest of the page leaves for it", () => {
    // <h2>, the same level the lesson card that shares this element emits. The
    // page's <h1> is the game's, and two cards drawn into one region must not
    // disagree about the outline of a document neither of them owns.
    presentLevelBriefing(parent, briefingData());

    expect(requireElement(".briefingtitle", parent).tagName).toBe("H2");
  });

  it("writes the title as text, whatever it looks like", () => {
    // The title is escaped, so a level named after a tag is a heading that says
    // the tag. Nothing a player typed reaches this field -- the editor's
    // contents never come near this widget -- so this is not a guard against an
    // attacker so much as against a level whose name contains a `<`, which
    // would otherwise silently lose the rest of its title to a parser.
    presentLevelBriefing(parent, briefingData({ title: "<script>alert(1)</script>" }));

    expect(query("script", parent)).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect(requireElement(".briefingtitle", parent).textContent).toBe("<script>alert(1)</script>");
  });

  it("writes the briefing as the catalog markup it is", () => {
    // The opposite treatment, and deliberately: a briefing is a `.html` message
    // of this repository's own catalog and carries <code>, <em> and
    // <span class="emphasis-color"> around the terms it introduces. Escaped, it
    // would print those tags at the player.
    presentLevelBriefing(parent, briefingData({ briefing: "<em>lift</em> dispatch" }));

    const prose = requireElement(".briefingtext", parent);
    expect(requireElement("em", prose).textContent).toBe("lift");
    expect(prose.textContent).toBe("lift dispatch");
  });

  it("replaces the card it drew last time rather than stacking another on it", () => {
    // `replaceChildren`, not `append`. The page redraws this at the start of
    // every run and again whenever the language changes, so appending would
    // leave a column of briefings for one level.
    presentLevelBriefing(parent, briefingData({ title: "Morning rush" }));
    presentLevelBriefing(parent, briefingData({ title: "Evening rush" }));

    expect(queryAll(".briefingpanel", parent)).toHaveLength(1);
    expect(requireElement(".briefingtitle", parent).textContent).toBe("Evening rush");
  });

  it("clears whatever was in the region before it, including the other card", () => {
    // The region is shared: exactly one of this card and the learning track's
    // lesson is ever drawn, and the page empties the element by calling the
    // presenter the current level needs. A briefing drawn under a leftover
    // lesson would be two levels' worth of prose beside one building.
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
