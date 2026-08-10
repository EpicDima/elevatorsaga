import { describe, expect, it } from "vitest";

import { getCodeObjFromCode } from "./user-code.ts";

const testCode = "{init: function init() {}, update: function update() {}}";

describe("getCodeObjFromCode", () => {
  it("handles trailing whitespace", () => {
    expect(getCodeObjFromCode(testCode + "\n")).toBeInstanceOf(Object);
  });

  it("handles prefix whitespace", () => {
    expect(getCodeObjFromCode("\n" + testCode)).toBeInstanceOf(Object);
  });

  it("handles prefix and trailing whitespace", () => {
    expect(getCodeObjFromCode("\n" + testCode + "\n")).toBeInstanceOf(Object);
  });

  it("returns an object whose init and update are callable", () => {
    const codeObj = getCodeObjFromCode(
      "{init: function(elevators, floors) { this.seen = [elevators, floors]; }," +
        " update: function(dt, elevators, floors) { this.dt = dt; }}",
    );
    expect(typeof codeObj.init).toBe("function");
    expect(typeof codeObj.update).toBe("function");
    expect(() => {
      codeObj.init([], []);
    }).not.toThrow();
    expect(() => {
      codeObj.update(0.1, [], []);
    }).not.toThrow();
  });

  it("accepts an already-parenthesised expression", () => {
    expect(getCodeObjFromCode(`(${testCode})`)).toBeInstanceOf(Object);
  });

  it("accepts code that builds the object some other way", () => {
    const codeObj = getCodeObjFromCode(
      "(function() { var o = {}; o.init = function() {}; o.update = function() {}; return o; })()",
    );
    expect(typeof codeObj.init).toBe("function");
  });

  it("rejects code without an init function", () => {
    expect(() => getCodeObjFromCode("{update: function update() {}}")).toThrow(
      "Code must contain an init function",
    );
  });

  it("rejects code without an update function", () => {
    expect(() => getCodeObjFromCode("{init: function init() {}}")).toThrow(
      "Code must contain an update function",
    );
  });

  it("rejects an init that is not a function", () => {
    expect(() => getCodeObjFromCode("{init: 42, update: function update() {}}")).toThrow(
      "Code must contain an init function",
    );
  });

  it("rejects an update that is not a function", () => {
    expect(() => getCodeObjFromCode("{init: function init() {}, update: 42}")).toThrow(
      "Code must contain an update function",
    );
  });

  it("rejects code that evaluates to nothing", () => {
    expect(() => getCodeObjFromCode("null")).toThrow("Code must contain an init function");
  });

  it("lets syntax errors through", () => {
    expect(() => getCodeObjFromCode("{init: function(} }")).toThrow(SyntaxError);
  });
});
