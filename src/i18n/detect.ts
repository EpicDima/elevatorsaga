/**
 * Working out which language to show the game in: the location hash
 * (`#lang=ru`, a shared link's explicit choice), then `localStorage`, then
 * `navigator.languages`, then English. Nothing here reads a global on its
 * own — {@link browserLocaleSources} is the one function that looks at the
 * browser — which keeps the resolution order testable as a plain function.
 */

import { parseQuery } from "../shared/lib/route-query.ts";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./locale.ts";

/** The hash parameter that names a language: `#lang=ru`, spelled like the HTML attribute and HTTP header. */
export const LOCALE_QUERY_KEY = "lang";

/** Where the chosen language is remembered between visits. */
export const LOCALE_STORAGE_KEY = "elevatorLocale";

/**
 * Everything {@link resolveLocale} is allowed to look at. Each source is
 * optional, and a missing one is simply skipped — a page with no hash or a
 * runtime with no `navigator` is ordinary rather than an error.
 */
export interface LocaleSources {
  /** The location hash, with or without its `#`. */
  readonly hash?: string | undefined;
  /** Where the preference is remembered; normally `localStorage`. */
  readonly storage?: Storage | undefined;
  /** Preferred languages, best first; normally `navigator.languages`. */
  readonly languages?: readonly string[] | undefined;
}

/**
 * The locale a location hash asks for, if it asks for one the game speaks.
 * Parsed with the router's own {@link parseQuery} rather than a second
 * regexp, so `#lang=ru` behaves like every other parameter.
 */
export function localeFromQuery(hash: string): Locale | undefined {
  return matchLocale(parseQuery(hash).get(LOCALE_QUERY_KEY));
}

/**
 * The remembered locale, if there is a usable one. Wrapped because reading
 * storage can throw — a browser blocking cookies, or Safari in a private
 * window, raises a `SecurityError` from `getItem` rather than returning
 * nothing — and the game runs fine without a remembered language.
 */
export function readStoredLocale(storage: Storage): Locale | undefined {
  let stored: string | null;
  try {
    stored = storage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return undefined;
  }
  return stored === null ? undefined : matchLocale(stored);
}

/**
 * Remembers a locale for next time. Writing can throw for the reasons
 * reading can, plus a full quota; losing the preference is a small thing, so
 * the failure is swallowed here too rather than breaking the language switch.
 */
export function storeLocale(storage: Storage, locale: Locale): boolean {
  try {
    storage.setItem(LOCALE_STORAGE_KEY, locale);
    return true;
  } catch {
    return false;
  }
}

/**
 * The first browser-preferred language the game has a catalog for. Region
 * subtags are dropped: `ru-RU`, `ru-BY` and `ru` all mean the Russian
 * catalog, so a reader is never bounced to a language they didn't ask for.
 */
export function localeFromLanguages(languages: readonly string[]): Locale | undefined {
  for (const language of languages) {
    const locale = matchLocale(language);
    if (locale !== undefined) {
      return locale;
    }
  }
  return undefined;
}

/** The locale to show the game in: the first source that names one, or {@link DEFAULT_LOCALE}. */
export function resolveLocale(sources: LocaleSources = {}): Locale {
  const { hash, storage, languages } = sources;
  return (
    (hash === undefined ? undefined : localeFromQuery(hash)) ??
    (storage === undefined ? undefined : readStoredLocale(storage)) ??
    (languages === undefined ? undefined : localeFromLanguages(languages)) ??
    DEFAULT_LOCALE
  );
}

/**
 * The three sources as this browser has them. Each is read behind its own
 * `catch`, since each can throw in some browser or other — `localStorage`
 * when storage is blocked, `navigator.languages` in a sandboxed frame — and
 * a source that cannot be read is simply left out.
 */
export function browserLocaleSources(): LocaleSources {
  let storage: Storage | undefined;
  try {
    storage = localStorage;
  } catch {
    storage = undefined;
  }
  let languages: readonly string[] | undefined;
  try {
    languages = navigator.languages;
  } catch {
    languages = undefined;
  }
  return { hash: location.hash, storage, languages };
}

/** Turns a language tag such as `ru`, `RU` or `ru-RU` into one of the game's locales, or `undefined`. */
function matchLocale(tag: string | undefined): Locale | undefined {
  if (tag === undefined) {
    return undefined;
  }
  const language = tag.trim().split("-")[0]?.toLowerCase() ?? "";
  return isLocale(language) ? language : undefined;
}
