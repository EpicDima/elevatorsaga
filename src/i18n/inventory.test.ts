/**
 * `docs/i18n-inventory.md`, against the catalogue and the tree it describes.
 *
 * The inventory is the map of `src/i18n/`: every key, what it says, and what
 * reads it. Until this file, nothing in the repository read it — `en.ts` names
 * it in a comment and that is all — and it rotted the way an unread document
 * does. The version the rebuild in `4a58d85` replaced printed a total of 209
 * for a catalogue that held 210, and carried 237 `file.ts:123` pins, 95 of
 * which now point at a line other than the one they were written against.
 * Those numbers are counted off `git show a5010f2`, not taken on report; the
 * document prints the command for the last of them. All of it compiled, all of
 * it passed, and only the reader was told something untrue.
 *
 * The document specifies its own guard, in _What guards what_, and this file is
 * it. The six checks below are that list, in its order, and they are the whole
 * of what is machine-checkable about a document made mostly of prose:
 *
 * 1. every backticked token shaped like a message key is a real key;
 * 2. every key in `EN_MESSAGES` is named, bar the learning track's per-task
 *    keys — its prose and its two programs alike — which the document covers by
 *    their shape;
 * 3. the counts it prints are the counts the catalogue has;
 * 4. every backticked `src/…` path exists on disk;
 * 5. no `file.ts:123` pin below the section that bans them;
 * 6. the learning track's table quotes each task title as the catalogue words
 *    it, and has a row for every task.
 *
 * What this deliberately does **not** check, because an over-claimed guard is
 * worse than a small one, and because a reader who thinks the tables are
 * verified will trust the wrong column:
 *
 * - the **English** column of _The strings_. It is deliberately abridged —
 *   whitespace collapsed, values cut and marked `…`, markup dropped — so it
 *   cannot be compared with the catalogue by equality, and comparing a prefix
 *   would pass on text that was truncated before the part that changed. The
 *   learning track's titles are the exception check 6 makes, and they are one
 *   because they are quoted whole.
 * - the **Notes** column, the _What reads them_ column, and every prose claim
 *   about which module calls what. A row can be right about its key and wrong
 *   about everything beside it, and nothing here would know.
 * - the counts in the section headings (`— 18 `game.*` keys`). Those count what
 *   a section lists rather than what the catalogue holds — `src/ui/templates.ts`
 *   reads 18 of the 26 `game.*` keys — so there is nothing in `EN_MESSAGES` to
 *   compare them against.
 * - the 83 and 85 in _Where the strings are_. They come from a grep over the
 *   whole tree, not from the catalogue, and reproducing that grep here would
 *   make this suite fail whenever an unrelated file is mid-edit.
 * - paths outside `src/`. The document says why: a message key such as
 *   `docs.play.apply.html` is shaped like a file name and is not one, and
 *   `licenses.txt` exists only after a build.
 *
 * Read with `?raw` rather than `node:fs` so that the document is a module
 * dependency of this test: Vitest re-runs the file when the document changes,
 * which is the moment the check is worth anything.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import inventorySource from "../../docs/i18n-inventory.md?raw";
import { tutorialTasks } from "../game/tutorial.ts";
import { EN_MESSAGES } from "./en.ts";

/** The repository root, from this file's own location. */
const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** Every key the reference catalogue defines, in catalogue order. */
const KEYS: readonly string[] = Object.keys(EN_MESSAGES);

/** The same keys, for membership tests. */
const KEY_SET: ReadonlySet<string> = new Set(KEYS);

/**
 * A key's first dotted segment.
 *
 * @param key - A message key, or something shaped like one.
 * @returns Everything before the first dot, or the whole string if it has none.
 */
function prefixOf(key: string): string {
  const dot = key.indexOf(".");
  return dot === -1 ? key : key.slice(0, dot);
}

/** The nine first segments the catalogue uses: `docs`, `page`, `game`, … */
const PREFIXES: ReadonlySet<string> = new Set(KEYS.map(prefixOf));

/**
 * The content of every code span and fenced block in the document.
 *
 * A run of backticks opens a span and the next run of the same length closes
 * it, which is what CommonMark says and is what lets ``t(`…`)`` — a span
 * containing backticks — be read as one span rather than as two broken ones.
 * That distinction is load-bearing here: the document writes a key it means as
 * a span of its own and a key it is only describing the shape of inside a
 * larger expression, and this is what tells the two apart.
 */
const CODE_SPANS: readonly string[] = [...inventorySource.matchAll(/(`+)([\s\S]*?)\1(?!`)/g)].map(
  (match) => match[2] ?? "",
);

/** The same, for membership tests. */
const SPAN_SET: ReadonlySet<string> = new Set(CODE_SPANS);

/** Dotted, alphanumeric segments, `*` allowed: what every key in `EN_MESSAGES` looks like. */
const KEY_SHAPE = /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9*]+)+$/;

/**
 * The spans the document offers as message keys.
 *
 * The document's own rule, quoted: "dotted, and with a first segment that is
 * one of the catalogue's prefixes". The prefix requirement is what keeps
 * `documentation.ru.html`, `elevator.goToFloor` and `package.json` out of a
 * check about messages.
 */
const KEY_SHAPED_SPANS: readonly string[] = [
  ...new Set(CODE_SPANS.filter((span) => KEY_SHAPE.test(span) && PREFIXES.has(prefixOf(span)))),
];

/**
 * A span standing for a group of keys rather than for one: `docs.*`.
 *
 * @param span - A key-shaped span.
 * @returns Whether it is a wildcard.
 */
function isGroupWildcard(span: string): boolean {
  return span.endsWith(".*");
}

/**
 * A span standing for the learning track's per-task keys: `tutorial.taskN.goal`.
 *
 * The `N` is the task number and the `*` a whole task's eight keys; neither is a
 * key, and the document says so where it uses them.
 *
 * @param span - A key-shaped span.
 * @returns Whether it is one of those shapes.
 */
function isTaskShape(span: string): boolean {
  return /^tutorial\.task(?:N|\*)(?:\.|$)/.test(span);
}

/**
 * The eight suffixes the document says every task owns, spelled as it spells
 * them: `tutorial.taskN.hint1.html` in full, `.hint2.html` abbreviated.
 *
 * The last two are the task's two programs, which are messages because their
 * comments are addressed to the player. They are exempted from the naming check
 * for the same reason the other six are — the document covers the track by
 * shape rather than by sixty-four rows — and so they have to be spelled out
 * here, or the exemption would cover keys the document never mentions.
 */
const TASK_SUFFIXES = [
  "title",
  "goal",
  "hint1.html",
  "hint2.html",
  "hint3.html",
  "explanation.html",
  "startingCode.code",
  "solutionCode.code",
];

/**
 * The keys the document covers by shape instead of by row.
 *
 * Built from `tutorialTasks`, so the exemption is exactly as wide as the track
 * really is. A ninth task's eight keys would be exempted from the naming check
 * here — and caught two tests down instead, where the `tutorial.*` count the
 * document prints stops matching the catalogue.
 */
const TASK_KEYS: ReadonlySet<string> = new Set(
  tutorialTasks.flatMap((_, index) =>
    TASK_SUFFIXES.map((suffix) => `tutorial.task${String(index + 1)}.${suffix}`),
  ),
);

/**
 * `src/` spans that are deliberately not paths, with what each one is.
 *
 * Handled by name rather than by loosening check 4 to something they slip
 * through: each of the three is a real reason, and a reason that stops applying
 * should show up as a failing test rather than as a rule that quietly covers
 * less than it says.
 *
 * There is no fourth entry for `src/i18n/inventory.test.ts`. The rebuild named
 * it as the file that ought to exist — the one reference in this document's
 * whole history to a source file that was not in the tree — and writing it is
 * what made that reference true. An excuse would have kept it false.
 */
const NON_PATHS: ReadonlyMap<string, string> = new Map([
  ["src/app/app.ts:207", "the first rotted pin _How this file is anchored_ exhibits"],
  ["src/ui/completions.ts:148", "the second, the one that rotted onto a plausible wrong line"],
  ["src/i18n/<code>.ts", "the placeholder in _Adding a language_, `<code>` being the locale"],
  ["src/…", "the ellipsis in check 4's own wording"],
]);

/**
 * A `file.ts:123` reference, which is the notation this document bans.
 *
 * The extension list is closed on purpose: `docs.play.apply.html` followed by a
 * colon and a digit would otherwise read as a pin, and messages get quoted
 * beside numbers all through the tables.
 */
const LINE_PIN = /[\w.-]+\.(?:ts|tsx|js|css|html|json|md|txt):\d+/g;

/**
 * The name of the notation, not a use of it.
 *
 * `file.ts:123` is how both rules that forbid pins spell what they forbid — one
 * in _How this file is anchored_, one in check 5 below it — so the exact
 * spelling is exempt and nothing else is. `file.ts:124` in either place would
 * be read as a pin and fail.
 */
const PIN_NOTATION = "file.ts:123";

/**
 * The learning track's table of titles, as task number against quoted title.
 *
 * This is the one column of prose in the document that can be compared by
 * equality, and it is worth saying why, since the header above rules the
 * English column out for the opposite reason. That column is abridged on
 * purpose — whitespace collapsed, values cut and marked `…` — so no comparison
 * with the catalogue is available. These titles are not abridged: each is a
 * whole `tutorial.taskN.title` copied across, so either it matches or it has
 * rotted.
 *
 * One had. The row for task 6 read "The elevator that lies to passengers" where
 * the catalogue says "lies to its passengers", and it had sat there since the
 * table was written, through a guard specified as five checks and every one of
 * them passing. Nothing here read the column, so nothing could have noticed.
 */
const QUOTED_TITLES: ReadonlyMap<string, string> = new Map(
  [
    ...inventorySource
      .slice(inventorySource.indexOf("| Task | `tutorial.taskN.title`"))
      .matchAll(/^\| (\d+) +\| (.+?) +\| /gm),
  ].map(([, number = "", title = ""]) => [`tutorial.task${number}.title`, title]),
);

/** Where _How this file is anchored_ begins, and where the section after it does. */
const ANCHOR_START = inventorySource.indexOf("\n## How this file is anchored\n");
const ANCHOR_END = inventorySource.indexOf("\n## ", ANCHOR_START + 1);

/** Every pin in the document, the notation's own two spellings aside. */
const PINS = [...inventorySource.matchAll(LINE_PIN)].filter((match) => match[0] !== PIN_NOTATION);

/**
 * The 1-based line a character offset falls on, so a failure names a line.
 *
 * @param offset - An index into the document.
 * @returns Its line number.
 */
function lineOf(offset: number): number {
  return inventorySource.slice(0, offset).split("\n").length;
}

/**
 * A number the document prints in prose, and the pattern that finds it.
 *
 * The document's own statement of check 3 covers the table in _Where the
 * strings are_ and nothing else, which would leave three of the four places it
 * prints the catalogue size free to rot — and a wrong total is the specific
 * failure that prompted the rebuild. Each pattern has to match exactly once: a
 * reword that moves the number is a failure here, not a silent pass, because a
 * pattern matching nothing is a check that has stopped checking.
 */
interface PrintedCount {
  /** What the number is, for the failure message. */
  readonly what: string;
  /** A pattern whose first group is the number, matching exactly one place. */
  readonly pattern: RegExp;
  /** What the number has to be. */
  readonly expected: number;
}

/** Every count in the document's prose that the catalogue decides. */
const PRINTED_COUNTS: readonly PrintedCount[] = [
  {
    what: "the catalogue size, in _Where the strings are_",
    pattern: /The catalogue holds \*\*(\d+) keys\*\*/g,
    expected: KEYS.length,
  },
  {
    what: "the catalogue size, beside the `grep -c` that produced it",
    pattern: /src\/i18n\/en\.ts +# (\d+)/g,
    expected: KEYS.length,
  },
  {
    what: "the catalogue size, in the note on `game.seed.newDraw`",
    pattern: /a (\d+)-key file/g,
    expected: KEYS.length,
  },
  {
    what: "the learning track's per-task keys, where the panel is described",
    pattern: /— (\d+) in all/g,
    expected: TASK_KEYS.size,
  },
  {
    what: "the learning track's per-task keys, in _Where the strings are_",
    pattern: /reads the (\d+)\s+`tutorial\.task\*` messages/g,
    expected: TASK_KEYS.size,
  },
  {
    what: "the learning track's per-task keys, in check 2",
    pattern: /except the (\d+) `tutorial\.taskN\.\*`/g,
    expected: TASK_KEYS.size,
  },
];

describe("the message keys the inventory names", () => {
  it("names no key the catalogue does not have", () => {
    const unknown = KEY_SHAPED_SPANS.filter(
      (span) => !isGroupWildcard(span) && !isTaskShape(span) && !KEY_SET.has(span),
    );
    expect(unknown, "backticked in docs/i18n-inventory.md, absent from EN_MESSAGES").toEqual([]);
  });

  it("uses no group wildcard the catalogue has nothing under", () => {
    const empty = KEY_SHAPED_SPANS.filter(
      (span) =>
        isGroupWildcard(span) &&
        !isTaskShape(span) &&
        !KEYS.some((key) => key.startsWith(span.slice(0, -1))),
    );
    expect(empty, "wildcards in docs/i18n-inventory.md matching no key at all").toEqual([]);
  });

  it("names every key in the catalogue, or covers it by shape", () => {
    const unlisted = KEYS.filter((key) => !SPAN_SET.has(key) && !TASK_KEYS.has(key));
    expect(unlisted, "in EN_MESSAGES, with no row in docs/i18n-inventory.md").toEqual([]);
  });

  it("covers the learning track by a shape that expands to real keys", () => {
    const notReal = [...TASK_KEYS].filter((key) => !KEY_SET.has(key));
    expect(notReal, "the shape docs/i18n-inventory.md covers the track with").toEqual([]);
  });

  it("spells out every per-task suffix the shape stands for", () => {
    const unnamed = TASK_SUFFIXES.filter(
      (suffix) => !SPAN_SET.has(`tutorial.taskN.${suffix}`) && !SPAN_SET.has(`.${suffix}`),
    );
    expect(unnamed, "exempted from the naming check, but not named in the document").toEqual([]);
  });
});

describe("the counts the inventory prints", () => {
  it("gives every prefix the number of keys the catalogue has under it", () => {
    const section = inventorySource.slice(
      inventorySource.indexOf("\n## Where the strings are\n"),
      inventorySource.indexOf("\n## The strings\n"),
    );
    const printed = new Map(
      [...section.matchAll(/^\| `([a-z]+)\.\*` +\| (\d+) +\|/gm)].map(
        ([, prefix = "", count = ""]) => [prefix, Number(count)],
      ),
    );
    const actual = new Map(
      [...PREFIXES].map((prefix) => [
        prefix,
        KEYS.filter((key) => prefixOf(key) === prefix).length,
      ]),
    );
    expect(printed, "the Keys column of _Where the strings are_").toEqual(actual);
  });

  it("adds its prefixes up to the total it prints", () => {
    const total = /^\| \*\*Total\*\* +\| \*\*(\d+)\*\* +\|/m.exec(inventorySource);
    expect(total, "the Total row of _Where the strings are_").not.toBeNull();
    expect(Number(total?.[1])).toBe(KEYS.length);
  });

  it("prints the same number in prose as it derives from the catalogue", () => {
    for (const { what, pattern, expected } of PRINTED_COUNTS) {
      const found = [...inventorySource.matchAll(pattern)];
      expect(found.length, `${what}: expected one place printing it`).toBe(1);
      expect(Number(found[0]?.[1]), what).toBe(expected);
    }
  });
});

describe("the files the inventory points at", () => {
  it("names no `src/` path the tree does not have", () => {
    const missing = CODE_SPANS.filter(
      (span) => span.startsWith("src/") && !NON_PATHS.has(span) && !existsSync(join(ROOT, span)),
    );
    expect([...new Set(missing)], "backticked in docs/i18n-inventory.md, absent from disk").toEqual(
      [],
    );
  });

  it("still means every `src/` token it excuses from that", () => {
    for (const [span, what] of NON_PATHS) {
      expect(SPAN_SET.has(span), `${span} — ${what} — is no longer in the document`).toBe(true);
      expect(
        existsSync(join(ROOT, span)),
        `${span} is a real path now, so it needs no excuse`,
      ).toBe(false);
    }
  });
});

describe("the tutorial titles the inventory quotes", () => {
  it("quotes each one as the catalogue words it", () => {
    const catalogue: Readonly<Record<string, unknown>> = EN_MESSAGES;
    const wrong = [...QUOTED_TITLES]
      .filter(([key, quoted]) => catalogue[key] !== quoted)
      .map(([key, quoted]) => `${key}: the table says "${quoted}"`);
    expect(wrong, "quoted in docs/i18n-inventory.md, worded otherwise in en.ts").toEqual([]);
  });

  it("gives every task in the catalogue a row", () => {
    // The other direction, and the one that matters when the track grows: a
    // ninth task's title would otherwise be absent from the table rather than
    // wrong in it, and a check that only walks the rows cannot see a row that
    // was never written.
    const missing = KEYS.filter(
      (key) => /^tutorial\.task\d+\.title$/.test(key) && !QUOTED_TITLES.has(key),
    );
    expect(missing, "in EN_MESSAGES, with no row in the learning track's table").toEqual([]);
  });
});

describe("the line pins the inventory forbids", () => {
  it("carries no pin below the section that explains why it has none", () => {
    const below = PINS.filter((match) => match.index > ANCHOR_END).map(
      (match) => `${match[0]} on line ${String(lineOf(match.index))}`,
    );
    expect(below, "line pins below _How this file is anchored_").toEqual([]);
  });

  it("keeps the two rotted pins that show what the rule prevents", () => {
    expect(
      PINS.map((match) => match[0]),
      "the examples in _How this file is anchored_, which are meant to stay rotted",
    ).toEqual(["app.ts:207", "completions.ts:148"]);
    for (const match of PINS) {
      expect(match.index > ANCHOR_START, `${match[0]} left the section`).toBe(true);
    }
  });
});
