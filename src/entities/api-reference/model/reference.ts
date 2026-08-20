/**
 * The API reference table `docs-modal.ts` draws below the guide: `design/ui-mockup.html`'s own
 * `API_DOCS`, an `elevator` group of sixteen entries and a `floor` group of three, in the same
 * order the mockup lists them.
 *
 * Plain data, with no `t()` call of its own — {@link API_REFERENCE} names a catalogue key for
 * every piece of prose a row needs rather than holding the prose itself, the same purity
 * `#entities/level/model/level-list.ts` keeps for the same reason: a presenter reads the
 * active locale, this module does not need to know one exists.
 */

import type { MessageArgs, MessageKey } from "#i18n/index.ts";

/**
 * A message key that takes no parameters.
 *
 * Every field below names a key `docs-modal.ts` hands straight to `t()` with
 * no second argument, so it is typed to the keys that allow that rather than
 * the whole of {@link MessageKey} — otherwise the call would demand a
 * parameter object, since some member of that wider union does. The same
 * trick, under the same name, as `#widgets/goal-bar/ui/goal-bar.ts`'s and
 * `#widgets/stats-panel/ui/stats-panel.ts`'s own `NoParamMessageKey`.
 */
type NoParamMessageKey = { [K in MessageKey]: MessageArgs<K> extends [] ? K : never }[MessageKey];

/** One row of the API reference: `docs-modal.ts`'s own `<details class="api">`. */
export interface ApiReferenceEntry {
  /** A stable id, unique within its own group — not shown, only used to key the row. */
  readonly id: string;
  /** The method or event signature the row's own `<summary>` shows in place of a title. */
  readonly sig: string;
  /** The catalogue key for the row's one-line summary, shown collapsed. */
  readonly shortKey: NoParamMessageKey;
  /** The catalogue key for the row's longer explanation, shown once the row expands. */
  readonly moreKey: NoParamMessageKey;
  /** The catalogue key for the row's example, highlighted and shown once the row expands. */
  readonly codeKey: NoParamMessageKey;
}

/** One heading of the API reference, and the rows listed under it. */
export interface ApiReferenceGroup {
  /** The catalogue key for the group's own heading. */
  readonly labelKey: NoParamMessageKey;
  /** The group's own rows, in display order. */
  readonly entries: readonly ApiReferenceEntry[];
}

/** The API reference table, in the order `docs-modal.ts` lists it. */
export const API_REFERENCE: readonly ApiReferenceGroup[] = [
  {
    labelKey: "game.apiRef.elevator.groupLabel",
    entries: [
      {
        id: "goToFloor",
        sig: "elevator.goToFloor(floor)",
        shortKey: "game.apiRef.elevator.goToFloor.short",
        moreKey: "game.apiRef.elevator.goToFloor.more",
        codeKey: "game.apiRef.elevator.goToFloor.code",
      },
      {
        id: "goToFloorPriority",
        sig: "elevator.goToFloor(floor, true)",
        shortKey: "game.apiRef.elevator.goToFloorPriority.short",
        moreKey: "game.apiRef.elevator.goToFloorPriority.more",
        codeKey: "game.apiRef.elevator.goToFloorPriority.code",
      },
      {
        id: "stop",
        sig: "elevator.stop()",
        shortKey: "game.apiRef.elevator.stop.short",
        moreKey: "game.apiRef.elevator.stop.more",
        codeKey: "game.apiRef.elevator.stop.code",
      },
      {
        id: "currentFloor",
        sig: "elevator.currentFloor()",
        shortKey: "game.apiRef.elevator.currentFloor.short",
        moreKey: "game.apiRef.elevator.currentFloor.more",
        codeKey: "game.apiRef.elevator.currentFloor.code",
      },
      {
        id: "destinationQueue",
        sig: "elevator.destinationQueue",
        shortKey: "game.apiRef.elevator.destinationQueue.short",
        moreKey: "game.apiRef.elevator.destinationQueue.more",
        codeKey: "game.apiRef.elevator.destinationQueue.code",
      },
      {
        id: "checkDestinationQueue",
        sig: "elevator.checkDestinationQueue()",
        shortKey: "game.apiRef.elevator.checkDestinationQueue.short",
        moreKey: "game.apiRef.elevator.checkDestinationQueue.more",
        codeKey: "game.apiRef.elevator.checkDestinationQueue.code",
      },
      {
        id: "getPressedFloors",
        sig: "elevator.getPressedFloors()",
        shortKey: "game.apiRef.elevator.getPressedFloors.short",
        moreKey: "game.apiRef.elevator.getPressedFloors.more",
        codeKey: "game.apiRef.elevator.getPressedFloors.code",
      },
      {
        id: "loadFactor",
        sig: "elevator.loadFactor()",
        shortKey: "game.apiRef.elevator.loadFactor.short",
        moreKey: "game.apiRef.elevator.loadFactor.more",
        codeKey: "game.apiRef.elevator.loadFactor.code",
      },
      {
        id: "maxPassengerCount",
        sig: "elevator.maxPassengerCount()",
        shortKey: "game.apiRef.elevator.maxPassengerCount.short",
        moreKey: "game.apiRef.elevator.maxPassengerCount.more",
        codeKey: "game.apiRef.elevator.maxPassengerCount.code",
      },
      {
        id: "destinationDirection",
        sig: "elevator.destinationDirection()",
        shortKey: "game.apiRef.elevator.destinationDirection.short",
        moreKey: "game.apiRef.elevator.destinationDirection.more",
        codeKey: "game.apiRef.elevator.destinationDirection.code",
      },
      {
        id: "goingUpIndicator",
        sig: "elevator.goingUpIndicator(on)",
        shortKey: "game.apiRef.elevator.goingUpIndicator.short",
        moreKey: "game.apiRef.elevator.goingUpIndicator.more",
        codeKey: "game.apiRef.elevator.goingUpIndicator.code",
      },
      {
        id: "goingDownIndicator",
        sig: "elevator.goingDownIndicator(on)",
        shortKey: "game.apiRef.elevator.goingDownIndicator.short",
        moreKey: "game.apiRef.elevator.goingDownIndicator.more",
        codeKey: "game.apiRef.elevator.goingDownIndicator.code",
      },
      {
        id: "idle",
        sig: "idle",
        shortKey: "game.apiRef.elevator.idle.short",
        moreKey: "game.apiRef.elevator.idle.more",
        codeKey: "game.apiRef.elevator.idle.code",
      },
      {
        id: "floorButtonPressed",
        sig: "floor_button_pressed(floor)",
        shortKey: "game.apiRef.elevator.floorButtonPressed.short",
        moreKey: "game.apiRef.elevator.floorButtonPressed.more",
        codeKey: "game.apiRef.elevator.floorButtonPressed.code",
      },
      {
        id: "passingFloor",
        sig: "passing_floor(floor, direction)",
        shortKey: "game.apiRef.elevator.passingFloor.short",
        moreKey: "game.apiRef.elevator.passingFloor.more",
        codeKey: "game.apiRef.elevator.passingFloor.code",
      },
      {
        id: "stoppedAtFloor",
        sig: "stopped_at_floor(floor)",
        shortKey: "game.apiRef.elevator.stoppedAtFloor.short",
        moreKey: "game.apiRef.elevator.stoppedAtFloor.more",
        codeKey: "game.apiRef.elevator.stoppedAtFloor.code",
      },
    ],
  },
  {
    labelKey: "game.apiRef.floor.groupLabel",
    entries: [
      {
        id: "floorNum",
        sig: "floor.floorNum()",
        shortKey: "game.apiRef.floor.floorNum.short",
        moreKey: "game.apiRef.floor.floorNum.more",
        codeKey: "game.apiRef.floor.floorNum.code",
      },
      {
        id: "upButtonPressed",
        sig: "up_button_pressed",
        shortKey: "game.apiRef.floor.upButtonPressed.short",
        moreKey: "game.apiRef.floor.upButtonPressed.more",
        codeKey: "game.apiRef.floor.upButtonPressed.code",
      },
      {
        id: "downButtonPressed",
        sig: "down_button_pressed",
        shortKey: "game.apiRef.floor.downButtonPressed.short",
        moreKey: "game.apiRef.floor.downButtonPressed.more",
        codeKey: "game.apiRef.floor.downButtonPressed.code",
      },
    ],
  },
];
