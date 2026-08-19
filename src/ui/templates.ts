/**
 * Markup templates for the game view, replacing `riot.render` and the
 * `<script type="text/template">` blocks that used to live in `index.html`.
 *
 * `riot.render` interpolated `{placeholders}` without escaping anything, which
 * is fine for the numbers the game feeds it and decidedly not fine for the
 * next-challenge URL, which is rebuilt from whatever the player put in the
 * location hash. The {@link markup} tag escapes every interpolated value unless
 * it is explicitly wrapped in {@link raw}, and anything that can carry
 * player-authored text — error messages in particular — is written with
 * `textContent` by the presenters rather than templated at all.
 *
 * The tag is deliberately *not* called `html`: Prettier reformats `html`-tagged
 * template literals as embedded HTML, and several of these templates are
 * whitespace sensitive (the in-car floor buttons sit flush against each other,
 * and the floor call buttons are separated by exactly one space).
 *
 * Every word these templates put on screen is asked for with `t` *inside* the
 * function that renders it, never once at module scope. A `const` holding a
 * translated string would be filled in while this module was first imported,
 * which is before anything has had the chance to load a catalogue, so it would
 * be English for the rest of the session however often the player changed
 * language afterwards. The same reasoning is written out at length on
 * {@link "../game/challenges.ts"!ChallengeCondition.description}, which is a
 * getter for exactly this reason; here it costs nothing, because a template
 * function is already called afresh for every render.
 */

import { t } from "../i18n/index.ts";

import { highlightJavaScript } from "./code-highlight.ts";
import { changedLines } from "./line-diff.ts";
import { speedStepperTemplate } from "#features/adjust-speed/index.ts";
import { runButtonsTemplate } from "#features/run-simulation/index.ts";
import { iconMarkup } from "#shared/ui/icon.ts";
import { markup, raw } from "#shared/ui/markup.ts";

/**
 * The accessible name of a floor's "call an elevator going up" button.
 *
 * This and the three below it exist because the building is drawn once per run
 * and has to be *renamed* without being redrawn. Everything else the game puts
 * on screen is rebuilt when the language changes, but `widgets/building-stage`
 * mounts one view per floor, car and passenger and subscribes each to a
 * simulation object, so mounting it a second time would leave two buildings in
 * the page and two handlers on each event — and the only other way to get a
 * fresh one is to throw away the run in progress.
 *
 * So {@link "./presenters.ts"!relabelWorld} rewrites these four names in place.
 * The helpers are what keep it honest: a key spelled out both in a template and
 * in the relabeller is a key that can be changed in one of them, and the
 * building would then be renamed into a message that no longer exists — which
 * `t` answers with the key itself. There is one place per name, and both paths
 * call it.
 *
 * @param level - Floor number.
 * @returns The button's accessible name.
 */
export function floorCallUpLabel(level: number): string {
  return t("game.floor.callUp", { floor: level });
}

/**
 * The accessible name of a floor's "call an elevator going down" button.
 *
 * See {@link floorCallUpLabel} for why this is a function rather than a string
 * inside the template.
 *
 * @param level - Floor number.
 * @returns The button's accessible name.
 */
export function floorCallDownLabel(level: number): string {
  return t("game.floor.callDown", { floor: level });
}

/**
 * The accessible name of one elevator car.
 *
 * See {@link floorCallUpLabel} for why this is a function rather than a string
 * inside the template. The car is numbered from one for the reader while it is
 * indexed from zero in the code, and that conversion lives here so that the
 * relabeller cannot get it wrong on its own.
 *
 * @param index - Zero-based index of the car.
 * @returns The group's accessible name.
 */
export function elevatorLabel(index: number): string {
  return t("game.elevator.label", { number: index + 1 });
}

/**
 * The accessible name of one in-car floor button.
 *
 * See {@link floorCallUpLabel} for why this is a function rather than a string
 * inside the template.
 *
 * @param floorNum - Floor the button requests.
 * @returns The button's accessible name.
 */
export function elevatorFloorButtonLabel(floorNum: number): string {
  return t("game.elevator.floorButton", { floor: floorNum });
}

/**
 * One floor of the building, with its call buttons.
 *
 * The call buttons used to be clickable `<i>` elements, which put them out of
 * reach of the keyboard and made them invisible to screen readers. They are real
 * buttons now; the stylesheet resets them so the pixels are unchanged. The
 * single space between the two buttons is load-bearing — it is the gap the
 * legacy markup had between the two `<i>` elements.
 *
 * @param level - Floor number.
 * @param yPosition - World y of the floor, in pixels.
 * @returns The floor markup.
 */
export function floorTemplate(level: number, yPosition: number): string {
  return markup`<div class="floor" style="top: ${yPosition}px"><span class="floornumber" aria-hidden="true">${level}</span><span class="buttonindicator"><button type="button" class="up" aria-pressed="false" aria-label="${floorCallUpLabel(level)}">${raw(iconMarkup("arrow-circle-up"))}</button> <button type="button" class="down" aria-pressed="false" aria-label="${floorCallDownLabel(level)}">${raw(iconMarkup("arrow-circle-down"))}</button></span></div>`;
}

/**
 * One elevator car.
 *
 * @param width - Car width in pixels, derived from its capacity.
 * @param index - Zero-based index of the car, used for its accessible name.
 * @returns The elevator markup.
 */
export function elevatorTemplate(width: number, index: number): string {
  return markup`<div class="elevator movable" style="width: ${width}px" role="group" aria-label="${elevatorLabel(index)}"><span class="directionindicator directionindicatorup">${raw(iconMarkup("arrow-circle-up", "up activated"))}</span><span class="floorindicator"><span></span></span><span class="directionindicator directionindicatordown">${raw(iconMarkup("arrow-circle-down", "down activated"))}</span><span class="buttonindicator"></span></div>`;
}

/**
 * One in-car floor button.
 *
 * These sit flush against each other inside `.buttonindicator`, so the template
 * must not introduce any surrounding whitespace.
 *
 * @param floorNum - Floor the button requests.
 * @returns The button markup.
 */
export function elevatorButtonTemplate(floorNum: number): string {
  return markup`<button type="button" class="buttonpress" aria-pressed="false" aria-label="${elevatorFloorButtonLabel(floorNum)}">${floorNum}</button>`;
}

/** How a passenger is drawn; mirrors the simulation's `UserDisplayType`. */
export type UserDisplayType = "child" | "female" | "male";

/**
 * A passenger.
 *
 * @param displayType - Which person icon to draw.
 * @param leaving - Whether the passenger has already been delivered.
 * @returns The passenger markup.
 */
export function userTemplate(displayType: UserDisplayType, leaving: boolean): string {
  return iconMarkup(displayType, leaving ? "movable user leaving" : "movable user");
}

/** The seed of the run in progress, and where the line's link goes. */
export interface SeedLinkData {
  /** The seed itself, exactly as it appears in the URL. */
  readonly seed: string;
  /**
   * A hash URL that starts another run from this seed.
   *
   * The whole hash rather than the seed alone, for the reason every navigation
   * entry is: the app builds it with `createParamsUrl`, so the challenge, the
   * speed and anything else the player arrived with ride along. The building has
   * to ride along, since a seed means nothing without one.
   *
   * Given even when the URL already pins this seed, where the line no longer
   * offers it: it is still the run's address, and the console prints it as such
   * at every start.
   */
  readonly url: string;
  /**
   * A hash URL that starts the same challenge with no seed pinned, or `null`
   * when the URL pins none and there is nothing to take out.
   *
   * The pair is exclusive on purpose, and the line renders one link or the
   * other. Offering both would mean offering one that goes where the player
   * already is: with nothing pinned, the URL without a seed is the current one,
   * and with a seed pinned, the URL with it is.
   */
  readonly newDrawUrl: string | null;
}

/**
 * Everything that drives the run in progress, as one row.
 *
 * Drawn into its own region between the learning track's panel and the building
 * rather than into the challenge bar, which is where the start button and the
 * speed used to live. Two reasons, and the first is the one a player notices: a
 * task's panel is a screenful of prose, and with the controls above it the
 * button that starts the run sat at the top of that screenful while the building
 * it starts was at the bottom. The controls belong against the thing they
 * control.
 *
 * The second is that the challenge bar used to be rebuilt on every restart, so
 * every one of these buttons used to destroy itself when pressed — which is
 * what the challenge bar's own focus bookkeeping existed to paper over. This
 * region is drawn once for the life of the page and only relabelled, so a
 * keyboard player who presses Start over is still standing on Start over
 * afterwards, with nothing to restore.
 *
 * Three buttons and a speed, in that order, because the three are what the
 * player came for and the speed is a setting. Reset/undo-reset moved to the
 * editor pane's own codetools (`widgets/editor-pane`), since they act on the
 * code rather than the run. The three are `#features/run-simulation`'s
 * {@link import("#features/run-simulation/index.ts").runButtonsTemplate} —
 * see that module for their own history and design, including why "Run
 * instantly" sits beside Start rather than in a row of its own. The speed is
 * `#features/adjust-speed`'s
 * {@link import("#features/adjust-speed/index.ts").speedStepperTemplate} —
 * see that module for why it is a plain container of real buttons rather than
 * the `<h3>` wrapping two clickable `<i>` elements it used to be, and for its
 * `aria-live` region.
 *
 * @returns The run controls markup.
 */
export function controlsTemplate(): string {
  return runButtonsTemplate() + speedStepperTemplate();
}

/** Everything the learning track's panel needs in order to render itself. */
export interface TutorialTemplateData {
  /** One-based number of the task being played, the way the player is told it. */
  readonly taskNumber: number;
  /** How many tasks the track holds, for the position and progress lines. */
  readonly taskCount: number;
  /** How many of them the player has cleared, for the progress line. */
  readonly clearedCount: number;
  /** The task's name. Text, written escaped. */
  readonly title: string;
  /** What the task asks the player for. Text, written escaped. */
  readonly goal: string;
  /**
   * The three hints, in the order they are offered.
   *
   * Trusted markup: every one of them is a `.html` message of this repository's
   * own catalogue, and several carry `<span class="emphasis-color">` around the
   * identifier being talked about. Nothing a player typed reaches this field.
   *
   * A three-element tuple rather than an array, because "the last one" and "the
   * one the answer goes under" have to be the same hint: {@link tutorialTemplate}
   * prints {@link TutorialTemplateData.solutionCode} beneath the final entry, and
   * a two-hint task would silently print the answer under hint 2.
   */
  readonly hints: readonly [string, string, string];
  /**
   * The program the task starts the player with, exactly as
   * `src/game/tutorial.ts` holds it.
   *
   * Printed nowhere — the panel only ever shows the answer — and read for one
   * thing: {@link "./line-diff.ts"!changedLines} compares it against
   * {@link TutorialTemplateData.solutionCode} to find the line or lines a
   * player actually has to write, which is what the answer marks. A field of
   * its own rather than folding the diff in here, because that keeps this
   * interface a plain record of what the panel is told and leaves the deciding
   * to the function that draws the answer.
   */
  readonly startingCode: string;
  /**
   * The program that clears the task, exactly as `src/game/tutorial.ts` holds it.
   *
   * Handed to {@link "./code-highlight.ts"!highlightJavaScript} rather than
   * interpolated by {@link markup}, which is why it does not appear escaped in
   * the template below the way the task's title and goal do: the highlighter
   * parses it as JavaScript and escapes every character of it itself as it
   * writes each token out, so the two functions have to keep agreeing on the
   * same five characters, and `code-highlight.test.ts` and `templates.test.ts`
   * both pin them. It is the same string `tutorial-solutions.test.ts` proves the
   * task with, which is why it comes from the task table rather than from the
   * catalogue.
   */
  readonly solutionCode: string;
  /**
   * Why the task behaves the way it does, shown after the answer.
   *
   * Trusted markup, for the same reason the hints are: a `.html` message of this
   * repository's own catalogue.
   */
  readonly explanation: string;
}

/** The two programs {@link tutorialAnswerTemplate} needs: what changed, and against what. */
interface TutorialAnswerData {
  /** The program the task starts the player with; see {@link changedLines}. */
  readonly startingCode: string;
  /** The program that clears the task, which is what gets shown and copied. */
  readonly solutionCode: string;
}

/**
 * The answer, under the last hint: the program that clears the task,
 * syntax-highlighted, with the line or lines a player has to write marked, and
 * a button that copies it.
 *
 * The mark is computed rather than written into the hint's own prose, which is
 * what named the changed line before this existed: `changedLines` compares
 * {@link TutorialAnswerData.startingCode} against
 * {@link TutorialAnswerData.solutionCode} — the two strings the task already
 * holds, and the only two a diff could possibly disagree with — so there is no
 * second copy of "line 2 is new" for a task's wording to drift away from.
 * `changedLines` finds lines, not characters, because every task on the track
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
 * their own row, `.tutorialanswertools`, which exists only so that row can be
 * styled apart from `.tutorialbuttons` below: this pair acts on the code
 * beside it, and that pair leaves the task. `.tutorialcopied` is drawn empty
 * and filled in by {@link "#widgets/tutorial-panel/index.ts"!presentTutorial} on the click,
 * for the same reason `.tutorialtaken` is: a live region has to already be in
 * the document when its text arrives, or the announcement generally does not
 * happen.
 *
 * @param answer - The starting program and the one that clears the task.
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
 * single ARIA attribute — on markup {@link "#widgets/tutorial-panel/index.ts"!presentTutorial}
 * rebuilds from scratch every time the language changes.
 *
 * Closed is the only defensible default here, and more so than on the seed line.
 * The hints are ordered from a nudge to the answer, and a task whose answer is
 * on screen before the player has read the goal is not a task. That is also why
 * they are three separate disclosures rather than one holding all three: opening
 * the third is a decision, and a single panel would spend it on the first.
 *
 * @param number - One-based hint number, which is what the summary says.
 * @param hint - The hint itself; trusted markup from the catalogue.
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
 * The learning track's panel: where the player is, what to do, and the way out.
 *
 * Drawn as a `<section>` with a name, which makes it a region landmark: the
 * track puts a block of prose between the challenge bar and the building, and
 * without a landmark a screen-reader player has no way to jump over it to the
 * game or back to it for the next hint. A `<section>` with no name is not a
 * landmark at all, so the name is what the element is for (WCAG 1.3.1: the
 * structure a sighted player can see has to be there in the markup too).
 *
 * The name is `tutorial.panel.label`, and the same message is also the first
 * thing written inside the panel, so the words announced on the way in are the
 * words on the screen. `aria-labelledby` pointing at that line would name the
 * landmark from one string instead of two — but it is one string already, since
 * both come from the same `t()` call, and the id it would need is a second thing
 * that has to stay unique in a page this panel does not own.
 *
 * The order is the order it is read in, and it is the order of a lesson: where
 * you are, what to do, what to try if it will not come, why it happened, and
 * only then the buttons that leave. The progress line is last because it is the
 * one thing here that is about the track rather than about this task.
 *
 * `.tutorialtaken` is drawn empty, directly under the buttons, and filled in by
 * {@link "#widgets/tutorial-panel/index.ts"!presentTutorial} when "Take this program" is
 * pressed — an empty live region waiting for its news, which is what
 * `#save_message` in `index.html` is too, the one the editor writes its "Code
 * saved …" line into. It is here rather than created on the click for the same
 * reason any live region is: it has to be in the document before the text
 * appears inside it, or the announcement is generally not made at all.
 *
 * Empty is what it is drawn as every time, including the redraws — the task
 * changing, the run restarting, the language changing, and the task being
 * cleared, which redraws the panel to move its progress line on. Whether any of
 * those keeps the news is `presentTutorial`'s to decide, and it puts it back
 * before this markup reaches the document; the template has no opinion beyond
 * refusing to be the thing that announces it.
 *
 * Three kinds of string arrive in this template and they are written
 * differently. The task's name and its goal are text and are escaped; the
 * hints and the explanation are `.html` messages of this repository's own
 * catalogue and are inserted verbatim. The answer is the exception that looks
 * like the rule: it comes from `src/game/tutorial.ts` rather than the
 * catalogue, and is neither escaped by `markup` nor inserted verbatim, but
 * parsed and escaped a token at a time by
 * {@link "./code-highlight.ts"!highlightJavaScript} — see the note on
 * {@link TutorialTemplateData.solutionCode}. Nothing here can carry player
 * input — the editor's contents never reach this function, and the one thing
 * that does come from outside the repository, the task index, is used to look
 * up messages rather than printed.
 *
 * @param data - Where the player is on the track, and everything this task says.
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
  // hints across a redraw of the same task and deliberately does not carry them
  // across a change of task, and after `replaceChildren` the old panel is the
  // only place the number it was drawn for still exists.
  return markup`<section class="tutorialpanel" data-task-index="${data.taskNumber - 1}" aria-label="${t("tutorial.panel.label")}"><p class="tutorialposition"><span class="tutorialtrack">${t("tutorial.panel.label")}</span> <span class="tutorialstep">${t("tutorial.panel.position", { number: data.taskNumber, count: data.taskCount })}</span></p><h2 class="tutorialtitle">${data.title}</h2><p class="tutorialgoal">${data.goal}</p>${raw(hints)}<details class="tutorialexplanation"><summary>${t("tutorial.panel.explanationSummary")}</summary><p class="tutorialprose">${raw(data.explanation)}</p></details><div class="tutorialbuttons"><button type="button" class="tutorialtakecode">${t("tutorial.button.takeCode")}</button><button type="button" class="tutorialleave">${t("tutorial.button.leave")}</button></div><p class="tutorialtaken" aria-live="polite"></p><p class="tutorialprogress">${t("tutorial.panel.progress", { cleared: data.clearedCount, count: data.taskCount })}</p></section>`;
}
