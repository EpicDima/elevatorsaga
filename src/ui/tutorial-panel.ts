/**
 * The learning track's panel: the block of prose between the challenge bar and
 * the building, shown while a player is working through `src/game/tutorial.ts`.
 *
 * It is a presenter in the sense `presenters.ts` uses the word — one function
 * for one region of the page, drawing it wholesale and subscribing to nothing —
 * and it is kept out of that file for the reason the track is kept out of
 * `challenges.ts`: nothing here is part of a challenge.
 *
 * The interface takes a task *index* rather than the words to print, and that is
 * the one design decision the rest of this file follows from. Changing language
 * redraws the page by calling every region's presenter again, so a panel handed
 * finished sentences would keep the sentences it was handed and be the one
 * column of the page still in English after the language picker had done its
 * work. Asking the catalogue at draw time makes the language a property of the
 * moment of drawing instead.
 *
 * That in turn is why the key table below is written out by hand. A message key
 * has to reach `t` as a string literal: the parameters a message takes are
 * derived from the literal by `Placeholders<S>` in `src/i18n/catalogue.ts`, so
 * `t(`tutorial.task${n}.title`)` is not a call that can be type-checked, and
 * casting one through would give up every guarantee the typed catalogue exists
 * to provide — a renamed message would then print its own key at the player
 * rather than failing the build.
 */

import { tutorialTasks } from "../game/tutorial.ts";
import { t, type MessageKey } from "../i18n/index.ts";

import { query, queryAll, requireElement } from "./dom.ts";
import { renderElement, tutorialTemplate } from "./templates.ts";

/**
 * Every task the catalogue has prose for, named by its title message.
 *
 * Read out of {@link MessageKey} rather than written down, so that this is the
 * catalogue's own answer to "how many tasks are there" and not a second opinion
 * about it.
 */
type TutorialTitleKey = Extract<MessageKey, `tutorial.task${number}.title`>;

/**
 * The id of the task one of those keys describes.
 *
 * `tutorial.task3.title` is the title of the task whose `id` is `tutorial-3`,
 * and the mapping is spelled out here rather than assumed, because
 * the whole point of keying the table below by id is that the number in the id
 * and the task's position in `tutorialTasks` are not the same number.
 *
 * A named generic rather than the same conditional written inline over
 * {@link TutorialTitleKey}, so that it distributes: a conditional type is
 * applied member by member only when the type it tests is a naked type
 * parameter. Both forms agree as long as every member of the union matches the
 * pattern, which `Extract` above is what guarantees. Checked with the compiler
 * rather than assumed, because the two part company exactly when that guarantee
 * is dropped: given `"a.title" | "b.title" | "other"`, the inline form tests the
 * whole union at once, fails, and answers `never` for all three, where this form
 * drops the member that did not match and keeps the two that did.
 */
type TaskIdOf<K> = K extends `tutorial.task${infer N extends number}.title`
  ? `tutorial-${N}`
  : never;

/** The ids of the tasks the catalogue describes. */
type TutorialTaskId = TaskIdOf<TutorialTitleKey>;

/** The four things the catalogue says about one task. */
interface TutorialTaskMessages {
  /** Its name. */
  readonly title: MessageKey;
  /** What it asks the player to do. */
  readonly goal: MessageKey;
  /** Its three hints, from a nudge to the answer. */
  readonly hints: readonly [MessageKey, MessageKey, MessageKey];
  /** Why the task behaves the way it does, read after it is cleared. */
  readonly explanation: MessageKey;
}

/**
 * Which messages describe which task.
 *
 * Keyed by the task's id and not by where it sits in `tutorialTasks`, which is
 * the same rule `src/game/tutorial.ts` states for the saved attempt, the
 * progress mark and the bookmarked address, and it is here for the same reason:
 * a ninth task inserted between two existing ones moves every task after it,
 * and a table read by position would then print task 3's title, goal and hints
 * over task 4's building. The answer under the last hint would not move with
 * them — it comes off the task at that index rather than out of this table — so
 * the panel would show one program and describe another, and nothing would
 * throw.
 *
 * Coming off the task is what keeps the answer in step with the building. It is
 * not what keeps it in step with the task, and it stopped being an argument that
 * this hazard lives only in this file the day the programs became messages: a
 * task reaches its own two through `tutorial.taskN.startingCode.code` and
 * `tutorial.taskN.solutionCode.code`, written out by hand at the entry that uses
 * them, so the very slip described above is available one file away, in
 * `src/game/tutorial.ts`, and the compiler can no more see it there than here —
 * a key that belongs to the next task is still a key. What holds the sixteen
 * programs to the tasks that own them is `src/game/tutorial.test.ts`, which
 * requires no two tasks to hand out one program beyond the answer task 8 copies
 * from task 7 on purpose.
 *
 * Every key is spelled out because every one of them has to reach `t` as a
 * literal; see the note at the top of this file for why building them from the
 * task's number is not an option.
 *
 * The type is doing three separate jobs and each of them catches a different
 * mistake:
 *
 * - `TutorialTaskMessages` types each field as a {@link MessageKey}, so a
 *   misspelled or renamed key is a compile error here rather than the message's
 *   own name printed into the panel, which is what `t` does with a key it cannot
 *   find.
 * - `Record<TutorialTaskId, …>` demands a row for every task the catalogue
 *   describes. A ninth task's messages added to `src/i18n/en.ts` without a row
 *   here stops this file compiling — the alternative being a panel that draws
 *   its chrome and nothing else, which is a blank page with buttons on it.
 * - `as const` keeps the values as the literal types `t` needs. An annotation
 *   would widen them to `MessageKey`, and `t` refuses that union: some member of
 *   it takes parameters, so the parameter object would become mandatory for all
 *   of them.
 *
 * The other direction — a ninth entry in `tutorialTasks` with no prose written
 * for it — cannot be a compile error, because `tutorialTasks` is an array and
 * its length is not part of its type. It is also only half caught by the ids:
 * the union above is built from the *title* keys, so a task whose title exists
 * and whose hints do not is a compile error, and a task with no messages at all
 * is not. {@link presentTutorial} throws on that one, and
 * `tutorial-panel.test.ts` draws every task on the track so that the throw is
 * met by whoever adds the task rather than by a player.
 */
const TUTORIAL_TASK_MESSAGES = {
  "tutorial-1": {
    title: "tutorial.task1.title",
    goal: "tutorial.task1.goal",
    hints: ["tutorial.task1.hint1.html", "tutorial.task1.hint2.html", "tutorial.task1.hint3.html"],
    explanation: "tutorial.task1.explanation.html",
  },
  "tutorial-2": {
    title: "tutorial.task2.title",
    goal: "tutorial.task2.goal",
    hints: ["tutorial.task2.hint1.html", "tutorial.task2.hint2.html", "tutorial.task2.hint3.html"],
    explanation: "tutorial.task2.explanation.html",
  },
  "tutorial-3": {
    title: "tutorial.task3.title",
    goal: "tutorial.task3.goal",
    hints: ["tutorial.task3.hint1.html", "tutorial.task3.hint2.html", "tutorial.task3.hint3.html"],
    explanation: "tutorial.task3.explanation.html",
  },
  "tutorial-4": {
    title: "tutorial.task4.title",
    goal: "tutorial.task4.goal",
    hints: ["tutorial.task4.hint1.html", "tutorial.task4.hint2.html", "tutorial.task4.hint3.html"],
    explanation: "tutorial.task4.explanation.html",
  },
  "tutorial-5": {
    title: "tutorial.task5.title",
    goal: "tutorial.task5.goal",
    hints: ["tutorial.task5.hint1.html", "tutorial.task5.hint2.html", "tutorial.task5.hint3.html"],
    explanation: "tutorial.task5.explanation.html",
  },
  "tutorial-6": {
    title: "tutorial.task6.title",
    goal: "tutorial.task6.goal",
    hints: ["tutorial.task6.hint1.html", "tutorial.task6.hint2.html", "tutorial.task6.hint3.html"],
    explanation: "tutorial.task6.explanation.html",
  },
  "tutorial-7": {
    title: "tutorial.task7.title",
    goal: "tutorial.task7.goal",
    hints: ["tutorial.task7.hint1.html", "tutorial.task7.hint2.html", "tutorial.task7.hint3.html"],
    explanation: "tutorial.task7.explanation.html",
  },
  "tutorial-8": {
    title: "tutorial.task8.title",
    goal: "tutorial.task8.goal",
    hints: ["tutorial.task8.hint1.html", "tutorial.task8.hint2.html", "tutorial.task8.hint3.html"],
    explanation: "tutorial.task8.explanation.html",
  },
} as const satisfies Readonly<Record<TutorialTaskId, TutorialTaskMessages>>;

/** The panel itself, once it is drawn. */
const PANEL_SELECTOR = ".tutorialpanel";

/**
 * Where the panel records the task it was drawn for.
 *
 * The panel keeps no state in a variable — it is redrawn from its arguments and
 * nothing survives between calls — so the number it was last drawn for lives in
 * the markup, which is the only thing that does survive. See
 * {@link presentTutorial} for what it is used to decide.
 */
const TASK_INDEX_ATTRIBUTE = "data-task-index";

/** The four disclosures, in the order they are drawn: three hints, then why. */
const DISCLOSURE_SELECTOR = ".tutorialhint, .tutorialexplanation";

/**
 * Everything in the panel a player can be standing on when it is redrawn.
 *
 * The four summaries and the two buttons, in document order, which is the
 * order `querySelectorAll` returns them in. Every one of them is destroyed by a
 * redraw, so every one of them needs somewhere to put the focus back.
 *
 * Both halves are written against the panel rather than one against the panel
 * and one against the button row, so that a control added anywhere in the panel
 * later is covered by this without anybody having to remember it exists.
 */
const CONTROL_SELECTOR = ".tutorialpanel summary, .tutorialpanel button";

/** The button that copies the task's program into the player's own editor. */
const TAKE_CODE_SELECTOR = ".tutorialtakecode";

/**
 * The line that says whether that copy happened.
 *
 * Drawn empty by {@link tutorialTemplate} and written to on the click; see the
 * note there for why it is not created at the moment there is something to say.
 */
const TAKEN_SELECTOR = ".tutorialtaken";

/**
 * What that line is currently saying, in a form a redraw can act on.
 *
 * The text itself cannot be carried across a redraw: one of the redraws is the
 * language changing, and English news restored into a Russian panel would be
 * the one line of the page the picker had not translated. The *answer* survives
 * instead, and the sentence is looked up again — the same reason this file takes
 * a task index rather than the words for it.
 *
 * On the markup for the same reason {@link TASK_INDEX_ATTRIBUTE} is: the panel
 * keeps nothing in a variable between calls, and the drawn markup is the only
 * thing that outlives one.
 */
const TAKEN_STATE_ATTRIBUTE = "data-taken";

/**
 * The two things that line can say, by the answer that produces them.
 *
 * A token in the markup rather than the message key itself, so that the
 * attribute is not a place a key can be misspelled: {@link t} is reached only
 * through this table, and a renamed message fails the build here as it does
 * everywhere else.
 */
const TAKEN_MESSAGES = {
  yes: "tutorial.panel.codeTaken",
  no: "tutorial.panel.codeRefused",
} as const satisfies Readonly<Record<string, MessageKey>>;

/** The answers {@link TAKEN_MESSAGES} has a sentence for. */
type TakenState = keyof typeof TAKEN_MESSAGES;

/**
 * Reads back what a drawn panel's line was saying.
 *
 * @param value - The attribute's value, or null when the line said nothing.
 * @returns The answer it recorded, or `undefined` when it recorded none.
 */
function takenStateOf(value: string | null): TakenState | undefined {
  return value === "yes" || value === "no" ? value : undefined;
}

/** The button that copies the task's answer to the clipboard. */
const COPY_CODE_SELECTOR = ".tutorialcopycode";

/**
 * The line that says whether that copy happened.
 *
 * Drawn empty by {@link tutorialTemplate} and written to on the click, the way
 * {@link TAKEN_SELECTOR}'s line is; see the note there for why it is not
 * created at the moment there is something to say.
 */
const COPIED_SELECTOR = ".tutorialcopied";

/**
 * What that line is currently saying, in a form a redraw can act on.
 *
 * See {@link TAKEN_STATE_ATTRIBUTE} for why this is an attribute on the
 * markup rather than a variable, and for why it is the answer that is carried
 * across a redraw rather than the sentence itself.
 */
const COPIED_STATE_ATTRIBUTE = "data-copied";

/**
 * The two things that line can say, by the answer that produces them.
 *
 * A token in the markup rather than the message key itself, for the reason
 * {@link TAKEN_MESSAGES} is.
 */
const COPIED_MESSAGES = {
  yes: "tutorial.solution.copied",
  no: "tutorial.solution.copyFailed",
} as const satisfies Readonly<Record<string, MessageKey>>;

/** The answers {@link COPIED_MESSAGES} has a sentence for. */
type CopiedState = keyof typeof COPIED_MESSAGES;

/**
 * Reads back what a drawn panel's copy line was saying.
 *
 * @param value - The attribute's value, or null when the line said nothing.
 * @returns The answer it recorded, or `undefined` when it recorded none.
 */
function copiedStateOf(value: string | null): CopiedState | undefined {
  return value === "yes" || value === "no" ? value : undefined;
}

/**
 * Copies the task's answer to the clipboard, and reports whether that worked.
 *
 * The text comes off the rendered `<code>` rather than out of
 * `TutorialPanelData`, because the element's `textContent` is the program
 * exactly as `highlightJavaScript` reconstructs it — see the note there — and
 * reading it back is simpler than threading the task's solution string through
 * a second path to reach the same button.
 *
 * `navigator.clipboard.writeText` is wrapped in a `try`/`catch` rather than
 * checked for beforehand: `navigator.clipboard` is `undefined` in an insecure
 * context and absent from jsdom, and the call itself rejects when the
 * permission is refused, so one `catch` covers both without asking the caller
 * to know which browser it is running in — the same shape `editor.ts`'s
 * `writeStorage` uses for its own `localStorage` write.
 *
 * @param parent - The `.tutorial` element the panel is drawn into.
 */
async function copySolution(parent: HTMLElement): Promise<void> {
  const code = requireElement(".tutorialsolution code", parent).textContent;
  let copied: boolean;
  try {
    await navigator.clipboard.writeText(code);
    copied = true;
  } catch {
    copied = false;
  }
  const state: CopiedState = copied ? "yes" : "no";
  const line = requireElement(COPIED_SELECTOR, parent);
  line.setAttribute(COPIED_STATE_ATTRIBUTE, state);
  line.textContent = t(COPIED_MESSAGES[state]);
}

/** The button that leaves the track for the numbered challenges. */
const LEAVE_SELECTOR = ".tutorialleave";

/**
 * What the panel needs in order to draw itself and to be acted on.
 *
 * Deliberately not the words: see the note at the top of this file.
 */
export interface TutorialPanelData {
  /** Zero-based index into `tutorialTasks`. */
  readonly taskIndex: number;
  /** How many tasks the player has cleared, for the progress line. */
  readonly clearedCount: number;
  /**
   * Called when the player asks for this task's program in their own editor.
   *
   * Only after the confirmation has been agreed to, when one was asked for; see
   * {@link TutorialPanelData.hasOwnProgram}.
   *
   * @returns Whether the program was really stored. The panel says one thing or
   * the other on the strength of this, so a caller that cannot fail still has to
   * answer `true` rather than nothing: the write goes to a buffer the player
   * cannot see from the track, and a confirmation is the only evidence they get
   * that the button did anything. Silence on refusal was the old behaviour and
   * it left them believing an afternoon's work was saved when it was not.
   */
  readonly onTakeCode: () => boolean;
  /** Called when the player asks to leave the track for the challenges. */
  readonly onLeave: () => void;
  /**
   * Whether the player's own editor already holds a program worth keeping.
   *
   * Taking a task's program is destructive: it replaces whatever is in the game
   * editor, which for a player who arrived at the track from the challenges is
   * an evening's work. `tutorial.button.takeCodeConfirm` is the question asked
   * before that happens, and this is what decides whether it needs asking — an
   * empty editor has nothing to lose, and a confirmation with no cost behind it
   * is the kind players learn to dismiss without reading.
   *
   * A function, and asked at the moment the button is pressed rather than at the
   * moment the panel is drawn, because the panel outlives the answer: a player
   * who writes their first program while on task 5 would otherwise be measured
   * against the empty store the panel was drawn over and have that program taken
   * away without a word.
   *
   * Required, though every other way of getting this wrong is silent, because
   * the only wrong default is one that skips the question: a caller that forgets
   * it should not compile rather than overwrite the player's work. `App` answers
   * it with `playerCodeWouldBeReplaced()`.
   */
  readonly hasOwnProgram: () => boolean;
}

/**
 * Whether an id is one the catalogue describes a task for.
 *
 * A type guard rather than a cast, so the narrowing is something the runtime
 * really established: `Object.hasOwn` asks the table itself instead of trusting
 * that its rows still name the eight tasks `tutorialTasks` holds.
 *
 * @param value - A task's id, from the track's own table.
 * @returns Whether {@link TUTORIAL_TASK_MESSAGES} has a row for it.
 */
function isTaskId(value: string): value is TutorialTaskId {
  return Object.hasOwn(TUTORIAL_TASK_MESSAGES, value);
}

/**
 * Asks the player before overwriting the program they wrote themselves.
 *
 * @param data - The panel's data, for the callback that knows whether the
 * editor holds anything.
 * @returns Whether taking the program should go ahead.
 */
function takeCodeAgreed(data: TutorialPanelData): boolean {
  // `window.confirm` rather than a dialog of the game's own, matching the two
  // questions the run controls already ask before throwing a program away. It is
  // modal, focusable and readable by every assistive technology without a line
  // of code here, which a hand-built one would not be.
  return !data.hasOwnProgram() || window.confirm(t("tutorial.button.takeCodeConfirm"));
}

/**
 * Draws the learning track's panel and wires up its three buttons.
 *
 * Safe to call over a panel that is already there, which is the only way it is
 * ever called after the first time: the track redraws it when the player clears
 * a task, and `App.relocalise` redraws it when the language changes. The old
 * panel is replaced wholesale rather than patched, so there is no state to keep
 * in step and no handler that can be bound twice.
 *
 * Two things do have to survive that replacement, and neither is derivable from
 * the arguments:
 *
 * - Which hints the player had opened, but only while the task stays the same. A
 *   redraw for the same task is the language changing or the run restarting, and
 *   closing the hint somebody is reading in order to tell them the same thing in
 *   another language is the panel undoing the player's own work. A redraw for a
 *   *different* task is the opposite case: the third hint holds the answer, so
 *   carrying it open into the next task would hand out that task's answer before
 *   its goal had been read. The task the markup was drawn for is therefore read
 *   back off it before it is thrown away.
 * - The focus. A redraw destroys whichever hint or button the player was
 *   standing on, and a keyboard player would be dropped back at the top of the
 *   document with the whole page to tab through again (WCAG 2.4.3). The control
 *   that lands in the same position takes the focus back, the same way the
 *   challenge bar restores its navigation row: the panel's controls are the same
 *   seven in the same order for every task, so the position is the control.
 *
 * @param parent - The `.tutorial` element of the page shell.
 * @param data - Which task, how far along, and what its two buttons do.
 * @throws {RangeError} When the track has no task at that index.
 * @throws {Error} When it has one, but the catalogue has no prose for it.
 */
export function presentTutorial(parent: HTMLElement, data: TutorialPanelData): void {
  const task = tutorialTasks[data.taskIndex];
  // The number the player is told, and deliberately not the number in the task's
  // id: "Task 3 of 8" is a statement about where they are on the track, so it
  // counts positions. The prose is looked up by id instead, and the two are
  // different numbers the moment a task is inserted -- see
  // TUTORIAL_TASK_MESSAGES.
  const taskNumber = data.taskIndex + 1;
  // Both of these are thrown rather than drawn around, because there is nothing
  // honest to draw: a panel with no task in it would tell the player they are on
  // a task that does not exist. They are two throws rather than one because they
  // are two different mistakes, and an error that names the wrong one sends
  // whoever meets it to the wrong file -- the first is a caller that made an
  // index up, the second is a ninth task added to `tutorialTasks` with no prose
  // written for it. See TUTORIAL_TASK_MESSAGES for why only the second can
  // happen at all: the missing-prose direction is the one the compiler cannot
  // catch, because an array's length is not part of its type.
  if (task === undefined) {
    // A RangeError, and worded as `App.startTutorial` words its own, so that the
    // two ways to ask for a task that is not there fail the same way.
    throw new RangeError(`No tutorial task with index ${String(data.taskIndex)}`);
  }
  if (!isTaskId(task.id)) {
    throw new Error(`No panel prose for tutorial task ${task.id}`);
  }
  const messages = TUTORIAL_TASK_MESSAGES[task.id];
  const [hint1, hint2, hint3] = messages.hints;

  const drawn = query(PANEL_SELECTOR, parent);
  const sameTask = drawn?.getAttribute(TASK_INDEX_ATTRIBUTE) === String(data.taskIndex);
  const wasOpen = sameTask
    ? queryAll(DISCLOSURE_SELECTOR, parent).map(
        (disclosure) => disclosure instanceof HTMLDetailsElement && disclosure.open,
      )
    : [];
  const focusedControl = queryAll(CONTROL_SELECTOR, parent).findIndex(
    (control) => control === document.activeElement,
  );
  // Carried across a redraw of the same task, and dropped when the task changes.
  // Three things redraw this panel and none of them is news: the run starting
  // again, the language changing, and -- the one that made this necessary -- the
  // task being cleared, which redraws the panel to move its counter on while the
  // player is looking at it. Without this the confirmation they had just been
  // given would vanish underneath the overlay congratulating them. A different
  // task is the one case where it has to go: the copy was made of a program the
  // panel is no longer showing.
  const takenState = sameTask
    ? takenStateOf(query(TAKEN_SELECTOR, parent)?.getAttribute(TAKEN_STATE_ATTRIBUTE) ?? null)
    : undefined;
  // Carried the same way and for the same reason as `takenState`: a copy made
  // moments ago should still say so after the panel is redrawn to move the
  // progress line on, and a different task means a different answer was on the
  // clipboard button, so nothing here is still true of it.
  const copiedState = sameTask
    ? copiedStateOf(query(COPIED_SELECTOR, parent)?.getAttribute(COPIED_STATE_ATTRIBUTE) ?? null)
    : undefined;

  const panel = renderElement(
    tutorialTemplate({
      taskNumber,
      taskCount: tutorialTasks.length,
      clearedCount: data.clearedCount,
      title: t(messages.title),
      goal: t(messages.goal),
      hints: [t(hint1), t(hint2), t(hint3)],
      // Both straight from the task table, and deliberately not from the
      // catalogue even though that is where the rest of this task's text now
      // lives: the table is what `tutorial-solutions.test.ts` clears the task
      // with, so the answer on screen and the answer that is known to work are
      // one string read one way. Reading `tutorial.taskN.solutionCode.code`
      // here as well would be a second call site for one message with nothing
      // comparing the two, and the player would be the one told something
      // untrue. The table renders it when it is asked, so this is the answer
      // in the language being drawn. `startingCode` rides along for the same
      // reason: it is never printed, only diffed against `solutionCode` to
      // find the line the answer marks, and a diff has to compare two drafts
      // of the one program the player is actually shown.
      startingCode: task.startingCode,
      solutionCode: task.solutionCode,
      explanation: t(messages.explanation),
    }),
  );

  if (takenState !== undefined) {
    // Written while the panel is still detached, which is what makes this a
    // restoration rather than a second announcement: a live region that is
    // inserted with its text already in it is generally not read out, and the
    // player heard this sentence when they pressed the button. The click below
    // writes into the region once it is in the document, which is the case where
    // being read out is the whole point.
    const line = requireElement(TAKEN_SELECTOR, panel);
    line.setAttribute(TAKEN_STATE_ATTRIBUTE, takenState);
    line.textContent = t(TAKEN_MESSAGES[takenState]);
  }
  if (copiedState !== undefined) {
    // The same restoration, for the copy button's line.
    const line = requireElement(COPIED_SELECTOR, panel);
    line.setAttribute(COPIED_STATE_ATTRIBUTE, copiedState);
    line.textContent = t(COPIED_MESSAGES[copiedState]);
  }
  parent.replaceChildren(panel);

  queryAll(DISCLOSURE_SELECTOR, parent).forEach((disclosure, index) => {
    if (wasOpen[index] === true && disclosure instanceof HTMLDetailsElement) {
      disclosure.open = true;
    }
  });

  // Nothing is said when the question was asked and answered no, which is the
  // one case here that needs no line: the player was shown a dialog about this
  // and dismissed it themselves.
  requireElement(TAKE_CODE_SELECTOR, parent).addEventListener("click", () => {
    if (takeCodeAgreed(data)) {
      // The copy is made before the line to report it is looked up, and not in
      // the same expression. An assignment resolves the element it assigns to
      // first, so an `onTakeCode` that redrew the panel -- it is supplied by the
      // object that owns the redrawing -- would leave this writing news into a
      // paragraph that had already been thrown away.
      const state: TakenState = data.onTakeCode() ? "yes" : "no";
      const line = requireElement(TAKEN_SELECTOR, parent);
      line.setAttribute(TAKEN_STATE_ATTRIBUTE, state);
      line.textContent = t(TAKEN_MESSAGES[state]);
    }
  });
  requireElement(COPY_CODE_SELECTOR, parent).addEventListener("click", () => {
    void copySolution(parent);
  });
  requireElement(LEAVE_SELECTOR, parent).addEventListener("click", () => {
    data.onLeave();
  });

  // `findIndex` answers -1 when the focus was somewhere else entirely -- in the
  // editor, say, which is where Ctrl-Enter redraws the page from -- and indexing
  // with -1 gives undefined, so the panel takes the focus only when it was the
  // panel that lost it.
  queryAll(CONTROL_SELECTOR, parent)[focusedControl]?.focus();
}
