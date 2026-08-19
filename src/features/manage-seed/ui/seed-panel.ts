/**
 * The settings popover's seed block: `design/ui-mockup.html`'s `.setblock`
 * captioned "Seed" (§A).
 *
 * Nothing here is reachable yet. `seedPanelTemplate` is built and tested ahead
 * of the widget that will compose it — `widgets/app-bar`'s settings menu, a
 * later step of this same phase — the same "build inert first" staged
 * migration `features/switch-theme` and `features/switch-layout` follow.
 *
 * A single template function rather than a skeleton builder and a presenter,
 * unlike those two siblings. Both of them wire a `click` listener onto DOM
 * they hand out, because a theme or a layout is chosen from a fixed set of
 * buttons this module draws itself. This block has nothing to wire: the seed
 * is either a plain link (`<a class="seedlink">`, pin it) or plain text next
 * to another link (`<a class="seednewdraw">`, un-pin it), and the disclosure
 * that explains what a seed does is a native `<details>` that needs no script
 * at all — see `seedHelpTemplate` in `src/ui/templates.ts` for why. A skeleton
 * would have nothing for its presenter half to do.
 *
 * The mockup's own seed block is not what this renders. It shows an editable
 * `#seedVal` text input next to a `#seedRoll` reroll button and a `#seedCopy`
 * copy-link button. `#seedRoll` does have a click handler in the mockup's own
 * script — it rerolls to a random word from a fixed `SEED_WORDS` list and
 * restarts the run with it — but production has no arbitrary-seed field to
 * type or reroll into in the first place: a run's seed is drawn once, from
 * the URL or from `Math.random()`, by `src/app/app.ts`'s `#seedLink`, and the
 * only thing a player can do with it is pin the current draw into the address
 * bar or take a pin back out — never choose one by hand, so there is nothing
 * for a reroll button to reroll. `#seedCopy`, unlike `#seedRoll`, has no
 * click handler anywhere in the mockup's script at all — a cosmetic stub.
 * `#shared/ui/icon.ts` keeps the `dice` and `copy` sprites the mockup drew
 * for that row, in case a later phase gives them a real affordance, but this
 * module does not use either: there is nothing behind them yet.
 *
 * What this module renders instead is production's own seed affordance —
 * `src/ui/templates.ts`'s exported {@link SeedLinkData} type and the same six
 * `game.seed.*` catalogue keys the challenge bar's seed line already reads
 * (`label`, `link`, `newDraw`, `newDrawLink`, `helpSummary`, `explanation`) —
 * so this block says exactly what the challenge bar's seed line says, just
 * inside the settings popover's own `.setblock`/`.cap` shape instead of the
 * challenge bar's `.challengeseed`/`.seedlabel` one. The markup itself is
 * recomposed here rather than called into, because the challenge bar's own
 * `seedTemplate` and `seedHelpTemplate` are not exported from `templates.ts`
 * — they are private helpers of `challengeTemplate`, which is the only thing
 * about them the challenge bar promises to any caller. What *is* exported and
 * reused verbatim is the class names their markup already uses (`seedlink`,
 * `seedvalue`, `seednewdraw`, `seedhelp`, `seedcaveat`) — not because
 * `style.css` is being touched this phase (it is deliberately not, this
 * phase), but so that whichever stylesheet eventually styles this panel can
 * reuse the same rules rather than duplicate them under new names.
 *
 * `presentChallenge` in `src/ui/presenters.ts` goes to some trouble to keep
 * the seed line's `<details>` open state and the document's focus in place
 * across the challenge bar's own full-`innerHTML` rebuilds on every restart.
 * That trouble is specific to a bar that redraws itself on a timer this panel
 * does not share: nothing yet calls `seedPanelTemplate` more than once for
 * the same popover, so there is no rebuild here to preserve state across.
 * `widgets/app-bar`'s settings menu, composing this in a later step, is where
 * that question would be revisited if the popover ever gained one.
 */

import { t } from "#i18n/index.ts";
import type { SeedLinkData } from "../../../ui/templates.ts";
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
  return markup`<details class="seedhelp"><summary>${t("game.seed.helpSummary")}</summary><p class="seedcaveat">${t("game.seed.explanation")}</p></details>`;
}

/**
 * The settings popover's seed block, or nothing at all.
 *
 * `data` is `null` under exactly the conditions `src/app/app.ts`'s
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
      ? markup`<a class="seedlink" href="${data.url}" aria-label="${t("game.seed.link", { seed: data.seed })}">${data.seed}</a>`
      : markup`<span class="seedvalue">${data.seed}</span> <a class="seednewdraw" href="${data.newDrawUrl}" aria-label="${t("game.seed.newDrawLink", { seed: data.seed })}">${t("game.seed.newDraw")}</a>`;
  return markup`<div class="setblock"><span class="cap">${t("game.seed.label")}</span> ${raw(action)} ${raw(seedHelpTemplate())}</div>`;
}
