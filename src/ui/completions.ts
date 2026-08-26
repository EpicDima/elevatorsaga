/** The player API catalog behind the editor's completion popup; plain data so it can be tested without CodeMirror. */

import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";

import type { ElevatorInterfaceEvents } from "../game/elevator-interface.ts";
import type { FloorInterfaceEvents } from "../game/floor-interface.ts";
import { t, type MessageKey } from "../i18n/index.ts";

/** Icon the popup draws beside an entry; one of CodeMirror's own categories. */
type ApiCompletionType = "method" | "property" | "constant" | "function" | "text";

/** One entry in the completion popup; a structural subset of CodeMirror's `Completion`. */
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

/** Narrower than {@link MessageKey}: only messages meant for this popup's prose. */
type CompletionMessageKey = Extract<MessageKey, `completion.${string}`>;

/** {@link ApiCompletion} with its text still keyed, rendered on demand by {@link rendered}. */
interface KeyedCompletion {
  /** As {@link ApiCompletion.label}; an identifier, so not translated. */
  readonly label: string;
  /** As {@link ApiCompletion.detail}; a signature, so not translated. */
  readonly detail: string;
  /** The message that says what this is, in the player's language. */
  readonly info: CompletionMessageKey;
  /** As {@link ApiCompletion.type}. */
  readonly type: ApiCompletionType;
  /** The message with the text to insert, when it differs from the label; also allows `docs.basics.example.code`. */
  readonly apply?: CompletionMessageKey | "docs.basics.example.code";
}

/** What {@link completionsFor} found for one position in the document. */
export interface ApiCompletionResult {
  /** Index where the completed word starts; everything from here to the cursor is replaced. */
  readonly from: number;
  /** What to offer, before CodeMirror filters it by what has been typed. */
  readonly options: readonly ApiCompletion[];
}

/** Renders a table's keyed text into the player's current language. */
function rendered(entries: readonly KeyedCompletion[]): readonly ApiCompletion[] {
  return entries.map(({ label, detail, info, type, apply }) => ({
    label,
    detail,
    info: t(info),
    type,
    // Spread rather than `apply: apply && t(apply)`: `exactOptionalPropertyTypes`
    // forbids carrying the key as `undefined`.
    ...(apply === undefined ? {} : { apply: t(apply) }),
  }));
}

/** Event subscription methods shared by every elevator and floor. */
const EVENT_METHODS: readonly KeyedCompletion[] = [
  {
    label: "on",
    detail: "on(events, handler)",
    info: "completion.events.on",
    type: "method",
  },
  {
    label: "once",
    detail: "once(event, handler)",
    info: "completion.events.once",
    type: "method",
  },
  {
    label: "one",
    detail: "one(event, handler)",
    info: "completion.events.one",
    type: "method",
  },
  {
    label: "off",
    detail: "off(events, handler)",
    info: "completion.events.off",
    type: "method",
  },
  {
    label: "offAll",
    detail: "offAll()",
    info: "completion.events.offAll",
    type: "method",
  },
];

/**
 * What an elevator gives player code. `getFirstPressedFloor` and `trigger` are
 * left out on purpose: both are deprecated/internal, not part of the public API.
 */
const ELEVATOR_MEMBERS: readonly KeyedCompletion[] = [
  {
    label: "goToFloor",
    detail: "goToFloor(floorNum, forceNow)",
    info: "completion.elevator.goToFloor",
    type: "method",
  },
  {
    label: "stop",
    detail: "stop()",
    info: "completion.elevator.stop",
    type: "method",
  },
  {
    label: "currentFloor",
    detail: "currentFloor() -> number",
    info: "completion.elevator.currentFloor",
    type: "method",
  },
  {
    label: "goingUpIndicator",
    detail: "goingUpIndicator(value)",
    info: "completion.elevator.goingUpIndicator",
    type: "method",
  },
  {
    label: "goingDownIndicator",
    detail: "goingDownIndicator(value)",
    info: "completion.elevator.goingDownIndicator",
    type: "method",
  },
  {
    label: "maxPassengerCount",
    detail: "maxPassengerCount() -> number",
    info: "completion.elevator.maxPassengerCount",
    type: "method",
  },
  {
    label: "loadFactor",
    detail: "loadFactor() -> number",
    info: "completion.elevator.loadFactor",
    type: "method",
  },
  {
    label: "isFull",
    detail: "isFull() -> boolean",
    info: "completion.elevator.isFull",
    type: "method",
  },
  {
    label: "isEmpty",
    detail: "isEmpty() -> boolean",
    info: "completion.elevator.isEmpty",
    type: "method",
  },
  {
    label: "destinationDirection",
    detail: 'destinationDirection() -> "up" | "down" | "stopped"',
    info: "completion.elevator.destinationDirection",
    type: "method",
  },
  {
    label: "isApproachingFloor",
    detail: "isApproachingFloor(floorNum) -> boolean",
    info: "completion.elevator.isApproachingFloor",
    type: "method",
  },
  {
    label: "destinationQueue",
    detail: "destinationQueue: number[]",
    info: "completion.elevator.destinationQueue",
    type: "property",
  },
  {
    label: "checkDestinationQueue",
    detail: "checkDestinationQueue()",
    info: "completion.elevator.checkDestinationQueue",
    type: "method",
  },
  {
    label: "getPressedFloors",
    detail: "getPressedFloors() -> number[]",
    info: "completion.elevator.getPressedFloors",
    type: "method",
  },
  {
    label: "servedFloors",
    detail: "servedFloors() -> number[]",
    info: "completion.elevator.servedFloors",
    type: "method",
  },
  {
    label: "takeRequest",
    detail: "takeRequest(fromFloorNum, toFloorNum) -> boolean",
    info: "completion.elevator.takeRequest",
    type: "method",
  },
  ...EVENT_METHODS,
];

/** What an elevator gives player code, in the player's language. */
export function elevatorMembers(): readonly ApiCompletion[] {
  return rendered(ELEVATOR_MEMBERS);
}

/**
 * What a floor gives player code. `level` and `buttonStates` stay out of the
 * popup: `floorNum()` is the supported name, and buttons are watched via
 * `buttonstate_change` rather than polled.
 */
const FLOOR_MEMBERS: readonly KeyedCompletion[] = [
  {
    label: "floorNum",
    detail: "floorNum() -> number",
    info: "completion.floor.floorNum",
    type: "method",
  },
  {
    label: "pendingDestinations",
    detail: "pendingDestinations() -> {floorNum, waiting}[]",
    info: "completion.floor.pendingDestinations",
    type: "method",
  },
  ...EVENT_METHODS,
];

/** What a floor gives player code, in the player's language. */
export function floorMembers(): readonly ApiCompletion[] {
  return rendered(FLOOR_MEMBERS);
}

/** The parameters a handler is called with, and what the event means. */
interface EventDescription {
  /** The handler signature, shown dimmed after the event name. */
  readonly detail: string;
  /** The message that says when the event fires. */
  readonly info: CompletionMessageKey;
}

/** Events an elevator raises; keyed by `ElevatorInterfaceEvents` so a new event must be described here to compile. */
const ELEVATOR_EVENT_DESCRIPTIONS: Record<keyof ElevatorInterfaceEvents, EventDescription> = {
  idle: {
    detail: "function()",
    info: "completion.elevator.event.idle",
  },
  floor_button_pressed: {
    detail: "function(floorNum)",
    info: "completion.elevator.event.floorButtonPressed",
  },
  passing_floor: {
    detail: "function(floorNum, direction)",
    info: "completion.elevator.event.passingFloor",
  },
  stopped_at_floor: {
    detail: "function(floorNum)",
    info: "completion.elevator.event.stoppedAtFloor",
  },
};

/** Events a floor raises; keyed by `FloorInterfaceEvents` so a new event must be described here to compile. */
const FLOOR_EVENT_DESCRIPTIONS: Record<keyof FloorInterfaceEvents, EventDescription> = {
  up_button_pressed: {
    detail: "function(floor)",
    info: "completion.floor.event.upButtonPressed",
  },
  down_button_pressed: {
    detail: "function(floor)",
    info: "completion.floor.event.downButtonPressed",
  },
  hall_button_pressed: {
    detail: "function(direction, floor)",
    info: "completion.floor.event.hallButtonPressed",
  },
  buttonstate_change: {
    detail: "function(buttonStates)",
    info: "completion.floor.event.buttonStateChange",
  },
  destination_requested: {
    detail: "function(destinationFloor, floor)",
    info: "completion.floor.event.destinationRequested",
  },
};

/** Turns a table of event descriptions into completion entries. */
function toEventCompletions(
  descriptions: Record<string, EventDescription>,
): readonly KeyedCompletion[] {
  return Object.entries(descriptions).map(([label, { detail, info }]) => ({
    label,
    detail,
    info,
    type: "constant",
  }));
}

/** Event names an elevator's `on`, `once`, `one` and `off` accept. */
const ELEVATOR_EVENTS: readonly KeyedCompletion[] = toEventCompletions(ELEVATOR_EVENT_DESCRIPTIONS);

/** Event names an elevator's `on`, `once`, `one` and `off` accept, in the player's language. */
export function elevatorEvents(): readonly ApiCompletion[] {
  return rendered(ELEVATOR_EVENTS);
}

/** Event names a floor's `on`, `once`, `one` and `off` accept. */
const FLOOR_EVENTS: readonly KeyedCompletion[] = toEventCompletions(FLOOR_EVENT_DESCRIPTIONS);

/** Event names a floor's `on`, `once`, `one` and `off` accept, in the player's language. */
export function floorEvents(): readonly ApiCompletion[] {
  return rendered(FLOOR_EVENTS);
}

/**
 * What is offered when the cursor is not on a member or event name. Only on an
 * explicit request, never while typing, since these insert multi-line
 * skeletons that must match the editor's own indent (`INDENT` in `editor.ts`).
 */
const GLOBAL_COMPLETIONS: readonly KeyedCompletion[] = [
  {
    label: "skeleton",
    detail: "init, update",
    info: "completion.global.skeleton",
    type: "text",
    apply: "docs.basics.example.code",
  },
  {
    label: "init",
    detail: "function init(elevators, floors)",
    info: "completion.global.init",
    type: "function",
    apply: "completion.initSkeleton.code",
  },
  {
    label: "update",
    detail: "function update(dt, elevators, floors)",
    info: "completion.global.update",
    type: "function",
    apply: "completion.updateSkeleton.code",
  },
];

/** The program skeleton, with its comments in the player's language. */
export function globalCompletions(): readonly ApiCompletion[] {
  return rendered(GLOBAL_COMPLETIONS);
}

/**
 * An unfinished event name in a subscription call, e.g. `elevators[0].on("pass`.
 * Groups: receiver, optional subscript, and the string typed so far (spaces
 * allowed, since multiple names can be space-separated).
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
 * Guesses what a receiver expression is, from its name: no type info is
 * available here, so `elevator`/`elevators`/`floor`/`floors` naming is the
 * best signal there is.
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
  // `elevators`/`floors` are the arrays init/update receive, not a single
  // elevator/floor, so an unindexed name ending in "s" means a collection.
  return !indexed && name.endsWith("s") ? "collection" : kind;
}

/**
 * Members offered for a receiver. An unrecognized receiver gets nothing at
 * all: `Math.`, `console.` and the player's own objects are dotted into far
 * more often than an elevator, so offering `goToFloor` there would be noise.
 */
function membersFor(kind: ReceiverKind): readonly ApiCompletion[] | null {
  switch (kind) {
    case "elevator":
      return elevatorMembers();
    case "floor":
      return floorMembers();
    case "collection":
    case "unknown":
      return null;
  }
}

/**
 * Event names offered inside a subscription call. Unlike {@link membersFor},
 * an unrecognized receiver gets both elevator and floor names, since the call
 * is already known to be a subscription on *something*.
 */
function eventsFor(kind: ReceiverKind): readonly ApiCompletion[] | null {
  switch (kind) {
    case "elevator":
      return elevatorEvents();
    case "floor":
      return floorEvents();
    case "unknown":
      return [...elevatorEvents(), ...floorEvents()];
    case "collection":
      return null;
  }
}

/**
 * What to offer for the text before the cursor, tried in order: event names,
 * then member names after a dot, then (only if explicit) the program skeleton.
 * An unrecognized receiver after a dot ends the search rather than falling through.
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
    // Names may be space-separated; only the one the cursor is in gets replaced.
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
  return { from: lineBeforeCursor.length - typed.length, options: globalCompletions() };
}

/** The completion source registered with CodeMirror; only the last line before the cursor is examined. */
export function playerApiCompletionSource(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const found = completionsFor(context.state.sliceDoc(line.from, context.pos), context.explicit);
  if (found === null) {
    return null;
  }
  return { from: line.from + found.from, options: found.options, validFor: COMPLETED_WORD };
}
