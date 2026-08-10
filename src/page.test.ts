// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import packageJson from "../package.json";
import docsSource from "../documentation.html?raw";
import pageSource from "../index.html?raw";
import { Elevator } from "./game/elevator.ts";
import { ElevatorInterface, type ElevatorInterfaceEvents } from "./game/elevator-interface.ts";
import { Floor } from "./game/floor.ts";
import { FloorInterface, type FloorInterfaceEvents } from "./game/floor-interface.ts";
import { createIcon } from "./ui/icons.ts";
import { presentVersion, VERSION_SELECTOR } from "./ui/version.ts";

/** The page shell, parsed as the browser would parse it. */
const page = new DOMParser().parseFromString(pageSource, "text/html");
const docs = new DOMParser().parseFromString(docsSource, "text/html");

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
    "#button_reset",
    "#button_resetundo",
    "#button_apply",
    "#button_save",
    "#save_message",
    "#fitness_message",
    // Drawn into by src/app/app.ts and src/ui/presenters.ts.
    ".challenge",
    ".innerworld",
    ".statscontainer",
    ".feedbackcontainer",
    ".codestatus",
    // Required by presentStats.
    ".statscontainer .transportedcounter",
    ".statscontainer .elapsedtime",
    ".statscontainer .transportedpersec",
    ".statscontainer .avgwaittime",
    ".statscontainer .maxwaittime",
    ".statscontainer .movecount",
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

  it.each([".world", ".innerworld", ".statscontainer", ".challenge"])(
    "leaves %s out of the live regions",
    (selector) => {
      // The building and the statistics change every frame, and the challenge
      // bar changes under the player's own hands. Announcing any of them would
      // bury the messages that do need announcing under continuous noise.
      const element = page.querySelector(selector);
      expect(element).not.toBeNull();
      expect(element?.getAttribute("aria-live")).toBeNull();
      expect(element?.getAttribute("role")).not.toBe("status");
      expect(element?.getAttribute("role")).not.toBe("alert");
    },
  );

  it("lets a keyboard reach the building, which scrolls sideways", () => {
    // .world is a horizontal scroll container, and a scroll container that
    // cannot take focus cannot be scrolled without a mouse. Being in the tab
    // order in turn obliges it to have a role and an accessible name.
    const world = page.querySelector(".world");
    expect(world?.getAttribute("tabindex")).toBe("0");
    expect(world?.getAttribute("role")).toBe("region");
    expect(world?.getAttribute("aria-label")).toBeTruthy();
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
    // src/ui/icons.ts were the shorter route, but they are OFL-licensed, and a
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

  it("marks the shortcut keys the editor binds as Mod-", () => {
    // Mod- is Command on Apple platforms, so the shipped "Ctrl" is wrong there
    // and src/ui/shortcuts.ts rewrites these two at load.
    const modKeys = [...page.querySelectorAll(".hint kbd[data-mod-key]")];
    expect(modKeys.map((key) => key.textContent)).toEqual(["Ctrl", "Ctrl"]);
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

describe("documentation.html", () => {
  it("is a module entry, with no other scripts", () => {
    const scripts = [...docs.querySelectorAll("script")];
    expect(scripts.map((script) => [script.type, script.getAttribute("src")])).toEqual([
      ["module", "/src/docs.ts"],
    ]);
  });

  it("keeps the #docs anchor the game links to", () => {
    expect(docs.querySelector("#docs")).not.toBeNull();
    const targets = [...page.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(targets).toContain("documentation.html#docs");
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
    // drifting from src/ui/icons.ts -- or from each other, the plus and the
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
 * @param heading - The exact text of the `<h3>`.
 * @returns The tables under it; empty when there is no such heading.
 */
function tablesUnder(heading: string): Element[] {
  const start = [...docs.querySelectorAll("h3")].find((node) => node.textContent === heading);
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
 * @param heading - The `<h3>` the table sits under.
 * @param column - What its first header cell says, which is what tells the
 * property table of a section apart from the event table.
 * @returns The first-column text of every body row, in the order documented.
 */
function documentedNames(heading: string, column: string): string[] {
  const table = tablesUnder(heading).find(
    (candidate) => candidate.querySelector("thead th")?.textContent.trim() === column,
  );
  return [...(table?.querySelectorAll("tbody tr") ?? [])].map(
    (row) => row.querySelector("td")?.textContent.trim() ?? "",
  );
}

/** The methods every elevator and every floor publishes alike. */
const DOCUMENTED_EVENT_METHODS = documentedNames("Event methods", "Method");

/** What the "Elevator object" property table lists, event methods aside. */
const DOCUMENTED_ELEVATOR_PROPERTIES = documentedNames("Elevator object", "Property");

/** What the "Floor object" property table lists, event methods aside. */
const DOCUMENTED_FLOOR_PROPERTIES = documentedNames("Floor object", "Property");

/** Everything the page says an elevator handed to player code can do. */
const DOCUMENTED_ELEVATOR_MEMBERS = [
  ...DOCUMENTED_ELEVATOR_PROPERTIES,
  ...DOCUMENTED_EVENT_METHODS,
];

/** Everything the page says a floor handed to player code can do. */
const DOCUMENTED_FLOOR_MEMBERS = [...DOCUMENTED_FLOOR_PROPERTIES, ...DOCUMENTED_EVENT_METHODS];

/** The event names the page tells players to subscribe an elevator to. */
const DOCUMENTED_ELEVATOR_EVENTS = documentedNames("Elevator object", "Event");

/** The event names the page tells players to subscribe a floor to. */
const DOCUMENTED_FLOOR_EVENTS = documentedNames("Floor object", "Event");

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
 * Elevator members `documentation.html` leaves out on purpose, and why.
 *
 * Anything reachable on the facade and neither documented nor listed here fails
 * the tests below, so a member added to `ElevatorInterface` cannot quietly stay
 * unwritten-down: whoever adds it has to either give it a table row or say here
 * why players are not told about it. The same reasons are repeated as an HTML
 * comment in the table the member is missing from, for the benefit of anyone
 * reading the page's source rather than this file.
 */
const UNDOCUMENTED_ELEVATOR_MEMBERS: Readonly<Record<string, string>> = {
  trigger:
    "Only reachable because the legacy facade was a riot observable. Raising the game's own events from player code is not something to recommend.",
  getFirstPressedFloor:
    "Deprecated: warns on the console and is scheduled for removal. getPressedFloors is the supported way to ask.",
};

/** Floor members `documentation.html` leaves out on purpose; see above. */
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

describe("documentation.html, against the facades player code is handed", () => {
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

  it("reads the tables it means to check", () => {
    // Every check below is a set difference, and a set difference against an
    // empty set passes quietly. A page restructured out from under the scraper
    // has to fail here rather than silently stop testing anything.
    expect(DOCUMENTED_EVENT_METHODS).toEqual(["on", "once", "one", "off", "offAll"]);
    expect(DOCUMENTED_FLOOR_PROPERTIES).toEqual(["floorNum"]);
    expect(DOCUMENTED_ELEVATOR_PROPERTIES.length).toBeGreaterThan(10);
    expect(DOCUMENTED_ELEVATOR_EVENTS.length).toBeGreaterThan(0);
    expect(DOCUMENTED_FLOOR_EVENTS.length).toBeGreaterThan(0);
  });

  it("documents every member the elevator facade has", () => {
    const documented = new Set(DOCUMENTED_ELEVATOR_MEMBERS);
    const undocumented = [...exposedNames(elevatorFacade())].filter(
      (name) => !documented.has(name) && !Object.hasOwn(UNDOCUMENTED_ELEVATOR_MEMBERS, name),
    );
    // Failing here means ElevatorInterface grew a member this page does not
    // mention. Give it a row in the "Elevator object" table, taking the wording
    // from its JSDoc, or list it in UNDOCUMENTED_ELEVATOR_MEMBERS with the
    // reason and repeat that reason in the table's HTML comment.
    expect(undocumented).toEqual([]);
  });

  it("documents every member the floor facade has", () => {
    const documented = new Set(DOCUMENTED_FLOOR_MEMBERS);
    const undocumented = [...exposedNames(floorFacade())].filter(
      (name) => !documented.has(name) && !Object.hasOwn(UNDOCUMENTED_FLOOR_MEMBERS, name),
    );
    expect(undocumented).toEqual([]);
  });

  it("documents nothing the facades do not have", () => {
    // The other direction: a member that was renamed or removed would otherwise
    // stay on the page, and a player following it writes code that throws.
    const elevator = exposedNames(elevatorFacade());
    expect(DOCUMENTED_ELEVATOR_MEMBERS.filter((name) => !elevator.has(name))).toEqual([]);
    const floor = exposedNames(floorFacade());
    expect(DOCUMENTED_FLOOR_MEMBERS.filter((name) => !floor.has(name))).toEqual([]);
  });

  it("keeps the omissions honest", () => {
    // A member that stops existing should take its excuse with it, and one that
    // gets documented after all should lose it.
    const elevator = exposedNames(elevatorFacade());
    const elevatorOmissions = Object.keys(UNDOCUMENTED_ELEVATOR_MEMBERS);
    expect(elevatorOmissions.filter((name) => !elevator.has(name))).toEqual([]);
    expect(elevatorOmissions.filter((name) => DOCUMENTED_ELEVATOR_MEMBERS.includes(name))).toEqual(
      [],
    );

    const floor = exposedNames(floorFacade());
    const floorOmissions = Object.keys(UNDOCUMENTED_FLOOR_MEMBERS);
    expect(floorOmissions.filter((name) => !floor.has(name))).toEqual([]);
    expect(floorOmissions.filter((name) => DOCUMENTED_FLOOR_MEMBERS.includes(name))).toEqual([]);
  });

  it("names exactly the events the elevator facade raises", () => {
    checkDocumentedEvents(DOCUMENTED_ELEVATOR_EVENTS, ELEVATOR_EVENT_DECISIONS);
  });

  it("names exactly the events the floor facade raises", () => {
    checkDocumentedEvents(DOCUMENTED_FLOOR_EVENTS, FLOOR_EVENT_DECISIONS);
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
    const unknown = calls.flatMap((call) => (call[1] ?? "").split(" ")).filter((n) => !real.has(n));
    expect(unknown).toEqual([]);
  });
});
