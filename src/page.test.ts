// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { runInNewContext } from "node:vm";

import { afterEach, describe, expect, it } from "vitest";

import pageSource from "../index.html?raw";
import viteConfig from "../vite.config.ts";
import { docsPageFile, renderDocsPage } from "./docs-page/render.ts";
import { Elevator } from "./game/elevator.ts";
import { ElevatorInterface, type ElevatorInterfaceEvents } from "./game/elevator-interface.ts";
import { Floor } from "./game/floor.ts";
import { FloorInterface, type FloorInterfaceEvents } from "./game/floor-interface.ts";
import { tutorialLevels } from "./game/tutorial.ts";
import { createFloors } from "./game/world.ts";
import type { MessageKey } from "./i18n/catalog.ts";
import { EN_DOCS_MESSAGES, type DocsMessageKey } from "./i18n/docs-en.ts";
import { RU_DOCS_MESSAGES } from "./i18n/docs-ru.ts";
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
import { readTheme, resolveTheme, THEME_STORAGE_KEY } from "#features/switch-theme/model/theme.ts";
import {
  DARK_PALETTE,
  declaration,
  LIGHT_PALETTE,
  ruleBody,
  themed,
} from "#shared/styles/test-helpers.ts";
import { createIcon } from "#shared/ui/icon.ts";
import { buildAppBarSkeleton } from "#widgets/app-bar/ui/app-bar.ts";

/** The page shell, parsed as the browser would parse it. */
const page = new DOMParser().parseFromString(pageSource, "text/html");

/** Everything about an inline icon that has to match, whitespace aside. */
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

/** The repository root; `import.meta.url` is an `http:` URL under jsdom, useless to `node:fs`. */
const ROOT = process.cwd();

/** The tab icon, read from `public/` since files there are copied by the build, not bundled. */
const faviconSource = readFileSync(join(ROOT, "public/favicon.svg"), "utf8");

/** The content of a `<meta>` tag, whichever attribute names it. */
function metaContent(document: Document, name: string): string | null {
  const meta = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
  return meta?.getAttribute("content") ?? null;
}

/** Anything loaded from another origin. */
function thirdPartyResources(document: Document): Element[] {
  return [...document.querySelectorAll("link[href], script[src], img[src]")].filter((node) =>
    /^(https?:)?\/\//.test(node.getAttribute("href") ?? node.getAttribute("src") ?? ""),
  );
}

/** The head's pre-stylesheet paint rules, as it.each rows of scheme, selector and palette. */
const FIRST_PAINT: readonly [
  scheme: string,
  selector: string,
  palette: ReadonlyMap<string, string>,
][] = [
  ["dark", "html", DARK_PALETTE],
  ["light", 'html[data-theme="light"]', LIGHT_PALETTE],
];

/** One rule out of a page's own `<head>` stylesheet. */
function firstPaintRule(document: Document, selector: string): string {
  const source = document.querySelector("head style")?.textContent ?? "";
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rules = [...source.matchAll(new RegExp(`^\\s*${escaped}\\s*\\{([^}]*)\\}`, "gm"))];
  expect(rules.length, `${selector} is not one rule of that page's head`).toBe(1);
  return rules[0]?.[1] ?? "";
}

/** A store holding one theme choice and nothing else. */
function storageHolding(stored: string | null): Storage {
  return {
    length: stored === null ? 0 : 1,
    clear: () => undefined,
    getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null),
    key: () => null,
    removeItem: () => undefined,
    setItem: () => undefined,
  };
}

/** The theme index.html's head script settles on, run as a script against given globals. */
function firstPaintTheme(storage: Storage, prefersDark: boolean): string {
  const documentElement = { dataset: {} as Record<string, string> };
  runInNewContext(page.querySelector("head script:not([src])")?.textContent ?? "", {
    localStorage: storage,
    matchMedia: (query: string) => {
      expect(query).toBe("(prefers-color-scheme: dark)");
      return { matches: prefersDark };
    },
    document: { documentElement },
  });
  return documentElement.dataset["theme"] ?? "";
}

describe("index.html", () => {
  it("is a module entry, ahead of it the one script that has to beat the paint", () => {
    const scripts = [...page.querySelectorAll("script")];
    expect(scripts.map((script) => [script.type, script.getAttribute("src")])).toEqual([
      // No src, no type: either would defer the bootstrap script past first paint.
      ["", null],
      ["module", "/src/main.ts"],
    ]);
  });

  it.each(FIRST_PAINT)(
    "paints the page in the %s palette before the stylesheet",
    (scheme, selector, palette) => {
      // Colors are written out, not read from a custom property, since src/styles/index.css
      // hasn't loaded yet.
      const body = firstPaintRule(page, selector);
      expect(declaration(body, "background", selector)).toBe(themed(palette, "ds-bg"));
      expect(declaration(body, "color", selector)).toBe(themed(palette, "ds-text"));
      expect(declaration(body, "color-scheme", selector)).toBe(scheme);
    },
  );

  it("hides the shell until the stylesheet is there to dress it", () => {
    // Two halves of one rule: the head hides the body, and src/app/styles/document.css shows it.
    expect(declaration(firstPaintRule(page, "body"), "visibility", "body")).toBe("hidden");
    expect(declaration(ruleBody("body"), "visibility", "body")).toBe("visible");
  });

  it.each([
    ["nothing remembered", null],
    ["the system followed by choice", "system"],
    ["light pinned", "light"],
    ["dark pinned", "dark"],
    ["a choice this page never wrote", "sepia"],
  ])("opens on the theme the switch settles on, with %s", (_case, stored) => {
    // The head script duplicates readTheme + resolveTheme; this checks the two never disagree.
    for (const prefersDark of [true, false]) {
      const storage = storageHolding(stored);
      expect(firstPaintTheme(storage, prefersDark)).toBe(
        resolveTheme(readTheme(storage), prefersDark),
      );
    }
  });

  it("still opens on a theme when the store refuses to be read", () => {
    // Safari's private mode throws on any localStorage access, leaving <html> without a
    // data-theme, which defaults to dark.
    const refuse = (): never => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    const storage: Storage = {
      length: 0,
      clear: refuse,
      getItem: refuse,
      key: refuse,
      removeItem: refuse,
      setItem: refuse,
    };

    expect(firstPaintTheme(storage, true)).toBe("dark");
    expect(firstPaintTheme(storage, false)).toBe("light");
  });

  it.each([
    // Queried by src/main.ts.
    ".code",
    "#storage_status",
    // Drawn into by src/pages/game/index.ts.
    ".level",
    ".controls",
    // Drawn into by src/widgets/tutorial-panel/ui/tutorial-panel.ts, and left empty off the track.
    ".tutorial",
    ".innerworld",
    ".statscontainer",
    ".feedbackcontainer",
    // The scrolling frame the world is drawn inside.
    ".world .worldtrack .innerworld",
  ])("provides %s", (selector) => {
    expect(page.querySelector(selector)).not.toBeNull();
  });

  it("announces the end-of-level verdict from a container that is always present", () => {
    // presentVerdictToast inserts the card already built; a role="status" populated on arrival
    // would go unannounced, so the container itself must be the live region.
    const container = page.querySelector(".feedbackcontainer");
    expect(container?.getAttribute("role")).toBe("status");
    expect(container?.textContent).toBe("");
  });

  it("announces a refused write without drawing anything", () => {
    // No visible status line under the editor: a refused write is announced instead of drawn.
    const element = page.querySelector("#storage_status");
    expect(element?.getAttribute("role")).toBe("status");
    expect(element?.className).toBe("visually-hidden");
    expect(element?.textContent).toBe("");
  });

  it.each([".world", ".innerworld", ".statscontainer", ".level", ".tutorial"])(
    "leaves %s out of the live regions",
    (selector) => {
      // These change continuously; announcing them would bury real messages in noise. The
      // tutorial panel redraws whole on level or language change, so it's a named region instead.
      const element = page.querySelector(selector);
      expect(element).not.toBeNull();
      expect(element?.getAttribute("aria-live")).toBeNull();
      expect(element?.getAttribute("role")).not.toBe("status");
      expect(element?.getAttribute("role")).not.toBe("alert");
    },
  );

  it("names the building a region, and keeps it focusable without a tab stop", () => {
    // tabindex="-1" skips it in Tab order (the scrolling stage takes that stop) but still lets
    // presentVerdictToast move focus here when it removes the close button that had it.
    const world = page.querySelector(".world");
    expect(world?.getAttribute("role")).toBe("region");
    expect(world?.getAttribute("aria-label")).toBeTruthy();
    expect(world?.getAttribute("tabindex")).toBe("-1");
  });

  it("ships the run controls' mount bare, for the app bar to adopt", () => {
    // Empty because presentControls fills it from the catalog when it draws; unnamed because
    // its own buttons already name themselves.
    const controls = page.querySelector(".controls");
    expect(controls).not.toBeNull();
    expect(controls?.innerHTML).toBe("");
    expect(controls?.getAttribute("role")).toBeNull();
    expect(controls?.getAttribute("aria-label")).toBeNull();
  });

  it("offers a way past the building, before anything else in the tab order", () => {
    // WCAG 2.4.1: the building sits between the top of the page and the editor and takes focus.
    const skipLink = page.querySelector(".skip-link");
    expect(skipLink).not.toBeNull();
    expect(page.querySelector("a[href], button, [tabindex]")).toBe(skipLink);

    // Must name something real: src/main.ts intercepts the click, but the href is the fallback.
    const target = (skipLink?.getAttribute("href") ?? "").slice(1);
    expect(page.querySelector(`[id="${target}"]`)).toBe(page.querySelector(".code"));
  });

  it("names a favicon, drawn here rather than borrowed", () => {
    // Original artwork, not one of the OFL-licensed outlines in src/shared/ui/icon.ts.
    const icon = page.querySelector("link[rel='icon']");
    expect(icon?.getAttribute("type")).toBe("image/svg+xml");
    expect(icon?.getAttribute("href")).toBe("/favicon.svg");
    expect(faviconSource).toContain("<svg");
  });

  it("ships a favicon a browser will actually parse", () => {
    // image/svg+xml is parsed strictly as XML: a bare `toContain("<svg")` would pass even on a
    // file no browser can render, e.g. one with a double hyphen inside an XML comment.
    const favicon = new DOMParser().parseFromString(faviconSource, "image/svg+xml");

    expect(favicon.querySelector("parsererror")).toBeNull();
    expect(favicon.documentElement.tagName).toBe("svg");
  });

  it("puts the app bar's own mark in the tab", () => {
    // Compares the actual shapes rather than trusting two files to stay in sync; color is
    // excluded since the bar inherits currentcolor while the favicon hardcodes it.
    const geometry = (rect: Element): Record<string, string | null> => ({
      x: rect.getAttribute("x"),
      y: rect.getAttribute("y"),
      width: rect.getAttribute("width"),
      height: rect.getAttribute("height"),
      rx: rect.getAttribute("rx"),
    });
    const carShapes = (root: ParentNode): Record<string, string | null>[] =>
      [...root.querySelectorAll("rect[opacity]")].map((car) => ({
        ...geometry(car),
        opacity: car.getAttribute("opacity"),
      }));
    const frameShape = (root: ParentNode): Record<string, string | null> | null => {
      const frame = root.querySelector("rect[stroke]");
      return frame === null
        ? null
        : { ...geometry(frame), strokeWidth: frame.getAttribute("stroke-width") };
    };

    const favicon = new DOMParser().parseFromString(faviconSource, "image/svg+xml");
    const { brand } = buildAppBarSkeleton(document, { brandName: EN_MESSAGES["page.brand"] });

    expect(carShapes(favicon)).toHaveLength(2);
    expect(carShapes(favicon)).toEqual(carShapes(brand));
    expect(frameShape(brand)).not.toBeNull();
    expect(frameShape(favicon)).toEqual(frameShape(brand));
    expect(favicon.documentElement.getAttribute("viewBox")).toBe(
      brand.querySelector(".brand-mark")?.getAttribute("viewBox"),
    );
  });

  it("describes itself well enough to paste into a chat", () => {
    // Open Graph tags, so a pasted link becomes a card; title/description aren't restated here.
    expect(metaContent(page, "og:type")).toBe("website");
    expect(metaContent(page, "og:title")).toBe(page.title);
    expect(metaContent(page, "og:description")).toBe(metaContent(page, "description"));
    expect(metaContent(page, "og:image:alt")).toBeTruthy();
    expect(metaContent(page, "twitter:card")).toBe("summary_large_image");

    // Site-relative, since Vite rewrites a leading slash to base and the build runs from any
    // directory.
    const image = metaContent(page, "og:image") ?? "";
    expect(image).toMatch(/^\/[^/]/);
    expect(existsSync(join(ROOT, "public", image))).toBe(true);
  });

  it("has one landmark of each kind, and a single top-level heading", () => {
    // No footer: credits and license notices live on the help pages and the About popover instead.
    expect(page.querySelectorAll("header, main, footer")).toHaveLength(2);
    expect(page.querySelectorAll("h1")).toHaveLength(1);
  });

  it("no longer loads anything from a third party", () => {
    expect(thirdPartyResources(page)).toEqual([]);
    expect(page.documentElement.innerHTML).not.toContain("google-analytics");
  });
});

/**
 * The reference page, in every language it is published in. The versions are one
 * page and not several, since `src/docs-page/render.ts` builds them from one
 * structure; the checks below still run over each, because they hold the page to
 * the code it documents rather than to that structure.
 */
const TRANSLATIONS = {
  en: docsPageFile("en"),
  ru: docsPageFile("ru"),
} as const;

/** A language {@link TRANSLATIONS} publishes the reference page in. */
type Language = keyof typeof TRANSLATIONS;

/** One reference page, and the few things about reading it that its language decides. */
interface ReferencePage {
  /** The file it is published as, which is also what names it in the test output. */
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
    document: new DOMParser().parseFromString(renderDocsPage("en"), "text/html"),
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
    document: new DOMParser().parseFromString(renderDocsPage("ru"), "text/html"),
    headings: {
      eventMethods: "Методы событий",
      elevator: "Объект лифта",
      floor: "Объект этажа",
    },
    columns: { method: "Метод", property: "Свойство", event: "Событие" },
  },
];

/** The reference page written in one language; throws if {@link TRANSLATIONS} has none. */
function pageIn(language: Language): ReferencePage {
  const found = DOCUMENTATION_PAGES.find((candidate) => candidate.language === language);
  if (found === undefined) {
    throw new Error(`No reference page in ${language}`);
  }
  return found;
}

/**
 * The HTML files the build starts from. `input` accepts a name, a list of them
 * or a map of them, and the config uses the map form, so the other two are
 * narrowed away here rather than in each assertion.
 */
const BUILD_INPUTS: readonly string[] = (() => {
  const input = viteConfig.build?.rolldownOptions?.input;
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new Error("vite.config.ts no longer names its build inputs as a map");
  }
  return Object.values(input);
})();

describe.each(DOCUMENTATION_PAGES)("$file", (reference) => {
  const docs = reference.document;

  it("is a module entry, with no other scripts", () => {
    const scripts = [...docs.querySelectorAll("script")];
    expect(scripts.map((script) => [script.type, script.getAttribute("src")])).toEqual([
      ["module", "/src/docs.ts"],
    ]);
  });

  it("paints itself dark before the stylesheet arrives, having no other theme", () => {
    // This page has no theme switch, so its only first-paint rule is the dark default.
    const body = firstPaintRule(docs, "html");
    expect(declaration(body, "background", "html")).toBe(themed(DARK_PALETTE, "ds-bg"));
    expect(declaration(body, "color", "html")).toBe(themed(DARK_PALETTE, "ds-text"));
    expect(declaration(body, "color-scheme", "html")).toBe("dark");
    expect(docs.querySelector("head style")?.textContent).not.toContain("data-theme");
  });

  it("hides its text until the stylesheet is there to dress it", () => {
    // src/docs.ts imports the same src/styles/index.css, so the reveal rule is shared.
    expect(declaration(firstPaintRule(docs, "body"), "visibility", "body")).toBe("hidden");
  });

  it("keeps the #docs anchor the game links to", () => {
    expect(docs.querySelector("#docs")).not.toBeNull();
  });

  it("declares the language it is written in", () => {
    expect(docs.documentElement.getAttribute("lang")).toBe(reference.language);
  });

  it("names every language it exists in, its own included", () => {
    // Both pages list both versions including themselves, so a crawler sees the pair either way.
    const alternates = [...docs.querySelectorAll("link[rel='alternate']")].map((link) => [
      link.getAttribute("hreflang"),
      link.getAttribute("href"),
    ]);
    expect(alternates).toEqual(Object.entries(TRANSLATIONS));

    // vite-ignore stops the build from resolving the href as an asset: Vite treats every <link
    // href> as one regardless of rel, and would rewrite an unmarked one to a hashed dist path.
    for (const link of docs.querySelectorAll("link[rel='alternate']")) {
      expect(link.hasAttribute("vite-ignore"), link.outerHTML).toBe(true);
    }
  });

  it("offers a reader a visible way to the other language", () => {
    // The <link>s above are for machines; a human needs something to click, named in the
    // language it leads to.
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
    // Pages missing from rolldownOptions.input build fine in dev but 404 in dist/. Read out of
    // the config rather than matched as text, since the entries are generated from `LOCALES`
    // and no filename is written there.
    expect(BUILD_INPUTS.map((input) => basename(input))).toContain(reference.file);
  });

  it("shows the same favicon as the game", () => {
    const icon = docs.querySelector("link[rel='icon']");
    expect(icon?.getAttribute("href")).toBe(
      page.querySelector("link[rel='icon']")?.getAttribute("href"),
    );
  });

  it("links back to the game", () => {
    const targets = [...docs.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(targets).toContain("index.html");
  });

  it("links to the license notices as well, being served from the same place", () => {
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
      expect(table.querySelector("colgroup")).not.toBeNull();
      expect(table.querySelector("[width]")).toBeNull();
      // Other checks here only read the first cell of a row, so a row missing a <td> would
      // otherwise go unnoticed.
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

  it("draws the same plus and minus icons src/shared/ui/icon.ts defines", () => {
    // The page is static, so these icons are hand-written rather than built by createIcon.
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

/** The `doctable`s under one `<h3>`, in document order; the reference is a flat run of headings and tables, not nested sections. */
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

/** The names in the first column of one of a heading's tables. */
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

/** Reads the API tables of one page. */
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

/** The page's shape, as text; its JSDoc records why undocumented members are left out. */
const structureSource = readFileSync(join(ROOT, "src/docs-page/structure.ts"), "utf8");

/** Every name player code can reach on a facade, walking own properties then the prototype chain; uses `getOwnPropertyNames`, so a getter is found without being invoked. */
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
 * Anything reachable and neither documented nor listed here fails the tests below, so a new
 * `ElevatorInterface` member must get a table row or an entry here.
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
 * Every event an elevator raises, and why the page leaves it out; `null` for documented ones.
 *
 * Keyed by the facade's own event map, so a new event fails to compile here until it's been
 * decided whether players are told about it; see {@link checkDocumentedEvents} for the runtime half.
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
  destination_requested: null,
};

/** Checks one facade's event names against the page, in both directions. */
function checkDocumentedEvents(
  documented: readonly string[],
  decisions: Readonly<Record<string, string | null>>,
): void {
  const names = new Set(documented);
  const decided = Object.entries(decisions);
  // Documented but not raised: players would subscribe handlers that can never run.
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

/** A live elevator facade, built the way `elevator-interface.test.ts` does. */
function elevatorFacade(): ElevatorInterface {
  return new ElevatorInterface(
    new Elevator(1.5, 4, 40),
    createFloors(4, 40, () => undefined),
    () => undefined,
  );
}

/** A live floor facade, built the way `floor-interface.test.ts` does. */
function floorFacade(): FloorInterface {
  return new FloorInterface(new Floor(2, 100, () => undefined), () => undefined);
}

describe.each(DOCUMENTATION_PAGES)(
  "$file, against the facades player code is handed",
  (reference) => {
    const docs = reference.document;
    const documented = documentedApi(reference);

    it("reads the tables it means to check", () => {
      // A set difference against an empty set passes quietly, so an unreadable page must fail
      // here instead of silently testing nothing.
      expect(documented.eventMethods).toEqual(["on", "once", "one", "off", "offAll"]);
      expect(documented.floorProperties).toEqual(["floorNum", "pendingDestinations"]);
      expect(documented.elevatorProperties.length).toBeGreaterThan(10);
      expect(documented.elevatorEvents.length).toBeGreaterThan(0);
      expect(documented.floorEvents.length).toBeGreaterThan(0);
    });

    it("documents every member the elevator facade has", () => {
      const named = new Set(documented.elevatorMembers);
      const undocumented = [...exposedNames(elevatorFacade())].filter(
        (name) => !named.has(name) && !Object.hasOwn(UNDOCUMENTED_ELEVATOR_MEMBERS, name),
      );
      // Failing means ElevatorInterface grew a member the page doesn't mention or excuse.
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
      // The other direction: a renamed or removed member left on the page would make a
      // player's code throw.
      const elevator = exposedNames(elevatorFacade());
      expect(documented.elevatorMembers.filter((name) => !elevator.has(name))).toEqual([]);
      const floor = exposedNames(floorFacade());
      expect(documented.floorMembers.filter((name) => !floor.has(name))).toEqual([]);
    });

    it("says beside the table it is missing from why each member is left out", () => {
      // The lists above are the machine-readable half; this checks the JSDoc a maintainer
      // actually meets is still there. Only the prose counts: a name that reached the file
      // as a documented row would satisfy a plain search while saying nothing about why.
      const notes = [...structureSource.matchAll(/\/\*\*[\s\S]*?\*\//gu)]
        .map((comment) => comment[0])
        .join("\n");
      for (const name of [
        ...Object.keys(UNDOCUMENTED_ELEVATOR_MEMBERS),
        ...Object.keys(UNDOCUMENTED_FLOOR_MEMBERS),
      ]) {
        expect(notes, name).toContain(name);
      }
    });

    it("keeps the omissions honest", () => {
      // A member that stops existing should drop its excuse; one that gets documented should too.
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
      // Event names also appear in the example code; a wrong name there is wrong in the code
      // a player copies.
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

/** The example code of one page, comments removed; assumes no `//` inside a string literal. */
function codeOnly(example: string): string {
  return example
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trimEnd())
    .join("\n");
}

/** Every example a page prints, in document order. */
function examples(document: Document): string[] {
  return [...document.querySelectorAll("pre code")].map((code) => code.textContent);
}

/** The `id`s a page defines, in document order. */
function anchors(document: Document): string[] {
  return [...document.querySelectorAll("[id]")].map((element) => element.id);
}

/** How a page is built, ignoring every word in it: heading tags, then each table as `columns x rows`. */
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
    // One structure renders both, so this holds by construction; it is kept as the assertion
    // that would catch a renderer branching on locale and shipping a page documenting a subset.
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
    // A reader switching languages has to land in the same place.
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
    // Checked block by block, not as whole lists, so one untranslated comment is caught rather
    // than hidden by an otherwise-passing list.
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

  it("offers the learning track to a beginner, in both languages", () => {
    // This is where the game's header sends a player who doesn't know the API yet.
    const [firstLevel] = tutorialLevels;
    if (firstLevel === undefined) {
      throw new Error("The learning track has no levels to offer");
    }
    // Built from the level's id rather than hardcoded, so renaming level one fails here instead
    // of leaving a dead address.
    const href = `index.html#level=${firstLevel.id}`;
    for (const { file, document } of DOCUMENTATION_PAGES) {
      const links = [...document.querySelectorAll(`a[href="${href}"]`)];
      expect(links, file).toHaveLength(1);
      // Must sit directly under "How to play"; buried past the whole API it'd reach no beginner.
      expect(links[0]?.closest("p")?.previousElementSibling?.tagName, file).toBe("H2");
    }
  });
});

/** Everything either catalog of a language holds; typed loosely since `MessageCatalog<"en">` and `MessageCatalog<"ru">` differ in their plural forms. */
const CATALOGS: Readonly<Record<Language, Readonly<Record<string, unknown>>>> = {
  en: { ...EN_MESSAGES, ...EN_DOCS_MESSAGES },
  ru: { ...RU_MESSAGES, ...RU_DOCS_MESSAGES },
};

/** A message of either catalog, since the pages are written out of both. */
type PageKey = MessageKey | DocsMessageKey;

/** Every message key the reference pages are answerable for. */
const DOCS_KEYS: readonly PageKey[] = Object.keys(CATALOGS.en).filter((key): key is PageKey =>
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
 * @throws If it has plural forms: nothing here counts anything, and such a key would otherwise
 * compare as "[object Object]" and quietly match nothing on the page.
 */
function message(language: Language, key: PageKey): string {
  const value = CATALOGS[language][key];
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
 * Parsed and reserialized, so `<br />` vs `<br>`, quote style, and source line wrapping stop
 * counting as differences.
 */
function normalizeMarkup(html: string): string {
  const holder = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  return collapse(holder.body.innerHTML);
}

/** The words of a message, markup and placeholders gone. */
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
 * Compared as markup, not text, so a lost emphasis or link is a real failure. A message with a
 * `{placeholder}` is the exception: the page has the thing itself (an icon), so only the
 * surrounding words are compared.
 */
function expectSays(element: Element | null, reference: ReferencePage, key: PageKey): void {
  expect(element, key).not.toBeNull();
  const value = message(reference.language, key);
  if (value.match(PLACEHOLDER) !== null) {
    expect(textOf(value), key).toBe(collapse(element?.textContent ?? ""));
    return;
  }
  expect(normalizeMarkup(value), key).toBe(normalizeMarkup(element?.innerHTML ?? ""));
}

/**
 * Checks a run of elements against the messages that fill it, position by position.
 *
 * The page has no ids tying an element to a key, so elements are matched to keys by order; a
 * paragraph added, dropped or moved fails here rather than passing silently.
 */
function expectRun(reference: ReferencePage, selector: string, keys: readonly PageKey[]): void {
  const elements = [...reference.document.querySelectorAll(selector)];
  expect(elements.length, selector).toBe(keys.length);
  keys.forEach((key, index) => {
    expectSays(elements[index] ?? null, reference, key);
  });
}

/** The messages of the page shell, each checked where it belongs. */
const SHELL_KEYS: readonly PageKey[] = [
  "docs.page.title",
  "docs.page.description",
  "docs.page.tagline",
  "docs.nav.label",
  "docs.nav.back",
];

/** What the footer says, in the order it says it. */
const FOOTER_LINES: readonly PageKey[] = [
  "docs.footer.made",
  "docs.footer.source.html",
  "docs.footer.licenses.html",
];

/** The words the type column is allowed to say, which are words and not identifiers. */
const MEMBER_TYPES: readonly PageKey[] = ["docs.type.function", "docs.type.array"];

/** The `<h2>`s of the reference, in the order the page prints them. */
const SECTION_HEADINGS: readonly PageKey[] = [
  "docs.about.heading",
  "docs.play.heading",
  "docs.basics.heading",
  "docs.examples.heading",
  "docs.api.heading",
];

/** Its `<h3>`s, likewise. */
const SUBSECTION_HEADINGS: readonly PageKey[] = [
  "docs.examples.control.heading",
  "docs.examples.events.heading",
  "docs.api.events.heading",
  "docs.api.elevator.heading",
  "docs.api.floor.heading",
];

/** Its prose, paragraph by paragraph. */
const PARAGRAPHS: readonly PageKey[] = [
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
const EXAMPLE_NOTES: readonly PageKey[] = [
  "docs.examples.goToFloor",
  "docs.examples.currentFloor",
  "docs.examples.idle",
  "docs.examples.floorButtonPressed",
  "docs.examples.upButtonPressed",
];

/** The column headings of each table, in the order the tables appear. */
const TABLE_HEADINGS: readonly (readonly PageKey[])[] = [
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
 * The page (`buttonstate_change`) and the catalog key (`buttonStateChange`) spell the same
 * name differently in ways neither can derive from the other; the letters are what they agree on.
 */
function flatten(name: string): string {
  return name.replaceAll("_", "").toLowerCase();
}

/** The comment lines of an example, whatever they are indented by. */
function commentsIn(code: string): string[] {
  return code
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("//"));
}

/**
 * The message that explains one documented member.
 *
 * @throws If the catalog has zero or more than one message for the row; either way there's
 * nothing to check it against.
 */
function explanationKey(prefix: string, name: string): PageKey {
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
  readonly key: PageKey;
  /** The message its example is kept as, for the examples that are kept. */
  readonly example: PageKey | undefined;
  /** The element holding the explanation, which is the cell's `<small>`. */
  readonly explanation: Element | null;
  /** The element holding the example, which is the cell's `<code>`. */
  readonly code: Element | null;
}

/**
 * Every row of the reference tables, tied to the messages that fill it.
 *
 * Tied by name, not position, so a reordered row still matches its own message. Explanation and
 * example are read from the last two cells, counting from the right, since property tables have
 * an extra type column that event tables don't.
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
 * `src/i18n` is the reference page's text and the page is rendered from it, so what is left to
 * check is the rendering: that every message reaches the reader, where the page means it to
 * appear. Held to exact text, since each key is cut along the page's own seams and never holds
 * half a sentence.
 */
describe.each(DOCUMENTATION_PAGES)("src/i18n, against $file", (reference) => {
  const docs = reference.document;

  it("names itself in the words the catalog has", () => {
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

  it("signs itself in the words the catalog has", () => {
    const lines = [...docs.querySelectorAll("footer.footer p")];
    expect(lines).toHaveLength(FOOTER_LINES.length);
    FOOTER_LINES.forEach((key, index) => {
      expectSays(lines[index] ?? null, reference, key);
    });
  });

  it("prints the catalog's prose, in the order the catalog has it", () => {
    expectRun(reference, "main h2", SECTION_HEADINGS);
    expectRun(reference, "main h3", SUBSECTION_HEADINGS);
    expectRun(reference, "main > p", PARAGRAPHS);
    expectRun(reference, "main dl dd", EXAMPLE_NOTES);
  });

  it("heads its columns with the catalog's words", () => {
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

  it("says what a member is in the words the catalog has", () => {
    // The type column holds a word, not the identifier beside it, so an
    // untranslated catalog shows English on every page. Matched as a set
    // because which row is which is the structure's business, not this file's:
    // what has to hold is that the column says these words and no others, and
    // that neither word has quietly stopped being printed.
    const typed = [...docs.querySelectorAll("table.doctable tbody tr")]
      .map((row) => [...row.querySelectorAll("td")])
      .filter((cells) => cells.length === 4)
      .map((cells) => collapse(cells[1]?.textContent ?? ""))
      .filter((text) => text !== "");
    expect(typed.length).toBeGreaterThan(0);
    expect(new Set(typed)).toEqual(
      new Set(MEMBER_TYPES.map((key) => message(reference.language, key))),
    );
  });

  it("explains every member in the words the catalog has", () => {
    const rows = documentedRows(reference);
    // The second count reaches the same rows a different way, catching a table that drifted out
    // from under its heading.
    expect(rows.length).toBeGreaterThan(20);
    expect(rows).toHaveLength(docs.querySelectorAll("table.doctable tbody tr").length);
    for (const row of rows) {
      expectSays(row.explanation, reference, row.key);
    }
  });

  it("prints every example the catalog keeps, byte for byte", () => {
    expect(docs.querySelector("main > pre code")?.textContent).toBe(
      message(reference.language, "docs.basics.example.code"),
    );
    for (const row of documentedRows(reference)) {
      if (row.example !== undefined) {
        expect(row.code?.textContent, row.example).toBe(message(reference.language, row.example));
      }
    }

    // An example is in the catalog exactly when it has a comment, the only translated part.
    const commented = examples(docs).filter((block) => block.includes("//"));
    const kept = DOCS_KEYS.filter((key) => key.endsWith(".code")).map((key) =>
      message(reference.language, key),
    );
    expect([...commented].sort()).toEqual([...kept].sort());
  });

  it("leaves no docs.* message unchecked", () => {
    // Ensures every message above is actually checked against something on the page.
    const checked = new Set<string>([
      ...SHELL_KEYS,
      ...FOOTER_LINES,
      ...MEMBER_TYPES,
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
 * The popup's tables as it would draw them right now, keyed by the `completion.*` prefix that
 * names each one. A function, since the tables render from whichever language is active.
 */
function completionTables(): Readonly<Record<string, readonly ApiCompletion[]>> {
  const elevator = elevatorMembers();
  return {
    // Event methods are in both member lists, so either copy answers for completion.events.*.
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
 * Keyed as `completion.<owner>.<member>` or `completion.<owner>.event.<member>`; the last
 * segment is the label, up to the spelling {@link flatten} irons out.
 *
 * @throws If no entry has that label, meaning the key outlived the popup entry it was for.
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
 * The popup prints a table cell's opening sentences and stops there, so the two texts run
 * identically until the shorter one ends in a full stop where the longer one continues;
 * dropping it from both is enough to forgive that one difference.
 */
function shortenable(value: string): string {
  return textOf(value).replace(/\.$/u, "");
}

/**
 * The popup lines that say it in the popup's own words, rather than borrowing a page's.
 *
 * Nothing outside the catalog holds these to anything, so a line joining this list is a
 * decision someone made, not a check that quietly stopped applying.
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
  // Reset the locale after the tests here that set one; the rest of the file doesn't care.
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("gives the popup exactly what it says, in every language", () => {
    // The popup has no page for a reviewer to read, so this holds its text against the
    // catalog directly, in every language.
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
    // The whole-skeleton insert is the "Basics" example and has no key of its own.
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

    // The halves are the whole skeleton taken apart and reindented, so their comments should be
    // a subset of the whole's.
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
    // Some popup lines and page lines are the same sentence under two keys; a correction to one
    // must land on both.
    const byEnglish = new Map<string, PageKey[]>();
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
    // The rule above only catches a popup line that's a whole cell, word for word; most are a
    // cell cut short instead.
    const printed = DOCS_KEYS.filter((key) => !key.endsWith(".code"));
    const ownWords: PageKey[] = [];
    for (const spoken of COMPLETION_KEYS.filter((key) => !key.endsWith(".code"))) {
      const popup = shortenable(message("en", spoken));
      let borrowed = false;
      for (const source of printed) {
        const page = shortenable(message("en", source));
        // Anything shorter than a sentence turns up in too many places to mean a real borrowing.
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
    // expectSays falls back to a weaker check for a placeholder message; this limits that reach.
    expect(DOCS_KEYS.filter((key) => message("en", key).match(PLACEHOLDER) !== null)).toEqual([
      "docs.play.start.html",
    ]);
  });
});
