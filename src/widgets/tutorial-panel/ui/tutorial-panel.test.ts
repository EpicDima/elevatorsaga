// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { presentTutorial, tutorialTemplate } from "./tutorial-panel.ts";
import type { TutorialPanelData, TutorialTemplateData } from "./tutorial-panel.ts";
import { tutorialLevels } from "#game/tutorial.ts";
import type { TutorialLevel } from "#game/tutorial.ts";
import { DEFAULT_LOCALE, EN_MESSAGES, LOCALES, setLocale, translateIn } from "#i18n/index.ts";
import { query, queryAll, requireElement } from "#shared/lib/dom.ts";
import { spriteIconMarkup, type SpriteIconName } from "#shared/ui/icon.ts";
import { renderElement } from "#shared/ui/markup.ts";

import { createElement } from "../../../ui/test-helpers.ts";

/** English catalog, indexable by a runtime-built key (unlike `t`, which needs a literal). */
const ENGLISH: Readonly<Record<string, unknown>> = EN_MESSAGES;

/**
 * A sprite as the document serializes it: `spriteIconMarkup`'s self-closing
 * tags get rewritten with a close tag by the HTML parser, so comparisons must
 * go through the same round trip.
 */
function iconHtml(name: SpriteIconName): string {
  const host = createElement("div");
  host.innerHTML = spriteIconMarkup(name);
  return host.innerHTML;
}

/** The `.tutorial` region of the page shell, attached so focus can move in it. */
let parent: HTMLElement;

beforeEach(() => {
  parent = createElement("div", { className: "tutorial" });
  document.body.replaceChildren(parent);
});

afterEach(() => {
  setLocale(DEFAULT_LOCALE);
});

/** Panel data for level 1, overridable. */
function panelData(overrides: Partial<TutorialPanelData> = {}): TutorialPanelData {
  return { levelIndex: 0, ...overrides };
}

/** The disclosure at `index` (0-2 are hints, 3 is the explanation). */
function disclosure(index: number): HTMLDetailsElement {
  const element = queryAll(".tutorialhint, .tutorialexplanation", parent)[index];
  if (!(element instanceof HTMLDetailsElement)) {
    throw new Error(`No disclosure at position ${String(index)}`);
  }
  return element;
}

/** Which disclosures are open, in the order they are drawn. */
function openStates(): boolean[] {
  return queryAll(".tutorialhint, .tutorialexplanation", parent).map(
    (element) => element instanceof HTMLDetailsElement && element.open,
  );
}

/** The English title for a level id like `tutorial-3`, or `undefined` if none. */
function englishTitle(id: string): unknown {
  return ENGLISH[`tutorial.level${id.slice("tutorial-".length)}.title`];
}

/** How many paragraphs the English explanation of a level is written in. */
function englishExplanationParagraphs(id: string): number {
  const message = ENGLISH[`tutorial.level${id.slice("tutorial-".length)}.explanation.html`];
  return typeof message === "string" ? message.split("\n\n").length : 0;
}

/** Strips `//` comments — the untranslated half of a program. */
function uncommented(code: string): string {
  return code
    .split("\n")
    .map((line) => line.replace(/\s*\/\/.*$/, ""))
    .join("\n");
}

describe("presentTutorial", () => {
  it("draws the level, its goal and its hints", () => {
    presentTutorial(parent, panelData());

    expect(requireElement(".tutorialtitle", parent).textContent).toBe(
      "The elevator that goes nowhere",
    );
    expect(requireElement(".tutorialgoal", parent).textContent).toBe(
      "Make the elevator visit both floors of this building and deliver 10 passengers within 60 seconds.",
    );
    expect(queryAll(".tutorialhint summary", parent).map((summary) => summary.textContent)).toEqual(
      ["Hint 1", "Hint 2", "Hint 3"],
    );
    expect(requireElement(".tutorialexplanation summary", parent).textContent).toBe(
      "Why this happens",
    );
    expect(requireElement(".tutorialcopycode", parent).getAttribute("aria-label")).toBe(
      "Copy this program",
    );
  });

  it("highlights the answer and marks the line a player actually has to write", () => {
    presentTutorial(parent, panelData({ levelIndex: 0 }));

    const code = requireElement(".tutorialsolution code", parent);
    const level = tutorialLevels[0];
    if (level === undefined) {
      throw new Error("The track has no first level");
    }
    expect(code.querySelectorAll("[class^='tok-']").length).toBeGreaterThan(0);
    const marked = [...code.querySelectorAll(".tutoriallinechanged")];
    expect(marked.length).toBeGreaterThan(0);
    const startingLines = new Set(level.startingCode.split("\n"));
    for (const line of marked) {
      // A line carries its own break; the program split above has none.
      expect(startingLines.has(line.textContent.replace(/\n$/, ""))).toBe(false);
    }
  });

  it("says nothing about the track the level belongs to", () => {
    presentTutorial(parent, panelData({ levelIndex: 2 }));

    expect(query(".tutorialposition", parent)).toBeNull();
    expect(query(".tutorialsteps", parent)).toBeNull();
    expect(query(".tutorialprogress", parent)).toBeNull();
    expect(requireElement(".tutorialpanel", parent).firstElementChild?.className).toBe(
      "tutorialtitle",
    );
  });

  it("inserts the hints as the markup they are", () => {
    presentTutorial(parent, panelData());

    const hints = queryAll(".tutorialhint .tutorialprose", parent);
    expect(hints[1]?.innerHTML).toContain('<span class="emphasis-color">1</span>');
    expect(hints[1]?.textContent).toContain("the top floor here is 1.");
  });

  it("splits a hint at its blank line", () => {
    // Level 7's last hint says two separate things before it hands over the answer.
    presentTutorial(parent, panelData({ levelIndex: 6 }));

    const prose = queryAll(".tutorialprose", disclosure(2));
    expect(prose).toHaveLength(2);
    for (const paragraph of prose) {
      expect(paragraph.textContent).not.toContain("\n");
    }
  });

  it.each(tutorialLevels.map((level, index) => [index, level] as const))(
    "draws the prose of the level at position %i",
    (index, level) => {
      presentTutorial(parent, panelData({ levelIndex: index }));

      expect(requireElement(".tutorialtitle", parent).textContent).toBe(englishTitle(level.id));
      expect(requireElement(".tutorialgoal", parent).textContent).not.toBe("");
      const hints = queryAll(".tutorialhint", parent);
      expect(hints).toHaveLength(3);
      for (const hint of hints) {
        const prose = queryAll(".tutorialprose", hint).map((paragraph) => paragraph.textContent);
        expect(prose.length).toBeGreaterThan(0);
        expect(prose).not.toContain("");
      }
      const explanation = queryAll(".tutorialexplanation .tutorialprose", parent);
      // One paragraph per blank line in the message, so a long one is never a wall of text.
      expect(explanation).toHaveLength(englishExplanationParagraphs(level.id));
      expect(explanation.map((paragraph) => paragraph.textContent)).not.toContain("");
      expect(requireElement(".tutorialpanel", parent).getAttribute("data-level-index")).toBe(
        String(index),
      );
      expect(requireElement(".tutorialsolution code", parent).textContent).toBe(level.solutionCode);
    },
  );

  it("prints the answer under the last hint and nowhere else", () => {
    presentTutorial(parent, panelData({ levelIndex: 3 }));

    expect(
      queryAll(".tutorialhint", parent).map((hint) => query(".tutorialsolution", hint) !== null),
    ).toEqual([false, false, true]);
    expect(queryAll(".tutorialsolution", parent)).toHaveLength(1);
  });

  it("refuses an index the track has no level at", () => {
    expect(() => {
      presentTutorial(parent, panelData({ levelIndex: tutorialLevels.length }));
    }).toThrow(RangeError);
    expect(() => {
      presentTutorial(parent, panelData({ levelIndex: -1 }));
    }).toThrow("No tutorial level with index -1");
  });

  it("refuses a level the catalog has no prose for", () => {
    const [first] = tutorialLevels;
    if (first === undefined) {
      throw new Error("The track has no levels at all");
    }
    const track = tutorialLevels as TutorialLevel[];
    track.push({ ...first, id: "tutorial-9" });

    try {
      expect(() => {
        presentTutorial(parent, panelData({ levelIndex: track.length - 1 }));
      }).toThrow("No panel prose for tutorial level tutorial-9");
    } finally {
      track.pop();
    }
  });

  it("leaves the panel already on screen alone when it refuses", () => {
    presentTutorial(parent, panelData({ levelIndex: 1 }));

    expect(() => {
      presentTutorial(parent, panelData({ levelIndex: tutorialLevels.length }));
    }).toThrow(RangeError);
    expect(requireElement(".tutorialpanel", parent).getAttribute("data-level-index")).toBe("1");
  });

  describe("the hints a player has opened", () => {
    it("keeps them open across a redraw of the same level", () => {
      presentTutorial(parent, panelData({ levelIndex: 2 }));
      disclosure(1).open = true;
      disclosure(3).open = true;

      presentTutorial(parent, panelData({ levelIndex: 2 }));

      expect(openStates()).toEqual([false, true, false, true]);
    });

    it("closes them all when the next level is drawn", () => {
      presentTutorial(parent, panelData({ levelIndex: 2 }));
      disclosure(2).open = true;

      presentTutorial(parent, panelData({ levelIndex: 3 }));

      expect(openStates()).toEqual([false, false, false, false]);
    });

    it("starts every level closed", () => {
      presentTutorial(parent, panelData({ levelIndex: 4 }));

      expect(openStates()).toEqual([false, false, false, false]);
    });

    it("records the level the panel was drawn for, which is what decides the two", () => {
      presentTutorial(parent, panelData({ levelIndex: 5 }));

      expect(requireElement(".tutorialpanel", parent).getAttribute("data-level-index")).toBe("5");
    });
  });

  describe("focus", () => {
    it("puts it back on the summary a redraw destroyed", () => {
      presentTutorial(parent, panelData());
      queryAll(".tutorialpanel summary", parent)[1]?.focus();

      presentTutorial(parent, panelData());

      expect(document.activeElement).toBe(queryAll(".tutorialpanel summary", parent)[1]);
    });

    it("puts it back on the copy button a redraw destroyed", () => {
      presentTutorial(parent, panelData());
      const pressed = requireElement(".tutorialcopycode", parent);
      pressed.focus();

      presentTutorial(parent, panelData());

      const redrawn = requireElement(".tutorialcopycode", parent);
      expect(redrawn).not.toBe(pressed);
      expect(document.activeElement).toBe(redrawn);
    });

    it("restores by position, so a change of level lands in the same place", () => {
      presentTutorial(parent, panelData({ levelIndex: 0 }));
      requireElement(".tutorialcopycode", parent).focus();

      presentTutorial(parent, panelData({ levelIndex: 1 }));

      expect(document.activeElement).toBe(requireElement(".tutorialcopycode", parent));
    });

    it("does not take it on the first draw", () => {
      presentTutorial(parent, panelData());

      expect(document.activeElement).toBe(document.body);
    });

    it("leaves it alone when the redraw came from somewhere else", () => {
      presentTutorial(parent, panelData());
      const elsewhere = createElement("textarea");
      document.body.append(elsewhere);
      elsewhere.focus();

      presentTutorial(parent, panelData());

      expect(document.activeElement).toBe(elsewhere);
    });
  });

  describe("what the copy button does about copying the answer", () => {
    afterEach(() => {
      // jsdom has no Clipboard API, so a spec that stubbed it must clean up.
      Reflect.deleteProperty(navigator, "clipboard");
      vi.useRealTimers();
    });

    /** Stands in for `navigator.clipboard.writeText`, since jsdom has no Clipboard API to spy on. */
    function stubClipboard(resolved: boolean): ReturnType<typeof vi.fn> {
      const writeText = vi.fn(() =>
        resolved ? Promise.resolve() : Promise.reject(new Error("denied")),
      );
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });
      return writeText;
    }

    /** The button itself, which is the whole visible report on the copy. */
    function copyButton(): HTMLElement {
      return requireElement(".tutorialcopycode", parent);
    }

    /** Waits out the mark, whatever `COPIED_FLASH_MS` is set to. */
    async function waitOutTheMark(): Promise<void> {
      await vi.advanceTimersByTimeAsync(60_000);
    }

    it("is a glyph on the code block, named for what it does rather than labeled", () => {
      presentTutorial(parent, panelData());

      const button = copyButton();
      expect(button.closest("pre")).toBe(requireElement(".tutorialsolution", parent));
      // Named, not labeled: a caption beside the answer is what this replaced.
      expect(button.textContent).toBe("");
      expect(button.getAttribute("aria-label")).toBe("Copy this program");
      expect(button.title).toBe("Copy this program");
      expect(button.innerHTML).toBe(iconHtml("copy"));
      expect(button.hasAttribute("data-copied")).toBe(false);
    });

    it("announces into a live region that is already there, empty and unseen", () => {
      presentTutorial(parent, panelData());

      const line = requireElement(".tutorialcopied", parent);
      expect(line.getAttribute("aria-live")).toBe("polite");
      expect(line.textContent).toBe("");
      // Screen readers only: what a sighted player gets is the mark on the button.
      expect(line.classList.contains("visually-hidden")).toBe(true);
    });

    it("copies the program exactly as it is shown, and wears a check for it", async () => {
      const writeText = stubClipboard(true);
      presentTutorial(parent, panelData());
      const code = requireElement(".tutorialsolution code", parent).textContent;

      copyButton().click();

      await vi.waitFor(() => {
        expect(copyButton().getAttribute("data-copied")).toBe("yes");
      });
      expect(writeText).toHaveBeenCalledWith(code);
      expect(copyButton().innerHTML).toBe(iconHtml("check"));
      expect(copyButton().getAttribute("aria-label")).toBe("Copied to your clipboard.");
      expect(requireElement(".tutorialcopied", parent).textContent).toBe(
        "Copied to your clipboard.",
      );
    });

    it("wears a cross when the browser refuses, and says what to do instead", async () => {
      stubClipboard(false);
      presentTutorial(parent, panelData());

      copyButton().click();

      await vi.waitFor(() => {
        expect(copyButton().getAttribute("data-copied")).toBe("no");
      });
      expect(copyButton().innerHTML).toBe(iconHtml("x"));
      // On the button as well as in the live region: the cross alone doesn't
      // say that the program can still be selected by hand.
      expect(copyButton().title).toBe(
        "Your browser refused to copy it. Select the code and copy it yourself.",
      );
      expect(requireElement(".tutorialcopied", parent).textContent).toBe(
        "Your browser refused to copy it. Select the code and copy it yourself.",
      );
    });

    it("wears the same cross when there is no clipboard to write to at all", async () => {
      // No stub: jsdom's own `navigator.clipboard` is undefined, so the write
      // throws before it becomes a promise.
      presentTutorial(parent, panelData());

      copyButton().click();

      await vi.waitFor(() => {
        expect(copyButton().getAttribute("data-copied")).toBe("no");
      });
      expect(copyButton().innerHTML).toBe(iconHtml("x"));
      expect(requireElement(".tutorialcopied", parent).textContent).toBe(
        "Your browser refused to copy it. Select the code and copy it yourself.",
      );
    });

    it("wears the mark long enough to be read, then is a copy button again", async () => {
      vi.useFakeTimers();
      stubClipboard(true);
      presentTutorial(parent, panelData());

      copyButton().click();
      await vi.advanceTimersByTimeAsync(0);

      expect(copyButton().getAttribute("data-copied")).toBe("yes");
      // Still there half a second on: a mark that blinks out is no report.
      await vi.advanceTimersByTimeAsync(500);
      expect(copyButton().getAttribute("data-copied")).toBe("yes");

      await waitOutTheMark();

      expect(copyButton().hasAttribute("data-copied")).toBe(false);
      expect(copyButton().innerHTML).toBe(iconHtml("copy"));
      expect(copyButton().getAttribute("aria-label")).toBe("Copy this program");
      expect(requireElement(".tutorialcopied", parent).textContent).toBe("");
    });

    it("empties the live region before each copy, so the same sentence announces twice", async () => {
      vi.useFakeTimers();
      stubClipboard(true);
      presentTutorial(parent, panelData());
      copyButton().click();
      await vi.advanceTimersByTimeAsync(0);

      copyButton().click();

      // A live region announces a change, so the second copy has to arrive as one.
      expect(requireElement(".tutorialcopied", parent).textContent).toBe("");
      await vi.advanceTimersByTimeAsync(0);
      expect(requireElement(".tutorialcopied", parent).textContent).toBe(
        "Copied to your clipboard.",
      );
      expect(copyButton().getAttribute("data-copied")).toBe("yes");
    });

    it("carries no mark into a redraw, the mark being a moment rather than a state", async () => {
      vi.useFakeTimers();
      stubClipboard(true);
      presentTutorial(parent, panelData());
      copyButton().click();
      await vi.advanceTimersByTimeAsync(0);

      presentTutorial(parent, panelData());

      expect(copyButton().hasAttribute("data-copied")).toBe(false);
      expect(copyButton().innerHTML).toBe(iconHtml("copy"));
      expect(requireElement(".tutorialcopied", parent).textContent).toBe("");
      // The redrawn button still copies: the panel wires the one it just drew.
      await waitOutTheMark();
      copyButton().click();
      await vi.advanceTimersByTimeAsync(0);
      expect(copyButton().getAttribute("data-copied")).toBe("yes");
    });

    it("says it in the language the player is reading, at the moment it says it", async () => {
      stubClipboard(true);
      presentTutorial(parent, panelData());
      setLocale("ru");

      copyButton().click();

      await vi.waitFor(() => {
        expect(copyButton().getAttribute("data-copied")).toBe("yes");
      });
      expect(copyButton().getAttribute("aria-label")).toBe("Скопировано в буфер обмена.");
      expect(requireElement(".tutorialcopied", parent).textContent).toBe(
        "Скопировано в буфер обмена.",
      );
    });
  });

  describe("the language the panel comes out in", () => {
    it("asks the catalog at the moment it draws", () => {
      // The panel takes a level index rather than words, so a relocalizing redraw
      // asks the catalog again instead of keeping stale English.
      presentTutorial(parent, panelData());
      setLocale("ru");

      presentTutorial(parent, panelData());

      expect(requireElement(".tutorialtitle", parent).textContent).toBe(
        "Лифт, который никуда не едет",
      );
      expect(requireElement(".tutorialhint summary", parent).textContent).toBe("Подсказка 1");
      expect(requireElement(".tutorialcopycode", parent).getAttribute("aria-label")).toBe(
        "Скопировать программу",
      );
    });

    it("draws this level's own answer, out of the catalog of the language it draws in", () => {
      // The comparison is against the message key, not `tutorialLevels[0].solutionCode`,
      // so a level reading its neighbor's key would fail here even though the
      // getter it drew from would happily agree with it.
      for (const locale of LOCALES) {
        setLocale(locale);

        presentTutorial(parent, panelData());

        const drawn = requireElement(".tutorialsolution code", parent).textContent;
        expect(drawn, locale).toBe(translateIn(locale, "tutorial.level1.solutionCode.code"));
        expect(uncommented(drawn), `${locale}: Cyrillic outside a comment`).not.toMatch(/[а-яё]/i);
      }
    });
  });
});

describe("tutorialTemplate", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  /** A drawn panel, with everything the test is not about left plain. */
  function panel(overrides: Partial<TutorialTemplateData> = {}): HTMLElement {
    return renderElement(
      tutorialTemplate({
        levelNumber: 1,
        title: "The elevator that goes nowhere",
        goal: "Deliver 10 passengers",
        hints: ["first", "second", "third"],
        startingCode: "s",
        solutionCode: "elevator.goToFloor(1);",
        explanation: "why it happens",
        ...overrides,
      }),
    );
  }

  it("is one region with a name, in the order a lesson is read in", () => {
    const drawn = panel();

    // A `<section>` is only a landmark when it has a name (WCAG 1.3.1).
    expect(drawn.tagName).toBe("SECTION");
    // Named after the level, not the track.
    expect(drawn.getAttribute("aria-label")).toBe("The elevator that goes nowhere");
    expect([...drawn.children].map((child) => child.className)).toEqual([
      "tutorialtitle",
      "tutorialgoal",
      "tutorialhint",
      "tutorialhint",
      "tutorialhint",
      "tutorialexplanation",
    ]);
  });

  it("escapes the program, whatever the answer turns out to contain", () => {
    // The answer is JavaScript, not catalog markup, so nothing upstream escapes
    // it. Highlighting splits the line into per-token spans, so this checks the
    // security property (every character is escaped somewhere, no tag parses
    // out) rather than one contiguous escaped run.
    const hostile = `if (a < b && c) { elevator.goToFloor("<img src=x onerror=alert(1)>"); }`;
    const html = tutorialTemplate({
      levelNumber: 1,
      title: "t",
      goal: "g",
      hints: ["one", "two", "three"],
      startingCode: "s",
      solutionCode: hostile,
      explanation: "e",
    });

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
    expect(html).toContain("&amp;&amp;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&quot;");
    const drawn = renderElement(html);
    expect(drawn.querySelector("img")).toBeNull();
    expect(drawn.querySelector(".tutorialsolution code")?.textContent).toBe(hostile);
  });

  it("escapes the level's name and its goal", () => {
    const drawn = panel({
      title: `Lift & <b>shift</b>`,
      goal: `Deliver 10 <b>passengers</b>`,
    });

    expect(drawn.querySelector("b")).toBeNull();
    expect(drawn.querySelector(".tutorialtitle")?.textContent).toBe(`Lift & <b>shift</b>`);
    expect(drawn.querySelector(".tutorialgoal")?.textContent).toBe(`Deliver 10 <b>passengers</b>`);
  });

  it("inserts the hints and the explanation as the markup they are", () => {
    // Both come from `.html` messages; escaped, the player would read the tag.
    const drawn = panel({
      hints: [`call <span class="emphasis-color">goToFloor</span>`, "second", "third"],
      explanation: `it queues <span class="emphasis-color">destinationQueue</span>`,
    });

    expect(drawn.querySelector(".tutorialhint .emphasis-color")?.textContent).toBe("goToFloor");
    expect(drawn.querySelector(".tutorialexplanation .emphasis-color")?.textContent).toBe(
      "destinationQueue",
    );
  });

  it("prints the answer under the last hint and nowhere else", () => {
    const drawn = panel();
    const hints = [...drawn.querySelectorAll(".tutorialhint")];

    expect(hints.map((hint) => hint.querySelector(".tutorialsolution") !== null)).toEqual([
      false,
      false,
      true,
    ]);
    expect(drawn.querySelectorAll(".tutorialsolution")).toHaveLength(1);
    expect(hints.map((hint) => hint.querySelector("summary")?.textContent)).toEqual([
      "Hint 1",
      "Hint 2",
      "Hint 3",
    ]);
  });

  it("draws the answer as highlighted code, with the new line marked and a way to copy it", () => {
    const drawn = panel({
      startingCode: "elevator.goToFloor(0);",
      solutionCode: "elevator.goToFloor(0);\nelevator.goToFloor(1);",
    });
    const code = drawn.querySelector(".tutorialsolution code");

    expect(code?.querySelector(".tok-propertyName")?.textContent).toBe("goToFloor");
    expect(
      [...(code?.querySelectorAll(".tok-number") ?? [])].map((token) => token.textContent),
    ).toEqual(["0", "1"]);
    const lines = [...(code?.children ?? [])];
    expect(lines.map((line) => line.tagName)).toEqual(["SPAN", "MARK"]);
    expect(lines[1]?.className).toBe("codeline tutoriallinechanged");
    expect(lines[1]?.textContent).toBe("elevator.goToFloor(1);");

    const answer = drawn.querySelector(".tutorialanswer");
    // Inside the `<pre>` and ahead of the `<code>`, so it sits in the block's
    // corner without the program it copies picking up its markup.
    const button = answer?.querySelector("pre.tutorialsolution > button.tutorialcopycode");
    expect(button).toBe(answer?.querySelector(".tutorialsolution")?.firstElementChild);
    expect(button?.getAttribute("aria-label")).toBe("Copy this program");
    expect(button?.getAttribute("type")).toBe("button");
    expect(button?.innerHTML).toBe(iconHtml("copy"));
    const status = answer?.querySelector("p.tutorialcopied");
    expect(status?.textContent).toBe("");
    expect(status?.getAttribute("aria-live")).toBe("polite");
  });

  it("marks nothing when the answer is exactly the program the player started with", () => {
    const drawn = panel({
      startingCode: "elevator.goToFloor(1);",
      solutionCode: "elevator.goToFloor(1);",
    });
    const code = drawn.querySelector(".tutorialsolution code");

    expect(code?.querySelector("mark")).toBeNull();
    expect(code?.querySelector(".tutoriallinechanged")).toBeNull();
  });

  it("leaves every disclosure closed", () => {
    expect(panel().querySelectorAll("details[open]")).toHaveLength(0);
    expect(panel().querySelectorAll("details")).toHaveLength(4);
  });

  it("writes down the index the panel was drawn for, zero-based", () => {
    // Zero-based: level number 6 is index 5.
    expect(panel({ levelNumber: 6 }).getAttribute("data-level-index")).toBe("5");
  });

  it("gives the lesson one button, and no second Start over", () => {
    const buttons = [...panel().querySelectorAll("button")];

    expect(buttons.map((button) => button.className)).toEqual(["tutorialcopycode"]);
    expect(buttons.map((button) => button.getAttribute("type"))).toEqual(["button"]);
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Copy this program",
    ]);
    // The panel's own "Start over" moved to the app bar's run controls, to avoid
    // two buttons on screen doing not quite the same thing (WCAG 3.2.4).
    expect(panel().textContent).not.toContain("Start over");
  });

  it("names the lesson and everything a player presses in it, in the language active when it is drawn", () => {
    setLocale("ru");
    const drawn = renderElement(
      tutorialTemplate({
        levelNumber: 7,
        title: "Один лифт на три этажа",
        goal: "Перевезите 20 пассажиров",
        hints: ["раз", "два", "три"],
        startingCode: "s",
        solutionCode: "elevator.goToFloor(1);",
        explanation: "почему",
      }),
    );

    expect(drawn.getAttribute("aria-label")).toBe("Один лифт на три этажа");
    expect(drawn.querySelector(".tutorialhint summary")?.textContent).toBe("Подсказка 1");
    expect(drawn.querySelector(".tutorialexplanation summary")?.textContent).toBe(
      "Почему так получается",
    );
    const button = drawn.querySelector(".tutorialcopycode");
    expect(button?.getAttribute("aria-label")).toBe("Скопировать программу");
    expect(button?.getAttribute("title")).toBe("Скопировать программу");
  });

  it("leaves the answer in the language it is written in", () => {
    setLocale("ru");
    const code = `elevator.goToFloor(1);\nelevator.goToFloor(0);`;

    expect(
      renderElement(
        tutorialTemplate({
          levelNumber: 1,
          title: "т",
          goal: "ц",
          hints: ["раз", "два", "три"],
          startingCode: "s",
          solutionCode: code,
          explanation: "п",
        }),
      ).querySelector(".tutorialsolution code")?.textContent,
    ).toBe(code);
  });
});

describe("The goal a level states", () => {
  /** Every number in a piece of text, decimals included in either notation ("37.0" or "37,0"). */
  function numbersIn(text: string): number[] {
    return [...text.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) =>
      Number(match[0].replace(",", ".")),
    );
  }

  for (const [index, level] of tutorialLevels.entries()) {
    for (const locale of LOCALES) {
      it(`is the bar ${level.id} enforces, in ${locale}`, () => {
        // Nothing else keeps the catalog's goal prose and the win condition's
        // arithmetic in agreement, so this checks that every number the
        // condition is built from appears somewhere in the sentence.
        setLocale(locale);

        presentTutorial(parent, panelData({ levelIndex: index }));

        const goal = requireElement(".tutorialgoal", parent).textContent;
        expect(numbersIn(goal)).toEqual(
          expect.arrayContaining(numbersIn(level.condition.description)),
        );
      });
    }
  }
});
