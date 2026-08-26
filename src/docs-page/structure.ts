/**
 * The shape of the reference page: everything about it that is not prose.
 *
 * The prose is in `#i18n/docs-en.ts` and its translations, one key per passage.
 * What is left once the words are taken out is this module — the order the
 * sections come in, the members each table lists, their types, and the example
 * beside each one. None of it is language-specific: a member is named by an
 * identifier and an example is code, so both read the same in every locale, and
 * a new language adds a catalog and nothing here.
 *
 * Build-time only, like the catalogs it names keys from: `vite.config.ts` renders
 * the page from this and emits the HTML, so nothing here reaches a bundle.
 */

import type { DocsMessageKey } from "#i18n/docs-en.ts";

/**
 * What a table's first column holds, which is also the catalog key for its
 * heading: `docs.table.method`, `docs.table.property` or `docs.table.event`.
 */
export type TableColumn = "method" | "property" | "event";

/**
 * What a table's type column says about a member. Named here and translated in
 * the catalogs under `docs.type.*`: these are words on the page, not the
 * identifiers beside them.
 */
export type MemberType = "function" | "array";

/** One row of an API table. */
export interface ApiRow {
  /** The member or event, spelled as a player writes it. */
  readonly name: string;
  /** What it is, for the tables that carry a type column. */
  readonly type?: MemberType;
  /** The catalog key for the row's explanation. */
  readonly key: DocsMessageKey;
  /**
   * The catalog key for the row's example, for the examples whose comments are
   * translated. An example with nothing to translate is written inline as
   * {@link ApiRow.example} instead, and a row may have neither.
   */
  readonly exampleKey?: DocsMessageKey;
  /** The row's example, for examples that carry no translatable comment. */
  readonly example?: string;
}

/** One API table: a column kind and the rows under it, in display order. */
export interface ApiTable {
  /** What the first column holds, which decides its heading. */
  readonly column: TableColumn;
  /** The rows, in the order a reader meets them. */
  readonly rows: readonly ApiRow[];
}

/** One entry of a `<dl>` of worked examples: the code, and what it does. */
export interface ExampleEntry {
  /** The line being explained. */
  readonly code: string;
  /** The catalog key for the explanation beside it. */
  readonly key: DocsMessageKey;
}

/** One piece of the page, in the order it is printed. */
export type Block =
  | {
      readonly block: "heading";
      /** `h2` for a section, `h3` for a subsection. */
      readonly level: 2 | 3;
      readonly key: DocsMessageKey;
      /** An anchor, for the headings something links to. */
      readonly id?: string;
    }
  | { readonly block: "prose"; readonly key: DocsMessageKey }
  /** The skeleton the "Basics" section walks through, which the game's own catalog holds. */
  | { readonly block: "code" }
  | { readonly block: "examples"; readonly entries: readonly ExampleEntry[] }
  | { readonly block: "table"; readonly table: ApiTable };

/**
 * The event methods, which every elevator and every floor carries.
 *
 * `trigger` is reachable alongside them and left out on purpose: it exists only
 * because the legacy facade was a riot observable and published solutions may
 * already call it. Raising the game's own events from player code is not
 * something to recommend to a first-time reader. `src/page.test.ts` holds the
 * omission so it cannot be forgotten about.
 */
const EVENT_METHODS: ApiTable = {
  column: "method",
  rows: [
    {
      name: "on",
      key: "docs.api.events.on",
      example: `elevator.on("idle", function() { ... });
floor.on("up_button_pressed down_button_pressed", function(eventName) { ... });`,
    },
    {
      name: "once",
      key: "docs.api.events.once",
      example: `elevator.once("stopped_at_floor", function(floorNum) { ... });`,
    },
    {
      name: "one",
      key: "docs.api.events.one.html",
      example: `elevator.one("stopped_at_floor", function(floorNum) { ... });`,
    },
    {
      name: "off",
      key: "docs.api.events.off.html",
      exampleKey: "docs.api.events.off.example.code",
    },
    {
      name: "offAll",
      key: "docs.api.events.offAll.html",
      example: `elevator.offAll();
floor.offAll();`,
    },
  ],
};

/**
 * The elevator object's members.
 *
 * `getFirstPressedFloor` is deprecated and left out: it warns on the console and
 * is scheduled for removal (`src/game/elevator.ts`). Documenting it now would be
 * advertising an API on its way out, and `getPressedFloors` below is the
 * supported way to ask. `src/page.test.ts` holds the omission.
 */
const ELEVATOR_MEMBERS: ApiTable = {
  column: "property",
  rows: [
    {
      name: "goToFloor",
      type: "function",
      key: "docs.api.elevator.goToFloor.html",
      exampleKey: "docs.api.elevator.goToFloor.example.code",
    },
    {
      name: "stop",
      type: "function",
      key: "docs.api.elevator.stop",
      example: "elevator.stop();",
    },
    {
      name: "currentFloor",
      type: "function",
      key: "docs.api.elevator.currentFloor",
      exampleKey: "docs.api.elevator.currentFloor.example.code",
    },
    {
      name: "goingUpIndicator",
      type: "function",
      key: "docs.api.elevator.goingUpIndicator",
      example: `if(elevator.goingUpIndicator()) {
    elevator.goingDownIndicator(false);
}`,
    },
    {
      name: "goingDownIndicator",
      type: "function",
      key: "docs.api.elevator.goingDownIndicator",
      example: `if(elevator.goingDownIndicator()) {
    elevator.goingUpIndicator(false);
}`,
    },
    {
      name: "maxPassengerCount",
      type: "function",
      key: "docs.api.elevator.maxPassengerCount",
      exampleKey: "docs.api.elevator.maxPassengerCount.example.code",
    },
    {
      name: "loadFactor",
      type: "function",
      key: "docs.api.elevator.loadFactor",
      exampleKey: "docs.api.elevator.loadFactor.example.code",
    },
    {
      name: "isFull",
      type: "function",
      key: "docs.api.elevator.isFull",
      exampleKey: "docs.api.elevator.isFull.example.code",
    },
    {
      name: "isEmpty",
      type: "function",
      key: "docs.api.elevator.isEmpty",
      exampleKey: "docs.api.elevator.isEmpty.example.code",
    },
    {
      name: "destinationDirection",
      type: "function",
      key: "docs.api.elevator.destinationDirection",
    },
    {
      name: "isApproachingFloor",
      type: "function",
      key: "docs.api.elevator.isApproachingFloor",
      exampleKey: "docs.api.elevator.isApproachingFloor.example.code",
    },
    {
      name: "destinationQueue",
      type: "array",
      key: "docs.api.elevator.destinationQueue",
      example: `elevator.destinationQueue = [];
elevator.checkDestinationQueue();`,
    },
    {
      name: "checkDestinationQueue",
      type: "function",
      key: "docs.api.elevator.checkDestinationQueue",
      example: "elevator.checkDestinationQueue();",
    },
    {
      name: "getPressedFloors",
      type: "function",
      key: "docs.api.elevator.getPressedFloors",
      exampleKey: "docs.api.elevator.getPressedFloors.example.code",
    },
    {
      name: "servedFloors",
      type: "function",
      key: "docs.api.elevator.servedFloors",
      exampleKey: "docs.api.elevator.servedFloors.example.code",
    },
    {
      name: "takeRequest",
      type: "function",
      key: "docs.api.elevator.takeRequest",
      exampleKey: "docs.api.elevator.takeRequest.example.code",
    },
  ],
};

/** The events an elevator raises. */
const ELEVATOR_EVENTS: ApiTable = {
  column: "event",
  rows: [
    {
      name: "idle",
      key: "docs.api.elevator.idle",
      example: `elevator.on("idle", function() { ... });`,
    },
    {
      name: "floor_button_pressed",
      key: "docs.api.elevator.floorButtonPressed",
      exampleKey: "docs.api.elevator.floorButtonPressed.example.code",
    },
    {
      name: "passing_floor",
      key: "docs.api.elevator.passingFloor",
      example: `elevator.on("passing_floor", function(floorNum, direction) { ... });`,
    },
    {
      name: "stopped_at_floor",
      key: "docs.api.elevator.stoppedAtFloor",
      exampleKey: "docs.api.elevator.stoppedAtFloor.example.code",
    },
  ],
};

/**
 * The floor object's members.
 *
 * `level` and `buttonStates` are reachable and left out. Both are kept on the
 * facade only because they were readable on the legacy floor object and
 * published solutions use them (`src/game/floor-interface.ts`). `level` is the
 * same number `floorNum()` returns, and offering two spellings of one value as
 * equally supported helps nobody; `buttonStates` is better watched through the
 * `buttonstate_change` event below than polled, and that event is where its
 * shape is written down. `src/page.test.ts` holds both omissions.
 */
const FLOOR_MEMBERS: ApiTable = {
  column: "property",
  rows: [
    {
      name: "floorNum",
      type: "function",
      key: "docs.api.floor.floorNum",
      example: "if(floor.floorNum() > 3) { ... }",
    },
    {
      name: "pendingDestinations",
      type: "function",
      key: "docs.api.floor.pendingDestinations",
      exampleKey: "docs.api.floor.pendingDestinations.example.code",
    },
  ],
};

/** The events a floor raises. */
const FLOOR_EVENTS: ApiTable = {
  column: "event",
  rows: [
    {
      name: "up_button_pressed",
      key: "docs.api.floor.upButtonPressed",
      exampleKey: "docs.api.floor.upButtonPressed.example.code",
    },
    {
      name: "down_button_pressed",
      key: "docs.api.floor.downButtonPressed",
      exampleKey: "docs.api.floor.downButtonPressed.example.code",
    },
    {
      name: "hall_button_pressed",
      key: "docs.api.floor.hallButtonPressed",
      exampleKey: "docs.api.floor.hallButtonPressed.example.code",
    },
    {
      name: "buttonstate_change",
      key: "docs.api.floor.buttonStateChange.html",
      exampleKey: "docs.api.floor.buttonStateChange.example.code",
    },
    {
      name: "destination_requested",
      key: "docs.api.floor.destinationRequested",
      exampleKey: "docs.api.floor.destinationRequested.example.code",
    },
  ],
};

/** The page, section by section, in the order it is printed. */
export const DOCS_PAGE: readonly Block[] = [
  { block: "heading", level: 2, key: "docs.about.heading" },
  { block: "prose", key: "docs.about.p1.html" },
  { block: "prose", key: "docs.about.p2.html" },

  { block: "heading", level: 2, key: "docs.play.heading" },
  { block: "prose", key: "docs.play.track.html" },
  { block: "prose", key: "docs.play.start.html" },
  { block: "prose", key: "docs.play.statistics.html" },
  { block: "prose", key: "docs.play.shortcuts.html" },
  { block: "prose", key: "docs.play.debugging.html" },

  { block: "heading", level: 2, key: "docs.basics.heading" },
  { block: "prose", key: "docs.basics.declare.html" },
  // The one example the completion popup also inserts, which is why it lives in
  // the game's own catalog rather than the reference page's.
  { block: "code" },
  { block: "prose", key: "docs.basics.called.html" },
  { block: "prose", key: "docs.basics.initPurpose.html" },
  { block: "prose", key: "docs.basics.noLibraries.html" },

  { block: "heading", level: 2, key: "docs.examples.heading" },
  { block: "heading", level: 3, key: "docs.examples.control.heading" },
  {
    block: "examples",
    entries: [
      { code: "elevator.goToFloor(1);", key: "docs.examples.goToFloor" },
      { code: "if(elevator.currentFloor() > 2) { ... }", key: "docs.examples.currentFloor" },
    ],
  },
  { block: "heading", level: 3, key: "docs.examples.events.heading" },
  { block: "prose", key: "docs.examples.events.intro.html" },
  {
    block: "examples",
    entries: [
      {
        code: `elevator.on("idle", function() { elevator.goToFloor(0); });`,
        key: "docs.examples.idle",
      },
      {
        code: `elevator.on("floor_button_pressed", function(floorNum) { ... } );`,
        key: "docs.examples.floorButtonPressed",
      },
      {
        code: `floor.on("up_button_pressed", function(floor) { ... } );`,
        key: "docs.examples.upButtonPressed",
      },
    ],
  },
  { block: "prose", key: "docs.examples.events.perElevator.html" },

  { block: "heading", level: 2, key: "docs.api.heading", id: "docs" },

  { block: "heading", level: 3, key: "docs.api.events.heading", id: "events" },
  { block: "prose", key: "docs.api.events.intro" },
  { block: "table", table: EVENT_METHODS },
  { block: "prose", key: "docs.api.events.outro.html" },

  { block: "heading", level: 3, key: "docs.api.elevator.heading" },
  { block: "table", table: ELEVATOR_MEMBERS },
  { block: "table", table: ELEVATOR_EVENTS },

  { block: "heading", level: 3, key: "docs.api.floor.heading" },
  { block: "table", table: FLOOR_MEMBERS },
  { block: "table", table: FLOOR_EVENTS },
];
