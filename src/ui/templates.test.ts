// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, setLocale } from "../i18n/index.ts";
import {
  controlsTemplate,
  elevatorButtonTemplate,
  elevatorFloorButtonLabel,
  elevatorLabel,
  elevatorTemplate,
  floorCallDownLabel,
  floorCallUpLabel,
  floorTemplate,
  tutorialTemplate,
  userTemplate,
} from "./templates.ts";
import type { TutorialTemplateData } from "./templates.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { renderElement, renderFragment } from "#shared/ui/markup.ts";

describe("floorTemplate", () => {
  it("positions the floor and shows its number", () => {
    const floor = renderElement(floorTemplate(2, 150));
    expect(floor.className).toBe("floor");
    expect(floor.style.top).toBe("150px");
    expect(floor.querySelector(".floornumber")?.textContent).toBe("2");
  });

  it("makes the call buttons real, labelled buttons", () => {
    const floor = renderElement(floorTemplate(2, 150));
    const up = floor.querySelector("button.up");
    const down = floor.querySelector("button.down");
    expect(up?.getAttribute("aria-label")).toBe("Call an elevator going up from floor 2");
    expect(down?.getAttribute("aria-label")).toBe("Call an elevator going down from floor 2");
    expect(up?.getAttribute("aria-pressed")).toBe("false");
    expect(down?.getAttribute("aria-pressed")).toBe("false");
    expect(up?.getAttribute("type")).toBe("button");
  });

  it("keeps exactly one space between the two call buttons", () => {
    const floor = renderElement(floorTemplate(0, 0));
    const indicator = floor.querySelector(".buttonindicator");
    expect(indicator?.childNodes[1]?.textContent).toBe(" ");
  });
});

describe("elevatorTemplate", () => {
  it("sets the car width and keeps the movable class", () => {
    const elevator = renderElement(elevatorTemplate(40, 0));
    expect(elevator.className).toBe("elevator movable");
    expect(elevator.style.width).toBe("40px");
  });

  it("renders both direction indicators and the empty indicator slots", () => {
    const elevator = renderElement(elevatorTemplate(40, 1));
    expect(elevator.querySelector(".directionindicatorup .up.activated")).not.toBeNull();
    expect(elevator.querySelector(".directionindicatordown .down.activated")).not.toBeNull();
    expect(elevator.querySelector(".floorindicator > span")?.textContent).toBe("");
    expect(elevator.querySelector(".buttonindicator")?.children).toHaveLength(0);
    expect(elevator.getAttribute("aria-label")).toBe("Elevator 2");
  });
});

describe("elevatorButtonTemplate", () => {
  it("renders a labelled button holding just the floor number", () => {
    const button = renderElement(elevatorButtonTemplate(7));
    expect(button.tagName).toBe("BUTTON");
    expect(button.className).toBe("buttonpress");
    expect(button.textContent).toBe("7");
    expect(button.getAttribute("aria-label")).toBe("Go to floor 7");
  });

  it("introduces no whitespace, so the buttons stay flush against each other", () => {
    const source = elevatorButtonTemplate(0) + elevatorButtonTemplate(1);
    const fragment = renderFragment(source);
    expect(fragment.childNodes).toHaveLength(2);
    expect(fragment.textContent).toBe("01");
  });
});

describe("the four names a drawn building can be renamed from", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("hands the templates the very strings they write into the markup", () => {
    // `relabelWorld` renames a building that is already on screen by calling
    // these four, and the templates that drew it call the same four. Two copies
    // of a message key, one in each path, is how a renamed message ends up
    // renaming half a building; there is one copy, and this is the assertion
    // that the templates still go through it.
    const floor = renderElement(floorTemplate(2, 150));
    expect(floor.querySelector("button.up")?.getAttribute("aria-label")).toBe(floorCallUpLabel(2));
    expect(floor.querySelector("button.down")?.getAttribute("aria-label")).toBe(
      floorCallDownLabel(2),
    );
    expect(renderElement(elevatorTemplate(40, 1)).getAttribute("aria-label")).toBe(
      elevatorLabel(1),
    );
    expect(renderElement(elevatorButtonTemplate(7)).getAttribute("aria-label")).toBe(
      elevatorFloorButtonLabel(7),
    );
  });

  it("counts cars from one for the reader, from zero for the code", () => {
    // The conversion lives in the helper so that neither caller can do it, or
    // fail to do it, on its own: "Elevator 0" is not a car anybody can point at.
    expect(elevatorLabel(0)).toBe("Elevator 1");
    expect(elevatorLabel(3)).toBe("Elevator 4");
  });

  it("answers in the language active when it is asked, not when it was imported", () => {
    // The whole point of a helper rather than a constant: the building outlives
    // the language it was drawn in, and these are asked again to change it.
    expect(floorCallUpLabel(2)).toBe("Call an elevator going up from floor 2");

    setLocale("ru");

    expect(floorCallUpLabel(2)).toBe("Вызвать лифт вверх с этажа 2");
    expect(floorCallDownLabel(2)).toBe("Вызвать лифт вниз с этажа 2");
    expect(elevatorLabel(1)).toBe("Лифт 2");
    expect(elevatorFloorButtonLabel(7)).toBe("Ехать на этаж 7");
  });
});

describe("userTemplate", () => {
  it("draws each person type as a movable user", () => {
    for (const type of ["male", "female", "child"] as const) {
      const user = renderFragment(userTemplate(type, false)).firstElementChild;
      expect(user?.getAttribute("class"), type).toBe(`icon movable user`);
    }
  });

  it("marks a delivered passenger as leaving", () => {
    const user = renderFragment(userTemplate("male", true)).firstElementChild;
    expect(user?.getAttribute("class")).toBe("icon movable user leaving");
  });
});

describe("controlsTemplate", () => {
  it("makes the time-scale controls real, labelled buttons", () => {
    const fragment = renderFragment(controlsTemplate());
    expect(fragment.querySelector("button.timescale_decrease")?.getAttribute("aria-label")).toBe(
      "Decrease simulation speed",
    );
    expect(fragment.querySelector("button.timescale_increase")?.getAttribute("aria-label")).toBe(
      "Increase simulation speed",
    );
  });

  it("draws the three run buttons in one box, in the order they are read in", () => {
    // Not decoration: the row wraps on a narrow page, and loose in it the
    // three would break up one at a time. One box, so what drives the run
    // wraps as the cluster it is -- and so the speed, which is a setting
    // rather than a thing the player came for, stays on the far side of the
    // row. Reset/undo-reset moved to the editor pane's own codetools (see
    // `widgets/editor-pane`'s own tests) and are not drawn here any more.
    const fragment = renderFragment(controlsTemplate());
    const buttons = [...(fragment.querySelector(".runbuttons")?.children ?? [])];

    expect(buttons.map((button) => button.className)).toEqual([
      "startstop unselectable",
      "startover unselectable",
      "runinstant unselectable",
    ]);
    expect(buttons.every((button) => button.getAttribute("type") === "button")).toBe(true);
  });

  it("ships the three with no label at all, for the presenter to write", () => {
    // The region is drawn once for the life of the page, so a label baked in
    // here would still be in the language the page opened in after a change of
    // language. `presentControls.update` writes all three.
    const fragment = renderFragment(controlsTemplate());
    const buttons = [...(fragment.querySelector(".runbuttons")?.children ?? [])];

    expect(buttons.map((button) => button.textContent)).toEqual(["", "", ""]);
  });

  it("announces the speed as it changes, without interrupting", () => {
    // presentControls.update rewrites .timescale_value's text on every click of
    // the two speed buttons, which without aria-live would happen in perfect
    // silence for a screen reader -- the number changes and nothing is said.
    // Polite rather than assertive: a player holding a speed button down can
    // change it several times a second, and an assertive region interrupts
    // whatever is already being read to announce each one in turn.
    const fragment = renderFragment(controlsTemplate());
    expect(fragment.querySelector(".timescale_value")?.getAttribute("aria-live")).toBe("polite");
  });
});

describe("tutorialTemplate", () => {
  /**
   * A drawn panel, with everything the test is not about left plain.
   *
   * The words are the test's own rather than the catalogue's: what this template
   * decides is where a string goes and whether it is escaped on the way, and a
   * fixture made of real prose would hide both behind a paragraph of Russian.
   *
   * @param overrides - The fields the test is about.
   * @returns The rendered panel.
   */
  function panel(overrides: Partial<TutorialTemplateData> = {}): HTMLElement {
    return renderElement(
      tutorialTemplate({
        taskNumber: 1,
        taskCount: 8,
        clearedCount: 0,
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
    expect(drawn.getAttribute("aria-label")).toBe("Learning track");
    expect([...drawn.children].map((child) => child.className)).toEqual([
      "tutorialposition",
      "tutorialtitle",
      "tutorialgoal",
      "tutorialhint",
      "tutorialhint",
      "tutorialhint",
      "tutorialexplanation",
      "tutorialbuttons",
      "tutorialtaken",
      "tutorialprogress",
    ]);
  });

  it("leaves the line about taking the program empty, and live", () => {
    // The presenter writes into this on the click, and a live region only
    // announces reliably when it was in the document before the text arrived --
    // so it is drawn here, empty, rather than made when there is news. Empty is
    // also the only honest state for a panel nobody has pressed a button on.
    const line = requireElement(".tutorialtaken", panel());

    expect(line.textContent).toBe("");
    expect(line.getAttribute("aria-live")).toBe("polite");
  });

  it("escapes the program, whatever the answer turns out to contain", () => {
    // The one string here that is neither text the catalogue wrote nor markup
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
      taskNumber: 1,
      taskCount: 8,
      clearedCount: 0,
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
    // that clears the task, character for character.
    expect(drawn.querySelector(".tutorialsolution code")?.textContent).toBe(hostile);
  });

  it("escapes the task's name and its goal", () => {
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
    // Task 8 is exactly this case on the real track: it hands back task 7's own
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
    // A task whose answer is on screen before the goal has been read is not a
    // task, and `<details>` opens for good once it is written open.
    expect(panel().querySelectorAll("details[open]")).toHaveLength(0);
    expect(panel().querySelectorAll("details")).toHaveLength(4);
  });

  it("says where the player is and how much of the track is behind them", () => {
    const drawn = panel({ taskNumber: 3, taskCount: 8, clearedCount: 5 });

    expect(drawn.querySelector(".tutorialposition")?.textContent).toBe(
      "Learning track Task 3 of 8",
    );
    expect(drawn.querySelector(".tutorialprogress")?.textContent).toBe("5 of 8 tasks done");
  });

  it("counts the tasks in the plural the number calls for", () => {
    // The plural is selected on the count of tasks, not on the count cleared:
    // "1 of 8 tasks done" is about eight tasks.
    expect(
      panel({ taskCount: 1, clearedCount: 1 }).querySelector(".tutorialprogress")?.textContent,
    ).toBe("1 of 1 task done");
    expect(
      panel({ taskCount: 8, clearedCount: 1 }).querySelector(".tutorialprogress")?.textContent,
    ).toBe("1 of 8 tasks done");
  });

  it("writes down the index the panel was drawn for, zero-based", () => {
    // Read back by the presenter after `replaceChildren` has thrown the old
    // panel away, to decide whether the hints the player opened may stay open.
    // Zero-based, because that is the number the presenter was called with.
    expect(panel({ taskNumber: 6 }).getAttribute("data-task-index")).toBe("5");
  });

  it("gives the way out two real buttons, and no second Start over", () => {
    const buttons = [...panel().querySelectorAll(".tutorialbuttons button")];

    expect(buttons.map((button) => button.className)).toEqual([
      "tutorialtakecode",
      "tutorialleave",
    ]);
    expect(buttons.map((button) => button.getAttribute("type"))).toEqual(["button", "button"]);
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Take this program into your own editor",
      "Leave for the challenges",
    ]);
    // The panel had its own "Start over" until the run buttons were gathered
    // into `controlsTemplate`, which is drawn directly under it. Two buttons on
    // screen together under one accessible name, doing not quite the same thing,
    // is WCAG 3.2.4; the one that went is the one only the track had.
    expect(panel().textContent).not.toContain("Start over");
  });
});

describe("the language the building comes out in", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("names the call buttons of a floor", () => {
    setLocale("ru");
    const floor = renderElement(floorTemplate(2, 150));

    expect(floor.querySelector("button.up")?.getAttribute("aria-label")).toBe(
      "Вызвать лифт вверх с этажа 2",
    );
    expect(floor.querySelector("button.down")?.getAttribute("aria-label")).toBe(
      "Вызвать лифт вниз с этажа 2",
    );
  });

  it("names a car and its floor buttons", () => {
    setLocale("ru");

    expect(renderElement(elevatorTemplate(40, 1)).getAttribute("aria-label")).toBe("Лифт 2");
    expect(renderElement(elevatorButtonTemplate(7)).getAttribute("aria-label")).toBe(
      "Ехать на этаж 7",
    );
  });

  it("names the speed controls", () => {
    setLocale("ru");
    const fragment = renderFragment(controlsTemplate());

    expect(fragment.querySelector("button.timescale_decrease")?.getAttribute("aria-label")).toBe(
      "Уменьшить скорость симуляции",
    );
    expect(fragment.querySelector("button.timescale_increase")?.getAttribute("aria-label")).toBe(
      "Увеличить скорость симуляции",
    );
  });

  it("names the learning track's panel and everything a player presses in it", () => {
    setLocale("ru");
    const drawn = renderElement(
      tutorialTemplate({
        taskNumber: 7,
        taskCount: 8,
        clearedCount: 6,
        title: "Один лифт на три этажа",
        goal: "Перевезите 20 пассажиров",
        hints: ["раз", "два", "три"],
        startingCode: "s",
        solutionCode: "elevator.goToFloor(1);",
        explanation: "почему",
      }),
    );

    // The landmark's name is translated too. A region announced as "Learning
    // track" in a Russian page is the one thing a screen-reader player cannot
    // see is out of place.
    expect(drawn.getAttribute("aria-label")).toBe("Учебная дорожка");
    expect(drawn.querySelector(".tutorialposition")?.textContent).toBe(
      "Учебная дорожка Задание 7 из 8",
    );
    expect(drawn.querySelector(".tutorialhint summary")?.textContent).toBe("Подсказка 1");
    expect(drawn.querySelector(".tutorialexplanation summary")?.textContent).toBe(
      "Почему так получается",
    );
    expect(drawn.querySelector(".tutorialprogress")?.textContent).toBe("Пройдено 6 из 8 заданий");
    expect(
      [...drawn.querySelectorAll(".tutorialbuttons button")].map((button) => button.textContent),
    ).toEqual(["Забрать программу в свой редактор", "Выйти к заданиям игры"]);
  });

  it("leaves the answer in the language it is written in", () => {
    // The program is JavaScript in every locale, and it is the string the task
    // table holds rather than anything the catalogue says.
    setLocale("ru");
    const code = `elevator.goToFloor(1);\nelevator.goToFloor(0);`;

    expect(
      renderElement(
        tutorialTemplate({
          taskNumber: 1,
          taskCount: 8,
          clearedCount: 0,
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

  it("is settled when a template runs, not when the module was loaded", () => {
    // The trap this file's docblock is about: a `const` holding a translated
    // string would be filled in at import time, when no catalogue but English
    // has been loaded, and would stay English for the rest of the session.
    expect(renderElement(elevatorTemplate(40, 0)).getAttribute("aria-label")).toBe("Elevator 1");

    setLocale("ru");

    expect(renderElement(elevatorTemplate(40, 0)).getAttribute("aria-label")).toBe("Лифт 1");
  });
});
