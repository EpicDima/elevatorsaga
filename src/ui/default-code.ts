/**
 * The program the editor starts a player on, and the one the tiers are
 * measured against.
 *
 * These used to live in `index.html` as `<script type="text/plain">` blocks and
 * were read back out with `.text().trim()`. The page shell no longer has to
 * carry player-facing source code: the one program a player is handed comes out
 * of the message catalogue, and the one only the tests read is a plain string
 * here.
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
 * A naive but complete solution, kept as the yardstick the challenge tiers are
 * calibrated against.
 *
 * No player ever sees it. `#devtest` used to load it into the editor and was
 * retired along with `#autostart`: a QA route that replaced whatever was on
 * screen is a poor thing to leave in an address bar players share. What reads
 * it now is `src/game/challenge-tiers-solutions.test.ts`, which plays it and
 * the reference dispatcher over every challenge and every measured seed, so
 * this text is a recorded fixture — changing a line of it moves the tiers.
 *
 * Not translated and not in the catalogue, unlike {@link defaultCode}: it is
 * measured rather than read, and a program whose comments moved with the
 * player's language would be a different fixture in each locale.
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
