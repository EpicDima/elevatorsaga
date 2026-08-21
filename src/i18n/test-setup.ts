/**
 * What every unit test file gets before it runs: every catalog in memory.
 *
 * Named in `vite.config.ts` as the one Vitest setup file. It exists because
 * catalogs are fetched now rather than bundled — see the note at the top of
 * {@link "./index.ts"!loadLocale} — and a fetch is asynchronous, while
 * `setLocale("ru")` followed on the next line by an assertion about Russian
 * text is how a dozen test files across `src/game`, `src/app` and `src/i18n`
 * are written. Without this they would each have to `await` a load before they
 * could name a language, which is a great deal of churn in files that are not
 * about loading at all, and which would tempt the next person to make `t`
 * asynchronous — the one thing it cannot be.
 *
 * The bargain is deliberate and it has a cost: with everything preloaded, no
 * ordinary test can catch a caller that switches language without waiting for
 * the catalog. What covers that instead is explicit — `index.test.ts` and
 * `fitness-worker.test.ts` both build a module graph of their own with
 * `vi.resetModules()`, where nothing but English has been loaded, and exercise
 * the waiting and the fallback there; and the end-to-end suite runs the real
 * build, where the chunks are real files fetched over HTTP.
 *
 * A setup file rather than an eager static import of the catalogs: an import
 * would put them back in every bundle, which is the whole thing this change is
 * undoing, and the point of a Vitest-only file is that no bundle ever sees it.
 */

import { loadLocale } from "./index.ts";
import { LOCALES } from "./locale.ts";

// Top-level await, so a test file's first line runs with every language ready.
await Promise.all(LOCALES.map((locale) => loadLocale(locale)));
