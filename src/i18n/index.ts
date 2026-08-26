/**
 * The active locale, the catalogs loaded so far, and `t`; English is bundled
 * and every other catalog is a dynamic import, fetched by {@link loadLocale}.
 */

import { translate, type MessageArgs, type MessageCatalog, type MessageKey } from "./catalog.ts";
import { EN_MESSAGES } from "./en.ts";
// Renamed on import: this module exports its own `formatList`, for the
// active locale, and reserves the "In" suffix for a locale named outright.
import {
  formatList as formatListIn,
  formatValue,
  formatValueParts,
  type ParamValue,
  type QuantityParts,
} from "./format.ts";
import { DEFAULT_LOCALE, type Locale } from "./locale.ts";

/**
 * The catalogs that can be rendered from right now. A record, not a `Map`,
 * so each entry keeps its own locale's type — a `Map` would collapse them
 * into a union no single catalog satisfies (Russian's four plural forms and
 * English's two, demanded of both).
 */
const catalogs: { -readonly [L in Locale]?: MessageCatalog<L> } = { en: EN_MESSAGES };

/**
 * How each locale's catalog is fetched and filed; this is where a new
 * language is registered. A loader files its catalog into {@link catalogs}
 * rather than resolving with it, since assigning through a literal locale
 * key is fully type-checked while a generic one is not. Callers want
 * {@link loadLocale}, which also dedupes the fetch.
 */
export const CATALOG_LOADERS: Readonly<Record<Locale, () => Promise<void>>> = {
  // English is bundled and already in `catalogs`; kept as an entry so
  // `loadLocale` needs no special case for it.
  en: () => Promise.resolve(),
  ru: async () => {
    catalogs.ru = (await import("./ru.ts")).RU_MESSAGES;
  },
};

/** Loads in flight or already finished, so a catalog is fetched once; an entry is removed again if the load failed, so a dropped request gets retried. */
const loads = new Map<Locale, Promise<void>>();

/** The locale the interface is currently in. */
let activeLocale: Locale = DEFAULT_LOCALE;

/**
 * The locale the interface is currently in — what the player chose, not what
 * is on screen. Between {@link setLocale} and the arrival of that locale's
 * catalog the two differ; this is the one a picker should show as selected.
 */
export function getLocale(): Locale {
  return activeLocale;
}

/** Whether a locale's catalog is in memory and can be rendered without waiting for anything. */
export function isLocaleLoaded(locale: Locale): boolean {
  return catalogs[locale] !== undefined;
}

/**
 * Fetches a locale's catalog, if it is not here already. Never rejects: a
 * catalog that cannot be fetched falls back to English, with the failure
 * logged once, rather than forcing a `catch` on every call site.
 */
export function loadLocale(locale: Locale): Promise<void> {
  const started = loads.get(locale);
  if (started !== undefined) {
    return started;
  }
  // Attached here, not inside the loader, so it cannot run before the `set`
  // below: a promise callback always runs a microtask later, while a loader
  // that threw synchronously would delete an entry not yet made.
  const load = CATALOG_LOADERS[locale]().catch((error: unknown) => {
    loads.delete(locale); // Lets a later attempt fetch again instead of replaying this failure.
    console.warn(`Could not load the ${locale} messages; staying in ${DEFAULT_LOCALE}`, error);
  });
  loads.set(locale, load);
  return load;
}

/**
 * Switches the interface to another locale. Only changes what {@link t} and
 * {@link format} answer with from here on — text already drawn stays as it
 * was, so a caller that switches language has to redraw itself. Synchronous,
 * so a caller that wants the switch to take effect in one step should
 * `await` {@link loadLocale} first.
 */
export function setLocale(locale: Locale): void {
  activeLocale = locale;
  if (!isLocaleLoaded(locale)) {
    void loadLocale(locale); // Fire and forget: loadLocale never rejects.
  }
}

/**
 * The locale the interface can actually be rendered in right now:
 * {@link getLocale} once its catalog has arrived, {@link DEFAULT_LOCALE}
 * while it is still on its way.
 */
function renderingLocale(): Locale {
  return isLocaleLoaded(activeLocale) ? activeLocale : DEFAULT_LOCALE;
}

/** A message, in the active locale. */
export function t<K extends MessageKey>(key: K, ...args: MessageArgs<K>): string {
  return translateIn(activeLocale, key, ...args);
}

/**
 * A message, in a locale named outright, for a caller that must not follow
 * the active one (the language picker, a test comparing two catalogs). A
 * locale whose catalog is not loaded renders the whole message in English
 * rather than half-translating it.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- L is what makes catalogs[locale] the catalog for *that* locale, with that locale's plural forms; without it the lookup widens to a union no catalog satisfies
export function translateIn<L extends Locale, K extends MessageKey>(
  locale: L,
  key: K,
  ...args: MessageArgs<K>
): string {
  const catalog: MessageCatalog<L> | undefined = catalogs[locale];
  if (catalog === undefined) {
    return translate(DEFAULT_LOCALE, EN_MESSAGES, key, ...args);
  }
  return translate(locale, catalog, key, ...args);
}

/**
 * A number, a quantity or a piece of already-rendered text, in the active
 * locale — the counterpart to {@link t} for values shown outside any
 * sentence, such as the statistics panel's figures.
 */
export function format(value: ParamValue): string {
  return formatValue(renderingLocale(), value);
}

/** The same rendering as {@link format}, with the unit handed back on its own, for a caller that styles it differently from the digits. */
export function formatParts(value: ParamValue): QuantityParts {
  return formatValueParts(renderingLocale(), value);
}

/**
 * A list of already-rendered items, punctuated for the active locale. For a
 * list whose length is not known until it is drawn — a catalog entry is a
 * sentence and cannot loop.
 */
export function formatList(items: readonly string[]): string {
  return formatListIn(renderingLocale(), items);
}

export { translate, type MessageArgs, type MessageCatalog, type MessageKey } from "./catalog.ts";
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
// English only: re-exporting Russian's catalog here would be a static
// import, pulling it into every consumer's bundle. Tests that want it as
// data import it from "./ru.ts" directly.
export { EN_MESSAGES } from "./en.ts";
export {
  decimal,
  exact,
  formatNumber,
  formatValue,
  formatValueParts,
  percent,
  quantity,
  seconds,
  selectPlural,
  PLURAL_CATEGORIES,
  type Countable,
  type ParamValue,
  type PluralCategory,
  type PluralForms,
  type Quantity,
  type QuantityParts,
} from "./format.ts";
export {
  htmlLang,
  isLocale,
  DEFAULT_LOCALE,
  LOCALE_NAMES,
  LOCALES,
  type Locale,
} from "./locale.ts";
