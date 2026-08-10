// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import packageJson from "../package.json";
import docsSource from "../documentation.html?raw";
import pageSource from "../index.html?raw";
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
