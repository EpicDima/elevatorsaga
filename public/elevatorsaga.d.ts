/**
 * Elevator Saga: type declarations for the API a solution is handed.
 *
 * Drop this file next to the program you are writing and your editor can
 * complete `elevator.` and `floor.`, describe every method as you type it, and
 * refuse `goToFloor("3")` before you paste anything into the game. It declares
 * nothing but types: there is no runtime part, and importing it is neither
 * possible nor necessary.
 *
 * Two ways to point an editor at it, both of which keep the file you type in
 * loadable by the game:
 *
 * 1. A `tsconfig.json` beside your solution, with `"allowJs"` and `"checkJs"`
 *    on. It needs no `include`: a config with none takes every file in its own
 *    directory, this one among them. Nothing is added to your program.
 * 2. `/// <reference path="./elevatorsaga.d.ts" />` at the top of your program,
 *    under a `// @ts-check` line. The reference alone is what finds this file,
 *    and it buys completion and hover text; `// @ts-check` is what turns the
 *    diagnostics on, and a lone `.js` file with no `tsconfig.json` has no other
 *    way to ask for them — without it a mistake this file describes precisely
 *    is still reported nowhere.
 *
 *    Either comment is only safe if the rest of the program is wrapped in
 *    parentheses, as `({ init: ..., update: ... })`. The game's loader
 *    (`getCodeObjFromCode` in `src/game/user-code.ts`) only adds those
 *    parentheses for itself when the source starts with `{` and ends with `}`;
 *    a comment above a bare object literal makes it fail that test, and the
 *    literal is then evaluated as a block, which is `SyntaxError: Function
 *    statements require a function name`.
 *
 * Everything here is derived from the two facades player code is actually
 * handed — `ElevatorInterface` and `FloorInterface` in `src/game`.
 * `src/api-declarations.test.ts` compares the two: a member that exists on one
 * side and not the other, a member whose type has moved under it, an event that
 * has appeared or gone, or a handler given a different number of arguments,
 * each fails the test suite. That file's own header says exactly how far the
 * comparison reaches and where it stops.
 *
 * The prose is the English of `documentation.html`, in both languages' builds:
 * the names it describes are English identifiers either way, and a declaration
 * whose two translations could disagree is a second thing to keep in step.
 *
 * @see https://github.com/EpicDima/elevatorsaga
 */

/* eslint-disable @typescript-eslint/unified-signatures --
 * One overload per event name is the whole point of this file: it is what puts
 * that event's own sentence, and its own handler parameters, under the cursor.
 * Merging the pairs the rule finds -- `floor_button_pressed` with
 * `stopped_at_floor`, `up_button_pressed` with `down_button_pressed`, which
 * happen to hand a handler the same arguments -- would leave two unrelated
 * events sharing one description, which is the drift this whole file exists to
 * prevent, in miniature.
 */

/**
 * The whole player-facing API, under one name.
 *
 * A namespace rather than plain global interfaces, because this file is meant
 * to be dropped into a project that is not ours: `Elevator`, `Floor` and
 * `Solution` are names somebody else's code may already be using, and an
 * ambient declaration that silently wins that collision is worse than a
 * slightly longer one. Only `ElevatorSaga` is added to the global scope.
 */
declare namespace ElevatorSaga {
  /** Which way an elevator is travelling. */
  type Direction = "up" | "down";

  /** What {@link Elevator.destinationDirection} answers; a car may be neither. */
  type DestinationDirection = Direction | "stopped";

  /** Whether a floor's call button is lit. */
  type ButtonState = "" | "activated";

  /** The lit state of one floor's two call buttons. */
  interface FloorButtonStates {
    /** The up call button. */
    readonly up: ButtonState;
    /** The down call button. */
    readonly down: ButtonState;
  }

  /** The events an elevator raises. */
  type ElevatorEventName = "idle" | "floor_button_pressed" | "passing_floor" | "stopped_at_floor";

  /** The events a floor raises. */
  type FloorEventName = "up_button_pressed" | "down_button_pressed" | "buttonstate_change";

  /**
   * Two or three event names separated by single spaces, which subscribe a
   * handler to all of them.
   *
   * The game's own `EventNameSpec` stops at three for the same reason: the
   * documented multi-name form registers two, and a wider union only makes the
   * error message longer. A handler registered this way is called with the name
   * of the event that fired ahead of that event's own arguments.
   */
  type MultipleEvents<Name extends string> = `${Name} ${Name}` | `${Name} ${Name} ${Name}`;

  /** `off`'s wildcard: unregister every handler, whatever the event. */
  type AllEvents = "*";

  /**
   * A handler subscribed to several events at once.
   *
   * The rest parameter is `never[]` rather than `unknown[]` on purpose: it
   * accepts a handler that declares whatever arguments it likes after the event
   * name, without forcing one that declares nothing to spell them out.
   */
  type MultiEventHandler<Receiver, Name extends string> = (
    this: Receiver,
    eventName: Name,
    ...args: never[]
  ) => void;

  /**
   * One elevator, as a program sees it.
   *
   * The `init` and `update` functions are handed an array of these, one per
   * elevator in the building, in the order they are drawn.
   */
  interface Elevator {
    /**
     * The floors this elevator is going to visit, in order.
     *
     * Writable, including whole-array assignment — that is how in-transit
     * rescheduling is written. Call {@link Elevator.checkDestinationQueue}
     * after changing it by hand, or the elevator will not act on the change
     * until it next arrives somewhere.
     */
    destinationQueue: number[];

    /**
     * Queues a floor to travel to.
     *
     * A floor equal to the end of the queue it would join is dropped, so asking
     * for the same floor twice in a row does not pile up. A floor outside the
     * building is clamped to the nearest real one; a value that is not a number
     * at all is refused and reported as an error in your code.
     *
     * @param floorNum - Floor to travel to.
     * @param forceNow - Put it at the front of the queue rather than the back.
     */
    goToFloor(floorNum: number, forceNow?: boolean): void;

    /**
     * Clears the queue and brings the elevator to a halt.
     *
     * For in-transit rescheduling, not for everyday use: the car stops wherever
     * it can brake to, which is usually between floors, so nobody gets out.
     */
    stop(): void;

    /**
     * The floor the elevator is on.
     *
     * @returns The floor number it is at, or was last at.
     */
    currentFloor(): number;

    /**
     * Reads the going-up indicator.
     *
     * @returns Whether the elevator is advertising that it is going up.
     */
    goingUpIndicator(): boolean;

    /**
     * Sets the going-up indicator, which passengers use to decide whether to
     * board.
     *
     * @param value - What to advertise.
     * @returns This elevator, so calls can be chained.
     */
    goingUpIndicator(value: boolean): this;

    /**
     * Reads the going-down indicator.
     *
     * @returns Whether the elevator is advertising that it is going down.
     */
    goingDownIndicator(): boolean;

    /**
     * Sets the going-down indicator, which passengers use to decide whether to
     * board.
     *
     * @param value - What to advertise.
     * @returns This elevator, so calls can be chained.
     */
    goingDownIndicator(value: boolean): this;

    /**
     * How many passengers fit.
     *
     * @returns The capacity of this elevator.
     */
    maxPassengerCount(): number;

    /**
     * How full the elevator is.
     *
     * Passengers weigh a random 55 to 100 against the nominal 100 per slot, so
     * a car with every slot taken reads about 0.775 and essentially never
     * reaches 1. Use {@link Elevator.isFull} for "nobody else fits".
     *
     * @returns 0 when empty, 1 when full.
     */
    loadFactor(): number;

    /**
     * Whether every passenger slot is taken.
     *
     * A passenger counts from the moment they start walking in.
     *
     * @returns `true` when no slot is free.
     */
    isFull(): boolean;

    /**
     * Whether the elevator is carrying nobody.
     *
     * Not the negation of {@link Elevator.isFull}: one passenger of four is
     * neither.
     *
     * @returns `true` when every slot is free.
     */
    isEmpty(): boolean;

    /**
     * Which way the elevator is about to move.
     *
     * @returns `"up"`, `"down"`, or `"stopped"` when it is going nowhere.
     */
    destinationDirection(): DestinationDirection;

    /**
     * Whether the elevator is moving toward a floor it has not passed yet.
     *
     * One of the two tests the game puts in front of every `passing_floor`
     * event; the other one excludes the destination floor. So a floor this says
     * no to cannot raise that event, while a floor it says yes to still will
     * not raise it if that floor is where the car is going.
     *
     * Only the direction of travel counts, not the destination: a floor further
     * along the way the car is going is being approached even if the car will
     * stop before it. A car standing still approaches nothing, and neither is
     * one that has arrived at the floor you ask about.
     *
     * @param floorNum - Floor to ask about. A number outside the building is
     * clamped to the nearest real floor; a value that is not a number at all,
     * including a forgotten argument, is reported as an error in your code.
     * @returns `true` when the car is moving and that floor is still ahead.
     */
    isApproachingFloor(floorNum: number): boolean;

    /**
     * Starts on the next queued destination, or raises `idle`.
     *
     * Only needed after changing {@link Elevator.destinationQueue} by hand.
     */
    checkDestinationQueue(): void;

    /**
     * The floor buttons pressed inside the elevator.
     *
     * @returns The pressed floor numbers, in ascending order.
     */
    getPressedFloors(): number[];

    /**
     * The lowest pressed floor button.
     *
     * @deprecated Undocumented legacy API, scheduled for removal. It is
     * declared so that a solution brought over from the original game still
     * type-checks; use {@link Elevator.getPressedFloors} in new code.
     * @returns The lowest pressed floor, or 0 when nothing is pressed.
     */
    getFirstPressedFloor(): number;

    /**
     * Runs `handler` whenever the elevator has nothing left to do.
     *
     * @param event - `"idle"`.
     * @param handler - Called with the elevator as its `this`.
     * @returns This elevator, so calls can be chained.
     */
    on(event: "idle", handler: (this: Elevator) => void): this;

    /**
     * Runs `handler` whenever a passenger presses a floor button inside the
     * elevator.
     *
     * @param event - `"floor_button_pressed"`.
     * @param handler - Called with the floor number that was pressed.
     * @returns This elevator, so calls can be chained.
     */
    on(event: "floor_button_pressed", handler: (this: Elevator, floorNum: number) => void): this;

    /**
     * Runs `handler` whenever the elevator passes a floor without stopping.
     *
     * Not raised for the destination floor, the one the car is heading to. That
     * one it stops at, so it is an arrival rather than a pass, and the game
     * excludes it explicitly.
     * Every other floor along the way raises this slightly before the car
     * reaches it, which is what makes it the moment to decide whether to stop
     * there after all.
     *
     * @param event - `"passing_floor"`.
     * @param handler - Called with the floor being passed and the direction.
     * @returns This elevator, so calls can be chained.
     */
    on(
      event: "passing_floor",
      handler: (this: Elevator, floorNum: number, direction: Direction) => void,
    ): this;

    /**
     * Runs `handler` whenever the elevator stops at a floor.
     *
     * @param event - `"stopped_at_floor"`.
     * @param handler - Called with the floor it stopped at.
     * @returns This elevator, so calls can be chained.
     */
    on(event: "stopped_at_floor", handler: (this: Elevator, floorNum: number) => void): this;

    /**
     * Runs `handler` for each of several events named in one string.
     *
     * @param events - Two or three event names separated by single spaces.
     * @param handler - Called with the name of the event that fired, followed
     * by that event's own arguments.
     * @returns This elevator, so calls can be chained.
     */
    on(
      events: MultipleEvents<ElevatorEventName>,
      handler: MultiEventHandler<Elevator, ElevatorEventName>,
    ): this;

    /**
     * Runs `handler` the next time the elevator goes idle, and then forgets it.
     *
     * @param event - `"idle"`.
     * @param handler - Called with the elevator as its `this`.
     * @returns This elevator, so calls can be chained.
     */
    once(event: "idle", handler: (this: Elevator) => void): this;

    /**
     * Runs `handler` the next time a floor button is pressed inside the
     * elevator, and then forgets it.
     *
     * @param event - `"floor_button_pressed"`.
     * @param handler - Called with the floor number that was pressed.
     * @returns This elevator, so calls can be chained.
     */
    once(event: "floor_button_pressed", handler: (this: Elevator, floorNum: number) => void): this;

    /**
     * Runs `handler` the next time the elevator passes a floor, and then
     * forgets it.
     *
     * @param event - `"passing_floor"`.
     * @param handler - Called with the floor being passed and the direction.
     * @returns This elevator, so calls can be chained.
     */
    once(
      event: "passing_floor",
      handler: (this: Elevator, floorNum: number, direction: Direction) => void,
    ): this;

    /**
     * Runs `handler` the next time the elevator stops at a floor, and then
     * forgets it.
     *
     * @param event - `"stopped_at_floor"`.
     * @param handler - Called with the floor it stopped at.
     * @returns This elevator, so calls can be chained.
     */
    once(event: "stopped_at_floor", handler: (this: Elevator, floorNum: number) => void): this;

    /**
     * The spelling of {@link Elevator.once} that solutions written for the
     * original game use, because riot.js published `one` and not `once`.
     *
     * @param event - `"idle"`.
     * @param handler - Called with the elevator as its `this`.
     * @returns This elevator, so calls can be chained.
     */
    one(event: "idle", handler: (this: Elevator) => void): this;

    /**
     * The legacy spelling of {@link Elevator.once}; see the `"idle"` overload.
     *
     * @param event - `"floor_button_pressed"`.
     * @param handler - Called with the floor number that was pressed.
     * @returns This elevator, so calls can be chained.
     */
    one(event: "floor_button_pressed", handler: (this: Elevator, floorNum: number) => void): this;

    /**
     * The legacy spelling of {@link Elevator.once}; see the `"idle"` overload.
     *
     * @param event - `"passing_floor"`.
     * @param handler - Called with the floor being passed and the direction.
     * @returns This elevator, so calls can be chained.
     */
    one(
      event: "passing_floor",
      handler: (this: Elevator, floorNum: number, direction: Direction) => void,
    ): this;

    /**
     * The legacy spelling of {@link Elevator.once}; see the `"idle"` overload.
     *
     * @param event - `"stopped_at_floor"`.
     * @param handler - Called with the floor it stopped at.
     * @returns This elevator, so calls can be chained.
     */
    one(event: "stopped_at_floor", handler: (this: Elevator, floorNum: number) => void): this;

    /**
     * Unregisters `idle` handlers.
     *
     * One overload per event, as for {@link Elevator.on}, and for a sharper
     * reason: the handler has to be the one that was registered, so it is that
     * event's handler that belongs here. A single signature typed for the
     * multi-event form instead — one taking an event name first — rejects
     * `elevator.off("floor_button_pressed", remember)` outright, because a
     * function declaring `floorNum: number` is not one declaring an event name.
     * That is the call the reference page prints under `off`, and the whole
     * point of keeping a reference to a handler.
     *
     * The handler is compared by identity, so only a function you kept a
     * reference to can be removed on its own; an inline anonymous function
     * cannot be removed at all.
     *
     * @param event - `"idle"`.
     * @param handler - The exact function to remove; omit it to remove every
     * handler of this event.
     * @returns This elevator, so calls can be chained.
     */
    off(event: "idle", handler?: (this: Elevator) => void): this;

    /**
     * Unregisters `floor_button_pressed` handlers; see the `"idle"` overload.
     *
     * @param event - `"floor_button_pressed"`.
     * @param handler - The exact function to remove; omit it to remove every
     * handler of this event.
     * @returns This elevator, so calls can be chained.
     */
    off(event: "floor_button_pressed", handler?: (this: Elevator, floorNum: number) => void): this;

    /**
     * Unregisters `passing_floor` handlers; see the `"idle"` overload.
     *
     * @param event - `"passing_floor"`.
     * @param handler - The exact function to remove; omit it to remove every
     * handler of this event.
     * @returns This elevator, so calls can be chained.
     */
    off(
      event: "passing_floor",
      handler?: (this: Elevator, floorNum: number, direction: Direction) => void,
    ): this;

    /**
     * Unregisters `stopped_at_floor` handlers; see the `"idle"` overload.
     *
     * @param event - `"stopped_at_floor"`.
     * @param handler - The exact function to remove; omit it to remove every
     * handler of this event.
     * @returns This elevator, so calls can be chained.
     */
    off(event: "stopped_at_floor", handler?: (this: Elevator, floorNum: number) => void): this;

    /**
     * Unregisters handlers of several events named in one string.
     *
     * @param events - Two or three event names separated by single spaces.
     * @param handler - The exact function to remove; omit it to remove every
     * handler of each of the named events.
     * @returns This elevator, so calls can be chained.
     */
    off(
      events: MultipleEvents<ElevatorEventName>,
      handler?: MultiEventHandler<Elevator, ElevatorEventName>,
    ): this;

    /**
     * Removes every handler of every event, the same as {@link Elevator.offAll}.
     *
     * No handler is accepted, deliberately, although the game ignores one
     * passed here rather than refusing it: `off("*", remember)` does not remove
     * `remember` and leave the rest, it removes *everything*, and a program
     * that reads as though it removes one subscription while silently going
     * deaf is exactly the failure this file exists to catch. Name the event to
     * remove one handler.
     *
     * @param events - `"*"`.
     * @returns This elevator, so calls can be chained.
     */
    off(events: AllEvents): this;

    /**
     * Removes every handler this program registered on this elevator.
     *
     * @returns This elevator, so calls can be chained.
     */
    offAll(): this;

    /**
     * Raises one of the elevator's own events on this elevator.
     *
     * Declared because the original game's elevator object was a riot
     * observable and published this, so solutions brought over may call it. It
     * does not make the elevator do anything: it only runs the handlers you
     * registered, and it will not re-enter an event already being dispatched.
     *
     * @param event - `"idle"`.
     * @returns This elevator, so calls can be chained.
     */
    trigger(event: "idle"): this;

    /**
     * Raises `floor_button_pressed`; see the `"idle"` overload.
     *
     * @param event - `"floor_button_pressed"`.
     * @param floorNum - The floor number to report as pressed.
     * @returns This elevator, so calls can be chained.
     */
    trigger(event: "floor_button_pressed", floorNum: number): this;

    /**
     * Raises `passing_floor`; see the `"idle"` overload.
     *
     * @param event - `"passing_floor"`.
     * @param floorNum - The floor number to report as passed.
     * @param direction - The direction to report.
     * @returns This elevator, so calls can be chained.
     */
    trigger(event: "passing_floor", floorNum: number, direction: Direction): this;

    /**
     * Raises `stopped_at_floor`; see the `"idle"` overload.
     *
     * @param event - `"stopped_at_floor"`.
     * @param floorNum - The floor number to report as stopped at.
     * @returns This elevator, so calls can be chained.
     */
    trigger(event: "stopped_at_floor", floorNum: number): this;
  }

  /**
   * One floor, as a program sees it.
   *
   * A floor is where people wait and press call buttons; it has no controls of
   * its own, so everything below is either its number or a subscription.
   */
  interface Floor {
    /**
     * This floor's number, counting up from 0 at the bottom.
     *
     * @returns The floor number.
     */
    floorNum(): number;

    /**
     * The same number as a property.
     *
     * Undocumented, and kept only because the original game handed player code
     * the real floor object and published solutions read this off it.
     * {@link Floor.floorNum} is the supported spelling.
     */
    readonly level: number;

    /**
     * The lit state of this floor's two call buttons.
     *
     * A fresh copy on every read, so assigning to it changes nothing. Watching
     * `buttonstate_change` is cheaper than polling this every frame.
     */
    readonly buttonStates: FloorButtonStates;

    /**
     * Runs `handler` whenever somebody presses this floor's up call button.
     *
     * @param event - `"up_button_pressed"`.
     * @param handler - Called with this floor.
     * @returns This floor, so calls can be chained.
     */
    on(event: "up_button_pressed", handler: (this: Floor, floor: Floor) => void): this;

    /**
     * Runs `handler` whenever somebody presses this floor's down call button.
     *
     * @param event - `"down_button_pressed"`.
     * @param handler - Called with this floor.
     * @returns This floor, so calls can be chained.
     */
    on(event: "down_button_pressed", handler: (this: Floor, floor: Floor) => void): this;

    /**
     * Runs `handler` whenever either call button is lit or cleared.
     *
     * @param event - `"buttonstate_change"`.
     * @param handler - Called with the new state of both buttons.
     * @returns This floor, so calls can be chained.
     */
    on(
      event: "buttonstate_change",
      handler: (this: Floor, buttonStates: FloorButtonStates) => void,
    ): this;

    /**
     * Runs `handler` for each of several events named in one string.
     *
     * The form the game's own example uses:
     * `floor.on("up_button_pressed down_button_pressed", ...)`.
     *
     * @param events - Two or three event names separated by single spaces.
     * @param handler - Called with the name of the event that fired, followed
     * by that event's own arguments.
     * @returns This floor, so calls can be chained.
     */
    on(
      events: MultipleEvents<FloorEventName>,
      handler: MultiEventHandler<Floor, FloorEventName>,
    ): this;

    /**
     * Runs `handler` the next time the up button is pressed here, and then
     * forgets it.
     *
     * @param event - `"up_button_pressed"`.
     * @param handler - Called with this floor.
     * @returns This floor, so calls can be chained.
     */
    once(event: "up_button_pressed", handler: (this: Floor, floor: Floor) => void): this;

    /**
     * Runs `handler` the next time the down button is pressed here, and then
     * forgets it.
     *
     * @param event - `"down_button_pressed"`.
     * @param handler - Called with this floor.
     * @returns This floor, so calls can be chained.
     */
    once(event: "down_button_pressed", handler: (this: Floor, floor: Floor) => void): this;

    /**
     * Runs `handler` the next time either button changes here, and then forgets
     * it.
     *
     * @param event - `"buttonstate_change"`.
     * @param handler - Called with the new state of both buttons.
     * @returns This floor, so calls can be chained.
     */
    once(
      event: "buttonstate_change",
      handler: (this: Floor, buttonStates: FloorButtonStates) => void,
    ): this;

    /**
     * The spelling of {@link Floor.once} that solutions written for the
     * original game use, because riot.js published `one` and not `once`.
     *
     * @param event - `"up_button_pressed"`.
     * @param handler - Called with this floor.
     * @returns This floor, so calls can be chained.
     */
    one(event: "up_button_pressed", handler: (this: Floor, floor: Floor) => void): this;

    /**
     * The legacy spelling of {@link Floor.once}; see the `"up_button_pressed"`
     * overload.
     *
     * @param event - `"down_button_pressed"`.
     * @param handler - Called with this floor.
     * @returns This floor, so calls can be chained.
     */
    one(event: "down_button_pressed", handler: (this: Floor, floor: Floor) => void): this;

    /**
     * The legacy spelling of {@link Floor.once}; see the `"up_button_pressed"`
     * overload.
     *
     * @param event - `"buttonstate_change"`.
     * @param handler - Called with the new state of both buttons.
     * @returns This floor, so calls can be chained.
     */
    one(
      event: "buttonstate_change",
      handler: (this: Floor, buttonStates: FloorButtonStates) => void,
    ): this;

    /**
     * Unregisters `up_button_pressed` handlers.
     *
     * One overload per event, for the reason given on
     * {@link Elevator.off}: the handler to remove is the one that was
     * registered, so it is that event's handler that belongs here.
     *
     * @param event - `"up_button_pressed"`.
     * @param handler - The exact function to remove; omit it to remove every
     * handler of this event.
     * @returns This floor, so calls can be chained.
     */
    off(event: "up_button_pressed", handler?: (this: Floor, floor: Floor) => void): this;

    /**
     * Unregisters `down_button_pressed` handlers; see the
     * `"up_button_pressed"` overload.
     *
     * @param event - `"down_button_pressed"`.
     * @param handler - The exact function to remove; omit it to remove every
     * handler of this event.
     * @returns This floor, so calls can be chained.
     */
    off(event: "down_button_pressed", handler?: (this: Floor, floor: Floor) => void): this;

    /**
     * Unregisters `buttonstate_change` handlers; see the `"up_button_pressed"`
     * overload.
     *
     * @param event - `"buttonstate_change"`.
     * @param handler - The exact function to remove; omit it to remove every
     * handler of this event.
     * @returns This floor, so calls can be chained.
     */
    off(
      event: "buttonstate_change",
      handler?: (this: Floor, buttonStates: FloorButtonStates) => void,
    ): this;

    /**
     * Unregisters handlers of several events named in one string.
     *
     * @param events - Two or three event names separated by single spaces.
     * @param handler - The exact function to remove; omit it to remove every
     * handler of each of the named events.
     * @returns This floor, so calls can be chained.
     */
    off(
      events: MultipleEvents<FloorEventName>,
      handler?: MultiEventHandler<Floor, FloorEventName>,
    ): this;

    /**
     * Removes every handler of every event, the same as {@link Floor.offAll}.
     *
     * Takes no handler, for the reason given on {@link Elevator.off}.
     *
     * @param events - `"*"`.
     * @returns This floor, so calls can be chained.
     */
    off(events: AllEvents): this;

    /**
     * Removes every handler this program registered on this floor.
     *
     * The game's own subscriptions are registered elsewhere, so this does not
     * stop the floor working.
     *
     * @returns This floor, so calls can be chained.
     */
    offAll(): this;
  }

  /**
   * The object a solution is: what the game evaluates your program down to.
   *
   * Both functions are required — the game refuses a program that is missing
   * either. Annotating the object with this type is what gets both sets of
   * parameters typed for you; see the README of this repository for the two
   * lines that do it.
   *
   * The arrays are the game's own, handed back unchanged on every frame, so
   * they are declared read-only: sorting one in place would reorder it for the
   * rest of the run. Copy first — `elevators.slice().sort(...)`.
   */
  interface Solution {
    /**
     * Runs once, when the challenge starts.
     *
     * @param elevators - Every elevator in the building.
     * @param floors - Every floor, from 0 at the bottom.
     */
    init(elevators: readonly Elevator[], floors: readonly Floor[]): void;

    /**
     * Runs on every animation frame, after `init`.
     *
     * @param dt - Simulated seconds since the previous frame.
     * @param elevators - Every elevator in the building.
     * @param floors - Every floor, from 0 at the bottom.
     */
    update(dt: number, elevators: readonly Elevator[], floors: readonly Floor[]): void;
  }
}
