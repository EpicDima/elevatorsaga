import { afterEach, describe, expect, it } from "vitest";

import { describeError } from "./describe-error.ts";
import { DEFAULT_LOCALE, setLocale } from "#i18n/index.ts";

describe("describeError", () => {
  // Player code can throw literally anything, and whatever it throws is all
  // the player has to go on. None of these may come out as "[object Object]".
  it.each([
    ["a string", "plain string failure", "plain string failure"],
    ["a number", 42, "42"],
    ["null", null, "null"],
    ["undefined", undefined, "undefined"],
    ["a boolean", false, "false"],
    ["an empty string", "", "Thrown empty string"],
  ])("describes %s", (_name, thrown, expected) => {
    expect(describeError(thrown)).toBe(expected);
  });

  it("takes the headline off a stack and leaves the frames behind", () => {
    // A real V8 stack from a built bundle, abridged only in the number of
    // frames. Every one of them is a position inside the game's own compiled
    // JavaScript, which is what the banner must not show: the single frame that
    // belongs to the player is found by `locateCodeError` and drawn as the line
    // number beside this text.
    const error = new TypeError("elevator.goToFlor is not a function");
    error.stack = [
      "TypeError: elevator.goToFlor is not a function",
      "    at Object.init (eval at getCodeObjFromCode (http://localhost:4173/assets/index-C7pQ.js:41:2418), <anonymous>:2:14)",
      "    at http://localhost:4173/assets/index-C7pQ.js:41:9902",
      "    at WorldController.start (http://localhost:4173/assets/index-C7pQ.js:41:10233)",
    ].join("\n");

    expect(describeError(error)).toBe("TypeError: elevator.goToFlor is not a function");
  });

  it("keeps the headline of an Error subclass that named itself", () => {
    class ElevatorStuck extends Error {
      public override readonly name = "ElevatorStuck";
    }
    const error = new ElevatorStuck("stuck between floors");
    error.stack = "ElevatorStuck: stuck between floors\n    at update";
    expect(describeError(error)).toBe("ElevatorStuck: stuck between floors");
  });

  it("keeps a headline that is a class with no message", () => {
    // `new Error()` with nothing to say: V8 writes the bare class name, with no
    // colon after it, and that is still the whole of what is known.
    const error = new Error();
    error.stack = "Error\n    at Object.init (<anonymous>:2:14)";
    expect(describeError(error)).toBe("Error");
  });

  it("keeps a stack that is a headline and nothing else", () => {
    // What V8 writes when `Error.stackTraceLimit` is 0, and what a stack
    // assigned by hand often is. There is no newline to cut at, and the whole
    // string is the answer.
    const error = new Error("doors will not close");
    error.stack = "Error: doors will not close";
    expect(describeError(error)).toBe("Error: doors will not close");
  });

  it("ignores the carriage return of a stack that came from Windows", () => {
    const error = new Error("boom");
    error.stack = "Error: boom\r\n    at Object.init (<anonymous>:2:14)";
    expect(describeError(error)).toBe("Error: boom");
  });

  it("falls back to an Error that has no stack", () => {
    const error = new Error("boom");
    error.stack = "";
    expect(describeError(error)).toBe("Error: boom");
  });

  it("reads name and message when the stack begins with a frame", () => {
    // SpiderMonkey and JavaScriptCore write no headline at all -- their stacks
    // are frames from the first character -- so the first line is a piece of
    // the game's own machinery and must not be mistaken for the failure. The
    // error's own string conversion says the same thing V8's headline would.
    const firefox = new TypeError("elevator.goToFlor is not a function");
    firefox.stack = [
      "init@http://localhost:4173/assets/index-C7pQ.js line 41 > eval:2:14",
      "start@http://localhost:4173/assets/index-C7pQ.js:41:10233",
      "@http://localhost:4173/assets/index-C7pQ.js:41:9902",
    ].join("\n");
    expect(describeError(firefox)).toBe("TypeError: elevator.goToFlor is not a function");

    const safari = new TypeError("elevator.goToFlor is not a function");
    // Safari names the frame and stops: an `eval`ed frame carries no position
    // at all, and a top-level throw is reported as the anonymous `eval code`.
    safari.stack = "eval code@\nstart@http://localhost:4173/assets/index-C7pQ.js:41:10233";
    expect(describeError(safari)).toBe("TypeError: elevator.goToFlor is not a function");

    const v8Frame = new TypeError("elevator.goToFlor is not a function");
    // And the same again for a V8 stack whose headline has somehow been lost,
    // leaving an indented frame first.
    v8Frame.stack = "    at Object.init (<anonymous>:2:14)\n    at start (index.js:41:1)";
    expect(describeError(v8Frame)).toBe("TypeError: elevator.goToFlor is not a function");
  });

  it("ignores a stack that is not a stack, and says what else the object knows", () => {
    // Player code is free to hang a `stack` of its own on anything it throws.
    // A line that is not shaped like a headline is not shown as one; what the
    // object does have to say for itself is shown instead.
    expect(describeError({ stack: "somewhere in the lift shaft", message: "doors jammed" })).toBe(
      "doors jammed",
    );
    expect(describeError({ stack: "no idea, sorry", floor: 3 })).toBe(
      'Object {"stack":"no idea, sorry","floor":3}',
    );
  });

  it("uses a thrown object's own toString", () => {
    // What the legacy banner did: the object reached riot.render, which
    // concatenated it and so called its toString.
    expect(describeError({ toString: (): string => "ElevatorError: doors stuck" })).toBe(
      "ElevatorError: doors stuck",
    );
  });

  it("uses the message of an object that has one but no stack", () => {
    expect(describeError({ message: "no stack here" })).toBe("no stack here");
  });

  it("survives an object whose toString throws", () => {
    const error = {
      floor: 3,
      toString: (): string => {
        throw new Error("not today");
      },
    };
    expect(describeError(error)).toBe('Object {"floor":3}');
  });

  it("survives an object whose stack and message getters throw", () => {
    const error = {
      get stack(): string {
        throw new Error("no stack for you");
      },
      get message(): string {
        throw new Error("no message either");
      },
    };
    expect(describeError(error)).toBe("Object with keys: stack, message");
  });

  it("describes a bare object structurally rather than as [object Object]", () => {
    expect(describeError({ code: "E_STUCK", floor: 3 })).toBe(
      'Object {"code":"E_STUCK","floor":3}',
    );
    expect(describeError({})).toBe("Thrown Object with no message");
    // An array does have a useful string conversion of its own.
    expect(describeError([1, 2])).toBe("1,2");
    expect(describeError([{ floor: 3 }])).toBe('Array [{"floor":3}]');
  });

  it("survives a circular object and one with a null prototype", () => {
    const circular: Record<string, unknown> = { floor: 3 };
    circular["self"] = circular;
    expect(describeError(circular)).toBe("Object with keys: floor, self");

    const bare = Object.assign(Object.create(null) as object, { floor: 3 });
    expect(describeError(bare)).toBe('Object {"floor":3}');
  });
});

describe("the language the interface comes out in", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("translates the sentence around a thrown value without translating the value", () => {
    // `Object`, the property names and anything the player's own code produced
    // are their JavaScript, and stay exactly as they wrote it.
    setLocale("ru");
    const circular: Record<string, unknown> = { floor: 3 };
    circular["self"] = circular;

    expect(describeError("")).toBe("Брошена пустая строка");
    expect(describeError({})).toBe("Брошен Object без сообщения");
    expect(describeError(circular)).toBe("Object с ключами: floor, self");
    expect(describeError("TypeError: elevator.goToFloor is not a function")).toBe(
      "TypeError: elevator.goToFloor is not a function",
    );
  });
});
