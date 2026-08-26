/** The worker's timing: when it can answer, and in what language. */

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
  /** Delivers a request, the way the host's `postMessage` would. */
  send(request: FitnessWorkerRequest): void;
}

/** Imports the worker into a module graph of its own, via a stand-in `self`. */
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
  // The stub must outlive any pending reply.
  vi.unstubAllGlobals();
  vi.doUnmock("../i18n/ru.ts");
  vi.doUnmock("../game/fitness.ts");
  // Drops the module graph now speaking another language.
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("the fitness worker and the catalog it reports in", () => {
  it("answers a request in the default language in the tick it arrived in", async () => {
    // English is bundled with the worker, so there is nothing to fetch or wait for.
    const worker = await startWorker();

    worker.send({ code: REFUSED_PROGRAM, locale: "en" });

    expect(worker.posted).toEqual([{ error: REFUSAL.en }]);
  });

  it("waits for the catalog before answering in a language it has to fetch", async () => {
    const worker = await startWorker();

    worker.send({ code: REFUSED_PROGRAM, locale: "ru" });

    // Nothing posted yet: the worker waits here since `t` can't.
    expect(worker.posted).toEqual([]);
    await vi.waitFor(() => {
      expect(worker.posted).toHaveLength(1);
    });
    // The player's own error, which has no identifier to translate on the main thread.
    expect(worker.posted).toEqual([{ error: REFUSAL.ru }]);
  });

  it("still answers when the suite itself breaks while the catalog is on its way", async () => {
    // `loadLocale` never rejects, so the only failure left here is the suite's
    // own; unanswered, it would leave the host waiting out its whole deadline.
    vi.doMock("../game/fitness.ts", async (importOriginal) => ({
      ...(await importOriginal<typeof import("../game/fitness.ts")>()),
      doFitnessSuite: (): never => {
        throw new Error("the suite broke");
      },
    }));
    const worker = await startWorker();

    worker.send({ code: REFUSED_PROGRAM, locale: "ru" });

    await vi.waitFor(() => {
      expect(worker.posted).toHaveLength(1);
    });
    expect(worker.posted).toEqual([{ error: "Error: the suite broke" }]);
  });

  it("still answers when the catalog cannot be fetched", async () => {
    // Falls back to English rather than leaving the player without a report.
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
