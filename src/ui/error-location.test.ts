import { describe, expect, it } from "vitest";

import { getCodeObjFromCode } from "../game/user-code.ts";
import { locateCodeError } from "./error-location.ts";

/** Runs a program the way the game does and returns what it threw. */
function thrownBy(code: string, elevators: readonly unknown[] = []): unknown {
  try {
    getCodeObjFromCode(code).update(0.1, elevators as never, []);
  } catch (error: unknown) {
    return error;
  }
  throw new Error("The program was expected to throw and did not");
}

const MULTI_LINE = [
  "{",
  "  init: function (elevators, floors) {},",
  "  update: function (dt, elevators, floors) {",
  "    missingHelper();",
  "  },",
  "}",
].join("\n");

const CALLS_THE_ENGINE = [
  "{",
  "  init: function (elevators, floors) {},",
  "  update: function (dt, elevators, floors) {",
  "    elevators[0].goToFloor(7);",
  "  },",
  "}",
].join("\n");

const ONE_LINE = "{ init: function () {}, update: function () { missingHelper(); } }";

const UNWRAPPED =
  "(function () { return { init: function () {}, update: function () { missingHelper(); } }; })()";

/** {@link CALLS_THE_ENGINE}, padded to 66 lines so an engine-bundle line number lands inside it. */
const LONG_PROGRAM = [
  "{",
  "  init: function (elevators, floors) {},",
  ...Array.from({ length: 60 }, () => "  // a line of the player's own"),
  "  update: function (dt, elevators, floors) {",
  "    elevators[0].goToFloor(7);",
  "  },",
  "}",
].join("\n");

/** A stack in the shape V8 writes, for the cases a real throw cannot produce. */
function v8Stack(...frames: readonly string[]): { readonly stack: string } {
  return { stack: ["ReferenceError: missingHelper is not defined", ...frames].join("\n") };
}

/** Builds an error shaped like JavaScriptCore's, transcribed from real `jsc` runs since Vitest runs on V8. */
function jscError(fields: {
  readonly line?: unknown;
  readonly column?: unknown;
  readonly sourceURL?: string;
  readonly stack: string;
}): object {
  return { message: "missingHelper is not defined", ...fields };
}

describe("locateCodeError, on the program form", () => {
  const PROGRAM = [
    "const PARK = 0;",
    "",
    "function init(elevators, floors) {}",
    "",
    "function update(dt, elevators, floors) {",
    "  missingHelper();",
    "}",
  ].join("\n");

  it("points at the line of the program that threw", () => {
    expect(locateCodeError(thrownBy(PROGRAM), PROGRAM)).toEqual({ line: 6, column: 3 });
  });

  it("points inside a top-level helper, not at the line that called it", () => {
    const withHelper = [
      "function helper() {",
      "  missingHelper();",
      "}",
      "",
      "function init(elevators, floors) {}",
      "function update(dt, elevators, floors) { helper(); }",
    ].join("\n");

    expect(locateCodeError(thrownBy(withHelper), withHelper)).toEqual({ line: 2, column: 3 });
  });

  it("takes the wrapper it was compiled in back off the first line", () => {
    const oneLine = "function init() {} function update() { missingHelper(); }";

    expect(locateCodeError(thrownBy(oneLine), oneLine)).toEqual({
      line: 1,
      column: oneLine.indexOf("missingHelper(") + 1,
    });
  });

  it("points at the player's line when the throw happened inside the game", () => {
    const callsTheEngine = [
      "function init(elevators, floors) {}",
      "function update(dt, elevators, floors) {",
      "  elevators[0].goToFloor(7);",
      "}",
    ].join("\n");
    const elevator = {
      goToFloor(floor: number): never {
        throw new Error(`Cannot go to floor ${String(floor)}`);
      },
    };

    expect(locateCodeError(thrownBy(callsTheEngine, [elevator]), callsTheEngine)).toEqual({
      line: 3,
      column: 16,
    });
  });
});

describe("locateCodeError", () => {
  it("points at the line of the program that threw", () => {
    expect(locateCodeError(thrownBy(MULTI_LINE), MULTI_LINE)).toEqual({ line: 4, column: 5 });
  });

  it("points at the player's line when the throw happened inside the game", () => {
    const elevator = {
      goToFloor(floor: number): never {
        throw new Error(`Cannot go to floor ${String(floor)}`);
      },
    };

    // Column 18 is `goToFloor` itself — a member call's frame records the call site, not the statement start.
    expect(locateCodeError(thrownBy(CALLS_THE_ENGINE, [elevator]), CALLS_THE_ENGINE)).toEqual({
      line: 4,
      column: 18,
    });
  });

  it("points inside the player's own helper, not at the line that called it", () => {
    const withHelper = [
      "(function () {",
      "  function helper() {",
      "    missingHelper();",
      "  }",
      "  return { init: function () {}, update: function () { helper(); } };",
      "})()",
    ].join("\n");

    expect(locateCodeError(thrownBy(withHelper), withHelper)).toEqual({ line: 3, column: 5 });
  });

  it("takes the parenthesis it was compiled with back off the first line", () => {
    expect(locateCodeError(thrownBy(ONE_LINE), ONE_LINE)).toEqual({
      line: 1,
      column: ONE_LINE.indexOf("missingHelper(") + 1,
    });
  });

  it("leaves the first line alone when the program was compiled unwrapped", () => {
    expect(locateCodeError(thrownBy(UNWRAPPED), UNWRAPPED)).toEqual({
      line: 1,
      column: UNWRAPPED.indexOf("missingHelper(") + 1,
    });
  });

  it("walks out of a string the player evaluated, to the line that evaluated it", () => {
    const nesting = [
      "{",
      "  init: function (elevators, floors) {},",
      "  update: function (dt, elevators, floors) {",
      '    eval("\\n\\n\\n\\n\\n\\n\\n\\n\\n\\n\\nmissingHelper();");',
      "  },",
      "}",
    ].join("\n");

    expect(locateCodeError(thrownBy(nesting), nesting)).toEqual({ line: 4, column: 5 });
  });

  it("says nothing about a syntax error, which never ran to have a line", () => {
    let thrown: unknown;
    try {
      getCodeObjFromCode("{ init: function ( }");
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(SyntaxError);
    expect(locateCodeError(thrown, "{ init: function ( }")).toBeUndefined();
  });

  it("says nothing about a program rejected for having no init", () => {
    let thrown: unknown;
    try {
      getCodeObjFromCode("{ update: function () {} }");
    } catch (error: unknown) {
      thrown = error;
    }

    expect(locateCodeError(thrown, "{ update: function () {} }")).toBeUndefined();
  });

  it("reads the position Firefox writes", () => {
    const stack = {
      stack: [
        "update@http://localhost:5173/src/game/user-code.ts line 24 > eval:4:5",
        "@http://localhost:5173/src/game/world-controller.ts:118:22",
      ].join("\n"),
    };

    expect(locateCodeError(stack, MULTI_LINE)).toEqual({ line: 4, column: 5 });
  });

  it("takes the innermost position of a frame that names more than one", () => {
    const stack = {
      stack: "update@http://localhost:5173/src/game/user-code.ts line 24 > eval line 2 > eval:3:7",
    };

    expect(locateCodeError(stack, MULTI_LINE)).toEqual({ line: 3, column: 7 });
  });

  it("reads the position Safari writes on the error rather than in the frame", () => {
    // JavaScriptCore marks a call at its opening parenthesis (column 18); V8 marks the name (column 5).
    const error = jscError({ line: 4, column: 18, stack: "update@\nglobal code@/game.js:39:15" });

    expect(locateCodeError(error, MULTI_LINE)).toEqual({ line: 4, column: 18 });
  });

  it("takes the parenthesis back off the first line for Safari too", () => {
    const error = jscError({ line: 1, column: 61, stack: "update@\nglobal code@/game.js:42:15" });

    expect(locateCodeError(error, ONE_LINE)).toEqual({
      line: 1,
      column: ONE_LINE.indexOf("(", ONE_LINE.indexOf("missingHelper")) + 1,
    });
  });

  it("says nothing when Safari names the file the throw came out of", () => {
    // A shorter fixture would pass even without the sourceURL check.
    const error = jscError({
      line: 24,
      column: 59,
      sourceURL: "/game.js",
      stack: "goToFloor@/game.js:24:59\nupdate@\nglobal code@/game.js:26:15",
    });

    expect(locateCodeError(error, LONG_PROGRAM)).toBeUndefined();
  });

  it("says nothing about a Safari syntax error, which points at the game's eval", () => {
    const error = jscError({
      line: 29,
      column: 15,
      sourceURL: "/game.js",
      stack: "eval@[native code]\nglobal code@/game.js:29:15",
    });

    expect(locateCodeError(error, LONG_PROGRAM)).toBeUndefined();
  });

  it("says nothing about a line Safari counted in a string the player evaluated", () => {
    // JavaScriptCore frames carry no position to fall back to, so an out-of-range line can only be refused.
    const error = jscError({
      line: 12,
      column: 14,
      stack: "eval code@\neval@[native code]\nupdate@\nglobal code@/game.js:50:15",
    });

    expect(locateCodeError(error, MULTI_LINE)).toBeUndefined();
  });

  it("prefers a position from the stack to one on the error", () => {
    // No real engine writes both; this pins the precedence: the stack wins over a bare number on the error.
    const both = {
      ...v8Stack("    at Object.update (eval at x (a.ts:1:1), <anonymous>:4:5)"),
      line: 2,
      column: 3,
    };

    expect(locateCodeError(both, MULTI_LINE)).toEqual({ line: 4, column: 5 });
  });

  it("ignores a position on the error that is not a pair of whole numbers", () => {
    for (const position of [
      { line: 0, column: 1 },
      { line: 4, column: 0 },
      { line: 3.5, column: 1 },
      { line: Number.POSITIVE_INFINITY, column: 1 },
      { line: Number.NaN, column: 1 },
      // Paired with a valid line, isolating the column check.
      { line: 4, column: 1.5 },
      { line: 4, column: Number.POSITIVE_INFINITY },
      { line: 4, column: Number.NaN },
      { line: "4", column: "18" },
      { column: 18 },
      { line: 4 },
    ]) {
      expect(
        locateCodeError(jscError({ ...position, stack: "update@" }), MULTI_LINE),
      ).toBeUndefined();
    }
  });

  it("reads a position off an error that carries no stack at all", () => {
    // Guards against an empty stack short-circuiting before this fallback runs.
    expect(locateCodeError({ line: 4, column: 18 }, MULTI_LINE)).toEqual({ line: 4, column: 18 });
  });

  it("survives an error whose position throws when it is read", () => {
    const hostile = {
      stack: "update@",
      get line(): number {
        throw new Error("no line for you");
      },
      column: 18,
    };

    expect(locateCodeError(hostile, MULTI_LINE)).toBeUndefined();
  });

  it("ignores the position where the game called eval, in favor of the player's", () => {
    const stack = v8Stack(
      "    at Object.update (eval at getCodeObjFromCode " +
        "(http://localhost:5173/src/game/user-code.ts:49:15), <anonymous>:4:5)",
    );

    expect(locateCodeError(stack, MULTI_LINE)).toEqual({ line: 4, column: 5 });
  });

  it("says nothing when no frame belongs to the player's program", () => {
    const stack = v8Stack(
      "    at WorldController.tick (http://localhost:5173/src/game/world-controller.ts:118:22)",
      "    at http://localhost:5173/src/pages/game/index.ts:305:19",
    );

    expect(locateCodeError(stack, MULTI_LINE)).toBeUndefined();
  });

  it("says nothing when the frame names no position", () => {
    expect(locateCodeError(v8Stack("    at eval (<anonymous>)"), MULTI_LINE)).toBeUndefined();
  });

  it("says nothing about a line the program does not have", () => {
    const stack = v8Stack("    at Object.update (eval at x (a.ts:1:1), <anonymous>:99:5)");

    expect(locateCodeError(stack, MULTI_LINE)).toBeUndefined();
  });

  it("treats a line of zero as the browser declining to say", () => {
    const stack = v8Stack("    at Object.update (eval at x (a.ts:1:1), <anonymous>:0:0)");

    expect(locateCodeError(stack, MULTI_LINE)).toBeUndefined();
  });

  it("survives everything a program can throw that is not an error", () => {
    for (const thrown of ["boom", 42, null, undefined, true, Symbol("boom"), { line: 3 }]) {
      expect(locateCodeError(thrown, MULTI_LINE)).toBeUndefined();
    }
  });

  it("survives a stack that is not a string, and one that is empty", () => {
    expect(locateCodeError({ stack: { line: 4 } }, MULTI_LINE)).toBeUndefined();
    expect(locateCodeError({ stack: "" }, MULTI_LINE)).toBeUndefined();
  });

  it("survives a stack that throws when it is read", () => {
    const hostile = {
      get stack(): string {
        throw new Error("no stack for you");
      },
    };

    expect(locateCodeError(hostile, MULTI_LINE)).toBeUndefined();
  });
});
