/** Number formatting, plural selection and placeholder interpolation for message catalogs, built on `Intl`. */

import type { Locale } from "./locale.ts";

/**
 * A number with the `Intl.NumberFormat` options it renders with — bundled
 * because the plural category depends on the digits shown, not just the raw
 * value (21 is `one`; 21,0 is `other`).
 */
export interface Quantity {
  /** The number itself. */
  readonly value: number;
  /** Formatting options; defaults to none. */
  readonly format?: Intl.NumberFormatOptions;
}

/** Anything a `{placeholder}` can be filled with. */
export type ParamValue = string | number | Quantity;

/**
 * A rendered quantity with its unit kept separate from its digits, for
 * callers that style them differently (e.g. the stats tiles' `<small>` unit).
 */
export interface QuantityParts {
  /** The digits, punctuated for the locale. */
  readonly number: string;
  /** The unit and whatever separates it from the digits; `""` when there is no unit. */
  readonly unit: string;
}

/** Anything that can drive the choice of a plural form. */
export type Countable = number | Quantity;

/** CLDR's Russian unit pattern uses a plain space; this makes it non-breaking after formatting. */
const NO_BREAK_SPACE = "\u00a0";

/** Cached formatters, keyed by locale and options; building one is not cheap. */
const numberFormatters = new Map<string, Intl.NumberFormat>();

/** Cached plural rules, keyed the same way. */
const pluralRules = new Map<string, Intl.PluralRules>();

/** Cached list formatters, keyed by locale alone; they take no options here. */
const listFormatters = new Map<Locale, Intl.ListFormat>();

/**
 * Cache key for a locale and options. Option objects that differ only in
 * property order get separate, harmless duplicate entries.
 *
 * The two halves are joined with `\u0000`, which cannot occur in a locale
 * tag or in the JSON, so no pair of inputs can collide on one key.
 */
function cacheKey(locale: Locale, options: Intl.NumberFormatOptions): string {
  return `${locale}\u0000${JSON.stringify(options)}`;
}

/** A number formatter, from the cache or newly built. */
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
 * Plural rules for a locale and options. The options matter because
 * `Intl.PluralRules` reads the digit settings: with one decimal, Russian
 * puts 21 in `other` ("21,0 секунды"), not `one` ("21 секунда").
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

/** A list formatter, from the cache or newly built. */
function listFormatter(locale: Locale): Intl.ListFormat {
  const cached = listFormatters.get(locale);
  if (cached !== undefined) {
    return cached;
  }
  const formatter = new Intl.ListFormat(locale);
  listFormatters.set(locale, formatter);
  return formatter;
}

/** Pairs a number with the way it should be rendered. */
export function quantity(value: number, format: Intl.NumberFormatOptions = {}): Quantity {
  return { value, format };
}

/**
 * A number with a fixed number of decimals, like `toFixed`, but locale-aware:
 * a comma in Russian and a plural category that agrees with what's printed.
 */
export function decimal(value: number, fractionDigits: number): Quantity {
  return quantity(value, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * A fraction of one (`1` is the whole of it), shown as a percentage.
 * Russian writes `72 %` with a space, English `72%` without — `Intl` handles
 * it, and unlike {@link formatNumber}'s units, the Russian space already
 * arrives non-breaking.
 */
export function percent(value: number, fractionDigits = 0): Quantity {
  return quantity(value, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** The most decimals `Intl.NumberFormat` accepts — past what a double can carry. */
const MAX_FRACTION_DIGITS = 20;

/**
 * A number shown with every digit it has. `Intl.NumberFormat` defaults to
 * three decimals, which would round a sandbox parameter the goal bar reads
 * back from the address bar, misreporting the building the player is running.
 */
export function exact(value: number): Quantity {
  return quantity(value, { maximumFractionDigits: MAX_FRACTION_DIGITS });
}

/** A duration in seconds with its unit: `60s` in English, `60 с` in Russian. */
export function seconds(value: number, fractionDigits = 0): Quantity {
  return quantity(value, {
    style: "unit",
    unit: "second",
    unitDisplay: "narrow",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Renders a number for a locale, e.g. `2,675` in English and `2 675` in Russian. */
export function formatNumber(
  locale: Locale,
  value: number,
  options: Intl.NumberFormatOptions = {},
): string {
  return unbreakable(numberFormatter(locale, options).format(value), options);
}

/**
 * Makes a unit pattern's space non-breaking. Only unit patterns are touched;
 * Russian's grouping separator is already non-breaking. Applied per piece so
 * {@link formatValueParts} can still rejoin into {@link formatNumber}'s output.
 */
function unbreakable(text: string, options: Intl.NumberFormatOptions): string {
  return options.style === "unit" ? text.replaceAll(" ", NO_BREAK_SPACE) : text;
}

/**
 * Renders a parameter, splitting its unit from its digits at the point
 * `Intl` itself marks the unit's start. The two halves concatenate back into
 * exactly {@link formatValue}'s output (checked by this module's tests).
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

/** Puts formatter parts back together. */
function joinParts(parts: readonly Intl.NumberFormatPart[]): string {
  return parts.map((part) => part.value).join("");
}

/** Renders whatever a `{placeholder}` was given: strings pass through, numbers go through `Intl.NumberFormat`. */
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
 * Joins already-rendered items with the locale's own conjunction ("6 and 9",
 * «6 и 9»): Russian writes decimals with a comma, so a plain comma-separated
 * list of numbers would be ambiguous next to a rate like «1,5».
 */
export function formatList(locale: Locale, items: readonly string[]): string {
  return listFormatter(locale).format(items);
}

/** The plural category a count falls into, for a locale. */
export function selectPlural(locale: Locale, count: Countable): Intl.LDMLPluralRule {
  if (typeof count === "number") {
    return pluralRulesFor(locale, {}).select(count);
  }
  return pluralRulesFor(locale, count.format ?? {}).select(count.value);
}

/**
 * The plural categories each locale distinguishes, written down because
 * `Intl` can't be queried at compile time. A catalog entry is a mapped type
 * over these, so a forgotten `few` fails to compile; `format.test.ts` checks
 * the lists against `Intl.PluralRules.resolvedOptions()`.
 */
export const PLURAL_CATEGORIES = {
  en: ["one", "other"],
  ru: ["one", "few", "many", "other"],
} as const satisfies Readonly<Record<Locale, readonly Intl.LDMLPluralRule[]>>;

/** The plural categories of one locale. */
export type PluralCategory<L extends Locale> = (typeof PLURAL_CATEGORIES)[L][number];

/** A message that changes shape with a count: a missing or invented form is a compile error. */
export type PluralForms<L extends Locale> = Readonly<Record<PluralCategory<L>, string>>;

/** A `{name}` waiting to be filled in. */
const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Fills a message's `{name}` placeholders. Named, not positional, since a
 * translation may need to reorder them. A placeholder with no matching
 * param is left standing, a better failure than a blank or a crash.
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
