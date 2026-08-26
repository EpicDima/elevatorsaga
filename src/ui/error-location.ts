/** Locates an exception's position in the player's `eval`ed program by reading whatever each engine volunteers (no source map exists). */

import { firstLineColumnOffset } from "../game/user-code.ts";

/** A 1-based line/column, matching both browser stack traces and CodeMirror. */
export interface CodeErrorLocation {
  /** The line, counting the first line of the program as 1. */
  readonly line: number;
  /** The column within that line, counting its first character as 1. */
  readonly column: number;
}

/** Matches a V8 eval-frame position, anchored to the end so nested `eval at` chains resolve to the frame's own position. */
const V8_EVAL_FRAME = /,\s*<anonymous>:(\d+):(\d+)\)$/;

/** Matches a SpiderMonkey eval-frame position; ordinary frames never carry the `> eval` marker. */
const SPIDERMONKEY_EVAL_FRAME = /> eval:(\d+):(\d+)$/;

/** Returns the thrown value's stack, or undefined if it has no usable one (player code can throw a non-Error, or a `stack` getter that throws). */
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

/** Extracts the position an `eval`ed stack frame reports, or undefined if the frame isn't `eval`ed code or names none. */
function positionIn(frame: string): CodeErrorLocation | undefined {
  const match = V8_EVAL_FRAME.exec(frame) ?? SPIDERMONKEY_EVAL_FRAME.exec(frame);
  if (match === null) {
    return undefined;
  }
  const line = Number(match[1]);
  const column = Number(match[2]);
  // Line/column 0 means the browser doesn't know the position; treat it as none.
  return line >= 1 && column >= 1 ? { line, column } : undefined;
}

/** Reads the position JavaScriptCore hangs off the thrown error (it puts none in `eval`ed stack frames); skips errors carrying `sourceURL`, which are the engine's own. */
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
    // Not a real position: zero, negative, or non-integer.
    return Number.isInteger(line) && line >= 1 && Number.isInteger(column) && column >= 1
      ? { line, column }
      : undefined;
  } catch {
    // A getter the player wrote can throw here; swallow it rather than crash the game.
    return undefined;
  }
}

/** Converts an engine-reported position back to the player's coordinates, or undefined if it names a line the program hasn't got. */
function inPlayerCoordinates(
  position: CodeErrorLocation,
  code: string,
): CodeErrorLocation | undefined {
  if (position.line > countLines(code)) {
    return undefined;
  }
  // Only line 1 is shifted (by the eval wrapper's opening parenthesis); Math.max keeps the column from going below 1.
  const column =
    position.line === 1
      ? Math.max(1, position.column - firstLineColumnOffset(code))
      : position.column;
  return { line: position.line, column };
}

/** Finds the line an exception came from using the first `eval`ed stack frame, not the top of the stack (which is the engine's own code). */
export function locateCodeError(error: unknown, code: string): CodeErrorLocation | undefined {
  for (const frame of (stackOf(error) ?? "").split("\n")) {
    const position = positionIn(frame.trim());
    if (position === undefined) {
      continue;
    }
    // A nested eval's frame reports a line in that string, not in `code`; falling through here walks out to the frame that actually called it.
    const located = inPlayerCoordinates(position, code);
    if (located !== undefined) {
      return located;
    }
  }
  const onError = positionOnError(error);
  return onError === undefined ? undefined : inPlayerCoordinates(onError, code);
}

/** Counts lines the way an editor numbers them; an empty document still has one. */
function countLines(code: string): number {
  return code.split("\n").length;
}
