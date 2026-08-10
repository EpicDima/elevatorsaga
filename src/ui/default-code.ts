/**
 * The starter programs the editor loads.
 *
 * These used to live in `index.html` as `<script type="text/plain">` blocks and
 * were read back out with `.text().trim()`. They are plain strings here, so the
 * page shell no longer has to carry player-facing source code.
 */

/**
 * The program a new player starts with.
 *
 * Kept byte for byte as it was: it is the first thing anyone sees of the game's
 * API, and the Help page walks through exactly this code.
 */
export const DEFAULT_CODE = `{
    init: function(elevators, floors) {
        var elevator = elevators[0]; // Let's use the first elevator

        // Whenever the elevator is idle (has no more queued destinations) ...
        elevator.on("idle", function() {
            // let's go to all the floors (or did we forget one?)
            elevator.goToFloor(0);
            elevator.goToFloor(1);
        });
    },
    update: function(dt, elevators, floors) {
        // We normally don't need to do anything here
    }
}`;

/**
 * The program `#devtest` loads: a naive but complete solution.
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
