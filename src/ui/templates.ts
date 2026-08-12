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
import { iconMarkup } from "./icons.ts";

/** Markup that is inserted as-is, without escaping. */
export class RawHtml {
  /** The trusted markup. */
  readonly value: string;

  /**
   * @param value - Trusted markup, never derived from player input.
   */
  constructor(value: string) {
    this.value = value;
  }
}

/**
 * Marks a string as trusted markup for {@link markup}.
 *
 * @param value - Trusted markup, never derived from player input.
 * @returns A wrapper {@link markup} inserts verbatim.
 */
export function raw(value: string): RawHtml {
  return new RawHtml(value);
}

/** Characters that must not survive interpolation into markup. */
const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escapes a string for use in element content or a quoted attribute value.
 *
 * @param value - Text to escape.
 * @returns The escaped text.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/**
 * Tagged template that escapes every interpolated value.
 *
 * Values wrapped in {@link raw} are inserted verbatim; everything else is
 * stringified and escaped.
 *
 * @param strings - The literal parts of the template.
 * @param values - The interpolated values.
 * @returns The assembled markup.
 */
export function markup(strings: TemplateStringsArray, ...values: readonly unknown[]): string {
  let result = strings[0] ?? "";
  for (const [index, value] of values.entries()) {
    result += value instanceof RawHtml ? value.value : escapeHtml(String(value));
    result += strings[index + 1] ?? "";
  }
  return result;
}

/**
 * Parses markup into a detached fragment.
 *
 * Uses a `<template>` element, so the markup is parsed but nothing in it runs
 * or loads.
 *
 * @param source - Markup to parse.
 * @returns The parsed nodes.
 */
export function renderFragment(source: string): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = source;
  return template.content;
}

/**
 * Parses markup that describes exactly one element.
 *
 * @param source - Markup to parse.
 * @returns The single parsed element.
 * @throws {Error} When the markup does not describe exactly one element.
 */
export function renderElement(source: string): HTMLElement {
  const [element, ...rest] = renderFragment(source).children;
  if (!(element instanceof HTMLElement) || rest.length > 0) {
    throw new Error("Expected markup describing exactly one element");
  }
  return element;
}

/**
 * The accessible name of a floor's "call an elevator going up" button.
 *
 * This and the three below it exist because the building is drawn once per run
 * and has to be *renamed* without being redrawn. Everything else the game puts
 * on screen is rebuilt when the language changes, but
 * {@link "./presenters.ts"!presentWorld} appends an element and subscribes to a
 * simulation object for every floor, every car and every passenger, so calling
 * it a second time would leave two buildings in the page and two handlers on
 * each event — and the only other way to get a fresh one is to throw away the
 * run in progress.
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

/** One entry of the challenge bar's navigation row. */
export interface ChallengeLinkData {
  /** One-based challenge number, exactly as it appears in the URL. */
  readonly num: number;
  /**
   * Where the entry goes.
   *
   * A whole hash URL rather than a challenge number, because it has to carry
   * the rest of the parameters with it; the app builds it with
   * `createParamsUrl`.
   */
  readonly url: string;
  /** Whether this is the challenge being played. */
  readonly current: boolean;
  /** Whether this entry is the endless demo rather than a numbered challenge. */
  readonly demo: boolean;
}

/**
 * One entry of the challenge navigation row.
 *
 * The visible label is the bare number: nineteen of these have to fit across a
 * phone. The accessible name is not, because "7" on its own says nothing about
 * where the link goes, and a screen reader reading the row out would produce
 * nineteen unrelated digits. The visible text is contained in the accessible
 * name, which is what WCAG 2.5.3 asks of a control whose two names differ — and
 * what lets speech input reach it by the label on screen.
 *
 * `aria-current` marks the entry being played for assistive technology; the
 * stylesheet marks the same entry for everyone else off the same attribute, so
 * the two cannot drift apart. `page` is the value rather than `true` because
 * each entry is a real link to a real URL, and following one replaces what the
 * page is showing.
 *
 * @param link - Where the entry goes, and whether it is the current one.
 * @returns The list-item markup.
 */
function challengeLinkTemplate(link: ChallengeLinkData): string {
  const label = link.demo ? t("game.challenge.nav.demo") : String(link.num);
  const name = link.demo
    ? t("game.challenge.nav.demo")
    : t("game.challenge.nav.link", { number: link.num });
  const current = link.current ? raw(` aria-current="page"`) : raw("");
  return markup`<li><a class="challengelink" href="${link.url}" aria-label="${name}"${current}>${label}</a></li>`;
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
 * The seed of the run in progress, and the one thing worth doing about it.
 *
 * A real link, like the navigation row and for the same reasons: the browser's
 * own affordances are the feature here — "copy link address" is how a player
 * hands the building to somebody else, and the status bar shows where it goes
 * without anything having to be clicked.
 *
 * Which link it is depends on where the run came from, because a URL can only be
 * in one of two states and each has exactly one useful move out of it:
 *
 * - Nothing pinned. The seed itself is the link, and following it writes the
 *   seed into the address, so restarting brings these passengers back.
 * - Pinned. Following that link again would go where the player already is, so
 *   the seed is plain text and the link beside it is `new draw`, which takes the
 *   seed back out of the address. Without it, one click into a pinned run is a
 *   one-way door: the Restart button, Ctrl-Enter and a reload all keep the pin,
 *   and the address bar is the only way back out — which is the state
 *   {@link "../app/app.ts"!App.handleRoute} explains at length that this game
 *   refuses to create. The navigation row is not that way out either: it drops
 *   the seed, but it has no entry for the sandbox, and "press the challenge you
 *   are already on" is not a move any interface can expect to be found.
 *
 * Keeping the seed a link in both states was the alternative, and it was
 * rejected because the honest name for it would have been "go where you already
 * are": it fires no `hashchange`, so nothing at all happens, while its name
 * promises another run. The seed stays selectable text either way, and a pinned
 * run's address bar already holds the URL that "copy link address" would.
 *
 * The visible text is the bare seed, because that is the token that gets
 * transcribed, and it is contained in the accessible name (WCAG 2.5.3) — which
 * has to say more, since "1234567890, link" describes nothing. What the name
 * does not do is promise the run back: it says another run from this seed, and
 * {@link seedHelpTemplate} carries the caveat, which says how far that goes. The
 * same rule holds the other way round: `new draw` is two words on screen and two
 * words inside the name, in whatever language the pair is read in.
 *
 * A `<div>` rather than the `<p>` this used to be, and not as a matter of taste:
 * `<details>` is one of the tags the HTML parser closes an open `<p>` on, so the
 * disclosure would be parsed out of the line and left as a sibling of it — the
 * bar is written into the document with `innerHTML`, which is the real parser.
 *
 * @param data - The seed, the URL that starts another run from it, and the URL
 * that stops pinning it.
 * @returns The seed line's markup.
 */
function seedTemplate(data: SeedLinkData): string {
  const action =
    data.newDrawUrl === null
      ? markup`<a class="seedlink" href="${data.url}" aria-label="${t("game.seed.link", { seed: data.seed })}">${data.seed}</a>`
      : markup`<span class="seedvalue">${data.seed}</span> <a class="seednewdraw" href="${data.newDrawUrl}" aria-label="${t("game.seed.newDrawLink", { seed: data.seed })}">${t("game.seed.newDraw")}</a>`;
  return markup`<div class="challengeseed"><span class="seedlabel">${t("game.seed.label")}</span> ${raw(action)} ${raw(seedHelpTemplate())}</div>`;
}

/**
 * What a seed does and does not fix, as something a player can actually open.
 *
 * The words are `game.seed.explanation` in the message catalogue, and both
 * halves of them are load-bearing; each was measured rather than assumed, so a
 * translation that drops one is dropping a finding.
 *
 * The passengers really do come back, and that is neither free nor old. Until
 * `e2cc0b5` the re-press offset in `src/game/world.ts` and the walk-off duration
 * in `src/game/user.ts` drew from the stream the passengers came from, at
 * moments the simulation's own dynamics decided — so a frame a microsecond
 * longer reordered the draws and everyone after that point was somebody else.
 * Those two have streams of their own now, and one seed brings one cast of
 * characters however the frames fall. That is what makes the affordance worth
 * having: comparing two programs means comparing them on the same people.
 *
 * The run does not come back. `dt` comes from `requestAnimationFrame` timestamps
 * in `src/game/world-controller.ts`, so the cars are in different places as each
 * passenger appears, the player's program is asked to decide at different
 * moments, and the outcome moves with them. Only the headless paths — the
 * fitness suite and the tests, which drive the clock themselves — repeat a run
 * step for step. "Replay this run" is the natural thing to write here and would
 * be a promise the browser cannot keep, so it is not made.
 *
 * It used to be a `title` attribute on the word "Seed", which delivered it to a
 * mouse and to nothing else: `title` never appears on a touch screen, a `<span>`
 * cannot be focused so a keyboard cannot reach it either, and screen readers
 * announce `title` on a non-interactive element inconsistently at best — several
 * ignore it outright, and the ones that read it need the pointer to be resting
 * on the word. The caveat is the sentence that keeps the rest of the line
 * honest, and it was the least reachable string in the feature.
 *
 * A native `<details>` instead, because the disclosure this needs is exactly the
 * one the browser already implements: the `<summary>` is focusable and in the
 * tab order with no `tabindex`, Enter and Space open it, and it is announced as
 * a disclosure with its expanded state without a single ARIA attribute — where a
 * hand-rolled `aria-expanded` button would be four lines of wiring in
 * {@link "./presenters.ts"!presentChallenge} for the same result, on markup that
 * is rebuilt from scratch on every run.
 *
 * Closed by default, and the summary sits on the seed's own line while it is:
 * the bar stands directly above the building, so a line it always spends is a
 * line the game is pushed down by, and a player who has read the caveat once
 * does not need it in front of them for the rest of the evening.
 *
 * Alternatives that were rejected:
 *
 * - Printing the sentence into the bar unconditionally. It is a paragraph of
 *   prose in a control strip, and at 320px it is three lines of it.
 * - Keeping the `title` alongside the disclosure. The same words would then be
 *   announced from two places, and a tooltip that only some players ever see is
 *   what made this defect hard to notice in the first place.
 * - A `title` on the `<summary>`, which is focusable. Firefox and Chrome do not
 *   show a tooltip for keyboard focus, only for hover, so it would have fixed
 *   nothing for the players it is missing.
 *
 * @returns The disclosure's markup.
 */
function seedHelpTemplate(): string {
  return markup`<details class="seedhelp"><summary>${t("game.seed.helpSummary")}</summary><p class="seedcaveat">${t("game.seed.explanation")}</p></details>`;
}

/** Everything the challenge bar needs in order to render itself. */
export interface ChallengeTemplateData {
  /** One-based challenge number. */
  readonly num: number;
  /**
   * The challenge requirement.
   *
   * Contains markup (`<span class='emphasis-color'>…</span>`) built in
   * `src/game/challenges.ts`, i.e. in this repository's own source and never
   * from player input, so it is inserted verbatim.
   */
  readonly description: string;
  /** Every challenge, in order, for the navigation row. */
  readonly links: readonly ChallengeLinkData[];
  /**
   * The seed of the run in progress, or `null` to leave the line out.
   *
   * `null` only happens when the world was handed a ready-made random stream
   * instead of a seed, which in practice means a test: there is then no seed to
   * offer and nothing that could be linked to.
   */
  readonly seed: SeedLinkData | null;
}

/**
 * The challenge bar: requirement text, time-scale controls, start button and a
 * link to every challenge.
 *
 * The time-scale controls used to be a `<h3>` wrapping two clickable `<i>`
 * elements. They are a plain container with real buttons now; `.timescale`
 * carries the heading's former metrics so the bar looks the same.
 *
 * Everything here is in the order it is read in: the requirement, the speed, the
 * start button, then the row of challenges and the seed. That is not decoration.
 * The bar used to be floats — `float: right` lays the *first* element out
 * furthest right — so the start button was written before the speed controls and
 * drawn after them, and Tab walked the bar backwards against the screen (WCAG
 * 2.4.3). The stylesheet lays this out with flex in document order and has no
 * `order` or `row-reverse` in it, so the two orders cannot come apart again.
 *
 * The speed and the start button share a container because they are what drives
 * the run in progress, and because the bar becomes two lines somewhere around
 * 600px: without it the start button falls under the speed on its own and the
 * pair reads as two unrelated things at exactly the width where the reader has
 * the least room to work out that they are not.
 *
 * The navigation row is a `<nav>` around a list: the landmark gives it a name
 * and a way to be jumped to, and the list tells a screen reader up front how many
 * challenges there are — the one thing the row is for. Real links rather than
 * buttons, so the browser's own affordances (open in a new tab, copy the address,
 * the status bar) all work; navigation is the hash change the router already
 * listens for, so nothing has to be wired to them at all.
 *
 * The seed takes a line of its own below that row. Letting it ride up beside the
 * links wherever it fitted is the cheaper layout, and the bar has every reason
 * to want the cheaper one: the building's top edge is the bar's bottom edge, so
 * every pixel the bar grows pushes the game down the page, and the seed is only
 * a debugging aid. It was traded away because the line carries a disclosure. A
 * line that shares a row is as wide as whatever is left over, so opening the
 * disclosure widened it past what was left, dropped it under the links, and
 * carried the summary the player had just clicked out from under the pointer
 * that clicked it. A line of its own has no room left to lose, so the summary
 * now stays where it was opened at every width the panel fits beside it; the
 * height is what that cost. The seed stays outside the `<nav>` — it is not a
 * challenge, and counting it among them would make the landmark lie about how
 * many there are.
 *
 * @param data - The challenge number, the requirement, the whole challenge list
 * and the seed of the run in progress.
 * @returns The challenge bar markup.
 */
export function challengeTemplate(data: ChallengeTemplateData): string {
  const links = data.links.map((link) => challengeLinkTemplate(link)).join("");
  const seed = data.seed === null ? "" : seedTemplate(data.seed);
  // The title is one message rather than a sentence assembled here, because the
  // requirement is inside it: Russian writes «Задание №3: ...», and a language
  // that wanted the number after the requirement would have nowhere to put it if
  // the order were fixed by this template. Both halves are trusted markup — the
  // catalogue is this repository's own text, and the description comes from
  // `src/game/challenges.ts` — so the assembled title goes in raw.
  const title = t("game.challenge.title.html", { number: data.num, description: data.description });
  return markup`<h2 class="challengetitle">${raw(title)}</h2><div class="challengecontrols"><div class="timescale"><button type="button" class="timescale_decrease unselectable" aria-label="${t("game.timeScale.decrease")}">${raw(iconMarkup("minus-square"))}</button> <span class="emphasis-color timescale_value"></span> <button type="button" class="timescale_increase unselectable" aria-label="${t("game.timeScale.increase")}">${raw(iconMarkup("plus-square"))}</button></div><button type="button" class="startstop unselectable"></button></div><div class="challengefooter"><nav class="challengenav" aria-label="${t("game.challenge.nav.label")}"><ul>${raw(links)}</ul></nav>${raw(seed)}</div>`;
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
   * The program that clears the task, exactly as `src/game/tutorial.ts` holds it.
   *
   * Written escaped, unlike everything else that comes out of a `.html` message,
   * because this is JavaScript and the HTML parser has opinions about two of its
   * characters. Nothing on the track is changed by the escaping today, and that
   * was checked rather than assumed: across the eight answers there is exactly
   * one `<`, in task 7's `elevator.loadFactor() < best.loadFactor()` — which
   * task 8 shows again — and it is followed by a space, which the parser leaves
   * as text. There is no `&` in any of them. The escaping is what
   * keeps that a fact about today's eight answers instead of a condition on
   * every answer written after them — `<` before a letter opens a tag and takes
   * the rest of the line into it, and `&` before a word and a semicolon becomes
   * whatever entity it spells. It is the same string
   * `tutorial-solutions.test.ts` proves the task with, which is why it comes from
   * the task table rather than from the catalogue.
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

/**
 * One hint, as something the player has to decide to open.
 *
 * A native `<details>`, for the reasons written out at {@link seedHelpTemplate}:
 * the `<summary>` is in the tab order without a `tabindex`, Enter and Space work
 * on it, and it is announced as a disclosure with its expanded state without a
 * single ARIA attribute — on markup {@link "./tutorial-panel.ts"!presentTutorial}
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
 * @param solution - The program that clears the task, printed under the hint, or
 * `null` for a hint that is not the last one.
 * @returns The disclosure's markup.
 */
function tutorialHintTemplate(number: number, hint: string, solution: string | null): string {
  // `<pre><code>` rather than a styled `<div>`: it is the pair the help page
  // already prints its examples in, so the block picks up the editor's own
  // colours and the wrapping the narrow-screen rules give code, and a screen
  // reader is told this is code rather than a run-on sentence of punctuation.
  const answer =
    solution === null ? "" : markup`<pre class="tutorialsolution"><code>${solution}</code></pre>`;
  return markup`<details class="tutorialhint"><summary>${t("tutorial.panel.hintSummary", { number })}</summary><p class="tutorialprose">${raw(hint)}</p>${raw(answer)}</details>`;
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
 * Two kinds of string arrive in this template and they are written differently.
 * The task's name and its goal are text and are escaped; the hints and the
 * explanation are `.html` messages of this repository's own catalogue and are
 * inserted verbatim. The answer is the exception that looks like the rule: it
 * comes from `src/game/tutorial.ts` rather than the catalogue and is escaped,
 * because it is JavaScript. Nothing here can carry player input — the editor's
 * contents never reach this function, and the one thing that does come from
 * outside the repository, the task index, is used to look up messages rather
 * than printed.
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
        index === data.hints.length - 1 ? data.solutionCode : null,
      ),
    )
    .join("");
  // The index is written into the markup because it is the one piece of state
  // the panel has to remember about itself: presentTutorial carries the open
  // hints across a redraw of the same task and deliberately does not carry them
  // across a change of task, and after `replaceChildren` the old panel is the
  // only place the number it was drawn for still exists.
  return markup`<section class="tutorialpanel" data-task-index="${data.taskNumber - 1}" aria-label="${t("tutorial.panel.label")}"><p class="tutorialposition"><span class="tutorialtrack">${t("tutorial.panel.label")}</span> <span class="tutorialstep">${t("tutorial.panel.position", { number: data.taskNumber, count: data.taskCount })}</span></p><h2 class="tutorialtitle">${data.title}</h2><p class="tutorialgoal">${data.goal}</p>${raw(hints)}<details class="tutorialexplanation"><summary>${t("tutorial.panel.explanationSummary")}</summary><p class="tutorialprose">${raw(data.explanation)}</p></details><div class="tutorialbuttons"><button type="button" class="tutorialrestart">${t("tutorial.button.restart")}</button><button type="button" class="tutorialtakecode">${t("tutorial.button.takeCode")}</button><button type="button" class="tutorialleave">${t("tutorial.button.leave")}</button></div><p class="tutorialprogress">${t("tutorial.panel.progress", { cleared: data.clearedCount, count: data.taskCount })}</p></section>`;
}

/** Everything the end-of-challenge overlay needs in order to render itself. */
export interface FeedbackTemplateData {
  /** Headline, e.g. `"Success!"`. */
  readonly title: string;
  /** Explanatory line under the headline. */
  readonly message: string;
  /** Link to the next challenge, or `""` for no link. */
  readonly url: string;
}

/**
 * The overlay shown when a challenge is won or lost.
 *
 * The live region is the enclosing `.feedbackcontainer` in `index.html`, not
 * this overlay. A live region has to be in the document *before* the text
 * appears inside it for the announcement to be made: a screen reader that only
 * meets `role="status"` at the moment the element is inserted, already
 * populated, generally says nothing at all.
 *
 * @param data - Headline, message and next-challenge link.
 * @returns The overlay markup.
 */
export function feedbackTemplate(data: FeedbackTemplateData): string {
  const link =
    data.url === ""
      ? ""
      : markup`<a href="${data.url}" class="emphasis-color">${t("game.feedback.next")} ${raw(iconMarkup("caret-right", "blink"))}</a>`;
  return markup`<div class="feedback"><h2 class="emphasis-color">${data.title}</h2><p class="emphasis-color">${data.message}</p>${raw(link)}</div>`;
}

/**
 * The "there is a problem with your code" banner.
 *
 * The message itself is not templated: it is whatever the player's exception
 * stringifies to, so the presenter assigns it with `textContent`.
 *
 * @returns The banner markup, with an empty message slot.
 */
export function codeStatusTemplate(): string {
  return markup`<p class="error">${raw(iconMarkup("warning", "error-color"))} ${t("game.codeStatus")} <span class="errormessage"></span></p>`;
}
