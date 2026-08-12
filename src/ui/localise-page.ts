/**
 * The words that are written out in `index.html`, taken from the catalogue.
 *
 * Everything the game draws while it runs goes through `t()` at the moment it
 * is drawn. The page shell cannot: it is a static file, it has to say something
 * before a single module has been fetched, and what it says is the English the
 * game was written in. That English is the right thing to ship — a reader with
 * no JavaScript, and every crawler, gets a real page rather than an empty one —
 * but it has to be replaceable once the catalogue is in memory, and nothing in
 * the shell tells a program which of its words are words rather than markup.
 *
 * Two attributes say so. `data-i18n="page.nav.help"` means the element's
 * content is that message, and `data-i18n-attr="aria-label:page.world.label"`
 * means an attribute of it is; several attributes can be named at once,
 * separated by commas. A key ending in `.html` is written with `innerHTML`,
 * following the convention the rest of the i18n code uses: those values are
 * trusted markup from the catalogue, never anything a player typed.
 *
 * Marking up a document for a program to read is a cost, and it was weighed
 * against the alternative — a table in here mapping CSS selectors to keys. The
 * attribute wins because it cannot go stale silently: an element that moves,
 * gets a new class or is wrapped in something takes its key with it, whereas a
 * selector in another file would quietly match nothing and leave a word in
 * English. It also keeps the answer to "where does this text come from?" in
 * the place a reader of the page is already looking.
 *
 * This is deliberately not a general templating engine. It fills no parameters
 * — a message with a `{placeholder}` is refused, because the shell has nothing
 * to fill it from — and it re-reads the whole shell every time rather than
 * remembering what it wrote, so calling it again after
 * {@link "../i18n/index.ts"!setLocale} is all that switching language costs.
 *
 * A third attribute, `data-i18n-doc`, marks the links that go to the reference
 * page, which is published once per language. It is not a message — there is no
 * catalogue key for a URL, and there should not be, since the reader never sees
 * it — so the mapping lives in `src/ui/documentation-links.ts` and is applied
 * from here for the same reason the other two are: whatever rewrites the shell
 * has to leave all of it saying the same thing.
 */

import {
  EN_MESSAGES,
  getLocale,
  htmlLang,
  isLocaleLoaded,
  t,
  DEFAULT_LOCALE,
  type Locale,
  type MessageArgs,
  type MessageKey,
} from "../i18n/index.ts";

import { localiseDocumentationLinks } from "./documentation-links.ts";
import { labelModifierKeys } from "./shortcuts.ts";

/** Names the message an element's content comes from. */
export const TEXT_KEY_ATTRIBUTE = "data-i18n";

/** Names the messages an element's attributes come from. */
export const ATTRIBUTE_KEY_ATTRIBUTE = "data-i18n-attr";

/** Marks a message whose value is markup rather than text. */
const HTML_KEY_SUFFIX = ".html";

/** Separates the attribute from its message in {@link ATTRIBUTE_KEY_ATTRIBUTE}. */
const NAME_SEPARATOR = ":";

/** Separates one attribute's mapping from the next. */
const MAPPING_SEPARATOR = ",";

/**
 * A message the page shell can hold: one that takes no parameters.
 *
 * The shell is markup, not a call site, so there is nowhere for a parameter to
 * come from. Restricting the type here is what lets {@link localisePage} call
 * `t(key)` with a key it read out of an attribute: with the whole of
 * {@link MessageKey} the parameter object would be mandatory, since some member
 * of that union demands one.
 */
type ShellMessageKey = { [K in MessageKey]: MessageArgs<K> extends [] ? K : never }[MessageKey];

/**
 * The English catalogue as plain data.
 *
 * A key arriving from an attribute is a string, and the typed catalogue cannot
 * be indexed with one. Widening it here — rather than casting at the point of
 * use — keeps the one unavoidable loss of type information in a single place,
 * and it loses only the key, not the value, which stays `unknown`.
 */
const ENGLISH_VALUES: Readonly<Record<string, unknown>> = EN_MESSAGES;

/**
 * Whether a string names a message this can render.
 *
 * Both halves matter. A key that is not in the catalogue is a typo or a message
 * that has been renamed out from under the shell; a key whose English holds a
 * `{placeholder}` is a message that belongs at a call site with something to
 * fill it, and rendering it here would print the placeholder's name at the
 * player. Plural entries fail the first test — their value is an object — which
 * is right, since a count is a parameter too.
 *
 * @param key - The string an attribute named.
 * @returns Whether it is a message with no parameters.
 */
function isShellMessageKey(key: string): key is ShellMessageKey {
  const english = ENGLISH_VALUES[key];
  return typeof english === "string" && !english.includes("{");
}

/**
 * The locale the shell can actually be written in at this moment.
 *
 * {@link getLocale} is what the player asked for, which is not the same thing
 * until the catalogue lands. `<html lang>` has to agree with the words actually
 * on the page rather than with the intention behind them: a screen reader picks
 * its voice and its pronunciation rules from that attribute, and English
 * sentences announced as Russian are worse than English sentences.
 *
 * @returns The locale the messages will come out in.
 */
function renderedLocale(): Locale {
  const locale = getLocale();
  return isLocaleLoaded(locale) ? locale : DEFAULT_LOCALE;
}

/**
 * Reports a key the shell names and the catalogue cannot answer.
 *
 * A warning rather than a thrown error, following `src/app/router.ts`: the
 * element keeps the English it shipped with, which is a worse answer than the
 * player's language but a far better one than a blank page or a game that
 * refuses to start over a mistyped attribute. What stops that from being a
 * silent decay is `localise-page.test.ts`, which reads every key in the shell
 * and fails on any the catalogue does not have.
 *
 * @param attribute - The attribute the key was read from.
 * @param key - The key itself.
 */
function warnUnusable(attribute: string, key: string): void {
  console.warn(
    `Ignoring ${attribute}="${key}": the page shell can only name a message that exists and takes no parameters`,
  );
}

/**
 * Writes one message into an element.
 *
 * @param element - The element to fill.
 * @param key - The message it names.
 */
function localiseContent(element: Element, key: ShellMessageKey): void {
  if (key.endsWith(HTML_KEY_SUFFIX)) {
    element.innerHTML = t(key);
  } else {
    element.textContent = t(key);
  }
}

/**
 * Writes the messages one element's attributes name.
 *
 * @param element - The element to fill.
 * @param mappings - The value of {@link ATTRIBUTE_KEY_ATTRIBUTE}.
 */
function localiseAttributes(element: Element, mappings: string): void {
  for (const mapping of mappings.split(MAPPING_SEPARATOR)) {
    const separator = mapping.indexOf(NAME_SEPARATOR);
    // Split at the first colon rather than on it, so that only the attribute
    // name is taken and the rest of the mapping stays whole. Message keys are
    // dotted, not colonned, but a key that ever holds one should reach the
    // catalogue as it was written and be refused there.
    const name = separator === -1 ? "" : mapping.slice(0, separator).trim();
    const key = mapping.slice(separator + 1).trim();
    if (name === "" || !isShellMessageKey(key)) {
      warnUnusable(ATTRIBUTE_KEY_ATTRIBUTE, mapping.trim());
      continue;
    }
    element.setAttribute(name, t(key));
  }
}

/**
 * Puts the page shell into the language the game is being played in.
 *
 * Called once at start-up and again after every {@link setLocale}, which is why
 * it reads the document rather than a list of what it did last time: the shell
 * carries its own instructions, so there is no state here to fall out of step.
 *
 * The reference page's links follow {@link renderedLocale} rather than
 * {@link getLocale}, for the same reason `<html lang>` does: a catalogue that
 * could not be fetched leaves the whole page in English, and a link out of an
 * English page to a Russian document would be the one place where the interface
 * disagreed with itself about what language the reader is being served.
 *
 * The modifier keys are relabelled at the end, and that is not an aside. The
 * shortcut hint is one of the messages written here, it is written with
 * `innerHTML`, and that throws away the `⌘` that `src/ui/shortcuts.ts` had put
 * in place of the shipped `Ctrl` — so a Mac player would be told to press a key
 * combination that does nothing, and told it again in Russian. Anything that
 * rewrites the shell has to put the platform's own key back, and doing it here
 * makes that a property of this function instead of a rule every caller has to
 * remember.
 *
 * @param root - The document holding the shell.
 * @param userAgent - The browser's user agent string, for the modifier keys.
 */
export function localisePage(root: Document, userAgent: string): void {
  const locale = renderedLocale();
  root.documentElement.lang = htmlLang(locale);

  for (const element of root.querySelectorAll(`[${TEXT_KEY_ATTRIBUTE}]`)) {
    const key = element.getAttribute(TEXT_KEY_ATTRIBUTE) ?? "";
    if (isShellMessageKey(key)) {
      localiseContent(element, key);
    } else {
      warnUnusable(TEXT_KEY_ATTRIBUTE, key);
    }
  }

  for (const element of root.querySelectorAll(`[${ATTRIBUTE_KEY_ATTRIBUTE}]`)) {
    localiseAttributes(element, element.getAttribute(ATTRIBUTE_KEY_ATTRIBUTE) ?? "");
  }

  localiseDocumentationLinks(root, locale);

  labelModifierKeys(root, userAgent);
}
