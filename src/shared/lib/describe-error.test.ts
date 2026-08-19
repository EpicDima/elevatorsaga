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

  it("prefers the stack of an Error subclass", () => {
    class ElevatorStuck extends Error {}
    const error = new ElevatorStuck("stuck between floors");
    error.stack = "ElevatorStuck: stuck between floors\n    at update";
    expect(describeError(error)).toBe(error.stack);
  });

  it("falls back to an Error that has no stack", () => {
    const error = new Error("boom");
    error.stack = "";
    expect(describeError(error)).toBe("Error: boom");
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
