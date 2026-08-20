/**
 * The settings popover's seed block: `design/ui-mockup.html`'s `.setblock`
 * captioned "Seed" (§A).
 *
 * A template and a presenter, the shape its `features/switch-theme` and
 * `features/switch-layout` siblings have always had. It was a lone template
 * function for as long as the block had nothing to wire — its one control was
 * a real link with a real `href`, and the disclosure explaining what a seed
 * does is a native `<details>` that needs no script at all. The field below
 * changed that: a seed the player types is a decision this block has to hand
 * somewhere, and so is a new draw.
 *
 * ## The mockup's row, and what this renders in it
 *
 * `design/ui-mockup.html` draws this block as a `.seedrow`: an editable
 * `#seedVal` text field, a `#seedRoll` dice button and a `#seedCopy`
 * copy-link button, with a one-line `.sethint` under the three. All three are
 * here, in that order.
 *
 * The field is the newest of them, and for a long time it was the one part
 * production could not have: a run's seed was drawn once, from the URL or
 * from `Math.random()`, and the game had no arbitrary-seed input anywhere, so
 * there was nothing to type into and nothing for a reroll to reroll *to*. The
 * seed is the player's own now — `src/pages/game/index.ts` remembers it and
 * `handleRoute`'s own comment records why that decision was reversed — and a
 * thing the player owns is a thing they can set. So the mockup's `<input>` is
 * an `<input>` again, holding what the run is playing and taking what the
 * player wants to play next.
 *
 * What it accepts is `#shared/lib/seed.ts`'s rule, not one of its own:
 * `maxlength` and `pattern` come from the same two constants the router
 * validates `#seed=` with, so the field cannot accept a seed the address bar
 * is about to refuse. Committing is a `change` — Enter, or leaving a field
 * that was edited — which is what the language `<select>` two blocks up
 * already means by "chosen", and there is no separate confirm button for the
 * same reason that one has none.
 *
 * The two buttons survive nearly intact, because production's two real
 * affordances turn out to be the same two gestures under other names.
 * `.seedlink` — put this run in the address bar, which is to say a link to
 * this exact run — is `#seedCopy`, and takes its `copy` glyph. `.seednewdraw`
 * — throw this draw away and take another — is `#seedRoll`, and takes its
 * `dice` glyph. `#shared/ui/icon.ts` has kept both sprites since the icon
 * family was ported, for exactly this.
 *
 * `.seednewdraw` is a `<button>` and not the link it used to be. As a link it
 * meant "the same address without `seed=`", which was a new draw for as long
 * as an address without a seed drew one; now an address without a seed plays
 * the seed the player already owns, and the same link would be a button that
 * does nothing. So it draws the seed itself —
 * {@link "#game/random.ts"!generateRandomSeed}, the same call the world makes
 * when nobody supplies one — and hands it over the same way a typed one goes.
 * Both controls are shown at once, as the mockup shows them: they no longer
 * name two states of one run, they name two different things to do.
 *
 * Icon-only, as the mockup draws them, so each carries its accessible name
 * on `aria-label` — one for a screen reader — and on `title` — one for a
 * pointer that has stopped over an unfamiliar glyph. Both names are keys the
 * challenge bar's seed line already had, and both name the seed as well as
 * the gesture. WCAG 2.5.3 has nothing to hold them to: it constrains an
 * accessible name against *visible* text, and neither button has any — which
 * is also what retired `game.seed.newDraw`, the words "new draw" that used
 * to be `.seednewdraw`'s label.
 *
 * The hint line stays a `<details>`. The mockup's is a single sentence
 * («Один и тот же seed — один и тот же поток людей»); production's is a
 * paragraph about what a seed promises and how long it stays yours, which is
 * more than a panel wants open under every run. Only its `<summary>` is
 * dressed as the mockup's hint line — `class="sethint"`, and `seed-panel.css`
 * takes the disclosure triangle off it.
 *
 * Taking the triangle off left the line reading as the mockup's inert hint
 * and behaving as a control, which is the worse half of both: nothing on
 * screen said there was a paragraph behind it. So it carries the chevron the
 * rest of the app already spells "this opens" with — `spriteIconMarkup(
 * "right", "chev")`, the mockup's `#i-right`, the same call
 * `widgets/stats-panel`'s "All figures" shelf and the block below this one's
 * own Hotkeys row both make. The words move into a `<span>` to make room for
 * it, and `seed-panel.css` turns it a quarter-turn on open exactly as
 * that shelf's does.
 *
 * ## Where the rest of it comes from
 *
 * `src/ui/templates.ts`'s exported {@link SeedLinkData} type and the
 * `game.seed.*` catalogue keys the challenge bar's seed line already read, so
 * this block says what that line said, in the settings popover's own
 * `.setblock`/`.cap` shape instead of the challenge bar's
 * `.challengeseed`/`.seedlabel` one. The markup itself is recomposed here
 * rather than called into, because the challenge bar's own `seedTemplate`
 * and `seedHelpTemplate` are not exported from `templates.ts` — they are
 * private helpers of `challengeTemplate`, which is the only thing about them
 * the challenge bar promised to any caller. What *is* reused verbatim is the
 * class names their markup already used (`seedlink`, `seedvalue`,
 * `seednewdraw`, `seedhelp`, `seedcaveat`), so `seed-panel.css` styles this
 * block through one set of rules rather than two under different names.
 *
 * `presentChallenge` in what was `src/ui/presenters.ts` went to some trouble to keep
 * the seed line's `<details>` open state and the document's focus in place
 * across the challenge bar's own full-`innerHTML` rebuilds on every restart.
 * That trouble is specific to a bar that redraws itself on a timer this panel
 * does not share. `AppBarSettingsController.setSeed` does rebuild this block,
 * but only when a run's seed actually changes, which is a navigation the
 * player asked for — most often from this very row — rather than a redraw
 * arriving under a pointer that was busy with something else. Focus is the one
 * thing that rebuild does carry across, and it is carried in that method
 * rather than here: this block's controls are now the ones a player is most
 * likely to be holding when a run changes, because they are what changed it.
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
 * A near-exact copy of `src/ui/templates.ts`'s private `seedHelpTemplate` —
 * same `game.seed.*` keys, same `seedhelp`/`seedcaveat` class names — kept
 * separate from that one only because it is not exported; see the module
 * comment for why this module does not import it instead.
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
 * The four "leave this alone" attributes are the mockup's, minus its
 * `spellcheck` shorthand: a seed is an opaque token, and a phone that
 * capitalises it, a browser that corrects it or a password manager that fills
 * it has each turned it into a different run.
 *
 * @param seed - The seed the run on screen is playing.
 * @returns The field's markup.
 */
function seedFieldTemplate(seed: string): string {
  return markup`<input type="text" class="val seedvalue" value="${seed}" maxlength="${SEED_MAX_LENGTH}" pattern="${SEED_INPUT_PATTERN}" required spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" aria-label="${t("game.seed.inputLabel")}">`;
}

/**
 * A row button: the mockup's `#seedRoll`/`#seedCopy` shape.
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
 * `#seedLink` returns `null` for: a learning-track task, which has no
 * pass/fail run to name a seed for, or (test-only) a world built with a
 * ready-made random stream instead of a seed. Rendering nothing then, rather
 * than a block with nothing useful in it, is the same choice
 * `challengeTemplate` already makes for the challenge bar's own seed line.
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
