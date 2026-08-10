/**
 * The front door of the i18n module: the active locale, and `t`.
 *
 * Everything else here is deliberately stateless — {@link translate} takes the
 * locale and the catalogue it renders with, so tests can render two languages
 * side by side — and this module is the one place that remembers which locale
 * is on screen. One mutable binding, changed through {@link setLocale} and read
 * through {@link getLocale}, which is as much global state as an interface with
 * one language at a time can be built on without threading a context through
 * every template.
 *
 * Nothing is wired up here: no listener, no document attribute, no storage read
 * at import time. Setting the locale when the page loads, putting
 * {@link htmlLang} on `<html>` and re-rendering what is already drawn belong to
 * the call sites, and doing any of it from a module's import side effects would
 * make the module impossible to test and the page's start-up order impossible
 * to follow.
 *
 * Adding a language is: one new catalogue file, one member of {@link Locale},
 * one entry in {@link CATALOGUES}. The compiler finds everything else.
 */

import {
  translate,
  type MessageArgs,
  type MessageCatalogue,
  type MessageKey,
} from "./catalogue.ts";
import { EN_MESSAGES } from "./en.ts";
import { formatTimeOfDay, formatValue, type ParamValue } from "./format.ts";
import { DEFAULT_LOCALE, type Locale } from "./locale.ts";
import { RU_MESSAGES } from "./ru.ts";

/**
 * Every catalogue, by locale.
 *
 * A mapped type rather than a plain record, so each entry is checked against
 * its own locale: the Russian catalogue must have Russian's four plural forms
 * and the English one must have English's two. This is where a new language is
 * registered, and where a language whose catalogue is incomplete stops being
 * compilable.
 */
export const CATALOGUES: { readonly [L in Locale]: MessageCatalogue<L> } = {
  en: EN_MESSAGES,
  ru: RU_MESSAGES,
};

/** The locale the interface is currently in. */
let activeLocale: Locale = DEFAULT_LOCALE;

/**
 * The locale the interface is currently in.
 *
 * @returns The active locale.
 */
export function getLocale(): Locale {
  return activeLocale;
}

/**
 * Switches the interface to another locale.
 *
 * Only changes what {@link t} and {@link format} answer with from here on:
 * text already in the document stays as it was drawn, so a caller that switches
 * language has to redraw. Deliberately not this module's decision — how much of
 * the page is worth rebuilding is something only the page knows.
 *
 * @param locale - The locale to switch to.
 */
export function setLocale(locale: Locale): void {
  activeLocale = locale;
}

/**
 * A message, in the active locale.
 *
 * @param key - The message wanted.
 * @param args - Its parameters, if it takes any.
 * @returns The rendered message.
 */
export function t<K extends MessageKey>(key: K, ...args: MessageArgs<K>): string {
  return translateIn(activeLocale, key, ...args);
}

/**
 * A message, in a locale named outright.
 *
 * For everything that has to name its language rather than take the current
 * one: the language picker, a test comparing two catalogues, and any future
 * caller that renders text for somewhere other than the screen in front of it.
 *
 * @param locale - The locale to render in.
 * @param key - The message wanted.
 * @param args - Its parameters, if it takes any.
 * @returns The rendered message.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- L is what makes CATALOGUES[locale] the catalogue for *that* locale, with that locale's plural forms; without it the lookup widens to a union no catalogue satisfies
export function translateIn<L extends Locale, K extends MessageKey>(
  locale: L,
  key: K,
  ...args: MessageArgs<K>
): string {
  const catalogue: MessageCatalogue<L> = CATALOGUES[locale];
  return translate(locale, catalogue, key, ...args);
}

/**
 * A number, a quantity or a piece of already-rendered text, in the active
 * locale.
 *
 * The counterpart to {@link t} for the values that are shown on their own,
 * outside any sentence: the figures in the statistics panel, and the parameters
 * a caller renders before handing them to a message. `format(seconds(60))` is
 * `60s` in English and `60 с` in Russian, with the non-breaking space Russian
 * typography asks for.
 *
 * @param value - What to render.
 * @returns Its text in the active locale.
 */
export function format(value: ParamValue): string {
  return formatValue(activeLocale, value);
}

/**
 * A time of day, in the active locale.
 *
 * @param when - The moment to show.
 * @returns The time, as a reader of the active locale writes it.
 */
export function formatTime(when: Date): string {
  return formatTimeOfDay(activeLocale, when);
}

export {
  translate,
  type MessageArgs,
  type MessageCatalogue,
  type MessageKey,
} from "./catalogue.ts";
export {
  browserLocaleSources,
  localeFromLanguages,
  localeFromQuery,
  readStoredLocale,
  resolveLocale,
  storeLocale,
  LOCALE_QUERY_KEY,
  LOCALE_STORAGE_KEY,
  type LocaleSources,
} from "./detect.ts";
export { EN_MESSAGES } from "./en.ts";
export {
  decimal,
  formatNumber,
  formatTimeOfDay,
  formatValue,
  quantity,
  seconds,
  selectPlural,
  PLURAL_CATEGORIES,
  type Countable,
  type ParamValue,
  type PluralCategory,
  type PluralForms,
  type Quantity,
} from "./format.ts";
export {
  htmlLang,
  isLocale,
  DEFAULT_LOCALE,
  LOCALE_NAMES,
  LOCALES,
  type Locale,
} from "./locale.ts";
export { RU_MESSAGES } from "./ru.ts";
