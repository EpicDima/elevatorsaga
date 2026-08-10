/**
 * Turns the source the player typed into the object that drives the elevators.
 *
 * Ported from `getCodeObjFromCode` in the legacy `base.js`.
 */

import type { UserCodeObject } from "./world-controller.ts";

export type { UserCodeObject } from "./world-controller.ts";

/**
 * Indirect `eval`, which runs the source in global scope rather than in this
 * module's scope.
 *
 * Running arbitrary player-supplied code *is* the product: Elevator Saga is a
 * programming game whose entire point is to execute what the player wrote. The
 * code never leaves the player's own browser tab, so there is no other party to
 * protect from it.
 */
// Detaching `eval` from the global object is what makes the call *indirect*;
// the classic `(0, eval)` spelling trips TypeScript's unused-comma-operand
// check, so the reference is taken through `globalThis` instead.
const evaluate: (src: string) => unknown = globalThis.eval;

/**
 * Compiles the player's source into a usable code object.
 *
 * A bare `{ init: ..., update: ... }` object literal is wrapped in parentheses
 * so it is parsed as an expression rather than a block, which is what lets the
 * editor's default template work. Surrounding whitespace is tolerated.
 *
 * @param code - The source the player typed.
 * @returns The compiled `{ init, update }` object.
 * @throws {Error} When the code has no `init` or no `update` function. The
 * legacy version threw bare strings; the messages are unchanged.
 */
export function getCodeObjFromCode(code: string): UserCodeObject {
  let source = code;
  const trimmed = source.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    source = `(${source})`;
  }
  const obj = evaluate(source) as Partial<UserCodeObject> | null | undefined;
  // The legacy code read `obj.init` straight away, so a `null` or `undefined`
  // result threw a TypeError instead; both cases are rejected either way.
  if (typeof obj?.init !== "function") {
    throw new Error("Code must contain an init function");
  }
  if (typeof obj.update !== "function") {
    throw new Error("Code must contain an update function");
  }
  return obj as UserCodeObject;
}
