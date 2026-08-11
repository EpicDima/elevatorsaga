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
 */

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
  const where = `floor ${String(level)}`;
  return markup`<div class="floor" style="top: ${yPosition}px"><span class="floornumber" aria-hidden="true">${level}</span><span class="buttonindicator"><button type="button" class="up" aria-pressed="false" aria-label="Call an elevator going up from ${where}">${raw(iconMarkup("arrow-circle-up"))}</button> <button type="button" class="down" aria-pressed="false" aria-label="Call an elevator going down from ${where}">${raw(iconMarkup("arrow-circle-down"))}</button></span></div>`;
}

/**
 * One elevator car.
 *
 * @param width - Car width in pixels, derived from its capacity.
 * @param index - Zero-based index of the car, used for its accessible name.
 * @returns The elevator markup.
 */
export function elevatorTemplate(width: number, index: number): string {
  return markup`<div class="elevator movable" style="width: ${width}px" role="group" aria-label="Elevator ${index + 1}"><span class="directionindicator directionindicatorup">${raw(iconMarkup("arrow-circle-up", "up activated"))}</span><span class="floorindicator"><span></span></span><span class="directionindicator directionindicatordown">${raw(iconMarkup("arrow-circle-down", "down activated"))}</span><span class="buttonindicator"></span></div>`;
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
  return markup`<button type="button" class="buttonpress" aria-pressed="false" aria-label="Go to floor ${floorNum}">${floorNum}</button>`;
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
  const label = link.demo ? "Demo" : String(link.num);
  const name = link.demo ? "Demo" : `Challenge ${String(link.num)}`;
  const current = link.current ? raw(` aria-current="page"`) : raw("");
  return markup`<li><a class="challengelink" href="${link.url}" aria-label="${name}"${current}>${label}</a></li>`;
}

/** The seed of the run in progress, and where a link back to it goes. */
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
   */
  readonly url: string;
}

/**
 * What the seed line says about what a seed does and does not fix.
 *
 * Both halves are load-bearing, and each was measured rather than assumed.
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
 */
const SEED_EXPLANATION =
  "The same seed brings the same passengers, in the same order. Frame timing comes from the " +
  "browser, so the run around them is never quite the same twice.";

/**
 * The seed of the run in progress, as a link that starts it again.
 *
 * A real link, like the navigation row and for the same reasons: the browser's
 * own affordances are the feature here — "copy link address" is how a player
 * hands the building to somebody else, and the status bar shows where it goes
 * without anything having to be clicked. Following it pins the seed in the
 * address bar, which restarts the run from that seed; a player who is already on
 * a pinned seed is already at that URL, and following it does nothing, which is
 * the honest answer.
 *
 * The visible text is the bare seed, because that is the token that gets
 * transcribed, and it is contained in the accessible name (WCAG 2.5.3) — which
 * has to say more, since "1234567890, link" describes nothing. What the name
 * does not do is promise the run back: it says another run from this seed, and
 * {@link SEED_EXPLANATION} says how far that goes.
 *
 * @param data - The seed and the URL that starts another run from it.
 * @returns The seed line's markup.
 */
function seedTemplate(data: SeedLinkData): string {
  const name = `Seed ${data.seed}: start another run from this seed`;
  return markup`<p class="challengeseed"><span class="seedlabel" title="${SEED_EXPLANATION}">Seed</span> <a class="seedlink" href="${data.url}" aria-label="${name}">${data.seed}</a></p>`;
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
 * The navigation row comes last, so the three controls that were already there
 * keep the tab positions they have always had. It is a `<nav>` around a list:
 * the landmark gives it a name and a way to be jumped to, and the list tells a
 * screen reader up front how many challenges there are — the one thing the row
 * is for. Real links rather than buttons, so the browser's own affordances
 * (open in a new tab, copy the address, the status bar) all work; navigation is
 * the hash change the router already listens for, so nothing has to be wired to
 * them at all.
 *
 * The seed shares that second line rather than taking a third: it is a debugging
 * aid, and the bar sits directly above the building, where every pixel it grows
 * pushes the game down the page. It stays outside the `<nav>` — it is not a
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
  return markup`<div class="left"><h2 class="challengetitle">Challenge #${data.num}: ${raw(data.description)}</h2></div><button type="button" class="right startstop unselectable"></button><div class="right timescale"><button type="button" class="timescale_decrease unselectable" aria-label="Decrease simulation speed">${raw(iconMarkup("minus-square"))}</button> <span class="emphasis-color timescale_value"></span> <button type="button" class="timescale_increase unselectable" aria-label="Increase simulation speed">${raw(iconMarkup("plus-square"))}</button></div><div class="challengefooter"><nav class="challengenav" aria-label="Challenges"><ul>${raw(links)}</ul></nav>${raw(seed)}</div>`;
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
      : markup`<a href="${data.url}" class="emphasis-color">Next challenge ${raw(iconMarkup("caret-right", "blink"))}</a>`;
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
  return markup`<p class="error">${raw(iconMarkup("warning", "error-color"))} There is a problem with your code: <span class="errormessage"></span></p>`;
}
