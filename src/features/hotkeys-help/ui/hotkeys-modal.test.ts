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

  it("draws five rows pairing a label with its own key", () => {
    const { dialog } = setUp();

    const rows = [...dialog.querySelectorAll(".keyrow")];
    expect(rows.map((row) => row.querySelector("span")?.textContent)).toEqual([
      "Start and pause",
      "Start over",
      "Switch layout",
      "Help",
      "Settings",
    ]);
    expect(
      rows.map((row) => [...row.querySelectorAll("kbd")].map((kbd) => kbd.textContent)),
    ).toEqual([["Space"], ["Ctrl", "Enter"], ["Ctrl", "B"], ["F1"], ["?"]]);
  });

  it("marks only the two Mod- bindings for relabelling", () => {
    const { dialog } = setUp();

    const modKeys = [...dialog.querySelectorAll("kbd[data-mod-key]")];
    expect(modKeys.map((key) => key.textContent)).toEqual(["Ctrl", "Ctrl"]);
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
      const rows = [...dialog.querySelectorAll(".keyrow")];
      expect(rows.map((row) => row.querySelector("span")?.textContent)).toEqual([
        "Пуск и пауза",
        "Начать заново",
        "Сменить раскладку",
        "Справка",
        "Настройки",
      ]);
      expect(
        rows.map((row) => [...row.querySelectorAll("kbd")].map((kbd) => kbd.textContent)),
      ).toEqual([["Space"], ["Ctrl", "Enter"], ["Ctrl", "B"], ["F1"], ["?"]]);
    } finally {
      setLocale(DEFAULT_LOCALE);
    }
  });
});
