/** Reference collective-control dispatcher, used to calibrate tier thresholds against a real solution's performance. */

/**
 * Builds a `{ init, update }` dispatcher, as ES5 source since it runs as
 * player code: each call goes to the best car serving that floor, preferring
 * one under `loadCutoff` already sweeping toward it; idle cars park at floor 0.
 *
 * @param loadCutoff - Load factor at or above which a car stops accepting new pickups.
 */
export function buildGoodDispatcherCode(loadCutoff: number): string {
  return `{
    init: function(elevators, floors) {
        var loadCutoff = ${String(loadCutoff)};

        function elevatorDirection(elevator) {
            var direction = elevator.destinationDirection();
            return direction === "stopped" ? null : direction;
        }

        function isUnderCutoff(elevator) {
            return !elevator.isFull() && elevator.loadFactor() < loadCutoff;
        }

        function isHeadingTowardCall(elevator, floorNum, callDirection) {
            var direction = elevatorDirection(elevator);
            if (direction === null) {
                return true;
            }
            if (direction !== callDirection) {
                return false;
            }
            var current = elevator.currentFloor();
            return direction === "up" ? floorNum >= current : floorNum <= current;
        }

        function leastLoaded(candidates) {
            return candidates.reduce(function(best, elevator) {
                return elevator.loadFactor() < best.loadFactor() ? elevator : best;
            });
        }

        function pickElevatorForCall(floorNum, callDirection) {
            var serving = elevators.filter(function(elevator) {
                return elevator.servedFloors().indexOf(floorNum) !== -1;
            });
            if (serving.length === 0) {
                return null;
            }
            var onTheWay = serving.filter(function(elevator) {
                return isUnderCutoff(elevator) && isHeadingTowardCall(elevator, floorNum, callDirection);
            });
            if (onTheWay.length > 0) {
                return leastLoaded(onTheWay);
            }
            var underCutoff = serving.filter(isUnderCutoff);
            if (underCutoff.length > 0) {
                return leastLoaded(underCutoff);
            }
            var notFull = serving.filter(function(elevator) {
                return !elevator.isFull();
            });
            if (notFull.length > 0) {
                return leastLoaded(notFull);
            }
            return leastLoaded(serving);
        }

        function insertStop(elevator, floorNum) {
            var queue = elevator.destinationQueue;
            if (queue.indexOf(floorNum) !== -1) {
                return;
            }
            if (queue.length === 0) {
                elevator.destinationQueue = [floorNum];
                elevator.checkDestinationQueue();
                return;
            }
            var current = elevator.currentFloor();
            var movingDirection = elevatorDirection(elevator);
            var direction = movingDirection || (floorNum >= current ? "up" : "down");
            var splitIndex = queue.length;
            for (var i = 0; i < queue.length; i++) {
                var stillAhead = direction === "up" ? queue[i] >= current : queue[i] <= current;
                if (!stillAhead) {
                    splitIndex = i;
                    break;
                }
            }
            var ahead = queue.slice(0, splitIndex);
            var behind = queue.slice(splitIndex);
            // A stopped car's direction is only the guess above, and comparing
            // its current floor against itself passes both >= and <=, so a
            // re-pressed call for that floor would splice ahead of the queue.
            var isAhead =
                (movingDirection !== null || floorNum !== current) &&
                (direction === "up" ? floorNum >= current : floorNum <= current);
            if (isAhead) {
                var insertAt = ahead.length;
                for (var j = 0; j < ahead.length; j++) {
                    if (direction === "up" ? floorNum < ahead[j] : floorNum > ahead[j]) {
                        insertAt = j;
                        break;
                    }
                }
                ahead.splice(insertAt, 0, floorNum);
            } else {
                behind.push(floorNum);
            }
            elevator.destinationQueue = ahead.concat(behind);
            elevator.checkDestinationQueue();
        }

        floors.forEach(function(floor) {
            floor.on("up_button_pressed", function() {
                var elevator = pickElevatorForCall(floor.floorNum(), "up");
                if (elevator !== null) {
                    insertStop(elevator, floor.floorNum());
                }
            });
            floor.on("down_button_pressed", function() {
                var elevator = pickElevatorForCall(floor.floorNum(), "down");
                if (elevator !== null) {
                    insertStop(elevator, floor.floorNum());
                }
            });
        });

        elevators.forEach(function(elevator) {
            elevator.on("floor_button_pressed", function(floorNum) {
                insertStop(elevator, floorNum);
            });
            elevator.on("idle", function() {
                elevator.goToFloor(0);
            });
        });
    },
    update: function(dt, elevators, floors) {
    }
}`;
}

/** {@link buildGoodDispatcherCode} tuned for shorter rides at the cost of extra stops. */
export const GOOD_CODE_BALANCED = buildGoodDispatcherCode(0.8);

/** {@link buildGoodDispatcherCode} tuned for fewer stops at the cost of longer rides. */
export const GOOD_CODE_MOVE_CONSCIOUS = buildGoodDispatcherCode(1.0);
