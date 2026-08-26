/**
 * What a seed may look like once it has to survive the address bar. Shared
 * so the router and the settings panel's seed field enforce the same rule.
 */

/** Max length of a `seed`: room for a generated seed, a UUID, or a short label, without bloating the hash. */
export const SEED_MAX_LENGTH = 64;

/**
 * What a `seed` may contain: ASCII letters, digits, `.`, `-` and `_`.
 * Narrow because it must survive a round trip through the address bar
 * unchanged; anything else gets percent-encoded and would hash differently.
 */
export const SEED_PATTERN = /^[\w.-]+$/;

/**
 * {@link SEED_PATTERN} spelled as an `<input pattern>` attribute. Duplicated
 * rather than derived, since `pattern` is auto-anchored and can't carry the
 * regex's own `^`/`$`; a test keeps the two spellings in sync.
 */
export const SEED_INPUT_PATTERN = "[\\w.-]+";

/**
 * Whether a seed can be played and written down; empty is refused too, since
 * a `seed=` with nothing after it names no run.
 */
export function isUsableSeed(value: string): boolean {
  return value !== "" && value.length <= SEED_MAX_LENGTH && SEED_PATTERN.test(value);
}
