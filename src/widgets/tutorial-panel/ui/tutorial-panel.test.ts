// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { presentTutorial, tutorialTemplate } from "./tutorial-panel.ts";
import type { TutorialPanelData, TutorialTemplateData } from "./tutorial-panel.ts";
import { tutorialLevels } from "#game/tutorial.ts";
import type { TutorialLevel } from "#game/tutorial.ts";
import { DEFAULT_LOCALE, EN_MESSAGES, LOCALES, setLocale, translateIn } from "#i18n/index.ts";
import { query, queryAll, requireElement } from "#shared/lib/dom.ts";
import { renderElement } from "#shared/ui/markup.ts";

import { createElement } from "../../../ui/test-helpers.ts";

/**
 * The English catalog, indexable by a key built at run time.
 *
 * The panel cannot do this — a key has to reach `t` as a literal for its
 * parameters to be derived — but a test may, and it is the only way to state the
 * thing worth stating here: the words drawn for a level are the words belonging
 * to *that* level's id, not the ones sitting at its position.
 */
const ENGLISH: Readonly<Record<string, unknown>> = EN_MESSAGES;

/** The `.tutorial` region of the page shell, attached so focus can move in it. */
let parent: HTMLElement;

beforeEach(() => {
  parent = createElement("div", { className: "tutorial" });
  document.body.replaceChildren(parent);
});

afterEach(() => {
  setLocale(DEFAULT_LOCALE);
});

/**
 * Panel data for the first level.
 *
 * One field, so this is barely a helper — it is here so that the specs read as
 * "the panel, drawn for level 3" rather than as an object literal, and so that a
 * second field arriving later has one place to acquire a default.
 *
 * @param overrides - The fields the spec is about.
 * @returns Data for one draw of the panel.
 */
function panelData(overrides: Partial<TutorialPanelData> = {}): TutorialPanelData {
  return { levelIndex: 0, ...overrides };
}

/**
 * One of the panel's four disclosures, by the position it is drawn in.
 *
 * By position rather than by class, because position is what the presenter
 * carries the open ones across a redraw by.
 *
 * @param index - Zero-based: hints 1 to 3, then the explanation.
 * @returns The disclosure drawn there.
 */
function disclosure(index: number): HTMLDetailsElement {
  const element = queryAll(".tutorialhint, .tutorialexplanation", parent)[index];
  if (!(element instanceof HTMLDetailsElement)) {
    throw new Error(`No disclosure at position ${String(index)}`);
  }
  return element;
}

/**
 * Which disclosures are open, in the order they are drawn.
 *
 * @returns One boolean per disclosure.
 */
function openStates(): boolean[] {
  return queryAll(".tutorialhint, .tutorialexplanation", parent).map(
    (element) => element instanceof HTMLDetailsElement && element.open,
  );
}

/**
 * The English title the catalog holds for a level, found by the level's own id.
 *
 * @param id - A level's id, of the form `tutorial-3`.
 * @returns The title message, or `undefined` if the catalog has none.
 */
function englishTitle(id: string): unknown {
  return ENGLISH[`tutorial.level${id.slice("tutorial-".length)}.title`];
}

/**
 * A program with its `//` comments taken out: the half that is never translated.
 *
 * @param code - A program as the panel drew it.
 * @returns The same program without its comments.
 */
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
    expect(requireElement(".tutorialcopycode", parent).textContent).toBe("Copy this program");
  });

  it("highlights the answer and marks the line a player actually has to write", () => {
    // The wiring, not the algorithm: code-highlight.test.ts and
    // line-diff.test.ts each cover their own function on their own. This is
    // that the panel really hands them this level's own two programs rather
    // than, say, always diffing against an empty string.
    presentTutorial(parent, panelData({ levelIndex: 0 }));

    const code = requireElement(".tutorialsolution code", parent);
    const level = tutorialLevels[0];
    if (level === undefined) {
      throw new Error("The track has no first level");
    }
    expect(code.querySelectorAll("[class^='tok-']").length).toBeGreaterThan(0);
    const marked = [...code.querySelectorAll(".tutoriallinechanged")];
    expect(marked.length).toBeGreaterThan(0);
    // Whatever is marked is text the starting program does not already have --
    // the whole point of the mark.
    const startingLines = new Set(level.startingCode.split("\n"));
    for (const line of marked) {
      expect(startingLines.has(line.textContent)).toBe(false);
    }
  });

  it("says nothing about the track the level belongs to", () => {
    // The panel used to open on "Learning track / Level 3 of 8" over a row of
    // ticks and close on "5 of 8 levels done", all of it about the eight lessons
    // rather than about the one in front of the player -- and all of it a
    // restatement of what the app bar's level switcher already says. What is
    // left is the lesson, which is what a player on level 3 opened.
    presentTutorial(parent, panelData({ levelIndex: 2 }));

    expect(query(".tutorialposition", parent)).toBeNull();
    expect(query(".tutorialsteps", parent)).toBeNull();
    expect(query(".tutorialprogress", parent)).toBeNull();
    // The level's own name is the first thing in the card, with nothing above it
    // to read first.
    expect(requireElement(".tutorialpanel", parent).firstElementChild?.className).toBe(
      "tutorialtitle",
    );
  });

  it("inserts the hints as the markup they are", () => {
    // The hints are `.html` messages of this repository's own catalog, and
    // several of them mark up the identifier under discussion. Escaped, the
    // player would read the tag instead of seeing the emphasis.
    presentTutorial(parent, panelData());

    const hints = queryAll(".tutorialhint .tutorialprose", parent);
    expect(hints[1]?.innerHTML).toContain('<span class="emphasis-color">1</span>');
    expect(hints[1]?.textContent).toContain("the top floor here is 1.");
  });

  it.each(tutorialLevels.map((level, index) => [index, level] as const))(
    "draws the prose of the level at position %i",
    (index, level) => {
      // Every level on the track, so that a ninth one added without prose written
      // for it is met here rather than by a player: `presentTutorial` throws in
      // that case, and no other spec draws a level nobody thought to add one for.
      presentTutorial(parent, panelData({ levelIndex: index }));

      // Found by the level's id and not by its position, which is the whole point
      // of keying the panel's table by id: a level inserted into the middle of
      // the track must take its own words with it rather than inherit the ones
      // that were drawn in that place before.
      expect(requireElement(".tutorialtitle", parent).textContent).toBe(englishTitle(level.id));
      expect(requireElement(".tutorialgoal", parent).textContent).not.toBe("");
      const hints = queryAll(".tutorialhint .tutorialprose", parent);
      expect(hints).toHaveLength(3);
      for (const hint of hints) {
        expect(hint.textContent).not.toBe("");
      }
      expect(requireElement(".tutorialexplanation .tutorialprose", parent).textContent).not.toBe(
        "",
      );
      expect(requireElement(".tutorialpanel", parent).getAttribute("data-level-index")).toBe(
        String(index),
      );
      // The answer is the program `tutorial-solutions.test.ts` clears the level
      // with, not a copy of it, and it survives being escaped and parsed again.
      expect(requireElement(".tutorialsolution code", parent).textContent).toBe(level.solutionCode);
    },
  );

  it("prints the answer under the last hint and nowhere else", () => {
    // The three hints run from a nudge to the answer, and a panel that put the
    // program under the first would spend the whole lesson on one click.
    presentTutorial(parent, panelData({ levelIndex: 3 }));

    expect(
      queryAll(".tutorialhint", parent).map((hint) => query(".tutorialsolution", hint) !== null),
    ).toEqual([false, false, true]);
    expect(queryAll(".tutorialsolution", parent)).toHaveLength(1);
  });

  it("refuses an index the track has no level at", () => {
    // Worded the way `App.startTutorial` words its own refusal, for the same
    // reason: an index the router cannot produce is an index a caller made up,
    // and drawing level 1 for it would tell the player they are somewhere else.
    expect(() => {
      presentTutorial(parent, panelData({ levelIndex: tutorialLevels.length }));
    }).toThrow(RangeError);
    expect(() => {
      presentTutorial(parent, panelData({ levelIndex: -1 }));
    }).toThrow("No tutorial level with index -1");
  });

  it("refuses a level the catalog has no prose for", () => {
    // The direction the compiler cannot cover: `tutorialLevels` is an array and
    // its length is not part of its type, so a ninth level appended with no
    // messages written for it compiles. It has to fail loudly here, because the
    // alternative is a panel of chrome with no words in it.
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
    // Both refusals happen before anything is drawn, so a caller that asks for a
    // level that is not there does not also empty the region on its way out.
    presentTutorial(parent, panelData({ levelIndex: 1 }));

    expect(() => {
      presentTutorial(parent, panelData({ levelIndex: tutorialLevels.length }));
    }).toThrow(RangeError);
    expect(requireElement(".tutorialpanel", parent).getAttribute("data-level-index")).toBe("1");
  });

  describe("the hints a player has opened", () => {
    it("keeps them open across a redraw of the same level", () => {
      // A redraw of the same level is the language changing or the run starting
      // again. Closing the hint somebody is reading, in order to tell them the
      // same thing in another language, is the panel undoing the player's work.
      presentTutorial(parent, panelData({ levelIndex: 2 }));
      disclosure(1).open = true;
      disclosure(3).open = true;

      presentTutorial(parent, panelData({ levelIndex: 2 }));

      expect(openStates()).toEqual([false, true, false, true]);
    });

    it("closes them all when the next level is drawn", () => {
      // Hint 3 is the answer. Carried open into the next level it would hand out
      // that level's answer before its goal had been read.
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
      // The panel keeps no state in a variable, so this attribute is the only
      // place the number survives the redraw that reads it.
      presentTutorial(parent, panelData({ levelIndex: 5 }));

      expect(requireElement(".tutorialpanel", parent).getAttribute("data-level-index")).toBe("5");
    });
  });

  describe("focus", () => {
    it("puts it back on the summary a redraw destroyed", () => {
      // A `<summary>` is in the tab order without a `tabindex`, so a player can
      // be standing on hint 2 when the language changes under them.
      presentTutorial(parent, panelData());
      queryAll(".tutorialpanel summary", parent)[1]?.focus();

      presentTutorial(parent, panelData());

      expect(document.activeElement).toBe(queryAll(".tutorialpanel summary", parent)[1]);
    });

    it("puts it back on the copy button a redraw destroyed", () => {
      // Starting the run again redraws this panel, and that deletes whichever
      // control was under the player's finger. Focus would fall back to the
      // document, dropping a keyboard player at the top of the page and leaving
      // them the whole of it to tab through again (WCAG 2.4.3).
      presentTutorial(parent, panelData());
      const pressed = requireElement(".tutorialcopycode", parent);
      pressed.focus();

      presentTutorial(parent, panelData());

      const redrawn = requireElement(".tutorialcopycode", parent);
      expect(redrawn).not.toBe(pressed);
      expect(document.activeElement).toBe(redrawn);
    });

    it("restores by position, so a change of level lands in the same place", () => {
      // Every level draws the same five controls in the same order -- three hint
      // summaries, the copy button the last of them holds, then the
      // explanation's -- which is what makes the position the control.
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
      // Ctrl-Enter in the editor starts the level again, which redraws this
      // panel. Yanking the focus out of the editor every time would be worse
      // than the bug the restoration fixes.
      presentTutorial(parent, panelData());
      const elsewhere = createElement("textarea");
      document.body.append(elsewhere);
      elsewhere.focus();

      presentTutorial(parent, panelData());

      expect(document.activeElement).toBe(elsewhere);
    });
  });

  describe("what the panel says about copying the answer", () => {
    afterEach(() => {
      // jsdom implements no Clipboard API at all, so the property only exists
      // in a spec that put it there; nothing to restore otherwise, but a spec
      // that stubbed it must not leave `navigator.clipboard` behind for the
      // next one to find.
      Reflect.deleteProperty(navigator, "clipboard");
    });

    /**
     * Stands in for `navigator.clipboard.writeText`.
     *
     * jsdom has no Clipboard API at all — there is no default implementation to
     * spy on the way `editor.test.ts` spies on `localStorage.setItem` — so the
     * whole object has to be put on `navigator` before a spec can drive either
     * of the two outcomes `copySolution` is written to handle.
     *
     * @param resolved - Whether the write should resolve, the way a browser
     * does when it grants the permission, or reject, the way it does when it
     * refuses.
     * @returns The mock, so a spec can see what it was asked to copy.
     */
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

    it("is a live region that is already there, and empty, before there is news", () => {
      presentTutorial(parent, panelData());

      const line = requireElement(".tutorialcopied", parent);
      expect(line.getAttribute("aria-live")).toBe("polite");
      expect(line.textContent).toBe("");
    });

    it("copies the program exactly as it is shown, and says so", async () => {
      const writeText = stubClipboard(true);
      presentTutorial(parent, panelData());
      const code = requireElement(".tutorialsolution code", parent).textContent;

      requireElement(".tutorialcopycode", parent).click();

      await vi.waitFor(() => {
        expect(requireElement(".tutorialcopied", parent).textContent).not.toBe("");
      });
      expect(writeText).toHaveBeenCalledWith(code);
      expect(requireElement(".tutorialcopied", parent).textContent).toBe(
        "Copied to your clipboard.",
      );
    });

    it("says the browser refused, and what to do instead", async () => {
      stubClipboard(false);
      presentTutorial(parent, panelData());

      requireElement(".tutorialcopycode", parent).click();

      await vi.waitFor(() => {
        expect(requireElement(".tutorialcopied", parent).textContent).not.toBe("");
      });
      expect(requireElement(".tutorialcopied", parent).textContent).toBe(
        "Your browser refused to copy it. Select the code above and copy it yourself.",
      );
    });

    it("says the browser refused when there is no clipboard to write to at all", async () => {
      // No stub at all: jsdom's own `navigator.clipboard` is undefined, the way
      // an insecure context leaves it, so the write throws before it ever
      // becomes a promise -- the one case `copySolution`'s `catch` exists for.
      presentTutorial(parent, panelData());

      requireElement(".tutorialcopycode", parent).click();

      await vi.waitFor(() => {
        expect(requireElement(".tutorialcopied", parent).textContent).not.toBe("");
      });
      expect(requireElement(".tutorialcopied", parent).textContent).toBe(
        "Your browser refused to copy it. Select the code above and copy it yourself.",
      );
    });

    it("keeps the news across a redraw of the same level", async () => {
      stubClipboard(true);
      presentTutorial(parent, panelData());
      requireElement(".tutorialcopycode", parent).click();
      await vi.waitFor(() => {
        expect(requireElement(".tutorialcopied", parent).textContent).not.toBe("");
      });

      presentTutorial(parent, panelData());

      expect(requireElement(".tutorialcopied", parent).textContent).toBe(
        "Copied to your clipboard.",
      );
    });

    it("drops the news when the panel moves to another level", async () => {
      stubClipboard(true);
      presentTutorial(parent, panelData());
      requireElement(".tutorialcopycode", parent).click();
      await vi.waitFor(() => {
        expect(requireElement(".tutorialcopied", parent).textContent).not.toBe("");
      });

      presentTutorial(parent, panelData({ levelIndex: 1 }));

      expect(requireElement(".tutorialcopied", parent).textContent).toBe("");
    });

    it("says it in the language the player is reading, at the moment it says it", async () => {
      stubClipboard(true);
      presentTutorial(parent, panelData());
      setLocale("ru");

      requireElement(".tutorialcopycode", parent).click();

      await vi.waitFor(() => {
        expect(requireElement(".tutorialcopied", parent).textContent).not.toBe("");
      });
      expect(requireElement(".tutorialcopied", parent).textContent).toBe(
        "Скопировано в буфер обмена.",
      );
    });
  });

  describe("the language the panel comes out in", () => {
    it("asks the catalog at the moment it draws", () => {
      // The panel is handed a level index rather than the words to print, and
      // this is the whole reason: `App.relocalise` draws it again, and a panel
      // that had kept the sentences it was given the first time would be the one
      // block of the page still in English.
      presentTutorial(parent, panelData());
      setLocale("ru");

      presentTutorial(parent, panelData());

      expect(requireElement(".tutorialtitle", parent).textContent).toBe(
        "Лифт, который никуда не едет",
      );
      expect(requireElement(".tutorialhint summary", parent).textContent).toBe("Подсказка 1");
      expect(requireElement(".tutorialcopycode", parent).textContent).toBe("Скопировать программу");
    });

    it("draws this level's own answer, out of the catalog of the language it draws in", () => {
      // The answer is a message like everything else here, but a `.code` one:
      // only the `//` comments in it are ever translated and the JavaScript is
      // byte-identical in every locale, which `src/i18n/catalog.test.ts`
      // holds. So what the panel draws is the same program in either language,
      // with at most different comments — and since no answer on the track
      // carries a comment today, the two languages are the same bytes. Which
      // language the panel drew from therefore cannot be read off the answer at
      // all, and nothing below pretends it can. The starting programs are where
      // the difference is visible: each carries a comment, so
      // `tutorial.level1.startingCode.code` really is two different strings. The
      // day an answer gains one, the assertion below starts carrying that half
      // of the sentence by itself, with nothing here to change.
      //
      // What it does say today is which message was drawn. Comparing the drawn
      // text with `tutorialLevels[0].solutionCode` — which this spec used to do —
      // reaches the getter the panel reached and moves with it, so it holds the
      // panel to the table and says nothing about the table holding the wrong
      // key. That is a mistake worth being able to fail on: the table reaches
      // its programs through keys written out by hand, and a level reading its
      // neighbour's would show the neighbour's answer here without anything
      // throwing. Naming the message and the locale outright makes this the
      // panel's own statement.
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

  /**
   * A drawn panel, with everything the test is not about left plain.
   *
   * The words are the test's own rather than the catalog's: what this template
   * decides is where a string goes and whether it is escaped on the way, and a
   * fixture made of real prose would hide both behind a paragraph of Russian.
   *
   * @param overrides - The fields the test is about.
   * @returns The rendered panel.
   */
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

    // A `<section>` is only a landmark when it has a name, and the name is what
    // lets a screen-reader player jump over the panel to the building or back
    // to it for the next hint (WCAG 1.3.1).
    expect(drawn.tagName).toBe("SECTION");
    // Named after the level rather than after the track: the words announced on
    // the way into the landmark are the words at the top of the card, and they
    // say which lesson this is rather than which of eight it is.
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
    // The one string here that is neither text the catalog wrote nor markup
    // it wrote: it is JavaScript, and the parser has opinions about two of its
    // characters. Today's eight answers hold one `<`, followed by a space, and
    // no `&` at all -- so nothing on the track would notice this being dropped,
    // and the ninth answer written with a `<` before a letter would lose the
    // rest of its line into a tag nobody can see.
    //
    // The answer is highlighted now, which wraps each token of the line in its
    // own `<span>` -- so "if (a &lt; b ..." is no longer one contiguous run of
    // escaped text the way it was before highlighting existed; code-highlight.ts
    // has its own tests for exactly how it is split. What has to hold here is
    // the security property, not the exact bytes it is spread across: every
    // character `escapeHtml` would have escaped is escaped somewhere, no tag
    // parses out of the program, and the element's text reads the hostile
    // program back whole.
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
    // The string literal is one token, so its escaped text is still one
    // contiguous run.
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&quot;");
    const drawn = renderElement(html);
    expect(drawn.querySelector("img")).toBeNull();
    // Escaped on the way in and read back whole: the player is shown the program
    // that clears the level, character for character.
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
    // Both come from this repository's own `.html` messages, and they mark up
    // the identifier under discussion. Escaped, the player would read the tag.
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
    // The hints run from a nudge to the answer, and the program under the first
    // of them would spend the whole lesson on one click.
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
    // startingCode is never printed -- it exists only to be diffed against
    // solutionCode, which is what code-highlight.ts and line-diff.ts each have
    // their own tests for. This is the wiring: that the two actually reach
    // tutorialAnswerTemplate and come out as markup a player can read.
    const drawn = panel({
      startingCode: "elevator.goToFloor(0);",
      solutionCode: "elevator.goToFloor(0);\nelevator.goToFloor(1);",
    });
    const code = drawn.querySelector(".tutorialsolution code");

    // Real syntax highlighting, not plain text.
    expect(code?.querySelector(".tok-propertyName")?.textContent).toBe("goToFloor");
    expect(
      [...(code?.querySelectorAll(".tok-number") ?? [])].map((token) => token.textContent),
    ).toEqual(["0", "1"]);
    // One element per line, and only the new line is a <mark>.
    const lines = [...(code?.children ?? [])];
    expect(lines.map((line) => line.tagName)).toEqual(["SPAN", "MARK"]);
    expect(lines[1]?.className).toBe("tutoriallinechanged");
    expect(lines[1]?.textContent).toBe("elevator.goToFloor(1);");

    // The copy button and its live status line sit above the code, inside the
    // same answer block.
    const answer = drawn.querySelector(".tutorialanswer");
    const button = answer?.querySelector("button.tutorialcopycode");
    expect(button?.textContent).toBe("Copy this program");
    expect(button?.getAttribute("type")).toBe("button");
    const status = answer?.querySelector("p.tutorialcopied");
    expect(status?.textContent).toBe("");
    expect(status?.getAttribute("aria-live")).toBe("polite");
  });

  it("marks nothing when the answer is exactly the program the player started with", () => {
    // Level 8 is exactly this case on the real track: it hands back level 7's own
    // answer, unchanged, and there is nothing here for a player to be told they
    // still have to write.
    const drawn = panel({
      startingCode: "elevator.goToFloor(1);",
      solutionCode: "elevator.goToFloor(1);",
    });
    const code = drawn.querySelector(".tutorialsolution code");

    expect(code?.querySelector("mark")).toBeNull();
    expect(code?.querySelector(".tutoriallinechanged")).toBeNull();
  });

  it("leaves every disclosure closed", () => {
    // A level whose answer is on screen before the goal has been read is not a
    // level, and `<details>` opens for good once it is written open.
    expect(panel().querySelectorAll("details[open]")).toHaveLength(0);
    expect(panel().querySelectorAll("details")).toHaveLength(4);
  });

  it("writes down the index the panel was drawn for, zero-based", () => {
    // Read back by the presenter after `replaceChildren` has thrown the old
    // panel away, to decide whether the hints the player opened may stay open.
    // Zero-based, because that is the number the presenter was called with.
    expect(panel({ levelNumber: 6 }).getAttribute("data-level-index")).toBe("5");
  });

  it("gives the lesson one button, and no second Start over", () => {
    const buttons = [...panel().querySelectorAll("button")];

    // One control on the card, and it acts on the answer beside it. The pair
    // that used to end the lesson -- taking the program into the editor, and
    // leaving for the game's levels -- went with the head row and the footnote:
    // a lesson is about the level in front of the player, and the ways out of it
    // are the app bar's level switcher's business.
    expect(buttons.map((button) => button.className)).toEqual(["tutorialcopycode"]);
    expect(buttons.map((button) => button.getAttribute("type"))).toEqual(["button"]);
    expect(buttons.map((button) => button.textContent)).toEqual(["Copy this program"]);
    // The panel had its own "Start over" until the run buttons were gathered
    // into `controlsTemplate`, which the app bar draws above it. Two buttons on
    // screen together under one accessible name, doing not quite the same thing,
    // is WCAG 3.2.4; the one that went is the one only the track had.
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

    // The landmark's name is the level's own title, so it is translated by
    // whoever hands the title in -- and a region announced in English inside a
    // Russian page is the one thing a screen-reader player cannot see is out of
    // place. Everything the panel words itself is asked of the catalog here,
    // at the moment of drawing.
    expect(drawn.getAttribute("aria-label")).toBe("Один лифт на три этажа");
    expect(drawn.querySelector(".tutorialhint summary")?.textContent).toBe("Подсказка 1");
    expect(drawn.querySelector(".tutorialexplanation summary")?.textContent).toBe(
      "Почему так получается",
    );
    expect(drawn.querySelector(".tutorialcopycode")?.textContent).toBe("Скопировать программу");
  });

  it("leaves the answer in the language it is written in", () => {
    // The program is JavaScript in every locale, and it is the string the level
    // table holds rather than anything the catalog says.
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
  /**
   * Every number in a piece of text, as a number.
   *
   * Decimals included, in either notation: the wait limit is rendered through
   * `decimal(…, 1)`, so a bar of 37 seconds reads "37.0" in English and "37,0"
   * in Russian, and both mean the same thing as the "37" the goal sentence
   * writes.
   *
   * @param text - Any rendered sentence.
   * @returns The numbers it contains, in the order they appear.
   */
  function numbersIn(text: string): number[] {
    return [...text.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) =>
      Number(match[0].replace(",", ".")),
    );
  }

  for (const [index, level] of tutorialLevels.entries()) {
    for (const locale of LOCALES) {
      it(`is the bar ${level.id} enforces, in ${locale}`, () => {
        // The goal is prose in a catalog and the bar is arithmetic in
        // `src/game/tutorial.ts`, and nothing made the two agree: a goal saying
        // "deliver 40 passengers and let nobody wait longer than 3 seconds" for
        // a level requiring 15 and 37 left the whole suite green, and the player
        // reading it would have been sent to fail at something the game was not
        // asking for. The numbers are what can be checked without restating the
        // sentence here -- word it however it should be worded, but every
        // number the condition is built from has to be in it.
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
