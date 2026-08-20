/**
 * The settings popover's seed block: `design/ui-mockup.html`'s `.setblock`
 * captioned "Seed" (§A).
 *
 * A single template function rather than a skeleton builder and a presenter,
 * unlike its `features/switch-theme` and `features/switch-layout` siblings.
 * Both of them wire a `click` listener onto DOM they hand out, because a
 * theme or a layout is chosen from a fixed set of buttons they draw
 * themselves. This block has nothing to wire: its one control is a real link
 * with a real `href`, and the disclosure that explains what a seed does is a
 * native `<details>` that needs no script at all — see `seedHelpTemplate` in
 * `src/ui/templates.ts` for why. A skeleton would have nothing for its
 * presenter half to do.
 *
 * ## The mockup's row, and what this renders in it
 *
 * `design/ui-mockup.html` draws this block as a `.seedrow`: an editable
 * `#seedVal` text field between a `#seedRoll` dice button and a `#seedCopy`
 * copy-link button, with a one-line `.sethint` under the three.
 *
 * The field is the one part production cannot have. A run's seed is drawn
 * once, from the URL or from `Math.random()`, by `src/pages/game/index.ts`'s
 * `#seedLink`; the game has no arbitrary-seed input anywhere, so there is
 * nothing to type into and nothing for a reroll to reroll *to* — the
 * mockup's own `#seedRoll` handler picks a word out of a fixed `SEED_WORDS`
 * list, which is a demo, not a feature. The value is a
 * `<span class="val seedvalue">` instead: the mockup's box, in the mockup's
 * monospace, with the caret taken out.
 *
 * The two buttons survive nearly intact, because production's two real
 * affordances turn out to be the same two gestures under other names.
 * `.seedlink` — pin this draw into the address bar, which is to say a link
 * to this exact run — is `#seedCopy`, and takes its `copy` glyph.
 * `.seednewdraw` — throw this draw away and start again without it — is
 * `#seedRoll`, and takes its `dice` glyph. `#shared/ui/icon.ts` has kept
 * both sprites since the icon family was ported, for exactly this. Where the
 * mockup shows the pair at once, this shows one at a time: a run is either
 * pinned or it is not, and the gesture the absent button would offer is the
 * state the run is already in.
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
 * paragraph about what a seed does and does not promise, which is more than
 * a panel wants open under every run. Only its `<summary>` is dressed as the
 * mockup's hint line — `class="sethint"`, and `src/styles/style.css` takes
 * the disclosure triangle off it.
 *
 * ## Where the rest of it comes from
 *
 * `src/ui/templates.ts`'s exported {@link SeedLinkData} type and five of the
 * `game.seed.*` catalogue keys the challenge bar's seed line already read
 * (`label`, `link`, `newDrawLink`, `helpSummary`, `explanation`), so this
 * block says what that line said, in the settings popover's own
 * `.setblock`/`.cap` shape instead of the challenge bar's
 * `.challengeseed`/`.seedlabel` one. The markup itself is recomposed here
 * rather than called into, because the challenge bar's own `seedTemplate`
 * and `seedHelpTemplate` are not exported from `templates.ts` — they are
 * private helpers of `challengeTemplate`, which is the only thing about them
 * the challenge bar promised to any caller. What *is* reused verbatim is the
 * class names their markup already used (`seedlink`, `seedvalue`,
 * `seednewdraw`, `seedhelp`, `seedcaveat`), so `src/styles/style.css`'s
 * "Settings popover" section styles this block through one set of rules
 * rather than two under different names.
 *
 * `presentChallenge` in what was `src/ui/presenters.ts` went to some trouble to keep
 * the seed line's `<details>` open state and the document's focus in place
 * across the challenge bar's own full-`innerHTML` rebuilds on every restart.
 * That trouble is specific to a bar that redraws itself on a timer this panel
 * does not share. `AppBarSettingsController.setSeed` does rebuild this block,
 * but only when a run's seed actually changes, which is a navigation the
 * player asked for — most often by pressing this block's own link — rather
 * than a redraw arriving under a pointer that was busy with something else.
 */

import { t } from "#i18n/index.ts";
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
  return markup`<details class="seedhelp"><summary class="sethint">${t("game.seed.helpSummary")}</summary><p class="seedcaveat">${t("game.seed.explanation")}</p></details>`;
}

/**
 * The row's one icon button — the mockup's `#seedRoll`/`#seedCopy` shape,
 * carrying whichever of the run's two gestures is the one it has.
 *
 * `.ghost` is the chrome `src/styles/style.css` gives every low-emphasis
 * control, narrowed to the row's 30x30 square by its own `.seedrow .ghost`;
 * `name` is written twice, once for a screen reader and once for a pointer,
 * because the glyph is the whole of what is on screen.
 *
 * @param className - `seedlink` or `seednewdraw`, the class the specs and the
 * stylesheet know this control by.
 * @param href - Where pressing it takes the player.
 * @param name - Its accessible name, already naming the seed.
 * @param icon - The sprite that draws it.
 * @returns The link's markup.
 */
function seedActionTemplate(
  className: "seedlink" | "seednewdraw",
  href: string,
  name: string,
  icon: "copy" | "dice",
): string {
  return markup`<a class="ghost ${className}" href="${href}" title="${name}" aria-label="${name}">${raw(spriteIconMarkup(icon))}</a>`;
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
 * @param data - The seed of the run in progress and where its pin/un-pin link
 * goes, or `null` to render nothing.
 * @returns The block's markup, or the empty string.
 */
export function seedPanelTemplate(data: SeedLinkData | null): string {
  if (data === null) {
    return "";
  }
  const action =
    data.newDrawUrl === null
      ? seedActionTemplate("seedlink", data.url, t("game.seed.link", { seed: data.seed }), "copy")
      : seedActionTemplate(
          "seednewdraw",
          data.newDrawUrl,
          t("game.seed.newDrawLink", { seed: data.seed }),
          "dice",
        );
  return markup`<div class="setblock"><span class="cap">${t("game.seed.label")}</span><div class="seedrow"><span class="val seedvalue">${data.seed}</span>${raw(action)}</div>${raw(seedHelpTemplate())}</div>`;
}
