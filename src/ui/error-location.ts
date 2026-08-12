/**
 * Works out which line of the player's own program an exception came from.
 *
 * The player's code is compiled with `eval`, so the engine has no file to name
 * for it and the browser's stack traces mark its frames as anonymous. That is
 * the only place a position can be recovered from: the thrown value itself
 * carries no line, and the game has no source map to consult. What this module
 * does is read the stack back.
 */

import { firstLineColumnOffset } from "../game/user-code.ts";

/**
 * A position in the player's program, as the editor counts them.
 *
 * Both numbers are 1-based, matching both the browser's stack traces and
 * CodeMirror's line numbers, so neither end has to convert.
 */
export interface CodeErrorLocation {
  /** The line, counting the first line of the program as 1. */
  readonly line: number;
  /** The column within that line, counting its first character as 1. */
  readonly column: number;
}

/**
 * Matches a V8 stack frame belonging to `eval`ed code.
 *
 * V8 writes such frames as
 * `at Object.update (eval at getCodeObjFromCode (http://host/user-code.ts:24:44), <anonymous>:6:5)`.
 * There are two positions in that, and only the second one is wanted: the first
 * says where in the game `eval` was called, which is the same place for every
 * error any program can possibly cause. What tells them apart is that the
 * frame's own position is the one introduced by `, <anonymous>:`, at the end;
 * the call site is a file and a line, and under a bundler it is a URL. The end
 * anchor is belt and braces on top of that -- a frame nesting several
 * `eval at` clauses reads
 * `at eval (eval at update (eval at compile (a.ts:1:1)), <anonymous>:3:1)`,
 * where V8 leaves the inner position out of the chain and the frame's own is
 * still last.
 */
const V8_EVAL_FRAME = /,\s*<anonymous>:(\d+):(\d+)\)$/;

/**
 * Matches a SpiderMonkey stack frame belonging to `eval`ed code.
 *
 * Firefox writes those as `update@http://host/user-code.ts line 24 > eval:6:5`.
 * Ordinary frames end in a plain URL position and never carry the `> eval`
 * marker, which is what keeps this from matching the game's own code. The end
 * anchor means a frame naming more than one such position -- which is how
 * SpiderMonkey has been reported to describe evaluation inside evaluation,
 * though no stack from it was to hand to confirm the spelling -- resolves to
 * the innermost, matching what the V8 pattern does with the same case.
 */
const SPIDERMONKEY_EVAL_FRAME = /> eval:(\d+):(\d+)$/;

/**
 * Reads the stack of a thrown value, if it has a usable one.
 *
 * @param error - Whatever the player's code threw.
 * @returns The stack, or `undefined` when there is none to read. Player code
 * can throw a number, a string, `null`, or an object whose `stack` is a getter
 * that throws in its turn, and none of those may take the game down.
 */
function stackOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  try {
    const stack: unknown = (error as Record<string, unknown>)["stack"];
    return typeof stack === "string" && stack !== "" ? stack : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Finds the position a single stack frame reports inside `eval`ed code.
 *
 * @param frame - One line of a stack trace, with its indentation removed.
 * @returns The position the frame reports, or `undefined` when the frame is not
 * `eval`ed code or names no position.
 */
function positionIn(frame: string): CodeErrorLocation | undefined {
  const match = V8_EVAL_FRAME.exec(frame) ?? SPIDERMONKEY_EVAL_FRAME.exec(frame);
  if (match === null) {
    return undefined;
  }
  const line = Number(match[1]);
  const column = Number(match[2]);
  // Both patterns capture digits, so these parse; what they do not guarantee is
  // that the numbers mean anything. A frame reporting line 0 is a browser
  // saying it does not know, and pointing at a line that cannot exist is worse
  // than saying nothing.
  return line >= 1 && column >= 1 ? { line, column } : undefined;
}

/**
 * Finds the line of the player's program that an exception came from.
 *
 * The first `eval`ed frame is the answer, not the topmost frame of the stack.
 * When a player calls `elevator.goToFloor(7)` on a five-floor building the
 * throw happens inside the engine, several frames deep, and every one of those
 * frames is the game's own code; the first frame below them that belongs to
 * `eval`ed code is the line the player wrote, which is the only line they can
 * do anything about.
 *
 * Not every failure has a line, and the honest answer then is `undefined`:
 *
 * - A syntax error has no position anywhere in V8 -- the stack is a bare
 *   `at eval (<anonymous>)` -- because the code never ran, so there is no frame
 *   to describe. The banner still says what is wrong; it just cannot point.
 * - "Code must contain an init function" is thrown after `eval` has returned,
 *   so no frame is the player's, and there is no one line at fault anyway.
 * - Browsers other than V8 and SpiderMonkey are not recognised, and a stack
 *   deeper than the browser's frame limit has had the player's frame cut off
 *   its end.
 *
 * Safari is the known gap: JavaScriptCore's format was not checked against a
 * real stack when this was written, and a pattern nobody has run against the
 * engine it claims to parse is a pattern that matches the wrong frame in
 * silence. Until someone can produce one, Safari falls into the same
 * `undefined` as everything else unfamiliar, which costs it the pointer and
 * nothing more.
 *
 * In each of those the caller shows what it always showed, so a browser this
 * does not understand loses the new pointer and nothing else.
 *
 * @param error - Whatever the player's code threw.
 * @param code - The source that was compiled to produce it. Needed for two
 * corrections that depend on the text: the parenthesis {@link
 * firstLineColumnOffset} may have added, and how many lines there are to point
 * at.
 * @returns Where in `code` the failure happened, or `undefined` when that
 * cannot be established.
 */
export function locateCodeError(error: unknown, code: string): CodeErrorLocation | undefined {
  const stack = stackOf(error);
  if (stack === undefined) {
    return undefined;
  }
  const lineCount = countLines(code);
  for (const frame of stack.split("\n")) {
    const position = positionIn(frame.trim());
    // A player who evaluates a string of their own gets frames whose lines are
    // counted in *that* string. Nothing marks those frames as foreign, but a
    // line past the end of the program is recognisably not a line of it, and
    // skipping it walks out of the nested source and into the frame that
    // called it -- which is a line the player really did write. Handing the
    // number on unchecked would instead ask the editor for a line it has not
    // got.
    if (position === undefined || position.line > lineCount) {
      continue;
    }
    // Stack positions are positions in the compiled source, which is the
    // player's text plus at most one character. The parenthesis sits on the
    // first line, so it is the only line whose columns moved, and `Math.max`
    // covers the position *of* the parenthesis itself.
    const column =
      position.line === 1
        ? Math.max(1, position.column - firstLineColumnOffset(code))
        : position.column;
    return { line: position.line, column };
  }
  return undefined;
}

/**
 * Counts the lines of a program the way an editor numbers them.
 *
 * @param code - The player's source.
 * @returns The number of lines, which is at least 1: an empty document still
 * has a first line to put a cursor on.
 */
function countLines(code: string): number {
  return code.split("\n").length;
}
