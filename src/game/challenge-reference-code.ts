/**
 * A real, working collective-control dispatcher, used to calibrate tier
 * thresholds against an actual run rather than a guess.
 *
 * A later commit measures how well a *good* solution can do on each
 * challenge, so that silver and gold can ask for something a competent
 * player's program can clear and a lazy one cannot. That measurement is only
 * honest if "good" is an actual program the engine runs, not a number typed
 * in because it sounded about right — which is exactly the gap between this
 * file and {@link "../ui/default-code.ts"!DEV_TEST_CODE}: `DEV_TEST_CODE` is
 * the naive end of the yardstick, scoring every car by a fixed formula and
 * re-deciding from scratch on every call, and was never meant to be anyone's
 * idea of the best a player could do.
 *
 * The dispatcher built here is closer to how a person actually solves this
 * game: a car keeps sweeping the direction it is already going, picking up
 * anyone whose call is compatible with that sweep, instead of the building
 * re-running "which car is nearest" for every single button press. That is
 * the collective-control strategy the tutorial and the community solutions
 * converge on, and it is also the one place a `loadCutoff` has anything
 * meaningful to bite on: a car that is still choosing between "keep
 * sweeping" and "peel off for one more pickup" can weigh how full it already
 * is, where a car that is re-litigating every call from an empty scoring
 * function cannot.
 *
 * `loadCutoff` is the one knob {@link buildGoodDispatcherCode} exposes.
 * Below it, a car keeps accepting calls that are on its way; at or above it,
 * the car stops taking on new pickups and only the cars with room left are
 * asked, so calls still get answered but by whoever has space rather than by
 * an already-crowded car passing directly by. A low cutoff trades a few
 * extra stops for shorter rides on any one car; a high cutoff packs cars
 * fuller before conceding a detour is worth it. {@link GOOD_CODE_BALANCED}
 * and {@link GOOD_CODE_MOVE_CONSCIOUS} are the same program at the two ends
 * of that trade-off a later commit's calibration runs actually need: a
 * strategy that keeps some slack in every car, and one that lets a car fill
 * up before it starts turning calls away from itself.
 */

/**
 * Builds a complete collective-control dispatcher program.
 *
 * The returned source is a bare `{ init, update }` object literal, exactly
 * the shape {@link "./user-code.ts"!getCodeObjFromCode} expects and the same
 * shape {@link "../ui/default-code.ts"!DEV_TEST_CODE} uses — written in the
 * same `var`/`function` register, because this string is executed as player
 * code, not as this module's own TypeScript, and the player-facing API is
 * untyped ES5. Whatever the loop below produces, `update` does nothing every
 * tick: every decision this dispatcher makes is a reaction to an event —
 * a button pressed, an elevator arriving, an elevator running out of
 * things to do — and there is nothing left to poll for in between.
 *
 * **Assigning a call.** `pickElevatorForCall` first looks for a car that is
 * under `loadCutoff` *and* already sweeping toward the call in the call's
 * own direction — an idle car counts too, since it has no sweep to
 * contradict. Among those, the least loaded car is chosen, so that repeated
 * calls in the same stretch of floors spread across whichever cars still
 * have room instead of piling onto the one that happened to be closest.
 * "Under `loadCutoff`" itself is `isUnderCutoff`, and it checks
 * {@link "./elevator-interface.ts"!ElevatorInterface.isFull} before it checks
 * the cutoff at all: {@link "./elevator-interface.ts"!ElevatorInterface.loadFactor}
 * sums random passenger weights against a nominal full load and, by its own
 * doc comment, essentially never reaches `1` even for a car with no free slot
 * left — so a bare `loadFactor() < loadCutoff` would let a literally full car
 * read as "under cutoff" whenever its particular passengers happened to be
 * light, `loadCutoff` of `1.0` (exactly {@link GOOD_CODE_MOVE_CONSCIOUS}'s
 * preset) included.
 *
 * Only when no car qualifies does the search widen: first to any car under
 * the cutoff regardless of direction, then — since a car that is merely over
 * the cutoff can usually still take one more passenger, and a car that is
 * genuinely full never can — to any car that is not full at all, and only if
 * every car in the building is full does it fall back to the least loaded of
 * them. A call is never left unassigned — the building always has at least
 * one elevator, and the last fallback has no precondition left to fail — but
 * the widening degrades one qualification at a time rather than jumping
 * straight from "ideal" to "whichever car has the smallest number," which
 * matters most exactly where a cutoff is most likely to bind: a building
 * with one elevator has no second car for any of these tiers to fall back
 * to, so what the single real car is asked to do next depends entirely on
 * getting this ordering right.
 *
 * **Ordering a car's stops.** `insertStop` keeps each car's
 * `destinationQueue` split at the car's current position into the stretch it
 * is still sweeping toward (sorted ascending while heading up, descending
 * while heading down) and whatever got queued behind it. A new stop that is
 * ahead of the car, in the direction it is already travelling, is sorted
 * into that first stretch; a new stop that is not — behind the car, or past
 * it in a way this program's cutoff and direction checks would rather not
 * have happened but cannot always prevent, since a car already close to
 * `isFull()` can still be asked to take a fallback call it did not want —
 * is appended after everything already queued, never spliced in ahead of
 * it. Sorting a "behind" stop to the front would mean the car reverses
 * direction the moment it reaches that point in its queue, mid-sweep, which
 * is exactly the kind of detour a real rider notices; appending it instead
 * means the car finishes what it was already doing first and only turns
 * around once it has run out of stops ahead of it.
 *
 * A car with nothing already moving it has no sweep of its own to place a
 * new stop ahead of, so for a stopped car `insertStop` falls back to
 * comparing the new floor against wherever the car happens to be standing.
 * That fallback is only ever a guess at a direction, and the one floor it
 * cannot safely guess about is the car's own: {@link "./user.ts"!User.elevatorAvailable}
 * re-presses a floor's call button for anyone a full car turns away, so a
 * stopped, over-`loadCutoff` car gets the call it just failed to answer
 * handed straight back — for the floor it is already idling at — every
 * boarding dwell, for as long as it stays that full. A floor equal to the
 * car's own position satisfies "ahead" under either direction, purely
 * because comparing a number to itself is never a strict crossing either
 * way, so without a special case a stationary re-press would keep splicing
 * itself in front of whatever the car had already queued and stay there:
 * next dwell hands back the identical call, ahead of the identical stop,
 * before the car has moved toward it at all. `insertStop` excludes exactly
 * this one case — a stopped car re-pressed at the floor it is already on is
 * never treated as "ahead" — so that stop joins the back of the queue
 * instead, behind whatever the car already had genuine business visiting,
 * and the car's real sweep gets to run before its own floor is reconsidered.
 * `destinationQueue` can only grow by insertion and shrink by the car
 * actually visiting a floor, so whatever was genuinely queued ahead of a
 * stuck re-press still gets there on schedule; what this does not promise is
 * that the re-press itself is answered any sooner than the car stops being
 * full, which is a question for the passengers riding it, not for this
 * queue.
 *
 * **Parking when idle.** An idle car returns to floor 0, exactly as
 * {@link "../ui/default-code.ts"!DEV_TEST_CODE} does. `World.spawnUserRandomly`
 * sends roughly half of every challenge's passengers to the lobby, so a car
 * with nothing else to do is more useful waiting there than wherever its
 * last drop-off happened to leave it.
 *
 * **The direction indicators are left alone.** Neither
 * `goingUpIndicator` nor `goingDownIndicator` is ever set, so both stay at
 * their engine default of `true` (`Elevator`'s own initial state), and
 * `isSuitableForTravelBetween` — the check that decides whether a waiting
 * passenger is allowed to board — never has a reason to refuse anyone this
 * dispatcher's own queueing has already decided to stop for. Narrowing an
 * indicator can shave a little inefficiency off a hand-tuned solution, but a
 * single wrong toggle can just as easily strand a passenger the queue
 * logic meant to pick up, and this program is meant to be a dependable
 * baseline for calibration, not a demonstration of every optimisation the
 * API allows.
 *
 * @param loadCutoff - Load factor at or above which a car stops accepting
 * new pickups and only cars with room left are asked; see the module
 * comment.
 * @returns Source of a complete `{ init, update }` program.
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
            var onTheWay = elevators.filter(function(elevator) {
                return isUnderCutoff(elevator) && isHeadingTowardCall(elevator, floorNum, callDirection);
            });
            if (onTheWay.length > 0) {
                return leastLoaded(onTheWay);
            }
            var underCutoff = elevators.filter(isUnderCutoff);
            if (underCutoff.length > 0) {
                return leastLoaded(underCutoff);
            }
            var notFull = elevators.filter(function(elevator) {
                return !elevator.isFull();
            });
            if (notFull.length > 0) {
                return leastLoaded(notFull);
            }
            return leastLoaded(elevators);
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
            // A stopped car (movingDirection === null) has no real sweep to
            // measure "ahead" against, only the guessed direction above -- and
            // that guess cannot be trusted for the one floor the car is
            // already standing on. A re-pressed call for that exact floor
            // (User.elevatorAvailable re-presses whenever a full car turns a
            // passenger away) would otherwise satisfy "ahead" under either
            // direction, since comparing current to itself never fails a
            // >=/<= test, and keep splicing itself in front of whatever this
            // car already had genuinely queued -- see the module comment.
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
                insertStop(elevator, floor.floorNum());
            });
            floor.on("down_button_pressed", function() {
                var elevator = pickElevatorForCall(floor.floorNum(), "down");
                insertStop(elevator, floor.floorNum());
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

/**
 * The dispatcher from {@link buildGoodDispatcherCode}, kept willing to detour
 * for a new pickup until a car is 80% loaded.
 *
 * The lower of the two presets a later commit's calibration runs use:
 * leaving slack in every car costs a few extra stops but keeps individual
 * rides short, which is the trade-off a challenge scored on waiting time
 * wants measured.
 */
export const GOOD_CODE_BALANCED = buildGoodDispatcherCode(0.8);

/**
 * The dispatcher from {@link buildGoodDispatcherCode}, willing to fill a car
 * all the way before it stops accepting detours.
 *
 * The higher of the two presets a later commit's calibration runs use:
 * packing cars fuller before conceding a pickup is not worth it costs some
 * riders a longer wait, but it is also the fewer-total-trips strategy a
 * challenge scored on move count wants measured.
 */
export const GOOD_CODE_MOVE_CONSCIOUS = buildGoodDispatcherCode(1.0);
