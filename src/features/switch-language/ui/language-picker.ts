/**
 * The control that changes the language of the game while it is being played.
 *
 * Until this existed the language was decided once, at start-up, from the hash,
 * from storage or from the browser's own preferences — and a reader whose
 * browser disagreed with them had no way to say so from inside the page. The
 * only route back was `#lang=`, which means knowing that the parameter exists
 * and typing it into the address bar; `src/ui/preferred-locale.ts` called that
 * "devtools" and it was not far off.
 *
 * ## A `<select>`, not a row of links
 *
 * Two links (`English` · `Русский`) would have been fewer lines. A native
 * `<select>` was chosen instead:
 *
 * - It is one stop in the tab order rather than one per language, and it stays
 *   one when a third language is added.
 * - It announces its own current value. A row of links has to say which one is
 *   in effect with `aria-current` and a style, and both have to be maintained;
 *   a `<select>` says "Language, combo box, Русский" with nothing added.
 * - On a phone the browser opens its own picker, which is a thing readers of
 *   this page already know how to use.
 * - It is a form control, so `page.language.label` labels it the way the shell
 *   labels everything else. There was no other candidate for the key the
 *   catalog already carried. The control now lives in the app bar's settings
 *   popover, which is built at runtime and so writes that label with `t()`
 *   rather than with a `data-i18n-attr`; the key is the same one.
 *
 * ## The options are not translated
 *
 * They come from {@link LOCALE_NAMES}, which is endonyms and deliberately
 * outside the catalogs: a picker shows every option at once, and an option a
 * reader cannot read is no use to the reader who needs it most. The list is
 * built from {@link LOCALES} rather than written out, so a third language is
 * still the one-line change `src/i18n/locale.ts` promises — the control needs no
 * edit at all, and neither does the settings popover's template, which draws the
 * `<select>` empty.
 *
 * Which also means the options never need rewriting when the language changes:
 * "English" and "Русский" are the same words in both. The only thing about this
 * control that is in a language is its label, and that is the shell's business.
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
  /**
   * Where the choice is remembered between visits.
   *
   * Injected rather than reached for, so the tests can watch what is written
   * without a browser, and so this module has no opinion about which storage a
   * language belongs in.
   */
  readonly storage: Storage;
  /**
   * Puts what is already on screen into the language just chosen.
   *
   * Called once the catalog is in memory, so everything it draws through `t`
   * comes out in the new language in one pass rather than in two. What counts as
   * a redraw is deliberately not decided here: the shell, the widgets around
   * the building, the statistics and the building each have their own answer, and
   * {@link "#pages/game/index.ts"!App.relocalize} is where those answers live.
   */
  readonly redraw: () => void;
}

/**
 * Fills the language picker and wires it to the rest of the page.
 *
 * The sequence a change runs through is the whole of this module, and each step
 * is there for a reason:
 *
 * 1. {@link setLocale}, which is synchronous and starts the fetch. From here on
 *    {@link getLocale} answers with the language that was asked for, which is
 *    what makes step 3's check possible.
 * 2. `await` {@link loadLocale}. Without the wait, a reader who chooses a
 *    language whose catalog is still in flight gets the page rewritten in
 *    English — `t` falls back until the catalog lands — and then nothing at
 *    all when it does, because nobody is watching for it. It never rejects, so
 *    there is no failure path: a catalog that cannot be fetched leaves the
 *    page in English, which is what the reader was already looking at.
 * 3. Remember the choice, and then redraw.
 *
 * @param options - The control, where to remember the choice, and how to redraw.
 */
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
  // What the player asked for rather than what is currently rendered: between
  // the two, the catalog is in flight and the control has to show the choice
  // that was made, not the language the page has not finished leaving. It is the
  // same distinction `applyPreferredLocale` draws at start-up.
  select.value = getLocale();

  select.addEventListener("change", () => {
    const chosen = select.value;
    if (!isLocale(chosen)) {
      // Unreachable: every option was built from LOCALES a few lines above. It
      // is here because `value` is a string and narrowing it is the honest way
      // to get a Locale out of the DOM.
      return;
    }
    void choose(chosen, options);
  });
}

/**
 * Changes the language, remembers it, and redraws the page in it.
 *
 * @param locale - The language the reader chose.
 * @param options - The control, where to remember the choice, and how to redraw.
 */
async function choose(locale: Locale, options: LanguagePickerOptions): Promise<void> {
  setLocale(locale);
  await loadLocale(locale);

  // A reader who changes their mind while a catalog is being fetched — Русский,
  // then English again — leaves this function running twice, and the fetch that
  // started first can settle last. `getLocale` is the record of the most recent
  // choice, so the stale call stops here rather than writing a language nobody
  // is looking at into storage and redrawing the page underneath the newer one.
  if (getLocale() !== locale) {
    return;
  }

  // Deliberately not checked. `storeLocale` reports `false` when the browser
  // refuses to write — Safari in private mode is the one everybody meets — and
  // that is a reason for the language not to survive this tab, not a reason for
  // it not to change now. The same trade as `#storeTimeScale` in
  // `src/pages/game/index.ts`: a browser that refuses storage should not stop the game.
  storeLocale(options.storage, locale);

  options.redraw();
}
