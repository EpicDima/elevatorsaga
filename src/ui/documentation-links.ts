/**
 * Which reference page a link in the shell should go to.
 *
 * The game publishes its help as two static files, `documentation.html` and
 * `documentation.ru.html`, both named in `vite.config.ts` and both built. Every
 * link to them in `index.html` pointed at the English one, in both languages,
 * with a single exception: the note under the editor, whose link is inside the
 * translated sentence and so had been written twice — once in each catalogue —
 * and pointed at the right page by accident of being part of the prose. So a
 * Russian reader who followed the note got Russian help and a Russian reader who
 * followed the header got English help, from two links that say the same thing.
 *
 * ## Why the mapping is here and not in `src/i18n/locale.ts`
 *
 * `htmlLang` is the obvious precedent — one place to say what a locale maps to —
 * and this was written there first and moved. Three things decided it:
 *
 * - `locale.ts` describes the languages the game *speaks*; this describes the
 *   files the build *emits*. The set of catalogues and the set of translated
 *   pages are allowed to differ, and will: a catalogue is one file a translator
 *   can finish in an afternoon, and the reference page is nine hundred lines of
 *   tables. Whoever adds a third language should be able to ship the interface
 *   in it before the help, and that is a decision about `dist/`, not about the
 *   locale.
 * - Everything `locale.ts` holds can be handed to `Intl` and to `<html lang>`
 *   unchanged, which is the property its own header claims for it. A relative
 *   URL is neither.
 * - `locale.ts` is re-exported by `src/i18n/index.ts`, which the fitness worker
 *   imports. The worker has no document, no links and nowhere to navigate; the
 *   page's own URLs have no business in the module it reaches for a language.
 *
 * What lives in `src/ui/` beside it is the other half of the same idea: the
 * shell says which of its links are documentation links, exactly as it says
 * which of its words are messages, and `src/ui/localise-page.ts` writes both.
 */

import type { Locale } from "../i18n/index.ts";

/**
 * Marks a link whose target is the reference page.
 *
 * Its value is the fragment to land on, without the `#`, or the empty string
 * for the top of the page. Following the shape of `data-i18n`: the attribute
 * names what the element should hold, the markup ships the English of it, and
 * `src/page.test.ts` checks that the two agree — so a link that is added and
 * marked cannot be shipped pointing somewhere else.
 */
export const DOCUMENTATION_LINK_ATTRIBUTE = "data-i18n-doc";

/**
 * The reference page published in each language.
 *
 * Exhaustive over {@link Locale} on purpose. A `Partial` with a fallback to
 * English would let a third language be added and quietly send its readers to
 * the English page, which is the defect this module exists to fix; a total map
 * makes the compiler ask the question, and answering it with
 * `documentation.html` is one line and a deliberate act.
 */
const DOCUMENTATION_PAGES: Readonly<Record<Locale, string>> = {
  en: "documentation.html",
  ru: "documentation.ru.html",
};

/**
 * Where a documentation link should point.
 *
 * @param locale - The language the reader is being shown the game in.
 * @param fragment - The anchor to land on, without the `#`; empty for the top
 * of the page.
 * @returns A page-relative URL.
 */
export function documentationUrl(locale: Locale, fragment = ""): string {
  const page = DOCUMENTATION_PAGES[locale];
  return fragment === "" ? page : `${page}#${fragment}`;
}

/**
 * Points every marked link in a document at the reference page for a locale.
 *
 * Idempotent, and rewrites from the attribute rather than from the href it
 * finds: the language can be changed as often as the reader likes, and each
 * change starts from what the link is *for* instead of from what the last one
 * left behind.
 *
 * @param root - The document, or any part of it, holding the links.
 * @param locale - The language the reader is being shown the game in.
 */
export function localiseDocumentationLinks(root: ParentNode, locale: Locale): void {
  for (const link of root.querySelectorAll(`[${DOCUMENTATION_LINK_ATTRIBUTE}]`)) {
    const fragment = link.getAttribute(DOCUMENTATION_LINK_ATTRIBUTE) ?? "";
    link.setAttribute("href", documentationUrl(locale, fragment));
  }
}
