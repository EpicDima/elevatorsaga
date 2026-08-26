/**
 * The locales the game speaks. Its own module because everything else in
 * `src/i18n/` needs it and it needs nothing back, which keeps those imports
 * from becoming cycles. Spelled the way BCP 47, `Intl` and `<html lang>` all
 * want it, so the same value works for all three without a lookup table.
 */

/** A locale the game has a complete catalog for. */
export type Locale = "en" | "ru";

/** Every locale, in the order a language picker should offer them: English first, then alphabetically. */
export const LOCALES: readonly Locale[] = ["en", "ru"];

/**
 * The locale used when nothing else can be determined, and the reference
 * locale every other catalog is type-checked against. Typed as its own tag
 * rather than widened to {@link Locale}, since the fallback always renders
 * `EN_MESSAGES` specifically, with English's own two plural forms.
 */
export const DEFAULT_LOCALE = "en" satisfies Locale;

/**
 * What each locale calls itself. Endonyms, kept outside the catalogs: a
 * language picker shows every option at once, and "Русский" has to say
 * Русский even while the interface is still in English.
 */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
  en: "English",
  ru: "Русский",
};

/** Whether a string names a locale the game has a catalog for. */
export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * The value `<html lang>` should carry for a locale. Identical to the tag
 * today, and a function rather than an identity so a future region subtag
 * (`pt-BR`, `zh-Hans`) has one place to be added instead of one per call site.
 */
export function htmlLang(locale: Locale): string {
  return locale;
}
