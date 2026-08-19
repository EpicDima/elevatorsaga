/**
 * The code slot switcher: three buttons choosing which of a challenge's three
 * saved programs the editor shows.
 *
 * Peeled out of what was `src/ui/presenters.ts`'s `presentCodeSlots` and
 * `src/ui/templates.ts`'s `codeSlotsTemplate`/`codeSlotTemplate`, which now
 * re-export this module's own symbols — see that module's history for why
 * the name was kept reachable there. Nothing about the switcher's behaviour
 * changes in the move; this is the same function, in a feature slice of its
 * own.
 */

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
 * The visible label is the whole phrase — "Code 1", not "1" — which is
 * `design/ui-mockup.html`'s own `.codebar` markup, and it replaces a bare
 * number carrying an `aria-label` of "Code slot 1". The switcher sits in the
 * bar above the editor now rather than in a toolbar under it, so there is room
 * for the noun; and the number on its own was never really enough. Two things
 * are better for it:
 *
 * - A sighted player reads what the three buttons are instead of guessing.
 *   Three numbered chips above a code editor could as easily be a font size or
 *   an indent width.
 * - The accessible name is now the visible label rather than a longer sentence
 *   standing in its place. That is what WCAG 2.5.3 (Label in Name) asks for,
 *   and the old pairing failed it outright: a player who says "click code
 *   one", or types it into a voice-control matcher, was matching against
 *   "Code slot 1" while looking at "1".
 *
 * `title` carries what the label still has no room for — the mockup's own
 * "Черновик N", a draft rather than a version or an attempt, so nobody expects
 * a history behind the number. It is a description, not the name: a `title` on
 * an element that already has text content is announced after that text, not
 * instead of it.
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
  return markup`<button type="button" class="codeslot" aria-pressed="${current}" title="${t("editor.slot.tab.title", { number: slot })}">${t("editor.slot.tab.label", { number: slot })}</button>`;
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
 * @param parent - The `.slots` element.
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
