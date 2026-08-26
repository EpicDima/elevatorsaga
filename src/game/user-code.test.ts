import { afterEach, describe, expect, it } from "vitest";

import { setLocale, DEFAULT_LOCALE } from "../i18n/index.ts";
import { firstLineColumnOffset, getCodeObjFromCode } from "./user-code.ts";
import type { UserCodeObject } from "./user-code.ts";

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
    ]) {
      expect(typeof getCodeObjFromCode(source).init, source).toBe("function");
    }
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
