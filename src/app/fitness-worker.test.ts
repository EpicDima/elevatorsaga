/**
 * The worker's side of the language contract: when it can answer, and in what.
 *
 * `fitness.test.ts` covers what the worker computes -- that a request is scored
 * on the shipped seeds, that the answer comes back in the language the request
 * named, that an unknown tag falls back rather than killing the worker. What is
 * here is the timing that came with splitting the catalogs into chunks: a
 * language the worker does not have has to be fetched before anything can be
 * named, and that fetch is the one place in the worker where waiting is
 * possible. Every test below therefore drives a module graph of its own -- a
 * worker is a second module instance, and `vi.resetModules()` is what stands in
 * for that -- so that nothing but English has been loaded when the request
 * arrives, which is the state a real worker starts in.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import type { FitnessWorkerRequest, FitnessWorkerResponse } from "./fitness-worker.ts";

/** A program with no `init`, so the suite refuses before it simulates anything. */
const REFUSED_PROGRAM = "var x = 1;";

/** What that refusal reads as in each language. */
const REFUSAL = {
  en: "Error: Code must contain an init function",
  ru: "Error: В коде должна быть функция init",
} as const;

/** A freshly imported worker, and the `self` it is talking to. */
interface WorkerUnderTest {
  /** Everything the worker has posted back, oldest first. */
  readonly posted: FitnessWorkerResponse[];
  /**
   * Delivers a request, the way the host's `postMessage` would.
   *
   * @param request - The source to benchmark, and the language to report in.
   */
  send(request: FitnessWorkerRequest): void;
}

/**
 * Imports the worker into a module graph of its own, driven through a stand-in
 * `self`.
 *
 * @returns The worker's replies, and a way to send it a request.
 */
async function startWorker(): Promise<WorkerUnderTest> {
  const posted: FitnessWorkerResponse[] = [];
  const workerSelf = {
    onmessage: null as ((event: MessageEvent<FitnessWorkerRequest>) => void) | null,
    postMessage: (message: FitnessWorkerResponse): void => {
      posted.push(message);
    },
  };
  vi.resetModules();
  vi.stubGlobal("self", workerSelf);
  await import("./fitness-worker.ts");
  return {
    posted,
    send(request: FitnessWorkerRequest): void {
      workerSelf.onmessage?.({ data: request } as MessageEvent<FitnessWorkerRequest>);
    },
  };
}

afterEach(() => {
  // The stub has to outlive the request, since the reply may come a tick later
  // and is posted through it; every test above waits for its reply first.
  vi.unstubAllGlobals();
  vi.doUnmock("../i18n/ru.ts");
  // The graph that was just told to speak another language, dropped rather than
  // handed to the next test in this file.
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("the fitness worker and the catalog it reports in", () => {
  it("answers a request in the default language in the tick it arrived in", async () => {
    // What keeps the ordinary report exactly as prompt as it was before the
    // catalogs were split: English is bundled with the worker, so there is
    // nothing to fetch and nothing to wait for.
    const worker = await startWorker();

    worker.send({ code: REFUSED_PROGRAM, locale: "en" });

    expect(worker.posted).toEqual([{ error: REFUSAL.en }]);
  });

  it("waits for the catalog before answering in a language it has to fetch", async () => {
    const worker = await startWorker();

    worker.send({ code: REFUSED_PROGRAM, locale: "ru" });

    // Nothing yet, and deliberately so: this is the moment `t` cannot be made
    // to wait at, so the worker waits here instead, where a promise is allowed.
    expect(worker.posted).toEqual([]);
    await vi.waitFor(() => {
      expect(worker.posted).toHaveLength(1);
    });
    // The player's own error, rendered inside the worker -- the half of the
    // report that has no identifier to send home in its place, and the reason
    // the worker needs a catalog at all.
    expect(worker.posted).toEqual([{ error: REFUSAL.ru }]);
  });

  it("still answers when the catalog cannot be fetched", async () => {
    // A dropped response, an offline tab, a half-deployed build. The worker has
    // nobody to report that to and a player waiting on a benchmark, so the
    // report comes back in the language it does have rather than not at all --
    // and never as a raw message key.
    vi.doMock("../i18n/ru.ts", () => {
      throw new Error("Failed to fetch dynamically imported module");
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const worker = await startWorker();

    worker.send({ code: REFUSED_PROGRAM, locale: "ru" });

    await vi.waitFor(() => {
      expect(worker.posted).toHaveLength(1);
    });
    expect(worker.posted).toEqual([{ error: REFUSAL.en }]);
  });
});
