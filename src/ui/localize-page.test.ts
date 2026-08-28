// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import pageSource from "../../index.html?raw";
import { EN_MESSAGES, setLocale, DEFAULT_LOCALE } from "../i18n/index.ts";

import { localizePage, ATTRIBUTE_KEY_ATTRIBUTE, TEXT_KEY_ATTRIBUTE } from "./localize-page.ts";

/** User agent strings for the two answers `modifierKeyLabel` can give. */
const USER_AGENTS = {
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

/** The English catalog, keys forgotten, so a key read from the page can be looked up. */
const ENGLISH_VALUES: Readonly<Record<string, unknown>> = EN_MESSAGES;

/** The page shell, parsed afresh for each test that writes into it. */
let page: Document;

beforeEach(() => {
  page = new DOMParser().parseFromString(pageSource, "text/html");
  // Cleared too: the spy outlives its spec, so later call-count assertions would otherwise see the whole file's warnings.
  vi.spyOn(console, "warn")
    .mockImplementation(() => undefined)
    .mockClear();
});

/** Markup normalized (whitespace collapsed) so page HTML and catalog HTML compare equal regardless of formatting. */
function markupOf(html: string): string {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  return holder.innerHTML.replace(/\s+/g, " ").trim();
}

/** The words of an element, whitespace collapsed as a reader sees it. */
function textOf(element: Element | null): string {
  return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Parses a fragment of shell, the way index.html itself is read. */
function shell(body: string): Document {
  return new DOMParser().parseFromString(
    `<!doctype html><html lang="en"><body>${body}</body></html>`,
    "text/html",
  );
}

/** A message the page shell names, and where it names it. */
interface NamedMessage {
  readonly element: Element;
  /** The attribute it was named in, for a failure that says where to look. */
  readonly attribute: string;
  /** The attribute the message fills, or null when it fills the content. */
  readonly name: string | null;
  readonly key: string;
}

/** Every message the shell names, content and attributes alike, in document order. */
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
    // A guard on the guard: a selector matching nothing would let every assertion below pass on an empty list.
    expect(named.length).toBeGreaterThan(5);
    for (const { attribute, key } of named) {
      const english = ENGLISH_VALUES[key];
      expect(english, `${attribute}="${key}"`).toBeTypeOf("string");
      // The shell is markup, not a call site, so a message that takes a parameter belongs somewhere else.
      expect(String(english), key).not.toMatch(/\{/);
    }
  });

  it("ships, word for word, the English of every message it names", () => {
    // The shell has two independent copies of every sentence — this is what keeps them from drifting apart.
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

describe("localizePage", () => {
  it("leaves the page exactly as it shipped, in the language it shipped in", () => {
    const before = namedMessages(page).map(({ element, name }) =>
      name === null ? markupOf(element.innerHTML) : element.getAttribute(name),
    );

    localizePage(page, USER_AGENTS.windows);

    const after = namedMessages(page).map(({ element, name }) =>
      name === null ? markupOf(element.innerHTML) : element.getAttribute(name),
    );
    expect(after).toEqual(before);
    expect(page.documentElement.lang).toBe("en");
  });

  it("does not touch the slots the presenters fill", () => {
    localizePage(page, USER_AGENTS.windows);

    // The building and stats panels are drawn by widgets that mount into these containers at runtime.
    expect(page.querySelector(".innerworld")?.innerHTML).toBe("");
    expect(page.querySelector(".statscontainer")?.innerHTML).toBe("");
  });

  it("leaves the noscript message in English, where it cannot be reached", () => {
    setLocale("ru");

    localizePage(page, USER_AGENTS.mac);
    setLocale(DEFAULT_LOCALE);

    // DOMParser has scripting disabled, so unlike a real running browser it does see the <noscript> paragraph — making this a real check.
    expect(textOf(page.querySelector("noscript"))).toBe(
      "Your browser does not appear to support JavaScript. This page contains a browser-based " +
        "programming game implemented in JavaScript.",
    );
  });

  it("writes a message that ends in .html as markup rather than as its characters", () => {
    const scrap = shell(`<p ${TEXT_KEY_ATTRIBUTE}="game.appBar.sourceCopyright.html">Shipped</p>`);

    localizePage(scrap, USER_AGENTS.windows);

    const paragraph = scrap.querySelector("p");
    expect(paragraph?.querySelector("a")?.getAttribute("href")).toBe("licenses.txt");
    expect(paragraph?.querySelectorAll("br")).toHaveLength(2);
    expect(textOf(paragraph)).toBe("Elevator Saga © 2015 Magnus Wolffelt, © 2026 EpicDima, MIT");
    expect(console.warn).not.toHaveBeenCalled();
  });

  describe("the language the page shell comes out in", () => {
    afterEach(() => {
      // On the hook, not in the test body, so a failing assertion can't leave the rest of the file running in Russian.
      setLocale(DEFAULT_LOCALE);
    });

    it("writes every word of the shell in Russian", () => {
      setLocale("ru");

      localizePage(page, USER_AGENTS.windows);

      expect(page.title).toBe("Elevator Saga — игра про программирование лифтов, редизайн");
      expect(page.documentElement.lang).toBe("ru");
      expect(textOf(page.querySelector(".skip-link"))).toBe("Перейти к редактору кода");
      // The game's name is not translated; page.brand holds the same string in both catalogs.
      expect(textOf(page.querySelector("h1"))).toBe("Elevator Saga");
      // The statistics panel and run buttons are the app's own widgets, drawn at runtime into regions this file leaves empty; their Russian text is covered by their own tests.
    });

    it("names the things a screen reader announces in Russian too", () => {
      setLocale("ru");

      localizePage(page, USER_AGENTS.windows);

      expect(page.querySelector(".world")?.getAttribute("aria-label")).toBe("Здание");
      expect(page.querySelector(".statscontainer")?.getAttribute("aria-label")).toBe(
        "Статистика симуляции",
      );
      // The panel's own tooltips aren't checked here either: they're written into this
      // region at runtime, by code this file doesn't own.
    });

    it("tells a crawler what the page is, in the language it is being read in", () => {
      setLocale("ru");

      localizePage(page, USER_AGENTS.windows);

      const content = (property: string): string | null | undefined =>
        page.querySelector(`meta[property="${property}"]`)?.getAttribute("content");
      expect(page.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
        "Elevator Saga в новом оформлении: напишите на JavaScript программу, которая эффективно возит пассажиров. 40 уровней в двух главах и обучающем треке, песочница любого размера и повторяемые запуски.",
      );
      expect(content("og:title")).toBe(page.title);
      expect(content("og:image:alt")).toBe(
        "Четыре лифта возят пассажиров между шестью этажами, а ниже, в редакторе, — управляющая ими программа на JavaScript.",
      );
    });
  });
});

describe("a page shell asking for something the catalog cannot answer", () => {
  it("keeps the English it shipped with, and says why on the console", () => {
    const scrap = shell(`
      <p id="missing" ${TEXT_KEY_ATTRIBUTE}="page.nonesuch">Shipped English</p>
      <p id="parameterized" ${TEXT_KEY_ATTRIBUTE}="game.elevator.label">Elevator 1</p>
    `);

    localizePage(scrap, USER_AGENTS.windows);

    expect(textOf(scrap.querySelector("#missing"))).toBe("Shipped English");
    expect(textOf(scrap.querySelector("#parameterized"))).toBe("Elevator 1");
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

    localizePage(scrap, USER_AGENTS.windows);

    expect(scrap.querySelector("#unnamed")?.getAttribute("aria-label")).toBe("Building");
    expect(scrap.querySelector("#missing")?.getAttribute("aria-label")).toBe("Building");
    expect(console.warn).toHaveBeenCalledWith(
      'Ignoring data-i18n-attr="page.world.label": the page shell can only name a message that exists and takes no parameters',
    );
    expect(vi.mocked(console.warn).mock.calls).toHaveLength(2);
  });

  it("fills every attribute an element names", () => {
    // Nothing in index.html needs two attributes on one element yet; this exists so the
    // first thing that does needs only a one-word change, not a new mechanism.
    const scrap = shell(
      `<div id="both" ${ATTRIBUTE_KEY_ATTRIBUTE}="aria-label:page.world.label, title:page.stats.movesTitle"></div>`,
    );

    localizePage(scrap, USER_AGENTS.windows);

    const element = scrap.querySelector("#both");
    expect(element?.getAttribute("aria-label")).toBe("Building");
    expect(element?.getAttribute("title")).toBe(
      "One move is counted each time a car crosses the halfway mark between one floor and the next",
    );
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("labels the modifier keys for the platform, alongside the messages", () => {
    // Relabeling is the last thing localizePage does: writing a message with innerHTML
    // would throw away a `<kbd data-mod-key>` inside it, leaving a Mac player told to press
    // a key their keyboard doesn't have.
    const scrap = shell(`
      <p ${TEXT_KEY_ATTRIBUTE}="page.world.label">Building</p>
      <p><kbd data-mod-key>Ctrl</kbd>+<kbd>Enter</kbd>, <kbd data-mod-key>Ctrl</kbd>+<kbd>S</kbd></p>
    `);

    localizePage(scrap, USER_AGENTS.mac);

    expect([...scrap.querySelectorAll("kbd[data-mod-key]")].map((key) => textOf(key))).toEqual([
      "⌘",
      "⌘",
    ]);
    expect(console.warn).not.toHaveBeenCalled();
  });
});
