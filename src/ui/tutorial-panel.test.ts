// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tutorialTasks } from "../game/tutorial.ts";
import type { TutorialTask } from "../game/tutorial.ts";
import { DEFAULT_LOCALE, EN_MESSAGES, setLocale } from "../i18n/index.ts";
import { query, queryAll, requireElement } from "./dom.ts";
import { createElement } from "./test-helpers.ts";
import { presentTutorial } from "./tutorial-panel.ts";
import type { TutorialPanelData } from "./tutorial-panel.ts";

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
    onRestart: vi.fn(),
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
    expect(requireElement(".tutorialrestart", parent).textContent).toBe("Start over");
    expect(requireElement(".tutorialtakecode", parent).textContent).toBe(
      "Take this program into your own editor",
    );
    expect(requireElement(".tutorialleave", parent).textContent).toBe("Leave for the challenges");
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
      // Pressing "Start over" starts the task again, which redraws this panel
      // and deletes the button that was pressed. Focus would fall back to the
      // document, dropping a keyboard player at the top of the page and leaving
      // them the whole of it to tab through again (WCAG 2.4.3).
      presentTutorial(parent, panelData());
      const pressed = requireElement(".tutorialrestart", parent);
      pressed.focus();

      presentTutorial(parent, panelData());

      const redrawn = requireElement(".tutorialrestart", parent);
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

  describe("the three buttons", () => {
    it("reports a press of the two that cannot destroy anything", () => {
      const data = panelData();
      presentTutorial(parent, data);

      requireElement(".tutorialrestart", parent).click();
      requireElement(".tutorialleave", parent).click();

      expect(data.onRestart).toHaveBeenCalledTimes(1);
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

      requireElement(".tutorialrestart", parent).click();

      expect(first.onRestart).not.toHaveBeenCalled();
      expect(second.onRestart).toHaveBeenCalledTimes(1);
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

    it("says the program was taken", () => {
      // The write goes to a buffer that is not on screen from the track, so this
      // line is the only evidence the player gets that the button did anything.
      const data = panelData();
      presentTutorial(parent, data);

      requireElement(".tutorialtakecode", parent).click();

      expect(requireElement(".tutorialtaken", parent).textContent).toBe(
        "Copied into the game editor, waiting when you leave the track.",
      );
    });

    it("says the store refused rather than letting the player believe it worked", () => {
      // A browser with storage switched off answers `false` here, and the old
      // panel said the same nothing to that as it did to success: the player
      // walked away believing their program was waiting for them.
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

    it("does not carry the confirmation into the next draw", () => {
      // Unlike the open hints, which are deliberately carried across a redraw of
      // the same task. A redraw is the run restarting or the language changing,
      // and either way the sentence would then be describing a copy made of a
      // program the panel is no longer showing.
      presentTutorial(parent, panelData());
      requireElement(".tutorialtakecode", parent).click();

      presentTutorial(parent, panelData());

      expect(requireElement(".tutorialtaken", parent).textContent).toBe("");
    });

    it("says it in the language the player is reading", () => {
      const data = panelData();
      presentTutorial(parent, data);
      setLocale("ru");
      presentTutorial(parent, data);

      requireElement(".tutorialtakecode", parent).click();

      expect(requireElement(".tutorialtaken", parent).textContent).toBe(
        "Программа скопирована в редактор игры — она будет там, когда вы выйдете с дорожки.",
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
      expect(requireElement(".tutorialrestart", parent).textContent).toBe("Начать заново");
      expect(requireElement(".tutorialprogress", parent).textContent).toBe(
        `Пройдено 1 из ${String(tutorialTasks.length)} заданий`,
      );
    });

    it("leaves the answer in the language it is written in", () => {
      // The program is JavaScript. It comes from the task table in either
      // language, and it is the same string in both.
      setLocale("ru");

      presentTutorial(parent, panelData());

      expect(requireElement(".tutorialsolution code", parent).textContent).toBe(
        tutorialTasks[0]?.solutionCode,
      );
    });
  });
});
