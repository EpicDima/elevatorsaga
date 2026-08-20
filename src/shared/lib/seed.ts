/**
 * What a seed may look like once it has to survive the address bar.
 *
 * This grammar used to live in `src/pages/game/model/route.ts`, where for a
 * long time the router was the only thing that ever looked at a seed: one
 * arrived in the hash or one did not, and everything else in the game only ever
 * read the value back out. The settings panel has a field the player types a
 * seed into now (`features/manage-seed`), and a field that accepts what the
 * router is about to refuse is a field that silently does nothing — so the two
 * read one rule from one place. `features` may not import from `pages` (see
 * `eslint.config.js`), and this layer is the one both of them can see.
 *
 * None of this is the *generator's* rule.
 * {@link "#game/random.ts"!createRandomSource} hashes any string at all in one
 * pass and would take a sentence in Cyrillic without complaint. Everything
 * narrow below is the hash's doing, not the engine's.
 */

/**
 * How long a `seed` may be.
 *
 * The seed rides in the hash, and every entry of the level switcher's menu is
 * that hash with `level` rewritten, so whatever is written here is written
 * into the document some twenty times over. Sixty-four characters is room for a
 * generated seed (ten digits), a UUID (thirty-six) or a label somebody can read
 * down a phone line, and far too few to bloat the document with.
 */
export const SEED_MAX_LENGTH = 64;

/**
 * What a `seed` may contain: ASCII letters, digits, `.`, `-` and `_`.
 *
 * Narrow because the seed has to survive a round trip through the address bar
 * unchanged, and only an ASCII token does. A browser percent-encodes everything
 * else on its way into `location.hash` — a space becomes `%20` and a non-Latin
 * letter three bytes of `%xx` — so `#seed=rush hour` would come back as
 * `rush%20hour`, hash to something else entirely, and send *different people*
 * into the building than the ones the link was shared for. Not a different
 * building: floors, elevators and capacities come from the level number or
 * the sandbox parameters, and the seed has no say in any of them. A comma
 * cannot get here at all: {@link "#shared/lib/route-query.ts"!parseQuery}
 * splits on it. What is left still spells every generated seed and every label
 * worth typing.
 */
export const SEED_PATTERN = /^[\w.-]+$/;

/**
 * {@link SEED_PATTERN} as an `<input pattern>` attribute spells it.
 *
 * The same rule in the one other place that has to state it, written out a
 * second time rather than derived from the regular expression's own `source`:
 * an `<input pattern>` is anchored by the browser, so the attribute must not
 * carry `^` and `$` of its own, and `SEED_PATTERN.source` carries both. Reading
 * `^(?:^[\w.-]+$)$` out of the DOM tells nobody anything. `seed.test.ts` holds
 * the two spellings to each other, which is the part that matters — a character
 * added to one and not the other is a field that accepts what the router
 * refuses, or refuses what it accepts.
 */
export const SEED_INPUT_PATTERN = "[\\w.-]+";

/**
 * Whether a seed can be played and written down.
 *
 * The one question both the router and the settings panel's field ask, so that
 * neither can answer it differently. Empty is refused along with the rest: a
 * `seed=` with nothing after it names no run, and there is nothing to replay.
 *
 * @param value - The seed as the URL or the player wrote it.
 * @returns Whether it survives a round trip through the hash.
 */
export function isUsableSeed(value: string): boolean {
  return value !== "" && value.length <= SEED_MAX_LENGTH && SEED_PATTERN.test(value);
}
