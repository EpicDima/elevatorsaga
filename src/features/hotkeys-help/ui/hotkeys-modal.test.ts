// @vitest-environment jsdom

import { beforeAll, describe, expect, it } from "vitest";

import { hotkeysModalTemplate, presentHotkeysModal } from "./hotkeys-modal.ts";
import { DEFAULT_LOCALE, setLocale } from "#i18n/index.ts";
import { renderElement } from "#shared/ui/markup.ts";
import { polyfillDialogElement } from "#shared/ui/test-helpers.ts";

beforeAll(() => {
  polyfillDialogElement();
});

/**
 * Parses {@link hotkeysModalTemplate}'s markup, mounts it and wires it up.
 *
 * @returns The dialog and the modal wired against it.
 */
function setUp(): { dialog: HTMLDialogElement; modal: ReturnType<typeof presentHotkeysModal> } {
  const element = renderElement(hotkeysModalTemplate());
  if (!(element instanceof HTMLDialogElement)) {
    throw new TypeError("Expected hotkeysModalTemplate() to describe a <dialog>");
  }
  document.body.append(element);
  const modal = presentHotkeysModal(element);
  return { dialog: element, modal };
}

describe("hotkeysModalTemplate", () => {
  it("draws a title and a close button", () => {
    const { dialog } = setUp();

    expect(dialog.querySelector("h2")?.textContent).toBe("Keyboard shortcuts");
    const closeButton = dialog.querySelector(".keysclose");
    expect(closeButton?.textContent).toBe("Close");
    expect(closeButton?.getAttribute("title")).toBe("Close window");
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

  it("draws a row per shortcut, pairing a label with the keys that chord it", () => {
    const { dialog } = setUp();

    const rows = [...dialog.querySelectorAll(".keyrow")];
    expect(
      rows.map((row) => [
        row.querySelector("span")?.textContent,
        [...row.querySelectorAll("kbd")].map((kbd) => kbd.textContent).join("+"),
      ]),
    ).toEqual([
      ["Start and pause", "Space"],
      ["Start over", "Ctrl+Enter"],
      ["Switch layout", "Ctrl+B"],
      ["Help", "F1"],
      ["Settings", "?"],
      ["Apply the code and start over", "Ctrl+Enter"],
      ["Save right away", "Ctrl+S"],
      ["Suggest a call", "Ctrl+Space"],
      ["Find and replace", "Ctrl+F"],
      ["Next match", "Ctrl+G"],
      ["Previous match", "Ctrl+Shift+G"],
      ["Add the next occurrence to the selection", "Ctrl+D"],
      ["Indent", "Tab"],
      ["Move the focus out", "Esc"],
    ]);
  });

  it("heads each group with the scope its rows actually have", () => {
    const { dialog } = setUp();

    expect(
      [...dialog.querySelectorAll(".keys-group")].map((heading) => heading.textContent),
    ).toEqual(["When nothing is focused", "Outside the code editor", "In the code editor"]);
  });

  it("gives the space bar a scope of its own, since it is not the others'", () => {
    // The page claims Space only while `document.body` is the keydown's target; the other four
    // fire wherever the focus is, as long as it is not somewhere text is being typed.
    const { dialog } = setUp();

    const groups = [...dialog.querySelectorAll(".keys-group")];
    const rowsUnder = (heading: Element | undefined): string[] => {
      const rows: string[] = [];
      for (let node = heading?.nextElementSibling; node != null; node = node.nextElementSibling) {
        if (node.classList.contains("keys-group")) {
          break;
        }
        rows.push(node.querySelector("span")?.textContent ?? "");
      }
      return rows;
    };
    expect(rowsUnder(groups[0])).toEqual(["Start and pause"]);
    expect(rowsUnder(groups[1])).toEqual(["Start over", "Switch layout", "Help", "Settings"]);
  });

  it("joins each chord's caps with a +", () => {
    const { dialog } = setUp();

    const row = [...dialog.querySelectorAll(".keyrow")].find(
      (candidate) => candidate.querySelector("span")?.textContent === "Previous match",
    );
    expect(row?.textContent).toBe("Previous matchCtrl+Shift+G");
  });

  it("marks every Mod- binding for relabeling, and leaves completion's literal Ctrl alone", () => {
    const { dialog } = setUp();

    // CodeMirror's completionKeymap gives Ctrl-Space no Mac spelling of its own, so
    // relabeling that one to ⌘ would advertise a chord that does nothing.
    const marked = [...dialog.querySelectorAll(".keyrow")]
      .filter((row) => row.querySelector("kbd[data-mod-key]") !== null)
      .map((row) => row.querySelector("span")?.textContent);
    expect(marked).toEqual([
      "Start over",
      "Switch layout",
      "Apply the code and start over",
      "Save right away",
      "Find and replace",
      "Next match",
      "Previous match",
      "Add the next occurrence to the selection",
    ]);
    expect([...dialog.querySelectorAll("kbd[data-mod-key]")].map((key) => key.textContent)).toEqual(
      Array.from({ length: marked.length }, () => "Ctrl"),
    );
  });
});

describe("presentHotkeysModal", () => {
  it("starts closed", () => {
    const { dialog } = setUp();

    expect(dialog.open).toBe(false);
  });

  it("open() shows the dialog modally", () => {
    const { dialog, modal } = setUp();

    modal.open();

    expect(dialog.open).toBe(true);
  });

  it("the close button closes the dialog", () => {
    const { dialog, modal } = setUp();
    modal.open();

    dialog.querySelector<HTMLButtonElement>(".keysclose")?.click();

    expect(dialog.open).toBe(false);
  });

  it("a click on the dialog's own backdrop closes it", () => {
    const { dialog, modal } = setUp();
    modal.open();

    dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(dialog.open).toBe(false);
  });

  it("update() redraws every label in the language now active, leaving the kbds alone", () => {
    const { dialog, modal } = setUp();

    setLocale("ru");
    try {
      modal.update();

      expect(dialog.querySelector("h2")?.textContent).toBe("Горячие клавиши");
      const closeButton = dialog.querySelector(".keysclose");
      expect(closeButton?.textContent).toBe("Закрыть");
      expect(closeButton?.getAttribute("title")).toBe("Закрыть окно");
      expect(
        [...dialog.querySelectorAll(".keys-group")].map((heading) => heading.textContent),
      ).toEqual(["Когда ничего не в фокусе", "Вне редактора кода", "В редакторе кода"]);
      const rows = [...dialog.querySelectorAll(".keyrow")];
      expect(rows.map((row) => row.querySelector("span")?.textContent)).toEqual([
        "Пуск и пауза",
        "Начать заново",
        "Сменить раскладку",
        "Справка",
        "Настройки",
        "Применить код и начать заново",
        "Сохранить сразу",
        "Подсказать вызов",
        "Найти и заменить",
        "Следующее совпадение",
        "Предыдущее совпадение",
        "Добавить к выделению следующее вхождение",
        "Отступ",
        "Убрать фокус из редактора",
      ]);
      expect(
        rows.map((row) => [...row.querySelectorAll("kbd")].map((kbd) => kbd.textContent).join("+")),
      ).toEqual([
        "Space",
        "Ctrl+Enter",
        "Ctrl+B",
        "F1",
        "?",
        "Ctrl+Enter",
        "Ctrl+S",
        "Ctrl+Space",
        "Ctrl+F",
        "Ctrl+G",
        "Ctrl+Shift+G",
        "Ctrl+D",
        "Tab",
        "Esc",
      ]);
    } finally {
      setLocale(DEFAULT_LOCALE);
    }
  });
});
