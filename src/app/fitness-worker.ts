/// <reference lib="webworker" />

/**
 * The fitness worker entry point.
 *
 * Ported from the legacy `fitnessworker.js`, which pulled the whole simulation
 * in through `importScripts` of eight global-polluting files plus lodash, riot
 * and unobservable. This is a module worker instead, so Vite bundles it from
 * the import graph and it shares exactly the code the game itself runs.
 */

import { doFitnessSuite } from "../game/fitness.ts";
import type { FitnessSuiteResult } from "../game/fitness.ts";
import { isLocale, isLocaleLoaded, loadLocale, setLocale, DEFAULT_LOCALE } from "../i18n/index.ts";
import type { Locale } from "../i18n/index.ts";

/**
 * What the host sends the worker: the source the player typed, and the language
 * to report in.
 *
 * In particular not the seed list. This file names no seeds at all: it leaves
 * `doFitnessSuite` to fall back on its default, which is the `fitnessSeeds`
 * constant the rest of the game reads, and since the worker is bundled from that
 * same import graph the two cannot end up holding different lists. Sending them
 * would work (a `postMessage` clones an array of numbers
 * happily); it is left out because the seed list has to have exactly one source
 * of truth to be worth anything. A message field would be a second one, and the
 * failure it invites is silent: a caller who omits it gets a report scored on
 * different buildings from the report next to it, with nothing to say so.
 *
 * The one caller that does choose its own seeds is `runFitnessSuite`'s
 * main-thread fallback, which runs a prefix of that same list — and it runs
 * `doFitnessSuite` directly, with no boundary to carry them across.
 *
 * The locale is here for the opposite reason: it is state the worker cannot
 * discover and has to be told. A worker is a second module instance, with its
 * own copy of `src/i18n/index.ts` and its own active locale, and nothing the
 * page does to the one on the main thread reaches it — so without this field the
 * worker reports in whatever the module defaults to, which is English, however
 * the rest of the interface is written.
 *
 * The alternative was to send scenario identifiers back and translate on the
 * main thread, and it is the tidier contract: the reply would be locale-free
 * data, and the only place that renders it would be the only place that knows
 * the language. It is rejected because it can fix half of what the worker says
 * and not the other half. The scenario names are the half that has identifiers;
 * the rest is {@link "../game/fitness.ts"!FitnessSuiteResult}'s `error`, which
 * is `String()` of whatever the player's program threw — a `SyntaxError` from
 * the engine, a message from `getCodeObjFromCode`, one of the elevator facade's
 * complaints — and an arbitrary string has no identifier to send back in place
 * of it. Translating at the boundary would therefore leave `runFitnessSuite`
 * answering in two languages depending on which of its paths ran: the worker
 * would report a Russian page's error in English, while the main-thread
 * fallback, which runs inside the page's own module instance, reported the same
 * error in Russian. A player cannot tell which path ran, so the two have to
 * agree, and telling the worker the locale is what makes them.
 *
 * The field decides one more thing since the catalogues became chunks of their
 * own: whether there is anything to fetch before the worker can answer. English
 * is bundled with it, so a default-language request is answered in the tick it
 * arrives in; any other language is an `import()` away, and the reply waits on
 * {@link "../i18n/index.ts"!loadLocale}. That the worker is the thing doing the
 * waiting is the point — it is a place where waiting is possible, and `t` is
 * not.
 */
export interface FitnessWorkerRequest {
  /** The source the player typed. */
  readonly code: string;
  /** The language the page is in, and so the language to report in. */
  readonly locale: Locale;
}

/** What the worker sends back. */
export type FitnessWorkerResponse = FitnessSuiteResult;

self.onmessage = (event: MessageEvent<FitnessWorkerRequest>): void => {
  // Checked rather than trusted, because this is the one place in the module
  // where a value arrives from outside the type system: a `postMessage` is
  // structured-cloned data, and the sender may be a stale bundle posting the
  // bare string this used to take, or the console. An unrecognised tag would
  // otherwise reach `Intl` and throw out of `onmessage`, killing the worker --
  // so the player would read a raw browser error where the report goes, for
  // the sake of a field that only decides a language. Falling back to the
  // default reports in English instead, which is the wrong language but a real
  // answer.
  const locale = isLocale(event.data.locale) ? event.data.locale : DEFAULT_LOCALE;
  const code = event.data.code;

  const report = (): void => {
    // The language is set before the suite runs, because the scenario names and
    // any error message are rendered while it runs, and it is set per request
    // rather than once at import time: nothing is imported with a locale in
    // hand, and a worker that outlived one request -- if a caller ever pools
    // them -- could well be asked again after the player changed language. Two
    // requests cannot interleave here even so: `doFitnessSuite` is synchronous,
    // so each one renders entirely under its own `setLocale`.
    setLocale(locale);
    // One argument, deliberately: with no seed list the default applies, which
    // is `fitnessSeeds`, so the report a player sees is the one that constant
    // describes. Passing anything here would quietly score the game on
    // something else, which is what the test in fitness.test.ts is there to
    // catch.
    self.postMessage(doFitnessSuite(code));
  };

  // This is the point in the worker where waiting is possible, and so the point
  // where a catalogue is fetched: `t` is synchronous everywhere below here --
  // in the scenario names, in the elevator facade's complaints, in whatever the
  // player's program threw -- and the request is the first thing that says
  // which language any of it should come out in.
  //
  // Waiting only when there is something to wait for, rather than awaiting
  // unconditionally, keeps the default-language request exactly as prompt as it
  // was before the catalogues were split: English is bundled, so it is loaded
  // before this file has run a line, and the common report is posted in the
  // same tick as the request that asked for it.
  if (isLocaleLoaded(locale)) {
    report();
    return;
  }
  void loadLocale(locale)
    .then(report)
    .catch((error: unknown) => {
      // `loadLocale` does not reject -- a catalogue that will not load leaves
      // the worker in English -- so this is for a bug in the suite itself.
      // Without it such a bug would be an unhandled rejection rather than the
      // error event the host listens for on a synchronous throw, and the host
      // would sit on "Measuring fitness..." until its minute-long deadline
      // rather than saying anything. Answering with the error keeps the report
      // immediate, which is what the deadline is there to protect.
      self.postMessage({ error: String(error) });
    });
};
