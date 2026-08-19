/**
 * Turns whatever the player's code threw into the single line the error banner
 * puts in front of them.
 *
 * Player code can throw anything at all, so this degrades in stages: the
 * headline of the stack -- the error's class and message, which is the line
 * every V8 stack begins with; then the value's own string conversion, which is
 * what the legacy banner fell back to (a thrown object reached `riot.render`,
 * which concatenated it, calling its `toString`); then a `message` property;
 * and finally a structural description. What it never returns is the bare
 * `[object Object]` that `Object.prototype.toString` produces, which tells the
 * player nothing at all about what went wrong.
 *
 * The frames under that headline are deliberately thrown away. The banner is
 * one line by design -- `design/ui-mockup.html`'s `.errorline` is a glyph, a
 * sentence, the failure in a `<code>` and a "line 20 ->" link, all on one row --
 * and the frames of a built bundle are positions in `assets/index-<hash>.js`,
 * which is machinery the player neither wrote nor can edit. The one frame that
 * *is* about their program is already read out of the stack by
 * `src/ui/error-location.ts`'s `locateCodeError` and drawn as the line number
 * beside this text, so repeating the whole stack would cost the banner three or
 * four lines of height in order to say, far less clearly, what the link next to
 * it already says.
 */

import { t } from "#i18n/index.ts";

/** Matches the useless output of the default `Object.prototype.toString`. */
const GENERIC_TO_STRING = /^\[object [A-Za-z]*]$/;

/**
 * Matches the line an engine writes *above* a stack's frames.
 *
 * That line is `Error.prototype.toString`'s output, which is the error's `name`
 * followed by `": "` and its `message`, or the bare `name` when there is no
 * message -- so an identifier, then a colon or the end of the line. Only V8
 * writes it at all: SpiderMonkey and JavaScriptCore put nothing but frames in
 * `stack`, so the first line of one of their stacks is `init@http://host/x.js`
 * or `eval code@`, and taking it as a headline would show the player a piece of
 * the game's own machinery instead of what went wrong. Every frame shape any of
 * the three engines writes fails this test: V8's begin `at ` (an identifier
 * followed by a space), and the other two put an `@` where this wants a colon.
 *
 * Being too strict costs nothing, which is what makes a shape test the right
 * tool here rather than a list of frame patterns to exclude. A real `Error`
 * whose headline this rejects -- a `name` with a space in it, a message
 * beginning with a newline -- falls through to the very next stage, which is
 * `String(error)`, and that reproduces the same `name: message` text by
 * construction. Being too lax has no such safety net: a frame accepted here is
 * shown to the player as though it were the failure.
 */
const STACK_HEADLINE = /^[A-Za-z_$][\w$]*(?::|$)/;

/**
 * Reads a string property of a thrown value, if it has a usable one.
 *
 * @param value - The thrown value.
 * @param key - The property to read.
 * @returns The property, or `undefined` when it is missing, empty, not a
 * string, or throws from a getter.
 */
function stringProperty(value: object, key: "message" | "stack"): string | undefined {
  try {
    const property: unknown = (value as Record<string, unknown>)[key];
    return typeof property === "string" && property !== "" ? property : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reads the headline off a thrown value's stack, if it has one.
 *
 * @param error - The thrown value.
 * @returns The first line of its `stack`, trimmed, when that line is a headline
 * rather than a frame; `undefined` when there is no stack, when it starts with
 * a frame -- which is how SpiderMonkey and JavaScriptCore write every stack --
 * or when whatever the value calls `stack` is not a stack at all.
 */
function stackHeadline(error: object): string | undefined {
  const stack = stringProperty(error, "stack");
  if (stack === undefined) {
    return undefined;
  }
  // A stack of a single line is a whole stack, not a malformed one: that is
  // what V8 writes when `Error.stackTraceLimit` is 0, and what a hand-built
  // error object carries when someone assigned its `stack` themselves. Slicing
  // at `indexOf` rather than splitting also keeps the frames -- which run to
  // dozens of lines of URLs -- from being cut into an array nothing reads.
  const firstBreak = stack.indexOf("\n");
  const headline = (firstBreak === -1 ? stack : stack.slice(0, firstBreak)).trim();
  return STACK_HEADLINE.test(headline) ? headline : undefined;
}

/**
 * Converts a thrown value with its own `toString`, if it has a useful one.
 *
 * @param value - The thrown value.
 * @returns The conversion, or `undefined` when it throws, is empty, or is the
 * `[object Object]` that `Object.prototype.toString` produces for a value with
 * nothing of its own to say.
 */
function ownStringConversion(value: unknown): string | undefined {
  let text: string;
  try {
    // A hostile — or merely broken — `toString` can throw, and so can a value
    // with a null prototype, which has no `toString` at all.
    text = String(value);
  } catch {
    return undefined;
  }
  return text === "" || GENERIC_TO_STRING.test(text) ? undefined : text;
}

/**
 * Describes a thrown object that has nothing readable to say for itself.
 *
 * @param error - The thrown object.
 * @returns Its class and, where they can be had, its contents.
 */
function describeStructure(error: object): string {
  // "[object Object]" -> "Object", "[object Array]" -> "Array".
  const kind = Object.prototype.toString.call(error).slice(8, -1);
  let json: string | undefined;
  try {
    json = JSON.stringify(error);
  } catch {
    // Circular, a BigInt, or a throwing `toJSON`.
    json = undefined;
  }
  if (json !== undefined && json !== "{}" && json !== "undefined") {
    return `${kind} ${json}`;
  }
  const keys = Object.keys(error);
  // `kind` and the key names are the player's own JavaScript, so they are
  // interpolated rather than translated; only the sentence around them changes
  // language.
  return keys.length === 0
    ? t("error.thrown.noMessage", { kind })
    : t("error.thrown.keys", { kind, keys: keys.join(", ") });
}

/**
 * Turns whatever the player's code threw into one readable line.
 *
 * Player code can throw anything at all, so this degrades in stages: the
 * headline of the stack -- the error's class and message, and nothing of the
 * frames below it, for the reasons this module's own comment gives; then the
 * value's own string conversion, which is what the legacy banner fell back to
 * (a thrown object reached `riot.render`, which concatenated it, calling its
 * `toString`); then a `message` property; and finally a structural
 * description. What it never returns is the bare `[object Object]` that
 * `Object.prototype.toString` produces, which tells the player nothing at all
 * about what went wrong.
 *
 * The result is a line in the sense that it is the *headline* of the failure,
 * not in the sense that it is short: a player who throws four hundred
 * characters of their own gets all four hundred back, because every one of them
 * is text they chose to write.
 *
 * @param error - Whatever the player's code threw.
 * @returns Text describing the failure.
 */
export function describeError(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    // Strings, numbers, booleans, symbols, `null` and `undefined` all stringify
    // to exactly what the player threw.
    const text = String(error);
    return text === "" ? t("error.thrown.emptyString") : text;
  }
  return (
    stackHeadline(error) ??
    ownStringConversion(error) ??
    stringProperty(error, "message") ??
    describeStructure(error)
  );
}
