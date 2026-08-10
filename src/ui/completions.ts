/**
 * The player API, as the editor's completion popup sees it.
 *
 * The game's API is only discoverable from `documentation.html`, which is a
 * second tab away from the editor, so the names most players need most often
 * are the ones they cannot remember. This module puts them under the cursor:
 * the members of the two facades player code is handed, the event names their
 * `on(...)` accepts, and the `{ init, update }` skeleton a program has to be.
 *
 * It is data and text matching only — no CodeMirror runtime and no DOM. The
 * imports from `@codemirror/autocomplete` are types, which are erased at
 * compile time, so this module can be unit tested in plain Node while the
 * widget wiring stays in `editor.ts`.
 *
 * Two rules keep the popup from drifting away from the game it describes.
 * Descriptions are copied from `documentation.html` and from the JSDoc on the
 * facades rather than written afresh: a popup that says something subtly
 * different from the documentation is worse than no popup. And the event tables
 * are keyed by the facades' own event maps, so an event added to
 * `ElevatorInterface` or `FloorInterface` does not compile until it has been
 * described here. Member names have no such compile-time anchor — they are
 * strings either way — so `completions.test.ts` checks them against the real
 * facades instead.
 */

import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";

import type { ElevatorInterfaceEvents } from "../game/elevator-interface.ts";
import type { FloorInterfaceEvents } from "../game/floor-interface.ts";

/** Icon the popup draws beside an entry; one of CodeMirror's own categories. */
type ApiCompletionType = "method" | "property" | "constant" | "text";

/**
 * One entry in the completion popup.
 *
 * Deliberately a structural subset of CodeMirror's `Completion`, so the tables
 * below can be handed to the editor as they are while staying plain data that
 * the tests can read without an editor.
 */
export interface ApiCompletion {
  /** The name; also what gets inserted, and what typing filters against. */
  readonly label: string;
  /** The signature, shown dimmed after the name. */
  readonly detail: string;
  /** One line of prose, shown when the entry is highlighted. */
  readonly info: string;
  /** Which icon the popup draws. */
  readonly type: ApiCompletionType;
  /** Text inserted instead of {@link ApiCompletion.label}, when they differ. */
  readonly apply?: string;
}

/** What {@link completionsFor} found for one position in the document. */
export interface ApiCompletionResult {
  /**
   * Where the word being completed starts, as an index into the text handed to
   * {@link completionsFor}. Everything from here to the cursor is replaced.
   */
  readonly from: number;
  /** What to offer, before CodeMirror filters it by what has been typed. */
  readonly options: readonly ApiCompletion[];
}

/**
 * The event methods, which every elevator and every floor publishes alike.
 *
 * Wording from the "Event methods" table of `documentation.html`.
 */
const EVENT_METHODS: readonly ApiCompletion[] = [
  {
    label: "on",
    detail: "on(events, handler)",
    info: "Register a listener. Several event names separated by spaces register the same listener for all of them, and it is then called with the name of the event that fired as its first argument.",
    type: "method",
  },
  {
    label: "once",
    detail: "once(event, handler)",
    info: "Register a listener that runs at most once and is then removed. Takes a single event name.",
    type: "method",
  },
  {
    label: "one",
    detail: "one(event, handler)",
    info: "The older name for once, and the one the original game gave you. Same behaviour, single event name as well.",
    type: "method",
  },
  {
    label: "off",
    detail: "off(events, handler)",
    info: 'Remove listeners. With a function, removes just that function; without one, removes every listener of the named events. The single name "*" removes every listener of every event.',
    type: "method",
  },
  {
    label: "offAll",
    detail: "offAll()",
    info: "Remove every listener you registered, for every event, on that elevator or floor. The listeners the game itself needs are separate, so the object keeps working.",
    type: "method",
  },
];

/**
 * What an elevator gives player code.
 *
 * Wording from the "Elevator object" table of `documentation.html`; the
 * signatures are the facade's, since the table has no column for them.
 * `getFirstPressedFloor` is left out on purpose: it is deprecated and
 * undocumented, and offering it would be advertising an API scheduled for
 * removal. So is `trigger`, which only exists because the legacy facade was a
 * riot observable — player code raising the game's own events is not something
 * to suggest to someone who is looking for `goToFloor`.
 */
export const ELEVATOR_MEMBERS: readonly ApiCompletion[] = [
  {
    label: "goToFloor",
    detail: "goToFloor(floorNum, forceNow)",
    info: "Queue the elevator to go to specified floor number. If you specify true as second argument, the elevator will go to that floor directly, and then go to any other queued floors.",
    type: "method",
  },
  {
    label: "stop",
    detail: "stop()",
    info: "Clear the destination queue and stop the elevator if it is moving. Note that the elevator will probably not stop at a floor, so passengers will not get out.",
    type: "method",
  },
  {
    label: "currentFloor",
    detail: "currentFloor() -> number",
    info: "Gets the floor number that the elevator currently is on. Note that this is a rounded number and does not necessarily mean the elevator is in a stopped state.",
    type: "method",
  },
  {
    label: "goingUpIndicator",
    detail: "goingUpIndicator(value)",
    info: "Gets or sets the going up indicator, which will affect passenger behaviour when stopping at floors.",
    type: "method",
  },
  {
    label: "goingDownIndicator",
    detail: "goingDownIndicator(value)",
    info: "Gets or sets the going down indicator, which will affect passenger behaviour when stopping at floors.",
    type: "method",
  },
  {
    label: "maxPassengerCount",
    detail: "maxPassengerCount() -> number",
    info: "Gets the maximum number of passengers that can occupy the elevator at the same time.",
    type: "method",
  },
  {
    label: "loadFactor",
    detail: "loadFactor() -> number",
    info: "Gets the load factor of the elevator. 0 means empty, 1 means full. Varies with passenger weights, which vary - not an exact measure.",
    type: "method",
  },
  {
    label: "isFull",
    detail: "isFull() -> boolean",
    info: "Gets whether every spot in the elevator is taken. Use this rather than comparing loadFactor to 1 - passenger weights vary, so a completely full elevator only reads about 0.775 on average.",
    type: "method",
  },
  {
    label: "isEmpty",
    detail: "isEmpty() -> boolean",
    info: "Gets whether the elevator is carrying nobody at all. Not the opposite of isFull - an elevator with one passenger out of four is neither.",
    type: "method",
  },
  {
    label: "destinationDirection",
    detail: 'destinationDirection() -> "up" | "down" | "stopped"',
    info: "Gets the direction the elevator is currently going to move toward.",
    type: "method",
  },
  {
    label: "isApproachingFloor",
    detail: "isApproachingFloor(floorNum) -> boolean",
    info: "Gets whether the elevator is moving toward the given floor and has not passed it yet. Only the direction of travel counts, so a floor further along that way is approaching too, even if the elevator is going to stop before it.",
    type: "method",
  },
  {
    label: "destinationQueue",
    detail: "destinationQueue: number[]",
    info: "The current destination queue, meaning the floor numbers the elevator is scheduled to go to. Can be modified and emptied if desired. Note that you need to call checkDestinationQueue() for the change to take effect immediately.",
    type: "property",
  },
  {
    label: "checkDestinationQueue",
    detail: "checkDestinationQueue()",
    info: "Checks the destination queue for any new destinations to go to. Note that you only need to call this if you modify the destination queue explicitly.",
    type: "method",
  },
  {
    label: "getPressedFloors",
    detail: "getPressedFloors() -> number[]",
    info: "Gets the currently pressed floor numbers as an array.",
    type: "method",
  },
  ...EVENT_METHODS,
];

/**
 * What a floor gives player code.
 *
 * `documentation.html` lists one property, and the facade adds `level` and
 * `buttonStates`, which are kept only because published solutions read them off
 * the legacy `Floor` object. They stay out of the popup for the same reason
 * they stayed out of the documentation: `floorNum()` is the supported spelling
 * of `level`, and a floor's buttons are better watched through
 * `buttonstate_change` than polled.
 */
export const FLOOR_MEMBERS: readonly ApiCompletion[] = [
  {
    label: "floorNum",
    detail: "floorNum() -> number",
    info: "Gets the floor number of the floor object.",
    type: "method",
  },
  ...EVENT_METHODS,
];

/** The parameters a handler is called with, and what the event means. */
interface EventDescription {
  /** The handler signature, shown dimmed after the event name. */
  readonly detail: string;
  /** One line of prose. */
  readonly info: string;
}

/**
 * The events an elevator raises.
 *
 * Keyed by `ElevatorInterfaceEvents` on purpose: an event added to the facade
 * fails to compile here until it has been described, which is the only way this
 * table can be trusted to be the whole list.
 */
const ELEVATOR_EVENT_DESCRIPTIONS: Record<keyof ElevatorInterfaceEvents, EventDescription> = {
  idle: {
    detail: "function()",
    info: "Triggered when the elevator has completed all its tasks and is not doing anything.",
  },
  floor_button_pressed: {
    detail: "function(floorNum)",
    info: "Triggered when a passenger has pressed a button inside the elevator.",
  },
  passing_floor: {
    detail: "function(floorNum, direction)",
    info: 'Triggered slightly before the elevator will pass a floor. A good time to decide whether to stop at that floor. Note that this event is not triggered for the destination floor. Direction is either "up" or "down".',
  },
  stopped_at_floor: {
    detail: "function(floorNum)",
    info: "Triggered when the elevator has arrived at a floor.",
  },
};

/**
 * The events a floor raises.
 *
 * Keyed by `FloorInterfaceEvents`, for the reason given above
 * {@link ELEVATOR_EVENT_DESCRIPTIONS}. `buttonstate_change` is in that map but
 * not in `documentation.html`, so its line comes from the facade's own JSDoc.
 */
const FLOOR_EVENT_DESCRIPTIONS: Record<keyof FloorInterfaceEvents, EventDescription> = {
  up_button_pressed: {
    detail: "function(floor)",
    info: "Triggered when someone has pressed the up button at a floor. Note that passengers will press the button again if they fail to enter an elevator.",
  },
  down_button_pressed: {
    detail: "function(floor)",
    info: "Triggered when someone has pressed the down button at a floor. Note that passengers will press the button again if they fail to enter an elevator.",
  },
  buttonstate_change: {
    detail: "function(buttonStates)",
    info: "Either call button was lit or cleared.",
  },
};

/**
 * Turns a table of event descriptions into completions.
 *
 * @param descriptions - Descriptions, keyed by event name.
 * @returns One entry per event, in the order the table declares them.
 */
function toEventCompletions(
  descriptions: Record<string, EventDescription>,
): readonly ApiCompletion[] {
  return Object.entries(descriptions).map(([label, { detail, info }]) => ({
    label,
    detail,
    info,
    type: "constant",
  }));
}

/** Event names an elevator's `on`, `once`, `one` and `off` accept. */
export const ELEVATOR_EVENTS: readonly ApiCompletion[] = toEventCompletions(
  ELEVATOR_EVENT_DESCRIPTIONS,
);

/** Event names a floor's `on`, `once`, `one` and `off` accept. */
export const FLOOR_EVENTS: readonly ApiCompletion[] = toEventCompletions(FLOOR_EVENT_DESCRIPTIONS);

/**
 * The whole program, as `documentation.html` prints it under "Basics".
 *
 * Indented with the four spaces the editor itself inserts (`INDENT` in
 * `editor.ts`), so an accepted skeleton matches what the player types next.
 */
const SKELETON = `{
    init: function(elevators, floors) {
        // Do stuff with the elevators and floors, which are both arrays of objects
    },
    update: function(dt, elevators, floors) {
        // Do more stuff with the elevators and floors
        // dt is the number of game seconds that passed since the last time update was called
    }
}`;

/** One half of {@link SKELETON}, for a program that has lost only that half. */
const INIT_SKELETON = `init: function(elevators, floors) {
    // Do stuff with the elevators and floors, which are both arrays of objects
}`;

/** The other half; see {@link INIT_SKELETON}. */
const UPDATE_SKELETON = `update: function(dt, elevators, floors) {
    // Do more stuff with the elevators and floors
}`;

/**
 * What is offered when the cursor is not on a member or an event name.
 *
 * Only on an explicit request, never while typing: these insert several lines,
 * and a multi-line insertion that arrives uninvited is the kind of "help" that
 * makes people turn completion off.
 */
export const GLOBAL_COMPLETIONS: readonly ApiCompletion[] = [
  {
    label: "skeleton",
    detail: "{ init, update }",
    info: "Your code must declare an object containing at least two functions called init and update.",
    type: "text",
    apply: SKELETON,
  },
  {
    label: "init",
    detail: "init: function(elevators, floors)",
    info: "Called when the challenge starts. Normally you will put most of your code in here, to set up event listeners and logic.",
    type: "property",
    apply: INIT_SKELETON,
  },
  {
    label: "update",
    detail: "update: function(dt, elevators, floors)",
    info: "Called repeatedly during the challenge. dt is the number of game seconds that passed since the last time update was called.",
    type: "property",
    apply: UPDATE_SKELETON,
  },
];

/**
 * A subscription call with an unfinished event name in it, e.g.
 * `elevators[0].on("pass`.
 *
 * Groups: the receiver, its subscript if it has one, and the string content so
 * far. `off` is included because it takes the same names, and the names may be
 * space separated, which is why the content group allows spaces.
 */
const EVENT_CALL =
  /([A-Za-z_$][\w$]*)(\[[^[\]]*\])?\s*\.\s*(?:once|one|on|off)\s*\(\s*["']([\w ]*)$/;

/** A member access, e.g. `elevator.goT`. Groups as {@link EVENT_CALL} does. */
const MEMBER_ACCESS = /([A-Za-z_$][\w$]*)(\[[^[\]]*\])?\s*\.\s*([\w$]*)$/;

/** The identifier the cursor sits at the end of, if any. */
const TRAILING_WORD = /[\w$]*$/;

/** What is still the same word, so the popup need not be rebuilt. */
const COMPLETED_WORD = /^[\w$]*$/;

/** What the object a receiver expression names turns out to be. */
type ReceiverKind = "elevator" | "floor" | "collection" | "unknown";

/**
 * Guesses what a receiver expression is, from its name.
 *
 * A regex over the text before the cursor cannot know types, and building
 * something that does — scope analysis over the player's half-written program —
 * would be a large amount of machinery for a popup. The name is the evidence
 * there is, and in this game it is unusually good evidence: the documentation,
 * the starter program and every published solution call these things
 * `elevator`, `elevators`, `floor` and `floors`.
 *
 * @param receiver - The identifier before the dot.
 * @param indexed - Whether a subscript follows it, as in `elevators[0]`.
 * @returns What to treat the expression as.
 */
function receiverKind(receiver: string, indexed: boolean): ReceiverKind {
  const name = receiver.toLowerCase();
  let kind: ReceiverKind;
  if (name.includes("elevator")) {
    kind = "elevator";
  } else if (name.includes("floor")) {
    kind = "floor";
  } else {
    return "unknown";
  }
  // `elevators` and `floors` are the arrays init and update are handed, not an
  // elevator and a floor: `elevators.` is on its way to `forEach`, and offering
  // `goToFloor` there would be wrong. `elevators[0].` really is an elevator.
  return !indexed && name.endsWith("s") ? "collection" : kind;
}

/**
 * The members offered for a receiver.
 *
 * An unrecognised receiver gets nothing at all rather than everything: `Math.`,
 * `console.` and the player's own objects are dotted into far more often than
 * an elevator held in a variable named after neither, and a popup that opens
 * over `Math.max` with `goToFloor` in it is noise.
 *
 * @param kind - What the receiver is.
 * @returns The entries to offer, or `null` for none.
 */
function membersFor(kind: ReceiverKind): readonly ApiCompletion[] | null {
  switch (kind) {
    case "elevator":
      return ELEVATOR_MEMBERS;
    case "floor":
      return FLOOR_MEMBERS;
    case "collection":
    case "unknown":
      return null;
  }
}

/**
 * The event names offered inside a subscription call.
 *
 * An unrecognised receiver gets both sets here, unlike in {@link membersFor}:
 * the call is already known to be an `on`, `once`, `one` or `off` with a string
 * in it, so it is a subscription on *something*, and a player who called their
 * variable `e` or `lift` still gets the names they came for.
 *
 * @param kind - What the receiver is.
 * @returns The entries to offer, or `null` for none.
 */
function eventsFor(kind: ReceiverKind): readonly ApiCompletion[] | null {
  switch (kind) {
    case "elevator":
      return ELEVATOR_EVENTS;
    case "floor":
      return FLOOR_EVENTS;
    case "unknown":
      return [...ELEVATOR_EVENTS, ...FLOOR_EVENTS];
    case "collection":
      return null;
  }
}

/**
 * What to offer for the text leading up to a cursor.
 *
 * The whole of the completion logic, kept as a function of one string so it can
 * be tested without an editor. Three contexts, in the order they are tried:
 *
 * - inside the string of an `on`, `once`, `one` or `off` call, event names;
 * - after a dot, the members of whichever facade the receiver looks like;
 * - otherwise, and only when asked explicitly, the program skeleton.
 *
 * A dot with an unrecognised receiver deliberately ends the search rather than
 * falling through to the skeleton: someone typing `Math.` is not asking for an
 * `init` function.
 *
 * @param lineBeforeCursor - The text on the cursor's line, up to the cursor.
 * @param explicit - Whether the player asked for completion (Ctrl-Space).
 * @returns What to offer and where it starts, or `null` for nothing.
 */
export function completionsFor(
  lineBeforeCursor: string,
  explicit: boolean,
): ApiCompletionResult | null {
  const eventCall = EVENT_CALL.exec(lineBeforeCursor);
  if (eventCall !== null) {
    const [, receiver = "", subscript, typed = ""] = eventCall;
    const options = eventsFor(receiverKind(receiver, subscript !== undefined));
    if (options === null) {
      return null;
    }
    // Several names separated by spaces subscribe to all of them, so only the
    // name the cursor is in gets replaced.
    const name = typed.slice(typed.lastIndexOf(" ") + 1);
    return { from: lineBeforeCursor.length - name.length, options };
  }

  const memberAccess = MEMBER_ACCESS.exec(lineBeforeCursor);
  if (memberAccess !== null) {
    const [, receiver = "", subscript, typed = ""] = memberAccess;
    const options = membersFor(receiverKind(receiver, subscript !== undefined));
    if (options === null) {
      return null;
    }
    return { from: lineBeforeCursor.length - typed.length, options };
  }

  if (!explicit) {
    return null;
  }
  const typed = TRAILING_WORD.exec(lineBeforeCursor)?.[0] ?? "";
  return { from: lineBeforeCursor.length - typed.length, options: GLOBAL_COMPLETIONS };
}

/**
 * The completion source the editor registers with CodeMirror.
 *
 * Only the last line before the cursor is examined, which keeps the matching
 * cheap on every keystroke and is all the context the patterns above need.
 *
 * @param context - Where the cursor is, and how completion was asked for.
 * @returns A CodeMirror completion result, or `null` for nothing to offer.
 */
export function playerApiCompletionSource(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const found = completionsFor(context.state.sliceDoc(line.from, context.pos), context.explicit);
  if (found === null) {
    return null;
  }
  return { from: line.from + found.from, options: found.options, validFor: COMPLETED_WORD };
}
