/**
 * Works out which line of the player's own program an exception came from.
 *
 * The player's code is compiled with `eval`, so the engine has no file to name
 * for it and the browser's stack traces mark its frames as anonymous. There is
 * no source map to consult either, so all that is left is what the engines
 * themselves volunteer -- and they volunteer it in two different places. V8 and
 * SpiderMonkey write the position into the stack frame; JavaScriptCore leaves
 * the frame bare and hangs the position off the thrown value instead. This
 * module reads both.
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
 * Reads the position JavaScriptCore records on the error itself.
 *
 * Safari puts no position in a stack frame belonging to `eval`ed code at all --
 * its frames for such code are a bare `update@`, with nothing after the `@` --
 * so the stack walk above has nothing to find there. What it does instead is
 * hang `line` and `column` straight off the error object, and those *are* the
 * position in the compiled source, on the same 1-based reckoning as everywhere
 * else here.
 *
 * `sourceURL` is what makes that safe to use. An error constructed in `eval`ed
 * code has none, while one constructed in a file -- which for this game means in
 * the engine's own bundle, several frames below whatever the player called --
 * names that file. Without the check, `elevator.goToFloor("lobby")` would report
 * the line of `elevator-interface.ts` that builds its `TypeError` as though it
 * were a line of the player's program, and underline whatever happens to be
 * there. A syntax error is caught by the same check for the same reason:
 * JavaScriptCore reports the position of the `eval` call in the game, which is
 * identical for every program that ever fails to parse.
 *
 * Checked against `jsc` -- the JavaScriptCore shell inside the framework macOS
 * ships, which is the engine Safari runs -- rather than reasoned about. The one
 * it was run against reports itself as framework build 21624.2.5.11.4, on macOS
 * 26.5; the shell has no version of its own to ask for, so that is the framework
 * bundle's. The cases covered are the ones that matter: a throw on the player's
 * own line, a throw from the engine below it, a throw inside a helper the player
 * factored out, a program compiled unwrapped, a `TypeError` from calling a
 * method that is not there, a native `SyntaxError` out of `JSON.parse`, an error
 * constructed on one line and thrown on another, and a thrown string. Safari
 * itself was not available to confirm the shell matches the browser.
 *
 * Two limits, and only the first is something the V8 walk does better. The
 * position is where the error was *constructed*, not where it was raised:
 * building one on line 2 and throwing it on line 5 reports line 2. So an error
 * the engine built carries the engine's file, `sourceURL` sends it away, and the
 * player's calling line is lost where the stack walk would have found it. And a
 * player who evaluates a string of their own gets that string's line number with
 * no second frame to fall back to. When the number is past the end of the
 * program the range check discards it and nothing is reported; when the string
 * is short enough for it to land inside the program, the wrong line is
 * underlined. V8 underlines that same wrong line, so only the out-of-range half
 * of this is a difference between the two.
 *
 * @param error - Whatever the player's code threw.
 * @returns The position, or `undefined` when the error carries none, or carries
 * one that belongs to a file rather than to the player's program.
 */
function positionOnError(error: unknown): CodeErrorLocation | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  try {
    const fields = error as Record<string, unknown>;
    if (fields["sourceURL"] !== undefined) {
      return undefined;
    }
    const line = fields["line"];
    const column = fields["column"];
    if (typeof line !== "number" || typeof column !== "number") {
      return undefined;
    }
    // Same reasoning as `positionIn`: a zero, a fraction or an infinity is not a
    // place in a document, whatever the engine meant by it.
    return Number.isInteger(line) && line >= 1 && Number.isInteger(column) && column >= 1
      ? { line, column }
      : undefined;
  } catch {
    // Any of those reads can be a getter, and a getter the player wrote can
    // throw. Losing the pointer is the price; taking the game down is not.
    return undefined;
  }
}

/**
 * Puts a position from the compiled source into the player's coordinates.
 *
 * @param position - A position as an engine reported it.
 * @param code - The source the player typed.
 * @returns The same position with the wrap taken back off, or `undefined` when
 * it names a line the program has not got.
 */
function inPlayerCoordinates(
  position: CodeErrorLocation,
  code: string,
): CodeErrorLocation | undefined {
  if (position.line > countLines(code)) {
    return undefined;
  }
  // Positions are positions in the compiled source, which is the player's text
  // plus at most one character. The parenthesis sits on the first line, so it is
  // the only line whose columns moved, and `Math.max` covers the position *of*
  // the parenthesis itself.
  const column =
    position.line === 1
      ? Math.max(1, position.column - firstLineColumnOffset(code))
      : position.column;
  return { line: position.line, column };
}

/**
 * Finds the line of the player's program that an exception came from.
 *
 * The first `eval`ed frame is the answer, not the topmost frame of the stack.
 * When a player calls `elevator.goToFloor("lobby")` the throw happens inside the
 * engine, several frames deep, and every one of those frames is the game's own
 * code; the first frame below them that belongs to `eval`ed code is the line the
 * player wrote, which is the only line they can do anything about.
 *
 * Not every failure has a line, and the honest answer then is `undefined`:
 *
 * - A syntax error has no position anywhere in V8 -- the stack is a bare
 *   `at eval (<anonymous>)` -- because the code never ran, so there is no frame
 *   to describe. The banner still says what is wrong; it just cannot point.
 * - "Code must contain an init function" is thrown after `eval` has returned,
 *   so no frame is the player's, and there is no one line at fault anyway.
 * - Browsers other than V8, SpiderMonkey and JavaScriptCore are not recognized,
 *   and a stack deeper than the browser's frame limit has had the player's
 *   frame cut off its end.
 *
 * In each of those the caller shows what it always showed, so a browser this
 * does not understand loses the new pointer and nothing else.
 *
 * The stack is read first and the error's own fields only after it, which is
 * the order of how much each can tell. The stack is a list, so a position can
 * be chosen from it -- past the engine's frames, out of a nested evaluation --
 * where a position on the error is a single number that is whatever it is. In
 * practice the two never compete: JavaScriptCore puts nothing in the frame, V8
 * puts nothing on the error, and SpiderMonkey's own position fields go by
 * `lineNumber` and `columnNumber`, which are not the names read here. No
 * SpiderMonkey build was to hand to confirm that last one.
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
  for (const frame of (stackOf(error) ?? "").split("\n")) {
    const position = positionIn(frame.trim());
    if (position === undefined) {
      continue;
    }
    // A player who evaluates a string of their own gets frames whose lines are
    // counted in *that* string. Nothing marks those frames as foreign, but a
    // line past the end of the program is recognisably not a line of it, and
    // skipping it walks out of the nested source and into the frame that
    // called it -- which is a line the player really did write. Handing the
    // number on unchecked would instead ask the editor for a line it has not
    // got.
    const located = inPlayerCoordinates(position, code);
    if (located !== undefined) {
      return located;
    }
  }
  const onError = positionOnError(error);
  return onError === undefined ? undefined : inPlayerCoordinates(onError, code);
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
