/**
 * Which learning-track tasks this browser has already cleared.
 *
 * The track locks nothing. Every task is reachable by its own address whether
 * or not the ones before it have been cleared, deliberately: locking a teaching
 * track buys one class of "let me back in" complaint and no teaching at all. So
 * nothing here grants permission to play anything. What is kept is the one
 * sentence the panel says about the track as a whole —
 * `tutorial.panel.progress`, "3 of 8 tasks done" — and, through it, the reason
 * a player who comes back tomorrow can see they were here.
 *
 * It is browser memory, honestly: it goes when the store is cleared and it does
 * not travel between devices, exactly like the saved program and the chosen
 * speed. That is why nothing else is built on top of it.
 *
 * Its own module rather than more of `app.ts` because it is the only part of a
 * run of the track that outlives the tab, and because every line of it exists
 * for a store that answers with nothing, with rubbish, or by throwing.
 */

import type { TutorialTask } from "../game/tutorial.ts";

/**
 * Where the cleared tasks are remembered between visits.
 *
 * `develevate…` rather than `elevatorCrush…` for the reason the editor's own
 * track keys carry that prefix: the `elevatorCrush*` names are an on-disk
 * contract inherited from the game this is a fork of, and a player with both
 * games in one browser profile must not have one read the other's data.
 */
export const TUTORIAL_PROGRESS_STORAGE_KEY = "develevateTutorialProgress";

/**
 * Reads the identifiers of the tasks this browser has cleared.
 *
 * Identifiers and not a count, and not the number of the furthest task reached
 * either, which is what `docs/tutorial-plan.md` proposed and what this rejects.
 * Two failures make the difference. A position is the one thing about a task
 * that is expected to change — `TutorialTask.id` says so itself — so a ninth
 * task inserted at number two would silently hand every stored number to a
 * different lesson. And "furthest" is a lie about a track that locks nothing: a
 * player who opens task 6 from a link, clears it and nothing else would be
 * congratulated on six tasks they have not played, and would then watch the
 * count stand still through tasks 1 to 5.
 *
 * Everything unreadable is treated as "nothing cleared yet" rather than
 * reported: there is nothing a player can do about a corrupt entry, no run
 * depends on the answer, and the next win rewrites the key with a clean list.
 *
 * @param storage - Where progress is remembered.
 * @returns The identifiers found, which may include tasks this build does not
 * have; see {@link countClearedTutorialTasks}.
 */
export function readClearedTutorialTasks(storage: Storage): ReadonlySet<string> {
  let stored: string | null;
  try {
    stored = storage.getItem(TUTORIAL_PROGRESS_STORAGE_KEY);
  } catch {
    // Safari in private mode throws from `localStorage.getItem`, and a player
    // whose browser refuses storage should still be able to play the track.
    return new Set();
  }
  if (stored === null || stored === "") {
    return new Set();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return new Set();
  }
  if (!Array.isArray(parsed)) {
    return new Set();
  }
  // Non-strings cannot be anybody's identifier, so they are dropped here and
  // are gone from the key at the next win. Strings this build does not know are
  // kept: see `recordClearedTutorialTask`.
  return new Set(parsed.filter((id: unknown): id is string => typeof id === "string" && id !== ""));
}

/**
 * Remembers that a task has been cleared.
 *
 * Whatever was already stored is written back alongside it, including
 * identifiers this build has never heard of. A player who clears task 9 in a
 * newer deployment and then loads a cached older one must not have that erased
 * by winning task 1: the older build cannot show the entry, and quietly
 * deleting what it cannot show is the one outcome that cannot be undone.
 *
 * A store that refuses the write is not an error here and nothing is announced.
 * The run the player is in the middle of is what matters, and it does not
 * depend on this; the consequence is that the count does not move between
 * visits, exactly as a refused write means the chosen speed is not remembered.
 *
 * @param storage - Where progress is remembered.
 * @param taskId - The identifier of the task that was just cleared.
 */
export function recordClearedTutorialTask(storage: Storage, taskId: string): void {
  const cleared = readClearedTutorialTasks(storage);
  if (cleared.has(taskId)) {
    // Already there. Writing it again would rewrite the key on every replay of
    // a task the player has cleared once, for no change at all.
    return;
  }
  try {
    storage.setItem(TUTORIAL_PROGRESS_STORAGE_KEY, JSON.stringify([...cleared, taskId]));
  } catch {
    // A browser that refuses storage should not stop the game.
  }
}

/**
 * Counts how many of the tasks that exist have been cleared.
 *
 * The intersection rather than the size of the stored set, and both halves of
 * that matter. An identifier that no longer names a task — a renamed one, or
 * one from a newer build — must not be counted, or the panel says "9 of 8 tasks
 * done"; and it must not be deleted to make the arithmetic work either, which
 * is why {@link recordClearedTutorialTask} keeps it.
 *
 * @param cleared - The identifiers read back from the store.
 * @param tasks - The tasks this build has, in playing order.
 * @returns How many of `tasks` appear in `cleared`.
 */
export function countClearedTutorialTasks(
  cleared: ReadonlySet<string>,
  tasks: readonly TutorialTask[],
): number {
  return tasks.filter((task) => cleared.has(task.id)).length;
}

/**
 * The earliest task of the track that has not been cleared yet.
 *
 * What an entrance to the track points at, so that a player who did four tasks
 * yesterday is offered the fifth rather than the first. The alternative — always
 * the first task — is what makes a track with no other way in unusable on the
 * second visit: nothing else on the page offers task 5, so they would have to
 * win task 1 again to be shown task 2.
 *
 * *Earliest* uncleared and not "one past the furthest cleared", which is the
 * same distinction {@link readClearedTutorialTasks} makes and for the same
 * reason: the track locks nothing, so a player who opened task 6 from a link and
 * cleared it must still be offered task 1. Gaps are where the teaching they
 * skipped is.
 *
 * @param cleared - The identifiers read back from the store.
 * @param tasks - The tasks this build has, in playing order.
 * @returns The first task of `tasks` that is not in `cleared`, or `undefined`
 * when every one of them is — which is the finished track, and a caller has to
 * say for itself where that leads.
 */
export function firstUnclearedTutorialTask(
  cleared: ReadonlySet<string>,
  tasks: readonly TutorialTask[],
): TutorialTask | undefined {
  return tasks.find((task) => !cleared.has(task.id));
}
