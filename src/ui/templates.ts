/**
 * What is left of the game view's markup templates once the ones with a
 * single consumer moved out to the entity and widget that draw them, and
 * `controlsTemplate` — which merely concatenated two other modules' templates
 * into the run controls row — folded into
 * {@link "#pages/game/index.ts"!App}, its only caller: the four
 * accessible-name label helpers a relabel has to share with the template that
 * first drew the name (see {@link floorCallUpLabel}), and the seed link's
 * plain data shape.
 *
 * Every word these functions put on screen is asked for with `t` *inside* the
 * function that returns it, never once at module scope. A `const` holding a
 * translated string would be filled in while this module was first imported,
 * which is before anything has had the chance to load a catalog, so it would
 * be English for the rest of the session however often the player changed
 * language afterwards. The same reasoning is written out at length on
 * {@link "../game/levels.ts"!LevelCondition.description}, which is a
 * getter for exactly this reason; here it costs nothing, because these
 * functions are already called afresh on every relabel or render.
 */

import { t } from "../i18n/index.ts";

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
 * So {@link "#pages/game/index.ts"!relabelWorld} rewrites these four names in place.
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
 * inside the template. Cars are numbered from zero, the way the floors are: the
 * number on a shaft is the one that subscripts `elevators` in the player's own
 * program, so the car a hover card calls 0 is `elevators[0]` and nothing has to
 * be converted between reading the building and writing about it.
 *
 * @param index - Zero-based index of the car.
 * @returns The group's accessible name.
 */
export function elevatorLabel(index: number): string {
  return t("game.elevator.label", { number: index });
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
   * A hash URL that names this run outright, seed and all.
   *
   * The whole hash rather than the seed alone, for the reason every navigation
   * entry is: the app builds it with `createParamsUrl`, so the level, the
   * speed and anything else the player arrived with ride along. The building has
   * to ride along, since a seed means nothing without one.
   *
   * Given even when the URL already pins this seed, where following it goes
   * nowhere: it is still the run's address, and the console prints it as such
   * at every start.
   *
   * There used to be a second URL beside it, `newDrawUrl` — this hash with the
   * seed taken back out, which was how a player asked for a different draw for
   * as long as an address without a seed meant a fresh one. It means the seed
   * the player already owns now (`src/pages/game/index.ts`'s `handleRoute`),
   * so a new draw is no longer somewhere to go: `features/manage-seed` draws
   * one itself, on a button.
   */
  readonly url: string;
}
