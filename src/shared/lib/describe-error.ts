/**
 * Turns whatever the player's code threw into readable text.
 *
 * Player code can throw anything at all, so this degrades in stages: the stack
 * first, as the legacy banner did; then the value's own string conversion,
 * which is what the legacy banner fell back to (a thrown object reached
 * `riot.render`, which concatenated it, calling its `toString`); then a
 * `message` property; and finally a structural description. What it never
 * returns is the bare `[object Object]` that `Object.prototype.toString`
 * produces, which tells the player nothing at all about what went wrong.
 */

import { t } from "#i18n/index.ts";

/** Matches the useless output of the default `Object.prototype.toString`. */
const GENERIC_TO_STRING = /^\[object [A-Za-z]*]$/;

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
 * Turns whatever the player's code threw into something readable.
 *
 * Player code can throw anything at all, so this degrades in stages: the stack
 * first, as the legacy banner did; then the value's own string conversion,
 * which is what the legacy banner fell back to (a thrown object reached
 * `riot.render`, which concatenated it, calling its `toString`); then a
 * `message` property; and finally a structural description. What it never
 * returns is the bare `[object Object]` that `Object.prototype.toString`
 * produces, which tells the player nothing at all about what went wrong.
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
    stringProperty(error, "stack") ??
    ownStringConversion(error) ??
    stringProperty(error, "message") ??
    describeStructure(error)
  );
}
