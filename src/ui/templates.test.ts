// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, setLocale } from "../i18n/index.ts";
import {
  challengeTemplate,
  codeStatusTemplate,
  elevatorButtonTemplate,
  elevatorTemplate,
  escapeHtml,
  feedbackTemplate,
  floorTemplate,
  markup,
  raw,
  renderElement,
  renderFragment,
  userTemplate,
} from "./templates.ts";
import type { ChallengeLinkData, ChallengeTemplateData, SeedLinkData } from "./templates.ts";

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

  it("makes the time-scale controls real, labelled buttons", () => {
    const fragment = bar({ num: 1, description: "x", links: [] });
    expect(fragment.querySelector("button.timescale_decrease")?.getAttribute("aria-label")).toBe(
      "Decrease simulation speed",
    );
    expect(fragment.querySelector("button.timescale_increase")?.getAttribute("aria-label")).toBe(
      "Increase simulation speed",
    );
    expect(fragment.querySelector("button.startstop")).not.toBeNull();
  });

  it("gives every challenge a link of its own, the last one being the demo", () => {
    // Reaching challenge 12 used to mean either winning eleven challenges or
    // typing #challenge=12 into the address bar.
    const fragment = bar({ num: 1, description: "x", links: links(19) });
    const entries = [...fragment.querySelectorAll("a.challengelink")];

    expect(entries).toHaveLength(19);
    expect(entries.map((entry) => entry.textContent)).toEqual([
      ...Array.from({ length: 18 }, (_unused, index) => String(index + 1)),
      "Demo",
    ]);
    expect(entries.at(-1)?.getAttribute("href")).toBe("#challenge=19,timescale=8");
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
    // WCAG 2.4.3. The speed controls are drawn to the left of the start button,
    // so they are written before it; the nineteen challenge stops come after
    // both, and the seed -- a debugging aid rather than part of the game --
    // comes last of all. The bar reached this order by losing the `float: right`
    // that used to draw the first-written control furthest right, so a class
    // name is asserted here and not just a tag: `right` coming back on any of
    // these is the layout and the tab order coming apart again.
    const fragment = bar({ num: 1, description: "x", links: links(3) }, SEED);
    // `<summary>` is focusable and in the tab order without a tabindex, which is
    // the whole reason the caveat lives in one, so it counts as a stop here.
    const focusable = [...fragment.querySelectorAll("button, a, summary")];

    expect(focusable.slice(0, 3).map((element) => element.className)).toEqual([
      "timescale_decrease unselectable",
      "timescale_increase unselectable",
      "startstop unselectable",
    ]);
    expect(focusable.slice(3, -1).every((element) => element.tagName === "A")).toBe(true);
    expect(focusable.at(-2)?.className).toBe("seedlink");
    expect(focusable.at(-1)?.tagName).toBe("SUMMARY");
  });

  it("keeps the speed and the start button in one box", () => {
    // Not decoration: the bar wraps somewhere around 600px, and loose in the
    // row the start button falls under the speed on its own. One box, so the
    // two things that drive the run wrap as the pair they are.
    const controls = bar({ num: 1, description: "x", links: links(3) }).querySelector(
      ".challengecontrols",
    );

    expect(controls?.querySelector(".timescale")).not.toBeNull();
    expect(controls?.querySelector(".startstop")).not.toBeNull();
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

    it("promises the passengers, and stops short of promising the run", () => {
      // The seed brings the same people in the same order, which is the whole
      // point of the affordance. It cannot bring the run: dt comes from
      // requestAnimationFrame, so the cars stand somewhere else as each of them
      // appears and the player's program is asked at different moments.
      const explanation = bar({ num: 1, description: "x", links: links(3) }, SEED).querySelector(
        ".seedcaveat",
      )?.textContent;

      expect(explanation).toBe(
        "The same seed brings the same passengers, in the same order. Frame timing comes from " +
          "the browser, so the run around them is never quite the same twice.",
      );
      expect(explanation).not.toMatch(/replay|exact|identical/i);
      // The caveat is the whole point of the second sentence, so it may not go
      // missing while the promise in front of it stays.
      expect(explanation).toContain("never quite the same twice");
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

  it("names the speed controls and the navigation row", () => {
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

    expect(fragment.querySelector("button.timescale_decrease")?.getAttribute("aria-label")).toBe(
      "Уменьшить скорость симуляции",
    );
    expect(fragment.querySelector("button.timescale_increase")?.getAttribute("aria-label")).toBe(
      "Увеличить скорость симуляции",
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
      "Один и тот же сид приводит тех же пассажиров и в том же порядке. А вот когда придёт " +
        "очередной кадр, решает браузер, поэтому всё остальное в прогоне каждый раз складывается " +
        "немного иначе.",
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

  it("is settled when a template runs, not when the module was loaded", () => {
    // The trap this file's docblock is about: a `const` holding a translated
    // string would be filled in at import time, when no catalogue but English
    // has been loaded, and would stay English for the rest of the session.
    expect(renderElement(elevatorTemplate(40, 0)).getAttribute("aria-label")).toBe("Elevator 1");

    setLocale("ru");

    expect(renderElement(elevatorTemplate(40, 0)).getAttribute("aria-label")).toBe("Лифт 1");
  });
});
