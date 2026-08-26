/**
 * Compares the shipped `public/elevatorsaga.d.ts` against the real facades in
 * `src/game`, so a member, type, or event that drifts between them fails here
 * instead of reaching a player's editor silently.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import * as ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";

import { Elevator } from "./game/elevator.ts";
import { ElevatorInterface } from "./game/elevator-interface.ts";
import { Floor } from "./game/floor.ts";
import { FloorInterface } from "./game/floor-interface.ts";
import { getCodeObjFromCode } from "./game/user-code.ts";
import { createFloors } from "./game/world.ts";

/** The declaration file this whole test exists to keep honest. */
const DECLARATION_PATH = fileURLToPath(new URL("../public/elevatorsaga.d.ts", import.meta.url));

/** The guide that tells players where the declaration is and how to use it. */
const GUIDE_PATH = fileURLToPath(new URL("../docs/writing-solutions.md", import.meta.url));

/**
 * The compiler options a player's guide tells them to use. `skipLibCheck` is
 * left at its default so the declaration file itself gets type-checked here.
 */
const PLAYER_COMPILER_OPTIONS = {
  allowJs: true,
  checkJs: true,
  noEmit: true,
  strict: true,
} as const satisfies ts.CompilerOptions;

/** Parses a TypeScript file into a syntax tree, with parent pointers set. */
function parse(path: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.ES2023,
    true,
    ts.ScriptKind.TS,
  );
}

/** The declaration file, parsed once. */
const declaration = parse(DECLARATION_PATH);

/** The statements inside `declare namespace ElevatorSaga`. */
function namespaceStatements(): readonly ts.Statement[] {
  for (const statement of declaration.statements) {
    if (
      ts.isModuleDeclaration(statement) &&
      statement.name.text === "ElevatorSaga" &&
      statement.body !== undefined &&
      ts.isModuleBlock(statement.body)
    ) {
      return statement.body.statements;
    }
  }
  throw new Error(`${DECLARATION_PATH} declares no namespace ElevatorSaga`);
}

/** One declared interface, by name. */
function declaredInterface(name: string): ts.InterfaceDeclaration {
  for (const statement of namespaceStatements()) {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === name) {
      return statement;
    }
  }
  throw new Error(`${DECLARATION_PATH} declares no interface ${name}`);
}

/**
 * The name of a member, whatever kind of member it is. Returns `null` for a
 * `#private` field, so private members drop out of every comparison below.
 */
function memberName(member: ts.TypeElement | ts.ClassElement): string | null {
  const name = member.name;
  if (name === undefined) {
    return null;
  }
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null;
}

/** Every name a declared interface publishes, with overloads collapsed into one name. */
function declaredMembers(name: string): Set<string> {
  const names = new Set<string>();
  for (const member of declaredInterface(name).members) {
    const memberIdentifier = memberName(member);
    if (memberIdentifier !== null) {
      names.add(memberIdentifier);
    }
  }
  return names;
}

/**
 * The methods whose declaration deliberately doesn't match the facade's: one
 * generic signature there, a set of per-event overloads here. Compared by
 * event name and handler arity instead, further down.
 */
const EVENT_METHODS = new Set(["on", "once", "one", "off", "trigger"]);

/**
 * One type, as text, with line breaks collapsed. An outermost `Readonly<…>`
 * is stripped, so that normalization can't hide a lost `readonly`; that's
 * pinned separately by a line in {@link MISTAKEN_PROGRAM}.
 */
function typeText(type: ts.TypeNode | undefined): string {
  if (type === undefined) {
    return "";
  }
  return type
    .getText()
    .replace(/\s+/g, " ")
    .replace(/^Readonly<(.*)>$/, "$1");
}

/**
 * One signature, as text: its parameter list and return type. Parameter
 * names are included on purpose — they're what a player's editor shows.
 */
function signatureText(signature: ts.MethodDeclaration | ts.MethodSignature): string {
  const parameters = signature.parameters.map((parameter) => {
    const optional = parameter.questionToken === undefined ? "" : "?";
    return `${parameter.name.getText()}${optional}: ${typeText(parameter.type)}`;
  });
  return `(${parameters.join(", ")}): ${typeText(signature.type)}`;
}

/** Whether a member is declared `readonly`. */
function isReadonly(member: ts.ClassElement | ts.TypeElement): boolean {
  return (
    ts.canHaveModifiers(member) &&
    (ts.getModifiers(member) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword,
    )
  );
}

/**
 * Every member of a class or interface, as text by name. A getter becomes a
 * `readonly` property; where a method has overloads and an implementation,
 * the overloads win.
 *
 * @throws If a setter appears — a getter/setter pair can't be rendered this way.
 */
function memberSignatures(
  members: readonly (ts.ClassElement | ts.TypeElement)[],
  where: string,
): Map<string, string[]> {
  const published = new Map<string, string[]>();
  const implementations = new Map<string, string[]>();
  for (const member of members) {
    const name = memberName(member);
    if (name === null || EVENT_METHODS.has(name)) {
      continue;
    }
    if (ts.isSetAccessorDeclaration(member)) {
      throw new Error(`${where} declares a setter for ${name}, which this comparison cannot read`);
    }
    let text: string | null = null;
    let isImplementation = false;
    if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
      text = signatureText(member);
      isImplementation = ts.isMethodDeclaration(member) && member.body !== undefined;
    } else if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
      text = `${isReadonly(member) ? "readonly " : ""}${typeText(member.type)}`;
    } else if (ts.isGetAccessorDeclaration(member)) {
      text = `readonly ${typeText(member.type)}`;
    }
    if (text === null) {
      continue;
    }
    const into = isImplementation ? implementations : published;
    into.set(name, [...(into.get(name) ?? []), text]);
  }
  // Later entries win, so an overloaded method's implementation is replaced.
  return new Map([...implementations, ...published]);
}

/** The members a facade class publishes. */
function facadeMemberSignatures(file: string, className: string): Map<string, string[]> {
  const source = parse(fileURLToPath(new URL(`./game/${file}`, import.meta.url)));
  for (const statement of source.statements) {
    if (ts.isClassDeclaration(statement) && statement.name?.text === className) {
      return memberSignatures(statement.members, `${className} in ${file}`);
    }
  }
  throw new Error(`${file} declares no class ${className}`);
}

/** The same, read out of the declaration. */
function declaredMemberSignatures(interfaceName: string): Map<string, string[]> {
  return memberSignatures(declaredInterface(interfaceName).members, `interface ${interfaceName}`);
}

/** Every signature of one declared method, in declaration order. */
function declaredSignatures(interfaceName: string, method: string): ts.MethodSignature[] {
  return declaredInterface(interfaceName).members.filter(
    (member): member is ts.MethodSignature =>
      ts.isMethodSignature(member) && memberName(member) === method,
  );
}

/**
 * Every string literal inside a type, found however deep it's nested — a bare
 * literal or one inside a union.
 */
function stringLiteralsIn(type: ts.TypeNode | undefined): string[] {
  if (type === undefined) {
    return [];
  }
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) {
      found.push(node.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(type);
  return found;
}

/**
 * The event names one declared method accepts, with each handler's declared
 * argument count (the `this` parameter excluded). An overload naming several
 * events at once contributes nothing, having no single event to describe.
 */
function declaredEventArity(interfaceName: string, method: string): Map<string, number> {
  const arity = new Map<string, number>();
  for (const signature of declaredSignatures(interfaceName, method)) {
    const [eventParameter, handlerParameter] = signature.parameters;
    const events = stringLiteralsIn(eventParameter?.type);
    const handler = handlerParameter?.type;
    if (events.length !== 1 || handler === undefined || !ts.isFunctionTypeNode(handler)) {
      continue;
    }
    const argumentCount = handler.parameters.filter(
      (parameter) => !(ts.isIdentifier(parameter.name) && parameter.name.text === "this"),
    ).length;
    for (const event of events) {
      arity.set(event, argumentCount);
    }
  }
  return arity;
}

/** The string-literal members of a union type alias, by name. */
function declaredUnion(name: string): Set<string> {
  for (const statement of namespaceStatements()) {
    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === name) {
      return new Set(stringLiteralsIn(statement.type));
    }
  }
  throw new Error(`${DECLARATION_PATH} declares no type ${name}`);
}

/**
 * The event map a facade declares, read from its source since the map is a
 * type and gone by run time. Payload length by event name.
 */
function facadeEvents(file: string, alias: string): Map<string, number> {
  const source = parse(fileURLToPath(new URL(`./game/${file}`, import.meta.url)));
  for (const statement of source.statements) {
    if (!ts.isTypeAliasDeclaration(statement) || statement.name.text !== alias) {
      continue;
    }
    if (!ts.isTypeLiteralNode(statement.type)) {
      throw new Error(`${alias} in ${file} is no longer an object type`);
    }
    const events = new Map<string, number>();
    for (const member of statement.type.members) {
      const name = memberName(member);
      if (name === null || !ts.isPropertySignature(member) || member.type === undefined) {
        continue;
      }
      events.set(name, ts.isTupleTypeNode(member.type) ? member.type.elements.length : -1);
    }
    return events;
  }
  throw new Error(`${file} declares no ${alias}`);
}

/**
 * Every name player code can reach on a facade: own properties, then up the
 * prototype chain. `#private` members are invisible to this walk, matching
 * how {@link memberName} treats them in the declaration.
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

/** A live elevator facade to compare against the declaration. */
function elevatorFacade(): ElevatorInterface {
  return new ElevatorInterface(
    new Elevator(1.5, 4, 40),
    createFloors(4, 40, () => undefined),
    () => undefined,
  );
}

/** A live floor facade to compare against the declaration. */
function floorFacade(): FloorInterface {
  return new FloorInterface(new Floor(2, 100, () => undefined), () => undefined);
}

/** Names sorted, so a failure reads as a set difference rather than a shuffle. */
function sorted(names: Iterable<string>): string[] {
  return [...names].sort((left, right) => left.localeCompare(right));
}

/**
 * A program that uses every member the declaration publishes, each call
 * positioned to constrain its return type. A member added to the declaration
 * must be exercised here before the suite passes again.
 */
const EXERCISING_PROGRAM = `
/** @type {ElevatorSaga.Solution} */
({
  init: function (elevators, floors) {
    var elevator = elevators[0];
    var floor = floors[0];

    /** @type {number[]} */
    var queue = elevator.destinationQueue;
    elevator.destinationQueue = queue.slice(0, 1);
    elevator.goToFloor(2);
    elevator.goToFloor(2, true);
    elevator.checkDestinationQueue();
    elevator.stop();

    /** @type {number} */
    var current = elevator.currentFloor();
    /** @type {number} */
    var capacity = elevator.maxPassengerCount();
    /** @type {number} */
    var load = elevator.loadFactor();
    /** @type {number} */
    var lowest = elevator.getFirstPressedFloor();
    /** @type {number[]} */
    var pressed = elevator.getPressedFloors();
    /** @type {number[]} */
    var served = elevator.servedFloors();
    /** @type {boolean} */
    var full = elevator.isFull();
    /** @type {boolean} */
    var empty = elevator.isEmpty();
    /** @type {boolean} */
    var approaching = elevator.isApproachingFloor(current + 1);
    /** @type {boolean} */
    var up = elevator.goingUpIndicator();
    /** @type {boolean} */
    var down = elevator.goingDownIndicator();
    /** @type {"up" | "down" | "stopped"} */
    var heading = elevator.destinationDirection();
    /** @type {number} */
    var level = floor.level;
    /** @type {number} */
    var number = floor.floorNum();
    /** @type {"" | "activated"} */
    var upButton = floor.buttonStates.up;
    /** @type {"" | "activated"} */
    var downButton = floor.buttonStates.down;
    /** @type {boolean} */
    var booked = elevator.takeRequest(number, number + 1);
    /** @type {ElevatorSaga.PendingDestination[]} */
    var pending = floor.pendingDestinations();

    elevator.goingUpIndicator(!up).goingDownIndicator(!down).offAll();
    floor.offAll();

    elevator.on("idle", function () {
      this.goToFloor(0);
    });
    elevator.on("floor_button_pressed", function (floorNum) {
      elevator.goToFloor(floorNum + 0);
    });
    elevator.on("passing_floor", function (floorNum, direction) {
      elevator.goToFloor(direction === "up" ? floorNum + 1 : floorNum - 1);
    });
    elevator.on("stopped_at_floor stopped_at_floor", function (eventName) {
      elevator.goToFloor(eventName === "stopped_at_floor" ? 0 : 1);
    });
    elevator.once("stopped_at_floor", function (floorNum) {
      elevator.goToFloor(floorNum);
    });
    elevator.one("idle", function () {
      elevator.trigger("idle").trigger("floor_button_pressed", 1);
      elevator.trigger("passing_floor", 1, "down").trigger("stopped_at_floor", 1);
    });
    /** @param {number} floorNum */
    var remember = function (floorNum) {
      elevator.goToFloor(floorNum);
    };
    elevator.on("floor_button_pressed", remember);
    elevator.off("floor_button_pressed", remember);
    /**
     * @param {number} floorNum
     * @param {"up" | "down"} direction
     */
    var watch = function (floorNum, direction) {
      elevator.goToFloor(direction === "up" ? floorNum + 1 : floorNum - 1);
    };
    elevator.on("passing_floor", watch);
    elevator.off("passing_floor", watch);
    elevator.off("idle");
    elevator.off("*");

    floor.on("up_button_pressed", function (pressedFloor) {
      elevator.goToFloor(pressedFloor.floorNum());
    });
    floor.on("down_button_pressed down_button_pressed", function (eventName) {
      elevator.goToFloor(eventName === "down_button_pressed" ? 0 : 1);
    });
    floor.on("hall_button_pressed", function (direction, pressedFloor) {
      elevator.goToFloor(direction === "up" ? pressedFloor.floorNum() : 0);
    });
    floor.once("buttonstate_change", function (buttons) {
      elevator.goToFloor(buttons.up === "activated" ? 0 : 1);
    });
    floor.on("destination_requested", function (destinationFloor, requestingFloor) {
      elevator.takeRequest(requestingFloor.floorNum(), destinationFloor);
    });
    floor.one("up_button_pressed", function (pressedFloor) {
      elevator.goToFloor(pressedFloor.level);
    });
    /** @param {ElevatorSaga.Floor} pressed */
    var call = function (pressed) {
      elevator.goToFloor(pressed.floorNum());
    };
    floor.on("up_button_pressed", call);
    floor.off("up_button_pressed", call);
    floor.off("buttonstate_change");

    return [capacity, load, lowest, pressed.length, full, empty, approaching, heading, level,
      number, upButton, downButton, booked, pending.length];
  },
  update: function (dt, elevators, floors) {
    return dt + elevators.length + floors.length;
  },
})
`;

/**
 * A program made of mistakes, each of which the declaration has to catch.
 * Every `// error` line must be reported, and every other line must stay
 * clean; one statement per line, since diagnostics are matched by line.
 */
const MISTAKEN_PROGRAM = `
/** @type {ElevatorSaga.Solution} */
({
  init: function (elevators, floors) {
    elevators[0].goToFloor("3"); // error: a floor is a number
    elevators[0].goToTheFloor(3); // error: no such method
    elevators[0].currentFloor().toUpperCase(); // error: currentFloor returns a number
    elevators[0].on("floor_button_presed", function () {}); // error: no such event
    elevators[0].on("idle", function (floorNum) { return floorNum; }); // error: idle has no arguments
    elevators.sort(function () { return 0; }); // error: the game's own array, not a copy
    floors[0].pressUpButton(); // error: the real floor object is not handed to player code
    floors[0].buttonStates = { up: "", down: "" }; // error: a snapshot, not a setting
    floors[0].buttonStates.up = "activated"; // error: the snapshot's fields are read-only too
    floors[0].on("buttonstate_change", function (buttons) { return buttons.left; }); // error: no such button
    elevators[0].off("*", function () {}); // error: the wildcard removes everything, handler or not
  },
  update: function (dt, elevators, floors) {},
})
`;

/** How a line of {@link MISTAKEN_PROGRAM} says it expects to be reported. */
const ERROR_MARKER = "// error";

/**
 * The one program in the guide that a player is told to start from, found by
 * content — the `@type` annotation — rather than by position in the file.
 *
 * @throws If no fenced JS block in the guide carries that annotation.
 */
function guideExample(): string {
  const guide = readFileSync(GUIDE_PATH, "utf8");
  for (const [, block = ""] of guide.matchAll(/```js\n([\s\S]*?)```/g)) {
    if (block.includes("@type {ElevatorSaga.Init}")) {
      return block;
    }
  }
  throw new Error(
    "No fenced js block in docs/writing-solutions.md is annotated with " +
      "@type {ElevatorSaga.Init}; the declaration file's instructions are " +
      "not being checked by anything.",
  );
}

/** Where the fixtures are written for the compiler to read. */
const workingDirectory = mkdtempSync(join(tmpdir(), "elevatorsaga-declarations-"));

afterAll(() => {
  rmSync(workingDirectory, { recursive: true, force: true });
});

/**
 * Compiles the declaration together with player programs, one program per
 * file, all in a single compilation to share the expensive part.
 */
function compile(programs: Readonly<Record<string, string>>): Map<string, ts.Diagnostic[]> {
  const paths = Object.entries(programs).map(([name, source]) => {
    const path = join(workingDirectory, name);
    writeFileSync(path, source);
    return path;
  });
  const program = ts.createProgram([DECLARATION_PATH, ...paths], PLAYER_COMPILER_OPTIONS);
  const byFile = new Map<string, ts.Diagnostic[]>();
  for (const diagnostic of [
    ...program.getOptionsDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...program.getSyntacticDiagnostics(),
    ...program.getSemanticDiagnostics(),
  ]) {
    const name = diagnostic.file === undefined ? "" : diagnostic.file.fileName;
    byFile.set(name, [...(byFile.get(name) ?? []), diagnostic]);
  }
  return byFile;
}

/** One diagnostic, as a line number and message for failure output. */
function describeDiagnostic(diagnostic: ts.Diagnostic): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
  if (diagnostic.file === undefined || diagnostic.start === undefined) {
    return message;
  }
  const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return `line ${String(line + 1)}: ${message}`;
}

/** The 1-based, deduplicated line numbers a set of diagnostics were reported against. */
function reportedLines(diagnostics: readonly ts.Diagnostic[]): number[] {
  const lines = new Set<number>();
  for (const diagnostic of diagnostics) {
    if (diagnostic.file !== undefined && diagnostic.start !== undefined) {
      lines.add(diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1);
    }
  }
  return [...lines].sort((left, right) => left - right);
}

/** The 1-based line numbers of a fixture carrying {@link ERROR_MARKER}. */
function markedLines(source: string): number[] {
  return source
    .split("\n")
    .map((line, index) => (line.includes(ERROR_MARKER) ? index + 1 : 0))
    .filter((line) => line > 0);
}

/** The three fixtures, compiled once for every test that reads them. */
const compiled = compile({
  "exercising.js": EXERCISING_PROGRAM,
  "mistaken.js": MISTAKEN_PROGRAM,
  "guide.js": guideExample(),
});

/** What the compiler said about one fixture. */
function diagnosticsFor(name: string): ts.Diagnostic[] {
  return compiled.get(join(workingDirectory, name)) ?? [];
}

describe("the members the declaration file publishes", () => {
  it("declares every member the elevator facade hands player code", () => {
    // A new ElevatorInterface member needs a matching declaration in
    // public/elevatorsaga.d.ts, exercised in EXERCISING_PROGRAM above.
    expect(sorted(exposedNames(elevatorFacade()))).toEqual(sorted(declaredMembers("Elevator")));
  });

  it("declares every member the floor facade hands player code", () => {
    expect(sorted(exposedNames(floorFacade()))).toEqual(sorted(declaredMembers("Floor")));
  });

  it("gives every member the type the facade gives it", () => {
    // Catches a facade member whose *type* changed without the declaration
    // following — e.g. goToFloor growing a third argument. The comparison is
    // textual, so a rename on one side fails here until it's made on both.
    for (const [file, className, interfaceName] of [
      ["elevator-interface.ts", "ElevatorInterface", "Elevator"],
      ["floor-interface.ts", "FloorInterface", "Floor"],
    ] as const) {
      expect(Object.fromEntries(facadeMemberSignatures(file, className)), interfaceName).toEqual(
        Object.fromEntries(declaredMemberSignatures(interfaceName)),
      );
    }
  });

  it("uses every member it declares, so nothing is declared untested", () => {
    // Forces every declared member to appear in EXERCISING_PROGRAM, in a
    // position that constrains its return type.
    const unexercised = [...declaredMembers("Elevator"), ...declaredMembers("Floor")].filter(
      (name) => !EXERCISING_PROGRAM.includes(`.${name}`),
    );
    expect(sorted(new Set(unexercised))).toEqual([]);
  });
});

describe("the events the declaration file publishes", () => {
  const elevatorFacadeEvents = facadeEvents("elevator-interface.ts", "ElevatorInterfaceEvents");
  const floorFacadeEvents = facadeEvents("floor-interface.ts", "FloorInterfaceEvents");

  it("names exactly the elevator's events", () => {
    expect(sorted(declaredUnion("ElevatorEventName"))).toEqual(sorted(elevatorFacadeEvents.keys()));
  });

  it("names exactly the floor's events", () => {
    expect(sorted(declaredUnion("FloorEventName"))).toEqual(sorted(floorFacadeEvents.keys()));
  });

  it("gives every elevator event the arguments the facade raises it with", () => {
    // `off` is included because unregistering takes the handler that was
    // registered, so its overloads must carry the same parameters as `on`'s.
    for (const method of ["on", "once", "one", "off"]) {
      expect(Object.fromEntries(declaredEventArity("Elevator", method)), method).toEqual(
        Object.fromEntries(elevatorFacadeEvents),
      );
    }
  });

  it("gives every floor event the arguments the facade raises it with", () => {
    for (const method of ["on", "once", "one", "off"]) {
      expect(Object.fromEntries(declaredEventArity("Floor", method)), method).toEqual(
        Object.fromEntries(floorFacadeEvents),
      );
    }
  });

  it("lets player code raise exactly the elevator events the facade can", () => {
    // `trigger` is legacy surface but still part of the contract; the event
    // name is its first argument, hence the extra one in the count below.
    const declared = new Map(
      declaredSignatures("Elevator", "trigger").map((signature) => [
        stringLiteralsIn(signature.parameters[0]?.type).join(),
        signature.parameters.length - 1,
      ]),
    );
    expect(Object.fromEntries(declared)).toEqual(Object.fromEntries(elevatorFacadeEvents));
  });
});

describe("the program shape the declaration file publishes", () => {
  it("asks for exactly the functions the game requires, with the arguments it passes", () => {
    // Read off `UserCodeObject`; a player whose editor accepted a
    // two-argument `update` would otherwise only find out from the game.
    const engine = parse(fileURLToPath(new URL("./game/world-controller.ts", import.meta.url)));
    const required = new Map<string, number>();
    for (const statement of engine.statements) {
      if (ts.isInterfaceDeclaration(statement) && statement.name.text === "UserCodeObject") {
        for (const member of statement.members) {
          const name = memberName(member);
          if (name !== null && ts.isMethodSignature(member)) {
            required.set(name, member.parameters.length);
          }
        }
      }
    }
    expect(required.size, "UserCodeObject was not found in world-controller.ts").toBeGreaterThan(0);
    const declared = new Map(
      declaredInterface("Solution")
        .members.filter(ts.isMethodSignature)
        .map((member) => [memberName(member) ?? "", member.parameters.length]),
    );
    expect(Object.fromEntries(declared)).toEqual(Object.fromEntries(required));
  });
});

describe("the declaration file as a compiler sees it", () => {
  it("compiles clean on its own", () => {
    // `skipLibCheck` is off, so this checks the declaration's own contents.
    expect((compiled.get(DECLARATION_PATH) ?? []).map(describeDiagnostic)).toEqual([]);
  });

  it("reports nothing the compiler was not asked about", () => {
    expect((compiled.get("") ?? []).map(describeDiagnostic)).toEqual([]);
  });

  it("accepts a program that uses the whole API", () => {
    expect(diagnosticsFor("exercising.js").map(describeDiagnostic)).toEqual([]);
  });

  it("rejects each mistake, and only those", () => {
    expect(reportedLines(diagnosticsFor("mistaken.js"))).toEqual(markedLines(MISTAKEN_PROGRAM));
  });
});

describe("the instructions docs/writing-solutions.md gives", () => {
  it("prints an example the compiler accepts", () => {
    expect(diagnosticsFor("guide.js").map(describeDiagnostic)).toEqual([]);
  });

  it("prints an example the game will load", () => {
    // The annotations are JSDoc comments, so the example pastes into the
    // editor as it stands; this is what says the comments cost it nothing.
    const solution = getCodeObjFromCode(guideExample());
    expect(typeof solution.init).toBe("function");
    expect(typeof solution.update).toBe("function");
  });

  it("prints the compiler options these fixtures were compiled with", () => {
    // Keeps the guide's options in sync with PLAYER_COMPILER_OPTIONS.
    const guide = readFileSync(GUIDE_PATH, "utf8");
    for (const [option, value] of Object.entries(PLAYER_COMPILER_OPTIONS)) {
      expect(guide, option).toContain(`"${option}": ${String(value)}`);
    }
  });

  it("says where the declaration is served from once the site is built", () => {
    const guide = readFileSync(GUIDE_PATH, "utf8");
    expect(guide).toContain("public/elevatorsaga.d.ts");
    expect(guide).toContain("elevatorsaga.d.ts");
  });
});
