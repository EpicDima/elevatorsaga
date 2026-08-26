/// <reference lib="webworker" />

/** The fitness worker entry point: runs the benchmark off the main thread. */

import { doFitnessSuite } from "../game/fitness.ts";
import type { FitnessSuiteResult } from "../game/fitness.ts";
import { isLocale, isLocaleLoaded, loadLocale, setLocale, DEFAULT_LOCALE } from "../i18n/index.ts";
import type { Locale } from "../i18n/index.ts";

/**
 * What the host sends the worker. No seed list: `doFitnessSuite` always uses
 * the shared `fitnessSeeds` default, so the worker and the page can't disagree.
 * The locale is required since a worker is a separate module instance and can't see the page's.
 */
export interface FitnessWorkerRequest {
  /** The source the player typed. */
  readonly code: string;
  /** The language to report results in. */
  readonly locale: Locale;
}

/** What the worker sends back. */
export type FitnessWorkerResponse = FitnessSuiteResult;

self.onmessage = (event: MessageEvent<FitnessWorkerRequest>): void => {
  // Validated rather than trusted: postMessage data isn't type-checked, and an
  // unrecognized locale would otherwise reach `Intl` and crash the worker.
  const locale = isLocale(event.data.locale) ? event.data.locale : DEFAULT_LOCALE;
  const code = event.data.code;

  const report = (): void => {
    // Set per request rather than at import time, since a pooled worker could
    // be reused after the player switches languages. Synchronous, so requests
    // never interleave.
    setLocale(locale);
    // No seed list passed, so the default (`fitnessSeeds`) always applies.
    self.postMessage(doFitnessSuite(code));
  };

  // Only awaits when a catalog needs fetching, so a default-language request
  // still answers in the same tick.
  if (isLocaleLoaded(locale)) {
    report();
    return;
  }
  void loadLocale(locale)
    .then(report)
    .catch((error: unknown) => {
      // `loadLocale` doesn't reject; this only catches a bug in the suite
      // itself, so the host doesn't just wait out its timeout.
      self.postMessage({ error: String(error) });
    });
};
