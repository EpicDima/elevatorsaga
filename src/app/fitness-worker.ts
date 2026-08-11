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

/**
 * What the host sends the worker: the source the player typed, and nothing else.
 *
 * In particular not the seed list, which the worker takes from the same
 * `fitnessSeeds` constant the rest of the game reads — this file is bundled from
 * that import graph, so the worker and its host cannot end up holding different
 * lists. Sending them would work (a `postMessage` clones an array of numbers
 * happily); it is left out because the seed list has to have exactly one source
 * of truth to be worth anything. A message field would be a second one, and the
 * failure it invites is silent: a caller who omits it gets a report scored on
 * different buildings from the report next to it, with nothing to say so.
 *
 * The one caller that does choose its own seeds is `runFitnessSuite`'s
 * main-thread fallback, which runs a prefix of that same list — and it runs
 * `doFitnessSuite` directly, with no boundary to carry them across.
 */
export type FitnessWorkerRequest = string;

/** What the worker sends back. */
export type FitnessWorkerResponse = FitnessSuiteResult;

self.onmessage = (event: MessageEvent<FitnessWorkerRequest>): void => {
  // No run count and no seed list: the default is `fitnessSeeds`, so the report
  // a player sees is the one the constant describes.
  self.postMessage(doFitnessSuite(event.data));
};
