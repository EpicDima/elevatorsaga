/**
 * The code slot switcher: three buttons choosing which of a challenge's three
 * saved programs the editor shows.
 *
 * Peeled out of `src/ui/presenters.ts`'s `presentCodeSlots` and
 * `src/ui/templates.ts`'s `codeSlotsTemplate`/`codeSlotTemplate`, which now
 * re-export this module's own symbols — see `presenters.ts` for why the name
 * is kept reachable there. Nothing about the switcher's behaviour changes in
 * the move; this is the same function, in a feature slice of its own.
 */

import { CODE_SLOTS, type CodeSlot } from "../model/code-slots.ts";
import { t } from "#i18n/index.ts";
import { queryAll } from "#shared/lib/dom.ts";
import { markup } from "../../../ui/templates.ts";

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
 * The visible label is the bare number, the same choice `challengeLinkTemplate`
 * makes for the challenge row and for the same reason: three of these have to
 * sit in whatever room the toolbar under the editor leaves them, and a number on
 * its own says nothing to a screen reader about what it does. `aria-label`
 * carries the sentence the number is short for.
 *
 * `aria-pressed` rather than `aria-current`: a slot is not a place with an
 * address of its own the way a challenge is, it is a toggle a player presses to
 * change what the editor is showing, the same kind of control the floor call and
 * in-car buttons are. The stylesheet marks the same button off the same
 * attribute, following `.challengelink[aria-current]`, so the two cannot drift
 * apart.
 *
 * @param slot - The slot this button switches to.
 * @param current - Whether this is the slot open in the editor right now.
 * @returns The button markup.
 */
function codeSlotTemplate(slot: CodeSlot, current: boolean): string {
  return markup`<button type="button" class="codeslot" aria-pressed="${current}" aria-label="${t("editor.slot.tab.label", { number: slot })}">${slot}</button>`;
}

/**
 * The code slot switcher, as one row of buttons.
 *
 * Rebuilt from scratch on every call rather than updated in place, unlike
 * `controlsTemplate`'s buttons: there are only three of these, switching one
 * off and another on is the entire update, and nothing about them — no timer,
 * no focus held mid-edit — needs to survive being replaced the way the run
 * controls do.
 *
 * @param data - Which slot is open in the editor right now.
 * @returns The switcher's markup.
 */
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
  /**
   * Redraws the row, marking whichever slot `currentSlot` now answers as
   * pressed.
   *
   * Rebuilds the row's markup rather than relabelling what is there, unlike
   * `ControlsPresenter.update`: three buttons are cheap enough to throw away
   * and redraw, and nothing about them — no timer, no text mid-edit — has to
   * survive being replaced the way the run controls' own do.
   */
  update(): void;
}

/**
 * Draws the code slot switcher and wires it up.
 *
 * The click listener is bound once, on `parent`, rather than on the buttons
 * `update` throws away and redraws: a listener on a button `update` has just
 * removed from the document hears nothing.
 *
 * @param parent - The `.codeslots` element.
 * @param options - Which slot is current, and the callback for picking another.
 * @returns The presenter, already drawn.
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
