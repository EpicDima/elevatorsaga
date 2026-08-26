import { t } from "../i18n/index.ts";

/**
 * The player's starting program, in the active locale.
 * A function, not a module-scope constant, so it doesn't freeze in whatever locale was active at import time.
 */
export function defaultCode(): string {
  return t("editor.defaultCode.code");
}

/**
 * A complete solution used only as the fixed yardstick the level tiers are calibrated against — changing a line of it moves the tiers.
 * Not translated (unlike {@link defaultCode}): it's measured, not read, so it must be the same fixture in every locale.
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
