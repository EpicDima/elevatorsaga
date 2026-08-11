/**
 * The starter programs the editor loads.
 *
 * These used to live in `index.html` as `<script type="text/plain">` blocks and
 * were read back out with `.text().trim()`. The page shell no longer has to
 * carry player-facing source code: the one program a player is handed comes out
 * of the message catalogue, and the one a developer asks for by name is a plain
 * string here.
 */

import { t } from "../i18n/index.ts";

/**
 * The program a new player starts with.
 *
 * Its text is `editor.defaultCode.code`, so the comments in it are in the
 * player's own language. It is the first thing anyone sees of the game's API
 * and the Help page walks through exactly this code, in whichever language they
 * are reading that in — a Russian help page beside an English program was the
 * seam this closes. Both catalogues held the program already; nothing read
 * either of them.
 *
 * A function rather than a constant because {@link t} answers for the locale
 * that is active when it is called. A module-scope `const` would answer for
 * whichever locale happened to be active when this module was first imported,
 * which is a fault this codebase has already had to repair twice.
 *
 * @returns The starting program, in the active locale.
 */
export function defaultCode(): string {
  return t("editor.defaultCode.code");
}

/**
 * The program `#devtest` loads: a naive but complete solution.
 *
 * Not translated and not in the catalogue, unlike {@link defaultCode}: nobody
 * reaches it without typing `#devtest` into the address bar, and what it is for
 * is checking that the game still plays, not teaching anybody the API.
 *
 * Rewritten without lodash — `_.max`, `_.each` and `_.contains` became
 * `Array.prototype.reduce`, `forEach` and `includes` — and `floor.level`
 * became the documented `floor.floorNum()`. The behaviour is unchanged: the
 * elevator picked for a call is still the one with the best score, ties still
 * going to the first one, and the scoring terms are identical.
 */
export const DEV_TEST_CODE = `{
    init: function(elevators, floors) {
        function pickupScore(elevator, floorNum) {
            var queueLength = elevator.destinationQueue.length;
            var loadFactor = elevator.loadFactor();
            return (elevator.destinationQueue.includes(floorNum) ? 4 : 0) +
                (-queueLength * queueLength) +
                (-loadFactor * loadFactor * 3);
        }

        function selectElevatorForFloorPickup(floorNum) {
            return elevators.reduce(function(best, elevator) {
                return pickupScore(elevator, floorNum) > pickupScore(best, floorNum)
                    ? elevator
                    : best;
            });
        }

        floors.forEach(function(floor) {
            floor.on("down_button_pressed up_button_pressed", function() {
                var floorNum = floor.floorNum();
                var elevator = selectElevatorForFloorPickup(floorNum);
                if(!elevator.destinationQueue.includes(floorNum)) {
                    elevator.goToFloor(floorNum);
                }
            });
        });
        elevators.forEach(function(elevator) {
            elevator.on("floor_button_pressed", function(floorNum) {
                elevator.goToFloor(floorNum);
            });
            elevator.on("idle", function() {
                elevator.goToFloor(0);
            });
        });
    },
    update: function(dt, elevators, floors) {
    }
}`;
