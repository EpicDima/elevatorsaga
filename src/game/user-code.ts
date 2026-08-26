/** Turns the source the player typed into the object that drives the elevators. */

import { t } from "../i18n/index.ts";
import type { UserCodeObject } from "./world-controller.ts";

export type { UserCodeObject } from "./world-controller.ts";

/** Indirect eval, running player source in global scope; executing it is the whole point of the game. */
// `globalThis.eval` is used instead of the `(0, eval)` idiom because that trips TypeScript's
// unused-comma-operand check.
const evaluate: (src: string) => unknown = globalThis.eval;

/** Leading whitespace and comments, which say nothing about the shape of what follows. */
const LEADING_TRIVIA = /^(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/;

/** Openings that are a declaration even though they also parse as an expression. */
const DECLARATION_START = /^(?:function|class|async)\b/;

/**
 * Opens the wrapper a program is compiled in, making its top-level declarations locals of one
 * function: `init` and `update` share them, and the next run replaces them instead of inheriting
 * them. Deliberately unbroken by a newline, so the player's first line stays line 1.
 */
const PROGRAM_PREFIX = "(function(){";

/** Closes {@link PROGRAM_PREFIX}, handing back whatever the program bound to the two names. */
const PROGRAM_SUFFIX =
  '\n;return{init:typeof init==="undefined"?undefined:init,' +
  'update:typeof update==="undefined"?undefined:update};})()';

/** Stands in for an `update` the program never declared; nothing says a solution needs per-tick work. */
const NO_UPDATE: UserCodeObject["update"] = () => undefined;

/** How a source has to be compiled: as one expression, or as a program declaring the two names. */
type CodeShape = "object" | "program";

/** The source with whatever it opens with that carries no meaning taken off the front. */
function significantStart(code: string): string {
  return code.replace(LEADING_TRIVIA, "");
}

/** Whether the whole source parses as a single expression. Compiles it without running it. */
function parsesAsExpression(code: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- compiled purely to see whether it parses, never called
    new Function(`return (${code}\n);`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Which shape a source reads as. Only a guess — {@link getCodeObjFromCode} tries the other one
 * when this shape yields no `init` — but an exact enough guess to say where the wrapper it names
 * moved the player's first line to.
 */
function shapeOf(code: string): CodeShape {
  const start = significantStart(code);
  return !DECLARATION_START.test(start) && parsesAsExpression(code) ? "object" : "program";
}

/** Whether the source opens with a bare `{`, which `eval` reads as a block rather than an object. */
function needsParentheses(code: string): boolean {
  return significantStart(code).startsWith("{");
}

/**
 * Columns the wrapper adds to the player's first line. Exported so a stack-trace column can be
 * translated back to what the player wrote without duplicating the wrapping rules. No line offset
 * has to be published beside it: neither wrapper breaks a line before the player's source.
 */
export function firstLineColumnOffset(code: string): number {
  if (shapeOf(code) === "program") {
    return PROGRAM_PREFIX.length;
  }
  return needsParentheses(code) ? 1 : 0;
}

/** The source wrapped for one shape. The trailing newline keeps a `//` comment off the closer. */
function wrapped(code: string, shape: CodeShape): string {
  if (shape === "program") {
    return PROGRAM_PREFIX + code + PROGRAM_SUFFIX;
  }
  return needsParentheses(code) ? `(${code}\n)` : code;
}

/** What one wrapper made of the source. */
type Attempt = { readonly value: unknown } | { readonly syntaxError: SyntaxError };

/**
 * Evaluates the source under one wrapper. A `SyntaxError` is handed back rather than thrown: the
 * source may simply be the other shape, and nothing has run when a wrapper fails to parse. Anything
 * else is the player's own top-level code throwing, and belongs to them.
 */
function attempt(code: string, shape: CodeShape): Attempt {
  try {
    return { value: evaluate(wrapped(code, shape)) };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { syntaxError: error };
    }
    throw error;
  }
}

/** Reads the two names off whatever a source evaluated to, without assuming it produced an object. */
function membersOf(value: unknown): Partial<UserCodeObject> {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    return {};
  }
  return value;
}

/**
 * The program's `update`, or a no-op when it declared none.
 * @throws {Error} A localized message when `update` is declared as something that cannot be called.
 */
function checkedUpdate(update: unknown): UserCodeObject["update"] {
  if (update === undefined) {
    return NO_UPDATE;
  }
  if (typeof update !== "function") {
    throw new Error(t("error.code.updateNotFunction"));
  }
  // The player's own function is handed straight back rather than wrapped: the game calls it as a
  // method, and a wrapper would take the `this` an object-literal solution keeps its state on.
  return update as UserCodeObject["update"];
}

/**
 * Compiles the player's source into a `{ init, update }` code object. Two forms are accepted: the
 * program this game hands out, which declares `init` and optionally `update` at the top level, and
 * the object literal the original game took, which every solution written for that one still is.
 *
 * @throws {SyntaxError} What the engine said, when the source parses as neither.
 * @throws {Error} A localized message, built at throw time, when there is no `init` to call.
 */
export function getCodeObjFromCode(code: string): UserCodeObject {
  const guess = shapeOf(code);
  let syntaxError: SyntaxError | undefined = undefined;
  let readable = false;
  for (const shape of [guess, guess === "program" ? "object" : "program"] as const) {
    const result = attempt(code, shape);
    if ("syntaxError" in result) {
      syntaxError ??= result.syntaxError;
      continue;
    }
    readable = true;
    const { init, update } = membersOf(result.value);
    if (typeof init === "function") {
      return { init, update: checkedUpdate(update) };
    }
  }
  // A syntax error only outranks the message below when neither shape could be read at all:
  // the source that read cleanly and simply declared no `init` is the one worth reporting on.
  if (!readable && syntaxError !== undefined) {
    throw syntaxError;
  }
  throw new Error(t("error.code.noInit"));
}
