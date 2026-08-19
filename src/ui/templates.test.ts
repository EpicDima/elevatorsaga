// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, setLocale } from "../i18n/index.ts";
import {
  challengeTemplate,
  codeSlotsTemplate,
  codeStatusTemplate,
  controlsTemplate,
  elevatorButtonTemplate,
  elevatorFloorButtonLabel,
  elevatorLabel,
  elevatorTemplate,
  escapeHtml,
  feedbackTemplate,
  floorCallDownLabel,
  floorCallUpLabel,
  floorTemplate,
  markup,
  raw,
  renderElement,
  renderFragment,
  tutorialTemplate,
  userTemplate,
} from "./templates.ts";
import type {
  ChallengeLinkData,
  ChallengeTemplateData,
  SeedLinkData,
  TutorialTemplateData,
} from "./templates.ts";
import { requireElement } from "#shared/lib/dom.ts";

describe("escapeHtml", () => {
  it("escapes every character that could break out of markup", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeHtml("Challenge #3")).toBe("Challenge #3");
  });
});

describe("markup", () => {
  it("escapes interpolated values", () => {
    const evil = `"><img src=x onerror=alert(1)>`;
    expect(markup`<a href="${evil}"></a>`).toBe(
      `<a href="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"></a>`,
    );
  });

  it("inserts raw values verbatim", () => {
    expect(markup`<p>${raw("<b>hi</b>")}</p>`).toBe("<p><b>hi</b></p>");
  });

  it("stringifies numbers", () => {
    expect(markup`<div style="top: ${150}px"></div>`).toBe(`<div style="top: 150px"></div>`);
  });

  it("handles a template with no interpolations", () => {
    expect(markup`<hr>`).toBe("<hr>");
  });
});

describe("renderFragment / renderElement", () => {
  it("parses markup without running or loading anything", () => {
    const fragment = renderFragment(`<img src="/nope.png"><span>ok</span>`);
    expect(fragment.children).toHaveLength(2);
  });

  it("returns the single element of a one-element template", () => {
    expect(renderElement("<div class='floor'></div>").className).toBe("floor");
  });

  it("rejects markup that is not exactly one element", () => {
    expect(() => renderElement("<div></div><div></div>")).toThrow("exactly one element");
    expect(() => renderElement("just text")).toThrow("exactly one element");
  });
});

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

describe("challengeTemplate", () => {
  /** A run nobody pinned, and the URL that starts another run from its seed. */
  const SEED: SeedLinkData = {
    seed: "1234567890",
    url: "#challenge=1,seed=1234567890",
    newDrawUrl: null,
  };

  /** The same run once its seed is pinned, and the URL that unpins it. */
  const PINNED_SEED: SeedLinkData = { ...SEED, newDrawUrl: "#challenge=1" };

  /**
   * The navigation row's data for a list of challenges ending in the demo.
   *
   * @param count - How many challenges there are, the last being the demo.
   * @param currentNum - The one-based challenge to mark as being played.
   * @returns One entry per challenge.
   */
  function links(count: number, currentNum = 1): ChallengeLinkData[] {
    return Array.from({ length: count }, (_unused, index) => ({
      num: index + 1,
      url: `#challenge=${String(index + 1)},timescale=8`,
      current: index + 1 === currentNum,
      demo: index + 1 === count,
    }));
  }

  /**
   * Renders a bar, with no seed line unless the test is about one.
   *
   * @param data - The challenge number, the requirement and the row.
   * @param seed - The seed of the run in progress, if it has one.
   * @returns The rendered bar.
   */
  function bar(
    data: Omit<ChallengeTemplateData, "seed">,
    seed: SeedLinkData | null = null,
  ): DocumentFragment {
    return renderFragment(challengeTemplate({ ...data, seed }));
  }

  /**
   * What the seed line says, with its disclosure left out.
   *
   * The caveat inside the disclosure is a whole sentence of prose, and it is
   * checked on its own; folding it into these assertions would bury the thing
   * they are about. What is left is the line a player reads at a glance.
   *
   * @param fragment - A rendered challenge bar.
   * @returns The text of `.challengeseed` without the disclosure's, trimmed.
   */
  function seedLineText(fragment: DocumentFragment): string {
    const line = fragment.querySelector(".challengeseed")?.cloneNode(true);
    if (!(line instanceof HTMLElement)) {
      return "";
    }
    line.querySelector(".seedhelp")?.remove();
    return line.textContent.trim();
  }

  it("inserts the challenge description as markup", () => {
    const fragment = bar({
      num: 3,
      description: "Transport <span class='x'>15</span> people",
      links: links(4, 3),
    });
    const title = fragment.querySelector(".challengetitle");
    expect(title?.textContent).toBe("Challenge #3: Transport 15 people");
    expect(title?.querySelector(".x")?.textContent).toBe("15");
  });

  it("gives every challenge a link of its own, the last one being the demo", () => {
    // Reaching challenge 12 used to mean either winning eleven challenges or
    // typing #challenge=12 into the address bar.
    const fragment = bar({ num: 1, description: "x", links: links(20) });
    const entries = [...fragment.querySelectorAll("a.challengelink")];

    expect(entries).toHaveLength(20);
    expect(entries.map((entry) => entry.textContent)).toEqual([
      ...Array.from({ length: 19 }, (_unused, index) => String(index + 1)),
      "Demo",
    ]);
    expect(entries.at(-1)?.getAttribute("href")).toBe("#challenge=20,timescale=8");
  });

  it("names the links for a screen reader rather than leaving them as digits", () => {
    const fragment = bar({ num: 1, description: "x", links: links(3) });
    const entries = [...fragment.querySelectorAll("a.challengelink")];

    expect(entries.map((entry) => entry.getAttribute("aria-label"))).toEqual([
      "Challenge 1",
      "Challenge 2",
      "Demo",
    ]);
    // WCAG 2.5.3: whatever is on screen has to be part of the spoken name, so
    // speech input can still reach the control by what it says.
    for (const entry of entries) {
      expect(entry.getAttribute("aria-label")).toContain(entry.textContent);
    }
  });

  it("marks the challenge being played, and only that one", () => {
    const fragment = bar({ num: 2, description: "x", links: links(4, 2) });
    const marked = [...fragment.querySelectorAll("a.challengelink[aria-current]")];

    expect(marked).toHaveLength(1);
    expect(marked[0]?.getAttribute("aria-current")).toBe("page");
    expect(marked[0]?.getAttribute("aria-label")).toBe("Challenge 2");
  });

  it("wraps the row in a named landmark holding a list", () => {
    const fragment = bar({ num: 1, description: "x", links: links(3) });
    const nav = fragment.querySelector("nav.challengenav");

    expect(nav?.getAttribute("aria-label")).toBe("Challenges");
    // A list, so a screen reader says how many challenges there are before
    // reading them out.
    expect(nav?.querySelectorAll("ul > li > a.challengelink")).toHaveLength(3);
  });

  it("tabs through the bar in the order it is read in", () => {
    // WCAG 2.4.3. The challenge stops come first, and the seed -- a debugging
    // aid rather than part of the game -- comes last of all. The bar reached
    // this order by losing the `float: right` that used to draw the
    // first-written control furthest right, so `right` coming back on any of
    // these is the layout and the tab order coming apart again.
    const fragment = bar({ num: 1, description: "x", links: links(3) }, SEED);
    // `<summary>` is focusable and in the tab order without a tabindex, which is
    // the whole reason the caveat lives in one, so it counts as a stop here.
    const focusable = [...fragment.querySelectorAll("button, a, summary")];

    expect(focusable.slice(0, -2).map((element) => element.className)).toEqual([
      "challengelink",
      "challengelink",
      "challengelink",
    ]);
    expect(focusable.at(-2)?.className).toBe("seedlink");
    expect(focusable.at(-1)?.tagName).toBe("SUMMARY");
  });

  it("leaves the run controls out of the bar entirely", () => {
    // They are a region of their own, drawn once for the life of the page
    // (`controlsTemplate`). The bar is rebuilt on every restart, so anything
    // left in here is a control that destroys itself when pressed.
    const fragment = bar({ num: 1, description: "x", links: links(3) }, SEED);

    expect(fragment.querySelector(".startstop")).toBeNull();
    expect(fragment.querySelector(".timescale")).toBeNull();
  });

  it("escapes a link url rebuilt from the location hash", () => {
    const hostile = `#challenge=1,evil="><script>x</script>`;
    const fragment = bar({
      num: 1,
      description: "x",
      links: [{ num: 1, url: hostile, current: false, demo: false }],
    });

    expect(fragment.querySelector("script")).toBeNull();
    expect(fragment.querySelector("a.challengelink")?.getAttribute("href")).toBe(hostile);
  });

  describe("seed line", () => {
    it("shows the seed as a link to the run's own url", () => {
      const seedLink = bar({ num: 1, description: "x", links: links(3) }, SEED).querySelector(
        "a.seedlink",
      );

      expect(seedLink?.textContent).toBe("1234567890");
      expect(seedLink?.getAttribute("href")).toBe("#challenge=1,seed=1234567890");
    });

    it("says what the link does, and keeps the seed in what it says", () => {
      const fragment = bar({ num: 1, description: "x", links: links(3) }, SEED);
      const seedLink = fragment.querySelector("a.seedlink");

      // "1234567890, link" describes nothing, so the name says more -- and
      // WCAG 2.5.3 asks that what is on screen be part of what is spoken.
      expect(seedLink?.getAttribute("aria-label")).toBe(
        "Seed 1234567890: start another run from this seed",
      );
      expect(seedLink?.getAttribute("aria-label")).toContain(seedLink?.textContent);
      expect(seedLineText(fragment)).toBe("Seed 1234567890");
    });

    it("promises the passengers, and now the run too, given the same play", () => {
      // The seed brings the same people in the same order, which is the whole
      // point of the affordance. It now brings the run back too:
      // world-controller.ts advances codeObj.update and world.update in fixed
      // TICK_SECONDS ticks rather than off requestAnimationFrame's variable dt,
      // so the cars are in the same places at each passenger's appearance and
      // the player's program is asked to decide at the same moments -- as long
      // as the run is played the same way.
      const explanation = bar({ num: 1, description: "x", links: links(3) }, SEED).querySelector(
        ".seedcaveat",
      )?.textContent;

      expect(explanation).toBe(
        "The same seed brings the same passengers, in the same order — and, played the same " +
          "way, the exact same run: every elevator movement, arrival and button press repeats " +
          "exactly, whatever the browser's frame rate.",
      );
      // The condition -- "played the same way" -- is the whole point of the
      // promise now being made, so it may not go missing while the promise
      // in front of it stays.
      expect(explanation).toContain("played the same way");
    });

    it("puts the caveat somewhere a keyboard and a screen reader can reach it", () => {
      // It used to be a title attribute on a <span>: a tooltip, which is to say
      // mouse-only. A touch screen never shows one, a <span> cannot be focused,
      // and screen readers announce title on non-interactive elements
      // inconsistently -- so the sentence that keeps the rest of the line honest
      // reached only the players who happened to hover over the right word.
      const fragment = bar({ num: 1, description: "x", links: links(3) }, SEED);
      const help = fragment.querySelector(".seedhelp");

      // A native disclosure: focusable, in the tab order, operated by Enter and
      // Space, and announced with its expanded state, none of which is wired up
      // here because the element already does all of it.
      expect(help?.tagName).toBe("DETAILS");
      expect(help?.querySelector("summary")?.textContent).toBe("what a seed does");
      expect(help?.querySelector(".seedcaveat")?.textContent).toContain("The same seed brings");
      // Closed to begin with: the bar sits on top of the building, and a line it
      // always spends is a line the game is pushed down by.
      expect(help?.hasAttribute("open")).toBe(false);
      // And the tooltip is gone rather than kept alongside, so the same words
      // are not announced from two places.
      expect(fragment.querySelector("[title]")).toBeNull();
    });

    it("keeps the disclosure inside the seed line the parser would have ejected it from", () => {
      // <details> is one of the tags that closes an open <p>, and the bar is
      // written into the document with innerHTML -- so as long as the line is a
      // <p>, the disclosure ends up a sibling of it and the layout comes apart.
      const line = bar({ num: 1, description: "x", links: links(3) }, SEED).querySelector(
        ".challengeseed",
      );

      expect(line?.tagName).toBe("DIV");
      expect(line?.querySelector(".seedhelp")).not.toBeNull();
    });

    it("offers a way out of a pinned run, in place of the offer to pin it", () => {
      // One click pins a run; without this, nothing in the interface takes it
      // back, and the Restart button, Ctrl-Enter and a reload all keep the pin.
      const fragment = bar({ num: 1, description: "x", links: links(3) }, PINNED_SEED);
      const newDraw = fragment.querySelector("a.seednewdraw");

      expect(newDraw?.textContent).toBe("new draw");
      expect(newDraw?.getAttribute("href")).toBe("#challenge=1");
      expect(newDraw?.getAttribute("aria-label")).toBe(
        "Seed 1234567890: new draw, start again without it",
      );
      // WCAG 2.5.3 again: two words on screen, the same two inside the name.
      expect(newDraw?.getAttribute("aria-label")).toContain(newDraw?.textContent);
    });

    it("stops offering to pin a run the url already pins", () => {
      // Following that link would go where the player already is: no
      // hashchange, no restart, nothing at all -- while its name promises
      // another run.
      const fragment = bar({ num: 1, description: "x", links: links(3) }, PINNED_SEED);

      expect(fragment.querySelector("a.seedlink")).toBeNull();
      // The seed is still there to be read and transcribed, just not to be
      // followed.
      expect(fragment.querySelector(".seedvalue")?.textContent).toBe("1234567890");
      expect(seedLineText(fragment)).toBe("Seed 1234567890 new draw");
    });

    it("offers exactly one link either way, and it always goes somewhere", () => {
      for (const [state, seed] of [
        ["unpinned", SEED],
        ["pinned", PINNED_SEED],
      ] as const) {
        const line = bar({ num: 1, description: "x", links: links(3) }, seed).querySelector(
          ".challengeseed",
        );
        const anchors = [...(line?.querySelectorAll("a") ?? [])];

        expect(anchors, state).toHaveLength(1);
        expect(anchors[0]?.getAttribute("href"), state).not.toBe("");
      }
    });

    it("leaves the line out entirely when the run has no seed", () => {
      const fragment = bar({ num: 1, description: "x", links: links(3) });
      expect(fragment.querySelector(".challengeseed")).toBeNull();
      expect(fragment.querySelector("a.seedlink")).toBeNull();
    });

    it("keeps the seed out of the challenge landmark", () => {
      // The row's list is what tells a screen reader how many challenges there
      // are; a seed counted among them would make that number a lie.
      const fragment = bar({ num: 1, description: "x", links: links(3) }, SEED);
      expect(fragment.querySelector("nav.challengenav .seedlink")).toBeNull();
      expect(fragment.querySelectorAll("nav.challengenav li")).toHaveLength(3);
    });

    it("escapes a seed url rebuilt from the location hash", () => {
      const hostile = `#seed=1,evil="><script>x</script>`;
      const fragment = bar(
        { num: 1, description: "x", links: [] },
        { seed: "1", url: hostile, newDrawUrl: null },
      );

      expect(fragment.querySelector("script")).toBeNull();
      expect(fragment.querySelector("a.seedlink")?.getAttribute("href")).toBe(hostile);
    });

    it("escapes the new-draw url too", () => {
      const hostile = `#evil="><script>x</script>`;
      const fragment = bar(
        { num: 1, description: "x", links: [] },
        { seed: "1", url: "#seed=1", newDrawUrl: hostile },
      );

      expect(fragment.querySelector("script")).toBeNull();
      expect(fragment.querySelector("a.seednewdraw")?.getAttribute("href")).toBe(hostile);
    });
  });
});

describe("feedbackTemplate", () => {
  it("renders the next-challenge link when there is a url", () => {
    const feedback = renderElement(
      feedbackTemplate({ title: "Success!", message: "Well done", url: "#challenge=4" }),
    );
    expect(feedback.querySelector("h2")?.textContent).toBe("Success!");
    expect(feedback.querySelector("p")?.textContent).toBe("Well done");
    expect(feedback.querySelector("a")?.getAttribute("href")).toBe("#challenge=4");
  });

  it("omits the link entirely when there is no url", () => {
    const feedback = renderElement(
      feedbackTemplate({ title: "Challenge failed", message: "Try again", url: "" }),
    );
    expect(feedback.querySelector("a")).toBeNull();
  });

  it("escapes a url rebuilt from the location hash", () => {
    const feedback = renderElement(
      feedbackTemplate({ title: "t", message: "m", url: `#a="><script>x</script>` }),
    );
    expect(feedback.querySelector("script")).toBeNull();
    expect(feedback.querySelector("a")?.getAttribute("href")).toBe(`#a="><script>x</script>`);
  });

  it("leaves the live region to the container it is inserted into", () => {
    // The overlay is created already populated and then inserted, and a
    // role="status" that a screen reader first meets in that state is normally
    // not announced. The live region is the .feedbackcontainer in index.html,
    // which is in the document from the start; see the page test.
    const feedback = renderElement(
      feedbackTemplate({ title: "Success!", message: "Well done", url: "" }),
    );
    expect(feedback.getAttribute("role")).toBeNull();
    expect(feedback.querySelector("[role], [aria-live]")).toBeNull();
  });
});

describe("codeStatusTemplate", () => {
  it("renders a warning banner with an empty message slot", () => {
    const banner = renderElement(codeStatusTemplate());
    expect(banner.className).toBe("error");
    expect(banner.querySelector(".error-color")).not.toBeNull();
    expect(banner.querySelector(".errormessage")?.textContent).toBe("");
  });

  it("keeps one space on each side of the sentence, whatever it says", () => {
    // The icon, a space, the sentence, a space, the message the presenter
    // writes. The catalogue entry ends at the colon, so both spaces belong to
    // this template and neither may be lost in a translation.
    expect(codeStatusTemplate()).toContain(
      '</svg> There is a problem with your code: <span class="errormessage">',
    );
  });
});

describe("codeSlotsTemplate", () => {
  it("draws three numbered buttons, marking the open one", () => {
    const fragment = renderFragment(codeSlotsTemplate({ currentSlot: 2 }));
    const buttons = [...fragment.querySelectorAll(".codeslot")];

    expect(buttons.map((button) => button.textContent)).toEqual(["1", "2", "3"]);
    expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual([
      "false",
      "true",
      "false",
    ]);
    expect(buttons.every((button) => button.getAttribute("type") === "button")).toBe(true);
  });

  it("labels each button with the sentence its bare number is short for", () => {
    const fragment = renderFragment(codeSlotsTemplate({ currentSlot: 1 }));
    const buttons = [...fragment.querySelectorAll(".codeslot")];

    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Code slot 1",
      "Code slot 2",
      "Code slot 3",
    ]);
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

  /** A run nobody pinned, for the Russian seed line. */
  const SEED: SeedLinkData = {
    seed: "1234567890",
    url: "#challenge=1,seed=1234567890",
    newDrawUrl: null,
  };

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

  it("puts the challenge number where the Russian sentence wants it", () => {
    // «Задание №3», not «Задание #3»: the number sign is a different character
    // in Russian, which is why the whole title is one message rather than a
    // number glued to a translated word.
    setLocale("ru");
    const fragment = renderFragment(
      challengeTemplate({
        num: 3,
        description: "Перевезите <span class='emphasis-color'>15</span> пассажиров",
        links: [],
        seed: null,
      }),
    );

    expect(fragment.querySelector(".challengetitle")?.textContent).toBe(
      "Задание №3: Перевезите 15 пассажиров",
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

  it("names the navigation row", () => {
    setLocale("ru");
    const fragment = renderFragment(
      challengeTemplate({
        num: 1,
        description: "x",
        links: [
          { num: 1, url: "#challenge=1", current: true, demo: false },
          { num: 2, url: "#challenge=2", current: false, demo: true },
        ],
        seed: null,
      }),
    );

    expect(fragment.querySelector("nav.challengenav")?.getAttribute("aria-label")).toBe("Задания");
    const entries = [...fragment.querySelectorAll("a.challengelink")];
    expect(entries.map((entry) => entry.getAttribute("aria-label"))).toEqual(["Задание 1", "Демо"]);
    // The demo's visible label is translated with its name, so the one entry
    // that shows a word rather than a digit still satisfies WCAG 2.5.3.
    expect(entries.map((entry) => entry.textContent)).toEqual(["1", "Демо"]);
  });

  it("translates the seed line without touching the seed itself", () => {
    setLocale("ru");
    const fragment = renderFragment(
      challengeTemplate({ num: 1, description: "x", links: [], seed: SEED }),
    );

    expect(fragment.querySelector(".seedlabel")?.textContent).toBe("Сид");
    const seedLink = fragment.querySelector("a.seedlink");
    // The seed is a token to be transcribed, so it is interpolated as a string
    // and never grouped or reformatted: 1 234 567 890 would be a different seed.
    expect(seedLink?.textContent).toBe("1234567890");
    expect(seedLink?.getAttribute("aria-label")).toBe(
      "Сид 1234567890: начать ещё один прогон с этим сидом",
    );
  });

  it("translates the new-draw link and keeps its label inside its name", () => {
    setLocale("ru");
    const newDraw = renderFragment(
      challengeTemplate({
        num: 1,
        description: "x",
        links: [],
        seed: { ...SEED, newDrawUrl: "#challenge=1" },
      }),
    ).querySelector("a.seednewdraw");

    expect(newDraw?.textContent).toBe("новый сид");
    expect(newDraw?.getAttribute("aria-label")).toBe(
      "Сид 1234567890: новый сид, начать заново без прежнего",
    );
    // WCAG 2.5.3 holds in every language, and this is the one string that is
    // both a visible label and a fragment of its own accessible name.
    expect(newDraw?.getAttribute("aria-label")).toContain(newDraw?.textContent);
  });

  it("translates the caveat about what a seed does", () => {
    setLocale("ru");
    const fragment = renderFragment(
      challengeTemplate({ num: 1, description: "x", links: [], seed: SEED }),
    );

    expect(fragment.querySelector(".seedhelp summary")?.textContent).toBe("что задаёт сид");
    expect(fragment.querySelector(".seedcaveat")?.textContent).toBe(
      "Один и тот же сид приводит тех же пассажиров и в том же порядке — а если ещё и играть " +
        "одинаково, то и весь прогон повторяется в точности: каждое движение лифта, прибытие и " +
        "нажатие кнопки — один в один, независимо от частоты кадров браузера.",
    );
  });

  it("translates the next-challenge link and the code banner", () => {
    setLocale("ru");

    expect(
      renderElement(
        feedbackTemplate({ title: "t", message: "m", url: "#challenge=4" }),
      ).querySelector("a")?.textContent,
    ).toBe("Следующее задание ");
    expect(renderElement(codeStatusTemplate()).textContent).toBe(" С вашим кодом что-то не так: ");
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
