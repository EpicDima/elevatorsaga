/**
 * The message catalog: what a translation must contain, and how a message is
 * looked up. The English catalog is the schema — `MessageCatalog<L>` is a
 * mapped type over it, not a `Record<string, string>`, so a missing key, an
 * invented one, or a placeholder typo is a compile error rather than a blank
 * sentence found hours later. Keys ending in `.code` are exempt: their values
 * are example JavaScript, and their braces are syntax, not placeholders.
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
 * A complete translation into one locale, shaped from the English catalog.
 * Plural entries take the target locale's own categories, not English's two —
 * `MessageCatalog<"ru">` demands `few` and `many` from every counted message.
 */
export type MessageCatalog<L extends Locale> = {
  readonly [K in MessageKey]: EnglishValue<K> extends string ? string : PluralForms<L>;
};

/** Keys whose value is example code rather than prose. */
type CodeKey = `${string}.code`;

/**
 * The names of the `{placeholders}` in a string, as a union. Named, not
 * positional, because a translation is free to move them: Russian regularly
 * puts the count where its own sentence needs it, not where English left it.
 */
type Placeholders<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | Placeholders<Rest>
  : never;

/** Whether a message is counted, i.e. written as plural forms. */
type IsPlural<K extends MessageKey> = EnglishValue<K> extends string ? false : true;

/**
 * Every string a message is made of: itself, or all of its plural forms —
 * all of them, since a language may put a placeholder in one form and not
 * another, and the parameter is required either way.
 */
type MessageStrings<K extends MessageKey> =
  EnglishValue<K> extends string
    ? EnglishValue<K>
    : EnglishValue<K>[keyof EnglishValue<K>] & string;

/**
 * The parameter names a message takes, read off the English text since that
 * is the reference. Counted messages take `count` whether or not they show
 * it — a language may need the number to pick a form without repeating it.
 */
type ParamNames<K extends MessageKey> = K extends CodeKey
  ? never
  : Placeholders<MessageStrings<K>> | (IsPlural<K> extends true ? "count" : never);

/**
 * The parameter object a message takes. `count` is a {@link Countable}
 * rather than any parameter value, since the plural category depends on the
 * digits that will be printed: 21 is `one` in Russian, 21,0 is `other`.
 */
export type MessageParams<K extends MessageKey> = {
  readonly [N in ParamNames<K>]: N extends "count" ? Countable : ParamValue;
};

/**
 * The arguments a message takes after its key. A tuple so a message with no
 * placeholders takes nothing (`t("page.brand")`, not `t("page.brand", {})`),
 * while one with placeholders makes the object mandatory.
 */
export type MessageArgs<K extends MessageKey> = [ParamNames<K>] extends [never]
  ? []
  : [params: MessageParams<K>];

/**
 * A catalog entry as the lookup sees it, with the locale forgotten. Every
 * category is optional here even though {@link PluralForms} requires each one
 * for its locale, since the lookup is written once for every locale; a
 * missing form falls back to `other`, the one category every language has.
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
 * Looks up a message and renders it. Takes the catalog as an argument rather
 * than reaching for a module-level one, so it stays a pure function and
 * `index.ts` is left as the only place that knows the locale on screen.
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
    // Unreachable through the typed signature; guards a cast or hand-written catalog.
    return key;
  }
  if (typeof entry === "string") {
    return interpolate(locale, entry, params);
  }
  const category = selectPlural(locale, params.count ?? 0);
  return interpolate(locale, entry[category] ?? entry.other ?? key, params);
}
