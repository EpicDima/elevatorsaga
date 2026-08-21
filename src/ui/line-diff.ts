/**
 * Which lines of a program are new, against an earlier draft of it.
 *
 * The learning track shows one code block per level: the answer, under the
 * third hint. What used to mark "this is what changed" was prose alone — hint
 * 3 already narrates the one line the player has to add or change, by hand,
 * once per level and per language. That is the thing worth not repeating: a
 * marker written into sixteen catalog strings (eight levels, two languages)
 * would drift the moment a level's wording moved without its marker moving
 * with it, silently, because nothing checks a hand-written marker against the
 * code it claims to point at.
 *
 * This computes the same fact instead, from the two strings the track already
 * holds for every level — `startingCode` and `solutionCode` — so there is
 * exactly one source of truth for "what changed" and it cannot go stale.
 */

/**
 * Line-level longest common subsequence of two programs.
 *
 * Standard dynamic-programming LCS over lines rather than characters: two
 * eight-to-twenty-line programs are nowhere near the size that would call for
 * a smarter algorithm (Myers, patience diff), and a hand-rolled table here is
 * a few lines against pulling in a diffing package for a game that otherwise
 * has none.
 *
 * @param before - The lines of the earlier draft.
 * @param after - The lines of the later one.
 * @returns `table[i][j]` is the length of the longest common subsequence of
 * `before[i:]` and `after[j:]`.
 */
function lcsTable(before: readonly string[], after: readonly string[]): number[][] {
  const table: number[][] = Array.from({ length: before.length + 1 }, () =>
    new Array<number>(after.length + 1).fill(0),
  );
  for (let i = before.length - 1; i >= 0; i--) {
    // `table` has `before.length + 1` rows and `i` never exceeds `before.length
    // - 1`, so both rows exist; the fallbacks are here only to satisfy
    // `noUncheckedIndexedAccess`, not because either read can miss.
    const row = table[i] ?? [];
    const nextRow = table[i + 1] ?? [];
    for (let j = after.length - 1; j >= 0; j--) {
      row[j] =
        before[i] === after[j]
          ? (nextRow[j + 1] ?? 0) + 1
          : Math.max(nextRow[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  return table;
}

/**
 * Which lines of `after` are not part of the longest run of lines the two
 * programs share, i.e. the lines a diff would mark added or changed.
 *
 * A line that moved without changing a character is not reported: the LCS is
 * a subsequence, not a fixed position, so a line kept verbatim but reordered
 * is still "kept" rather than "changed". That matches what the marker is for
 * — pointing at the text a player has to type, not at where it ended up.
 *
 * @param before - The program the player starts the level with.
 * @param after - The program that clears it.
 * @returns Zero-based indices into `after.split("\n")` that differ from every
 * line of `before`, in the sense above.
 */
export function changedLines(before: string, after: string): ReadonlySet<number> {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const table = lcsTable(beforeLines, afterLines);

  const kept = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < beforeLines.length && j < afterLines.length) {
    if (beforeLines[i] === afterLines[j]) {
      kept.add(j);
      i += 1;
      j += 1;
    } else if ((table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0)) {
      i += 1;
    } else {
      j += 1;
    }
  }

  const changed = new Set<number>();
  for (let line = 0; line < afterLines.length; line += 1) {
    if (!kept.has(line)) {
      changed.add(line);
    }
  }
  return changed;
}
