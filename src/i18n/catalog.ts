/**
 * The message catalog: what a translation must contain, and how a message is
 * looked up.
 *
 * The English catalog is the schema. `MessageKey` is `keyof typeof
 * EN_MESSAGES`, and `MessageCatalog<L>` is a mapped type over it, so a
 * translation cannot be missing a key, cannot invent one, and cannot answer a
 * counted message with a plain string. None of that is a `Record<string,
 * string>`, deliberately: with one, the failure mode is a blank sentence in
 * front of a player, hours after the commit that caused it.
 *
 * The parameters a message takes are derived from the message itself. The
 * `{name}` placeholders of the English text become the required properties of
 * the parameter object, so `t("game.floor.callUp", {})` does not compile and
 * neither does a typo in `floor`. A message with no placeholders takes no
 * second argument at all, and a counted message always requires `count`.
 *
 * Keys ending in `.code` are exempt from that extraction: their values are
 * blocks of example JavaScript, whose braces are syntax rather than
 * placeholders. Nothing is interpolated into them.
 */

import type { EN_MESSAGES } from "./en.ts";
import {
  interpolate,
  selectPlural,
  type Countable,
  type ParamValue,
  type PluralForms,
} from "./format.ts";
import type { Locale } from "./locale.ts";

/** Every message the game can show, by name. */
export type MessageKey = keyof typeof EN_MESSAGES;

/** The English value of a message: a string, or its plural forms. */
type EnglishValue<K extends MessageKey> = (typeof EN_MESSAGES)[K];

/**
 * A complete translation into one locale.
 *
 * Shaped from the English catalog, so the two can never drift apart without
 * the build saying so. Plural entries take the categories of the target locale
 * rather than English's two: `MessageCatalog<"ru">` demands `few` and `many`
 * from every counted message, which is the whole point of the exercise.
 */
export type MessageCatalog<L extends Locale> = {
  readonly [K in MessageKey]: EnglishValue<K> extends string ? string : PluralForms<L>;
};

/** Keys whose value is example code rather than prose. */
type CodeKey = `${string}.code`;

/**
 * The names of the `{placeholders}` in a string, as a union.
 *
 * Recursive because a message may hold several, and named — not positional —
 * because a translation is free to move them: Russian regularly puts the count
 * where its own sentence needs it rather than where English left it.
 */
type Placeholders<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | Placeholders<Rest>
  : never;

/** Whether a message is counted, i.e. written as plural forms. */
type IsPlural<K extends MessageKey> = EnglishValue<K> extends string ? false : true;

/**
 * Every string a message is made of: itself, or all of its plural forms.
 *
 * All of them, because a language may put a placeholder in one form and not in
 * another, and the parameter is required either way.
 */
type MessageStrings<K extends MessageKey> =
  EnglishValue<K> extends string
    ? EnglishValue<K>
    : EnglishValue<K>[keyof EnglishValue<K>] & string;

/**
 * The parameter names a message takes.
 *
 * Read off the English text, since that is the reference: a translation that
 * spells a placeholder differently would silently print the placeholder, which
 * `catalog.test.ts` catches by comparing the two sets. Counted messages take
 * `count` whether or not they show it — a language may well need the number to
 * pick a form and not repeat it in words.
 */
type ParamNames<K extends MessageKey> = K extends CodeKey
  ? never
  : Placeholders<MessageStrings<K>> | (IsPlural<K> extends true ? "count" : never);

/**
 * The parameter object a message takes.
 *
 * `count` is a {@link Countable} rather than any parameter value because the
 * plural category is chosen from it, and the choice depends on the digits that
 * will be printed: 21 is `one` in Russian, and 21,0 is `other`.
 */
export type MessageParams<K extends MessageKey> = {
  readonly [N in ParamNames<K>]: N extends "count" ? Countable : ParamValue;
};

/**
 * The arguments a message takes after its key.
 *
 * A tuple so that a message with no placeholders takes nothing — `t("page.brand")`
 * rather than `t("page.brand", {})` — while one with placeholders makes the
 * object mandatory.
 */
export type MessageArgs<K extends MessageKey> = [ParamNames<K>] extends [never]
  ? []
  : [params: MessageParams<K>];

/**
 * A catalog entry as the lookup sees it, with the locale forgotten.
 *
 * Every category is optional here even though {@link PluralForms} makes each
 * one mandatory for the locale it belongs to: which categories those are
 * depends on the locale, and the implementation is written once for all of
 * them. What the lookup does when a form is missing is therefore a real
 * question rather than a dead branch, and `other` — the one category every
 * language has — is the answer.
 */
type CatalogEntry = string | Readonly<Partial<Record<Intl.LDMLPluralRule, string>>>;

/** Parameters as the lookup sees them, with the message forgotten. */
interface LooseParams {
  /** The count a plural form is chosen from, when there is one. */
  readonly count?: Countable;
  /** Everything else a `{placeholder}` might be filled with. */
  readonly [name: string]: ParamValue | undefined;
}

/**
 * Looks up a message and renders it.
 *
 * Takes the catalog rather than reaching for a module-level one so that it
 * stays a pure function of its arguments: the tests can render Russian and
 * English side by side, and `index.ts` is left as the only place that knows
 * which locale is currently on screen.
 *
 * @param locale - The locale being rendered, used for plurals and numbers.
 * @param catalog - That locale's catalog.
 * @param key - The message wanted.
 * @param args - Its parameters, if it takes any.
 * @returns The rendered message.
 */
export function translate<L extends Locale, K extends MessageKey>(
  locale: L,
  catalog: MessageCatalog<L>,
  key: K,
  ...args: MessageArgs<K>
): string;
export function translate(
  locale: Locale,
  catalog: Readonly<Record<string, CatalogEntry>>,
  key: string,
  params: LooseParams = {},
): string {
  const entry = catalog[key];
  if (entry === undefined) {
    // Unreachable through the typed signature; a key that does not exist is a
    // compile error. Showing the key beats showing nothing if one ever gets in
    // through a cast or a hand-written catalog.
    return key;
  }
  if (typeof entry === "string") {
    return interpolate(locale, entry, params);
  }
  const category = selectPlural(locale, params.count ?? 0);
  return interpolate(locale, entry[category] ?? entry.other ?? key, params);
}
