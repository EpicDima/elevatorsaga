/** The settings popover's seed block: a field, a redraw button, a copy-link button, and a help disclosure. */

import { generateRandomSeed } from "#game/random.ts";
import { t } from "#i18n/index.ts";
import { isUsableSeed, SEED_INPUT_PATTERN, SEED_MAX_LENGTH } from "#shared/lib/seed.ts";
import type { SeedLinkData } from "../../../ui/templates.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw } from "#shared/ui/markup.ts";

/** The seed block's help disclosure: what a seed promises. */
function seedHelpTemplate(): string {
  return markup`<details class="seedhelp"><summary class="sethint">${raw(spriteIconMarkup("right", "chev"))}<span>${t("game.seed.helpSummary")}</span></summary><p class="seedcaveat">${t("game.seed.explanation")}</p></details>`;
}

/**
 * The row's field for the seed. `maxlength`/`pattern` mirror
 * `#shared/lib/seed.ts` so it can't accept a seed the router would refuse.
 */
function seedFieldTemplate(seed: string): string {
  return markup`<input type="text" class="val seedvalue" value="${seed}" maxlength="${SEED_MAX_LENGTH}" pattern="${SEED_INPUT_PATTERN}" required spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" aria-label="${t("game.seed.inputLabel")}">`;
}

/** The row's link button: the address of this exact run. */
function seedLinkTemplate(href: string, name: string): string {
  return markup`<a class="ghost seedlink" href="${href}" title="${name}" aria-label="${name}">${raw(spriteIconMarkup("copy"))}</a>`;
}

/** The row's other button: draws a fresh seed. */
function seedNewDrawTemplate(name: string): string {
  return markup`<button type="button" class="ghost seednewdraw" title="${name}" aria-label="${name}">${raw(spriteIconMarkup("dice"))}</button>`;
}

/**
 * The settings popover's seed block, or nothing when `data` is `null` (a
 * learning-track level, or a world built with a ready-made random stream).
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
   * Called with a seed the player chose, already valid for the address bar.
   * Not called with the seed already on screen (no `change` event fires).
   */
  readonly onSeed: (seed: string) => void;
}

/**
 * Wires the row's field and its redraw button. Listeners are delegated from
 * `block` rather than attached to the controls, since
 * `AppBarSettingsController.setSeed` replaces those controls on every rebuild.
 */
export function presentSeedPanel(block: HTMLElement, options: SeedPanelOptions): void {
  /** The row's field, if that is what an event came from. */
  const fieldOf = (target: EventTarget | null): HTMLInputElement | null =>
    target instanceof HTMLInputElement && target.classList.contains("seedvalue") ? target : null;

  block.addEventListener("input", (event) => {
    // Clears the previous commit's validity message on the first keystroke.
    fieldOf(event.target)?.setCustomValidity("");
  });

  block.addEventListener("change", (event) => {
    const field = fieldOf(event.target);
    if (field === null) {
      return;
    }
    // Trims pasted whitespace; a seed never contains a space.
    const seed = field.value.trim();
    if (!isUsableSeed(seed)) {
      // The field isn't inside a `<form>`, so `reportValidity` is what surfaces this.
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
