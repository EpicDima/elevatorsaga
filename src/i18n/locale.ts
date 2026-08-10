/**
 * The locales the game speaks.
 *
 * Its own module because everything else in `src/i18n/` needs it and it needs
 * nothing back: the catalogues, the formatters and the detection all name a
 * locale, so keeping the type anywhere larger would turn half the imports here
 * into cycles.
 *
 * A locale is spelled the way BCP 47 spells it, which is also the way `Intl`
 * and `<html lang>` want it, so the same value can be handed to all three
 * without a lookup table per consumer. Adding a locale means adding a member
 * here, a catalogue file, and nothing else.
 */

/** A locale the game has a complete catalogue for. */
export type Locale = "en" | "ru";

/**
 * Every locale, in the order a language picker should offer them.
 *
 * English first because it is the reference locale, then alphabetically by tag.
 */
export const LOCALES: readonly Locale[] = ["en", "ru"];

/**
 * The locale used when nothing else can be determined.
 *
 * Also the reference locale: its catalogue is the one every other catalogue is
 * type-checked against, so a key can never exist in a translation and be
 * missing from English.
 */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * What each locale calls itself.
 *
 * Endonyms, deliberately outside the catalogues: a language picker shows every
 * option at once, and an option a reader cannot read is no use to the reader
 * who needs it most. "Русский" has to say Русский even while the interface is
 * still in English.
 */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
  en: "English",
  ru: "Русский",
};

/**
 * Whether a string names a locale the game has a catalogue for.
 *
 * @param value - Anything that might be a locale tag.
 * @returns Whether it is one, narrowing the type when it is.
 */
export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * The value `<html lang>` should carry for a locale.
 *
 * Identical to the locale tag today, and a function rather than an identity so
 * that the day a locale needs a region subtag — `pt-BR`, `zh-Hans` — there is
 * one place to say so instead of one per call site.
 *
 * @param locale - The locale being displayed.
 * @returns The language tag for the document element.
 */
export function htmlLang(locale: Locale): string {
  return locale;
}
