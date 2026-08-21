/**
 * Numbers, times, plural categories and parameter interpolation.
 *
 * All of it is `Intl`, and deliberately so. An i18n package would arrive with
 * its own message syntax, its own compiler step and its own copy of the CLDR
 * plural data — data the platform has shipped for a decade and keeps up to date
 * on its own. `Intl` is the modern answer; a package would be the needlessly
 * complex one.
 *
 * The reason plural selection goes through {@link selectPlural} rather than
 * `count === 1 ? singular : plural` is Russian. It has four categories, and the
 * English shortcut gets three of them wrong: 1 пассажир, 2 пассажира,
 * 5 пассажиров, 1,5 пассажира. Which category a number falls into is not even a
 * property of the number alone — 21 is `one` written plainly and `other` written
 * as 21,0 — so the digits a message will actually show have to be decided before
 * the category is chosen, which is what {@link Quantity} carries around.
 */

import type { Locale } from "./locale.ts";

/**
 * A number together with the way it is to be rendered.
 *
 * The two travel as one value because they cannot be decided separately: the
 * plural category depends on the digits that end up on screen, so the formatter
 * options are as much a part of a count as the count is.
 */
export interface Quantity {
  /** The number itself. */
  readonly value: number;
  /** How to render it; the `Intl.NumberFormat` options, defaulting to none. */
  readonly format?: Intl.NumberFormatOptions;
}

/** Anything a `{placeholder}` can be filled with. */
export type ParamValue = string | number | Quantity;

/**
 * A rendered quantity with its unit kept separate from its digits.
 *
 * For the one place that needs the two apart rather than as one string: the
 * statistics tiles, which set the unit in a `<small>` a size down and a shade
 * back, so that a column of figures reads as figures.
 * Which characters are the unit, and whether they come before or after the
 * number and with what between them, is the locale's business — hence
 * {@link formatValueParts} rather than a `split` at the call site.
 */
export interface QuantityParts {
  /** The digits, punctuated for the locale. */
  readonly number: string;
  /** The unit and whatever separates it from the digits; `""` when there is no unit. */
  readonly unit: string;
}

/** Anything that can drive the choice of a plural form. */
export type Countable = number | Quantity;

/**
 * Russian typography wants a number and its unit kept on one line.
 *
 * CLDR's narrow unit pattern for Russian is `{0} с` with an ordinary space, so
 * "1,5 с" is free to break across lines between the number and the unit. The
 * separator is replaced with a non-breaking one after formatting rather than
 * before, because only the formatter knows where it put the separator.
 */
const NO_BREAK_SPACE = "\u00a0";

/** Cached formatters, keyed by locale and options; building one is not cheap. */
const numberFormatters = new Map<string, Intl.NumberFormat>();

/** Cached plural rules, keyed the same way. */
const pluralRules = new Map<string, Intl.PluralRules>();

/** Cached list formatters, keyed by locale alone; they take no options here. */
const listFormatters = new Map<Locale, Intl.ListFormat>();

/**
 * Cache key for a locale and a set of formatter options.
 *
 * Two option objects that differ only in the order their properties were
 * written produce two entries. They behave identically, so the only cost is a
 * duplicate formatter, and every option object here is built by one of the
 * helpers below, which write them in a fixed order.
 *
 * The two halves are joined with `\u0000`, which cannot occur in a locale
 * tag or in the JSON, so no pair of inputs can collide on one key.
 *
 * @param locale - The locale being formatted for.
 * @param options - The formatter options.
 * @returns A key unique to the pair.
 */
function cacheKey(locale: Locale, options: Intl.NumberFormatOptions): string {
  return `${locale}\u0000${JSON.stringify(options)}`;
}

/**
 * A number formatter, from the cache or newly built.
 *
 * @param locale - The locale to format for.
 * @param options - How the number should look.
 * @returns The formatter.
 */
function numberFormatter(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = cacheKey(locale, options);
  const cached = numberFormatters.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const formatter = new Intl.NumberFormat(locale, options);
  numberFormatters.set(key, formatter);
  return formatter;
}

/**
 * Plural rules matching a set of formatter options.
 *
 * The options are passed on because `Intl.PluralRules` reads the digit ones and
 * uses them: with `minimumFractionDigits: 1`, Russian puts 21 in `other`
 * ("21,0 секунды") rather than `one` ("21 секунда"), which is the right answer
 * for a message that is about to print 21,0.
 *
 * @param locale - The locale to choose a form for.
 * @param options - The same options the number will be formatted with.
 * @returns The rules.
 */
function pluralRulesFor(locale: Locale, options: Intl.NumberFormatOptions): Intl.PluralRules {
  const key = cacheKey(locale, options);
  const cached = pluralRules.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const rules = new Intl.PluralRules(locale, options);
  pluralRules.set(key, rules);
  return rules;
}

/**
 * A list formatter, from the cache or newly built.
 *
 * @param locale - The locale to punctuate for.
 * @returns The formatter.
 */
function listFormatter(locale: Locale): Intl.ListFormat {
  const cached = listFormatters.get(locale);
  if (cached !== undefined) {
    return cached;
  }
  const formatter = new Intl.ListFormat(locale);
  listFormatters.set(locale, formatter);
  return formatter;
}

/**
 * Pairs a number with the way it should be rendered.
 *
 * @param value - The number.
 * @param format - `Intl.NumberFormat` options; none by default.
 * @returns The quantity.
 */
export function quantity(value: number, format: Intl.NumberFormatOptions = {}): Quantity {
  return { value, format };
}

/**
 * A number shown with a fixed number of decimals, as `toFixed` would.
 *
 * The replacement for the `toFixed(1)` calls scattered through the game: same
 * digits in English, a comma in Russian, and a plural category that agrees with
 * what is printed.
 *
 * @param value - The number.
 * @param fractionDigits - How many decimals to show.
 * @returns The quantity.
 */
export function decimal(value: number, fractionDigits: number): Quantity {
  return quantity(value, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * A fraction of one, shown as a percentage.
 *
 * The multiplication by a hundred belongs to `Intl` along with the sign, and
 * not because multiplying is hard: what a call site cannot be expected to know
 * is that Russian writes `72 %` with a space and English writes `72%` without
 * one. CLDR's Russian percent pattern already uses a non-breaking space, so
 * unlike the unit patterns {@link formatNumber} has to patch, this one arrives
 * unbreakable.
 *
 * @param value - The fraction; `1` is the whole of it.
 * @param fractionDigits - How many decimals to show; none by default.
 * @returns The quantity.
 */
export function percent(value: number, fractionDigits = 0): Quantity {
  return quantity(value, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * The most decimals `Intl.NumberFormat` will accept.
 *
 * Past the seventeen significant digits a double can carry, so asking for it is
 * asking for everything the number has.
 */
const MAX_FRACTION_DIGITS = 20;

/**
 * A number shown with every digit it has, however many that is.
 *
 * `Intl.NumberFormat` defaults to three decimals, which is right for prose and
 * wrong for a number the player typed. The sandbox is configured from the
 * address bar and the level bar is the only place its parameters can be
 * read back, so a rate of `0.0625` rounded to `0.063` on the way to the screen
 * is the bar reporting a building the player is not running. Worse,
 * `spawnrate=9.9999` would print `10`, which is also what `spawnrate=100000`
 * prints after clamping — two different runs, one line of text.
 *
 * The digits that come out are the shortest that identify the number, the same
 * ones `String` would write, only with the locale's decimal separator. Nothing
 * is padded: an integer stays an integer.
 *
 * @param value - The number.
 * @returns The quantity.
 */
export function exact(value: number): Quantity {
  return quantity(value, { maximumFractionDigits: MAX_FRACTION_DIGITS });
}

/**
 * A duration in seconds, shown with its unit.
 *
 * `60s` in English — the same string the game has always printed — and `60 с`
 * in Russian, with the non-breaking space Russian typography asks for.
 *
 * @param value - The duration, in seconds.
 * @param fractionDigits - How many decimals to show; none by default.
 * @returns The quantity.
 */
export function seconds(value: number, fractionDigits = 0): Quantity {
  return quantity(value, {
    style: "unit",
    unit: "second",
    unitDisplay: "narrow",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * Renders a number for a locale.
 *
 * @param locale - The locale to render for.
 * @param value - The number.
 * @param options - How it should look.
 * @returns The rendered number, e.g. `2,675` in English and `2 675` in Russian.
 */
export function formatNumber(
  locale: Locale,
  value: number,
  options: Intl.NumberFormatOptions = {},
): string {
  return unbreakable(numberFormatter(locale, options).format(value), options);
}

/**
 * Closes up the one gap a unit pattern is allowed to break at.
 *
 * Only unit patterns are touched: the grouping separator Russian uses is
 * already non-breaking, and replacing spaces everywhere would be a guess about
 * parts of the output nothing here has asked for. Applied per piece rather
 * than to the whole string so that {@link formatValueParts} can hand back two
 * halves that still join back into exactly what {@link formatNumber} writes.
 *
 * @param text - Formatter output, whole or in part.
 * @param options - The options it was formatted with.
 * @returns The same text, unbreakable where it had to be.
 */
function unbreakable(text: string, options: Intl.NumberFormatOptions): string {
  return options.style === "unit" ? text.replaceAll(" ", NO_BREAK_SPACE) : text;
}

/**
 * Renders a parameter and hands back its digits and its unit separately.
 *
 * The split is made where `Intl` itself says the unit begins — the `unit` part
 * of a unit pattern, the `percentSign` of a percentage — and whatever literal
 * stands between the number and it goes with the unit, because that separator
 * is the locale's spacing and belongs on the unit's side of any styling. The
 * two halves concatenate back into exactly {@link formatValue}'s output, which
 * this module's own tests hold it to.
 *
 * A value with no unit at all comes back as all digits and an empty unit, and
 * a string parameter — already someone's rendered output — passes through the
 * same way.
 *
 * @param locale - The locale to render for.
 * @param value - The parameter.
 * @returns Its digits and its unit.
 */
export function formatValueParts(locale: Locale, value: ParamValue): QuantityParts {
  if (typeof value === "string") {
    return { number: value, unit: "" };
  }
  const options = typeof value === "number" ? {} : (value.format ?? {});
  const parts = numberFormatter(locale, options).formatToParts(
    typeof value === "number" ? value : value.value,
  );
  const unitAt = parts.findIndex((part) => part.type === "unit" || part.type === "percentSign");
  if (unitAt === -1) {
    return { number: unbreakable(joinParts(parts), options), unit: "" };
  }
  const from = unitAt > 0 && parts[unitAt - 1]?.type === "literal" ? unitAt - 1 : unitAt;
  return {
    number: unbreakable(joinParts(parts.slice(0, from)), options),
    unit: unbreakable(joinParts(parts.slice(from)), options),
  };
}

/**
 * Puts formatter parts back together.
 *
 * @param parts - The parts, in the order the formatter produced them.
 * @returns Their text, concatenated.
 */
function joinParts(parts: readonly Intl.NumberFormatPart[]): string {
  return parts.map((part) => part.value).join("");
}

/**
 * Renders whatever a `{placeholder}` was given.
 *
 * Strings pass through untouched — they are already someone's rendered
 * output — and numbers go through `Intl.NumberFormat`, so a locale that groups
 * thousands or writes decimals with a comma does.
 *
 * @param locale - The locale to render for.
 * @param value - The parameter.
 * @returns Its text.
 */
export function formatValue(locale: Locale, value: ParamValue): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return formatNumber(locale, value);
  }
  return formatNumber(locale, value.value, value.format ?? {});
}

/**
 * A list of already-rendered items, punctuated the way the locale punctuates one.
 *
 * "6 and 9" in English, «6 и 9» in Russian, and a comma before the conjunction
 * once there are three. The conjunction is the point rather than the polish:
 * Russian writes decimals with a comma, so a comma-separated list of numbers is
 * ambiguous in the one place this is used. «вместимостью 6, 9» is also how six
 * point nine is spelled, and the sentence it sits in goes on to say «1,5
 * пассажира в секунду», which puts three commas in a row doing two different
 * jobs. A list that ends in a word cannot be read as a number.
 *
 * Items are strings rather than numbers because they arrive already rendered,
 * markup and all: the caller has had {@link formatNumber} over each of them and
 * wrapped the result in the span the level bar paints numbers with.
 *
 * @param locale - The locale whose punctuation applies.
 * @param items - The items, already rendered.
 * @returns The list; empty for no items, the item itself for one.
 */
export function formatList(locale: Locale, items: readonly string[]): string {
  return listFormatter(locale).format(items);
}

/**
 * The plural category a count falls into, for a locale.
 *
 * @param locale - The locale whose rules apply.
 * @param count - The count, with the formatting it will be shown with.
 * @returns One of `zero`, `one`, `two`, `few`, `many` or `other`.
 */
export function selectPlural(locale: Locale, count: Countable): Intl.LDMLPluralRule {
  if (typeof count === "number") {
    return pluralRulesFor(locale, {}).select(count);
  }
  return pluralRulesFor(locale, count.format ?? {}).select(count.value);
}

/**
 * The plural categories each locale actually distinguishes.
 *
 * Written down rather than derived because a type cannot be computed from
 * `Intl` at compile time, and it is the type that has to do the work: a
 * catalog entry is a mapped type over the categories of its own locale, so a
 * Russian message that forgets `few` fails to compile instead of quietly
 * printing "2 пассажиров". `format.test.ts` checks the lists against
 * `Intl.PluralRules.resolvedOptions()`, so ICU still gets the last word.
 */
export const PLURAL_CATEGORIES = {
  en: ["one", "other"],
  ru: ["one", "few", "many", "other"],
} as const satisfies Readonly<Record<Locale, readonly Intl.LDMLPluralRule[]>>;

/** The plural categories of one locale. */
export type PluralCategory<L extends Locale> = (typeof PLURAL_CATEGORIES)[L][number];

/**
 * A message that changes shape with a count, in one locale.
 *
 * Two forms in English, four in Russian, and exactly those: a missing form is a
 * compile error and an invented one is too.
 */
export type PluralForms<L extends Locale> = Readonly<Record<PluralCategory<L>, string>>;

/** A `{name}` waiting to be filled in. */
const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Fills the `{name}` placeholders of a message.
 *
 * Named rather than positional because a translation is free to reorder them,
 * and frequently has to: Russian puts the count where the sentence needs it,
 * not where English happened to leave it.
 *
 * A placeholder with no parameter is left standing rather than blanked or
 * thrown over. The types make that unreachable from our own call sites, and a
 * visible `{floor}` in the interface is a better failure than a sentence with a
 * hole in it or a game that stops.
 *
 * @param locale - The locale to render parameters for.
 * @param template - The message, with placeholders.
 * @param params - The values to fill in.
 * @returns The filled-in message.
 */
export function interpolate(
  locale: Locale,
  template: string,
  params: Readonly<Record<string, ParamValue | undefined>>,
): string {
  return template.replaceAll(PLACEHOLDER, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : formatValue(locale, value);
  });
}
