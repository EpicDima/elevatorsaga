/** Turns the source the player typed into the object that drives the elevators. */

import { t } from "../i18n/index.ts";
import type { UserCodeObject } from "./world-controller.ts";

export type { UserCodeObject } from "./world-controller.ts";

/** Indirect eval, running player source in global scope; executing it is the whole point of the game. */
// `globalThis.eval` is used instead of the `(0, eval)` idiom because that trips TypeScript's
// unused-comma-operand check.
const evaluate: (src: string) => unknown = globalThis.eval;

/** Whether the source is a bare object literal, which parses as a block unless parenthesized. */
function needsParentheses(code: string): boolean {
  const trimmed = code.trim();
  return trimmed.startsWith("{") && trimmed.endsWith("}");
}

/**
 * Columns added to the player's first line when the source gets parenthesized.
 * Exported so a stack-trace column can be translated back to what the player wrote
 * without duplicating the wrapping rule.
 */
export function firstLineColumnOffset(code: string): number {
  return needsParentheses(code) ? 1 : 0;
}

/**
 * Compiles the player's source into a `{ init, update }` code object.
 * @throws {Error} A localized message, built at throw time, when `init` or `update` is missing.
 */
export function getCodeObjFromCode(code: string): UserCodeObject {
  let source = code;
  if (needsParentheses(source)) {
    source = `(${source})`;
  }
  const obj = evaluate(source) as Partial<UserCodeObject> | null | undefined;
  if (typeof obj?.init !== "function") {
    throw new Error(t("error.code.noInit"));
  }
  if (typeof obj.update !== "function") {
    throw new Error(t("error.code.noUpdate"));
  }
  return obj as UserCodeObject;
}
