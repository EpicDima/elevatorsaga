/**
 * Line-level LCS table: `table[i][j]` is the length of the longest common subsequence of
 * `before[i:]` and `after[j:]`.
 */
function lcsTable(before: readonly string[], after: readonly string[]): number[][] {
  const table: number[][] = Array.from({ length: before.length + 1 }, () =>
    new Array<number>(after.length + 1).fill(0),
  );
  for (let i = before.length - 1; i >= 0; i--) {
    // `i` never exceeds `before.length - 1`, so these rows always exist; the `?? []`
    // fallbacks are only to satisfy `noUncheckedIndexedAccess`.
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
 * Which lines of `after` are not part of the longest run of lines the two programs share.
 *
 * A line kept verbatim but reordered counts as "kept", not "changed": the LCS is a
 * subsequence, not a fixed position.
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
