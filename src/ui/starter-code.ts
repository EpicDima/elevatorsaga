/**
 * Recognizing a program the game handed the player, so it can be said again in
 * the language on screen.
 *
 * Every program a player is *given* is a message: the default program in the
 * editor, and the starting point of every level of the learning track and the
 * Skyscraper block. The JavaScript in them is byte-identical in every locale and
 * only the `//` comments are translated, which `src/i18n/catalog.test.ts` checks
 * rather than trusts — and that is what makes any of this possible.
 *
 * What it is for: a program the player never wrote has to follow the language
 * they chose, and nothing upstream of here can make it. {@link t} answers for
 * the locale that is active when it is called, so a starter program is right at
 * the moment a level opens and frozen from then on — while a language change is
 * exactly the moment nothing reads it again. Worse, the editor writes a level's
 * starting point into storage the first time the level is opened, so the copy
 * that comes back tomorrow is in the language of the day it was written and
 * carries forward into the next level in that language too. A player who met
 * the game in Russian and switched to English was left with Russian comments in
 * the first JavaScript they ever see of this API, next to a Help page walking
 * through that same program in English.
 *
 * The recognition is byte-equality with a program the game hands out, in any
 * language it speaks, rather than a "the player has not typed here yet" flag.
 * A flag is the obvious design and it cannot be made to hold: it would have to
 * survive a reload, a second tab, a program carried forward from a lower level
 * and a copy written to storage in another session, and every one of those is a
 * place for it to be lost or — far worse — left set over a program somebody
 * wrote. Equality is the same question asked of the text itself, so a program
 * that came out of storage a week later answers it exactly as the one on screen
 * does, and a program the player has touched stops matching at the first
 * keystroke and is never touched again.
 */

import { EN_MESSAGES, LOCALES, t, translateIn } from "../i18n/index.ts";
import type { MessageKey } from "../i18n/index.ts";

/**
 * A message whose text is a program the player is handed.
 *
 * Spelled as a pattern over {@link MessageKey} rather than as a list, so a
 * level added to either block is covered by the catalog key it must have
 * anyway. A list is the alternative and it fails quietly in the direction that
 * matters: the entry nobody remembered to add is a level whose program stays in
 * the language it was first drawn in, with nothing to say so.
 */
type StarterCodeKey = Extract<
  MessageKey,
  "editor.defaultCode.code" | `${string}.startingCode.code`
>;

/**
 * Every starter program in the catalog, found rather than written down.
 *
 * Read from the English catalog because that is the one that is bundled and the
 * one every other catalog is shaped from — a key here is a key in all of them.
 */
const STARTER_CODE_KEYS: readonly StarterCodeKey[] = Object.keys(EN_MESSAGES).filter(
  (key): key is StarterCodeKey =>
    key === "editor.defaultCode.code" || key.endsWith(".startingCode.code"),
);

/**
 * The same program in the language on screen, when the game is the one that
 * wrote it.
 *
 * Everything the editor puts in front of a player goes through here: the
 * program it opens with, the copy it finds in storage, the one a lower level
 * carried forward, and the one already on screen when the language changes.
 * Text this does not recognize comes back untouched, and that is the great
 * majority of it — a program the player has written is not a message and can
 * never become one.
 *
 * A language whose catalog has not been fetched contributes its English
 * rendering, since that is what {@link translateIn} falls back to. It costs a
 * comparison the English pass makes anyway and cannot produce a wrong answer;
 * what it means is that a program written in a language the page has not
 * loaded is not recognized until it has, which is no worse than the state the
 * rest of the page is in at that moment.
 *
 * Two levels may share a starting point — the Skyscraper block has such a pair
 * — so the first key that matches wins rather than the "right" one, which is
 * unknowable from the text alone. That is safe only for as long as programs
 * that are the same in one language are the same in all of them, which is not a
 * property of the type system: `starter-code.test.ts` asserts it, so the day a
 * translator changes one of a pair the suite says so rather than a player
 * meeting the other level's comments.
 *
 * @param code - A program, from wherever the editor got it.
 * @returns The program in the active locale, or `code` unchanged when it is not
 * one the game hands out.
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
