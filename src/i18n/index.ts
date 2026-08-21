/**
 * The front door of the i18n module: the active locale, the catalogs that
 * have been loaded, and `t`.
 *
 * Everything else here is deliberately stateless — {@link translate} takes the
 * locale and the catalog it renders with, so tests can render two languages
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
 * ## Why a catalog is fetched rather than bundled
 *
 * A catalog is the better part of forty kilobytes of text, and a static
 * import of one puts it in every chunk that reaches a `t()`. Measured on this
 * build with both catalogs imported statically, the page's entry chunk was
 * 135.87 kB and the fitness worker was 95.32 kB, each of them carrying every
 * catalog in the repository whatever language the reader turned out to want.
 * That is the cost that scales: a third and a fourth would land in both figures
 * too, and be paid in full by every visit. Every catalog but English is
 * therefore an `import()` of its own, which the bundler emits as a chunk of its
 * own and a browser fetches when {@link loadLocale} asks for it — so a run
 * downloads the one language it is being read in, and the worker downloads the
 * one its request named.
 *
 * English is the exception and stays statically imported, for two reasons that
 * are really one. It is {@link DEFAULT_LOCALE}, so the overwhelmingly common
 * visit needs it immediately and a fetch would only add a round trip in front
 * of the first frame. And it is the fallback: {@link t} is synchronous, called
 * from error paths, from a worker and from template functions that return
 * strings, so it cannot wait for anything — yet a message may be asked for
 * before its catalog has arrived, or after a fetch that failed. Having
 * English in memory from the first tick is what turns that from "the player
 * sees `game.button.start`" into "the player sees English for a moment".
 *
 * The alternative was to split English too and have the start-up sequence await
 * it before drawing. Rejected: it makes the no-raw-keys guarantee a property of
 * one call site's ordering rather than of this module, and every later `t()`
 * added to an error path — the very places that run when the ordinary sequence
 * has gone wrong — would be a new chance to break it.
 *
 * ## What a caller has to do
 *
 * Await {@link loadLocale} before {@link setLocale}, and the interface changes
 * language in one step. Call {@link setLocale} alone and the interface stays
 * English until the catalog lands — the load is started for you, so it does
 * land, but nothing redraws on its own.
 *
 * Adding a language is: one new catalog file, one member of {@link Locale},
 * one entry in {@link CATALOG_LOADERS}. The compiler finds everything else.
 */

import { translate, type MessageArgs, type MessageCatalog, type MessageKey } from "./catalog.ts";
import { EN_MESSAGES } from "./en.ts";
// `formatListIn` is `format.ts`'s `formatList` under the name this module gives
// anything that takes its locale outright, as `translateIn` does. The export
// below is the one callers want: the same thing for the locale on screen.
import {
  formatList as formatListIn,
  formatValue,
  formatValueParts,
  type ParamValue,
  type QuantityParts,
} from "./format.ts";
import { DEFAULT_LOCALE, type Locale } from "./locale.ts";

/**
 * The catalogs that can be rendered from right now.
 *
 * Optional per locale, and not a `Map`, so that every entry keeps the type of
 * its own locale: `catalogs.ru` is a `MessageCatalog<"ru">` and nothing
 * else, which is what lets {@link translateIn} hand a catalog to
 * {@link translate} without a cast. A `Map<Locale, MessageCatalog<Locale>>`
 * would have collapsed all of them into one union that no single catalog
 * satisfies — Russian's four plural forms and English's two, demanded of both.
 *
 * English is in it from the start, being the one catalog that is bundled.
 */
const catalogs: { -readonly [L in Locale]?: MessageCatalog<L> } = { en: EN_MESSAGES };

/**
 * How each locale's catalog is fetched and filed.
 *
 * This is where a new language is registered, and where a language whose
 * catalog is incomplete stops being compilable: each entry assigns to the
 * slot of its own locale in {@link catalogs}, so the Russian one is checked
 * for Russian's four plural forms and the English one for English's two. The
 * dynamic `import()` is inside that check rather than around it — TypeScript
 * reads `ru.ts` at compile time whether the browser fetches it at run time or
 * not — so splitting the catalogs out costs none of the checking that a
 * missing, misspelled or wrongly-parameterised key used to get.
 *
 * A loader files its catalog rather than resolving with it, because a
 * function that resolved with `MessageCatalog<L>` would have to be stored
 * through a generic index, and TypeScript will not check an assignment to
 * `catalogs[locale]` when `locale` is a type parameter: it collapses the
 * target to the intersection of every locale's catalog and rejects all of
 * them. Filing it here keeps each locale's key written out literally, which is
 * the one form that is fully checked.
 *
 * Exported as the registry rather than as a way of getting a catalog:
 * {@link loadLocale} is what call sites want, since it also makes sure a
 * catalog is fetched once rather than once per caller.
 */
export const CATALOG_LOADERS: Readonly<Record<Locale, () => Promise<void>>> = {
  // Nothing to fetch: English is bundled, and is in `catalogs` before this
  // module has finished evaluating. Kept as an entry so that every locale has
  // one and `loadLocale` has no special case.
  en: () => Promise.resolve(),
  ru: async () => {
    catalogs.ru = (await import("./ru.ts")).RU_MESSAGES;
  },
};

/**
 * Loads in flight or already finished, so a catalog is fetched once.
 *
 * Two callers asking for Russian at the same moment — the start-up sequence and
 * a picker the player was quick with — share the one fetch and both settle when
 * it lands. An entry is removed again if the load failed, so a language is not
 * written off for the session because the network dropped one response.
 */
const loads = new Map<Locale, Promise<void>>();

/** The locale the interface is currently in. */
let activeLocale: Locale = DEFAULT_LOCALE;

/**
 * The locale the interface is currently in.
 *
 * What the player chose, not what is on screen: between {@link setLocale} and
 * the arrival of that locale's catalog the two differ, and it is this one
 * that a picker should show as selected, that a link should carry and that the
 * fitness worker should be told to report in.
 *
 * @returns The active locale.
 */
export function getLocale(): Locale {
  return activeLocale;
}

/**
 * Whether a locale can be rendered without waiting for anything.
 *
 * True for {@link DEFAULT_LOCALE} from the first tick, and for any other locale
 * once {@link loadLocale} has resolved for it. Exported for the callers that
 * have a choice between answering now and answering right: the fitness worker
 * uses it to keep a request in the default language exactly as prompt as it was
 * before the catalogs were split.
 *
 * @param locale - The locale in question.
 * @returns Whether its catalog is in memory.
 */
export function isLocaleLoaded(locale: Locale): boolean {
  return catalogs[locale] !== undefined;
}

/**
 * Fetches a locale's catalog, if it is not here already.
 *
 * The one place waiting is possible, and therefore the one place the loading
 * happens: a locale chosen at start-up, a locale chosen by the picker, a locale
 * sent to the worker. Everything downstream of it — {@link t}, {@link format},
 * every template function that returns a string — stays synchronous.
 *
 * Never rejects. A catalog that cannot be fetched is a bad network or a
 * half-deployed build, and neither is worth taking down the caller for: the
 * game runs in English, which is the wrong language but a real answer, and the
 * same failure that produced it is written to the console once. Rejecting would
 * put a `catch` on every call site, and the one call site that forgot would be
 * the fitness worker dying with a player's report half-written.
 *
 * @param locale - The locale to load.
 * @returns A promise that settles when the locale can be rendered, or when it
 * has been established that it cannot.
 */
export function loadLocale(locale: Locale): Promise<void> {
  const started = loads.get(locale);
  if (started !== undefined) {
    return started;
  }
  // The `catch` is attached here rather than written into the loaders so that
  // it cannot run before the `set` below: a callback attached to a promise
  // always runs in a later microtask, whereas a `try`/`catch` inside a loader
  // would run synchronously for an `import()` that threw rather than rejected,
  // and would then be deleting an entry that had not been made yet.
  const load = CATALOG_LOADERS[locale]().catch((error: unknown) => {
    // So that a later attempt -- the player trying the picker again, or the
    // next fitness run -- fetches rather than replaying this failure.
    loads.delete(locale);
    console.warn(`Could not load the ${locale} messages; staying in ${DEFAULT_LOCALE}`, error);
  });
  loads.set(locale, load);
  return load;
}

/**
 * Switches the interface to another locale.
 *
 * Only changes what {@link t} and {@link format} answer with from here on:
 * text already in the document stays as it was drawn, so a caller that switches
 * language has to redraw. Deliberately not this module's decision — how much of
 * the page is worth rebuilding is something only the page knows.
 *
 * Synchronous, and stays synchronous, because a great deal of code calls it
 * without having anywhere to wait. What it cannot do synchronously is conjure a
 * catalog that has not been fetched: until that one arrives the interface
 * renders in {@link DEFAULT_LOCALE}. The fetch is started here so that it does
 * arrive, but a caller that wants the switch to take effect in one step —
 * everything with a redraw after it — should `await` {@link loadLocale} first.
 *
 * @param locale - The locale to switch to.
 */
export function setLocale(locale: Locale): void {
  activeLocale = locale;
  if (!isLocaleLoaded(locale)) {
    // Fire and forget: this function has no one to report to. `loadLocale`
    // never rejects, so the floating promise cannot become an unhandled
    // rejection, and the next thing to be drawn after it settles is in the
    // language the player asked for.
    void loadLocale(locale);
  }
}

/**
 * The locale the interface can actually be rendered in at this moment.
 *
 * {@link getLocale} for a locale whose catalog is here, and
 * {@link DEFAULT_LOCALE} for one that is still on its way. Numbers and times go
 * through it as well as words, so a page waiting for a catalog is English
 * throughout rather than English sentences with Russian decimal commas in them.
 *
 * @returns The locale to render with.
 */
function renderingLocale(): Locale {
  return isLocaleLoaded(activeLocale) ? activeLocale : DEFAULT_LOCALE;
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
 * one: the language picker, a test comparing two catalogs, and any future
 * caller that renders text for somewhere other than the screen in front of it.
 *
 * A locale whose catalog has not been loaded renders in English — the whole
 * message, and its numbers with it, since half-translating a sentence would be
 * worse than not translating it. {@link isLocaleLoaded} is how a caller that
 * cares can tell the difference beforehand.
 *
 * @param locale - The locale to render in.
 * @param key - The message wanted.
 * @param args - Its parameters, if it takes any.
 * @returns The rendered message.
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
  return formatValue(renderingLocale(), value);
}

/**
 * The same rendering as {@link format}, with the unit handed back on its own.
 *
 * For a caller that sets the unit differently from the digits — the statistics
 * tiles, which drop it a size and a shade — and for nothing else:
 * anything writing a figure into a sentence wants {@link format}, which is the
 * two halves already joined.
 *
 * @param value - What to render.
 * @returns Its digits and its unit in the active locale.
 */
export function formatParts(value: ParamValue): QuantityParts {
  return formatValueParts(renderingLocale(), value);
}

/**
 * A list of already-rendered items, in the active locale.
 *
 * For the one thing a message cannot hold: a list whose length is not known
 * until it is drawn. A catalog entry is a sentence, and a sentence cannot
 * loop, so the loop happens at the call site and the punctuation between the
 * items has to come from somewhere — here, rather than from a `", "` that
 * would be English pretending to be universal.
 *
 * @param items - The items, already rendered.
 * @returns The list, punctuated as a reader of the active locale expects.
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
// English only. A re-export is a static import, and re-exporting the Russian
// catalog from the module every consumer goes through is precisely what put
// it in the page's entry chunk and in the fitness worker. The three files that
// want a catalog as data -- `catalog.test.ts` and `page.test.ts` comparing
// the translations key by key, and `index.test.ts` checking that the catalog
// `loadLocale` fetches is the one in `ru.ts` -- import it from `./ru.ts`
// directly, which is a test-only edge and reaches no bundle.
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
