/**
 * What is left of the game view's markup templates once the ones with a
 * single consumer moved out to the entity and widget that draw them: the four
 * accessible-name label helpers a relabel has to share with the template that
 * first drew the name (see {@link floorCallUpLabel}), the seed link's plain
 * data shape, and {@link controlsTemplate}, which merely concatenates two
 * other modules' templates into the run controls row.
 *
 * Every word these functions put on screen is asked for with `t` *inside* the
 * function that returns it, never once at module scope. A `const` holding a
 * translated string would be filled in while this module was first imported,
 * which is before anything has had the chance to load a catalogue, so it would
 * be English for the rest of the session however often the player changed
 * language afterwards. The same reasoning is written out at length on
 * {@link "../game/challenges.ts"!ChallengeCondition.description}, which is a
 * getter for exactly this reason; here it costs nothing, because these
 * functions are already called afresh on every relabel or render.
 */

import { t } from "../i18n/index.ts";

import { speedStepperTemplate } from "#features/adjust-speed/index.ts";
import { runButtonsTemplate } from "#features/run-simulation/index.ts";

/**
 * The accessible name of a floor's "call an elevator going up" button.
 *
 * This and the three below it exist because the building is drawn once per run
 * and has to be *renamed* without being redrawn. Everything else the game puts
 * on screen is rebuilt when the language changes, but `widgets/building-stage`
 * mounts one view per floor, car and passenger and subscribes each to a
 * simulation object, so mounting it a second time would leave two buildings in
 * the page and two handlers on each event — and the only other way to get a
 * fresh one is to throw away the run in progress.
 *
 * So {@link "./presenters.ts"!relabelWorld} rewrites these four names in place.
 * The helpers are what keep it honest: a key spelled out both in a template and
 * in the relabeller is a key that can be changed in one of them, and the
 * building would then be renamed into a message that no longer exists — which
 * `t` answers with the key itself. There is one place per name, and both paths
 * call it.
 *
 * @param level - Floor number.
 * @returns The button's accessible name.
 */
export function floorCallUpLabel(level: number): string {
  return t("game.floor.callUp", { floor: level });
}

/**
 * The accessible name of a floor's "call an elevator going down" button.
 *
 * See {@link floorCallUpLabel} for why this is a function rather than a string
 * inside the template.
 *
 * @param level - Floor number.
 * @returns The button's accessible name.
 */
export function floorCallDownLabel(level: number): string {
  return t("game.floor.callDown", { floor: level });
}

/**
 * The accessible name of one elevator car.
 *
 * See {@link floorCallUpLabel} for why this is a function rather than a string
 * inside the template. The car is numbered from one for the reader while it is
 * indexed from zero in the code, and that conversion lives here so that the
 * relabeller cannot get it wrong on its own.
 *
 * @param index - Zero-based index of the car.
 * @returns The group's accessible name.
 */
export function elevatorLabel(index: number): string {
  return t("game.elevator.label", { number: index + 1 });
}

/**
 * The accessible name of one in-car floor button.
 *
 * See {@link floorCallUpLabel} for why this is a function rather than a string
 * inside the template.
 *
 * @param floorNum - Floor the button requests.
 * @returns The button's accessible name.
 */
export function elevatorFloorButtonLabel(floorNum: number): string {
  return t("game.elevator.floorButton", { floor: floorNum });
}

/** The seed of the run in progress, and where the line's link goes. */
export interface SeedLinkData {
  /** The seed itself, exactly as it appears in the URL. */
  readonly seed: string;
  /**
   * A hash URL that starts another run from this seed.
   *
   * The whole hash rather than the seed alone, for the reason every navigation
   * entry is: the app builds it with `createParamsUrl`, so the challenge, the
   * speed and anything else the player arrived with ride along. The building has
   * to ride along, since a seed means nothing without one.
   *
   * Given even when the URL already pins this seed, where the line no longer
   * offers it: it is still the run's address, and the console prints it as such
   * at every start.
   */
  readonly url: string;
  /**
   * A hash URL that starts the same challenge with no seed pinned, or `null`
   * when the URL pins none and there is nothing to take out.
   *
   * The pair is exclusive on purpose, and the line renders one link or the
   * other. Offering both would mean offering one that goes where the player
   * already is: with nothing pinned, the URL without a seed is the current one,
   * and with a seed pinned, the URL with it is.
   */
  readonly newDrawUrl: string | null;
}

/**
 * Everything that drives the run in progress, as one row.
 *
 * Drawn into its own region between the learning track's panel and the building
 * rather than into the challenge bar, which is where the start button and the
 * speed used to live. Two reasons, and the first is the one a player notices: a
 * task's panel is a screenful of prose, and with the controls above it the
 * button that starts the run sat at the top of that screenful while the building
 * it starts was at the bottom. The controls belong against the thing they
 * control.
 *
 * The second is that the challenge bar used to be rebuilt on every restart, so
 * every one of these buttons used to destroy itself when pressed — which is
 * what the challenge bar's own focus bookkeeping existed to paper over. This
 * region is drawn once for the life of the page and only relabelled, so a
 * keyboard player who presses Start over is still standing on Start over
 * afterwards, with nothing to restore.
 *
 * Three buttons and a speed, in that order, because the three are what the
 * player came for and the speed is a setting. Reset/undo-reset moved to the
 * editor pane's own codetools (`widgets/editor-pane`), since they act on the
 * code rather than the run. The three are `#features/run-simulation`'s
 * {@link import("#features/run-simulation/index.ts").runButtonsTemplate} —
 * see that module for their own history and design, including why "Run
 * instantly" sits beside Start rather than in a row of its own. The speed is
 * `#features/adjust-speed`'s
 * {@link import("#features/adjust-speed/index.ts").speedStepperTemplate} —
 * see that module for why it is a plain container of real buttons rather than
 * the `<h3>` wrapping two clickable `<i>` elements it used to be, and for its
 * `aria-live` region.
 *
 * @returns The run controls markup.
 */
export function controlsTemplate(): string {
  return runButtonsTemplate() + speedStepperTemplate();
}
