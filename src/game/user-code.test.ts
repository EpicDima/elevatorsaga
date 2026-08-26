import { afterEach, describe, expect, it } from "vitest";

import { setLocale, DEFAULT_LOCALE } from "../i18n/index.ts";
import { createFrameRequester } from "./frame-requester.ts";
import { levels } from "./levels.ts";
import { firstLineColumnOffset, getCodeObjFromCode } from "./user-code.ts";
import type { UserCodeObject } from "./user-code.ts";
import { TICK_SECONDS, createWorldController } from "./world-controller.ts";
import { createWorld } from "./world.ts";

afterEach(() => {
  setLocale(DEFAULT_LOCALE);
});

/** The program form the game hands out: `init` and `update` declared at the top level. */
const PROGRAM = "function init(elevators, floors) {}\nfunction update(dt, elevators, floors) {}";

/** The object form the original game took, which every solution written for it still is. */
const OBJECT = "{init: function init() {}, update: function update() {}}";

/** Calls a compiled program the way the game does, as methods on the object it compiled to. */
function run(codeObj: UserCodeObject): void {
  codeObj.init([], []);
  codeObj.update(0.01, [], []);
}

/** What a program left behind on the object it compiled to, for the state-keeping tests. */
function readBack(codeObj: UserCodeObject, key: string): unknown {
  return (codeObj as unknown as Record<string, unknown>)[key];
}

describe("getCodeObjFromCode, on a program declaring init and update", () => {
  it("finds both functions", () => {
    const codeObj = getCodeObjFromCode(PROGRAM);

    expect(typeof codeObj.init).toBe("function");
    expect(typeof codeObj.update).toBe("function");
    expect(() => {
      run(codeObj);
    }).not.toThrow();
  });

  it("hands both the arguments the game gives them", () => {
    const codeObj = getCodeObjFromCode(
      "function init(elevators, floors) { this.seen = [elevators, floors]; }\n" +
        "function update(dt, elevators, floors) { this.dt = dt; }",
    );
    const elevators = [] as const;
    const floors = [] as const;
    codeObj.init(elevators, floors);
    codeObj.update(0.25, elevators, floors);

    expect(readBack(codeObj, "seen")).toEqual([elevators, floors]);
    expect(readBack(codeObj, "dt")).toBe(0.25);
  });

  it("takes a program with no update at all", () => {
    const codeObj = getCodeObjFromCode("function init(elevators, floors) {}");

    expect(typeof codeObj.init).toBe("function");
    // Substituted, so the world controller can call it every tick without checking.
    expect(typeof codeObj.update).toBe("function");
    expect(() => {
      run(codeObj);
    }).not.toThrow();
  });

  it("finds functions declared in either order", () => {
    const codeObj = getCodeObjFromCode(
      "function update(dt, elevators, floors) {}\nfunction init(elevators, floors) {}",
    );

    expect(typeof codeObj.init).toBe("function");
    expect(typeof codeObj.update).toBe("function");
  });

  it("shares top-level constants, variables and helpers between init and update", () => {
    const codeObj = getCodeObjFromCode(
      [
        "const PARK = 3;",
        "let ticks = 0;",
        "var legacy = 10;",
        "function score(n) { return n * 2; }",
        "const twice = (n) => score(n);",
        "class Plan { constructor(n) { this.n = n; } }",
        "function init(elevators, floors) { this.start = PARK + legacy + twice(new Plan(1).n); }",
        "function update(dt, elevators, floors) { ticks++; this.ticks = ticks; }",
      ].join("\n"),
    );
    codeObj.init([], []);
    codeObj.update(0.01, [], []);
    codeObj.update(0.01, [], []);

    expect(readBack(codeObj, "start")).toBe(15);
    expect(readBack(codeObj, "ticks")).toBe(2);
  });

  it("keeps state a program puts on this, the way the object form always could", () => {
    const codeObj = getCodeObjFromCode(
      "function init(elevators, floors) { this.count = 0; }\n" +
        "function update(dt, elevators, floors) { this.count++; }",
    );
    codeObj.init([], []);
    codeObj.update(0.01, [], []);
    codeObj.update(0.01, [], []);

    expect(readBack(codeObj, "count")).toBe(2);
  });

  it("takes init bound to a name rather than declared", () => {
    for (const source of [
      "const init = function (elevators, floors) {};",
      "const init = (elevators, floors) => {};",
      "var init = function (elevators, floors) {};",
      "let init = function (elevators, floors) {};",
    ]) {
      expect(typeof getCodeObjFromCode(source).init, source).toBe("function");
    }
  });

  it("takes update bound to a name rather than declared", () => {
    for (const tail of [
      "const update = function (dt) {};",
      "const update = (dt) => {};",
      "var update = function (dt) {};",
      "let update = function (dt) {};",
      "const update = function tick(dt) {};",
    ]) {
      const source = `function init() {}\n${tail}`;
      expect(typeof getCodeObjFromCode(source).update, tail).toBe("function");
    }
  });

  it("does not hand an arrow init the code object as its this", () => {
    // The wrapper is called, not constructed, and the player's source runs
    // sloppy, so an arrow's `this` is the page. Nothing to fix: a program keeps
    // its state in a top-level variable, which an arrow closes over anyway.
    const codeObj = getCodeObjFromCode(
      [
        "let seen = undefined;",
        "const init = () => { seen = this; };",
        "function update(dt) { this.seen = seen; }",
      ].join("\n"),
    );
    run(codeObj);

    expect(readBack(codeObj, "seen")).toBe(globalThis);
  });

  it("takes a program opening with a comment, a directive, or blank lines", () => {
    for (const opening of ['"use strict";', "// my solution", "/* my solution */", "", "\n\n"]) {
      const codeObj = getCodeObjFromCode(`${opening}\n${PROGRAM}`);

      expect(typeof codeObj.init, opening).toBe("function");
    }
  });

  it("takes a program ending with a comment", () => {
    expect(typeof getCodeObjFromCode(`${PROGRAM}\n// that is all`).init).toBe("function");
  });

  it("does not police what kind of function init is", () => {
    // Neither is sensible, but the loader has no business rejecting a callable.
    for (const source of ["async function init() {}", "function* init() {}"]) {
      expect(typeof getCodeObjFromCode(source).init, source).toBe("function");
    }
  });

  it("leaves nothing behind on the page", () => {
    const names = ["init", "update", "topLevelHelper", "TOP_LEVEL_CONSTANT"];
    getCodeObjFromCode(
      [
        "const TOP_LEVEL_CONSTANT = 1;",
        "function topLevelHelper() {}",
        "function init() {}",
        "function update() {}",
      ].join("\n"),
    );

    for (const name of names) {
      expect((globalThis as unknown as Record<string, unknown>)[name], name).toBeUndefined();
    }
  });

  it("gives each compile its own state, so one run cannot inherit the last one's", () => {
    const source = "let runs = 0;\nfunction init() { runs++; this.runs = runs; }";
    const first = getCodeObjFromCode(source);
    first.init([], []);
    const second = getCodeObjFromCode(source);
    second.init([], []);

    expect(readBack(first, "runs")).toBe(1);
    expect(readBack(second, "runs")).toBe(1);
  });

  it("runs top-level code once, at compile time, before init is ever called", () => {
    const codeObj = getCodeObjFromCode(
      "let built = 0;\nbuilt++;\nfunction init() { this.built = built; }",
    );
    codeObj.init([], []);

    expect(readBack(codeObj, "built")).toBe(1);
  });

  it("lets a throw from top-level code out, rather than reporting a missing init", () => {
    expect(() => getCodeObjFromCode("null.crash;\nfunction init() {}")).toThrow(TypeError);
  });

  it("takes source carrying the marks of the editor it was written in", () => {
    // A byte-order mark, Windows line endings, tabs, and a trailing blank line:
    // whatever a file dragged in from somewhere else brings with it.
    for (const source of [
      `\uFEFF${PROGRAM}`,
      PROGRAM.replace(/\n/g, "\r\n") + "\r\n",
      "function init(elevators, floors) {\n\tconst car = elevators[0];\n}",
      `${PROGRAM}\n   \n`,
    ]) {
      expect(typeof getCodeObjFromCode(source).init, JSON.stringify(source)).toBe("function");
    }
  });

  it("no longer needs the parentheses the object form does", () => {
    // The trap this replaces: a solution starting with a comment used to be read as a block.
    expect(() => getCodeObjFromCode(`// a comment first\n${PROGRAM}`)).not.toThrow();
  });
});

describe("getCodeObjFromCode, on the object form the original game took", () => {
  it("takes a bare object literal", () => {
    expect(getCodeObjFromCode(OBJECT)).toBeInstanceOf(Object);
  });

  it("handles whitespace around it", () => {
    expect(getCodeObjFromCode(OBJECT + "\n")).toBeInstanceOf(Object);
    expect(getCodeObjFromCode("\n" + OBJECT)).toBeInstanceOf(Object);
    expect(getCodeObjFromCode("\n" + OBJECT + "\n")).toBeInstanceOf(Object);
    expect(getCodeObjFromCode("   " + OBJECT + "   ")).toBeInstanceOf(Object);
  });

  it("returns an object whose init and update are callable", () => {
    const codeObj = getCodeObjFromCode(
      "{init: function(elevators, floors) { this.seen = [elevators, floors]; }," +
        " update: function(dt, elevators, floors) { this.dt = dt; }}",
    );

    expect(typeof codeObj.init).toBe("function");
    expect(typeof codeObj.update).toBe("function");
    expect(() => {
      run(codeObj);
    }).not.toThrow();
  });

  it("accepts an already-parenthesized expression", () => {
    expect(getCodeObjFromCode(`(${OBJECT})`)).toBeInstanceOf(Object);
  });

  it("accepts code that builds the object some other way", () => {
    for (const source of [
      "(function() { var o = {}; o.init = function() {}; o.update = function() {}; return o; })()",
      "Object.assign({}, {init: function() {}, update: function() {}})",
      "[{init: function() {}, update: function() {}}][0]",
      "{ get init() { return function () {}; }, update: function () {} }",
      "Object.create({init: function() {}, update: function() {}})",
    ]) {
      expect(typeof getCodeObjFromCode(source).init, source).toBe("function");
    }
  });

  it("accepts an object saved as a statement, semicolon and all", () => {
    // What an editor that formats on save leaves behind, and what the original
    // game answered with `SyntaxError: Function statements require a function name`.
    for (const source of [`${OBJECT};`, `${OBJECT};\n`, `${OBJECT} ;  `, `${OBJECT};;`]) {
      expect(typeof getCodeObjFromCode(source).init, JSON.stringify(source)).toBe("function");
    }
  });

  it("accepts a solution that is an instance rather than a literal", () => {
    // `init` and `update` on a prototype, not on the object itself, and state
    // on `this` across both: the class rewrite of an object-form solution.
    const codeObj = getCodeObjFromCode(
      [
        "new (class Solution {",
        "  init(elevators, floors) { this.count = 0; }",
        "  update(dt, elevators, floors) { this.count++; }",
        "})()",
      ].join("\n"),
    );
    run(codeObj);

    expect(readBack(codeObj, "count")).toBe(1);
  });

  it("accepts shorthand methods and arrow members", () => {
    expect(typeof getCodeObjFromCode("{ init() {}, update() {} }").init).toBe("function");
    expect(typeof getCodeObjFromCode("{ init: () => {}, update: () => {} }").init).toBe("function");
  });

  it("keeps this shared between init and update", () => {
    const codeObj = getCodeObjFromCode(
      "{ init: function () { this.count = 0; }, update: function () { this.count++; } }",
    );
    codeObj.init([], []);
    codeObj.update(0.01, [], []);

    expect(readBack(codeObj, "count")).toBe(1);
  });

  it("takes an object with no update, the way a program without one is taken", () => {
    const codeObj = getCodeObjFromCode("{init: function init() {}}");

    expect(typeof codeObj.update).toBe("function");
    expect(() => {
      run(codeObj);
    }).not.toThrow();
  });

  it("takes an object introduced by a comment, which used to be a syntax error", () => {
    // A solution pasted from elsewhere usually arrives with a line of prose above it.
    for (const source of [
      `// found on GitHub\n${OBJECT}`,
      `/* found on GitHub */\n${OBJECT}`,
      `/* two\n   lines */\n${OBJECT}`,
      `// one\n// two\n${OBJECT}`,
    ]) {
      expect(typeof getCodeObjFromCode(source).init, source).toBe("function");
    }
  });

  it("takes an object followed by a comment", () => {
    expect(typeof getCodeObjFromCode(`${OBJECT} // that is all`).init).toBe("function");
    expect(typeof getCodeObjFromCode(`${OBJECT}\n// that is all`).init).toBe("function");
  });

  it("takes an object whose helpers are nested inside init, as they had to be", () => {
    const codeObj = getCodeObjFromCode(
      [
        "{",
        "  init: function (elevators, floors) {",
        "    function nested(n) { return n + 1; }",
        "    this.value = nested(1);",
        "  },",
        "  update: function (dt, elevators, floors) {}",
        "}",
      ].join("\n"),
    );
    codeObj.init([], []);

    expect(readBack(codeObj, "value")).toBe(2);
  });
});

describe("getCodeObjFromCode, on what it refuses", () => {
  it("refuses a program with no init", () => {
    for (const source of [
      "function update(dt, elevators, floors) {}",
      "{update: function update() {}}",
      "const helper = function () {};",
      "null",
      "undefined",
      "42",
      '"a string"',
      "true",
      "[]",
      "({})",
      "",
      "   ",
      "\n\n",
      "// just thinking",
      "/* just thinking */",
    ]) {
      expect(() => getCodeObjFromCode(source), source).toThrow(
        "Code must contain an init function",
      );
    }
  });

  it("refuses an init that is not a function", () => {
    for (const source of [
      "{init: 42, update: function update() {}}",
      "const init = 42;",
      "{init: null}",
    ]) {
      expect(() => getCodeObjFromCode(source), source).toThrow(
        "Code must contain an init function",
      );
    }
  });

  it("refuses an update declared as something other than a function", () => {
    for (const source of [
      "{init: function init() {}, update: 42}",
      "function init() {}\nconst update = 42;",
      "{init: function init() {}, update: null}",
    ]) {
      expect(() => getCodeObjFromCode(source), source).toThrow(
        "Code declares update as something other than a function",
      );
    }
  });

  it("lets syntax errors through, in either form", () => {
    for (const source of [
      "{init: function(} }",
      "function init( {",
      "function init() { if (true { } }",
      "const = 5;",
    ]) {
      expect(() => getCodeObjFromCode(source), source).toThrow(SyntaxError);
    }
  });

  it("refuses in the language the page is in", () => {
    // The player reads this in the code status bar, so it follows the locale
    // rather than the module's import order: a message built once, when this
    // module was first imported, would be English for everybody.
    setLocale("ru");

    expect(() => getCodeObjFromCode("function update() {}")).toThrow(
      "В коде должна быть функция init",
    );
    expect(() => getCodeObjFromCode("function init() {}\nconst update = 42;")).toThrow(
      "В коде объявлен update, но это не функция",
    );
  });
});

/** Simulated milliseconds one driven frame advances by: the controller's own cap of 100 ticks. */
const FRAME_MILLISECONDS = 1000.0;

/** How far each of the two runs below is played. */
const RUN_SECONDS = 120.0;

/** The counters two runs have to agree on before they are the same run. */
interface RunTotals {
  readonly elapsedTime: number;
  readonly transportedCounter: number;
  readonly moveCount: number;
  readonly stopCount: number;
}

/**
 * Plays one program in the first level's building, on one seed, ignoring the level's own condition.
 * @throws When the program throws.
 */
function play(code: string): RunTotals {
  const level = levels[0];
  if (level === undefined) {
    throw new Error("levels[0] does not exist");
  }
  const codeObj = getCodeObjFromCode(code);
  const world = createWorld(level.options, "two-forms");
  const worldController = createWorldController(TICK_SECONDS);
  // Nothing draws these runs; only the counters are read.
  worldController.updatesDisplay = false;
  const frameRequester = createFrameRequester(FRAME_MILLISECONDS);
  let userCodeError: unknown = null;
  worldController.on("usercode_error", (error) => {
    userCodeError ??= error;
  });

  worldController.start(world, codeObj, frameRequester.register, true);
  while (world.elapsedTime < RUN_SECONDS && userCodeError === null) {
    frameRequester.trigger();
  }

  if (userCodeError !== null) {
    throw new Error("the program threw", { cause: userCodeError });
  }
  return {
    elapsedTime: world.elapsedTime,
    transportedCounter: world.transportedCounter,
    moveCount: world.moveCount,
    stopCount: world.stopCount,
  };
}

/** One dispatcher, written as a program: what it remembers between ticks lives in top-level bindings. */
const PROGRAM_DISPATCHER = [
  "const STEP = 1.5;",
  "let clock = 0;",
  "let next = 0;",
  "",
  "function init(elevators, floors) {",
  "    elevators[0].goToFloor(0);",
  "}",
  "",
  "function update(dt, elevators, floors) {",
  "    clock += dt;",
  "    if (clock < STEP) { return; }",
  "    clock = 0;",
  "    const elevator = elevators[0];",
  "    if (elevator.destinationQueue.length === 0) {",
  "        elevator.goToFloor(next);",
  "        next = (next + 1) % floors.length;",
  "    }",
  "}",
].join("\n");

/** The same dispatcher, written as the original game took it: what it remembers lives on `this`. */
const OBJECT_DISPATCHER = [
  "{",
  "    init: function (elevators, floors) {",
  "        this.step = 1.5;",
  "        this.clock = 0;",
  "        this.next = 0;",
  "        elevators[0].goToFloor(0);",
  "    },",
  "    update: function (dt, elevators, floors) {",
  "        this.clock += dt;",
  "        if (this.clock < this.step) { return; }",
  "        this.clock = 0;",
  "        var elevator = elevators[0];",
  "        if (elevator.destinationQueue.length === 0) {",
  "            elevator.goToFloor(this.next);",
  "            this.next = (this.next + 1) % floors.length;",
  "        }",
  "    }",
  "}",
].join("\n");

describe("the two forms, driving the same building", () => {
  it("runs one solution to the same simulation whichever form it is written in", () => {
    const asProgram = play(PROGRAM_DISPATCHER);
    const asObject = play(OBJECT_DISPATCHER);

    // Non-trivially: a dispatcher that never moved would match itself too.
    expect(asProgram.transportedCounter).toBeGreaterThan(0);
    expect(asProgram).toEqual(asObject);
  });
});

describe("firstLineColumnOffset", () => {
  it("reports what each wrapper adds to the first line", () => {
    // A program is opened with `(function(){`, a bare object literal with `(`, and an
    // expression that is already one is compiled as it stands.
    expect(firstLineColumnOffset(PROGRAM)).toBe("(function(){".length);
    expect(firstLineColumnOffset(OBJECT)).toBe(1);
    expect(firstLineColumnOffset(`(${OBJECT})`)).toBe(0);
  });

  it("reads past a leading comment, which shifts nothing by itself", () => {
    expect(firstLineColumnOffset(`// note\n${OBJECT}`)).toBe(1);
    expect(firstLineColumnOffset(`// note\n${PROGRAM}`)).toBe("(function(){".length);
  });

  it("is measured against where the engine says an error on the first line was", () => {
    // The round trip the offset exists for: subtracting it from a reported column
    // has to land on the character the player sees.
    const oneLiner = "function init() { missingHelper(); }";
    let column: number | undefined = undefined;
    try {
      getCodeObjFromCode(oneLiner).init([], []);
    } catch (error: unknown) {
      const stack = (error as { stack?: string }).stack ?? "";
      column = Number(/<anonymous>:1:(\d+)/.exec(stack)?.[1]);
    }

    expect(column).toBeDefined();
    expect((column ?? 0) - firstLineColumnOffset(oneLiner)).toBe(
      oneLiner.indexOf("missingHelper") + 1,
    );
  });
});
