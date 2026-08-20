// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { presentSeedPanel, seedPanelTemplate } from "./seed-panel.ts";
import type { SeedLinkData } from "../../../ui/templates.ts";
import { SEED_MAX_LENGTH, SEED_PATTERN } from "#shared/lib/seed.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { renderElement } from "#shared/ui/markup.ts";

describe("seedPanelTemplate", () => {
  /**
   * A sprite as the document serialises it.
   *
   * `spriteIconMarkup` writes XML-style self-closing tags (`<rect …/>`), which
   * the HTML parser reads as open tags and writes back out with a close tag of
   * their own. Comparing the rendered control against the rendered sprite
   * rather than against the string keeps the two on the same side of that.
   *
   * @param name - The sprite to draw.
   * @returns Its markup, round-tripped through the document.
   */
  function iconHtml(name: "copy" | "dice"): string {
    const host = document.createElement("div");
    host.innerHTML = spriteIconMarkup(name);
    return host.innerHTML;
  }

  /** A run, and the URL that puts it in the address bar. */
  const SEED: SeedLinkData = { seed: "1234567890", url: "#level=1,seed=1234567890" };

  it("renders nothing for a run with no seed to offer", () => {
    // `data` is `null` for a learning-track level and for the test-only worlds
    // built with a ready-made random stream -- see `src/pages/game/index.ts`'s
    // `#seedLink` -- and there is nothing this block could usefully say about
    // either, the same reason `levelTemplate` leaves the level bar's
    // own seed line out under the same condition.
    expect(seedPanelTemplate(null)).toBe("");
  });

  it("wraps the block in the settings popover's own shape, captioned", () => {
    const block = renderElement(seedPanelTemplate(SEED));

    expect(block.className).toBe("setblock");
    expect(block.querySelector(".cap")?.textContent).toBe("Seed");
  });

  it("shows the seed itself in a box the player can type another one into", () => {
    // The mockup's `#seedVal`, and an `<input>` here as it is there: the seed
    // is the player's to choose now, and a field is how a value is chosen.
    const field = renderElement(seedPanelTemplate(SEED)).querySelector(".seedrow > .val");

    expect(field?.tagName).toBe("INPUT");
    expect(field?.classList.contains("seedvalue")).toBe(true);
    expect((field as HTMLInputElement | null)?.value).toBe("1234567890");
    expect(field?.getAttribute("aria-label")).toBe("This run's seed — type another one to play it");
  });

  it("refuses in the field exactly what the address bar refuses", () => {
    // The field's own constraints are `#shared/lib/seed.ts`'s, not a second
    // copy: a field that accepted a seed the router turns away would send the
    // player's run off to somebody else's passengers.
    const field = renderElement(seedPanelTemplate(SEED)).querySelector(".seedvalue");

    expect(field?.getAttribute("maxlength")).toBe(String(SEED_MAX_LENGTH));
    expect(new RegExp(`^${field?.getAttribute("pattern") ?? ""}$`).source).toBe(
      SEED_PATTERN.source,
    );
    expect(field?.hasAttribute("required")).toBe(true);
  });

  it("keeps every helpful thing a browser does to text away from a seed", () => {
    // A phone that capitalises it, a browser that corrects it or a manager that
    // fills it has each turned the run into a different run.
    const field = renderElement(seedPanelTemplate(SEED)).querySelector(".seedvalue");

    expect(field?.getAttribute("spellcheck")).toBe("false");
    expect(field?.getAttribute("autocomplete")).toBe("off");
    expect(field?.getAttribute("autocapitalize")).toBe("off");
    expect(field?.getAttribute("autocorrect")).toBe("off");
  });

  it("offers to put the run in the address bar, as a real link", () => {
    const seedLink = renderElement(seedPanelTemplate(SEED)).querySelector("a.seedlink");

    expect(seedLink?.getAttribute("href")).toBe("#level=1,seed=1234567890");
    // The mockup's `#seedCopy`, glyph and all: pinning a draw into the address
    // bar is the same gesture its copy button offers.
    expect(seedLink?.innerHTML).toBe(iconHtml("copy"));
  });

  it("offers a fresh draw as a button, because it goes nowhere", () => {
    // It used to be a link to the same address without `seed=`, which was a new
    // draw only for as long as a seedless address drew one. It no longer does
    // -- the player's own seed is remembered -- so the draw happens here.
    const newDraw = renderElement(seedPanelTemplate(SEED)).querySelector(".seednewdraw");

    expect(newDraw?.tagName).toBe("BUTTON");
    expect(newDraw?.getAttribute("type")).toBe("button");
    expect(newDraw?.hasAttribute("href")).toBe(false);
    // The mockup's `#seedRoll`: throwing this draw away and starting again is
    // the same gesture its dice button offers.
    expect(newDraw?.innerHTML).toBe(iconHtml("dice"));
  });

  it("shows both controls at once, in the mockup's order", () => {
    // They named two states of one run while a seedless URL meant a new draw;
    // they name two different things to do now, so both are always there.
    const row = renderElement(seedPanelTemplate(SEED)).querySelector(".seedrow");

    expect([...(row?.children ?? [])].map((child) => child.className)).toEqual([
      "val seedvalue",
      "ghost seednewdraw",
      "ghost seedlink",
    ]);
  });

  it("names the icon it draws, for a screen reader and for a pointer alike", () => {
    // Nothing but the glyph is on screen, so the name is the whole of what
    // either kind of visitor is given -- and it has to say which seed as well
    // as which gesture, because the glyph says neither. WCAG 2.5.3 has nothing
    // to hold these against: it constrains a name against *visible* text.
    const names: readonly (readonly [string, string])[] = [
      ["a.seedlink", "Seed 1234567890: put this run in the address bar"],
      ["button.seednewdraw", "Seed 1234567890: draw a new one and start again"],
    ];

    for (const [selector, name] of names) {
      const action = renderElement(seedPanelTemplate(SEED)).querySelector(selector);

      expect(action?.textContent).toBe("");
      expect(action?.getAttribute("aria-label")).toBe(name);
      expect(action?.getAttribute("title")).toBe(name);
      expect(action?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("carries the same help disclosure the level bar's seed line does", () => {
    const help = renderElement(seedPanelTemplate(SEED)).querySelector(".seedhelp");

    expect(help?.tagName).toBe("DETAILS");
    expect(help?.querySelector("summary")?.textContent).toBe("what a seed does");
    // Dressed as the mockup's one-line `.sethint` under the row, since that is
    // the line it stands in for -- `seed-panel.css` takes the disclosure
    // triangle off it there.
    expect(help?.querySelector("summary")?.className).toBe("sethint");
    expect(help?.querySelector(".seedcaveat")?.textContent).toContain("The same seed brings");
    // Closed to begin with, the same reason the level bar's own copy is:
    // a player who has read it once does not need it open for the rest of
    // the evening.
    expect(help?.hasAttribute("open")).toBe(false);
  });

  it("says it opens with the chevron the rest of the app says it with", () => {
    // The stylesheet takes the UA's triangle off this summary so it reads as
    // the mockup's plain hint line. Something has to be left saying there is a
    // paragraph behind it, and the app already spells that `#i-right`: the
    // statistics shelf's "All figures" and the Hotkeys row beneath this block
    // both wear it. It leads the line, as that shelf's does.
    const summary = renderElement(seedPanelTemplate(SEED)).querySelector(".seedhelp > summary");
    const chevron = summary?.firstElementChild;

    expect(chevron?.tagName).toBe("svg");
    expect(chevron?.getAttribute("class")).toBe("ds-icon chev");
    expect(chevron?.getAttribute("aria-hidden")).toBe("true");
    // The words move into an element of their own to sit beside it, and the
    // line still reads as just the words.
    expect(summary?.querySelector("span")?.textContent).toBe("what a seed does");
    expect(summary?.textContent).toBe("what a seed does");
  });
});

describe("presentSeedPanel", () => {
  /** The run every case here starts from. */
  const SEED_FIXTURE: SeedLinkData = { seed: "1234567890", url: "#level=1,seed=1234567890" };

  /**
   * The block wired up, in the wrapper the settings popover really gives it.
   *
   * @returns The wrapper, the field inside it, and what the row has reported.
   */
  function panel(): {
    block: HTMLElement;
    field: HTMLInputElement;
    onSeed: ReturnType<typeof vi.fn>;
  } {
    const block = document.createElement("div");
    block.innerHTML = seedPanelTemplate(SEED_FIXTURE);
    document.body.replaceChildren(block);
    const onSeed = vi.fn();
    presentSeedPanel(block, { onSeed });
    return { block, field: fieldIn(block), onSeed };
  }

  /**
   * The row's field, or a failure naming what was missing rather than a `null`
   * that fails five lines later.
   *
   * @param block - The wrapper the row was written into.
   * @returns The field.
   * @throws Error When the row has no field.
   */
  function fieldIn(block: HTMLElement): HTMLInputElement {
    const field = block.querySelector<HTMLInputElement>(".seedvalue");
    if (field === null) {
      throw new Error("The seed row has no field");
    }
    return field;
  }

  /**
   * Types a value into the field and commits it the way Enter or a blur does.
   *
   * @param field - The row's field.
   * @param value - What the player leaves in it.
   */
  function commit(field: HTMLInputElement, value: string): void {
    field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }

  it("reports a seed the player typed", () => {
    const { field, onSeed } = panel();

    commit(field, "hand-picked");

    expect(onSeed).toHaveBeenCalledExactlyOnceWith("hand-picked");
  });

  it("takes the spaces off a pasted seed", () => {
    // A seed comes off a chat line or a console print as often as it is typed,
    // and those carry a space at one end. Trimming cannot change which run is
    // meant: a space was never a character a seed could contain.
    const { field, onSeed } = panel();

    commit(field, "  1234567890abc \n");

    expect(onSeed).toHaveBeenCalledExactlyOnceWith("1234567890abc");
  });

  it("refuses a seed the address bar could not carry, and says which characters", () => {
    const { field, onSeed } = panel();
    const reportValidity = vi.spyOn(field, "reportValidity").mockReturnValue(false);

    commit(field, "seed with spaces");

    expect(onSeed).not.toHaveBeenCalled();
    expect(field.validationMessage).toBe(
      "A seed can be up to 64 letters, digits, dots, hyphens or underscores.",
    );
    // The field is not inside a `<form>`, so nothing would put the message on
    // screen unless this asks for it.
    expect(reportValidity).toHaveBeenCalledOnce();
  });

  it("refuses an emptied field rather than playing a seed of no characters", () => {
    const { field, onSeed } = panel();
    vi.spyOn(field, "reportValidity").mockReturnValue(false);

    commit(field, "   ");

    expect(onSeed).not.toHaveBeenCalled();
  });

  it("drops the refusal at the first keystroke of the correction", () => {
    // A message outlives the value that earned it, and a field still carrying
    // one reports the wrong thing at the next commit.
    const { field, onSeed } = panel();
    vi.spyOn(field, "reportValidity").mockReturnValue(false);
    commit(field, "no good");

    commit(field, "good");

    expect(field.validationMessage).toBe("");
    expect(onSeed).toHaveBeenCalledExactlyOnceWith("good");
  });

  it("draws a seed of its own when the dice is pressed", () => {
    const { block, onSeed } = panel();

    block.querySelector<HTMLButtonElement>(".seednewdraw")?.click();

    expect(onSeed).toHaveBeenCalledOnce();
    const [drawn] = onSeed.mock.calls[0] as [string];
    expect(drawn).toMatch(SEED_PATTERN);
  });

  it("still hears the field after the block has been redrawn under it", () => {
    // `AppBarSettingsController.setSeed` replaces everything inside the
    // wrapper on every seed change -- most of which this row itself caused --
    // so handlers attached to the controls would last exactly one choice.
    const { block, onSeed } = panel();

    block.innerHTML = seedPanelTemplate({ seed: "later", url: "#level=1,seed=later" });
    commit(fieldIn(block), "later-still");

    expect(onSeed).toHaveBeenCalledExactlyOnceWith("later-still");
  });

  it("leaves the link alone, because a link needs no help going where it points", () => {
    const { block, onSeed } = panel();

    block.querySelector<HTMLAnchorElement>(".seedlink")?.click();

    expect(onSeed).not.toHaveBeenCalled();
  });
});
