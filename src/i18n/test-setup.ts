/**
 * What every unit test file gets before it runs: every catalog in memory, so
 * `setLocale("ru")` followed by an assertion needs no `await`. A test that
 * must catch a caller switching language without waiting builds its own
 * module graph with `vi.resetModules()` instead of relying on this file.
 */

import { loadLocale } from "./index.ts";
import { LOCALES } from "./locale.ts";

// Top-level await, so a test file's first line runs with every language ready.
await Promise.all(LOCALES.map((locale) => loadLocale(locale)));
