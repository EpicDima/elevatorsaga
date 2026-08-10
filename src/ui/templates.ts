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
}

/**
 * The challenge bar: requirement text, time-scale controls and start button.
 *
 * The time-scale controls used to be a `<h3>` wrapping two clickable `<i>`
 * elements. They are a plain container with real buttons now; `.timescale`
 * carries the heading's former metrics so the bar looks the same.
 *
 * @param data - The challenge number and requirement.
 * @returns The challenge bar markup.
 */
export function challengeTemplate(data: ChallengeTemplateData): string {
  return markup`<div class="left"><h2 class="challengetitle">Challenge #${data.num}: ${raw(data.description)}</h2></div><button type="button" class="right startstop unselectable"></button><div class="right timescale"><button type="button" class="timescale_decrease unselectable" aria-label="Decrease simulation speed">${raw(iconMarkup("minus-square"))}</button> <span class="emphasis-color timescale_value"></span> <button type="button" class="timescale_increase unselectable" aria-label="Increase simulation speed">${raw(iconMarkup("plus-square"))}</button></div>`;
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
 * @param data - Headline, message and next-challenge link.
 * @returns The overlay markup.
 */
export function feedbackTemplate(data: FeedbackTemplateData): string {
  const link =
    data.url === ""
      ? ""
      : markup`<a href="${data.url}" class="emphasis-color">Next challenge ${raw(iconMarkup("caret-right", "blink"))}</a>`;
  return markup`<div class="feedback" role="status"><h2 class="emphasis-color">${data.title}</h2><p class="emphasis-color">${data.message}</p>${raw(link)}</div>`;
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
