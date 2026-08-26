/**
 * The hash format's raw grammar: splits a location hash into `key=value`
 * pairs and rebuilds one from a set of parameters. Nothing here knows what a
 * key means; validating and defaulting values is the caller's job.
 */

/** Raw `key=value` pairs from the location hash, in the order they appeared. */
export type RouteQuery = ReadonlyMap<string, string>;

/**
 * Splits a location hash into its `key=value` pairs, in order. Keys are
 * lower-cased; values are kept verbatim since they are data (e.g. a seed).
 * A bare key with no `=` becomes an empty-value flag; unknown keys are kept.
 *
 * @param hash - The location hash, with or without its leading `#`.
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
 * Rebuilds a hash URL from existing parameters plus overrides; a `null`
 * override removes that parameter instead of setting it. Override names are
 * lower-cased to match {@link parseQuery}.
 *
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
