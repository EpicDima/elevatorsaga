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

/** A stack in the shape V8 writes, for the cases a real throw cannot produce. */
function v8Stack(...frames: readonly string[]): { readonly stack: string } {
  return { stack: ["ReferenceError: missingHelper is not defined", ...frames].join("\n") };
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
