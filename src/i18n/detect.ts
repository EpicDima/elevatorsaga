/**
 * Working out which language to show the game in.
 *
 * Four sources, in falling order of how deliberate they are:
 *
 * 1. `lang` in the location hash — `#level=3,lang=ru`. Explicit, and it is
 *    what a shared link carries, so it wins even over a stored preference: the
 *    person who sent the link chose the language on purpose.
 * 2. `localStorage` — what this player picked last time, on this machine.
 * 3. `navigator.languages` — what the browser has been told the reader reads.
 * 4. English, which every string exists in by construction.
 *
 * Nothing here reads a global or touches the document on its own;
 * {@link browserLocaleSources} is the one function that looks at the browser,
 * and it is the caller who decides when. That keeps the resolution order
 * testable as a plain function of its inputs, and it keeps this module out of
 * the way of the wiring that comes next.
 */

import { parseQuery } from "../shared/lib/route-query.ts";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./locale.ts";

/**
 * The hash parameter that names a language: `#lang=ru`.
 *
 * Spelled the way the HTML attribute and HTTP header are, since that is what
 * anyone typing it into the address bar will guess first.
 */
export const LOCALE_QUERY_KEY = "lang";

/**
 * Where the chosen language is remembered between visits.
 *
 * Named like {@link "../pages/game/index.ts"!TIME_SCALE_STORAGE_KEY}, the other
 * preference this game keeps, so the pair is recognizable in a devtools storage
 * pane and cannot collide with whatever else is served from the same origin.
 */
export const LOCALE_STORAGE_KEY = "elevatorLocale";

/**
 * Everything {@link resolveLocale} is allowed to look at.
 *
 * Each source is optional, and a missing one is simply skipped: a page with no
 * hash, a browser with no usable storage and a runtime with no `navigator` are
 * all ordinary situations rather than errors.
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
 *
 * Parsed with the router's own {@link parseQuery} rather than a second regexp,
 * so `#lang=ru` behaves like every other parameter: same separators, same
 * trimming, same tolerance of the order they were written in.
 *
 * @param hash - The location hash, with or without its `#`.
 * @returns The locale, or `undefined` when the hash names none or names one
 * the game has no catalog for.
 */
export function localeFromQuery(hash: string): Locale | undefined {
  return matchLocale(parseQuery(hash).get(LOCALE_QUERY_KEY));
}

/**
 * The remembered locale, if there is a usable one.
 *
 * Reading storage is wrapped because reading storage can throw: a browser told
 * to block cookies for the site, or Safari in a private window, raises a
 * `SecurityError` from `getItem` rather than returning nothing. The game runs
 * fine without a remembered language, so the failure is worth exactly one
 * `catch` and no more — the same shape `readStoredTimeScale` uses for the
 * other stored preference.
 *
 * @param storage - Where the preference is remembered.
 * @returns The stored locale, or `undefined` when there is no usable one.
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
 * Remembers a locale for next time.
 *
 * Writing can throw for the reasons reading can, and for one more: a full quota.
 * Losing the preference is a small thing; a language switch that throws instead
 * of switching is not, so the failure is swallowed here too.
 *
 * @param storage - Where to remember it.
 * @param locale - The locale the player chose.
 * @returns Whether it was actually written, for a caller that wants to know.
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
 * The first browser-preferred language the game has a catalog for.
 *
 * Region subtags are dropped: `ru-RU`, `ru-BY` and `ru` all mean the Russian
 * catalog, and a reader whose browser says `en-GB` should not fall through to
 * a language they did not ask for just because the game has no British English.
 *
 * @param languages - Preferred languages, best first.
 * @returns The best match, or `undefined` when none of them match.
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

/**
 * The locale to show the game in.
 *
 * @param sources - Where to look; anything missing is skipped.
 * @returns The first locale the sources agree the game can show, or
 * {@link DEFAULT_LOCALE}.
 */
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
 * The three sources as this browser has them.
 *
 * Every one of them is read behind its own `catch`, because every one of them
 * can throw in some browser or other: `localStorage` when storage is blocked,
 * and `navigator.languages` in the sandboxed frames some embedders use. A
 * source that cannot be read is left out, and {@link resolveLocale} then falls
 * through to the next.
 *
 * @returns What is readable here, ready to hand to {@link resolveLocale}.
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

/**
 * Turns a language tag into one of the game's locales.
 *
 * @param tag - A tag such as `ru`, `RU`, `ru-RU` or nothing at all.
 * @returns The locale it names, or `undefined`.
 */
function matchLocale(tag: string | undefined): Locale | undefined {
  if (tag === undefined) {
    return undefined;
  }
  const language = tag.trim().split("-")[0]?.toLowerCase() ?? "";
  return isLocale(language) ? language : undefined;
}
