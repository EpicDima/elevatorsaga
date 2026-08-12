import { describe, expect, it } from "vitest";

import { getCodeObjFromCode } from "../game/user-code.ts";
import { locateCodeError } from "./error-location.ts";

/**
 * Runs a program the way the game does and hands back what it threw.
 *
 * The stacks these produce are the real thing rather than strings written to
 * match the implementation, which is the whole point: a hand-written stack
 * proves the regular expression parses hand-written stacks.
 *
 * @param code - The program to compile and run.
 * @param elevators - What to pass as the elevator list, for programs that call
 * into it.
 * @returns Whatever the program threw.
 * @throws {Error} When the program does not throw, since a test that expected
 * one must not go on to assert against `undefined`.
 */
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

/**
 * The same program as {@link CALLS_THE_ENGINE}, padded out to 66 lines.
 *
 * Long enough that a line number belonging to the game's own bundle lands
 * inside it, which is what makes the checks against it mean anything: a
 * six-line program refuses a line of the engine because there is no such line,
 * not because it knew whose line it was.
 */
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

/**
 * Builds an error shaped the way JavaScriptCore shapes one.
 *
 * Vitest runs on V8, so the JavaScriptCore cases cannot be produced by throwing
 * the way the ones above are. The next best thing is transcription rather than
 * invention: every field below was read off a run of `jsc` -- the JavaScriptCore
 * shell inside the framework macOS ships, which is the engine Safari runs --
 * against these same program constants, and the numbers in the tests are what it
 * printed. The build was framework 21624.2.5.11.4 on macOS 26.5, that being the
 * bundle's version, since the shell has none of its own to ask for.
 * Its own properties for an error constructed in
 * evaluated code are exactly `message`, `line`, `column` and `stack`, in that
 * order, with `sourceURL` absent; one constructed in a file has `sourceURL`
 * between `column` and `stack`. The frames carry no position of their own, which
 * is why none of these stacks has one after the `@`.
 *
 * @param fields - The position, the stack, and the file when there is one.
 * @returns An object with those fields and a message, and nothing else.
 */
function jscError(fields: {
  readonly line?: unknown;
  readonly column?: unknown;
  readonly sourceURL?: string;
  readonly stack: string;
}): object {
  return { message: "missingHelper is not defined", ...fields };
}

describe("locateCodeError", () => {
  it("points at the line of the program that threw", () => {
    expect(locateCodeError(thrownBy(MULTI_LINE), MULTI_LINE)).toEqual({ line: 4, column: 5 });
  });

  it("points at the player's line when the throw happened inside the game", () => {
    // The frames above the player's are `goToFloor` and everything it called,
    // all of it the game's own code and none of it anything the player can
    // edit. The line worth showing is the one that made the call.
    const elevator = {
      goToFloor(floor: number): never {
        throw new Error(`Cannot go to floor ${String(floor)}`);
      },
    };

    // Column 18 is `goToFloor` itself rather than the start of the statement:
    // the frame records where the call was made from, which on a member call
    // is the member.
    expect(locateCodeError(thrownBy(CALLS_THE_ENGINE, [elevator]), CALLS_THE_ENGINE)).toEqual({
      line: 4,
      column: 18,
    });
  });

  it("points inside the player's own helper, not at the line that called it", () => {
    // Two frames of the program are on the stack, and the innermost is the one
    // that broke. Reading from the other end would send a player who factored
    // their program into functions to the call, every time, and the call is
    // the one line in the pair that is usually fine.
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
    // `{ ... }` is a block until the compiler wraps it, and the wrap lands on
    // line 1, so every column the browser reports for that line is one past
    // where the player's cursor has to go.
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
    // The inner frames count their lines in the inner string, where line 12
    // means something quite different. Reporting one of those would point at
    // another part of the program entirely, or at a line it has not got.
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
    // Thrown after the code was evaluated, from the game's own module, so no
    // frame is the player's -- and no single line is at fault either.
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
    // A defensive property of the pattern rather than a shape confirmed
    // against Firefox: the position a frame ends with is its own, whatever
    // chain of evaluations precedes it.
    const stack = {
      stack: "update@http://localhost:5173/src/game/user-code.ts line 24 > eval line 2 > eval:3:7",
    };

    expect(locateCodeError(stack, MULTI_LINE)).toEqual({ line: 3, column: 7 });
  });

  it("reads the position Safari writes on the error rather than in the frame", () => {
    // Column 18 is the opening parenthesis of `missingHelper(`, where V8 gives
    // 5 for the same throw: JavaScriptCore records a call at its parenthesis
    // and V8 at the start of the name. Both are on the line that broke, which
    // is what the mark is for, so the difference is left as it is.
    const error = jscError({ line: 4, column: 18, stack: "update@\nglobal code@/game.js:39:15" });

    expect(locateCodeError(error, MULTI_LINE)).toEqual({ line: 4, column: 18 });
  });

  it("takes the parenthesis back off the first line for Safari too", () => {
    // The position is a position in the compiled source whichever engine
    // reported it, so the wrap has to come off either way.
    const error = jscError({ line: 1, column: 61, stack: "update@\nglobal code@/game.js:42:15" });

    expect(locateCodeError(error, ONE_LINE)).toEqual({
      line: 1,
      column: ONE_LINE.indexOf("(", ONE_LINE.indexOf("missingHelper")) + 1,
    });
  });

  it("says nothing when Safari names the file the throw came out of", () => {
    // Line 24 is a line of the game, and the program it is offered against is
    // 66 lines long, so line 24 of that exists and is a comment. This is the
    // whole of what `sourceURL` is checked for: refusing the ones out of range
    // would look like it worked, right up until a player wrote enough code.
    const error = jscError({
      line: 24,
      column: 59,
      sourceURL: "/game.js",
      stack: "goToFloor@/game.js:24:59\nupdate@\nglobal code@/game.js:26:15",
    });

    expect(locateCodeError(error, LONG_PROGRAM)).toBeUndefined();
  });

  it("says nothing about a Safari syntax error, which points at the game's eval", () => {
    // The same discriminator doing the same work. Line 29 is where the game
    // called `eval`, which is where every program that fails to parse is
    // reported, and it is inside this one.
    const error = jscError({
      line: 29,
      column: 15,
      sourceURL: "/game.js",
      stack: "eval@[native code]\nglobal code@/game.js:29:15",
    });

    expect(locateCodeError(error, LONG_PROGRAM)).toBeUndefined();
  });

  it("says nothing about a line Safari counted in a string the player evaluated", () => {
    // The recorded case: line 12 of the inner string, on a program with six
    // lines. V8 walks out of this to the frame that called `eval`, because it
    // has one; JavaScriptCore's frames carry no positions, so the range check
    // is all there is, and refusing is where it ends.
    const error = jscError({
      line: 12,
      column: 14,
      stack: "eval code@\neval@[native code]\nupdate@\nglobal code@/game.js:50:15",
    });

    expect(locateCodeError(error, MULTI_LINE)).toBeUndefined();
  });

  it("prefers a position from the stack to one on the error", () => {
    // No engine writes both -- V8 and SpiderMonkey leave the error bare, and
    // JavaScriptCore leaves the frames bare -- so this fixes the order rather
    // than describing a browser. The stack wins because it is a list that can
    // be walked past the game's frames and out of a nested evaluation, where a
    // number on the error is whatever it is.
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
      // The column is checked the same way as the line and needs its own cases
      // to prove it: paired with a line that is perfectly good, so nothing but
      // the column can be what rejects them.
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
    // The stack walk runs first, and it must not be what decides whether the
    // fallback runs at all: returning early when there is nothing to walk would
    // switch the whole JavaScriptCore branch off. Every real JavaScriptCore
    // error does carry a stack, so what a player reaches this way is throwing
    // an object of their own with these fields on it. The point of the test is
    // the structure -- the two sources are consulted independently -- rather
    // than the case.
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

  it("ignores the position where the game called eval, in favour of the player's", () => {
    // The first pair of numbers on a V8 eval frame is the game's own call
    // site. It is the same for every error any program can raise, so reporting
    // it would send every player to the same line of a file they cannot see.
    const stack = v8Stack(
      "    at Object.update (eval at getCodeObjFromCode " +
        "(http://localhost:5173/src/game/user-code.ts:49:15), <anonymous>:4:5)",
    );

    expect(locateCodeError(stack, MULTI_LINE)).toEqual({ line: 4, column: 5 });
  });

  it("says nothing when no frame belongs to the player's program", () => {
    const stack = v8Stack(
      "    at WorldController.tick (http://localhost:5173/src/game/world-controller.ts:118:22)",
      "    at http://localhost:5173/src/app/app.ts:305:19",
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
    // Player code can throw an object of its own making, and reading a
    // property of it runs the player's getter.
    const hostile = {
      get stack(): string {
        throw new Error("no stack for you");
      },
    };

    expect(locateCodeError(hostile, MULTI_LINE)).toBeUndefined();
  });
});
