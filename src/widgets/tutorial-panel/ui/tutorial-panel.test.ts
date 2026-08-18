// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { presentTutorial } from "./tutorial-panel.ts";
import type { TutorialPanelData } from "./tutorial-panel.ts";
import { tutorialTasks } from "#game/tutorial.ts";
import type { TutorialTask } from "#game/tutorial.ts";
import { DEFAULT_LOCALE, EN_MESSAGES, LOCALES, setLocale, translateIn } from "#i18n/index.ts";
import { query, queryAll, requireElement } from "#shared/lib/dom.ts";

import { createElement } from "../../../ui/test-helpers.ts";

/**
 * The English catalogue, indexable by a key built at run time.
 *
 * The panel cannot do this — a key has to reach `t` as a literal for its
 * parameters to be derived — but a test may, and it is the only way to state the
 * thing worth stating here: the words drawn for a task are the words belonging
 * to *that* task's id, not the ones sitting at its position.
 */
const ENGLISH: Readonly<Record<string, unknown>> = EN_MESSAGES;

/** The `.tutorial` region of the page shell, attached so focus can move in it. */
let parent: HTMLElement;

beforeEach(() => {
  parent = createElement("div", { className: "tutorial" });
  document.body.replaceChildren(parent);
});

afterEach(() => {
  // A spy outlives the spec that installed it, and `window.confirm` is only
  // spied on by the specs about taking a program. jsdom's own implementation
  // never answers `true`, so a spy left behind saying it does would quietly
  // change what a later spec measures.
  vi.restoreAllMocks();
  setLocale(DEFAULT_LOCALE);
});

/**
 * Panel data for the first task, with nothing to lose in the editor.
 *
 * `hasOwnProgram` answers `false` by default, which keeps the confirmation out
 * of the way of every spec that is not about it: an empty editor is the state in
 * which taking a program simply happens. `onTakeCode` answers `true` for the
 * same reason — a store that accepts the write is the ordinary case, and it is
 * what the panel's confirmation line is drawn from.
 *
 * @param overrides - The fields the spec is about.
 * @returns Data for one draw of the panel.
 */
function panelData(overrides: Partial<TutorialPanelData> = {}): TutorialPanelData {
  return {
    taskIndex: 0,
    clearedCount: 0,
    hasOwnProgram: () => false,
    onTakeCode: vi.fn(() => true),
    onLeave: vi.fn(),
    ...overrides,
  };
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
 * The English title the catalogue holds for a task, found by the task's own id.
 *
 * @param id - A task's id, of the form `tutorial-3`.
 * @returns The title message, or `undefined` if the catalogue has none.
 */
function englishTitle(id: string): unknown {
  return ENGLISH[`tutorial.task${id.slice("tutorial-".length)}.title`];
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
  it("draws the task, its goal, its hints and the way out", () => {
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
    expect(requireElement(".tutorialtakecode", parent).textContent).toBe(
      "Take this program into your own editor",
    );
    expect(requireElement(".tutorialleave", parent).textContent).toBe("Leave for the challenges");
    expect(requireElement(".tutorialcopycode", parent).textContent).toBe("Copy this program");
  });

  it("highlights the answer and marks the line a player actually has to write", () => {
    // The wiring, not the algorithm: code-highlight.test.ts and
    // line-diff.test.ts each cover their own function on their own. This is
    // that the panel really hands them this task's own two programs rather
    // than, say, always diffing against an empty string.
    presentTutorial(parent, panelData({ taskIndex: 0 }));

    const code = requireElement(".tutorialsolution code", parent);
    const task = tutorialTasks[0];
    if (task === undefined) {
      throw new Error("The track has no first task");
    }
    expect(code.querySelectorAll("[class^='tok-']").length).toBeGreaterThan(0);
    const marked = [...code.querySelectorAll(".tutoriallinechanged")];
    expect(marked.length).toBeGreaterThan(0);
    // Whatever is marked is text the starting program does not already have --
    // the whole point of the mark.
    const startingLines = new Set(task.startingCode.split("\n"));
    for (const line of marked) {
      expect(startingLines.has(line.textContent)).toBe(false);
    }
  });

  it("says where on the track the player is, and how much of the track is done", () => {
    // Two numbers about two different things. The position is where this task
    // sits; the progress is what this browser has ever cleared. A player who
    // starts task 1 again after clearing five is not back to having cleared one.
    presentTutorial(parent, panelData({ taskIndex: 2, clearedCount: 5 }));

    const count = String(tutorialTasks.length);
    expect(requireElement(".tutorialposition", parent).textContent).toBe(
      `Learning track Task 3 of ${count}`,
    );
    expect(requireElement(".tutorialprogress", parent).textContent).toBe(
      `5 of ${count} tasks done`,
    );
  });

  it("inserts the hints as the markup they are", () => {
    // The hints are `.html` messages of this repository's own catalogue, and
    // several of them mark up the identifier under discussion. Escaped, the
    // player would read the tag instead of seeing the emphasis.
    presentTutorial(parent, panelData());

    const hints = queryAll(".tutorialhint .tutorialprose", parent);
    expect(hints[1]?.innerHTML).toContain('<span class="emphasis-color">1</span>');
    expect(hints[1]?.textContent).toContain("the top floor here is 1.");
  });

  it.each(tutorialTasks.map((task, index) => [index, task] as const))(
    "draws the prose of the task at position %i",
    (index, task) => {
      // Every task on the track, so that a ninth one added without prose written
      // for it is met here rather than by a player: `presentTutorial` throws in
      // that case, and no other spec draws a task nobody thought to add one for.
      presentTutorial(parent, panelData({ taskIndex: index }));

      // Found by the task's id and not by its position, which is the whole point
      // of keying the panel's table by id: a task inserted into the middle of
      // the track must take its own words with it rather than inherit the ones
      // that were drawn in that place before.
      expect(requireElement(".tutorialtitle", parent).textContent).toBe(englishTitle(task.id));
      expect(requireElement(".tutorialgoal", parent).textContent).not.toBe("");
      const hints = queryAll(".tutorialhint .tutorialprose", parent);
      expect(hints).toHaveLength(3);
      for (const hint of hints) {
        expect(hint.textContent).not.toBe("");
      }
      expect(requireElement(".tutorialexplanation .tutorialprose", parent).textContent).not.toBe(
        "",
      );
      expect(requireElement(".tutorialposition", parent).textContent).toContain(
        `Task ${String(index + 1)} of`,
      );
      // The answer is the program `tutorial-solutions.test.ts` clears the task
      // with, not a copy of it, and it survives being escaped and parsed again.
      expect(requireElement(".tutorialsolution code", parent).textContent).toBe(task.solutionCode);
    },
  );

  it("prints the answer under the last hint and nowhere else", () => {
    // The three hints run from a nudge to the answer, and a panel that put the
    // program under the first would spend the whole lesson on one click.
    presentTutorial(parent, panelData({ taskIndex: 3 }));

    expect(
      queryAll(".tutorialhint", parent).map((hint) => query(".tutorialsolution", hint) !== null),
    ).toEqual([false, false, true]);
    expect(queryAll(".tutorialsolution", parent)).toHaveLength(1);
  });

  it("refuses an index the track has no task at", () => {
    // Worded the way `App.startTutorial` words its own refusal, for the same
    // reason: an index the router cannot produce is an index a caller made up,
    // and drawing task 1 for it would tell the player they are somewhere else.
    expect(() => {
      presentTutorial(parent, panelData({ taskIndex: tutorialTasks.length }));
    }).toThrow(RangeError);
    expect(() => {
      presentTutorial(parent, panelData({ taskIndex: -1 }));
    }).toThrow("No tutorial task with index -1");
  });

  it("refuses a task the catalogue has no prose for", () => {
    // The direction the compiler cannot cover: `tutorialTasks` is an array and
    // its length is not part of its type, so a ninth task appended with no
    // messages written for it compiles. It has to fail loudly here, because the
    // alternative is a panel of chrome with no words in it.
    const [first] = tutorialTasks;
    if (first === undefined) {
      throw new Error("The track has no tasks at all");
    }
    const track = tutorialTasks as TutorialTask[];
    track.push({ ...first, id: "tutorial-9" });

    try {
      expect(() => {
        presentTutorial(parent, panelData({ taskIndex: track.length - 1 }));
      }).toThrow("No panel prose for tutorial task tutorial-9");
    } finally {
      track.pop();
    }
  });

  it("leaves the panel already on screen alone when it refuses", () => {
    // Both refusals happen before anything is drawn, so a caller that asks for a
    // task that is not there does not also empty the region on its way out.
    presentTutorial(parent, panelData({ taskIndex: 1 }));

    expect(() => {
      presentTutorial(parent, panelData({ taskIndex: tutorialTasks.length }));
    }).toThrow(RangeError);
    expect(requireElement(".tutorialposition", parent).textContent).toContain("Task 2 of");
  });

  describe("the hints a player has opened", () => {
    it("keeps them open across a redraw of the same task", () => {
      // A redraw of the same task is the language changing or the run starting
      // again. Closing the hint somebody is reading, in order to tell them the
      // same thing in another language, is the panel undoing the player's work.
      presentTutorial(parent, panelData({ taskIndex: 2 }));
      disclosure(1).open = true;
      disclosure(3).open = true;

      presentTutorial(parent, panelData({ taskIndex: 2 }));

      expect(openStates()).toEqual([false, true, false, true]);
    });

    it("closes them all when the next task is drawn", () => {
      // Hint 3 is the answer. Carried open into the next task it would hand out
      // that task's answer before its goal had been read.
      presentTutorial(parent, panelData({ taskIndex: 2 }));
      disclosure(2).open = true;

      presentTutorial(parent, panelData({ taskIndex: 3 }));

      expect(openStates()).toEqual([false, false, false, false]);
    });

    it("starts every task closed", () => {
      presentTutorial(parent, panelData({ taskIndex: 4 }));

      expect(openStates()).toEqual([false, false, false, false]);
    });

    it("records the task the panel was drawn for, which is what decides the two", () => {
      // The panel keeps no state in a variable, so this attribute is the only
      // place the number survives the redraw that reads it.
      presentTutorial(parent, panelData({ taskIndex: 5 }));

      expect(requireElement(".tutorialpanel", parent).getAttribute("data-task-index")).toBe("5");
    });
  });

  describe("focus", () => {
    it("puts it back on the button a redraw destroyed", () => {
      // Clearing the task redraws this panel to move its progress line on, and
      // that deletes whichever button was under the player's finger. Focus would
      // fall back to the document, dropping a keyboard player at the top of the
      // page and leaving them the whole of it to tab through again (WCAG 2.4.3).
      presentTutorial(parent, panelData());
      const pressed = requireElement(".tutorialtakecode", parent);
      pressed.focus();

      presentTutorial(parent, panelData());

      const redrawn = requireElement(".tutorialtakecode", parent);
      expect(redrawn).not.toBe(pressed);
      expect(document.activeElement).toBe(redrawn);
    });

    it("puts it back on the summary a redraw destroyed", () => {
      // A `<summary>` is in the tab order without a `tabindex`, so a player can
      // be standing on hint 2 when the language changes under them.
      presentTutorial(parent, panelData());
      queryAll(".tutorialpanel summary", parent)[1]?.focus();

      presentTutorial(parent, panelData());

      expect(document.activeElement).toBe(queryAll(".tutorialpanel summary", parent)[1]);
    });

    it("puts it back on the copy button a redraw destroyed", () => {
      presentTutorial(parent, panelData());
      requireElement(".tutorialcopycode", parent).focus();

      presentTutorial(parent, panelData());

      expect(document.activeElement).toBe(requireElement(".tutorialcopycode", parent));
    });

    it("restores by position, so a change of task lands in the same place", () => {
      // Every task draws the same seven controls in the same order, which is
      // what makes the position the control.
      presentTutorial(parent, panelData({ taskIndex: 0 }));
      requireElement(".tutorialleave", parent).focus();

      presentTutorial(parent, panelData({ taskIndex: 1 }));

      expect(document.activeElement).toBe(requireElement(".tutorialleave", parent));
    });

    it("does not take it on the first draw", () => {
      presentTutorial(parent, panelData());

      expect(document.activeElement).toBe(document.body);
    });

    it("leaves it alone when the redraw came from somewhere else", () => {
      // Ctrl-Enter in the editor starts the task again, which redraws this
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

  describe("the two buttons", () => {
    it("reports a press of the one that cannot destroy anything", () => {
      const data = panelData();
      presentTutorial(parent, data);

      requireElement(".tutorialleave", parent).click();

      expect(data.onLeave).toHaveBeenCalledTimes(1);
      expect(data.onTakeCode).not.toHaveBeenCalled();
    });

    it("takes the program without a question when there is nothing to lose", () => {
      // A confirmation with no cost behind it is the kind players learn to
      // dismiss without reading, and the one time it matters is the time they
      // dismiss it without reading.
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
      const data = panelData({ hasOwnProgram: () => false });
      presentTutorial(parent, data);

      requireElement(".tutorialtakecode", parent).click();

      expect(confirm).not.toHaveBeenCalled();
      expect(data.onTakeCode).toHaveBeenCalledTimes(1);
    });

    it("asks before overwriting a program the player wrote", () => {
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
      const data = panelData({ hasOwnProgram: () => true });
      presentTutorial(parent, data);

      requireElement(".tutorialtakecode", parent).click();

      expect(confirm).toHaveBeenCalledWith(
        "The game editor already holds a program of yours. Replace it with this one?",
      );
      expect(data.onTakeCode).toHaveBeenCalledTimes(1);
    });

    it("does nothing at all when that question is refused", () => {
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
      const data = panelData({ hasOwnProgram: () => true });
      presentTutorial(parent, data);

      requireElement(".tutorialtakecode", parent).click();

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(data.onTakeCode).not.toHaveBeenCalled();
    });

    it("asks whether there is anything to lose when the button is pressed, not when the panel is drawn", () => {
      // A player who writes their first program while on task 5 would otherwise
      // be measured against the empty editor the panel was drawn over, and have
      // that program taken away without a word.
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
      let wroteSomething = false;
      const data = panelData({ hasOwnProgram: () => wroteSomething });
      presentTutorial(parent, data);
      wroteSomething = true;

      requireElement(".tutorialtakecode", parent).click();

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(data.onTakeCode).not.toHaveBeenCalled();
    });

    it("belongs to the panel on screen and not to the one it replaced", () => {
      // The panel is replaced wholesale rather than patched, so no handler can
      // be bound twice and the callbacks of the previous draw cannot be reached
      // at all.
      const first = panelData();
      presentTutorial(parent, first);
      const second = panelData();
      presentTutorial(parent, second);

      requireElement(".tutorialleave", parent).click();

      expect(first.onLeave).not.toHaveBeenCalled();
      expect(second.onLeave).toHaveBeenCalledTimes(1);
    });
  });

  describe("what the panel says about taking the program", () => {
    it("is a live region that is already there, and empty, before there is news", () => {
      // Both halves are the point. A screen reader that first meets a live
      // region at the moment it is inserted with text already in it generally
      // says nothing, so the element has to be drawn empty and written to later
      // -- and an element drawn with a sentence in it would be a panel claiming
      // a program was taken before anybody pressed the button.
      presentTutorial(parent, panelData());

      const line = requireElement(".tutorialtaken", parent);
      expect(line.getAttribute("aria-live")).toBe("polite");
      expect(line.textContent).toBe("");
    });

    it("says the program was taken, into the region a screen reader is watching", () => {
      // The write goes to a buffer that is not on screen from the track, so this
      // line is the only evidence the player gets that the button did anything.
      //
      // The element is held from before the click, because *which* node the
      // sentence lands in is the whole design: a handler that built a new
      // paragraph and swapped it in would read the same from the outside and
      // would announce nothing at all, the live region having been met by the
      // screen reader with its text already in it.
      const data = panelData();
      presentTutorial(parent, data);
      const line = requireElement(".tutorialtaken", parent);

      requireElement(".tutorialtakecode", parent).click();

      expect(line.textContent).toBe(
        "Copied into the game editor, waiting when you leave the track.",
      );
      expect(line.isConnected).toBe(true);
      expect(requireElement(".tutorialtaken", parent)).toBe(line);
    });

    it("says the store refused rather than letting the player believe it worked", () => {
      // Answering `false` is a store that took the write and threw: a quota that
      // is full, or the private-browsing mode that accepts a `Storage` object
      // and refuses every write to it. The old panel said the same nothing to
      // that as it did to success, and the player walked away believing their
      // program was waiting for them.
      const data = panelData({ onTakeCode: vi.fn(() => false) });
      presentTutorial(parent, data);

      requireElement(".tutorialtakecode", parent).click();

      expect(requireElement(".tutorialtaken", parent).textContent).toBe(
        "Your browser refused to store it. Copy the program out of the editor by hand to keep it.",
      );
    });

    it("stays quiet when the player answered the question with no", () => {
      // The one case that needs no line: they were asked about this in a dialog
      // and dismissed it themselves, so nothing happened that they do not know.
      vi.spyOn(window, "confirm").mockReturnValue(false);
      presentTutorial(parent, panelData({ hasOwnProgram: () => true }));

      requireElement(".tutorialtakecode", parent).click();

      expect(requireElement(".tutorialtaken", parent).textContent).toBe("");
    });

    it("keeps the news across a redraw of the same task", () => {
      // Carried like the open hints beside it. The redraw that made this
      // necessary is the task being cleared: the panel is drawn again to move
      // its counter on, and the confirmation the player had just been given
      // would otherwise vanish under the overlay congratulating them.
      presentTutorial(parent, panelData());
      requireElement(".tutorialtakecode", parent).click();

      presentTutorial(parent, panelData({ clearedCount: 1 }));

      expect(requireElement(".tutorialtaken", parent).textContent).toBe(
        "Copied into the game editor, waiting when you leave the track.",
      );
    });

    it("keeps a refusal across that redraw too, not only good news", () => {
      // The half a player most needs to still be able to read: the program is
      // not waiting for them anywhere, and the line is where it says so.
      const refusing = { onTakeCode: vi.fn(() => false) };
      presentTutorial(parent, panelData(refusing));
      requireElement(".tutorialtakecode", parent).click();

      presentTutorial(parent, panelData({ ...refusing, clearedCount: 1 }));

      expect(requireElement(".tutorialtaken", parent).textContent).toBe(
        "Your browser refused to store it. Copy the program out of the editor by hand to keep it.",
      );
    });

    it("restores the news without announcing it a second time", () => {
      // The counterpart of drawing the line empty: this text was read out when
      // the button was pressed, so on the way back it has to be in the paragraph
      // before the paragraph is in the page. A live region met already populated
      // is generally not announced, which is the failure everywhere else in this
      // panel and the requirement here.
      presentTutorial(parent, panelData());
      requireElement(".tutorialtakecode", parent).click();
      const observer = new MutationObserver(() => undefined);
      observer.observe(parent, { childList: true, characterData: true, subtree: true });

      presentTutorial(parent, panelData({ clearedCount: 1 }));

      // `takeRecords` rather than the callback: the callback is a microtask, and
      // a spec that awaited one would be asserting after the assertion could
      // still be made. Everything the redraw did is in here synchronously.
      const records = observer.takeRecords();
      observer.disconnect();
      // One record is expected -- the whole panel being swapped into `parent` --
      // and that is the one that carries the text in, unannounced. What must not
      // be here is a mutation of the line itself, which is a write to a live
      // region that is already in the document, and is read out.
      const line = requireElement(".tutorialtaken", parent);
      expect(records.filter((record) => line.contains(record.target))).toEqual([]);
      expect(records).not.toEqual([]);
    });

    it("drops the news when the panel moves to another task", () => {
      // The one case where the sentence would be describing a copy made of a
      // program the panel is no longer showing.
      presentTutorial(parent, panelData());
      requireElement(".tutorialtakecode", parent).click();

      presentTutorial(parent, panelData({ taskIndex: 1 }));

      expect(requireElement(".tutorialtaken", parent).textContent).toBe("");
    });

    it("says it in the language the player is reading, at the moment it says it", () => {
      // The catalogue is asked when the sentence is written, not when the panel
      // was drawn -- the same rule the rest of this file follows. A draw-time
      // lookup would be a line in the language the player *had been* reading.
      presentTutorial(parent, panelData());
      setLocale("ru");

      requireElement(".tutorialtakecode", parent).click();

      expect(requireElement(".tutorialtaken", parent).textContent).toBe(
        "Программа скопирована в редактор игры — она будет ждать вас, когда вы выйдете с дорожки.",
      );
    });

    it("says the restored news in the language the panel is now drawn in", () => {
      // The reason the answer is what survives a redraw and not the sentence:
      // changing the language redraws the panel, and English news restored into
      // a Russian panel would be the one line the picker had not translated.
      presentTutorial(parent, panelData());
      requireElement(".tutorialtakecode", parent).click();
      setLocale("ru");

      presentTutorial(parent, panelData());

      expect(requireElement(".tutorialtaken", parent).textContent).toBe(
        "Программа скопирована в редактор игры — она будет ждать вас, когда вы выйдете с дорожки.",
      );
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

    it("keeps the news across a redraw of the same task", async () => {
      stubClipboard(true);
      presentTutorial(parent, panelData());
      requireElement(".tutorialcopycode", parent).click();
      await vi.waitFor(() => {
        expect(requireElement(".tutorialcopied", parent).textContent).not.toBe("");
      });

      presentTutorial(parent, panelData({ clearedCount: 1 }));

      expect(requireElement(".tutorialcopied", parent).textContent).toBe(
        "Copied to your clipboard.",
      );
    });

    it("drops the news when the panel moves to another task", async () => {
      stubClipboard(true);
      presentTutorial(parent, panelData());
      requireElement(".tutorialcopycode", parent).click();
      await vi.waitFor(() => {
        expect(requireElement(".tutorialcopied", parent).textContent).not.toBe("");
      });

      presentTutorial(parent, panelData({ taskIndex: 1 }));

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
    it("asks the catalogue at the moment it draws", () => {
      // The panel is handed a task index rather than the words to print, and
      // this is the whole reason: `App.relocalise` draws it again, and a panel
      // that had kept the sentences it was given the first time would be the one
      // block of the page still in English.
      presentTutorial(parent, panelData({ clearedCount: 1 }));
      setLocale("ru");

      presentTutorial(parent, panelData({ clearedCount: 1 }));

      expect(requireElement(".tutorialtitle", parent).textContent).toBe(
        "Лифт, который никуда не едет",
      );
      expect(requireElement(".tutorialleave", parent).textContent).toBe("Выйти к заданиям игры");
      expect(requireElement(".tutorialprogress", parent).textContent).toBe(
        `Пройдено 1 из ${String(tutorialTasks.length)} заданий`,
      );
    });

    it("draws this task's own answer, out of the catalogue of the language it draws in", () => {
      // The answer is a message like everything else here, but a `.code` one:
      // only the `//` comments in it are ever translated and the JavaScript is
      // byte-identical in every locale, which `src/i18n/catalogue.test.ts`
      // holds. So what the panel draws is the same program in either language,
      // with at most different comments — and since no answer on the track
      // carries a comment today, the two languages are the same bytes. Which
      // language the panel drew from therefore cannot be read off the answer at
      // all, and nothing below pretends it can. The starting programs are where
      // the difference is visible: each carries a comment, so
      // `tutorial.task1.startingCode.code` really is two different strings. The
      // day an answer gains one, the assertion below starts carrying that half
      // of the sentence by itself, with nothing here to change.
      //
      // What it does say today is which message was drawn. Comparing the drawn
      // text with `tutorialTasks[0].solutionCode` — which this spec used to do —
      // reaches the getter the panel reached and moves with it, so it holds the
      // panel to the table and says nothing about the table holding the wrong
      // key. That is a mistake worth being able to fail on: the table reaches
      // its programs through keys written out by hand, and a task reading its
      // neighbour's would show the neighbour's answer here without anything
      // throwing. Naming the message and the locale outright makes this the
      // panel's own statement.
      for (const locale of LOCALES) {
        setLocale(locale);

        presentTutorial(parent, panelData());

        const drawn = requireElement(".tutorialsolution code", parent).textContent;
        expect(drawn, locale).toBe(translateIn(locale, "tutorial.task1.solutionCode.code"));
        expect(uncommented(drawn), `${locale}: Cyrillic outside a comment`).not.toMatch(/[а-яё]/i);
      }
    });
  });
});

describe("The goal a task states", () => {
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

  for (const [index, task] of tutorialTasks.entries()) {
    for (const locale of LOCALES) {
      it(`is the bar ${task.id} enforces, in ${locale}`, () => {
        // The goal is prose in a catalogue and the bar is arithmetic in
        // `src/game/tutorial.ts`, and nothing made the two agree: a goal saying
        // "deliver 40 passengers and let nobody wait longer than 3 seconds" for
        // a task requiring 15 and 37 left the whole suite green, and the player
        // reading it would have been sent to fail at something the game was not
        // asking for. The numbers are what can be checked without restating the
        // sentence here -- word it however it should be worded, but every
        // number the condition is built from has to be in it.
        setLocale(locale);

        presentTutorial(parent, panelData({ taskIndex: index }));

        const goal = requireElement(".tutorialgoal", parent).textContent;
        expect(numbersIn(goal)).toEqual(
          expect.arrayContaining(numbersIn(task.condition.description)),
        );
      });
    }
  }
});
