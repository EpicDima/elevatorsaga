/** Resolves the reader's preferred language at start-up; never persists it — only the language picker does that. */

import {
  browserLocaleSources,
  loadLocale,
  resolveLocale,
  setLocale,
  type LocaleSources,
} from "../i18n/index.ts";

import { localizePage } from "./localize-page.ts";

/**
 * Waits for the resolved locale's catalog before localizing the page, so the page renders once, not twice.
 * A language chosen later, mid-game, is the language picker's job, not this one.
 */
export async function applyPreferredLocale(
  root: Document,
  userAgent: string,
  sources: LocaleSources = browserLocaleSources(),
): Promise<void> {
  const locale = resolveLocale(sources);
  // Set before awaiting the catalog so in-flight reads (e.g. the fitness worker) see it immediately.
  setLocale(locale);
  // Joins the fetch setLocale started; never rejects, so a failed catalog just leaves the page in English.
  await loadLocale(locale);
  localizePage(root, userAgent);
}
