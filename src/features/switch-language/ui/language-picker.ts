/**
 * The control that changes the language of the game while it is being played,
 * a native `<select>` populated from {@link LOCALES}.
 *
 * Its options come from {@link LOCALE_NAMES} (endonyms) rather than the
 * catalog, so they need no translation and stay readable to a reader whose
 * language isn't the current one.
 */

import {
  getLocale,
  isLocale,
  loadLocale,
  setLocale,
  storeLocale,
  LOCALE_NAMES,
  LOCALES,
  type Locale,
} from "#i18n/index.ts";

/** What the language picker needs in order to draw and drive itself. */
export interface LanguagePickerOptions {
  /** The `<select>` the page shell ships empty for this to fill. */
  readonly select: HTMLSelectElement;
  /** Where the choice is remembered between visits, injected so tests can watch what is written without a browser. */
  readonly storage: Storage;
  /** Redraws everything on screen in the newly chosen language; called once its catalog is in memory. */
  readonly redraw: () => void;
}

/** Fills the language picker and wires it to redraw the page when the choice changes. */
export function presentLanguagePicker(options: LanguagePickerOptions): void {
  const { select } = options;
  const document = select.ownerDocument;

  select.replaceChildren(
    ...LOCALES.map((locale) => {
      const option = document.createElement("option");
      option.value = locale;
      option.textContent = LOCALE_NAMES[locale];
      return option;
    }),
  );
  // The choice made, not the language currently rendered: the catalog may still be in flight.
  select.value = getLocale();

  select.addEventListener("change", () => {
    const chosen = select.value;
    if (!isLocale(chosen)) {
      // Unreachable: every option was built from LOCALES above; this narrows `value` from a plain string.
      return;
    }
    void choose(chosen, options);
  });
}

/** Changes the language, remembers it, and redraws the page in it. */
async function choose(locale: Locale, options: LanguagePickerOptions): Promise<void> {
  setLocale(locale);
  await loadLocale(locale);

  // A second, newer choice while this fetch was in flight may have already settled; don't clobber it.
  if (getLocale() !== locale) {
    return;
  }

  // Return value ignored: storage can refuse to write (e.g. Safari private mode), which shouldn't block the language change itself.
  storeLocale(options.storage, locale);

  options.redraw();
}
