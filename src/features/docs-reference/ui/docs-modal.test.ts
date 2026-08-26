// @vitest-environment jsdom

import { beforeAll, describe, expect, it } from "vitest";

import { docsModalTemplate, presentDocsModal } from "./docs-modal.ts";
import { API_REFERENCE } from "#entities/api-reference/index.ts";
import { DEFAULT_LOCALE, setLocale } from "#i18n/index.ts";
import { renderElement } from "#shared/ui/markup.ts";
import { polyfillDialogElement } from "#shared/ui/test-helpers.ts";

beforeAll(() => {
  polyfillDialogElement();
});

/**
 * Parses {@link docsModalTemplate}'s markup, mounts it and wires it up.
 *
 * @returns The dialog and the modal wired against it.
 */
function setUp(): { dialog: HTMLDialogElement; modal: ReturnType<typeof presentDocsModal> } {
  const element = renderElement(docsModalTemplate());
  if (!(element instanceof HTMLDialogElement)) {
    throw new TypeError("Expected docsModalTemplate() to describe a <dialog>");
  }
  document.body.append(element);
  const modal = presentDocsModal(element);
  return { dialog: element, modal };
}

/** Types into the dialog's own search box and fires the listener that filters on it. */
function search(dialog: HTMLDialogElement, query: string): void {
  const input = dialog.querySelector<HTMLInputElement>(".docs-find");
  if (input === null) {
    throw new TypeError("Expected .docs-find to exist");
  }
  input.value = query;
  input.dispatchEvent(new Event("input"));
}

/** The dialog's scrolling body, whose position the modal remembers between visits. */
function bodyOf(dialog: HTMLDialogElement): HTMLElement {
  const body = dialog.querySelector<HTMLElement>(".docs-body");
  if (body === null) {
    throw new TypeError("Expected .docs-body to exist");
  }
  return body;
}

/** Scrolls the dialog's body and fires the listener that notes where the reader is. */
function scrollTo(dialog: HTMLDialogElement, top: number): void {
  const body = bodyOf(dialog);
  body.scrollTop = top;
  body.dispatchEvent(new Event("scroll"));
}

const TOTAL_API_ROWS = API_REFERENCE.reduce((total, group) => total + group.entries.length, 0);

describe("docsModalTemplate", () => {
  it("draws a title, a search box and a close button", () => {
    const { dialog } = setUp();
    expect(dialog.querySelector("h2")?.textContent).toBe("Help");
    const input = dialog.querySelector<HTMLInputElement>(".docs-find");
    expect(input?.getAttribute("placeholder")).toBe("Search: goToFloor, waiting, button…");
    const closeButton = dialog.querySelector(".docsclose");
    expect(closeButton?.textContent).toBe("Close");
    expect(closeButton?.getAttribute("title")).toBe("Close help");
  });

  it("points aria-labelledby at the title's own id", () => {
    const { dialog } = setUp();
    const titleId = dialog.querySelector("h2")?.id;
    expect(titleId).toBeTruthy();
    expect(dialog.getAttribute("aria-labelledby")).toBe(titleId);
  });

  it("gives each dialog its own title id", () => {
    const { dialog: first } = setUp();
    const { dialog: second } = setUp();
    expect(first.querySelector("h2")?.id).not.toBe(second.querySelector("h2")?.id);
  });

  it("starts with the clear button and the empty state hidden", () => {
    const { dialog } = setUp();
    expect(dialog.querySelector(".docsclear")?.hasAttribute("hidden")).toBe(true);
    expect(dialog.querySelector(".docs-empty")?.hasAttribute("hidden")).toBe(true);
  });

  it("draws the guide's own six headings", () => {
    const { dialog } = setUp();
    const headings = [...dialog.querySelectorAll(".docs-guide h3")].map((h3) => h3.textContent);
    expect(headings).toEqual([
      "What kind of game this is",
      "What to do",
      "The arrows on the car",
      "How to tell whether it worked",
      "Three stars",
      "The first levels come with an explanation",
    ]);
  });

  it("draws the four-step list, the third step's own <b> intact", () => {
    const { dialog } = setUp();
    const steps = [...dialog.querySelectorAll(".docs-steps li")];
    expect(steps).toHaveLength(4);
    expect(steps[2]?.querySelector("b")?.textContent).toBe("Start");
  });

  it("draws the intro heading, its highlighted code and the lead paragraph", () => {
    const { dialog } = setUp();
    const topHeadings = [...dialog.querySelectorAll(".docs-body > h3")].map((h3) => h3.textContent);
    expect(topHeadings[0]).toBe("What a program is made of");
    const code = dialog.querySelector(".docs-intro code");
    expect(code?.querySelector("span")).not.toBeNull();
    expect(code?.textContent).toContain("init: function (elevators, floors)");
    const leadCode = [...dialog.querySelectorAll(".docs-lead code")].map((el) => el.textContent);
    expect(leadCode).toEqual(["elevator", "elevators", "floor", "floors"]);
  });

  it("draws one heading and one row per API_REFERENCE group and entry", () => {
    const { dialog } = setUp();
    const topHeadings = [...dialog.querySelectorAll(".docs-body > h3")].map((h3) => h3.textContent);
    expect(topHeadings.slice(1)).toEqual(["Elevator", "Floor"]);
    const rows = dialog.querySelectorAll(".api");
    expect(rows).toHaveLength(TOTAL_API_ROWS);
    const firstEntry = API_REFERENCE[0]?.entries[0];
    expect(firstEntry).toBeDefined();
    const firstRow = rows[0];
    expect(firstRow?.querySelector("summary code")?.textContent).toBe(firstEntry?.sig);
  });
});

describe("presentDocsModal search", () => {
  it("hides rows that don't match the query, keeps the one that does", () => {
    const { dialog } = setUp();
    search(dialog, "down_button_pressed");
    const rows = [...dialog.querySelectorAll(".api")];
    const matched = rows.filter((row) => !row.hasAttribute("hidden"));
    expect(matched).toHaveLength(1);
    expect(matched[0]?.querySelector("summary code")?.textContent).toBe("down_button_pressed");
  });

  it("shows the clear button once there's a query, hides it once cleared", () => {
    const { dialog } = setUp();
    search(dialog, "queue");
    expect(dialog.querySelector(".docsclear")?.hasAttribute("hidden")).toBe(false);
    search(dialog, "");
    expect(dialog.querySelector(".docsclear")?.hasAttribute("hidden")).toBe(true);
  });

  it("opens and marks a row that matched only in its own detail", () => {
    const { dialog } = setUp();
    search(dialog, "twice");
    const row = dialog.querySelector(".api:not([hidden])");
    expect(row).not.toBeNull();
    expect((row as HTMLDetailsElement | null)?.open).toBe(true);
    expect(row?.getAttribute("data-by-search")).toBe("1");
  });

  it("does not disturb a row whose own summary already matches", () => {
    const { dialog } = setUp();
    search(dialog, "manual edit");
    const row = dialog.querySelector(".api:not([hidden])");
    expect((row as HTMLDetailsElement | null)?.open).toBe(false);
    expect(row?.hasAttribute("data-by-search")).toBe(false);
  });

  it("folds a search-opened row back up once the query no longer matches it", () => {
    const { dialog } = setUp();
    search(dialog, "twice");
    const opened = dialog.querySelector<HTMLDetailsElement>(".api[data-by-search]");
    expect(opened).not.toBeNull();
    search(dialog, "down_button_pressed");
    expect(opened?.open).toBe(false);
    expect(opened?.hasAttribute("data-by-search")).toBe(false);
    expect(opened?.hasAttribute("hidden")).toBe(true);
  });

  it("leaves a row a person opened by hand open, even once the query changes", () => {
    const { dialog } = setUp();
    const row = dialog.querySelector<HTMLDetailsElement>(".api");
    if (row === null) {
      throw new TypeError("Expected at least one .api row");
    }
    row.open = true;
    row.dispatchEvent(new Event("toggle"));
    search(dialog, "the elevator");
    expect(row.open).toBe(true);
    expect(row.hasAttribute("data-by-search")).toBe(false);
  });

  it("hides a group's own heading once none of its rows match, keeps the other", () => {
    const { dialog } = setUp();
    search(dialog, "down_button_pressed");
    const headings = [...dialog.querySelectorAll(".docs-body > h3")];
    const elevatorHeading = headings.find((h3) => h3.textContent === "Elevator");
    const floorHeading = headings.find((h3) => h3.textContent === "Floor");
    expect(elevatorHeading?.hasAttribute("hidden")).toBe(true);
    expect(floorHeading?.hasAttribute("hidden")).toBe(false);
  });

  it("hides the guide, the intro code and the lead paragraph while searching", () => {
    const { dialog } = setUp();
    search(dialog, "queue");
    expect(dialog.querySelector(".docs-guide")?.hasAttribute("hidden")).toBe(true);
    expect(dialog.querySelector(".docs-intro")?.hasAttribute("hidden")).toBe(true);
    expect(dialog.querySelector(".docs-lead")?.hasAttribute("hidden")).toBe(true);
    search(dialog, "");
    expect(dialog.querySelector(".docs-guide")?.hasAttribute("hidden")).toBe(false);
    expect(dialog.querySelector(".docs-intro")?.hasAttribute("hidden")).toBe(false);
    expect(dialog.querySelector(".docs-lead")?.hasAttribute("hidden")).toBe(false);
  });

  it("shows the empty state once nothing matches", () => {
    const { dialog } = setUp();
    search(dialog, "zzz-nothing-matches-zzz");
    expect(dialog.querySelector(".docs-empty")?.hasAttribute("hidden")).toBe(false);
    expect([...dialog.querySelectorAll(".api:not([hidden])")]).toHaveLength(0);
  });

  it("the clear button clears the query, restores the rows and focuses the input", () => {
    const { dialog } = setUp();
    search(dialog, "zzz-nothing-matches-zzz");
    dialog.querySelector<HTMLButtonElement>(".docsclear")?.click();
    const input = dialog.querySelector<HTMLInputElement>(".docs-find");
    expect(input?.value).toBe("");
    expect([...dialog.querySelectorAll(".api:not([hidden])")]).toHaveLength(TOTAL_API_ROWS);
    expect(document.activeElement).toBe(input);
  });

  it("starts at the top and gives the reader their place back afterwards", () => {
    const { dialog, modal } = setUp();
    modal.open();
    scrollTo(dialog, 120);

    search(dialog, "queue");
    expect(bodyOf(dialog).scrollTop).toBe(0);
    // Where the results were read is not a place to come back to; the guide is.
    scrollTo(dialog, 300);
    search(dialog, "");

    expect(bodyOf(dialog).scrollTop).toBe(120);
  });

  it("closing the dialog clears the query", () => {
    const { dialog, modal } = setUp();
    modal.open();
    search(dialog, "queue");
    modal.close();
    const input = dialog.querySelector<HTMLInputElement>(".docs-find");
    expect(input?.value).toBe("");
    expect([...dialog.querySelectorAll(".api:not([hidden])")]).toHaveLength(TOTAL_API_ROWS);
  });
});

describe("presentDocsModal", () => {
  it("starts closed", () => {
    const { dialog } = setUp();
    expect(dialog.open).toBe(false);
  });

  it("open() shows the dialog modally and focuses the search box", () => {
    const { dialog, modal } = setUp();
    modal.open();
    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(dialog.querySelector(".docs-find"));
  });

  it("open() brings the reader back to where they were reading", () => {
    const { dialog, modal } = setUp();
    modal.open();
    scrollTo(dialog, 240);

    modal.close();
    modal.open();

    expect(bodyOf(dialog).scrollTop).toBe(240);
  });

  it("open() on a dialog already open leaves the focus where the reader put it", () => {
    const { dialog, modal } = setUp();
    modal.open();
    const closeButton = dialog.querySelector<HTMLButtonElement>(".docsclose");
    closeButton?.focus();

    modal.open();

    expect(document.activeElement).toBe(closeButton);
  });

  it("the close button closes the dialog", () => {
    const { dialog, modal } = setUp();
    modal.open();
    dialog.querySelector<HTMLButtonElement>(".docsclose")?.click();
    expect(dialog.open).toBe(false);
  });

  it("a click on the dialog's own backdrop closes it", () => {
    const { dialog, modal } = setUp();
    modal.open();
    dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(dialog.open).toBe(false);
  });

  it("update() redraws the header and rebuilds .docs-body in the language now active", () => {
    const { dialog, modal } = setUp();

    setLocale("ru");
    try {
      modal.update();

      expect(dialog.querySelector("h2")?.textContent).toBe("Справка");
      const input = dialog.querySelector<HTMLInputElement>(".docs-find");
      expect(input?.getAttribute("placeholder")).toBe("Поиск: goToFloor, ожидание, кнопка…");
      const closeButton = dialog.querySelector(".docsclose");
      expect(closeButton?.textContent).toBe("Закрыть");
      expect(closeButton?.getAttribute("title")).toBe("Закрыть справку");
      const headings = [...dialog.querySelectorAll(".docs-guide h3")].map((h3) => h3.textContent);
      expect(headings[0]).toBe("Что это за игра");
      expect(dialog.querySelectorAll(".api")).toHaveLength(TOTAL_API_ROWS);
    } finally {
      setLocale(DEFAULT_LOCALE);
    }
  });

  it("update() clears an in-progress search and un-hides the guide again", () => {
    const { dialog, modal } = setUp();
    search(dialog, "queue");
    expect(dialog.querySelector(".docs-guide")?.hasAttribute("hidden")).toBe(true);

    modal.update();

    const input = dialog.querySelector<HTMLInputElement>(".docs-find");
    expect(input?.value).toBe("");
    expect(dialog.querySelector(".docs-guide")?.hasAttribute("hidden")).toBe(false);
    expect([...dialog.querySelectorAll(".api:not([hidden])")]).toHaveLength(TOTAL_API_ROWS);
  });

  it("update() keeps a row opened by hand closed again after the rebuild", () => {
    const { dialog, modal } = setUp();
    const row = dialog.querySelector<HTMLDetailsElement>(".api");
    if (row === null) {
      throw new TypeError("Expected at least one .api row");
    }
    row.open = true;
    row.dispatchEvent(new Event("toggle"));

    modal.update();

    const rebuilt = dialog.querySelector<HTMLDetailsElement>(".api");
    expect(rebuilt?.open).toBe(false);
  });
});
