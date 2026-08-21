/**
 * The learning track's panel: the block of prose beside the building, shown
 * while a player is working through `src/game/tutorial.ts`.
 *
 * It is a presenter in the sense the module that was `presenters.ts` used the
 * word — one function for one region of the page, drawing it wholesale and
 * subscribing to nothing — and it was kept out of that file for the reason
 * the track is kept out of `levels.ts`: nothing here is part of a
 * level.
 *
 * The interface takes a level *index* rather than the words to print, and that is
 * the one design decision the rest of this file follows from. Changing language
 * redraws the page by calling every region's presenter again, so a panel handed
 * finished sentences would keep the sentences it was handed and be the one
 * column of the page still in English after the language picker had done its
 * work. Asking the catalog at draw time makes the language a property of the
 * moment of drawing instead.
 *
 * That in turn is why the key table below is written out by hand. A message key
 * has to reach `t` as a string literal: the parameters a message takes are
 * derived from the literal by `Placeholders<S>` in `src/i18n/catalog.ts`, so
 * `t(`tutorial.level${n}.title`)` is not a call that can be type-checked, and
 * casting one through would give up every guarantee the typed catalog exists
 * to provide — a renamed message would then print its own key at the player
 * rather than failing the build.
 */

import { tutorialLevels } from "#game/tutorial.ts";
import { t, type MessageKey } from "#i18n/index.ts";
import { query, queryAll, requireElement } from "#shared/lib/dom.ts";
import { markup, raw, renderElement } from "#shared/ui/markup.ts";

import { highlightJavaScript } from "../../../ui/code-highlight.ts";
import { changedLines } from "../../../ui/line-diff.ts";

/**
 * Every level the catalog has prose for, named by its title message.
 *
 * Read out of {@link MessageKey} rather than written down, so that this is the
 * catalog's own answer to "how many levels are there" and not a second opinion
 * about it.
 */
type TutorialTitleKey = Extract<MessageKey, `tutorial.level${number}.title`>;

/**
 * The id of the level one of those keys describes.
 *
 * `tutorial.level3.title` is the title of the level whose `id` is `tutorial-3`,
 * and the mapping is spelled out here rather than assumed, because
 * the whole point of keying the table below by id is that the number in the id
 * and the level's position in `tutorialLevels` are not the same number.
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
type LevelIdOf<K> = K extends `tutorial.level${infer N extends number}.title`
  ? `tutorial-${N}`
  : never;

/** The ids of the levels the catalog describes. */
type TutorialLevelId = LevelIdOf<TutorialTitleKey>;

/** The four things the catalog says about one level. */
interface TutorialLevelMessages {
  /** Its name. */
  readonly title: MessageKey;
  /** What it asks the player to do. */
  readonly goal: MessageKey;
  /** Its three hints, from a nudge to the answer. */
  readonly hints: readonly [MessageKey, MessageKey, MessageKey];
  /** Why the level behaves the way it does, read after it is cleared. */
  readonly explanation: MessageKey;
}

/**
 * Which messages describe which level.
 *
 * Keyed by the level's id and not by where it sits in `tutorialLevels`, which is
 * the same rule `src/game/tutorial.ts` states for the saved attempt, the
 * progress mark and the bookmarked address, and it is here for the same reason:
 * a ninth level inserted between two existing ones moves every level after it,
 * and a table read by position would then print level 3's title, goal and hints
 * over level 4's building. The answer under the last hint would not move with
 * them — it comes off the level at that index rather than out of this table — so
 * the panel would show one program and describe another, and nothing would
 * throw.
 *
 * Coming off the level is what keeps the answer in step with the building. It is
 * not what keeps it in step with the level, and it stopped being an argument that
 * this hazard lives only in this file the day the programs became messages: a
 * level reaches its own two through `tutorial.levelN.startingCode.code` and
 * `tutorial.levelN.solutionCode.code`, written out by hand at the entry that uses
 * them, so the very slip described above is available one file away, in
 * `src/game/tutorial.ts`, and the compiler can no more see it there than here —
 * a key that belongs to the next level is still a key. What holds the sixteen
 * programs to the levels that own them is `src/game/tutorial.test.ts`, which
 * requires no two levels to hand out one program beyond the answer level 8 copies
 * from level 7 on purpose.
 *
 * Every key is spelled out because every one of them has to reach `t` as a
 * literal; see the note at the top of this file for why building them from the
 * level's number is not an option.
 *
 * The type is doing three separate jobs and each of them catches a different
 * mistake:
 *
 * - `TutorialLevelMessages` types each field as a {@link MessageKey}, so a
 *   misspelled or renamed key is a compile error here rather than the message's
 *   own name printed into the panel, which is what `t` does with a key it cannot
 *   find.
 * - `Record<TutorialLevelId, …>` demands a row for every level the catalog
 *   describes. A ninth level's messages added to `src/i18n/en.ts` without a row
 *   here stops this file compiling — the alternative being a panel that draws
 *   its chrome and nothing else, which is a blank page with buttons on it.
 * - `as const` keeps the values as the literal types `t` needs. An annotation
 *   would widen them to `MessageKey`, and `t` refuses that union: some member of
 *   it takes parameters, so the parameter object would become mandatory for all
 *   of them.
 *
 * The other direction — a ninth entry in `tutorialLevels` with no prose written
 * for it — cannot be a compile error, because `tutorialLevels` is an array and
 * its length is not part of its type. It is also only half caught by the ids:
 * the union above is built from the *title* keys, so a level whose title exists
 * and whose hints do not is a compile error, and a level with no messages at all
 * is not. {@link presentTutorial} throws on that one, and
 * `tutorial-panel.test.ts` draws every level on the track so that the throw is
 * met by whoever adds the level rather than by a player.
 */
const TUTORIAL_LEVEL_MESSAGES = {
  "tutorial-1": {
    title: "tutorial.level1.title",
    goal: "tutorial.level1.goal",
    hints: [
      "tutorial.level1.hint1.html",
      "tutorial.level1.hint2.html",
      "tutorial.level1.hint3.html",
    ],
    explanation: "tutorial.level1.explanation.html",
  },
  "tutorial-2": {
    title: "tutorial.level2.title",
    goal: "tutorial.level2.goal",
    hints: [
      "tutorial.level2.hint1.html",
      "tutorial.level2.hint2.html",
      "tutorial.level2.hint3.html",
    ],
    explanation: "tutorial.level2.explanation.html",
  },
  "tutorial-3": {
    title: "tutorial.level3.title",
    goal: "tutorial.level3.goal",
    hints: [
      "tutorial.level3.hint1.html",
      "tutorial.level3.hint2.html",
      "tutorial.level3.hint3.html",
    ],
    explanation: "tutorial.level3.explanation.html",
  },
  "tutorial-4": {
    title: "tutorial.level4.title",
    goal: "tutorial.level4.goal",
    hints: [
      "tutorial.level4.hint1.html",
      "tutorial.level4.hint2.html",
      "tutorial.level4.hint3.html",
    ],
    explanation: "tutorial.level4.explanation.html",
  },
  "tutorial-5": {
    title: "tutorial.level5.title",
    goal: "tutorial.level5.goal",
    hints: [
      "tutorial.level5.hint1.html",
      "tutorial.level5.hint2.html",
      "tutorial.level5.hint3.html",
    ],
    explanation: "tutorial.level5.explanation.html",
  },
  "tutorial-6": {
    title: "tutorial.level6.title",
    goal: "tutorial.level6.goal",
    hints: [
      "tutorial.level6.hint1.html",
      "tutorial.level6.hint2.html",
      "tutorial.level6.hint3.html",
    ],
    explanation: "tutorial.level6.explanation.html",
  },
  "tutorial-7": {
    title: "tutorial.level7.title",
    goal: "tutorial.level7.goal",
    hints: [
      "tutorial.level7.hint1.html",
      "tutorial.level7.hint2.html",
      "tutorial.level7.hint3.html",
    ],
    explanation: "tutorial.level7.explanation.html",
  },
  "tutorial-8": {
    title: "tutorial.level8.title",
    goal: "tutorial.level8.goal",
    hints: [
      "tutorial.level8.hint1.html",
      "tutorial.level8.hint2.html",
      "tutorial.level8.hint3.html",
    ],
    explanation: "tutorial.level8.explanation.html",
  },
} as const satisfies Readonly<Record<TutorialLevelId, TutorialLevelMessages>>;

/** The panel itself, once it is drawn. */
const PANEL_SELECTOR = ".tutorialpanel";

/**
 * Where the panel records the level it was drawn for.
 *
 * The panel keeps no state in a variable — it is redrawn from its arguments and
 * nothing survives between calls — so the number it was last drawn for lives in
 * the markup, which is the only thing that does survive. See
 * {@link presentTutorial} for what it is used to decide.
 */
const LEVEL_INDEX_ATTRIBUTE = "data-level-index";

/** The four disclosures, in the order they are drawn: three hints, then why. */
const DISCLOSURE_SELECTOR = ".tutorialhint, .tutorialexplanation";

/**
 * Everything in the panel a player can be standing on when it is redrawn.
 *
 * The four summaries and the copy button, which `querySelectorAll` returns in
 * document order: the three hint summaries, then the button, which the last of
 * those hints holds inside itself along with the answer, then the explanation's.
 * Every one of them is destroyed by a redraw, so every one of them needs
 * somewhere to put the focus back.
 *
 * Both halves are written against the panel rather than against the boxes the
 * controls happen to sit in today, so that a control added anywhere in the panel
 * later is covered by this without anybody having to remember it exists.
 */
const CONTROL_SELECTOR = ".tutorialpanel summary, .tutorialpanel button";

/** The button that copies the level's answer to the clipboard. */
const COPY_CODE_SELECTOR = ".tutorialcopycode";

/**
 * The line that says whether that copy happened.
 *
 * Drawn empty by {@link tutorialTemplate} and written to on the click; see the
 * note there for why it is not created at the moment there is something to say.
 */
const COPIED_SELECTOR = ".tutorialcopied";

/**
 * What that line is currently saying, in a form a redraw can act on.
 *
 * The text itself cannot be carried across a redraw: one of the redraws is the
 * language changing, and English news restored into a Russian panel would be
 * the one line of the page the picker had not translated. The *answer* survives
 * instead, and the sentence is looked up again — the same reason this file takes
 * a level index rather than the words for it.
 *
 * On the markup for the same reason {@link LEVEL_INDEX_ATTRIBUTE} is: the panel
 * keeps nothing in a variable between calls, and the drawn markup is the only
 * thing that outlives one.
 */
const COPIED_STATE_ATTRIBUTE = "data-copied";

/**
 * The two things that line can say, by the answer that produces them.
 *
 * A token in the markup rather than the message key itself, so that the
 * attribute is not a place a key can be misspelled: {@link t} is reached only
 * through this table, and a renamed message fails the build here as it does
 * everywhere else.
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
 * Copies the level's answer to the clipboard, and reports whether that worked.
 *
 * The text comes off the rendered `<code>` rather than out of
 * `TutorialPanelData`, because the element's `textContent` is the program
 * exactly as `highlightJavaScript` reconstructs it — see the note there — and
 * reading it back is simpler than threading the level's solution string through
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

/**
 * What the panel needs in order to draw itself.
 *
 * One field, and deliberately still an object rather than a bare number: the
 * panel is drawn from the catalog at the moment of drawing (see the note at
 * the top of this file), so what a caller supplies is only ever "which level",
 * and a named field says which number that is where a positional argument would
 * not.
 */
export interface TutorialPanelData {
  /** Zero-based index into `tutorialLevels`. */
  readonly levelIndex: number;
}

/**
 * Whether an id is one the catalog describes a level for.
 *
 * A type guard rather than a cast, so the narrowing is something the runtime
 * really established: `Object.hasOwn` asks the table itself instead of trusting
 * that its rows still name the eight levels `tutorialLevels` holds.
 *
 * @param value - A level's id, from the track's own table.
 * @returns Whether {@link TUTORIAL_LEVEL_MESSAGES} has a row for it.
 */
function isLevelId(value: string): value is TutorialLevelId {
  return Object.hasOwn(TUTORIAL_LEVEL_MESSAGES, value);
}

/** Everything the learning track's panel needs in order to render itself. */
export interface TutorialTemplateData {
  /**
   * One-based number of the level being played.
   *
   * Not printed. It is written into the markup as
   * {@link LEVEL_INDEX_ATTRIBUTE}, which is how a redraw tells a redraw of the
   * same level from a move to the next one; see {@link presentTutorial}.
   */
  readonly levelNumber: number;
  /** The level's name. Text, written escaped. */
  readonly title: string;
  /** What the level asks the player for. Text, written escaped. */
  readonly goal: string;
  /**
   * The three hints, in the order they are offered.
   *
   * Trusted markup: every one of them is a `.html` message of this repository's
   * own catalog, and several carry `<span class="emphasis-color">` around the
   * identifier being talked about. Nothing a player typed reaches this field.
   *
   * A three-element tuple rather than an array, because "the last one" and "the
   * one the answer goes under" have to be the same hint: {@link tutorialTemplate}
   * prints {@link TutorialTemplateData.solutionCode} beneath the final entry, and
   * a two-hint level would silently print the answer under hint 2.
   */
  readonly hints: readonly [string, string, string];
  /**
   * The program the level starts the player with, exactly as
   * `src/game/tutorial.ts` holds it.
   *
   * Printed nowhere — the panel only ever shows the answer — and read for one
   * thing: {@link "../../../ui/line-diff.ts"!changedLines} compares it against
   * {@link TutorialTemplateData.solutionCode} to find the line or lines a
   * player actually has to write, which is what the answer marks. A field of
   * its own rather than folding the diff in here, because that keeps this
   * interface a plain record of what the panel is told and leaves the deciding
   * to the function that draws the answer.
   */
  readonly startingCode: string;
  /**
   * The program that clears the level, exactly as `src/game/tutorial.ts` holds it.
   *
   * Handed to {@link "../../../ui/code-highlight.ts"!highlightJavaScript} rather
   * than interpolated by {@link markup}, which is why it does not appear escaped
   * in the template below the way the level's title and goal do: the highlighter
   * parses it as JavaScript and escapes every character of it itself as it
   * writes each token out, so the two functions have to keep agreeing on the
   * same five characters, and `code-highlight.test.ts` and this module's own
   * tests both pin them. It is the same string `tutorial-solutions.test.ts`
   * proves the level with, which is why it comes from the level table rather than
   * from the catalog.
   */
  readonly solutionCode: string;
  /**
   * Why the level behaves the way it does, shown after the answer.
   *
   * Trusted markup, for the same reason the hints are: a `.html` message of this
   * repository's own catalog.
   */
  readonly explanation: string;
}

/** The two programs {@link tutorialAnswerTemplate} needs: what changed, and against what. */
interface TutorialAnswerData {
  /** The program the level starts the player with; see {@link changedLines}. */
  readonly startingCode: string;
  /** The program that clears the level, which is what gets shown and copied. */
  readonly solutionCode: string;
}

/**
 * The answer, under the last hint: the program that clears the level,
 * syntax-highlighted, with the line or lines a player has to write marked, and
 * a button that copies it.
 *
 * The mark is computed rather than written into the hint's own prose, which is
 * what named the changed line before this existed: `changedLines` compares
 * {@link TutorialAnswerData.startingCode} against
 * {@link TutorialAnswerData.solutionCode} — the two strings the level already
 * holds, and the only two a diff could possibly disagree with — so there is no
 * second copy of "line 2 is new" for a level's wording to drift away from.
 * `changedLines` finds lines, not characters, because every level on the track
 * changes the player's program by adding or rewriting whole lines; a
 * character-level diff would buy nothing here and cost a harder-to-read mark.
 *
 * `<pre><code>` rather than a styled `<div>`: it is the pair the help page
 * already prints its examples in, so the block picks up the editor's own
 * colours and the wrapping the narrow-screen rules give code, and a screen
 * reader is told this is code rather than a run-on sentence of punctuation.
 * `highlightJavaScript` writes each source line into its own `<span>` (a
 * `<mark class="tutoriallinechanged">` for a changed one) and escapes every
 * character itself, which is why `raw` is used here rather than letting
 * {@link markup} escape the whole string as one attribute value — see the note
 * on {@link TutorialTemplateData.solutionCode}.
 *
 * The copy button and the line that reports what it did sit above the code in
 * their own row, `.tutorialanswertools`, so that the pair reads as one control
 * and its receipt rather than as two things that happen to be near the answer.
 * `.tutorialcopied` is drawn empty and filled in by {@link presentTutorial} on
 * the click, and not created at the moment there is something to say: a live
 * region has to already be in the document when its text arrives, or the
 * announcement generally does not happen.
 *
 * @param answer - The starting program and the one that clears the level.
 * @returns The answer block's markup.
 */
function tutorialAnswerTemplate(answer: TutorialAnswerData): string {
  const highlighted = highlightJavaScript(
    answer.solutionCode,
    changedLines(answer.startingCode, answer.solutionCode),
  );
  return markup`<div class="tutorialanswer"><div class="tutorialanswertools"><button type="button" class="tutorialcopycode">${t("tutorial.solution.copy")}</button><p class="tutorialcopied" aria-live="polite"></p></div><pre class="tutorialsolution"><code>${raw(highlighted)}</code></pre></div>`;
}

/**
 * One hint, as something the player has to decide to open.
 *
 * A native `<details>`, for the reasons written out at {@link seedHelpTemplate}:
 * the `<summary>` is in the tab order without a `tabindex`, Enter and Space work
 * on it, and it is announced as a disclosure with its expanded state without a
 * single ARIA attribute — on markup {@link presentTutorial} rebuilds from
 * scratch every time the language changes.
 *
 * Closed is the only defensible default here, and more so than on the seed line.
 * The hints are ordered from a nudge to the answer, and a level whose answer is
 * on screen before the player has read the goal is not a level. That is also why
 * they are three separate disclosures rather than one holding all three: opening
 * the third is a decision, and a single panel would spend it on the first.
 *
 * @param number - One-based hint number, which is what the summary says.
 * @param hint - The hint itself; trusted markup from the catalog.
 * @param answer - The starting and solution programs, printed under the hint by
 * {@link tutorialAnswerTemplate}, or `null` for a hint that is not the last one.
 * @returns The disclosure's markup.
 */
function tutorialHintTemplate(
  number: number,
  hint: string,
  answer: TutorialAnswerData | null,
): string {
  const drawnAnswer = answer === null ? "" : tutorialAnswerTemplate(answer);
  return markup`<details class="tutorialhint"><summary>${t("tutorial.panel.hintSummary", { number })}</summary><p class="tutorialprose">${raw(hint)}</p>${raw(drawnAnswer)}</details>`;
}

/**
 * The learning track's panel: what this level asks, and what to try.
 *
 * Drawn as a `<section>` with a name, which makes it a region landmark: the
 * track puts a block of prose beside the building, and without a landmark a
 * screen-reader player has no way to jump over it to the game or back to it for
 * the next hint. A `<section>` with no name is not a landmark at all, so the
 * name is what the element is for (WCAG 1.3.1: the structure a sighted player
 * can see has to be there in the markup too).
 *
 * The name is the level's own title, which is also the heading immediately
 * inside it, so the words announced on the way in are the words on the screen.
 * `aria-labelledby` pointing at that heading would name the landmark from one
 * string instead of two — but it is one string already, since both are
 * {@link TutorialTemplateData.title}, and the id it would need is a second
 * thing that has to stay unique in a page this panel does not own.
 *
 * Naming it after the level and not after the track is the same decision the
 * rest of this panel now makes: eight lessons that each say "Learning track" at
 * the top, over a row of ticks counting how far along the eight the player is,
 * put the track between the player and the level they are actually on. What a
 * lesson is for is the one level in front of it, so the panel says what that
 * level is called, what it asks, what to try, and why it happens -- and where
 * the player is on the track is left to the app bar's level switcher, which is
 * where the game says that about every other level too.
 *
 * The order is the order it is read in, and it is the order of a lesson: what
 * this is, what to do, what to try if it will not come, and why it happened.
 *
 * Three kinds of string arrive in this template and they are written
 * differently. The level's name and its goal are text and are escaped; the
 * hints and the explanation are `.html` messages of this repository's own
 * catalog and are inserted verbatim. The answer is the exception that looks
 * like the rule: it comes from `src/game/tutorial.ts` rather than the
 * catalog, and is neither escaped by `markup` nor inserted verbatim, but
 * parsed and escaped a token at a time by
 * {@link "../../../ui/code-highlight.ts"!highlightJavaScript} — see the note on
 * {@link TutorialTemplateData.solutionCode}. Nothing here can carry player
 * input — the editor's contents never reach this function, and the one thing
 * that does come from outside the repository, the level index, is used to look
 * up messages rather than printed.
 *
 * @param data - Which level it is drawing, and everything that level says.
 * @returns The panel's markup, as exactly one element.
 */
export function tutorialTemplate(data: TutorialTemplateData): string {
  const hints = data.hints
    .map((hint, index) =>
      tutorialHintTemplate(
        index + 1,
        hint,
        index === data.hints.length - 1
          ? { startingCode: data.startingCode, solutionCode: data.solutionCode }
          : null,
      ),
    )
    .join("");
  // The index is written into the markup because it is the one piece of state
  // the panel has to remember about itself: presentTutorial carries the open
  // hints across a redraw of the same level and deliberately does not carry them
  // across a change of level, and after `replaceChildren` the old panel is the
  // only place the number it was drawn for still exists.
  return markup`<section class="tutorialpanel" data-level-index="${data.levelNumber - 1}" aria-label="${data.title}"><h2 class="tutorialtitle">${data.title}</h2><p class="tutorialgoal">${data.goal}</p>${raw(hints)}<details class="tutorialexplanation"><summary>${t("tutorial.panel.explanationSummary")}</summary><p class="tutorialprose">${raw(data.explanation)}</p></details></section>`;
}

/**
 * Draws the learning track's panel and wires up its copy button.
 *
 * Safe to call over a panel that is already there, which is the only way it is
 * ever called after the first time: the page redraws it at the start of every
 * run, and `App.relocalize` redraws it when the language changes. The old
 * panel is replaced wholesale rather than patched, so there is no state to keep
 * in step and no handler that can be bound twice.
 *
 * Two things do have to survive that replacement, and neither is derivable from
 * the arguments:
 *
 * - Which hints the player had opened, but only while the level stays the same. A
 *   redraw for the same level is the language changing or the run restarting, and
 *   closing the hint somebody is reading in order to tell them the same thing in
 *   another language is the panel undoing the player's own work. A redraw for a
 *   *different* level is the opposite case: the third hint holds the answer, so
 *   carrying it open into the next level would hand out that level's answer before
 *   its goal had been read. The level the markup was drawn for is therefore read
 *   back off it before it is thrown away.
 * - The focus. A redraw destroys whichever hint or button the player was
 *   standing on, and a keyboard player would be dropped back at the top of the
 *   document with the whole page to tab through again (WCAG 2.4.3). The control
 *   that lands in the same position takes the focus back, the same way the level
 *   switcher puts the focus back on the tile it was standing on: the panel's
 *   controls are the same five in the same order for every level -- three hint
 *   summaries, the button that copies the answer, and the explanation's -- so
 *   the position is the control.
 *
 * @param parent - The `.tutorial` element of the page shell.
 * @param data - Which level to draw.
 * @throws {RangeError} When the track has no level at that index.
 * @throws {Error} When it has one, but the catalog has no prose for it.
 */
export function presentTutorial(parent: HTMLElement, data: TutorialPanelData): void {
  const level = tutorialLevels[data.levelIndex];
  // A position on the track, and deliberately not the number in the level's id:
  // it is what `data-level-index` is written from, and that attribute answers
  // "is this the same level I was just drawn for", which is a question about
  // positions in `tutorialLevels`. The prose is looked up by id instead, and the
  // two are different numbers the moment a level is inserted -- see
  // TUTORIAL_LEVEL_MESSAGES.
  const levelNumber = data.levelIndex + 1;
  // Both of these are thrown rather than drawn around, because there is nothing
  // honest to draw: a panel with no level in it would tell the player they are on
  // a level that does not exist. They are two throws rather than one because they
  // are two different mistakes, and an error that names the wrong one sends
  // whoever meets it to the wrong file -- the first is a caller that made an
  // index up, the second is a ninth level added to `tutorialLevels` with no prose
  // written for it. See TUTORIAL_LEVEL_MESSAGES for why only the second can
  // happen at all: the missing-prose direction is the one the compiler cannot
  // catch, because an array's length is not part of its type.
  if (level === undefined) {
    // A RangeError, and worded as `App.startTutorial` words its own, so that the
    // two ways to ask for a level that is not there fail the same way.
    throw new RangeError(`No tutorial level with index ${String(data.levelIndex)}`);
  }
  if (!isLevelId(level.id)) {
    throw new Error(`No panel prose for tutorial level ${level.id}`);
  }
  const messages = TUTORIAL_LEVEL_MESSAGES[level.id];
  const [hint1, hint2, hint3] = messages.hints;

  const drawn = query(PANEL_SELECTOR, parent);
  const sameLevel = drawn?.getAttribute(LEVEL_INDEX_ATTRIBUTE) === String(data.levelIndex);
  const wasOpen = sameLevel
    ? queryAll(DISCLOSURE_SELECTOR, parent).map(
        (disclosure) => disclosure instanceof HTMLDetailsElement && disclosure.open,
      )
    : [];
  const focusedControl = queryAll(CONTROL_SELECTOR, parent).findIndex(
    (control) => control === document.activeElement,
  );
  // Carried across a redraw of the same level, and dropped when the level
  // changes. The redraws are the run starting again and the language changing,
  // and neither of them is news: a copy made moments ago should still say so
  // afterwards. A different level is the one case where it has to go, because a
  // different answer is on the button by then and nothing this line says is
  // still true of it.
  const copiedState = sameLevel
    ? copiedStateOf(query(COPIED_SELECTOR, parent)?.getAttribute(COPIED_STATE_ATTRIBUTE) ?? null)
    : undefined;

  const panel = renderElement(
    tutorialTemplate({
      levelNumber,
      title: t(messages.title),
      goal: t(messages.goal),
      hints: [t(hint1), t(hint2), t(hint3)],
      // Both straight from the level table, and deliberately not from the
      // catalog even though that is where the rest of this level's text now
      // lives: the table is what `tutorial-solutions.test.ts` clears the level
      // with, so the answer on screen and the answer that is known to work are
      // one string read one way. Reading `tutorial.levelN.solutionCode.code`
      // here as well would be a second call site for one message with nothing
      // comparing the two, and the player would be the one told something
      // untrue. The table renders it when it is asked, so this is the answer
      // in the language being drawn. `startingCode` rides along for the same
      // reason: it is never printed, only diffed against `solutionCode` to
      // find the line the answer marks, and a diff has to compare two drafts
      // of the one program the player is actually shown.
      startingCode: level.startingCode,
      solutionCode: level.solutionCode,
      explanation: t(messages.explanation),
    }),
  );

  if (copiedState !== undefined) {
    // Written while the panel is still detached, which is what makes this a
    // restoration rather than a second announcement: a live region that is
    // inserted with its text already in it is generally not read out, and the
    // player heard this sentence when they pressed the button. The click below
    // writes into the region once it is in the document, which is the case where
    // being read out is the whole point.
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

  requireElement(COPY_CODE_SELECTOR, parent).addEventListener("click", () => {
    void copySolution(parent);
  });

  // `findIndex` answers -1 when the focus was somewhere else entirely -- in the
  // editor, say, which is where Ctrl-Enter redraws the page from -- and indexing
  // with -1 gives undefined, so the panel takes the focus only when it was the
  // panel that lost it.
  queryAll(CONTROL_SELECTOR, parent)[focusedControl]?.focus();
}
