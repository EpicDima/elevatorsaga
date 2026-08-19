/**
 * The hash format's raw grammar: splitting a location hash into its
 * `key=value` pairs and rebuilding one from a set of parameters.
 *
 * The format is unchanged from the legacy `riot.route`-based router this
 * replaced — a `#` followed by comma-separated `key=value` pairs, as in
 * `#challenge=3,timescale=8` — and so are the parameter names, so old links
 * and bookmarks keep working.
 *
 * Nothing here knows what a key means, or whether a value is one the game can
 * use: that is `{@link "#pages/game/model/route.ts"!resolveRoute}`'s job, one
 * layer up, where the parameters the game page actually supports — `challenge`,
 * `seed`, the sandbox dimensions and the rest — are read, validated and
 * defaulted. What lives here is the syntax underneath that, and it is shared by
 * more than the game page: {@link parseQuery} alone is also how
 * `src/i18n/detect.ts` reads a `lang` override out of the hash, without pulling
 * in anything the game page's own route resolution depends on.
 */

/** Raw `key=value` pairs from the location hash, in the order they appeared. */
export type RouteQuery = ReadonlyMap<string, string>;

/**
 * Splits a location hash into its `key=value` pairs.
 *
 * Keys are lower-cased; values are not. A hash is something people hand-write
 * and dictate to each other, and which shift key was held while writing
 * `challenge` is not a decision anybody makes on purpose — so `#SEED=abc` is
 * the seed, and `#Challenge=3` is the challenge. Values stay exactly as
 * written, because they are the data: `seed=Abc` and `seed=abc` are two
 * different passenger streams, and the one value that is folded — `sandbox` —
 * is folded where it is read, by
 * {@link "#pages/game/model/route.ts"!SANDBOX_CHALLENGE}'s reader, and not for
 * every parameter at once.
 *
 * Folding here is also what stops an unknown key from becoming a second copy of
 * a known one. `#SEED=abc` used to be neither read as a seed nor dropped, so it
 * rode along into every URL built from these parameters, and the result named
 * `SEED=abc` *and* `seed=…`: one hash, two seeds, one of which the router would
 * ignore on arrival. A map keyed by the folded name cannot hold both.
 *
 * Unknown keys are kept, as the legacy code kept them, and that is a decision
 * rather than an oversight. The hash is the whole of this game's shareable
 * state, so a key this version does not recognise is either one a later version
 * adds — a link built by a newer tab and pasted into an older one keeps its
 * meaning, and gets it back on the way home — or one the player is using for
 * their own purposes, which is a thing the address bar has always been for. The
 * price is that a misspelled key decorates every link built afterwards, and the
 * alternative price is throwing away, silently, something the player wrote on
 * purpose. A refused *value* of a key the router does know is a different
 * question, answered differently: see
 * {@link "#pages/game/model/route.ts"!startRouter}.
 *
 * A key with no `=` is accepted as a bare flag and yields an empty value, so
 * `#fullscreen` now works. The legacy regexp required a value, which meant the
 * bare forms people wrote (`#autostart`, `#devtest`) silently did nothing.
 *
 * Whitespace around a key or a value is dropped, so `#challenge=4, seed=abc`
 * and `#seed = abc` parse as they look. No browser can hand this function
 * either of those: U+0020 is in the URL Standard's fragment percent-encode set,
 * so every path into `location.hash` — typing, pasting, assigning, following an
 * anchor — writes `%20` instead, which
 * {@link "#pages/game/model/route.ts"!SEED_PATTERN} then refuses on purpose.
 * The leniency is for the callers that are not a browser: a hash assembled in
 * code, one that has already been through `decodeURIComponent`, one written by
 * hand in a test. It lives here rather than in each resolver so that the format
 * has one whitespace rule instead of one per parameter, and so that no resolver
 * has to explain a `trim` of its own.
 *
 * @param hash - The location hash, with or without its leading `#`.
 * @returns The parsed pairs, in order, keyed by the lower-cased name.
 */
export function parseQuery(hash: string): RouteQuery {
  const query = new Map<string, string>();
  const body = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const segment of body.split(",")) {
    const trimmed = segment.trim();
    if (trimmed === "") {
      continue;
    }
    const separator = trimmed.indexOf("=");
    const key = (separator === -1 ? trimmed : trimmed.slice(0, separator)).trim();
    const value = separator === -1 ? "" : trimmed.slice(separator + 1).trim();
    if (key !== "") {
      query.set(key.toLowerCase(), value);
    }
  }
  return query;
}

/**
 * Rebuilds a hash URL from a set of parameters and some overrides.
 *
 * An override of `null` drops the parameter instead of setting it, which is how
 * a link says "everything the player is carrying except this one". The seed is
 * the parameter that needs it: it is drawn for one building, so carrying it into
 * a link that changes the building would pin a run nobody has seen, and would
 * leave a player who once followed the seed link with no way back to a fresh
 * draw short of editing the address bar.
 *
 * Override names are lower-cased, exactly as {@link parseQuery} lower-cases the
 * names it reads, so that an override always replaces the parameter it names
 * instead of coming to rest beside a differently spelled copy of it.
 *
 * @param query - The parameters currently in the URL.
 * @param overrides - Parameters to add or replace; `null` removes one.
 * @returns The new hash, including its leading `#`.
 */
export function createParamsUrl(
  query: RouteQuery,
  overrides: Readonly<Record<string, string | number | null>> = {},
): string {
  const merged = new Map(query);
  for (const [key, value] of Object.entries(overrides)) {
    const name = key.toLowerCase();
    if (value === null) {
      merged.delete(name);
    } else {
      merged.set(name, String(value));
    }
  }
  return `#${[...merged].map(([key, value]) => `${key}=${value}`).join(",")}`;
}
