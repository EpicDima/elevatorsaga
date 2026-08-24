/**
 * The shipped type declarations, against the facades they describe.
 *
 * `public/elevatorsaga.d.ts` is handed to players to point their own editor at,
 * and a declaration that has fallen behind the game is worse than none: it
 * teaches a wrong API confidently, in an editor, with no way for the reader to
 * tell. Nothing else in the build looks at that file — it is copied into
 * `dist/` verbatim, never imported, never compiled — so this is the only place
 * that can notice.
 *
 * Both directions are checked, and neither expectation is written down here:
 *
 * - what the facades publish is read off `ElevatorInterface` and
 *   `FloorInterface` *instances* at run time, by walking their prototype
 *   chains, so a method added to either shows up here the moment it exists;
 * - what the declaration publishes is read out of its syntax tree with the
 *   TypeScript compiler, so a member renamed or dropped there shows up too.
 *
 * A guard whose expectation is a second hand-written list guards nothing: it
 * drifts in lockstep with whatever it was copied from, or it goes stale on its
 * own. The event names are handled the same way, parsed out of the event maps
 * on the facades rather than restated.
 *
 * Names are only half of it. The declaration is also compiled — with exactly
 * the four compiler options the README tells a player to put in their
 * `tsconfig.json`, so what passes here is what passes for them — against three
 * programs: the one the README prints, one that touches every member it
 * declares, and one made of mistakes, each of which has to be reported. That is
 * what pins the *types*: a member is required to appear in the exercising
 * program, so a return type nobody uses cannot exist.
 *
 * What that adds up to, exactly, because an over-claimed guard is worse than
 * none. Compared against the game, and so caught here:
 *
 * - a member on either facade that the declaration lacks, or declares and the
 *   facade lacks, in either direction;
 * - the type of any such member, as text: a parameter added, removed, renamed,
 *   made optional, or retyped, and any return or property type — for everything
 *   except the five event methods, whose declaration is deliberately a different
 *   shape from the facade's one generic signature (see {@link EVENT_METHODS});
 * - which events each facade raises, and how many arguments each hands a
 *   handler, for `on`, `once`, `one`, `off` and `trigger`;
 * - the functions the game requires of a solution and how many arguments it
 *   passes each, read off `UserCodeObject`;
 * - that the README's instructions still name this file, still print these
 *   compiler options, and still print an example that compiles and that the
 *   game's own loader will accept.
 *
 * Not compared against the game, and so not caught here:
 *
 * - the *types* of the event methods' parameters beyond their count — that an
 *   `on("passing_floor", …)` handler is handed `(number, Direction)` rather than
 *   `(number, number)` is pinned only by the fixtures below, against what the
 *   declaration itself says;
 * - prose. Every sentence of JSDoc in the declaration was written by hand from
 *   the facade's, and nothing notices when one of them stops being true;
 * - behavior. This file compares two descriptions of the game and never runs
 *   it, so a declaration that matches a facade which has itself changed meaning
 *   passes;
 * - anything a player's own editor does differently: a different TypeScript
 *   version, other compiler options, or a project that does not pick the file
 *   up at all.
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

/** The README section that tells players where the declaration is and how to use it. */
const README_PATH = fileURLToPath(new URL("../README.md", import.meta.url));

/**
 * The compiler options the README hands a player, and nothing besides.
 *
 * Kept in step with the `tsconfig.json` printed there by the test at the bottom
 * of this file, so the fixtures below are compiled the way a player's editor
 * compiles their solution — including `skipLibCheck` left at its default, which
 * is what makes the declaration file itself type-checked here rather than
 * waved through.
 */
const PLAYER_COMPILER_OPTIONS = {
  allowJs: true,
  checkJs: true,
  noEmit: true,
  strict: true,
} as const satisfies ts.CompilerOptions;

/**
 * Parses a TypeScript file into a syntax tree.
 *
 * `setParentNodes` is on because the walks below ask nodes about their parents.
 *
 * @param path - Absolute path to the file.
 * @returns Its syntax tree.
 */
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

/**
 * The statements inside `declare namespace ElevatorSaga`.
 *
 * @returns The namespace body's statements.
 * @throws If the namespace is not there at all, which is a failure worth
 * reporting as itself rather than as thirty confusing empty comparisons.
 */
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

/**
 * One declared interface, by name.
 *
 * @param name - The interface name, e.g. `Elevator`.
 * @returns Its declaration.
 * @throws If the declaration file has no such interface.
 */
function declaredInterface(name: string): ts.InterfaceDeclaration {
  for (const statement of namespaceStatements()) {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === name) {
      return statement;
    }
  }
  throw new Error(`${DECLARATION_PATH} declares no interface ${name}`);
}

/**
 * The name of a member, whatever kind of member it is.
 *
 * Takes class members as well as interface ones so that the facades and the
 * declaration can be read by the same helpers. A `#private` field's name is a
 * `PrivateIdentifier` rather than an `Identifier`, so it comes back `null` and
 * drops out of every comparison below — which is the line between what player
 * code can reach and what it cannot, drawn in the syntax tree the same way
 * {@link exposedNames} draws it at run time.
 *
 * @param member - A member of an interface or of a class.
 * @returns Its name, or `null` for a member that has none — an index signature,
 * which this file declares none of and which would name nothing anyway.
 */
function memberName(member: ts.TypeElement | ts.ClassElement): string | null {
  const name = member.name;
  if (name === undefined) {
    return null;
  }
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null;
}

/**
 * Every name a declared interface publishes.
 *
 * Overloads collapse into one name, which is what makes this comparable with a
 * prototype's property names.
 *
 * @param name - The interface name.
 * @returns Its member names, deduplicated.
 */
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
 * The methods whose declaration deliberately does not look like the facade's.
 *
 * Each of these is one generic signature on the facade —
 * `on<S extends EventNameSpec<ElevatorInterfaceEvents>>(events: S, handler:
 * HandlerFor<S, ElevatorInterfaceEvents>)` — and a list of per-event overloads
 * in the declaration, which is most of the reason the declaration is worth
 * shipping: `on("passing_floor", …)` then puts that event's own two parameters
 * and that event's own sentence under the cursor. Comparing the two as text
 * would be comparing two spellings of one promise, so the dimension that can
 * really drift — which events exist, and how many arguments each hands a
 * handler — is compared instead, by the event tests further down.
 */
const EVENT_METHODS = new Set(["on", "once", "one", "off", "trigger"]);

/**
 * One type, as text, with its line breaks collapsed.
 *
 * An outermost `Readonly<…>` is dropped, which is the one place the comparison
 * below is not literal. `FloorInterface.buttonStates` returns
 * `Readonly<FloorButtonStates>` and the declaration publishes a
 * `FloorButtonStates` whose two fields are already `readonly`; those are the
 * same type written twice, and demanding one spelling would only push a wrapper
 * into the declaration to satisfy a test. What the wrapper is really saying —
 * that the snapshot's fields cannot be assigned — is pinned directly instead, by
 * a line in {@link MISTAKEN_PROGRAM}, so this normalization cannot hide the loss
 * of it. Anything new that leans on it needs a line there too.
 *
 * @param type - The type node, or `undefined` where there is no annotation.
 * @returns Its source text on one line.
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
 * One signature, as the text of its parameter list and return type.
 *
 * Parameter names are part of it on purpose. They are what an editor prints in
 * the hint above the cursor, so a declaration whose `goToFloor` calls its first
 * argument something the game does not is drift the player is shown directly.
 *
 * @param signature - A method on a facade, or one in the declaration.
 * @returns Its parameters and return type, on one line.
 */
function signatureText(signature: ts.MethodDeclaration | ts.MethodSignature): string {
  const parameters = signature.parameters.map((parameter) => {
    const optional = parameter.questionToken === undefined ? "" : "?";
    return `${parameter.name.getText()}${optional}: ${typeText(parameter.type)}`;
  });
  return `(${parameters.join(", ")}): ${typeText(signature.type)}`;
}

/**
 * Whether a member is declared `readonly`.
 *
 * @param member - A member of a class or of an interface.
 * @returns Whether player code is forbidden to assign to it.
 */
function isReadonly(member: ts.ClassElement | ts.TypeElement): boolean {
  return (
    ts.canHaveModifiers(member) &&
    (ts.getModifiers(member) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword,
    )
  );
}

/**
 * Every member of a class or an interface, as text, by name.
 *
 * The two sides of the comparison — a facade class and a declared interface —
 * go through this same function, so what it renders is what gets compared, and
 * anything it renders the same way is a difference it cannot see.
 *
 * Methods become their parameter list and return type; properties become their
 * type, with `readonly` in front where they carry it; a getter becomes a
 * `readonly` property, because that is what a getter with no setter is to the
 * code reading it. Where a method has both overloads and an implementation, the
 * overloads are what it publishes and the implementation signature is
 * discarded: `goingUpIndicator`'s is `(value?: boolean): boolean | this`, which
 * is neither of the two ways it can be called and which no declaration should
 * copy.
 *
 * @param members - The members to read.
 * @param where - What is being read, for the message if a setter turns up.
 * @returns Member text by name, overloads in declaration order.
 * @throws If a setter appears. A getter is rendered `readonly` here, which a
 * getter/setter pair is not, and a guard that quietly reported the wrong
 * modifier would be worse than one that says it needs updating.
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

/**
 * The members a facade class publishes.
 *
 * @param file - The facade's file name under `src/game`.
 * @param className - The class to read, e.g. `ElevatorInterface`.
 * @returns Member text by name.
 * @throws If the class is not there, which means this test is reading nothing
 * and should say so rather than compare two empty maps.
 */
function facadeMemberSignatures(file: string, className: string): Map<string, string[]> {
  const source = parse(fileURLToPath(new URL(`./game/${file}`, import.meta.url)));
  for (const statement of source.statements) {
    if (ts.isClassDeclaration(statement) && statement.name?.text === className) {
      return memberSignatures(statement.members, `${className} in ${file}`);
    }
  }
  throw new Error(`${file} declares no class ${className}`);
}

/**
 * The same, read out of the declaration.
 *
 * @param interfaceName - The interface to read, e.g. `Elevator`.
 * @returns Member text by name.
 */
function declaredMemberSignatures(interfaceName: string): Map<string, string[]> {
  return memberSignatures(declaredInterface(interfaceName).members, `interface ${interfaceName}`);
}

/**
 * Every signature of one declared method, in declaration order.
 *
 * @param interfaceName - The interface to look in.
 * @param method - The method name, e.g. `on`.
 * @returns Its overloads.
 */
function declaredSignatures(interfaceName: string, method: string): ts.MethodSignature[] {
  return declaredInterface(interfaceName).members.filter(
    (member): member is ts.MethodSignature =>
      ts.isMethodSignature(member) && memberName(member) === method,
  );
}

/**
 * Every string literal inside a type.
 *
 * Used on the first parameter of an overload, so that an event name written as
 * a bare literal and one written inside a union are both found.
 *
 * @param type - The type to search, or `undefined` for an untyped parameter.
 * @returns The literal strings it contains.
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
 * The event names one declared method accepts, with the number of arguments its
 * handler is declared to receive for each.
 *
 * The `this` parameter is not an argument and is left out, which is what makes
 * the count comparable with the payload tuple on the facade's event map.
 *
 * @param interfaceName - The interface to look in.
 * @param method - The subscription method: `on`, `once` or `one`.
 * @returns Handler arity by event name. An overload that names several events
 * at once — the space separated form — contributes nothing, having no single
 * event's payload to describe.
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

/**
 * The members of a type alias that is a union of string literals.
 *
 * @param name - The alias name, e.g. `ElevatorEventName`.
 * @returns The strings it is a union of.
 * @throws If the declaration file has no such alias.
 */
function declaredUnion(name: string): Set<string> {
  for (const statement of namespaceStatements()) {
    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === name) {
      return new Set(stringLiteralsIn(statement.type));
    }
  }
  throw new Error(`${DECLARATION_PATH} declares no type ${name}`);
}

/**
 * The event map a facade declares, read out of its source.
 *
 * The map is a type, so it is gone by run time; the source is where it can
 * still be asked what the events are and how many arguments each carries.
 *
 * @param file - The facade's file name under `src/game`.
 * @param alias - The event map's type alias, e.g. `ElevatorInterfaceEvents`.
 * @returns Payload length by event name.
 * @throws If the alias is missing or is no longer a plain object type, either
 * of which means this test is reading the wrong thing and should say so.
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
 * Every name player code can reach on a facade.
 *
 * The walk `elevator-interface.test.ts`, `floor-interface.test.ts` and
 * `completions.test.ts` all use: own properties first, then up the prototype
 * chain, so an instance field like `destinationQueue` is counted alongside the
 * methods. `getOwnPropertyNames` reads descriptors, so the floor's
 * `buttonStates` getter is found without being invoked, and `#private` members
 * are invisible to it — which is precisely the line between what player code
 * can reach and what it cannot.
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
 * A live elevator facade, built the way `elevator-interface.test.ts` does.
 *
 * @returns The facade.
 */
function elevatorFacade(): ElevatorInterface {
  return new ElevatorInterface(
    new Elevator(1.5, 4, 40),
    createFloors(4, 40, () => undefined),
    () => undefined,
  );
}

/**
 * A live floor facade, built the way `floor-interface.test.ts` does.
 *
 * @returns The facade.
 */
function floorFacade(): FloorInterface {
  return new FloorInterface(new Floor(2, 100, () => undefined), () => undefined);
}

/** Names sorted, so a failure reads as a set difference rather than a shuffle. */
function sorted(names: Iterable<string>): string[] {
  return [...names].sort((left, right) => left.localeCompare(right));
}

/**
 * A program that uses every member the declaration publishes.
 *
 * Its job is to pin the *types*: names are compared above, but a return type
 * only exists once something depends on it, so every call here lands in a
 * position that constrains what it may return — a `@type` annotation, an
 * arithmetic operator, a string method that only one of the possible return
 * types has. The test below refuses to pass unless every declared member
 * appears in this text, so a member added to the declaration has to be
 * exercised here before the suite goes green again.
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
 *
 * Every line marked `// error` is expected to be reported, and every line that
 * is not marked is expected to be clean — so a declaration that has quietly
 * become `any`, or one that started rejecting something legitimate, fails here
 * either way. The lines are one statement each because a diagnostic is compared
 * by line number.
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
 * The one program in the README that a player is told to start from.
 *
 * Found by content rather than by position: the README is prose that gets
 * rearranged, and a heading or a section order is a weaker anchor than the
 * annotation that makes the example work. Extracting it, rather than keeping a
 * copy here, is what makes the two tests below statements about the README
 * itself — that what it prints compiles, and that the game will load it.
 *
 * @returns The example, exactly as the README prints it.
 * @throws If no fenced JavaScript block in the README carries the annotation,
 * which means the instructions have changed shape and this test is now
 * measuring nothing.
 */
function readmeExample(): string {
  const readme = readFileSync(README_PATH, "utf8");
  for (const [, block = ""] of readme.matchAll(/```js\n([\s\S]*?)```/g)) {
    if (block.includes("@type {ElevatorSaga.Solution}")) {
      return block;
    }
  }
  throw new Error(
    "No fenced js block in README.md is annotated with @type {ElevatorSaga.Solution}; " +
      "the declaration file's instructions are not being checked by anything.",
  );
}

/** Where the fixtures are written for the compiler to read. */
const workingDirectory = mkdtempSync(join(tmpdir(), "elevatorsaga-declarations-"));

afterAll(() => {
  rmSync(workingDirectory, { recursive: true, force: true });
});

/**
 * Compiles the declaration file together with some player programs.
 *
 * One program per file, all in one compilation, because building a TypeScript
 * program is the expensive part and the declaration is the only thing they
 * share.
 *
 * @param programs - Player programs, by the file name to give each.
 * @returns Every diagnostic, grouped by the file name it was reported against.
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

/**
 * One diagnostic, as a line the failure output can be read from.
 *
 * @param diagnostic - What the compiler reported.
 * @returns Its line number, if it has one, and its message.
 */
function describeDiagnostic(diagnostic: ts.Diagnostic): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
  if (diagnostic.file === undefined || diagnostic.start === undefined) {
    return message;
  }
  const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return `line ${String(line + 1)}: ${message}`;
}

/**
 * The lines of a file that a set of diagnostics were reported against.
 *
 * @param diagnostics - What the compiler reported for one file.
 * @returns The 1-based line numbers, sorted, without repeats.
 */
function reportedLines(diagnostics: readonly ts.Diagnostic[]): number[] {
  const lines = new Set<number>();
  for (const diagnostic of diagnostics) {
    if (diagnostic.file !== undefined && diagnostic.start !== undefined) {
      lines.add(diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1);
    }
  }
  return [...lines].sort((left, right) => left - right);
}

/**
 * The lines of a fixture that say they expect to be reported.
 *
 * @param source - The fixture.
 * @returns The 1-based line numbers carrying {@link ERROR_MARKER}.
 */
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
  "readme.js": readmeExample(),
});

/**
 * What the compiler said about one fixture.
 *
 * @param name - The fixture's file name.
 * @returns Its diagnostics.
 */
function diagnosticsFor(name: string): ts.Diagnostic[] {
  return compiled.get(join(workingDirectory, name)) ?? [];
}

describe("the members the declaration file publishes", () => {
  it("declares every member the elevator facade hands player code", () => {
    // Failing here means ElevatorInterface grew a member that players will not
    // see in their editor, and whose misuse their editor will report as a
    // mistake. Declare it in public/elevatorsaga.d.ts, with the sentence from
    // its JSDoc, and exercise it in EXERCISING_PROGRAM above.
    expect(sorted(exposedNames(elevatorFacade()))).toEqual(sorted(declaredMembers("Elevator")));
  });

  it("declares every member the floor facade hands player code", () => {
    expect(sorted(exposedNames(floorFacade()))).toEqual(sorted(declaredMembers("Floor")));
  });

  it("gives every member the type the facade gives it", () => {
    // The two tests above compare names, and the fixtures below pin the types
    // the declaration states — but only against themselves. Neither notices a
    // facade member whose *type* moves under the declaration: a facade
    // `goToFloor` that grows a third argument, or an `isApproachingFloor` whose
    // answer widens, leaves a shipped declaration that is wrong about the game
    // and internally consistent, which is the worst shape a lie can take.
    //
    // The comparison is textual, and that is the point: these two files are
    // written independently, so agreeing on `(floorNum: number, forceNow?:
    // boolean): void` down to the spelling is a real statement about them.
    // Renaming a type on either side therefore fails here, and the fix is to
    // rename it on both — which is the outcome wanted anyway.
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
    // The names above are compared without regard to type. This is what makes
    // the types matter: a member has to appear in the program that gets
    // compiled, in a position that depends on what it returns.
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
    // An overload per subscription method per event, each handing the handler
    // as many arguments as the facade's event map declares. A handler told to
    // expect one argument for an event that carries two is a wrong API stated
    // precisely, which is the worst kind.
    //
    // `off` is in this list because unregistering takes the handler that was
    // registered, so its overloads carry the same parameters as `on`'s and can
    // drift apart from them. They did: before this file grew that check, `off`
    // was one signature typed for the multi-event form, and
    // `elevator.off("floor_button_pressed", remember)` was reported as a type
    // error in the player's editor. `documentation.html` does not print that
    // call: it prints the `on` half, and says that removing a handler needs a
    // reference to it. The three calls it does print under `off` would not have
    // caught this — they pass no handler, or one declaring no parameters, and
    // either survives a single signature — so EXERCISING_PROGRAM carries the
    // call that does. Measured by putting the drift back, as one signature
    // taking `ElevatorEventName | MultipleEvents<ElevatorEventName>`: this test
    // fails, and so does "accepts a program that uses the whole API". Not
    // "rejects each mistake, and only those" — its one `off` case is
    // `off("*", function () {})`, which the wildcard overload refuses either
    // way, so the mistakes fixture is no guard against this at all.
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
    // `trigger` is published surface, because the legacy facade was a riot
    // observable, so its argument lists are part of the contract too. The
    // event name is the first argument here, hence the extra one.
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
    // Read off `UserCodeObject`, which is what `WorldController.start` calls:
    // `init(elevators, floors)` and `update(dt, elevators, floors)`. A player
    // whose editor accepted a two-argument `update` would find out from the
    // game.
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
    // `skipLibCheck` is off, so this is the declaration's own contents rather
    // than anything that uses them.
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

describe("the instructions the README gives", () => {
  it("prints an example the compiler accepts", () => {
    expect(diagnosticsFor("readme.js").map(describeDiagnostic)).toEqual([]);
  });

  it("prints an example the game will load", () => {
    // The trap this closes: the game's loader only wraps a program in
    // parentheses when it starts with `{` and ends with `}`, so an example with
    // a `/** @type ... */` or `/// <reference ... />` line above a bare object
    // literal is evaluated as a block, and dies with `SyntaxError: Function
    // statements require a function name`. An annotated example has to keep its
    // own parentheses, and this is what notices when it stops doing so.
    const solution = getCodeObjFromCode(readmeExample());
    expect(typeof solution.init).toBe("function");
    expect(typeof solution.update).toBe("function");
  });

  it("prints the compiler options these fixtures were compiled with", () => {
    // The README tells a player four options and this file compiles with four
    // options; if they were allowed to differ, this whole file would be
    // measuring a configuration nobody has.
    const readme = readFileSync(README_PATH, "utf8");
    for (const [option, value] of Object.entries(PLAYER_COMPILER_OPTIONS)) {
      expect(readme, option).toContain(`"${option}": ${String(value)}`);
    }
  });

  it("says where the declaration is served from once the site is built", () => {
    const readme = readFileSync(README_PATH, "utf8");
    expect(readme).toContain("public/elevatorsaga.d.ts");
    expect(readme).toContain("elevatorsaga.d.ts");
  });
});
