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
 * Two rules keep the popup from drifting away from the game it describes. The
 * prose is not written here at all: every `info` is a `completion.*` key, whose
 * English is copied from `documentation.html` and from the JSDoc on the facades
 * rather than written afresh, and `page.test.ts` holds the two in step — a
 * popup that says something subtly different from the documentation is worse
 * than no popup, in either language. And the event tables are keyed by the
 * facades' own event maps, so an event added to `ElevatorInterface` or
 * `FloorInterface` does not compile until it has been described here. Member
 * names have no such compile-time anchor — they are strings either way — so
 * `completions.test.ts` checks them against the real facades instead.
 *
 * ## Why the tables are functions
 *
 * {@link t} answers for the locale that is active when it is called, and this
 * module is imported long before the player's language has been resolved. A
 * module-scope constant holding rendered prose would therefore be English for
 * the rest of the session whatever the page around it said. So the tables below
 * hold keys, and {@link elevatorMembers} and its neighbors turn them into
 * entries per call. The popup is rebuilt from scratch on every keystroke
 * anyway, so that costs a few dozen lookups in a plain object and nothing has
 * to be invalidated when the language changes. `levels.ts` repairs the same
 * fault with `get description()` and `default-code.ts` with a nullary function;
 * this is the latter shape, for tables nobody holds a reference to.
 *
 * Only the prose moves. A `label` is an identifier the popup inserts into the
 * player's program and a `detail` is that identifier's signature, so both stay
 * English in every language: completing `goToFloor` into anything else would be
 * suggesting code that does not exist.
 */

import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";

import type { ElevatorInterfaceEvents } from "../game/elevator-interface.ts";
import type { FloorInterfaceEvents } from "../game/floor-interface.ts";
import { t, type MessageKey } from "../i18n/index.ts";

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

/**
 * A message written for the popup.
 *
 * Narrower than {@link MessageKey} so that an entry cannot quietly start
 * showing a line written for somewhere else on the page — and because every
 * message under this prefix is a plain sentence, which is what lets the tables
 * name one without also having to say what to interpolate into it.
 */
type CompletionMessageKey = Extract<MessageKey, `completion.${string}`>;

/**
 * One entry as this module stores it: the same thing with its text still keyed.
 *
 * The tables are written in this form and rendered by {@link rendered}, which
 * is what defers every catalog read to the moment the popup is built.
 */
interface KeyedCompletion {
  /** As {@link ApiCompletion.label}; an identifier, so not translated. */
  readonly label: string;
  /** As {@link ApiCompletion.detail}; a signature, so not translated. */
  readonly detail: string;
  /** The message that says what this is, in the player's language. */
  readonly info: CompletionMessageKey;
  /** As {@link ApiCompletion.type}. */
  readonly type: ApiCompletionType;
  /**
   * The message holding the text to insert, when it is not the label.
   *
   * `docs.basics.example.code` is admitted alongside the popup's own messages
   * because the whole-program skeleton is the Help page's example under
   * "Basics" — one text with one key, rather than two copies to keep in step.
   */
  readonly apply?: CompletionMessageKey | "docs.basics.example.code";
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
 * A table of entries, in the language the player is reading right now.
 *
 * @param entries - The table, as it is written below.
 * @returns The same entries with their text rendered from the catalog.
 */
function rendered(entries: readonly KeyedCompletion[]): readonly ApiCompletion[] {
  return entries.map(({ label, detail, info, type, apply }) => ({
    label,
    detail,
    info: t(info),
    type,
    // Spread rather than `apply: apply && t(apply)`: `exactOptionalPropertyTypes`
    // is on, so an entry that inserts its own label must not carry the key at
    // all rather than carry it as `undefined`.
    ...(apply === undefined ? {} : { apply: t(apply) }),
  }));
}

/**
 * The event methods, which every elevator and every floor publishes alike.
 *
 * Wording from the "Event methods" table of `documentation.html`.
 */
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
  ...EVENT_METHODS,
];

/**
 * What an elevator gives player code, in the player's language.
 *
 * @returns The entries offered after `elevator.`.
 */
export function elevatorMembers(): readonly ApiCompletion[] {
  return rendered(ELEVATOR_MEMBERS);
}

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
const FLOOR_MEMBERS: readonly KeyedCompletion[] = [
  {
    label: "floorNum",
    detail: "floorNum() -> number",
    info: "completion.floor.floorNum",
    type: "method",
  },
  ...EVENT_METHODS,
];

/**
 * What a floor gives player code, in the player's language.
 *
 * @returns The entries offered after `floor.`.
 */
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

/**
 * Turns a table of event descriptions into entries.
 *
 * @param descriptions - Descriptions, keyed by event name.
 * @returns One entry per event, in the order the table declares them.
 */
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

/**
 * Event names an elevator's `on`, `once`, `one` and `off` accept, described in
 * the player's language.
 *
 * @returns The entries offered inside an elevator's subscription call.
 */
export function elevatorEvents(): readonly ApiCompletion[] {
  return rendered(ELEVATOR_EVENTS);
}

/** Event names a floor's `on`, `once`, `one` and `off` accept. */
const FLOOR_EVENTS: readonly KeyedCompletion[] = toEventCompletions(FLOOR_EVENT_DESCRIPTIONS);

/**
 * Event names a floor's `on`, `once`, `one` and `off` accept, described in the
 * player's language.
 *
 * @returns The entries offered inside a floor's subscription call.
 */
export function floorEvents(): readonly ApiCompletion[] {
  return rendered(FLOOR_EVENTS);
}

/**
 * What is offered when the cursor is not on a member or an event name.
 *
 * Only on an explicit request, never while typing: these insert several lines,
 * and a multi-line insertion that arrives uninvited is the kind of "help" that
 * makes people turn completion off.
 *
 * The whole program is `docs.basics.example.code`, which is the example
 * `documentation.html` prints under "Basics" — one text with one key, so that
 * the skeleton the popup inserts and the skeleton the Help page walks through
 * cannot be corrected in one place and not the other. Its two halves, for a
 * program that has lost only one of them, exist nowhere else and have keys of
 * their own. All three are indented with the four spaces the editor itself
 * inserts (`INDENT` in `editor.ts`), so an accepted skeleton matches what the
 * player types next.
 */
const GLOBAL_COMPLETIONS: readonly KeyedCompletion[] = [
  {
    label: "skeleton",
    detail: "{ init, update }",
    info: "completion.global.skeleton",
    type: "text",
    apply: "docs.basics.example.code",
  },
  {
    label: "init",
    detail: "init: function(elevators, floors)",
    info: "completion.global.init",
    type: "property",
    apply: "completion.initSkeleton.code",
  },
  {
    label: "update",
    detail: "update: function(dt, elevators, floors)",
    info: "completion.global.update",
    type: "property",
    apply: "completion.updateSkeleton.code",
  },
];

/**
 * The program skeleton, with its comments in the player's language.
 *
 * @returns The entries offered for an explicit request outside any member
 * access.
 */
export function globalCompletions(): readonly ApiCompletion[] {
  return rendered(GLOBAL_COMPLETIONS);
}

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
 * An unrecognized receiver gets nothing at all rather than everything: `Math.`,
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
      return elevatorMembers();
    case "floor":
      return floorMembers();
    case "collection":
    case "unknown":
      return null;
  }
}

/**
 * The event names offered inside a subscription call.
 *
 * An unrecognized receiver gets both sets here, unlike in {@link membersFor}:
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
 * What to offer for the text leading up to a cursor.
 *
 * The whole of the completion logic, kept as a function of one string so it can
 * be tested without an editor. Three contexts, in the order they are tried:
 *
 * - inside the string of an `on`, `once`, `one` or `off` call, event names;
 * - after a dot, the members of whichever facade the receiver looks like;
 * - otherwise, and only when asked explicitly, the program skeleton.
 *
 * A dot with an unrecognized receiver deliberately ends the search rather than
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
  return { from: lineBeforeCursor.length - typed.length, options: globalCompletions() };
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
