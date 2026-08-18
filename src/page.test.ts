// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import packageJson from "../package.json";
import docsSource from "../documentation.html?raw";
import docsRuSource from "../documentation.ru.html?raw";
import pageSource from "../index.html?raw";
import { Elevator } from "./game/elevator.ts";
import { ElevatorInterface, type ElevatorInterfaceEvents } from "./game/elevator-interface.ts";
import { Floor } from "./game/floor.ts";
import { FloorInterface, type FloorInterfaceEvents } from "./game/floor-interface.ts";
import { tutorialTasks } from "./game/tutorial.ts";
import type { MessageKey } from "./i18n/catalogue.ts";
import { EN_MESSAGES } from "./i18n/en.ts";
import { setLocale, DEFAULT_LOCALE } from "./i18n/index.ts";
import { RU_MESSAGES } from "./i18n/ru.ts";
import {
  type ApiCompletion,
  elevatorEvents,
  elevatorMembers,
  floorEvents,
  floorMembers,
  globalCompletions,
} from "./ui/completions.ts";
import { DOCUMENTATION_LINK_ATTRIBUTE, documentationUrl } from "./ui/documentation-links.ts";
import { presentVersion, VERSION_SELECTOR } from "./ui/version.ts";
import { createIcon } from "#shared/ui/icon.ts";

/** The page shell, parsed as the browser would parse it. */
const page = new DOMParser().parseFromString(pageSource, "text/html");

/**
 * Everything about an inline icon that has to match, whitespace aside.
 *
 * @param icon - An `svg.icon` element, hand-written or built by `createIcon`.
 * @returns The attributes that decide what is drawn.
 */
function iconShape(icon: Element): Record<string, string | null> {
  const path = icon.querySelector("path");
  return {
    class: icon.getAttribute("class"),
    viewBox: icon.getAttribute("viewBox"),
    width: icon.getAttribute("width"),
    height: icon.getAttribute("height"),
    fill: icon.getAttribute("fill"),
    ariaHidden: icon.getAttribute("aria-hidden"),
    focusable: icon.getAttribute("focusable"),
    transform: path?.getAttribute("transform") ?? null,
    d: path?.getAttribute("d") ?? null,
  };
}

/**
 * The repository root.
 *
 * This file runs under jsdom, where `import.meta.url` is an `http:` URL for the
 * benefit of the DOM and no use at all to `node:fs`. Vitest runs from the
 * project root, so the working directory is the one thing that does point here.
 */
const ROOT = process.cwd();

/**
 * The tab icon, read from `public/`.
 *
 * Read from disk rather than imported: files under `public/` are copied by the
 * build rather than bundled, so importing one is the mistake this test exists
 * to catch, not the way to reach it.
 */
const faviconSource = readFileSync(join(ROOT, "public/favicon.svg"), "utf8");

/**
 * The content of a `<meta>` tag, whichever attribute names it.
 *
 * @param document - The parsed page.
 * @param name - The `property` or `name` the tag carries.
 * @returns Its `content`, or null if the page has no such tag.
 */
function metaContent(document: Document, name: string): string | null {
  const meta = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
  return meta?.getAttribute("content") ?? null;
}

/** Anything loaded from another origin, which the rewrite got rid of. */
function thirdPartyResources(document: Document): Element[] {
  return [...document.querySelectorAll("link[href], script[src], img[src]")].filter((node) =>
    /^(https?:)?\/\//.test(node.getAttribute("href") ?? node.getAttribute("src") ?? ""),
  );
}

describe("index.html", () => {
  it("is a module entry, with no other scripts", () => {
    const scripts = [...page.querySelectorAll("script")];
    expect(scripts.map((script) => [script.type, script.getAttribute("src")])).toEqual([
      ["module", "/src/main.ts"],
    ]);
  });

  it.each([
    // Queried by src/main.ts.
    ".code",
    "#editor_resize",
    "#save_message",
    "#fitness_message",
    // Drawn into by src/app/app.ts and src/ui/presenters.ts.
    ".challenge",
    ".controls",
    // Drawn into by src/ui/tutorial-panel.ts, and left empty off the track.
    ".tutorial",
    ".innerworld",
    ".statscontainer",
    ".feedbackcontainer",
    ".codestatus",
    // Required by presentStats.
    ".statscontainer .transportedcounter",
    ".statscontainer .elapsedtime",
    ".statscontainer .transportedpersec",
    ".statscontainer .avgwaittime",
    ".statscontainer .avgpickuptime",
    ".statscontainer .avgridetime",
    ".statscontainer .maxwaittime",
    ".statscontainer .movecount",
    ".statscontainer .stopcount",
    ".statscontainer .peopleperstop",
    ".statscontainer .avgloadfactor",
    // Filled and listened to by src/ui/language-picker.ts.
    ".languagepicker",
    // The scrolling frame the world is drawn inside.
    ".world .worldtrack .innerworld",
  ])("provides %s", (selector) => {
    expect(page.querySelector(selector)).not.toBeNull();
  });

  it("announces the end-of-challenge overlay from a container that is always present", () => {
    // presentFeedback builds the overlay complete and then inserts it, so the
    // live region has to be the container: a role="status" that appears in the
    // document already populated is generally announced by nothing.
    const container = page.querySelector(".feedbackcontainer");
    expect(container?.getAttribute("role")).toBe("status");
    expect(container?.textContent).toBe("");
  });

  it.each([
    // The fitness benchmark says it has started and then, seconds later,
    // reports its result from a worker (src/main.ts).
    "#fitness_message",
    // The editor confirms a save (src/main.ts).
    "#save_message",
    // The simulation reports whatever the player's program threw, at any point
    // during a run (src/ui/presenters.ts).
    ".codestatus",
  ])("announces %s, which is written asynchronously", (selector) => {
    const element = page.querySelector(selector);
    expect(element?.getAttribute("aria-live")).toBe("polite");
    // A live region has to be in the document before the text appears inside
    // it; one that arrives already populated is generally not announced.
    expect(element?.textContent).toBe("");
  });

  it.each([".world", ".innerworld", ".statscontainer", ".challenge", ".tutorial"])(
    "leaves %s out of the live regions",
    (selector) => {
      // The building and the statistics change every frame, and the challenge
      // bar changes under the player's own hands. Announcing any of them would
      // bury the messages that do need announcing under continuous noise. The
      // learning track's panel is redrawn whole every time the language changes
      // or a task is cleared, so announcing it would read the entire lesson out
      // again; it is a named region instead, which is how it is reached on
      // purpose.
      const element = page.querySelector(selector);
      expect(element).not.toBeNull();
      expect(element?.getAttribute("aria-live")).toBeNull();
      expect(element?.getAttribute("role")).not.toBe("status");
      expect(element?.getAttribute("role")).not.toBe("alert");
    },
  );

  it("keeps no tooltip as the only copy of what it says", () => {
    // A `title` is a mouse-only tooltip: it never opens for a keyboard or a
    // touch screen, and on a plain `<span>` it is not an accessible description
    // either, because a span has no role for one to hang off. The seed's caveat
    // was one of these and became a `<details>`; this one is left where it is,
    // because what it says is a sentence of the documentation now as well, and
    // a tooltip that quotes something is a shortcut to it rather than the only
    // way to it. So the tooltip is held to being text of that paragraph, word
    // for word, which is what stops the two copies from ever saying different
    // things about the same number.
    //
    // Read from the attribute rather than from the element's text, which is
    // the visible label "Moves" and is in the paragraph whatever the tooltip
    // claims -- the shape this test had while it looked like it was working.
    // The length floor is the rest of that lesson: a word or two would turn up
    // in a paragraph of prose by accident.
    //
    // That the attribute here and the English message are the same string is
    // the drift check in `localise-page.test.ts`, and is not repeated. What is
    // added is the other language: `localisePage` replaces these attributes
    // with the Russian messages, so a Russian tooltip has to quote the Russian
    // paragraph the same way, or a correction lands on one language only.
    const titled = [...page.querySelectorAll("[title]")];
    expect(titled.map((element) => element.className)).toEqual([
      "key",
      "key",
      "key",
      "key",
      "key",
      "key",
    ]);
    // Named here as well as read off the page, so that the Russian half below
    // is typed rather than cast, and so that a row losing its tooltip fails
    // here instead of quietly halving what this test covers.
    const titleKeys = [
      "page.stats.avgPickupTimeTitle",
      "page.stats.avgRideTimeTitle",
      "page.stats.movesTitle",
      "page.stats.stopsTitle",
      "page.stats.peoplePerStopTitle",
      "page.stats.avgLoadTitle",
    ] as const satisfies readonly MessageKey[];
    expect(titled.map((element) => element.getAttribute("data-i18n-attr"))).toEqual(
      titleKeys.map((key) => `title:${key}`),
    );
    for (const [index, key] of titleKeys.entries()) {
      const tooltip = titled[index]?.getAttribute("title") ?? "";
      expect(tooltip.length, key).toBeGreaterThan(20);
      expect(message("en", "docs.play.statistics.html"), key).toContain(tooltip);
      expect(message("ru", "docs.play.statistics.html"), key).toContain(message("ru", key));
    }
  });

  it("lets a keyboard reach the building, which scrolls sideways", () => {
    // .world is a horizontal scroll container, and a scroll container that
    // cannot take focus cannot be scrolled without a mouse. Being in the tab
    // order in turn obliges it to have a role and an accessible name.
    const world = page.querySelector(".world");
    expect(world?.getAttribute("tabindex")).toBe("0");
    expect(world?.getAttribute("role")).toBe("region");
    expect(world?.getAttribute("aria-label")).toBeTruthy();
  });

  it("names the run controls as one group, the way .statscontainer does", () => {
    // .controls holds two different kinds of thing -- four buttons and a
    // speed -- behind one row, and presentControls fills it without ever
    // touching the div itself. A screen reader landing here with no name would
    // read "group" and then four buttons and a speed with nothing to say what
    // they are collectively for.
    const controls = page.querySelector(".controls");
    expect(controls?.getAttribute("role")).toBe("group");
    expect(controls?.getAttribute("aria-label")).toBeTruthy();
  });

  it("offers a way past the building, before anything else in the tab order", () => {
    // WCAG 2.4.1. The building is between the top of the page and the editor,
    // and nearly everything in it takes focus; the editor is what the page is
    // for. The skip link has to come first in the document to be the first stop.
    const skipLink = page.querySelector(".skip-link");
    expect(skipLink).not.toBeNull();
    expect(page.querySelector("a[href], button, [tabindex]")).toBe(skipLink);

    // And it has to name something real: src/main.ts intercepts the click and
    // focuses CodeMirror instead, but the href is the fallback and the reason
    // the link is a link.
    const target = (skipLink?.getAttribute("href") ?? "").slice(1);
    expect(page.querySelector(`[id="${target}"]`)).toBe(page.querySelector(".code"));
  });

  it("names a favicon, drawn here rather than borrowed", () => {
    // There was none at all, so every tab showed the browser's blank-page
    // glyph. The mark is original artwork: the twelve Font Awesome outlines in
    // src/shared/ui/icon.ts were the shorter route, but they are OFL-licensed, and a
    // site's own identity is not a good thing to owe attribution for.
    const icon = page.querySelector("link[rel='icon']");
    expect(icon?.getAttribute("type")).toBe("image/svg+xml");
    expect(icon?.getAttribute("href")).toBe("/favicon.svg");
    expect(faviconSource).toContain("<svg");
  });

  it("describes itself well enough to paste into a chat", () => {
    // Open Graph, so a pasted link becomes a card with the game in it instead
    // of a bare URL. The title and description are not restated here -- a
    // preview that disagrees with the page is its own kind of wrong.
    expect(metaContent(page, "og:type")).toBe("website");
    expect(metaContent(page, "og:title")).toBe(page.title);
    expect(metaContent(page, "og:description")).toBe(metaContent(page, "description"));
    expect(metaContent(page, "og:image:alt")).toBeTruthy();
    expect(metaContent(page, "twitter:card")).toBe("summary_large_image");

    // The image is the screenshot the README uses, kept in `public/` so that
    // one file serves both. Site-relative, because Vite rewrites a leading
    // slash to `base` and this build has to run from any directory; a card
    // with a broken image in it is worse than no card, so check it is there.
    const image = metaContent(page, "og:image") ?? "";
    expect(image).toMatch(/^\/[^/]/);
    expect(existsSync(join(ROOT, "public", image))).toBe(true);
  });

  it("marks the shortcut key the editor binds as Mod-", () => {
    // Mod- is Command on Apple platforms, so the shipped "Ctrl" is wrong there
    // and src/ui/shortcuts.ts rewrites it at load.
    const modKeys = [...page.querySelectorAll(".hint kbd[data-mod-key]")];
    expect(modKeys.map((key) => key.textContent)).toEqual(["Ctrl"]);
  });

  it("has one landmark of each kind, and a single top-level heading", () => {
    expect(page.querySelectorAll("header, main, footer")).toHaveLength(3);
    expect(page.querySelectorAll("h1")).toHaveLength(1);
  });

  it("no longer loads anything from a third party", () => {
    expect(thirdPartyResources(page)).toEqual([]);
    expect(page.documentElement.innerHTML).not.toContain("google-analytics");
  });

  it("shows the version from package.json in the footer", () => {
    // The footer used to carry a hand-written copy of the version, which had
    // to be bumped in step with package.json and silently disagreed with it
    // whenever it was not. The slot is empty in the source now and filled from
    // the constant Vite substitutes at build time.
    const footer = new DOMParser().parseFromString(pageSource, "text/html");
    expect(footer.querySelector(VERSION_SELECTOR)?.textContent).toBe("");

    presentVersion(footer);

    expect(footer.querySelector(VERSION_SELECTOR)?.textContent).toBe(packageJson.version);
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("links to the documentation page", () => {
    const targets = [...page.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(targets).toContain("documentation.html");
    // The reference itself, not just the top of the help page. The anchor is
    // asserted on the other side too, so neither half can move alone.
    expect(targets).toContain("documentation.html#docs");
  });

  it("links into the learning track, from outside the reference landmark", () => {
    // The track's tasks each have an address, and for a while nothing on the
    // page led to any of them: the feature existed only for a player who had
    // been told what to type. This link is the entrance.
    const link = page.querySelector(".tutoriallink");
    expect(link?.tagName).toBe("A");
    // A working address in the shipped markup, before a line of JavaScript has
    // run and for a reader with none. `src/app/app.ts` moves it on to the first
    // task not yet cleared.
    expect(link?.getAttribute("href")).toBe("#challenge=tutorial-1");
    expect(link?.getAttribute("data-i18n")).toBe("page.tutorialLink");
    // Outside the `<nav>`, which is named "Help and reference" and holds three
    // places to *read* about the game. The track is the game, so counting it
    // among them would make the landmark's name lie.
    expect(link?.closest("nav")).toBeNull();
    expect(link?.parentElement?.className).toBe("headertools");
  });

  it("offers the language as one labelled control a keyboard can operate", () => {
    // A `<select>` rather than a row of links: one stop in the tab order instead
    // of one per language, operable from the keyboard and on a touch screen
    // without anything being written here, and it announces the language now in
    // force as its own value -- which a row of links can only do with
    // `aria-current` and a rule about which of them is not a link.
    const picker = page.querySelector(".languagepicker");
    expect(picker?.tagName).toBe("SELECT");
    // Named through the same mechanism as the rest of the shell, so the label
    // is translated by `localisePage` along with everything else. The English
    // shipped in the attribute is held against the catalogue in
    // `localise-page.test.ts`.
    expect(picker?.getAttribute("data-i18n-attr")).toBe("aria-label:page.language.label");
    expect(picker?.getAttribute("aria-label")).toBeTruthy();
    // Outside the `<nav>`, which is named "Help and reference" and lists three
    // places to read about the game; a language control is none of those.
    expect(picker?.closest("nav")).toBeNull();
  });

  it("ships the language picker empty, with nothing to choose until the code runs", () => {
    // The endonyms are built from `LOCALES` in src/ui/language-picker.ts, so
    // adding a third language stays a one-line change and cannot leave a stale
    // copy of the list here. Empty is also what the stylesheet's
    // `.languagepicker:empty` hides: without JavaScript the control could not
    // change anything, and an empty dropdown beside the help links is worse
    // than none.
    const picker = page.querySelector(".languagepicker");
    expect(picker?.childNodes).toHaveLength(0);
  });

  it("marks every link into the reference so the code can retarget it", () => {
    // The bug this closes: both header links pointed at `documentation.html` in
    // every language, so a Russian player following Help landed on the English
    // page while the help note two lines below it went to the Russian one.
    const links = [...page.querySelectorAll(`[${DOCUMENTATION_LINK_ATTRIBUTE}]`)];
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "documentation.html",
      "documentation.html#docs",
    ]);
    // Every one of them, not just the two that exist today: a third link into
    // the reference added without the attribute would go on stranding Russian
    // readers, and nothing else would notice.
    const intoDocs = [...page.querySelectorAll("a")].filter((link) =>
      (link.getAttribute("href") ?? "").startsWith("documentation"),
    );
    // With one exception, and the reason it is one: the help note's link is
    // written inside the message `page.helpNote.html`, so the translation
    // chooses where it points -- the Russian note already points at
    // documentation.ru.html -- and `localisePage` replaces that paragraph
    // wholesale, any attribute in it included.
    const insideAMessage = intoDocs.filter((link) => {
      const parent = link.parentElement;
      return parent !== null && parent.closest("[data-i18n]") !== null;
    });
    expect(insideAMessage.map((link) => link.textContent)).toEqual(["Help and API documentation"]);
    expect(intoDocs.filter((link) => !insideAMessage.includes(link))).toEqual(links);
  });

  it("ships exactly what the code would write for English, anchors and all", () => {
    // What the file holds is what a reader with no JavaScript follows, so the
    // two have to agree; and the fragment has to name something real on the
    // other side, in both languages, or the link lands at the top of a page the
    // player was already looking at.
    for (const link of page.querySelectorAll(`[${DOCUMENTATION_LINK_ATTRIBUTE}]`)) {
      const fragment = link.getAttribute(DOCUMENTATION_LINK_ATTRIBUTE) ?? "";
      expect(link.getAttribute("href"), fragment).toBe(documentationUrl("en", fragment));
      if (fragment === "") {
        continue;
      }
      for (const language of ["en", "ru"] as const) {
        expect(
          pageIn(language).document.querySelector(`[id="${fragment}"]`),
          `${fragment} in ${TRANSLATIONS[language]}`,
        ).not.toBeNull();
      }
    }
  });

  it("names a real file for every language the game is played in", () => {
    // `documentationUrl` maps a locale to a page, and a page that is not in the
    // repository is a 404 the moment somebody switches language.
    for (const language of Object.keys(TRANSLATIONS) as Language[]) {
      expect(documentationUrl(language), language).toBe(TRANSLATIONS[language]);
      expect(existsSync(join(ROOT, TRANSLATIONS[language])), language).toBe(true);
    }
  });

  it("links to the licence notices the build emits", () => {
    // MIT wants its notice to travel with the software and OFL wants the font
    // licence bundled with the font, so `dist/` carries `licenses.txt` (emitted
    // by vite.config.ts). A notice nobody can reach is not a notice: the link
    // is what makes it one, so it is asserted here rather than left to chance.
    const targets = [...page.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(targets).toContain("licenses.txt");
  });
});

/**
 * The reference page, in every language it is published in.
 *
 * `documentation.ru.html` is a translation of `documentation.html` and not a
 * page of its own: same headings, same tables in the same order, same anchors,
 * same examples, with only the prose and the comments inside the examples in
 * Russian. Every check below therefore runs over both of them, and the parity
 * block at the end is what holds them to being one document in two languages
 * rather than two documents about the same subject.
 */
const TRANSLATIONS = {
  en: "documentation.html",
  ru: "documentation.ru.html",
} as const;

/** A language {@link TRANSLATIONS} publishes the reference page in. */
type Language = keyof typeof TRANSLATIONS;

/**
 * One reference page, and the few things about reading it that its language
 * decides.
 *
 * Only prose is translated, so only prose has to be described here: the `<h3>`
 * a table sits under, and the first cell of its header row, which is what tells
 * a property table apart from an event table. Everything the guard actually
 * holds against the code — member names, event names, the calls inside the
 * examples — is an identifier, and identifiers read the same on both pages.
 */
interface ReferencePage {
  /** The file it lives in, which is also what names it in the test output. */
  readonly file: string;
  /** Its `lang` attribute, and its key in {@link TRANSLATIONS}. */
  readonly language: Language;
  /** Parsed the way the browser would parse it. */
  readonly document: Document;
  /** The `<h3>` headings the API tables sit under. */
  readonly headings: Readonly<Record<"eventMethods" | "elevator" | "floor", string>>;
  /** The first header cell of each kind of table. */
  readonly columns: Readonly<Record<"method" | "property" | "event", string>>;
}

/** Every page {@link TRANSLATIONS} names, parsed and ready to be read. */
const DOCUMENTATION_PAGES: readonly ReferencePage[] = [
  {
    file: TRANSLATIONS.en,
    language: "en",
    document: new DOMParser().parseFromString(docsSource, "text/html"),
    headings: {
      eventMethods: "Event methods",
      elevator: "Elevator object",
      floor: "Floor object",
    },
    columns: { method: "Method", property: "Property", event: "Event" },
  },
  {
    file: TRANSLATIONS.ru,
    language: "ru",
    document: new DOMParser().parseFromString(docsRuSource, "text/html"),
    headings: {
      eventMethods: "Методы событий",
      elevator: "Объект лифта",
      floor: "Объект этажа",
    },
    columns: { method: "Метод", property: "Свойство", event: "Событие" },
  },
];

/**
 * The reference page written in one language.
 *
 * @param language - Which one.
 * @returns Its entry in {@link DOCUMENTATION_PAGES}.
 * @throws If there is no such page, which {@link TRANSLATIONS} rules out.
 */
function pageIn(language: Language): ReferencePage {
  const found = DOCUMENTATION_PAGES.find((candidate) => candidate.language === language);
  if (found === undefined) {
    throw new Error(`No reference page in ${language}`);
  }
  return found;
}

/** The build configuration, as text; see "is an entry point of the build". */
const viteConfigSource = readFileSync(join(ROOT, "vite.config.ts"), "utf8");

describe.each(DOCUMENTATION_PAGES)("$file", (reference) => {
  const docs = reference.document;

  it("is a module entry, with no other scripts", () => {
    const scripts = [...docs.querySelectorAll("script")];
    expect(scripts.map((script) => [script.type, script.getAttribute("src")])).toEqual([
      ["module", "/src/docs.ts"],
    ]);
  });

  it("keeps the #docs anchor the game links to", () => {
    expect(docs.querySelector("#docs")).not.toBeNull();
  });

  it("declares the language it is written in", () => {
    expect(docs.documentElement.getAttribute("lang")).toBe(reference.language);
  });

  it("names every language it exists in, its own included", () => {
    // Both pages list both versions, each including itself: that is what lets
    // a crawler arriving at either one see the pair, and it means neither page
    // has a different set of alternates to keep up to date.
    const alternates = [...docs.querySelectorAll("link[rel='alternate']")].map((link) => [
      link.getAttribute("hreflang"),
      link.getAttribute("href"),
    ]);
    expect(alternates).toEqual(Object.entries(TRANSLATIONS));

    // Each of them marked `vite-ignore`, which is what stops the build from
    // resolving it. Vite reads the `href` of every `<link>` as an asset
    // reference without looking at `rel`, so an unmarked alternate has a
    // second, hashed copy of the page emitted into `dist/assets/` and is
    // rewritten to point at that: in the built site the two versions would
    // advertise each other at URLs nothing else links to.
    for (const link of docs.querySelectorAll("link[rel='alternate']")) {
      expect(link.hasAttribute("vite-ignore"), link.outerHTML).toBe(true);
    }
  });

  it("offers a reader a visible way to the other language", () => {
    // The `<link>`s above are for machines. Someone who cannot read the page
    // in front of them needs something to click, and it is named in the
    // language it leads to -- "Русский", not "Russian" -- because that is the
    // word they can be relied on to recognise.
    for (const [language, file] of Object.entries(TRANSLATIONS)) {
      if (file === reference.file) {
        continue;
      }
      const link = [...docs.querySelectorAll("header a")].find(
        (candidate) => candidate.getAttribute("href") === file,
      );
      expect(link?.textContent.trim(), file).toBeTruthy();
      expect(link?.getAttribute("lang"), file).toBe(language);
      expect(link?.getAttribute("hreflang"), file).toBe(language);
    }
  });

  it("is an entry point of the build", () => {
    // Vite only processes the HTML files named in `rolldownOptions.input`, so
    // a page left out of it is simply absent from `dist/`, and the link
    // between the two versions is a 404 in the built site while working
    // perfectly in the dev server. Matched as text rather than imported: the
    // config drags in Vite's plugin types, and `input` is a three-way union
    // that a single assertion would have to narrow for no gain. Matched as a
    // whole entry rather than as a substring, so that a filename mentioned in
    // a comment -- an entry commented out being exactly how a page goes
    // missing -- does not pass for one that is built.
    expect(viteConfigSource).toMatch(
      new RegExp(String.raw`^\s+\w+: "${reference.file.replaceAll(".", "\\.")}",$`, "m"),
    );
  });

  it("shows the same favicon as the game", () => {
    // Two entry points, one site: a tab that changes its icon when you follow
    // the Help link reads as a different site.
    const icon = docs.querySelector("link[rel='icon']");
    expect(icon?.getAttribute("href")).toBe(
      page.querySelector("link[rel='icon']")?.getAttribute("href"),
    );
  });

  it("links back to the game", () => {
    const targets = [...docs.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(targets).toContain("index.html");
  });

  it("links to the licence notices as well, being served from the same place", () => {
    const targets = [...docs.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(targets).toContain("licenses.txt");
  });

  it("has one landmark of each kind, and a single top-level heading", () => {
    expect(docs.querySelectorAll("header, main, footer")).toHaveLength(3);
    expect(docs.querySelectorAll("h1")).toHaveLength(1);
  });

  it("gives every table a row-wrapped header with scoped columns", () => {
    const tables = [...docs.querySelectorAll("table.doctable")];
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      const headerCells = [...table.querySelectorAll("thead tr th")];
      expect(headerCells.length).toBeGreaterThan(0);
      expect(headerCells.every((cell) => cell.getAttribute("scope") === "col")).toBe(true);
      // Column widths moved from `width` attributes to `<col>` classes.
      expect(table.querySelector("colgroup")).not.toBeNull();
      expect(table.querySelector("[width]")).toBeNull();
      // Every other check here reads the first cell of a row and stops, so a
      // row that lost one -- the easiest thing to drop while translating a
      // wall of `<td>`s -- would go unnoticed while rendering misaligned.
      for (const row of table.querySelectorAll("tbody tr")) {
        expect(row.querySelectorAll("td"), row.textContent.trim()).toHaveLength(headerCells.length);
      }
    }
  });

  it("no longer loads anything from a third party", () => {
    expect(thirdPartyResources(docs)).toEqual([]);
    expect(docs.documentElement.innerHTML).not.toContain("google-analytics");
    expect(docs.documentElement.innerHTML).not.toContain("highlight");
  });

  it("draws the same plus and minus icons the challenge bar draws", () => {
    // The page is static, so the two icons in "How to play" are written out by
    // hand instead of built by createIcon. Nothing else would notice them
    // drifting from src/shared/ui/icon.ts -- or from each other, the plus and the
    // minus being one character apart in the path data.
    expect([...docs.querySelectorAll(".icon")].map(iconShape)).toEqual([
      iconShape(createIcon("plus", "emphasis-color")),
      iconShape(createIcon("minus", "emphasis-color")),
    ]);
  });

  it("marks the shortcut keys the editor binds as Mod-", () => {
    const modKeys = [...docs.querySelectorAll("kbd[data-mod-key]")];
    expect(modKeys.map((key) => key.textContent)).toEqual(["Ctrl", "Ctrl"]);
  });

  it("resolves every link it makes to itself", () => {
    const anchors = [...docs.querySelectorAll("a[href^='#']")].map((link) =>
      link.getAttribute("href"),
    );
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(docs.querySelector(`[id="${(anchor ?? "").slice(1)}"]`), anchor ?? "").not.toBeNull();
    }
  });
});

/**
 * The `doctable`s that belong to one `<h3>`, in document order.
 *
 * The API reference is a flat run of headings and tables rather than nested
 * sections, so a table belongs to the last heading before it.
 *
 * @param document - The page to read.
 * @param heading - The exact text of the `<h3>`, in that page's language.
 * @returns The tables under it; empty when there is no such heading.
 */
function tablesUnder(document: Document, heading: string): Element[] {
  const start = [...document.querySelectorAll("h3")].find((node) => node.textContent === heading);
  const tables: Element[] = [];
  for (
    let node = start?.nextElementSibling ?? null;
    node !== null && !/^H[1-6]$/.test(node.tagName);
    node = node.nextElementSibling
  ) {
    if (node.matches("table.doctable")) {
      tables.push(node);
    }
  }
  return tables;
}

/**
 * The names in the first column of one of a heading's tables.
 *
 * @param reference - The page to read.
 * @param heading - The `<h3>` the table sits under.
 * @param column - What its first header cell says, which is what tells the
 * property table of a section apart from the event table.
 * @returns The first-column text of every body row, in the order documented.
 */
function documentedNames(reference: ReferencePage, heading: string, column: string): string[] {
  const table = tablesUnder(reference.document, heading).find(
    (candidate) => candidate.querySelector("thead th")?.textContent.trim() === column,
  );
  return [...(table?.querySelectorAll("tbody tr") ?? [])].map(
    (row) => row.querySelector("td")?.textContent.trim() ?? "",
  );
}

/** What one reference page says the two facades give player code. */
interface DocumentedApi {
  /** The methods every elevator and every floor publishes alike. */
  readonly eventMethods: readonly string[];
  /** What the elevator property table lists, event methods aside. */
  readonly elevatorProperties: readonly string[];
  /** What the floor property table lists, event methods aside. */
  readonly floorProperties: readonly string[];
  /** Everything the page says an elevator handed to player code can do. */
  readonly elevatorMembers: readonly string[];
  /** Everything the page says a floor handed to player code can do. */
  readonly floorMembers: readonly string[];
  /** The event names the page tells players to subscribe an elevator to. */
  readonly elevatorEvents: readonly string[];
  /** The event names the page tells players to subscribe a floor to. */
  readonly floorEvents: readonly string[];
}

/**
 * Reads the API tables of one page.
 *
 * @param reference - The page.
 * @returns Everything it promises player code, in the order it promises it.
 */
function documentedApi(reference: ReferencePage): DocumentedApi {
  const { headings, columns } = reference;
  const eventMethods = documentedNames(reference, headings.eventMethods, columns.method);
  const elevatorProperties = documentedNames(reference, headings.elevator, columns.property);
  const floorProperties = documentedNames(reference, headings.floor, columns.property);
  return {
    eventMethods,
    elevatorProperties,
    floorProperties,
    // The event methods sit in their own table because both facades have them.
    elevatorMembers: [...elevatorProperties, ...eventMethods],
    floorMembers: [...floorProperties, ...eventMethods],
    elevatorEvents: documentedNames(reference, headings.elevator, columns.event),
    floorEvents: documentedNames(reference, headings.floor, columns.event),
  };
}

/**
 * The HTML comments a page's source carries, in document order.
 *
 * They are part of the page the way a code comment is part of the code: the
 * reasons the undocumented facade members are undocumented are written nowhere
 * else in the file, and are what the next person to read the table finds.
 *
 * @param document - The page.
 * @returns The text of each comment.
 */
function sourceNoteTexts(document: Document): string[] {
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_COMMENT);
  const notes: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    notes.push(node.textContent ?? "");
  }
  return notes;
}

/**
 * Every name player code can reach on a facade.
 *
 * The same walk `completions.test.ts`, `elevator-interface.test.ts` and
 * `floor-interface.test.ts` use to pin their surface: own properties first,
 * then up the prototype chain, so instance fields like `destinationQueue` are
 * counted alongside the methods. `getOwnPropertyNames` reads the descriptors,
 * so a getter such as the floor's `buttonStates` is found without being
 * invoked.
 *
 * @param facade - An instance of the facade.
 * @returns Its property names.
 */
function exposedNames(facade: object): Set<string> {
  const exposed = new Set<string>();
  for (
    let proto: object | null = facade;
    proto !== null && proto !== Object.prototype;
    proto = Object.getPrototypeOf(proto) as object | null
  ) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      exposed.add(key);
    }
  }
  exposed.delete("constructor");
  return exposed;
}

/**
 * Elevator members the reference pages leave out on purpose, and why.
 *
 * Anything reachable on the facade and neither documented nor listed here fails
 * the tests below, so a member added to `ElevatorInterface` cannot quietly stay
 * unwritten-down: whoever adds it has to either give it a table row or say here
 * why players are not told about it. The same reasons are repeated as an HTML
 * comment in the table the member is missing from — in each translation of it,
 * since the pages are checked against this list one by one — for the benefit of
 * anyone reading a page's source rather than this file.
 */
const UNDOCUMENTED_ELEVATOR_MEMBERS: Readonly<Record<string, string>> = {
  trigger:
    "Only reachable because the legacy facade was a riot observable. Raising the game's own events from player code is not something to recommend.",
  getFirstPressedFloor:
    "Deprecated: warns on the console and is scheduled for removal. getPressedFloors is the supported way to ask.",
};

/** Floor members the reference pages leave out on purpose; see above. */
const UNDOCUMENTED_FLOOR_MEMBERS: Readonly<Record<string, string>> = {
  level: "floorNum() is the supported spelling of the same number; kept only for old solutions.",
  buttonStates:
    "Better watched through the documented buttonstate_change event than polled; kept only for old solutions.",
};

/**
 * Every event an elevator raises, and why the page leaves it out; `null` for
 * the ones it documents.
 *
 * Keyed by the facade's own event map, so an event added to
 * `ElevatorInterface` does not compile here until somebody has decided whether
 * players are told about it. That is the compile-time half of the guard; the
 * runtime half is {@link checkDocumentedEvents}.
 */
const ELEVATOR_EVENT_DECISIONS: Readonly<Record<keyof ElevatorInterfaceEvents, string | null>> = {
  idle: null,
  floor_button_pressed: null,
  passing_floor: null,
  stopped_at_floor: null,
};

/** Every event a floor raises; see {@link ELEVATOR_EVENT_DECISIONS}. */
const FLOOR_EVENT_DECISIONS: Readonly<Record<keyof FloorInterfaceEvents, string | null>> = {
  up_button_pressed: null,
  down_button_pressed: null,
  hall_button_pressed: null,
  buttonstate_change: null,
};

/**
 * Checks one facade's event names against the page, in both directions.
 *
 * @param documented - The event names scraped out of the page.
 * @param decisions - Every event the facade really raises, and why the page
 * leaves it out.
 */
function checkDocumentedEvents(
  documented: readonly string[],
  decisions: Readonly<Record<string, string | null>>,
): void {
  const names = new Set(documented);
  const decided = Object.entries(decisions);
  // Documented but not raised: a typo in the table, or an event since renamed.
  // Players would be subscribing handlers that can never run.
  expect(documented.filter((name) => !Object.hasOwn(decisions, name))).toEqual([]);
  // Raised and meant to be documented, but missing from the table.
  expect(
    decided.filter(([name, reason]) => reason === null && !names.has(name)).map(([name]) => name),
  ).toEqual([]);
  // Left out on purpose, and then documented anyway: the excuse is stale.
  expect(
    decided.filter(([name, reason]) => reason !== null && names.has(name)).map(([name]) => name),
  ).toEqual([]);
}

/**
 * A live elevator facade, built the way `elevator-interface.test.ts` does.
 *
 * @returns The facade.
 */
function elevatorFacade(): ElevatorInterface {
  return new ElevatorInterface(new Elevator(1.5, 4, 40), 4, () => undefined);
}

/**
 * A live floor facade, built the way `floor-interface.test.ts` does.
 *
 * @returns The facade.
 */
function floorFacade(): FloorInterface {
  return new FloorInterface(new Floor(2, 100, () => undefined), () => undefined);
}

describe.each(DOCUMENTATION_PAGES)(
  "$file, against the facades player code is handed",
  (reference) => {
    const docs = reference.document;
    const documented = documentedApi(reference);

    it("reads the tables it means to check", () => {
      // Every check below is a set difference, and a set difference against an
      // empty set passes quietly. A page restructured out from under the scraper
      // has to fail here rather than silently stop testing anything -- and a
      // translation that translated a heading without saying so here would
      // otherwise read as a page with no API in it at all.
      expect(documented.eventMethods).toEqual(["on", "once", "one", "off", "offAll"]);
      expect(documented.floorProperties).toEqual(["floorNum"]);
      expect(documented.elevatorProperties.length).toBeGreaterThan(10);
      expect(documented.elevatorEvents.length).toBeGreaterThan(0);
      expect(documented.floorEvents.length).toBeGreaterThan(0);
    });

    it("documents every member the elevator facade has", () => {
      const named = new Set(documented.elevatorMembers);
      const undocumented = [...exposedNames(elevatorFacade())].filter(
        (name) => !named.has(name) && !Object.hasOwn(UNDOCUMENTED_ELEVATOR_MEMBERS, name),
      );
      // Failing here means ElevatorInterface grew a member this page does not
      // mention. Give it a row in the elevator table, taking the wording from its
      // JSDoc, or list it in UNDOCUMENTED_ELEVATOR_MEMBERS with the reason and
      // repeat that reason in the table's HTML comment.
      expect(undocumented).toEqual([]);
    });

    it("documents every member the floor facade has", () => {
      const named = new Set(documented.floorMembers);
      const undocumented = [...exposedNames(floorFacade())].filter(
        (name) => !named.has(name) && !Object.hasOwn(UNDOCUMENTED_FLOOR_MEMBERS, name),
      );
      expect(undocumented).toEqual([]);
    });

    it("documents nothing the facades do not have", () => {
      // The other direction: a member that was renamed or removed would otherwise
      // stay on the page, and a player following it writes code that throws. It
      // also catches a translator who translated an identifier: a Russian word in
      // the first column is a member no facade has.
      const elevator = exposedNames(elevatorFacade());
      expect(documented.elevatorMembers.filter((name) => !elevator.has(name))).toEqual([]);
      const floor = exposedNames(floorFacade());
      expect(documented.floorMembers.filter((name) => !floor.has(name))).toEqual([]);
    });

    it("says in its own source why each undocumented member is left out", () => {
      // The lists above are the machine-readable half of the omissions; the
      // HTML comment in the table each member is missing from is the half a
      // maintainer actually meets, and the only place the reasoning is
      // written down for someone reading the page rather than this file.
      // Without this, a translation could drop the comment from one page and
      // keep the count right by adding a trivial one somewhere else.
      const notes = sourceNoteTexts(docs).join("\n");
      for (const name of [
        ...Object.keys(UNDOCUMENTED_ELEVATOR_MEMBERS),
        ...Object.keys(UNDOCUMENTED_FLOOR_MEMBERS),
      ]) {
        expect(notes, name).toContain(name);
      }
    });

    it("keeps the omissions honest", () => {
      // A member that stops existing should take its excuse with it, and one that
      // gets documented after all should lose it.
      const elevator = exposedNames(elevatorFacade());
      const elevatorOmissions = Object.keys(UNDOCUMENTED_ELEVATOR_MEMBERS);
      expect(elevatorOmissions.filter((name) => !elevator.has(name))).toEqual([]);
      expect(elevatorOmissions.filter((name) => documented.elevatorMembers.includes(name))).toEqual(
        [],
      );

      const floor = exposedNames(floorFacade());
      const floorOmissions = Object.keys(UNDOCUMENTED_FLOOR_MEMBERS);
      expect(floorOmissions.filter((name) => !floor.has(name))).toEqual([]);
      expect(floorOmissions.filter((name) => documented.floorMembers.includes(name))).toEqual([]);
    });

    it("names exactly the events the elevator facade raises", () => {
      checkDocumentedEvents(documented.elevatorEvents, ELEVATOR_EVENT_DECISIONS);
    });

    it("names exactly the events the floor facade raises", () => {
      checkDocumentedEvents(documented.floorEvents, FLOOR_EVENT_DECISIONS);
    });

    it("subscribes to real events in every example it prints", () => {
      // The tables are not the only place event names appear: "Listening for
      // events" and the "Event methods" examples spell them out too, and a name
      // that is wrong there is wrong in the code a player copies.
      const real = new Set([
        ...Object.keys(ELEVATOR_EVENT_DECISIONS),
        ...Object.keys(FLOOR_EVENT_DECISIONS),
      ]);
      const calls = [...docs.querySelectorAll("code")].flatMap((code) => [
        ...code.textContent.matchAll(/\.(?:on|once|one|off)\("([\w ]+)"/g),
      ]);
      expect(calls.length).toBeGreaterThan(0);
      // Space separated names subscribe to all of them, so each is checked.
      const unknown = calls
        .flatMap((call) => (call[1] ?? "").split(" "))
        .filter((n) => !real.has(n));
      expect(unknown).toEqual([]);
    });
  },
);

/**
 * The example code of one page, comments removed.
 *
 * Only the comments in an example are translated; the code around them is what
 * a player copies into the editor and has to be the same in every language. The
 * examples on this page have no `//` inside a string literal, so taking the
 * rest of the line off at the first one is enough to leave exactly the code.
 *
 * @param example - The text of one `<pre><code>` block.
 * @returns The same block with every comment and the space before it gone.
 */
function codeOnly(example: string): string {
  return example
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trimEnd())
    .join("\n");
}

/**
 * Every example a page prints, in document order.
 *
 * @param document - The page.
 * @returns The text of each `<pre><code>` block.
 */
function examples(document: Document): string[] {
  return [...document.querySelectorAll("pre code")].map((code) => code.textContent);
}

/**
 * The `id`s a page defines, in document order.
 *
 * @param document - The page.
 * @returns Every `id`, which is every place a link can point at.
 */
function anchors(document: Document): string[] {
  return [...document.querySelectorAll("[id]")].map((element) => element.id);
}

/**
 * How a page is built, ignoring every word in it.
 *
 * @param document - The page.
 * @returns The heading levels of the reference, in order, and the size of each
 * table under them as `columns x rows`.
 */
function outline(document: Document): string[] {
  return [
    ...[...document.querySelectorAll("main h2, main h3")].map((heading) => heading.tagName),
    ...[...document.querySelectorAll("table.doctable")].map(
      (table) =>
        `${String(table.querySelectorAll("thead th").length)}x${String(table.querySelectorAll("tbody tr").length)}`,
    ),
  ];
}

describe("documentation.html and documentation.ru.html, as one document in two languages", () => {
  const english = pageIn("en");
  const russian = pageIn("ru");

  it("documents the same members, in the same order", () => {
    // The facade checks above run over each page on its own, and each of them
    // passes for a page that documents a subset. This is what makes a method
    // added to one page and not the other a failure rather than a slow drift.
    const left = documentedApi(english);
    const right = documentedApi(russian);
    expect(right.eventMethods).toEqual(left.eventMethods);
    expect(right.elevatorProperties).toEqual(left.elevatorProperties);
    expect(right.floorProperties).toEqual(left.floorProperties);
  });

  it("documents the same events, in the same order", () => {
    const left = documentedApi(english);
    const right = documentedApi(russian);
    expect(right.elevatorEvents).toEqual(left.elevatorEvents);
    expect(right.floorEvents).toEqual(left.floorEvents);
  });

  it("offers the same anchors, and the same links to them", () => {
    // A reader following a link from one language has to land in the same place
    // in the other, and `index.html` links straight into #docs.
    expect(anchors(russian.document)).toEqual(anchors(english.document));
    const internalLinks = (document: Document): (string | null)[] =>
      [...document.querySelectorAll("a[href^='#']")].map((link) => link.getAttribute("href"));
    expect(internalLinks(russian.document)).toEqual(internalLinks(english.document));
  });

  it("prints the same examples, translated only in their comments", () => {
    const left = examples(english.document);
    const right = examples(russian.document);
    expect(right).toHaveLength(left.length);
    expect(right.map(codeOnly)).toEqual(left.map(codeOnly));
    // And the comments really are translated, block by block: a block with a
    // comment in it that came through byte for byte is one nobody has read.
    // Checked one at a time, because comparing the two lists as a whole is
    // satisfied by a single translated block out of thirty-two.
    expect(left.filter((block) => block.includes("//")).length).toBeGreaterThan(0);
    right.forEach((block, index) => {
      const original = left[index] ?? "";
      if (original.includes("//")) {
        expect(block, original).not.toBe(original);
      }
    });
  });

  it("is built the same way, table for table", () => {
    expect(outline(russian.document)).toEqual(outline(english.document));
  });

  it("carries the same notes in its source", () => {
    // The reasons the four undocumented facade members are undocumented live in
    // HTML comments, one per table, and are as much part of the page as its
    // prose. Counting them is crude -- what each one has to say is checked
    // against the facades above -- but it is the difference between a
    // translation that dropped them and one that did not.
    expect(sourceNoteTexts(russian.document)).toHaveLength(
      sourceNoteTexts(english.document).length,
    );
  });

  it("offers the learning track to a beginner, in both languages", () => {
    // This page is where the game's header sends somebody who does not know the
    // API yet, so it is the one place a player can arrive at already knowing
    // they are out of their depth. The track's own way in is a link in the
    // header of the *game*, which is the page they have just left.
    const [firstTask] = tutorialTasks;
    if (firstTask === undefined) {
      throw new Error("The learning track has no tasks to offer");
    }
    // Built from the task's id rather than written out, so renaming task one
    // fails here instead of leaving both pages pointing at an address that
    // resolves to the track's start with a console warning -- which is what a
    // dead task address does, and it would look like the link still worked.
    const href = `index.html#challenge=${firstTask.id}`;
    for (const { file, document } of DOCUMENTATION_PAGES) {
      const links = [...document.querySelectorAll(`a[href="${href}"]`)];
      expect(links, file).toHaveLength(1);
      // Directly under a heading, which is "How to play" in both pages: an
      // offer a beginner has to scroll past the whole API to reach is one that
      // only ever finds the reader who needed it least.
      expect(links[0]?.closest("p")?.previousElementSibling?.tagName, file).toBe("H2");
    }
  });
});

/**
 * The message catalogue of every language a page is published in.
 *
 * Typed loosely on purpose: `MessageCatalogue<"en">` and `MessageCatalogue<"ru">`
 * are different types -- their plural messages have different sets of forms --
 * so indexing the union of the two by a key yields a union of values that every
 * read below would have to narrow again. Nothing here cares which language it
 * is holding, only what a key says in it.
 */
const CATALOGUES: Readonly<Record<Language, Readonly<Record<string, unknown>>>> = {
  en: EN_MESSAGES,
  ru: RU_MESSAGES,
};

/** Every message key the reference pages are answerable for. */
const DOCS_KEYS: readonly MessageKey[] = Object.keys(EN_MESSAGES).filter((key): key is MessageKey =>
  key.startsWith("docs."),
);

/** Every message key the completion popup is answerable for. */
const COMPLETION_KEYS: readonly MessageKey[] = Object.keys(EN_MESSAGES).filter(
  (key): key is MessageKey => key.startsWith("completion."),
);

/** A `{name}` the game fills in before anyone reads the message. */
const PLACEHOLDER = /\{\w+\}/g;

/**
 * What one message says.
 *
 * @param language - The catalogue to read it from.
 * @param key - The message.
 * @returns Its value.
 * @throws If it has plural forms. Nothing checked here counts anything, and a
 * key that started to would otherwise be compared as "[object Object]" and
 * quietly match nothing on the page.
 */
function message(language: Language, key: MessageKey): string {
  const value = CATALOGUES[language][key];
  if (typeof value !== "string") {
    throw new Error(`${key} has plural forms, and nothing on the page prints one`);
  }
  return value;
}

/** Whitespace the way HTML collapses it, so that source wrapping stops counting. */
function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Markup in the single form the browser agrees to.
 *
 * Parsed and serialised again, so that `<br />` against `<br>`, an attribute in
 * single quotes against one in double, and a sentence wrapped across four
 * source lines are not differences. What is left is the tags, their attributes
 * and the words.
 *
 * @param html - Markup, from either side.
 * @returns The same markup, comparable.
 */
function normalizeMarkup(html: string): string {
  const holder = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  return collapse(holder.body.innerHTML);
}

/**
 * The words of a message, markup and placeholders gone.
 *
 * @param value - The message.
 * @returns What is left to read.
 */
function textOf(value: string): string {
  const holder = new DOMParser().parseFromString(
    `<body>${value.replaceAll(PLACEHOLDER, "")}</body>`,
    "text/html",
  );
  return collapse(holder.body.textContent);
}

/**
 * Checks that a message and the place on the page it was lifted from agree.
 *
 * Compared as markup rather than as text: these values are what the page will
 * be built from once the interface is wired through `src/i18n`, so an emphasis
 * or a link that did not survive the copy is a real difference and not a matter
 * of presentation.
 *
 * A message with a `{placeholder}` in it is the exception. The page has the
 * thing itself where the message has only its name -- the two inline icons of
 * "How to play" -- so there only the words around it can be compared.
 *
 * @param element - Where the page says it, or null if the page has nowhere.
 * @param reference - The page.
 * @param key - The message.
 */
function expectSays(element: Element | null, reference: ReferencePage, key: MessageKey): void {
  expect(element, key).not.toBeNull();
  const value = message(reference.language, key);
  if (value.match(PLACEHOLDER) !== null) {
    expect(textOf(value), key).toBe(collapse(element?.textContent ?? ""));
    return;
  }
  expect(normalizeMarkup(value), key).toBe(normalizeMarkup(element?.innerHTML ?? ""));
}

/**
 * Checks a run of elements against the messages that fill it.
 *
 * The page puts no ids on its paragraphs and no attribute ties one to a key --
 * it is a static document, and marking it up for the convenience of a test
 * would be the tail wagging the dog -- so a run of elements is matched against
 * the run of keys that describes it. Count and order come with that: a
 * paragraph added, dropped or moved fails here, where checking that each key
 * turns up somewhere on the page would not.
 *
 * @param reference - The page.
 * @param selector - What matches the run.
 * @param keys - What it says, in order.
 */
function expectRun(reference: ReferencePage, selector: string, keys: readonly MessageKey[]): void {
  const elements = [...reference.document.querySelectorAll(selector)];
  expect(elements.length, selector).toBe(keys.length);
  keys.forEach((key, index) => {
    expectSays(elements[index] ?? null, reference, key);
  });
}

/** The messages of the page shell, each checked where it belongs. */
const SHELL_KEYS: readonly MessageKey[] = [
  "docs.page.title",
  "docs.page.description",
  "docs.page.tagline",
  "docs.nav.label",
  "docs.nav.back",
];

/** The `<h2>`s of the reference, in the order the page prints them. */
const SECTION_HEADINGS: readonly MessageKey[] = [
  "docs.about.heading",
  "docs.play.heading",
  "docs.basics.heading",
  "docs.examples.heading",
  "docs.api.heading",
];

/** Its `<h3>`s, likewise. */
const SUBSECTION_HEADINGS: readonly MessageKey[] = [
  "docs.examples.control.heading",
  "docs.examples.events.heading",
  "docs.api.events.heading",
  "docs.api.elevator.heading",
  "docs.api.floor.heading",
];

/** Its prose, paragraph by paragraph. */
const PARAGRAPHS: readonly MessageKey[] = [
  "docs.about.p1.html",
  "docs.about.p2.html",
  "docs.play.track.html",
  "docs.play.start.html",
  "docs.play.statistics.html",
  "docs.play.shortcuts.html",
  "docs.play.debugging.html",
  "docs.basics.declare.html",
  "docs.basics.called.html",
  "docs.basics.initPurpose.html",
  "docs.basics.noLibraries.html",
  "docs.examples.events.intro.html",
  "docs.examples.events.perElevator.html",
  "docs.api.events.intro",
  "docs.api.events.outro.html",
];

/** What each worked example under "Code examples" is there to show. */
const EXAMPLE_NOTES: readonly MessageKey[] = [
  "docs.examples.goToFloor",
  "docs.examples.currentFloor",
  "docs.examples.idle",
  "docs.examples.floorButtonPressed",
  "docs.examples.upButtonPressed",
];

/** The column headings of each table, in the order the tables appear. */
const TABLE_HEADINGS: readonly (readonly MessageKey[])[] = [
  ["docs.table.method", "docs.table.explanation", "docs.table.example"],
  ["docs.table.property", "docs.table.type", "docs.table.explanation", "docs.table.example"],
  ["docs.table.event", "docs.table.explanation", "docs.table.example"],
  ["docs.table.property", "docs.table.type", "docs.table.explanation", "docs.table.example"],
  ["docs.table.event", "docs.table.explanation", "docs.table.example"],
];

/** Each section of the reference, and the key prefix that describes it. */
const REFERENCE_SECTIONS: readonly {
  readonly heading: keyof ReferencePage["headings"];
  readonly prefix: string;
}[] = [
  { heading: "eventMethods", prefix: "docs.api.events." },
  { heading: "elevator", prefix: "docs.api.elevator." },
  { heading: "floor", prefix: "docs.api.floor." },
];

/**
 * A name with the punctuation taken out of it.
 *
 * The tables and the catalogue spell the same name differently and neither
 * spelling can be derived from the other: the page writes `buttonstate_change`
 * where the key writes `buttonStateChange`, and camel-casing the first gives
 * `buttonstateChange`. The letters are what the two of them agree on.
 *
 * @param name - Either spelling.
 * @returns The letters of it.
 */
function flatten(name: string): string {
  return name.replaceAll("_", "").toLowerCase();
}

/**
 * The comment lines of an example, whatever they are indented by.
 *
 * @param code - The text of an example.
 * @returns One entry per comment line, in order.
 */
function commentsIn(code: string): string[] {
  return code
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("//"));
}

/**
 * The message that explains one documented member.
 *
 * @param prefix - The key prefix of the section it is documented in.
 * @param name - What the first cell of its row says.
 * @returns The key, with or without the `.html` that admits to markup.
 * @throws If the catalogue has no message for that row, or more than one.
 * Either way there is nothing to check the row against, which is not a thing to
 * pass over quietly.
 */
function explanationKey(prefix: string, name: string): MessageKey {
  const found = DOCS_KEYS.filter(
    (key) =>
      key.startsWith(prefix) &&
      flatten(key.slice(prefix.length).replace(/\.html$/, "")) === flatten(name),
  );
  const [only] = found;
  if (only === undefined || found.length > 1) {
    throw new Error(`${prefix}* has ${String(found.length)} messages for ${name}`);
  }
  return only;
}

/** One row of a reference table, and the messages that fill it. */
interface DocumentedRow {
  /** The member or event named in its first cell. */
  readonly name: string;
  /** The message that explains it. */
  readonly key: MessageKey;
  /** The message its example is kept as, for the examples that are kept. */
  readonly example: MessageKey | undefined;
  /** The element holding the explanation, which is the cell's `<small>`. */
  readonly explanation: Element | null;
  /** The element holding the example, which is the cell's `<code>`. */
  readonly code: Element | null;
}

/**
 * Every row of the reference tables, tied to the messages that fill it.
 *
 * Tied by name rather than by position, so that a member documented in a
 * different place in the table is still checked against its own message. The
 * explanation is the last cell but one and the example the last: the property
 * tables have a type column the event tables do not, and counting from the
 * right sidesteps that without having to know which table this is.
 *
 * @param reference - The page to read.
 * @returns One entry per body row of every reference table.
 */
function documentedRows(reference: ReferencePage): DocumentedRow[] {
  const rows: DocumentedRow[] = [];
  for (const section of REFERENCE_SECTIONS) {
    for (const table of tablesUnder(reference.document, reference.headings[section.heading])) {
      for (const row of table.querySelectorAll("tbody tr")) {
        const cells = [...row.querySelectorAll("td")];
        const name = collapse(cells[0]?.textContent ?? "");
        const key = explanationKey(section.prefix, name);
        const example = `${key.replace(/\.html$/, "")}.example.code`;
        rows.push({
          name,
          key,
          example: DOCS_KEYS.find((candidate) => candidate === example),
          explanation: cells.at(-2)?.querySelector("small") ?? null,
          code: cells.at(-1)?.querySelector("code") ?? null,
        });
      }
    }
  }
  return rows;
}

/**
 * The reference pages are the reviewed copy; `src/i18n` is a copy of them.
 *
 * Every `docs.*` message was lifted from these pages word for word, and the
 * interface will be wired through the catalogue rather than the HTML. Until it
 * is, the page is what a reader sees and the catalogue is what nobody sees --
 * which is exactly the arrangement in which one of them gets corrected and the
 * other does not. That is not hypothetical: the review of the Russian page put
 * a dozen corrections into `documentation.ru.html`, and every one of them
 * stayed there while `ru.ts` went on saying the thing that had been corrected.
 *
 * So each message is held against the place it came from, and held to being the
 * same text rather than merely similar text. That is only a fair rule because
 * the keys are cut along the page's own seams -- a paragraph, a table cell, an
 * example -- so no key holds half a sentence and nothing here has to settle for
 * a weaker assertion.
 */
describe.each(DOCUMENTATION_PAGES)("src/i18n, against $file", (reference) => {
  const docs = reference.document;

  it("names itself in the words the catalogue has", () => {
    expect(docs.title).toBe(message(reference.language, "docs.page.title"));
    expect(metaContent(docs, "description")).toBe(
      message(reference.language, "docs.page.description"),
    );
    expectSays(docs.querySelector("h1 em"), reference, "docs.page.tagline");
    expectSays(docs.querySelector("header nav a[href='index.html']"), reference, "docs.nav.back");
    expect(docs.querySelector("header nav")?.getAttribute("aria-label")).toBe(
      message(reference.language, "docs.nav.label"),
    );
  });

  it("prints the catalogue's prose, in the order the catalogue has it", () => {
    expectRun(reference, "main h2", SECTION_HEADINGS);
    expectRun(reference, "main h3", SUBSECTION_HEADINGS);
    expectRun(reference, "main > p", PARAGRAPHS);
    expectRun(reference, "main dl dd", EXAMPLE_NOTES);
  });

  it("heads its columns with the catalogue's words", () => {
    const tables = [...docs.querySelectorAll("table.doctable")];
    expect(tables).toHaveLength(TABLE_HEADINGS.length);
    tables.forEach((table, index) => {
      const cells = [...table.querySelectorAll("thead th")];
      const keys = TABLE_HEADINGS[index] ?? [];
      expect(cells.length, `table ${String(index)}`).toBe(keys.length);
      keys.forEach((key, column) => {
        expectSays(cells[column] ?? null, reference, key);
      });
    });
  });

  it("explains every member in the words the catalogue has", () => {
    const rows = documentedRows(reference);
    // A page whose tables the scraper cannot read would otherwise check nothing
    // at all and say so by passing. The second count is the same rows reached
    // the other way, so a table that drifted out from under its heading is a
    // failure rather than a silent omission.
    expect(rows.length).toBeGreaterThan(20);
    expect(rows).toHaveLength(docs.querySelectorAll("table.doctable tbody tr").length);
    for (const row of rows) {
      expectSays(row.explanation, reference, row.key);
    }
  });

  it("prints every example the catalogue keeps, byte for byte", () => {
    expect(docs.querySelector("main > pre code")?.textContent).toBe(
      message(reference.language, "docs.basics.example.code"),
    );
    for (const row of documentedRows(reference)) {
      if (row.example !== undefined) {
        expect(row.code?.textContent, row.example).toBe(message(reference.language, row.example));
      }
    }

    // An example is in the catalogue exactly when it has a comment in it, since
    // the comment is the only part of an example that gets translated. Held
    // both ways round: a comment added to an example that has no key is a line
    // of English that would stay English on the Russian page.
    const commented = examples(docs).filter((block) => block.includes("//"));
    const kept = DOCS_KEYS.filter((key) => key.endsWith(".code")).map((key) =>
      message(reference.language, key),
    );
    expect([...commented].sort()).toEqual([...kept].sort());
  });

  it("leaves no docs.* message unchecked", () => {
    // Every check above is a comparison the page has to satisfy; this is what
    // makes sure the page has to satisfy one for each message. Without it a key
    // could be corrected into nonsense as long as nothing on the page happened
    // to be laid out to look for it.
    const checked = new Set<string>([
      ...SHELL_KEYS,
      ...SECTION_HEADINGS,
      ...SUBSECTION_HEADINGS,
      ...PARAGRAPHS,
      ...EXAMPLE_NOTES,
      ...TABLE_HEADINGS.flat(),
      "docs.basics.example.code",
      ...documentedRows(reference).flatMap((row) =>
        row.example === undefined ? [row.key] : [row.key, row.example],
      ),
    ]);
    expect(DOCS_KEYS.filter((key) => !checked.has(key))).toEqual([]);
  });
});

/**
 * The popup's tables as it would draw them right now, by the part of a
 * `completion.*` key that names one.
 *
 * A function, because the tables are: they render from the catalogue for the
 * language that is active when they are asked for, which is what lets the
 * checks below read the same popup twice in two languages.
 *
 * @returns Each table under the key prefix that translates it.
 */
function completionTables(): Readonly<Record<string, readonly ApiCompletion[]>> {
  const elevator = elevatorMembers();
  return {
    // The event methods are in both member lists, being what both facades have;
    // either copy answers for `completion.events.*`.
    events: elevator,
    elevator,
    "elevator.event": elevatorEvents(),
    floor: floorMembers(),
    "floor.event": floorEvents(),
    global: globalCompletions(),
  };
}

/**
 * The popup entry a `completion.*` message is the text of.
 *
 * `completion.<owner>.<member>`, and `completion.<owner>.event.<member>` for an
 * event name. The last segment is the entry's label, up to the spelling
 * {@link flatten} irons out.
 *
 * @param key - The message.
 * @returns The entry it belongs to, as the popup would show it in the language
 * that is active now.
 * @throws If no entry has that label, which means the key outlived the popup
 * entry it was written for.
 */
function completionEntry(key: MessageKey): ApiCompletion {
  const path = key.slice("completion.".length);
  const cut = path.lastIndexOf(".");
  const entries = completionTables()[path.slice(0, cut)] ?? [];
  const found = entries.find((entry) => flatten(entry.label) === flatten(path.slice(cut + 1)));
  if (found === undefined) {
    throw new Error(`No completion entry for ${key}`);
  }
  return found;
}

/**
 * The words of a message, a closing full stop dropped.
 *
 * The popup prints the opening sentences of a table cell and stops before the
 * detail a hovering box has no room for, so the two texts run together
 * identically until the shorter one ends in a full stop where the longer one
 * carries on with a comma or a dash. That one character is the only difference
 * worth forgiving, and taking it off both is enough to forgive it.
 *
 * @param value - The message.
 * @returns Its words, ready to be looked for inside another message's.
 */
function shortenable(value: string): string {
  return textOf(value).replace(/\.$/u, "");
}

/**
 * The popup lines that say it in the popup's own words.
 *
 * Everything else the popup shows is a stretch of a reference page, and is held
 * to the page's translation of it. These say the same thing more briefly than
 * any cell does, so nothing outside the catalogue holds them to anything. The
 * list is here so that a line joining it is a decision somebody made rather
 * than a check that quietly stopped applying.
 */
const POPUP_ONLY_WORDING: readonly MessageKey[] = [
  "completion.events.on",
  "completion.events.once",
  "completion.events.off",
  "completion.elevator.stop",
  "completion.floor.event.buttonStateChange",
  "completion.global.init",
  "completion.global.update",
];

describe("src/i18n, against the editor it also speaks for", () => {
  // Two of these read the popup in a named language, and the rest of the file
  // reads catalogues directly and does not care; leaving the interface in the
  // language it starts in is what keeps that true.
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("gives the popup exactly what it says, in every language", () => {
    // The completion popup has no page for a reviewer to read, so this is what
    // holds its text: every `completion.*` key belongs to an entry of the table
    // its name points at, and that entry says what the catalogue says for the
    // language on screen. In English it is also the record that routing the
    // popup through the catalogue changed nothing a player can see -- these are
    // the strings `src/ui/completions.ts` used to carry as literals.
    const spoken = COMPLETION_KEYS.filter((key) => !key.endsWith(".code"));
    expect(spoken.length).toBeGreaterThan(20);
    for (const { language } of DOCUMENTATION_PAGES) {
      setLocale(language);
      for (const key of spoken) {
        expect(completionEntry(key).info, `${key} in ${language}`).toBe(message(language, key));
      }
    }
  });

  it("hands the popup the skeleton the page prints", () => {
    // The whole-program skeleton the popup inserts is the example under
    // "Basics", which is why it has no key of its own; the two halves it can
    // insert instead exist nowhere else and do.
    const inserted = (label: string): string =>
      globalCompletions().find((candidate) => candidate.label === label)?.apply ?? "";
    for (const { language } of DOCUMENTATION_PAGES) {
      setLocale(language);
      expect(inserted("skeleton"), language).toBe(message(language, "docs.basics.example.code"));
      expect(inserted("init"), language).toBe(message(language, "completion.initSkeleton.code"));
      expect(inserted("update"), language).toBe(
        message(language, "completion.updateSkeleton.code"),
      );
    }

    // The halves are the whole one taken apart and re-indented, so in every
    // language their comments are its comments. Nothing else ties the popup's
    // translated skeleton to the page's, and a comment corrected in one of the
    // two is exactly how they came apart.
    for (const { language } of DOCUMENTATION_PAGES) {
      const whole = commentsIn(message(language, "docs.basics.example.code"));
      for (const half of [
        "completion.initSkeleton.code",
        "completion.updateSkeleton.code",
      ] as const) {
        for (const comment of commentsIn(message(language, half))) {
          expect(whole, `${half} in ${language}`).toContain(comment);
        }
      }
    }
  });

  it("says the same thing in every language wherever it says it twice in English", () => {
    // The popup's lines are the page's lines: `completion.elevator.event.passingFloor`
    // and `docs.api.elevator.passingFloor` are one sentence with two keys. A
    // correction that lands on the page therefore has to land on the popup too,
    // and this is what stops it from landing on only one of them -- which is
    // the shape the Russian drift actually had.
    const byEnglish = new Map<string, MessageKey[]>();
    for (const key of [...DOCS_KEYS, ...COMPLETION_KEYS]) {
      const english = message("en", key);
      byEnglish.set(english, [...(byEnglish.get(english) ?? []), key]);
    }
    const shared = [...byEnglish.values()].filter((keys) => keys.length > 1);
    expect(shared.length).toBeGreaterThan(5);
    for (const [first, ...rest] of shared) {
      if (first === undefined) {
        continue;
      }
      for (const key of rest) {
        expect(message("ru", key), `${key} says what ${first} says in English`).toBe(
          message("ru", first),
        );
      }
    }
  });

  it("translates a sentence the popup borrows the way the page translates it", () => {
    // The rule above only reaches a popup line whose English is a whole cell,
    // word for word. Most of them are a cell cut short instead, and those had
    // nothing holding their Russian: `src/ui/completions.ts` is English, and
    // the pages do not print the popup. So take the English cut as given -- one
    // text inside the other -- and require the Russian to be cut the same way.
    const printed = DOCS_KEYS.filter((key) => !key.endsWith(".code"));
    const ownWords: MessageKey[] = [];
    for (const spoken of COMPLETION_KEYS.filter((key) => !key.endsWith(".code"))) {
      const popup = shortenable(message("en", spoken));
      let borrowed = false;
      for (const source of printed) {
        const page = shortenable(message("en", source));
        // Anything shorter than a sentence turns up in too many places to mean
        // a borrowing: a heading would pair with half the table.
        if (Math.min(popup.length, page.length) < 30) {
          continue;
        }
        const where = `${spoken}, beside ${source}`;
        if (popup.length <= page.length && page.includes(popup)) {
          borrowed = true;
          expect(shortenable(message("ru", source)), where).toContain(
            shortenable(message("ru", spoken)),
          );
        } else if (page.length < popup.length && popup.includes(page)) {
          borrowed = true;
          expect(shortenable(message("ru", spoken)), where).toContain(
            shortenable(message("ru", source)),
          );
        }
      }
      if (!borrowed) {
        ownWords.push(spoken);
      }
    }
    expect(ownWords).toEqual([...POPUP_ONLY_WORDING]);
  });

  it("has a placeholder only where the page prints a picture instead of a word", () => {
    // {@link expectSays} compares the words around a placeholder rather than
    // the markup, which is a weaker check; this is what keeps it to the one
    // message that needs it.
    expect(DOCS_KEYS.filter((key) => message("en", key).match(PLACEHOLDER) !== null)).toEqual([
      "docs.play.start.html",
    ]);
  });
});
