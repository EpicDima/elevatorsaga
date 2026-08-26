/** Writes the catalog's messages into `index.html` via `data-i18n`/`data-i18n-attr` attributes, since the static shell can't call `t()` itself. */

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

/** A message key the static shell can render: one that takes no parameters, so `t(key)` needs no args object. */
type ShellMessageKey = { [K in MessageKey]: MessageArgs<K> extends [] ? K : never }[MessageKey];

/** The English catalog widened to string-keyed data, since a key read from an attribute is an untyped string. */
const ENGLISH_VALUES: Readonly<Record<string, unknown>> = EN_MESSAGES;

/** Whether `key` names a catalog message with no parameters — missing, plural (object-valued), and `{placeholder}` keys are all refused. */
function isShellMessageKey(key: string): key is ShellMessageKey {
  const english = ENGLISH_VALUES[key];
  return typeof english === "string" && !english.includes("{");
}

/**
 * The locale actually rendered right now — {@link getLocale} names the player's intent, which may not be loaded yet.
 * `<html lang>` must match the words really on the page, since a screen reader picks pronunciation from it.
 */
function renderedLocale(): Locale {
  const locale = getLocale();
  return isLocaleLoaded(locale) ? locale : DEFAULT_LOCALE;
}

/** Warns instead of throwing so a mistyped key leaves stale English rather than blocking the page; `localize-page.test.ts` checks every key exists. */
function warnUnusable(attribute: string, key: string): void {
  console.warn(
    `Ignoring ${attribute}="${key}": the page shell can only name a message that exists and takes no parameters`,
  );
}

function localizeContent(element: Element, key: ShellMessageKey): void {
  if (key.endsWith(HTML_KEY_SUFFIX)) {
    element.innerHTML = t(key);
  } else {
    element.textContent = t(key);
  }
}

function localizeAttributes(element: Element, mappings: string): void {
  for (const mapping of mappings.split(MAPPING_SEPARATOR)) {
    const separator = mapping.indexOf(NAME_SEPARATOR);
    // Splits at the first colon only, so a key (dotted, not colonned) that somehow holds one reaches the catalog unmangled and gets refused there.
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
 * Puts the page shell into the game's current language; call again after {@link setLocale} to re-localize.
 * Relabels modifier keys last — an `innerHTML` write above can reintroduce the shipped `Ctrl` in place of the platform's own key.
 */
export function localizePage(root: Document, userAgent: string): void {
  root.documentElement.lang = htmlLang(renderedLocale());

  for (const element of root.querySelectorAll(`[${TEXT_KEY_ATTRIBUTE}]`)) {
    const key = element.getAttribute(TEXT_KEY_ATTRIBUTE) ?? "";
    if (isShellMessageKey(key)) {
      localizeContent(element, key);
    } else {
      warnUnusable(TEXT_KEY_ATTRIBUTE, key);
    }
  }

  for (const element of root.querySelectorAll(`[${ATTRIBUTE_KEY_ATTRIBUTE}]`)) {
    localizeAttributes(element, element.getAttribute(ATTRIBUTE_KEY_ATTRIBUTE) ?? "");
  }

  labelModifierKeys(root, userAgent);
}
