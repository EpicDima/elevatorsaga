import { describe, expect, it } from "vitest";

import { Elevator } from "../game/elevator.ts";
import { ElevatorInterface } from "../game/elevator-interface.ts";
import { Floor } from "../game/floor.ts";
import { FloorInterface } from "../game/floor-interface.ts";
import { getCodeObjFromCode } from "../game/user-code.ts";
import {
  ELEVATOR_EVENTS,
  ELEVATOR_MEMBERS,
  FLOOR_EVENTS,
  FLOOR_MEMBERS,
  GLOBAL_COMPLETIONS,
  completionsFor,
  type ApiCompletion,
} from "./completions.ts";

/**
 * The names offered for a cursor sitting at the end of `lineBeforeCursor`.
 *
 * @param lineBeforeCursor - The line up to the cursor.
 * @param explicit - Whether the player pressed Ctrl-Space.
 * @returns The labels in the order they are offered, or `null` for nothing.
 */
function labelsFor(lineBeforeCursor: string, explicit = false): string[] | null {
  const found = completionsFor(lineBeforeCursor, explicit);
  return found === null ? null : found.options.map((option) => option.label);
}

/**
 * Where the popup would start replacing, for a cursor at the end of the line.
 *
 * @param lineBeforeCursor - The line up to the cursor.
 * @param explicit - Whether the player pressed Ctrl-Space.
 * @returns The offset, or `null` when nothing is offered.
 */
function fromFor(lineBeforeCursor: string, explicit = false): number | null {
  return completionsFor(lineBeforeCursor, explicit)?.from ?? null;
}

/** Every table, so the shape of an entry can be checked across all of them. */
const EVERY_TABLE: readonly (readonly ApiCompletion[])[] = [
  ELEVATOR_MEMBERS,
  FLOOR_MEMBERS,
  ELEVATOR_EVENTS,
  FLOOR_EVENTS,
  GLOBAL_COMPLETIONS,
];

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
      // Not even when asked for explicitly: a dot means members, and the
      // members of someone else's object are not ours to guess at.
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
      "buttonstate_change",
    ]);
  });

  it("offers both sets when the receiver's name gives nothing away", () => {
    // The call is already known to be a subscription, so someone who named
    // their variable `e` still gets the names they came for.
    expect(labelsFor('e.on("')).toEqual([
      ...ELEVATOR_EVENTS.map((event) => event.label),
      ...FLOOR_EVENTS.map((event) => event.label),
    ]);
  });

  it("completes the name the cursor is in, of several separated by spaces", () => {
    const line = 'floor.on("up_button_pressed down';
    expect(labelsFor(line)).toEqual(FLOOR_EVENTS.map((event) => event.label));
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
    // The skeleton is what a player starting from nothing gets handed, so it
    // has to satisfy the same compiler their own code does.
    const skeleton = GLOBAL_COMPLETIONS.find((option) => option.label === "skeleton")?.apply;
    expect(skeleton).toBeDefined();
    const codeObj = getCodeObjFromCode(skeleton ?? "");
    expect(typeof codeObj.init).toBe("function");
    expect(typeof codeObj.update).toBe("function");
  });

  it("inserts the halves of that same skeleton on their own", () => {
    const halves = GLOBAL_COMPLETIONS.filter((option) => option.label !== "skeleton");
    expect(halves.map((option) => option.label)).toEqual(["init", "update"]);
    const program = `{ ${halves.map((option) => option.apply ?? "").join(",\n")} }`;
    const codeObj = getCodeObjFromCode(program);
    expect(typeof codeObj.init).toBe("function");
    expect(typeof codeObj.update).toBe("function");
  });
});

describe("what every entry carries", () => {
  it("has a signature and a line of prose, which is the point of the popup", () => {
    for (const table of EVERY_TABLE) {
      expect(table.length).toBeGreaterThan(0);
      for (const option of table) {
        expect(option.label).not.toBe("");
        expect(option.detail).not.toBe("");
        expect(option.info.length).toBeGreaterThan(20);
      }
    }
  });

  it("names each entry once per table", () => {
    for (const table of EVERY_TABLE) {
      const labels = table.map((option) => option.label);
      expect([...new Set(labels)]).toEqual(labels);
    }
  });

  it("mentions the method it describes in that method's signature", () => {
    for (const table of [ELEVATOR_MEMBERS, FLOOR_MEMBERS]) {
      for (const option of table) {
        expect(option.detail.startsWith(option.label)).toBe(true);
      }
    }
  });
});

/**
 * Every name player code can reach on a facade.
 *
 * The same walk `elevator-interface.test.ts` and `floor-interface.test.ts` use
 * to pin their surface: own properties first, then up the prototype chain, so
 * instance fields like `destinationQueue` are counted alongside the methods.
 * `getOwnPropertyNames` reads the descriptors, so a getter such as the floor's
 * `buttonStates` is found without being invoked.
 *
 * @param facade - An instance of the facade.
 * @returns Its property names.
 */
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

/**
 * Elevator members the popup leaves out on purpose, and why.
 *
 * Anything not listed here and not offered fails the test below, so a method
 * added to the facade cannot quietly stay undiscoverable: whoever adds it has
 * to either describe it in `completions.ts` or say here why it is not for
 * players.
 */
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
  /**
   * A live elevator facade, built the way `elevator-interface.test.ts` does.
   *
   * @returns The facade.
   */
  function elevatorFacade(): ElevatorInterface {
    return new ElevatorInterface(new Elevator(1.5, 4, 40), 4, () => undefined);
  }

  /**
   * A live floor facade, built the way `floor-interface.test.ts` does.
   *
   * @returns The facade.
   */
  function floorFacade(): FloorInterface {
    return new FloorInterface(new Floor(2, 100, () => undefined), () => undefined);
  }

  it("offers every member the elevator facade has", () => {
    const offered = new Set(ELEVATOR_MEMBERS.map((option) => option.label));
    const undiscoverable = [...exposedNames(elevatorFacade())].filter(
      (name) => !offered.has(name) && !Object.hasOwn(OMITTED_ELEVATOR_MEMBERS, name),
    );
    // Failing here means ElevatorInterface grew a method the completion popup
    // does not know about. Describe it in ELEVATOR_MEMBERS, taking the wording
    // from its JSDoc, or list it in OMITTED_ELEVATOR_MEMBERS with the reason.
    expect(undiscoverable).toEqual([]);
  });

  it("offers every member the floor facade has", () => {
    const offered = new Set(FLOOR_MEMBERS.map((option) => option.label));
    const undiscoverable = [...exposedNames(floorFacade())].filter(
      (name) => !offered.has(name) && !Object.hasOwn(OMITTED_FLOOR_MEMBERS, name),
    );
    expect(undiscoverable).toEqual([]);
  });

  it("offers nothing the facades do not have", () => {
    // The other direction: a typo in a label, or a method that was renamed or
    // removed, would otherwise sit in the popup inserting code that throws.
    const elevator = exposedNames(elevatorFacade());
    expect(ELEVATOR_MEMBERS.filter((option) => !elevator.has(option.label))).toEqual([]);
    const floor = exposedNames(floorFacade());
    expect(FLOOR_MEMBERS.filter((option) => !floor.has(option.label))).toEqual([]);
  });

  it("keeps the omissions honest", () => {
    // A member that stops existing should take its excuse with it.
    const elevator = exposedNames(elevatorFacade());
    expect(Object.keys(OMITTED_ELEVATOR_MEMBERS).filter((name) => !elevator.has(name))).toEqual([]);
    const floor = exposedNames(floorFacade());
    expect(Object.keys(OMITTED_FLOOR_MEMBERS).filter((name) => !floor.has(name))).toEqual([]);
  });
});
