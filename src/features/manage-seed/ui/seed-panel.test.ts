// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { presentSeedPanel, seedPanelTemplate } from "./seed-panel.ts";
import type { SeedLinkData } from "../../../ui/templates.ts";
import { SEED_MAX_LENGTH, SEED_PATTERN } from "#shared/lib/seed.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { renderElement } from "#shared/ui/markup.ts";

describe("seedPanelTemplate", () => {
  /**
   * A sprite as the document serializes it: `spriteIconMarkup`'s self-closing
   * tags get rewritten with a close tag by the HTML parser, so comparisons
   * must go through the same round trip.
   */
  function iconHtml(name: "copy" | "dice"): string {
    const host = document.createElement("div");
    host.innerHTML = spriteIconMarkup(name);
    return host.innerHTML;
  }

  /** A run, and the URL that puts it in the address bar. */
  const SEED: SeedLinkData = { seed: "1234567890", url: "#level=1,seed=1234567890" };

  it("renders nothing for a run with no seed to offer", () => {
    // `data` is `null` for a learning-track level and for test-only worlds with a ready-made random stream.
    expect(seedPanelTemplate(null)).toBe("");
  });

  it("wraps the block in the settings popover's own shape, captioned", () => {
    const block = renderElement(seedPanelTemplate(SEED));

    expect(block.className).toBe("setblock");
    expect(block.querySelector(".cap")?.textContent).toBe("Seed");
  });

  it("shows the seed itself in a box the player can type another one into", () => {
    const field = renderElement(seedPanelTemplate(SEED)).querySelector(".seedrow > .val");

    expect(field?.tagName).toBe("INPUT");
    expect(field?.classList.contains("seedvalue")).toBe(true);
    expect((field as HTMLInputElement | null)?.value).toBe("1234567890");
    expect(field?.getAttribute("aria-label")).toBe("This run's seed — type another one to play it");
  });

  it("refuses in the field exactly what the address bar refuses", () => {
    // The field's constraints reuse the router's own, not a second copy that could drift.
    const field = renderElement(seedPanelTemplate(SEED)).querySelector(".seedvalue");

    expect(field?.getAttribute("maxlength")).toBe(String(SEED_MAX_LENGTH));
    expect(new RegExp(`^${field?.getAttribute("pattern") ?? ""}$`).source).toBe(
      SEED_PATTERN.source,
    );
    expect(field?.hasAttribute("required")).toBe(true);
  });

  it("keeps every helpful thing a browser does to text away from a seed", () => {
    const field = renderElement(seedPanelTemplate(SEED)).querySelector(".seedvalue");

    expect(field?.getAttribute("spellcheck")).toBe("false");
    expect(field?.getAttribute("autocomplete")).toBe("off");
    expect(field?.getAttribute("autocapitalize")).toBe("off");
    expect(field?.getAttribute("autocorrect")).toBe("off");
  });

  it("offers to put the run in the address bar, as a real link", () => {
    const seedLink = renderElement(seedPanelTemplate(SEED)).querySelector("a.seedlink");

    expect(seedLink?.getAttribute("href")).toBe("#level=1,seed=1234567890");
    expect(seedLink?.innerHTML).toBe(iconHtml("copy"));
  });

  it("offers a fresh draw as a button, because it goes nowhere", () => {
    const newDraw = renderElement(seedPanelTemplate(SEED)).querySelector(".seednewdraw");

    expect(newDraw?.tagName).toBe("BUTTON");
    expect(newDraw?.getAttribute("type")).toBe("button");
    expect(newDraw?.hasAttribute("href")).toBe(false);
    expect(newDraw?.innerHTML).toBe(iconHtml("dice"));
  });

  it("shows both controls at once, the field first", () => {
    const row = renderElement(seedPanelTemplate(SEED)).querySelector(".seedrow");

    expect([...(row?.children ?? [])].map((child) => child.className)).toEqual([
      "val seedvalue",
      "ghost seednewdraw",
      "ghost seedlink",
    ]);
  });

  it("names the icon it draws, for a screen reader and for a pointer alike", () => {
    // WCAG 2.5.3 doesn't apply here since it constrains a name against visible text, and there is none.
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

  it("explains what a seed does, behind a disclosure", () => {
    const help = renderElement(seedPanelTemplate(SEED)).querySelector(".seedhelp");

    expect(help?.tagName).toBe("DETAILS");
    expect(help?.querySelector("summary")?.textContent).toBe("what a seed does");
    expect(help?.querySelector("summary")?.className).toBe("sethint");
    expect(help?.querySelector(".seedcaveat")?.textContent).toContain("The same seed brings");
    expect(help?.hasAttribute("open")).toBe(false);
  });

  it("says it opens with the chevron the rest of the app says it with", () => {
    const summary = renderElement(seedPanelTemplate(SEED)).querySelector(".seedhelp > summary");
    const chevron = summary?.firstElementChild;

    expect(chevron?.tagName).toBe("svg");
    expect(chevron?.getAttribute("class")).toBe("ds-icon chev");
    expect(chevron?.getAttribute("aria-hidden")).toBe("true");
    expect(summary?.querySelector("span")?.textContent).toBe("what a seed does");
    expect(summary?.textContent).toBe("what a seed does");
  });
});

describe("presentSeedPanel", () => {
  /** The run every case here starts from. */
  const SEED_FIXTURE: SeedLinkData = { seed: "1234567890", url: "#level=1,seed=1234567890" };

  /** The block wired up, in the wrapper the settings popover really gives it. */
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

  /** The row's field, or a failure naming what was missing rather than a `null` that fails five lines later. */
  function fieldIn(block: HTMLElement): HTMLInputElement {
    const field = block.querySelector<HTMLInputElement>(".seedvalue");
    if (field === null) {
      throw new Error("The seed row has no field");
    }
    return field;
  }

  /** Types a value into the field and commits it the way Enter or a blur does. */
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
    // A space was never a character a seed could contain, so trimming can't change which run is meant.
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
    // The field is not inside a `<form>`, so nothing shows the message unless this asks for it.
    expect(reportValidity).toHaveBeenCalledOnce();
  });

  it("refuses an emptied field rather than playing a seed of no characters", () => {
    const { field, onSeed } = panel();
    vi.spyOn(field, "reportValidity").mockReturnValue(false);

    commit(field, "   ");

    expect(onSeed).not.toHaveBeenCalled();
  });

  it("drops the refusal at the first keystroke of the correction", () => {
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
    // The wrapper's contents are replaced wholesale on every seed change, so a listener on the old controls wouldn't survive it.
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
