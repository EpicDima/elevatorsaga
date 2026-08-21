/**
 * The settings popover's seed block: a `.setblock` captioned "Seed", as a
 * template and a presenter — the shape its `features/switch-theme` and
 * `features/switch-layout` siblings have.
 *
 * ## The row
 *
 * An editable field holding the seed the run is playing, a dice button that
 * draws another, and a copy-link button, with a `<details>` hint under the
 * three.
 *
 * What the field accepts is `#shared/lib/seed.ts`'s rule, not one of its own:
 * `maxlength` and `pattern` come from the same two constants the router
 * validates `#seed=` with, so the field cannot accept a seed the address bar
 * is about to refuse. Committing is a `change` — Enter, or leaving a field
 * that was edited — which is what the language `<select>` two blocks up
 * already means by "chosen", and there is no separate confirm button for the
 * same reason that one has none.
 *
 * The two buttons are different elements because they do different things.
 * `.seedlink` puts this run in the address bar — a link to this exact run, so
 * an `<a>`, with the `copy` glyph. `.seednewdraw` throws this draw away and
 * takes another, drawing it with
 * {@link "#game/random.ts"!generateRandomSeed}, the same call the world makes
 * when nobody supplies a seed; that is a decision with nowhere to point, so it
 * is a `<button>`, with the `dice` glyph. Both are shown at once: they name two
 * things to do, not two states of one run.
 *
 * Icon-only, so each carries its accessible name twice — on `aria-label` for a
 * screen reader, on `title` for a pointer that has stopped over an unfamiliar
 * glyph — and both names name the seed as well as the gesture. WCAG 2.5.3 has
 * nothing to hold them to: it constrains an accessible name against *visible*
 * text, and neither button has any.
 *
 * ## The hint
 *
 * A `<details>`, because what it hides is a paragraph about what a seed
 * promises and how long it stays yours, which is more than a panel wants open
 * under every run. Only its `<summary>` is dressed as a hint line —
 * `class="sethint"`, with `seed-panel.css` taking the disclosure triangle off
 * it — so it carries instead the chevron the rest of the app spells "this
 * opens" with: `spriteIconMarkup("right", "chev")`, the same call
 * `widgets/stats-panel`'s "All figures" shelf and the Hotkeys row below both
 * make. Without one the line would read as inert and behave as a control, with
 * nothing on screen saying there is a paragraph behind it. The words sit in a
 * `<span>` to make room for it, and `seed-panel.css` turns it a quarter-turn on
 * open exactly as that shelf's does.
 *
 * ## Names and rebuilds
 *
 * The class names (`seedlink`, `seedvalue`, `seednewdraw`, `seedhelp`,
 * `seedcaveat`) are what `seed-panel.css` states this block through, and what
 * `AppBarSettingsController.setSeed` finds a control by after a rebuild.
 *
 * That controller rebuilds this block, but only when a run's seed actually
 * changes — a navigation the player asked for, most often from this very row,
 * rather than a redraw arriving under a pointer that was busy with something
 * else. Focus is the one thing that rebuild carries across, and
 * it is carried in that method rather than here: this block's controls are the
 * ones a player is most likely to be holding when a run changes, because they
 * are what changed it.
 */

import { generateRandomSeed } from "#game/random.ts";
import { t } from "#i18n/index.ts";
import { isUsableSeed, SEED_INPUT_PATTERN, SEED_MAX_LENGTH } from "#shared/lib/seed.ts";
import type { SeedLinkData } from "../../../ui/templates.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw } from "#shared/ui/markup.ts";

/**
 * The seed block's help disclosure: what a seed promises, openable without a
 * mouse.
 *
 * @returns The disclosure's markup.
 */
function seedHelpTemplate(): string {
  return markup`<details class="seedhelp"><summary class="sethint">${raw(spriteIconMarkup("right", "chev"))}<span>${t("game.seed.helpSummary")}</span></summary><p class="seedcaveat">${t("game.seed.explanation")}</p></details>`;
}

/**
 * The row's field: the seed the run is playing, and where another one is typed.
 *
 * `maxlength` and `pattern` are `#shared/lib/seed.ts`'s own, so that what this
 * accepts and what `#seed=` accepts cannot drift apart — the field would
 * otherwise take a seed the router refuses on arrival, and the player would
 * watch their run reload into somebody else's passengers. `required` is what
 * makes an emptied field invalid rather than a seed of no characters.
 *
 * The four "leave this alone" attributes -- `spellcheck`, `autocomplete`,
 * `autocapitalize`, `autocorrect` -- because a seed is an opaque token: a phone
 * that capitalizes it, a browser that corrects it or a password manager that
 * fills it has each turned it into a different run.
 *
 * @param seed - The seed the run on screen is playing.
 * @returns The field's markup.
 */
function seedFieldTemplate(seed: string): string {
  return markup`<input type="text" class="val seedvalue" value="${seed}" maxlength="${SEED_MAX_LENGTH}" pattern="${SEED_INPUT_PATTERN}" required spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" aria-label="${t("game.seed.inputLabel")}">`;
}

/**
 * The row's link button: the address of this exact run.
 *
 * `.ghost` is the chrome `shared/ui/button.css` gives every low-emphasis
 * control, narrowed to the row's 30x30 square by its own `.seedrow .ghost`;
 * `name` is written twice, once for a screen reader and once for a pointer,
 * because the glyph is the whole of what is on screen.
 *
 * The two are different elements for the reason they do different things: one
 * goes to an address, and an address is a link; the other decides a value here
 * and now, and has nowhere to point.
 *
 * @param href - Where pressing it takes the player.
 * @param name - Its accessible name, already naming the seed.
 * @returns The link's markup.
 */
function seedLinkTemplate(href: string, name: string): string {
  return markup`<a class="ghost seedlink" href="${href}" title="${name}" aria-label="${name}">${raw(spriteIconMarkup("copy"))}</a>`;
}

/**
 * The row's other button: a fresh draw, which is a decision rather than a
 * destination — see {@link seedLinkTemplate}.
 *
 * @param name - Its accessible name, already naming the seed.
 * @returns The button's markup.
 */
function seedNewDrawTemplate(name: string): string {
  return markup`<button type="button" class="ghost seednewdraw" title="${name}" aria-label="${name}">${raw(spriteIconMarkup("dice"))}</button>`;
}

/**
 * The settings popover's seed block, or nothing at all.
 *
 * `data` is `null` under exactly the conditions `src/pages/game/index.ts`'s
 * `#seedLink` returns `null` for: a learning-track level, which has no
 * pass/fail run to name a seed for, or (test-only) a world built with a
 * ready-made random stream instead of a seed. Rendering nothing then, rather
 * than a block with nothing useful in it, is the same choice
 * `levelTemplate` already makes for the level bar's own seed line.
 *
 * @param data - The seed of the run in progress and where its address is, or
 * `null` to render nothing.
 * @returns The block's markup, or the empty string.
 */
export function seedPanelTemplate(data: SeedLinkData | null): string {
  if (data === null) {
    return "";
  }
  const field = seedFieldTemplate(data.seed);
  const newDraw = seedNewDrawTemplate(t("game.seed.newDrawLink", { seed: data.seed }));
  const link = seedLinkTemplate(data.url, t("game.seed.link", { seed: data.seed }));
  return markup`<div class="setblock"><span class="cap">${t("game.seed.label")}</span><div class="seedrow">${raw(field)}${raw(newDraw)}${raw(link)}</div>${raw(seedHelpTemplate())}</div>`;
}

/** What {@link presentSeedPanel} needs in order to act on the row's two decisions. */
export interface SeedPanelOptions {
  /**
   * Called with a seed the player has chosen — typed into the field, or drawn
   * by the dice — already known to be one the address bar can carry.
   *
   * Not called with the seed already on screen: a `change` event only fires
   * for a value that changed, and a caller that navigates would be navigating
   * to where the player already is.
   */
  readonly onSeed: (seed: string) => void;
}

/**
 * Wires the row's field and its dice button.
 *
 * Both listeners are delegated from `block` — the stable
 * `[data-set-block="seed"]` wrapper `appBarSettingsTemplate` draws — rather
 * than attached to the controls themselves, because
 * `AppBarSettingsController.setSeed` replaces everything inside that wrapper
 * on every run whose seed differs from the last. Handlers on the controls
 * would go with the first rebuild, which is to say with the first seed the
 * player chose.
 *
 * @param block - The wrapper {@link seedPanelTemplate}'s markup is written into.
 * @param options - What to do with a seed the player chooses.
 */
export function presentSeedPanel(block: HTMLElement, options: SeedPanelOptions): void {
  /** The row's field, if that is what an event came from. */
  const fieldOf = (target: EventTarget | null): HTMLInputElement | null =>
    target instanceof HTMLInputElement && target.classList.contains("seedvalue") ? target : null;

  block.addEventListener("input", (event) => {
    // A message set below outlives the value that earned it, and a field that
    // stays invalid while it is being corrected reports the wrong thing at the
    // next commit. Cleared on the first keystroke, which is the browser's own
    // convention for a custom message.
    fieldOf(event.target)?.setCustomValidity("");
  });

  block.addEventListener("change", (event) => {
    const field = fieldOf(event.target);
    if (field === null) {
      return;
    }
    // Trimmed because a seed is pasted at least as often as it is typed, and
    // what comes off a chat line or a console print often carries a space at
    // one end. Trimming cannot change which run is meant: a space is not a
    // character a seed may contain, so a value with one was never a seed.
    const seed = field.value.trim();
    if (!isUsableSeed(seed)) {
      // `pattern` and `required` already mark the field invalid; what the
      // browser says about it on its own is "match the requested format",
      // which names no format. This says which characters, in the player's
      // own language, and `reportValidity` is what puts it on screen -- the
      // field is not inside a `<form>`, so nothing else would.
      field.setCustomValidity(t("game.seed.invalid"));
      field.reportValidity();
      return;
    }
    options.onSeed(seed);
  });

  block.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest(".seednewdraw") !== null) {
      options.onSeed(String(generateRandomSeed()));
    }
  });
}
