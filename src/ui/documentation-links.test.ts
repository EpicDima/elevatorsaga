// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, setLocale } from "../i18n/index.ts";
import {
  DOCUMENTATION_LINK_ATTRIBUTE,
  documentationUrl,
  localiseDocumentationLinks,
} from "./documentation-links.ts";
import { localisePage } from "./localise-page.ts";
import { createElement } from "./test-helpers.ts";

/**
 * A header with the two links the shell really has, and one that is not ours.
 *
 * The wiki link is in it on purpose: it sits between the two documentation
 * links in `index.html`, and it points at another site.
 *
 * @returns The container, and the three links in document order.
 */
function header(): { root: HTMLElement; links: HTMLAnchorElement[] } {
  const root = createElement("div", { className: "headertools" });
  root.innerHTML = `<nav>
    <a href="documentation.html" ${DOCUMENTATION_LINK_ATTRIBUTE}="">Help</a>
    <a href="documentation.html#docs" ${DOCUMENTATION_LINK_ATTRIBUTE}="docs">Documentation</a>
    <a href="https://github.com/magwo/elevatorsaga/wiki/">Wiki</a>
  </nav>`;
  return { root, links: [...root.querySelectorAll("a")] };
}

/**
 * Where each link in a container points.
 *
 * @param root - The container.
 * @returns The `href` of every link in it, in document order.
 */
function targets(root: HTMLElement): (string | null)[] {
  return [...root.querySelectorAll("a")].map((link) => link.getAttribute("href"));
}

describe("documentationUrl", () => {
  it("sends a reader to the reference page written in their own language", () => {
    // The bug in one line: this used to be `documentation.html` whoever was
    // reading, so the Help link handed a Russian player an English page.
    expect(documentationUrl("en")).toBe("documentation.html");
    expect(documentationUrl("ru")).toBe("documentation.ru.html");
  });

  it("carries the anchor across to the other language", () => {
    // The Documentation link goes to the API reference rather than the top of
    // the page, and the two files have the same anchors -- which `page.test.ts`
    // checks -- so the fragment travels unchanged.
    expect(documentationUrl("en", "docs")).toBe("documentation.html#docs");
    expect(documentationUrl("ru", "docs")).toBe("documentation.ru.html#docs");
  });

  it("leaves a bare `#` off a link that names no anchor", () => {
    // A trailing `#` is a link to the top of the page as far as the browser is
    // concerned, but it is also a change of URL that pushes a history entry: a
    // reader who follows Help and presses Back would go nowhere.
    expect(documentationUrl("ru", "")).toBe("documentation.ru.html");
    expect(documentationUrl("ru")).not.toContain("#");
  });
});

describe("localiseDocumentationLinks", () => {
  afterEach(() => {
    // On the hook rather than in the one test that switches, so a failing
    // assertion cannot leave the rest of the file running in Russian.
    setLocale(DEFAULT_LOCALE);
  });

  it("retargets the links the shell marked, and only those", () => {
    const { root } = header();

    localiseDocumentationLinks(root, "ru");

    expect(targets(root)).toEqual([
      "documentation.ru.html",
      "documentation.ru.html#docs",
      "https://github.com/magwo/elevatorsaga/wiki/",
    ]);
  });

  it("changes the language of a link as often as the reader changes theirs", () => {
    // Written from the attribute rather than from the href it finds, so going
    // back to English gets English rather than `documentation.ru.html` with a
    // second suffix on it, or nothing at all.
    const { root } = header();

    localiseDocumentationLinks(root, "ru");
    localiseDocumentationLinks(root, "ru");
    localiseDocumentationLinks(root, "en");

    expect(targets(root)).toEqual([
      "documentation.html",
      "documentation.html#docs",
      "https://github.com/magwo/elevatorsaga/wiki/",
    ]);
  });

  it("moves the links rather than replacing them", () => {
    // The header is drawn once and this runs over it on every language change:
    // if it rebuilt the links, the focused one would be destroyed under a
    // keyboard player mid-tab.
    const { root, links } = header();

    localiseDocumentationLinks(root, "ru");

    // Identity, one by one: comparing the lists would compare markup, and a
    // rebuilt link has the same markup as the one it replaced.
    const after = [...root.querySelectorAll("a")];
    expect(after).toHaveLength(links.length);
    for (const [index, link] of after.entries()) {
      expect(link).toBe(links[index]);
    }
  });

  it("is run by the shell's own localiser, so no caller has to remember it", () => {
    // Both paths that put the page into a language go through `localisePage`:
    // start-up, in `preferred-locale.ts`, and every later change, from the
    // language picker. A link retargeted by only one of the two is the defect
    // this module was written for, in a different place.
    const document = new DOMParser().parseFromString(
      `<!doctype html><html lang="en"><body>` +
        `<a href="documentation.html#docs" ${DOCUMENTATION_LINK_ATTRIBUTE}="docs">Documentation</a>` +
        `</body></html>`,
      "text/html",
    );

    setLocale("ru");
    localisePage(document, "Mozilla/5.0 (X11; Linux x86_64)");

    expect(document.querySelector("a")?.getAttribute("href")).toBe("documentation.ru.html#docs");
    expect(document.documentElement.lang).toBe("ru");
  });

  it("has nothing to do with a page that marks no links", () => {
    const root = createElement("div");
    root.innerHTML = `<a href="index.html">Back to the game</a>`;

    localiseDocumentationLinks(root, "ru");

    expect(targets(root)).toEqual(["index.html"]);
  });
});
