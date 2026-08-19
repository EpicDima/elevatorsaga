// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import pageSource from "../../index.html?raw";
import { EN_MESSAGES, setLocale, DEFAULT_LOCALE } from "../i18n/index.ts";

import { localisePage, ATTRIBUTE_KEY_ATTRIBUTE, TEXT_KEY_ATTRIBUTE } from "./localise-page.ts";

/**
 * User agent strings for the two answers `modifierKeyLabel` can give.
 *
 * A message written with `innerHTML` can carry a `<kbd data-mod-key>`, and
 * writing it throws away whatever `src/ui/shortcuts.ts` had labelled that key
 * with, so the platform's own key has to be put back afterwards; a Mac string
 * is the only way to see whether it was.
 */
const USER_AGENTS = {
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

/**
 * The English catalogue with its keys forgotten, so a key read out of the page
 * can be looked up.
 */
const ENGLISH_VALUES: Readonly<Record<string, unknown>> = EN_MESSAGES;

/** The page shell, parsed afresh for each test that writes into it. */
let page: Document;

beforeEach(() => {
  page = new DOMParser().parseFromString(pageSource, "text/html");
  // Cleared as well as silenced: the spy outlives the spec that installed it,
  // and the specs that count warnings would otherwise see the whole file's.
  vi.spyOn(console, "warn")
    .mockImplementation(() => undefined)
    .mockClear();
});

/**
 * What the page says in one place, in the single form both sides can be
 * compared in.
 *
 * Parsed and serialised again, and its runs of whitespace collapsed: HTML
 * collapses whitespace when it draws, so a sentence wrapped across three source
 * lines by the formatter and the same sentence written out on one line are the
 * same sentence. What is left is the tags, their attributes and the words.
 *
 * @param html - Markup, from the page or from the catalogue.
 * @returns The same markup, comparable.
 */
function markupOf(html: string): string {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  return holder.innerHTML.replace(/\s+/g, " ").trim();
}

/**
 * The words of an element, whitespace collapsed as a reader sees it.
 *
 * @param element - The element, or null when the page has nowhere for it.
 * @returns What it reads as.
 */
function textOf(element: Element | null): string {
  return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** A message the page shell names, and where it names it. */
interface NamedMessage {
  /** The element carrying the attribute. */
  readonly element: Element;
  /** The attribute it was named in, for a failure that says where to look. */
  readonly attribute: string;
  /** The attribute the message fills, or null when it fills the content. */
  readonly name: string | null;
  /** The message. */
  readonly key: string;
}

/**
 * Every message the page shell names, content and attributes alike.
 *
 * @param shell - The parsed page.
 * @returns One entry per message named, in document order.
 */
function namedMessages(shell: Document): NamedMessage[] {
  const named: NamedMessage[] = [];
  for (const element of shell.querySelectorAll(`[${TEXT_KEY_ATTRIBUTE}]`)) {
    named.push({
      element,
      attribute: TEXT_KEY_ATTRIBUTE,
      name: null,
      key: element.getAttribute(TEXT_KEY_ATTRIBUTE) ?? "",
    });
  }
  for (const element of shell.querySelectorAll(`[${ATTRIBUTE_KEY_ATTRIBUTE}]`)) {
    for (const mapping of (element.getAttribute(ATTRIBUTE_KEY_ATTRIBUTE) ?? "").split(",")) {
      const [name = "", key = ""] = mapping.split(":");
      named.push({
        element,
        attribute: ATTRIBUTE_KEY_ATTRIBUTE,
        name: name.trim(),
        key: key.trim(),
      });
    }
  }
  return named;
}

describe("what index.html names", () => {
  it("names a message that exists and takes no parameters, everywhere", () => {
    const named = namedMessages(page);
    // A guard on the guard: a selector that matched nothing would let every
    // assertion below pass on an empty list.
    expect(named.length).toBeGreaterThan(10);
    for (const { attribute, key } of named) {
      const english = ENGLISH_VALUES[key];
      expect(english, `${attribute}="${key}"`).toBeTypeOf("string");
      // The shell is markup, not a call site: there is nothing here to fill a
      // placeholder from, so a message that takes one belongs somewhere else.
      expect(String(english), key).not.toMatch(/\{/);
    }
  });

  it("ships, word for word, the English of every message it names", () => {
    // This is what keeps the promise that wiring the interface through the
    // catalogue did not change the English game. The shell has two copies of
    // every one of these sentences -- the one a reader without JavaScript sees
    // and the one the catalogue holds -- and nothing but this stops them
    // drifting.
    for (const { element, name, key } of namedMessages(page)) {
      const english = String(ENGLISH_VALUES[key]);
      if (name === null) {
        expect(markupOf(element.innerHTML), key).toBe(markupOf(english));
      } else {
        expect(element.getAttribute(name), `${name}="${key}"`).toBe(english);
      }
    }
  });
});

describe("localisePage", () => {
  it("leaves the page exactly as it shipped, in the language it shipped in", () => {
    const before = namedMessages(page).map(({ element, name }) =>
      name === null ? markupOf(element.innerHTML) : element.getAttribute(name),
    );

    localisePage(page, USER_AGENTS.windows);

    const after = namedMessages(page).map(({ element, name }) =>
      name === null ? markupOf(element.innerHTML) : element.getAttribute(name),
    );
    expect(after).toEqual(before);
    expect(page.documentElement.lang).toBe("en");
  });

  it("does not touch the slots the presenters fill", () => {
    localisePage(page, USER_AGENTS.windows);

    // The building and the statistics are drawn by widgets that mount into
    // these two containers at runtime. Localising a label must not clear the
    // slot beside it.
    expect(page.querySelector(".innerworld")?.innerHTML).toBe("");
    expect(page.querySelector(".statscontainer")?.innerHTML).toBe("");
  });

  it("leaves the noscript message in English, where it cannot be reached", () => {
    setLocale("ru");

    localisePage(page, USER_AGENTS.mac);
    setLocale(DEFAULT_LOCALE);

    // The one thing on the page that stays as it shipped, and the reason it
    // carries no data-i18n: a browser that is running this code parses the
    // children of <noscript> as text rather than as elements, so in the only
    // situation where the message could be replaced there is nothing there to
    // replace, and in the only situation where it is read there is nothing
    // running to replace it. DOMParser, which built this document, has
    // scripting disabled and so does see the paragraph -- which makes this a
    // real check that nothing here reaches for elements it was not told about.
    expect(textOf(page.querySelector("noscript"))).toBe(
      "Your browser does not appear to support JavaScript. This page contains a browser-based " +
        "programming game implemented in JavaScript.",
    );
  });

  describe("the language the page shell comes out in", () => {
    afterEach(() => {
      // On the hook rather than at the end of a test body, so that a failing
      // assertion cannot leave the rest of the file running in Russian.
      setLocale(DEFAULT_LOCALE);
    });

    it("writes every word of the shell in Russian", () => {
      setLocale("ru");

      localisePage(page, USER_AGENTS.windows);

      expect(page.title).toBe("Elevator Saga — игра про программирование лифтов");
      expect(page.documentElement.lang).toBe("ru");
      expect(textOf(page.querySelector(".skip-link"))).toBe("Перейти к редактору кода");
      expect(textOf(page.querySelector("h1"))).toBe(
        "Elevator Saga Игра про программирование лифтов",
      );
      expect([...page.querySelectorAll(".header nav a")].map((link) => textOf(link))).toEqual([
        "Справка",
        "Документация",
        "Вики и решения",
      ]);
      // The statistics panel is not checked here: it is the app's, drawn at
      // runtime by `widgets/stats-panel` into a region this file leaves
      // empty, and what it says in Russian is that widget's own
      // `stats-panel.test.ts`'s subject.
      //
      // The run buttons are not checked here: they are the app's, written by
      // `presentControls` into a region this file leaves empty, and what they
      // say in Russian is `app.test.ts`'s subject.
    });

    it("names the things a screen reader announces in Russian too", () => {
      setLocale("ru");

      localisePage(page, USER_AGENTS.windows);

      expect(page.querySelector(".header nav")?.getAttribute("aria-label")).toBe(
        "Справка и документация",
      );
      expect(page.querySelector(".world")?.getAttribute("aria-label")).toBe("Здание");
      expect(page.querySelector(".statscontainer")?.getAttribute("aria-label")).toBe(
        "Статистика симуляции",
      );
      // The panel's own explanatory tooltips are not checked here, the same
      // way its captions are not checked above: `widgets/stats-panel` carries
      // no `title` attribute anywhere in its markup, and neither does
      // `design/ui-mockup.html`'s own stats tiles it was ported from -- the
      // affordance did not move here with the rest of the panel.
    });

    it("tells a crawler what the page is, in the language it is being read in", () => {
      setLocale("ru");

      localisePage(page, USER_AGENTS.windows);

      const content = (property: string): string | null | undefined =>
        page.querySelector(`meta[property="${property}"]`)?.getAttribute("content");
      expect(page.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
        "Elevator Saga — игра про программирование: напишите на JavaScript программу, которая эффективно возит пассажиров.",
      );
      expect(content("og:title")).toBe(page.title);
      expect(content("og:image:alt")).toBe(
        "Четыре лифта возят пассажиров между шестью этажами, а ниже, в редакторе, — управляющая ими программа на JavaScript.",
      );
    });
  });
});

describe("a page shell asking for something the catalogue cannot answer", () => {
  /**
   * Parses a fragment of shell, the way index.html itself is read.
   *
   * @param body - The markup inside `<body>`.
   * @returns The document it parses to.
   */
  function shell(body: string): Document {
    return new DOMParser().parseFromString(
      `<!doctype html><html lang="en"><body>${body}</body></html>`,
      "text/html",
    );
  }

  it("keeps the English it shipped with, and says why on the console", () => {
    const scrap = shell(`
      <p id="missing" ${TEXT_KEY_ATTRIBUTE}="page.nonesuch">Shipped English</p>
      <p id="parameterised" ${TEXT_KEY_ATTRIBUTE}="game.elevator.label">Elevator 1</p>
    `);

    localisePage(scrap, USER_AGENTS.windows);

    expect(textOf(scrap.querySelector("#missing"))).toBe("Shipped English");
    expect(textOf(scrap.querySelector("#parameterised"))).toBe("Elevator 1");
    expect(console.warn).toHaveBeenCalledWith(
      'Ignoring data-i18n="page.nonesuch": the page shell can only name a message that exists and takes no parameters',
    );
    expect(console.warn).toHaveBeenCalledWith(
      'Ignoring data-i18n="game.elevator.label": the page shell can only name a message that exists and takes no parameters',
    );
  });

  it("keeps the attribute it shipped with, and says why on the console", () => {
    const scrap = shell(`
      <div id="unnamed" ${ATTRIBUTE_KEY_ATTRIBUTE}="page.world.label" aria-label="Building"></div>
      <div id="missing" ${ATTRIBUTE_KEY_ATTRIBUTE}="aria-label:page.nonesuch" aria-label="Building"></div>
    `);

    localisePage(scrap, USER_AGENTS.windows);

    expect(scrap.querySelector("#unnamed")?.getAttribute("aria-label")).toBe("Building");
    expect(scrap.querySelector("#missing")?.getAttribute("aria-label")).toBe("Building");
    expect(console.warn).toHaveBeenCalledWith(
      'Ignoring data-i18n-attr="page.world.label": the page shell can only name a message that exists and takes no parameters',
    );
    expect(vi.mocked(console.warn).mock.calls).toHaveLength(2);
  });

  it("fills every attribute an element names", () => {
    // Nothing in index.html needs two today. The form is worth having, and
    // worth covering, because the first element that does need two will be a
    // one-word change rather than a mechanism.
    const scrap = shell(
      `<div id="both" ${ATTRIBUTE_KEY_ATTRIBUTE}="aria-label:page.world.label, title:page.stats.movesTitle"></div>`,
    );

    localisePage(scrap, USER_AGENTS.windows);

    const element = scrap.querySelector("#both");
    expect(element?.getAttribute("aria-label")).toBe("Building");
    expect(element?.getAttribute("title")).toBe(
      "One move is counted each time a car crosses the halfway mark between one floor and the next",
    );
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("puts the platform's own modifier key back after rewriting a message", () => {
    // Nothing in index.html names a message with a `<kbd data-mod-key>` in it
    // today, so the check is made against a scrap rather than the shell -- but
    // the guarantee is the shell's all the same. Any message written with
    // `innerHTML` can carry one, the reference page's own shortcut paragraph
    // does, and a message written here would otherwise tell a Mac player to
    // press a key their keyboard does not have.
    const scrap = shell(`<p ${TEXT_KEY_ATTRIBUTE}="docs.play.shortcuts.html">Ctrl+Enter</p>`);

    localisePage(scrap, USER_AGENTS.mac);

    expect([...scrap.querySelectorAll("kbd[data-mod-key]")].map((key) => textOf(key))).toEqual([
      "⌘",
      "⌘",
    ]);
    expect(console.warn).not.toHaveBeenCalled();
  });
});
