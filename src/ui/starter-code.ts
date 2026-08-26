/**
 * Detects starter code the game handed the player, so it can be re-said in the current language.
 * Matches by exact text against the catalog rather than a "not yet edited" flag — a flag can't survive storage, reload, or being carried into another level.
 */

import { EN_MESSAGES, LOCALES, t, translateIn } from "../i18n/index.ts";
import type { MessageKey } from "../i18n/index.ts";

/** A message key whose text is starter code: the default program, or a level's starting code. */
type StarterCodeKey = Extract<
  MessageKey,
  "editor.defaultCode.code" | `${string}.startingCode.code`
>;

/** Every starter-code key, read from the bundled English catalog (a superset of every locale's keys). */
const STARTER_CODE_KEYS: readonly StarterCodeKey[] = Object.keys(EN_MESSAGES).filter(
  (key): key is StarterCodeKey =>
    key === "editor.defaultCode.code" || key.endsWith(".startingCode.code"),
);

/**
 * Returns `code` re-said in the active locale if it's one of the game's starter programs, otherwise `code` unchanged.
 * When two levels share a starting point, the first matching key wins — `starter-code.test.ts` guards that such pairs stay identical across every locale.
 */
export function localizeStarterCode(code: string): string {
  for (const key of STARTER_CODE_KEYS) {
    for (const locale of LOCALES) {
      if (translateIn(locale, key) === code) {
        return t(key);
      }
    }
  }
  return code;
}
