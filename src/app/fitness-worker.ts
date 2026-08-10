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

/** How many times the whole scenario list is run before averaging. */
const RUN_COUNT = 6;

/** What the host sends the worker: the source the player typed. */
export type FitnessWorkerRequest = string;

/** What the worker sends back. */
export type FitnessWorkerResponse = FitnessSuiteResult;

self.onmessage = (event: MessageEvent<FitnessWorkerRequest>): void => {
  self.postMessage(doFitnessSuite(event.data, RUN_COUNT));
};
