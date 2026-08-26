import { afterEach, describe, expect, it } from "vitest";

import { Elevator } from "../game/elevator.ts";
import { ElevatorInterface } from "../game/elevator-interface.ts";
import { Floor } from "../game/floor.ts";
import { FloorInterface } from "../game/floor-interface.ts";
import { getCodeObjFromCode } from "../game/user-code.ts";
import { createFloors } from "../game/world.ts";
import { setLocale, translateIn, DEFAULT_LOCALE, LOCALES, type Locale } from "../i18n/index.ts";
import {
  completionsFor,
  elevatorEvents,
  elevatorMembers,
  floorEvents,
  floorMembers,
  globalCompletions,
  type ApiCompletion,
} from "./completions.ts";

// Resets the locale so a language switch in one test doesn't leak into the next.
afterEach(() => {
  setLocale(DEFAULT_LOCALE);
});

/** The completion labels offered for a cursor at the end of `lineBeforeCursor`. */
function labelsFor(lineBeforeCursor: string, explicit = false): string[] | null {
  const found = completionsFor(lineBeforeCursor, explicit);
  return found === null ? null : found.options.map((option) => option.label);
}

/** Where the popup would start replacing, for a cursor at the end of the line. */
function fromFor(lineBeforeCursor: string, explicit = false): number | null {
  return completionsFor(lineBeforeCursor, explicit)?.from ?? null;
}

/** Every table, so entry shape can be checked across all of them; built fresh each call since text depends on the active language. */
function everyTable(): readonly (readonly ApiCompletion[])[] {
  return [elevatorMembers(), floorMembers(), elevatorEvents(), floorEvents(), globalCompletions()];
}

/** Every entry of every table, in one language and a fixed order, for cross-language comparison. */
function everyEntryIn(locale: Locale): readonly ApiCompletion[] {
  setLocale(locale);
  return everyTable().flat();
}

describe("member completions", () => {
  it("offers the elevator API after anything named like an elevator", () => {
    for (const line of [
      "elevator.",
      "myElevator.",
      "theELEVATOR.",
      "elevators[0].",
      "elevator .",
    ]) {
      const labels = labelsFor(line);
      expect(labels).toContain("goToFloor");
      expect(labels).toContain("destinationQueue");
      expect(labels).toContain("loadFactor");
      expect(labels).toContain("on");
      expect(labels).not.toContain("floorNum");
    }
  });

  it("offers the floor API after anything named like a floor", () => {
    for (const line of ["floor.", "theFloor.", "floors[1].", "floors[floorNum]."]) {
      const labels = labelsFor(line);
      expect(labels).toContain("floorNum");
      expect(labels).toContain("on");
      expect(labels).toContain("offAll");
      expect(labels).not.toContain("goToFloor");
    }
  });

  it("does not fire on a dot that has nothing to do with the game", () => {
    for (const line of ["Math.", "console.", "foo.", "obj.prop.", "0.5 + x."]) {
      expect(labelsFor(line)).toBeNull();
      // Not even when asked explicitly: a dot means members, not ours to guess at.
      expect(labelsFor(line, true)).toBeNull();
    }
  });

  it("treats the elevators and floors arrays as the arrays they are", () => {
    // `elevators.` is on its way to `forEach`, not to `goToFloor`.
    expect(labelsFor("elevators.")).toBeNull();
    expect(labelsFor("floors.")).toBeNull();
    expect(labelsFor("        floors.f")).toBeNull();
  });

  it("replaces only the part of the name already typed", () => {
    expect(fromFor("    elevator.goT")).toBe("    elevator.".length);
    expect(fromFor("elevator.")).toBe("elevator.".length);
    expect(labelsFor("elevator.goT")).toEqual(labelsFor("elevator."));
  });

  it("does not offer event names as members", () => {
    expect(labelsFor("elevator.")).not.toContain("idle");
    expect(labelsFor("floor.")).not.toContain("up_button_pressed");
  });
});

describe("event completions", () => {
  it("offers exactly the elevator's events inside its subscription calls", () => {
    for (const call of ["on", "once", "one", "off"]) {
      expect(labelsFor(`elevator.${call}("`)).toEqual([
        "idle",
        "floor_button_pressed",
        "passing_floor",
        "stopped_at_floor",
      ]);
    }
  });

  it("offers exactly the floor's events inside its subscription calls", () => {
    expect(labelsFor("floors[0].on('")).toEqual([
      "up_button_pressed",
      "down_button_pressed",
      "hall_button_pressed",
      "buttonstate_change",
      "destination_requested",
    ]);
  });

  it("offers both sets when the receiver's name gives nothing away", () => {
    // Already known to be a subscription, so an ambiguous name still gets both sets.
    expect(labelsFor('e.on("')).toEqual([
      ...elevatorEvents().map((event) => event.label),
      ...floorEvents().map((event) => event.label),
    ]);
  });

  it("completes the name the cursor is in, of several separated by spaces", () => {
    const line = 'floor.on("up_button_pressed down';
    expect(labelsFor(line)).toEqual(floorEvents().map((event) => event.label));
    expect(fromFor(line)).toBe(line.length - "down".length);
    expect(fromFor('floor.on("up_button_pressed ')).toBe('floor.on("up_button_pressed '.length);
  });

  it("stops offering event names once the string is closed", () => {
    expect(labelsFor('elevator.on("idle"')).toBeNull();
    expect(labelsFor('elevator.on("idle", function() {')).toBeNull();
  });

  it("offers nothing for a subscription call with no string in it yet", () => {
    // Not a member access either — the parenthesis ended that.
    expect(labelsFor("elevator.on(")).toBeNull();
  });

  it("is not fooled by a method whose name merely ends in one of ours", () => {
    expect(labelsFor('elevator.turnOn("')).toBeNull();
  });
});

describe("the program skeleton", () => {
  it("is offered on an explicit request, and only then", () => {
    expect(labelsFor("", true)).toEqual(["skeleton", "init", "update"]);
    expect(labelsFor("")).toBeNull();
    expect(labelsFor("    ini")).toBeNull();
    expect(labelsFor("    ini", true)).toEqual(["skeleton", "init", "update"]);
  });

  it("replaces the word already typed", () => {
    expect(fromFor("    ini", true)).toBe(4);
    expect(fromFor("", true)).toBe(0);
  });

  it("inserts a program the game can actually run", () => {
    // A translation that garbled a `//` comment would produce a program that doesn't parse.
    for (const locale of LOCALES) {
      setLocale(locale);
      const skeleton = globalCompletions().find((option) => option.label === "skeleton")?.apply;
      expect(skeleton, locale).toBeDefined();
      const codeObj = getCodeObjFromCode(skeleton ?? "");
      expect(typeof codeObj.init, locale).toBe("function");
      expect(typeof codeObj.update, locale).toBe("function");
    }
  });

  it("inserts the halves of that same skeleton on their own", () => {
    for (const locale of LOCALES) {
      setLocale(locale);
      const halves = globalCompletions().filter((option) => option.label !== "skeleton");
      expect(
        halves.map((option) => option.label),
        locale,
      ).toEqual(["init", "update"]);
      const program = `{ ${halves.map((option) => option.apply ?? "").join(",\n")} }`;
      const codeObj = getCodeObjFromCode(program);
      expect(typeof codeObj.init, locale).toBe("function");
      expect(typeof codeObj.update, locale).toBe("function");
    }
  });
});

describe("what every entry carries", () => {
  it("has a signature and a line of prose, which is the point of the popup", () => {
    // A key routed to the wrong catalog, or an empty translation, would only show up in a language nobody here reads.
    for (const locale of LOCALES) {
      setLocale(locale);
      for (const table of everyTable()) {
        expect(table.length, locale).toBeGreaterThan(0);
        for (const option of table) {
          expect(option.label, locale).not.toBe("");
          expect(option.detail, locale).not.toBe("");
          expect(option.info.length, `${option.label} in ${locale}`).toBeGreaterThan(20);
        }
      }
    }
  });

  it("names each entry once per table", () => {
    for (const table of everyTable()) {
      const labels = table.map((option) => option.label);
      expect([...new Set(labels)]).toEqual(labels);
    }
  });

  it("mentions the method it describes in that method's signature", () => {
    for (const table of [elevatorMembers(), floorMembers()]) {
      for (const option of table) {
        expect(option.detail.startsWith(option.label)).toBe(true);
      }
    }
  });
});

describe("the language the popup speaks", () => {
  it("answers in the language chosen after this module was imported", () => {
    // A module-scope `const` built at import time would stay English forever.
    const english = everyEntryIn("en");
    const russian = everyEntryIn("ru");
    expect(russian).toHaveLength(english.length);
    for (const [index, entry] of russian.entries()) {
      expect(entry.info, `${entry.label} is still English`).not.toBe(english[index]?.info);
    }
    // Checked word-for-word against the Russian catalog, not just "is different".
    expect(elevatorMembers().find((entry) => entry.label === "goToFloor")?.info).toBe(
      translateIn("ru", "completion.elevator.goToFloor"),
    );
    expect(elevatorEvents().find((entry) => entry.label === "idle")?.info).toBe(
      translateIn("ru", "completion.elevator.event.idle"),
    );
    expect(globalCompletions().find((entry) => entry.label === "skeleton")?.apply).toBe(
      translateIn("ru", "docs.basics.example.code"),
    );
  });

  it("says it again in English when the player switches back", () => {
    // Checked against the catalog, not whatever English text got cached along the way.
    const before = everyEntryIn("en");
    everyEntryIn("ru");
    expect(everyEntryIn("en")).toEqual(before);
    expect(elevatorMembers().find((entry) => entry.label === "goToFloor")?.info).toBe(
      translateIn("en", "completion.elevator.goToFloor"),
    );
    expect(globalCompletions().find((entry) => entry.label === "skeleton")?.apply).toBe(
      translateIn("en", "docs.basics.example.code"),
    );
  });

  it("leaves the names and the signatures alone in every language", () => {
    // Translating a label would insert code that doesn't exist.
    const english = everyEntryIn("en");
    for (const [index, entry] of everyEntryIn("ru").entries()) {
      const same = english[index];
      expect(entry.label).toBe(same?.label);
      expect(entry.detail, entry.label).toBe(same?.detail);
      expect(entry.type, entry.label).toBe(same?.type);
    }
  });

  it("speaks it through the offer the editor actually makes", () => {
    // Goes through `completionsFor`, what the editor's completion source calls.
    setLocale("ru");
    const optionsFor = (line: string, explicit = false): readonly ApiCompletion[] =>
      completionsFor(line, explicit)?.options ?? [];
    expect(optionsFor("elevator.").find((option) => option.label === "goToFloor")?.info).toBe(
      translateIn("ru", "completion.elevator.goToFloor"),
    );
    expect(optionsFor("floor.").find((option) => option.label === "floorNum")?.info).toBe(
      translateIn("ru", "completion.floor.floorNum"),
    );
    expect(
      optionsFor('floor.on("').find((option) => option.label === "up_button_pressed")?.info,
    ).toBe(translateIn("ru", "completion.floor.event.upButtonPressed"));
    expect(optionsFor("", true).find((option) => option.label === "init")?.info).toBe(
      translateIn("ru", "completion.global.init"),
    );
  });
});

/** Every name player code can reach on a facade, via `getOwnPropertyNames` so a getter like `buttonStates` isn't invoked. */
function exposedNames(facade: object): Set<string> {
  const exposed = new Set<string>();
  for (
    let proto: object | null = facade;
    proto !== null && proto !== Object.prototype;
    proto = Object.getPrototypeOf(proto) as object | null
  ) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      exposed.add(key);
    }
  }
  exposed.delete("constructor");
  return exposed;
}

/** Elevator members left out on purpose, and why; anything unlisted and unoffered fails the test below. */
const OMITTED_ELEVATOR_MEMBERS: Readonly<Record<string, string>> = {
  getFirstPressedFloor: "Deprecated and undocumented; scheduled for removal.",
  trigger:
    "Only reachable because the legacy facade was a riot observable. Raising the game's own events is not something to suggest.",
};

/** Floor members the popup leaves out on purpose; see above. */
const OMITTED_FLOOR_MEMBERS: Readonly<Record<string, string>> = {
  level: "Undocumented; floorNum() is the supported spelling of the same number.",
  buttonStates:
    "Undocumented, and better watched through the buttonstate_change event than polled.",
};

describe("agreement with the facades player code is handed", () => {
  /** A live elevator facade, built the way `elevator-interface.test.ts` does. */
  function elevatorFacade(): ElevatorInterface {
    return new ElevatorInterface(
      new Elevator(1.5, 4, 40),
      createFloors(4, 40, () => undefined),
      () => undefined,
    );
  }

  /** A live floor facade, built the way `floor-interface.test.ts` does. */
  function floorFacade(): FloorInterface {
    return new FloorInterface(new Floor(2, 100, () => undefined), () => undefined);
  }

  it("offers every member the elevator facade has", () => {
    const offered = new Set(elevatorMembers().map((option) => option.label));
    const undiscoverable = [...exposedNames(elevatorFacade())].filter(
      (name) => !offered.has(name) && !Object.hasOwn(OMITTED_ELEVATOR_MEMBERS, name),
    );
    // Means the facade grew a method to describe in ELEVATOR_MEMBERS or list in OMITTED_ELEVATOR_MEMBERS.
    expect(undiscoverable).toEqual([]);
  });

  it("offers every member the floor facade has", () => {
    const offered = new Set(floorMembers().map((option) => option.label));
    const undiscoverable = [...exposedNames(floorFacade())].filter(
      (name) => !offered.has(name) && !Object.hasOwn(OMITTED_FLOOR_MEMBERS, name),
    );
    expect(undiscoverable).toEqual([]);
  });

  it("offers nothing the facades do not have", () => {
    // The other direction: a stale or typo'd label would sit in the popup inserting code that throws.
    const elevator = exposedNames(elevatorFacade());
    expect(elevatorMembers().filter((option) => !elevator.has(option.label))).toEqual([]);
    const floor = exposedNames(floorFacade());
    expect(floorMembers().filter((option) => !floor.has(option.label))).toEqual([]);
  });

  it("keeps the omissions honest", () => {
    // A member that stops existing should take its excuse with it.
    const elevator = exposedNames(elevatorFacade());
    expect(Object.keys(OMITTED_ELEVATOR_MEMBERS).filter((name) => !elevator.has(name))).toEqual([]);
    const floor = exposedNames(floorFacade());
    expect(Object.keys(OMITTED_FLOOR_MEMBERS).filter((name) => !floor.has(name))).toEqual([]);
  });
});
