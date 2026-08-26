// @vitest-environment jsdom

import { beforeAll, describe, expect, it } from "vitest";

import { createModal } from "./modal.ts";
import { polyfillDialogElement } from "./test-helpers.ts";

beforeAll(() => {
  polyfillDialogElement();
});

/** Builds a dialog, a close button inside it, and the modal wiring them together. */
function setUp(): {
  dialog: HTMLDialogElement;
  closeButton: HTMLButtonElement;
  modal: ReturnType<typeof createModal>;
} {
  const dialog = document.createElement("dialog");
  const closeButton = document.createElement("button");
  dialog.append(closeButton);
  document.body.append(dialog);
  const modal = createModal(dialog, closeButton);
  return { dialog, closeButton, modal };
}

/** Dispatches a bubbling click on an element, the way a pointer click does. */
function click(element: Element): void {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("createModal", () => {
  it("starts closed", () => {
    const { dialog } = setUp();

    expect(dialog.open).toBe(false);
  });

  it("open() shows the dialog modally", () => {
    const { dialog, modal } = setUp();

    modal.open();

    expect(dialog.open).toBe(true);
  });

  it("open() does nothing when the dialog is already open", () => {
    const { dialog, modal } = setUp();

    modal.open();
    modal.open();

    expect(dialog.open).toBe(true);
  });

  it("close() hides the dialog", () => {
    const { dialog, modal } = setUp();

    modal.open();
    modal.close();

    expect(dialog.open).toBe(false);
  });

  it("closes on a click on the close button", () => {
    const { dialog, modal, closeButton } = setUp();

    modal.open();
    click(closeButton);

    expect(dialog.open).toBe(false);
  });

  it("closes on a click on the dialog's own backdrop", () => {
    const { dialog, modal } = setUp();

    modal.open();
    click(dialog);

    expect(dialog.open).toBe(false);
  });

  it("does not close on a click inside the dialog's content", () => {
    const { dialog, modal, closeButton } = setUp();
    const content = document.createElement("p");
    dialog.append(content);

    modal.open();
    click(content);

    expect(dialog.open).toBe(true);
    // Confirms the close button still works after the no-op click above.
    click(closeButton);
    expect(dialog.open).toBe(false);
  });
});
