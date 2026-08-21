/**
 * Turns the source the player typed into the object that drives the elevators.
 *
 * Ported from `getCodeObjFromCode` in the legacy `base.js`.
 */

import { t } from "../i18n/index.ts";
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
 * Whether the source has to be parenthesised before it can be evaluated.
 *
 * A bare `{ init: ..., update: ... }` object literal is parsed as a block, not
 * as an expression, so evaluating it yields nothing at all; the parentheses are
 * what let the editor's default template work. Surrounding whitespace is
 * tolerated, which is why the test is on the trimmed text.
 *
 * @param code - The source the player typed.
 * @returns Whether {@link getCodeObjFromCode} will wrap it.
 */
function needsParentheses(code: string): boolean {
  const trimmed = code.trim();
  return trimmed.startsWith("{") && trimmed.endsWith("}");
}

/**
 * How many columns the compiled source adds to the player's first line.
 *
 * The opening parenthesis goes in front of the whole source, so it lands on the
 * first line and shifts everything on that line one column to the right; every
 * later line, and every line number, is untouched. Anything reading a position
 * back out of a stack trace -- which reports positions in the *compiled* source
 * -- has to subtract this to get back to what the player can see in the editor.
 *
 * Exported so that there is one statement of when the wrap happens rather than
 * two that can disagree: a copy of the rule here would go on claiming a shifted
 * column long after this module stopped wrapping, and point the player at the
 * wrong character with no test able to notice.
 *
 * @param code - The source the player typed.
 * @returns 1 when the source gets parenthesised, 0 when it is evaluated as-is.
 */
export function firstLineColumnOffset(code: string): number {
  return needsParentheses(code) ? 1 : 0;
}

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
 * legacy version threw bare strings; the English wording is unchanged, and the
 * message is now taken from the catalog, because it is not a diagnostic for
 * whoever is reading a stack — it is what the code status bar puts in front of
 * the player. Rendered here, at the moment of the throw, rather than held in a
 * constant: a constant is filled in when this module is imported, which is
 * before the page has chosen a locale.
 */
export function getCodeObjFromCode(code: string): UserCodeObject {
  let source = code;
  if (needsParentheses(source)) {
    source = `(${source})`;
  }
  const obj = evaluate(source) as Partial<UserCodeObject> | null | undefined;
  // The legacy code read `obj.init` straight away, so a `null` or `undefined`
  // result threw a TypeError instead; both cases are rejected either way.
  if (typeof obj?.init !== "function") {
    throw new Error(t("error.code.noInit"));
  }
  if (typeof obj.update !== "function") {
    throw new Error(t("error.code.noUpdate"));
  }
  return obj as UserCodeObject;
}
