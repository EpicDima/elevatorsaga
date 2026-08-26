/**
 * Checks `docs/i18n-inventory.md` against the catalog and the tree it
 * describes: every key it names is real, every real key is named or covered
 * by shape, its counts match the catalog, and its paths and titles are
 * current. Imported with `?raw` so Vitest reruns this file whenever the
 * document changes.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import inventorySource from "../../docs/i18n-inventory.md?raw";
import { tutorialLevels } from "../game/tutorial.ts";
import { EN_DOCS_MESSAGES } from "./docs-en.ts";
import { EN_MESSAGES } from "./en.ts";

/** The repository root, from this file's own location. */
const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** Every key the reference locale defines, the game's messages then the pages'. */
const KEYS: readonly string[] = [...Object.keys(EN_MESSAGES), ...Object.keys(EN_DOCS_MESSAGES)];

/** The same keys, for membership tests. */
const KEY_SET: ReadonlySet<string> = new Set(KEYS);

/** A key's first dotted segment. */
function prefixOf(key: string): string {
  const dot = key.indexOf(".");
  return dot === -1 ? key : key.slice(0, dot);
}

/** The first segments the catalog uses: `docs`, `page`, `game`, … */
const PREFIXES: ReadonlySet<string> = new Set(KEYS.map(prefixOf));

/**
 * The content of every code span and fenced block in the document. A run of
 * backticks opens a span and the next run of the same length closes it, per
 * CommonMark, so ``t(`…`)`` reads as one span rather than two broken ones.
 */
const CODE_SPANS: readonly string[] = [...inventorySource.matchAll(/(`+)([\s\S]*?)\1(?!`)/g)].map(
  (match) => match[2] ?? "",
);

/** The same, for membership tests. */
const SPAN_SET: ReadonlySet<string> = new Set(CODE_SPANS);

/** Dotted, alphanumeric segments, `*` allowed: what every message key looks like. */
const KEY_SHAPE = /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9*]+)+$/;

/**
 * The spans the document offers as message keys: dotted, with a first
 * segment that is one of the catalog's prefixes. That requirement keeps
 * `documentation.ru.html`, `elevator.goToFloor` and `package.json` out.
 */
const KEY_SHAPED_SPANS: readonly string[] = [
  ...new Set(CODE_SPANS.filter((span) => KEY_SHAPE.test(span) && PREFIXES.has(prefixOf(span)))),
];

/** A span standing for a group of keys rather than for one: `docs.*`. */
function isGroupWildcard(span: string): boolean {
  return span.endsWith(".*");
}

/** A span standing for the learning track's per-level keys: `tutorial.levelN.goal`. */
function isLevelShape(span: string): boolean {
  return /^tutorial\.level(?:N|\*)(?:\.|$)/.test(span);
}

/**
 * The suffixes the document says every level owns, spelled as it spells them:
 * `tutorial.levelN.hint1.html` in full, `.hint2.html` abbreviated. Spelled out
 * here so the exemption below covers exactly these keys and no others.
 */
const LEVEL_SUFFIXES = [
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
 * The keys the document covers by shape instead of by row. Built from
 * `tutorialLevels`, so the exemption is exactly as wide as the track really
 * is; a ninth level would be caught instead by the count check below.
 */
const LEVEL_KEYS: ReadonlySet<string> = new Set(
  tutorialLevels.flatMap((_, index) =>
    LEVEL_SUFFIXES.map((suffix) => `tutorial.level${String(index + 1)}.${suffix}`),
  ),
);

/**
 * `src/` spans that are deliberately not paths, with what each one is.
 * Handled by name, not by loosening the path check, so a reason that stops
 * applying shows up as a failing test rather than a rule quietly covering less.
 */
const NON_PATHS: ReadonlyMap<string, string> = new Map([
  ["src/app/app.ts:207", "the first rotted pin _How this file is anchored_ exhibits"],
  ["src/ui/completions.ts:148", "the second, the one that rotted onto a plausible wrong line"],
  ["src/i18n/<code>.ts", "the placeholder in _Adding a language_, `<code>` being the locale"],
  ["src/i18n/docs-<code>.ts", "the same placeholder, for that language's reference page"],
  ["src/…", "the ellipsis in check 4's own wording"],
  [
    "src/ui/presenters.ts",
    "named twice as history — Phase 12.4 folded it into src/pages/game/index.ts",
  ],
]);

/**
 * A `file.ts:123` reference, which is the notation this document bans. The
 * extension list is closed on purpose: `docs.play.start.html` followed by a
 * colon and a digit would otherwise read as a pin.
 */
const LINE_PIN = /[\w.-]+\.(?:ts|tsx|js|css|html|json|md|txt):\d+/g;

/** The name of the notation itself, exempted from the ban; `file.ts:124` would not be. */
const PIN_NOTATION = "file.ts:123";

/**
 * The learning track's table of titles, as level number against quoted title.
 * Unlike the document's other prose columns, each title is a whole
 * `tutorial.levelN.title` copied across rather than abridged, so it can be
 * compared with the catalog by equality.
 */
const QUOTED_TITLES: ReadonlyMap<string, string> = new Map(
  [
    ...inventorySource
      .slice(inventorySource.indexOf("| Level | `tutorial.levelN.title`"))
      .matchAll(/^\| (\d+) +\| (.+?) +\| /gm),
  ].map(([, number = "", title = ""]) => [`tutorial.level${number}.title`, title]),
);

/** Where _How this file is anchored_ begins, and where the section after it does. */
const ANCHOR_START = inventorySource.indexOf("\n## How this file is anchored\n");
const ANCHOR_END = inventorySource.indexOf("\n## ", ANCHOR_START + 1);

/** Every pin in the document, the notation's own two spellings aside. */
const PINS = [...inventorySource.matchAll(LINE_PIN)].filter((match) => match[0] !== PIN_NOTATION);

/** The 1-based line a character offset falls on, so a failure names a line. */
function lineOf(offset: number): number {
  return inventorySource.slice(0, offset).split("\n").length;
}

/**
 * A number the document prints in prose, and the pattern that finds it. Each
 * pattern must match exactly once, so a reword that moves the number fails
 * here rather than silently passing.
 */
interface PrintedCount {
  /** What the number is, for the failure message. */
  readonly what: string;
  /** A pattern whose first group is the number, matching exactly one place. */
  readonly pattern: RegExp;
  /** What the number has to be. */
  readonly expected: number;
}

/** Every count in the document's prose that the catalog decides. */
const PRINTED_COUNTS: readonly PrintedCount[] = [
  {
    what: "the catalog size, in _Where the strings are_",
    pattern: /The catalog holds \*\*(\d+) keys\*\*/g,
    expected: KEYS.length,
  },
  {
    what: "the catalog size, beside the `grep` that produced it",
    pattern: /\| wc -l +# (\d+)/g,
    expected: KEYS.length,
  },
  {
    what: "the learning track's per-level keys, where the panel is described",
    pattern: /— (\d+) in all/g,
    expected: LEVEL_KEYS.size,
  },
  {
    what: "the learning track's per-level keys, in _Where the strings are_",
    pattern: /reads the (\d+)\s+`tutorial\.level\*` messages/g,
    expected: LEVEL_KEYS.size,
  },
  {
    what: "the learning track's per-level keys, in check 2",
    pattern: /except the (\d+) `tutorial\.levelN\.\*`/g,
    expected: LEVEL_KEYS.size,
  },
];

describe("the message keys the inventory names", () => {
  it("names no key the catalog does not have", () => {
    const unknown = KEY_SHAPED_SPANS.filter(
      (span) => !isGroupWildcard(span) && !isLevelShape(span) && !KEY_SET.has(span),
    );
    expect(unknown, "backticked in docs/i18n-inventory.md, absent from the catalog").toEqual([]);
  });

  it("uses no group wildcard the catalog has nothing under", () => {
    const empty = KEY_SHAPED_SPANS.filter(
      (span) =>
        isGroupWildcard(span) &&
        !isLevelShape(span) &&
        !KEYS.some((key) => key.startsWith(span.slice(0, -1))),
    );
    expect(empty, "wildcards in docs/i18n-inventory.md matching no key at all").toEqual([]);
  });

  it("names every key in the catalog, or covers it by shape", () => {
    const unlisted = KEYS.filter((key) => !SPAN_SET.has(key) && !LEVEL_KEYS.has(key));
    expect(unlisted, "in the catalog, with no row in docs/i18n-inventory.md").toEqual([]);
  });

  it("covers the learning track by a shape that expands to real keys", () => {
    const notReal = [...LEVEL_KEYS].filter((key) => !KEY_SET.has(key));
    expect(notReal, "the shape docs/i18n-inventory.md covers the track with").toEqual([]);
  });

  it("spells out every per-level suffix the shape stands for", () => {
    const unnamed = LEVEL_SUFFIXES.filter(
      (suffix) => !SPAN_SET.has(`tutorial.levelN.${suffix}`) && !SPAN_SET.has(`.${suffix}`),
    );
    expect(unnamed, "exempted from the naming check, but not named in the document").toEqual([]);
  });
});

describe("the counts the inventory prints", () => {
  it("gives every prefix the number of keys the catalog has under it", () => {
    const section = inventorySource.slice(
      inventorySource.indexOf("\n## Where the strings are\n"),
      inventorySource.indexOf("\n## The strings\n"),
    );
    const printed = new Map(
      [...section.matchAll(/^\| `([a-z][a-z0-9]*)\.\*` +\| (\d+) +\|/gm)].map(
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

  it("prints the same number in prose as it derives from the catalog", () => {
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
  it("quotes each one as the catalog words it", () => {
    const catalog: Readonly<Record<string, unknown>> = EN_MESSAGES;
    const wrong = [...QUOTED_TITLES]
      .filter(([key, quoted]) => catalog[key] !== quoted)
      .map(([key, quoted]) => `${key}: the table says "${quoted}"`);
    expect(wrong, "quoted in docs/i18n-inventory.md, worded otherwise in en.ts").toEqual([]);
  });

  it("gives every level in the catalog a row", () => {
    // Catches the row a growing track never wrote, not just one worded wrong.
    const missing = KEYS.filter(
      (key) => /^tutorial\.level\d+\.title$/.test(key) && !QUOTED_TITLES.has(key),
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
