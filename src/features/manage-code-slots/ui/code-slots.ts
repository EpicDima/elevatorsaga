/** The code slot switcher: three buttons choosing which of a level's three saved programs the editor shows. */

import { CODE_SLOTS, type CodeSlot } from "../model/code-slots.ts";
import { t } from "#i18n/index.ts";
import { queryAll } from "#shared/lib/dom.ts";
import { markup } from "#shared/ui/markup.ts";

/** Selects a code slot button, for the delegated click listener and the tests alike. */
const CODE_SLOT_SELECTOR = ".codeslot";

/** Everything the code slot switcher needs in order to render itself. */
export interface CodeSlotsData {
  /** The slot open in the editor right now. */
  readonly currentSlot: CodeSlot;
}

/**
 * One button of the code slot switcher.
 *
 * The visible label is the full phrase ("Code 1"), matching the accessible
 * name per WCAG 2.5.3. `aria-pressed`, not `aria-current`: a slot is a toggle
 * a player presses, not an address like a level.
 */
function codeSlotTemplate(slot: CodeSlot, current: boolean): string {
  return markup`<button type="button" class="codeslot" aria-pressed="${current}" title="${t("editor.slot.tab.title", { number: slot })}">${t("editor.slot.tab.label", { number: slot })}</button>`;
}

/** The code slot switcher, as one row of buttons, rebuilt from scratch on every call. */
export function codeSlotsTemplate(data: CodeSlotsData): string {
  return CODE_SLOTS.map((slot) => codeSlotTemplate(slot, slot === data.currentSlot)).join("");
}

/** What the code slot switcher needs in order to draw and drive itself. */
export interface CodeSlotsPresenterOptions {
  /** Which slot is open in the editor right now. */
  readonly currentSlot: () => CodeSlot;
  /** Called when a slot button is pressed. */
  readonly onSelect: (slot: CodeSlot) => void;
}

/** The rendered code slot switcher. */
export interface CodeSlotsPresenter {
  /** Redraws the row, marking whichever slot `currentSlot` now answers as pressed. */
  update(): void;
}

/**
 * Draws the code slot switcher and wires it up.
 *
 * The click listener is bound once, on `parent`, rather than on the buttons
 * `update` throws away and redraws — a listener on a removed button hears nothing.
 */
export function presentCodeSlots(
  parent: HTMLElement,
  options: CodeSlotsPresenterOptions,
): CodeSlotsPresenter {
  parent.addEventListener("click", (event) => {
    const target = event.target;
    const button = target instanceof Element ? target.closest(CODE_SLOT_SELECTOR) : null;
    if (!(button instanceof HTMLElement)) {
      return;
    }
    const slot = CODE_SLOTS[queryAll(CODE_SLOT_SELECTOR, parent).indexOf(button)];
    if (slot !== undefined) {
      options.onSelect(slot);
    }
  });

  const presenter: CodeSlotsPresenter = {
    update(): void {
      parent.innerHTML = codeSlotsTemplate({ currentSlot: options.currentSlot() });
    },
  };
  presenter.update();
  return presenter;
}
