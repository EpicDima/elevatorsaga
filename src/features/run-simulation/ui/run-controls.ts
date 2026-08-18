/**
 * The four buttons that drive a run: start/pause/restart, start over, reset
 * code, and undo reset — plus "Run instantly", which starts the same run
 * without drawing it.
 *
 * Peeled out of `src/ui/presenters.ts`'s `presentControls`, which now composes
 * this with `#features/adjust-speed`'s speed stepper into the one `.controls`
 * region `src/app/app.ts` draws once, for the life of the page. That is why
 * every word below is written by {@link presentRunControls}'s `update()`
 * rather than baked into {@link runButtonsTemplate}: the row is drawn once and
 * only relabelled after, so a label baked into the markup would still be in
 * whatever language the page opened in after a change of language.
 *
 * These five were in three places before this row existed: start and the
 * speed in the challenge bar, "Reset"/"Undo reset" under the editor at one
 * end of a row, "Save"/"Apply" at the other. Being in three places is what
 * made them hard to tell apart — nothing about "Apply" said what it did that
 * "Save" did not, and neither was anywhere near the run it restarted. "Save"
 * is gone because the editor has always autosaved a second after the last
 * keystroke, so the button was a promise the game had already kept; "Apply"
 * is this row's Start over.
 *
 * "Undo reset" ships hidden and {@link presentRunControls} shows it once
 * there is a program to bring back. The legacy game offered it
 * unconditionally, which meant the most dangerous-looking button on the page
 * was live at moments when it could only do nothing.
 *
 * "Run instantly" is not a fifth kind of thing to learn — it starts the same
 * run the first button does, just without the building — so it sits beside
 * Start rather than in a row of its own, and disables itself for the
 * (ordinarily imperceptible) moment a crunch is actually in progress rather
 * than hiding, since a player who pressed it is exactly the player who wants
 * to see it was heard.
 */

import type { WorldController } from "#game/world-controller.ts";
import { t } from "#i18n/index.ts";
import { requireElement } from "#shared/lib/dom.ts";
import { createIcon } from "#shared/ui/icon.ts";
import { markup } from "../../../ui/templates.ts";

/**
 * The five run buttons, in the order they are read in.
 *
 * One box rather than five loose buttons: the row wraps on a narrow page, and
 * loose in it the five would break up one at a time. Ships with no label at
 * all — see the module comment for why {@link presentRunControls} writes
 * every one of them instead.
 *
 * @returns The run buttons' markup, to be composed into the wider controls
 * row alongside the speed stepper.
 */
export function runButtonsTemplate(): string {
  return markup`<div class="runbuttons"><button type="button" class="startstop unselectable"></button> <button type="button" class="startover unselectable"></button> <button type="button" class="resetcode unselectable"></button> <button type="button" class="undoreset unselectable" hidden></button> <button type="button" class="runinstant unselectable"></button></div>`;
}

/** What the run buttons need in order to draw and drive themselves. */
export interface RunControlsOptions {
  /** The controller being driven, consulted for `isPaused`. */
  readonly worldController: Pick<WorldController, "isPaused">;
  /**
   * Whether the run on screen is over, so the button offers to start again.
   *
   * A function rather than the world itself, because this region outlives
   * every run it drives: it is drawn once for the life of the page, and the
   * world it is reporting on is replaced on every restart.
   */
  readonly challengeEnded: () => boolean;
  /**
   * Whether there is a reset "Undo reset" could take back.
   *
   * Not "whether there is a program in the backup slot": see
   * `src/ui/editor.ts`'s `CodeEditor.canUndoReset`, where the difference is
   * the difference between a button that recovers work and one that destroys
   * it.
   */
  readonly canUndoReset: () => boolean;
  /** Called when the start/pause/restart button is pressed. */
  readonly onStartStop: () => void;
  /** Called when "Start over" is pressed. */
  readonly onStartOver: () => void;
  /** Called when "Reset code" is pressed. */
  readonly onResetCode: () => void;
  /** Called when "Undo reset" is pressed. */
  readonly onUndoReset: () => void;
  /**
   * Whether a headless crunch, started by "Run instantly", is under way.
   *
   * A function for the same reason {@link challengeEnded} is one: this row is
   * drawn once and outlives every run, including the private controller a
   * crunch drives itself with.
   */
  readonly instantRunInProgress: () => boolean;
  /** Called when "Run instantly" is pressed. */
  readonly onRunInstant: () => void;
}

/** The rendered run buttons. */
export interface RunControlsPresenter {
  /**
   * Relabels the start button, the visibility of "Undo reset" and the
   * "Run instantly" button's label and disabled state.
   *
   * Everything this touches is state the row reports rather than owns, so it
   * is called after anything that could have moved any of it: a pause, the
   * end of a run, a reset, a language change — and an edit, which is the one
   * that is easy to leave out. `canUndoReset` answers for the program on
   * screen, so typing moves it as surely as pressing Reset does, and a row
   * that is only refreshed by the run controls' own events would go on
   * offering to undo a reset the player has already typed over.
   */
  update(): void;

  /**
   * Puts focus on the start button.
   *
   * For the app, and only for the case it alone can see: a redraw that
   * emptied a region focus was inside — the end-of-challenge overlay holding
   * the "Next challenge" link, or the building — leaves focus on `<body>` and
   * a keyboard player back at the top of the page. The start button is where
   * they were going anyway. This row is one of the two the parent controls
   * region composes that survive every redraw, which is what makes it the
   * place to land.
   */
  focusStartStop(): void;
}

/**
 * Draws the run buttons and wires them up.
 *
 * Called once, from {@link "src/ui/presenters.ts"!presentControls}, and never
 * again — the markup never goes away, so {@link RunControlsPresenter.update}
 * is the whole of every redraw after the first.
 *
 * @param parent - The element {@link runButtonsTemplate}'s markup was written
 * into — the `.controls` region, today, alongside the speed stepper's markup.
 * @param options - The state to report on and the callbacks for the five
 * buttons.
 * @returns The presenter, already drawn.
 */
export function presentRunControls(
  parent: HTMLElement,
  options: RunControlsOptions,
): RunControlsPresenter {
  const startStop = requireElement(".startstop", parent);
  const startOver = requireElement(".startover", parent);
  const resetCode = requireElement(".resetcode", parent);
  const undoReset = requireElement(".undoreset", parent);
  const runInstant = requireElement(".runinstant", parent);

  startStop.addEventListener("click", () => {
    options.onStartStop();
  });
  startOver.addEventListener("click", () => {
    options.onStartOver();
  });
  resetCode.addEventListener("click", () => {
    options.onResetCode();
  });
  undoReset.addEventListener("click", () => {
    options.onUndoReset();
  });
  runInstant.addEventListener("click", () => {
    options.onRunInstant();
  });

  const presenter: RunControlsPresenter = {
    update(): void {
      startOver.textContent = t("game.button.startOver");
      resetCode.textContent = t("game.button.resetCode");
      undoReset.textContent = t("game.button.undoResetCode");
      if (options.challengeEnded()) {
        // The space belongs to this line rather than to the message: it is
        // the gap between the icon and the word, which every language needs
        // and no translator should have to remember to type.
        startStop.replaceChildren(createIcon("repeat"), ` ${t("game.button.restart")}`);
      } else {
        startStop.textContent = options.worldController.isPaused
          ? t("game.button.start")
          : t("game.button.pause");
      }
      // Hidden rather than disabled: there is nothing to explain to a player
      // who has not reset anything, and a disabled control they can neither
      // press nor tab to is a worse answer than one that is not there. It
      // appears the moment a reset gives it something to do.
      undoReset.hidden = !options.canUndoReset();
      // Disabled rather than hidden, unlike "Undo reset" above: a crunch is
      // ordinarily too quick to ever be seen in this state, so a player who
      // does see it pressed the button and wants to know it was heard, not to
      // have it vanish out from under the pointer.
      const inProgress = options.instantRunInProgress();
      runInstant.textContent = inProgress
        ? t("game.button.runningInstantly")
        : t("game.button.runInstant");
      runInstant.toggleAttribute("disabled", inProgress);
    },

    focusStartStop(): void {
      startStop.focus();
    },
  };
  // Before anything can take focus, so that a screen reader announces "Start"
  // rather than an unnamed button.
  presenter.update();
  return presenter;
}
