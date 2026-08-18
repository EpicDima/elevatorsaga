/**
 * Choosing the language the game starts in, and getting the page into it.
 *
 * `src/i18n/detect.ts` works out which language a reader has asked for, and
 * `src/ui/localise-page.ts` writes the shell in whatever language is active.
 * This is the one thing that puts the two together, which makes it the place
 * the two decisions start-up has to make are taken and written down: how long
 * the first draw waits for a catalogue, and whether the language it found is
 * remembered.
 *
 * A module of its own rather than another function in `localise-page.ts`,
 * because that file is a writer with no policy in it — given the active locale,
 * it puts the catalogue's words into the document — whereas everything here is
 * policy. And because proving that the page waits needs a module graph in which
 * the Russian catalogue has *not* been loaded, which `src/i18n/test-setup.ts`
 * otherwise guarantees it has been; that is a strange thing to keep in a test
 * file whose subject is `index.html`.
 *
 * ## The first draw waits for the catalogue
 *
 * English is bundled and every other catalogue is fetched, so a reader of
 * another language can either wait for theirs before anything is drawn, or be
 * shown the English game and have it rewritten underneath them when the
 * catalogue lands. This waits.
 *
 * "Draw now, re-localise later" is a real option, and it is the one the language
 * picker takes: {@link localisePage} re-reads the document, and
 * {@link "../app/app.ts"!App.relocalise} rebuilds the challenge bar, redraws the
 * statistics, renames the building and redraws the overlay without touching the
 * world. So the choice here is not between waiting and a page that cannot be
 * fixed. It is between waiting and drawing the game twice.
 *
 * Waiting, because at start-up the second draw buys nothing. There is no run to
 * protect yet — that is the whole of what the picker's redraw is for — and what
 * a reader of another language would get for it is the game appearing in English
 * and changing under them a moment later, at the exact moment they are reading
 * the first challenge and looking for the Start button. The page they are
 * looking at while they wait already says all of that in English, and it has
 * said it since the HTML arrived.
 *
 * The wait is also small, and it is not spent in front of a blank page. English
 * is the default language and is in memory before any of this is evaluated, so
 * {@link loadLocale} for it is an already-settled promise and the
 * overwhelmingly common visit pays a microtask. A reader of another language
 * pays one fetch of one catalogue chunk, while looking at the English
 * `index.html` ships — which is what they were looking at for the whole of the
 * page's load anyway. What waiting buys them is that the page changes language
 * once, when the game appears, instead of twice.
 *
 * ## What is found is not remembered
 *
 * {@link "../i18n/index.ts"!storeLocale} is called from here for none of the
 * three sources.
 *
 * `#lang=ru` is the most deliberate of them, but the deliberation is that of
 * whoever wrote the link, not of whoever opened it. Remembering it would let one
 * click on somebody else's link decide the language of every later visit,
 * including the visits that ask for no language at all. Nothing is lost inside
 * the session by not writing it: the router keeps parameters it does not
 * recognise, so `lang` rides along in every link the game builds and stays in
 * the address bar for as long as the reader is playing.
 *
 * The other two sources are not worth writing for reasons of their own. Storage
 * would be written with what was just read out of it, and `navigator.languages`
 * is a preference that should go on following the browser: freezing it on the
 * first visit would strand a reader who later changes their browser's language.
 *
 * That leaves the writing to
 * `src/features/switch-language/ui/language-picker.ts`, which is the one
 * source that is a choice, made in this browser, by the person looking at the
 * page — and it is the only place in the game that calls
 * {@link "../i18n/index.ts"!storeLocale}. `preferred-locale.test.ts` holds this
 * module to writing nothing at start-up, from any of the three.
 */

import {
  browserLocaleSources,
  loadLocale,
  resolveLocale,
  setLocale,
  type LocaleSources,
} from "../i18n/index.ts";

import { localisePage } from "./localise-page.ts";

/**
 * Puts the page into the language its reader asked for.
 *
 * Called once, at start-up, with nothing drawn until it settles — which is what
 * keeps the shell and the game it frames in one language, since everything the
 * app and the presenters draw afterwards renders through `t()` and is in the
 * active language without being told.
 *
 * The sources are read once and none of them is listened to. A language chosen
 * while the page is open is
 * `src/features/switch-language/ui/language-picker.ts`'s business, because it
 * has to redraw what is already on screen and leave the run in progress where it
 * is — a decision about a game that is being played rather than about start-up.
 *
 * @param root - The document holding the shell.
 * @param userAgent - The browser's user agent string, for the modifier keys.
 * @param sources - Where to look for the language; by default this browser's
 * hash, storage and preferred languages.
 * @returns A promise that settles once the page has been written in the
 * language it will be read in.
 */
export async function applyPreferredLocale(
  root: Document,
  userAgent: string,
  sources: LocaleSources = browserLocaleSources(),
): Promise<void> {
  const locale = resolveLocale(sources);
  // Set before the wait rather than after it, so that anything reading the
  // choice while the fetch is in flight -- `getLocale` is what the fitness
  // worker is sent and what a picker would show as selected -- sees the language
  // that was asked for. It cannot leave anything half-translated in the
  // meantime: `t` and `format` both answer in English until the catalogue is in
  // memory, and `localisePage` takes `<html lang>` from what it could actually
  // write rather than from this.
  setLocale(locale);
  // The very fetch `setLocale` started, joined rather than started again. A
  // catalogue that cannot be had resolves too, and leaves the page in English:
  // `loadLocale` never rejects, and there is nothing better to do about a
  // dropped response than play the game in the language every string exists in.
  await loadLocale(locale);
  localisePage(root, userAgent);
}
