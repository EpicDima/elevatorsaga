import { t } from "#i18n/index.ts";

/** Matches the useless output of the default `Object.prototype.toString`. */
const GENERIC_TO_STRING = /^\[object [A-Za-z]*]$/;

/**
 * Matches a V8-style stack headline (`name: message`), not a stack frame.
 * SpiderMonkey and JavaScriptCore stacks start with a frame instead, so this
 * shape test tells the two apart.
 */
const STACK_HEADLINE = /^[A-Za-z_$][\w$]*(?::|$)/;

/** Reads a string property of a thrown value, or `undefined` if it is missing, empty, not a string, or its getter throws. */
function stringProperty(value: object, key: "message" | "stack"): string | undefined {
  try {
    const property: unknown = (value as Record<string, unknown>)[key];
    return typeof property === "string" && property !== "" ? property : undefined;
  } catch {
    return undefined;
  }
}

/** Returns the thrown value's stack headline, trimmed, or `undefined` if there is no stack or it starts with a frame instead. */
function stackHeadline(error: object): string | undefined {
  const stack = stringProperty(error, "stack");
  if (stack === undefined) {
    return undefined;
  }
  // A single-line stack is valid (e.g. `stackTraceLimit` set to 0), not malformed.
  const firstBreak = stack.indexOf("\n");
  const headline = (firstBreak === -1 ? stack : stack.slice(0, firstBreak)).trim();
  return STACK_HEADLINE.test(headline) ? headline : undefined;
}

/** Converts a thrown value via its own `toString`, or `undefined` if it throws, is empty, or is the generic `[object Object]`. */
function ownStringConversion(value: unknown): string | undefined {
  let text: string;
  try {
    // A broken `toString` can throw, as can a null-prototype value with no `toString` at all.
    text = String(value);
  } catch {
    return undefined;
  }
  return text === "" || GENERIC_TO_STRING.test(text) ? undefined : text;
}

/** Describes a thrown object that has nothing readable to say for itself, using its class and, if available, its contents. */
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
  // `kind` and the keys are the player's own JavaScript, so only the surrounding sentence is translated.
  return keys.length === 0
    ? t("error.thrown.noMessage", { kind })
    : t("error.thrown.keys", { kind, keys: keys.join(", ") });
}

/**
 * Turns whatever the player's code threw into one readable line, falling
 * back through the stack headline, then `toString`, then a `message`
 * property, then a structural description of the object.
 */
export function describeError(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    // Primitives already stringify to what the player threw.
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
