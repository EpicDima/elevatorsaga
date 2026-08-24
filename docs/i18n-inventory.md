# Localization inventory

Every string the game shows a player, the key it has in `src/i18n/`, and what reads that key.
Part map of the catalog, part record of the decisions the wiring took and the reasons behind
them.

## How this file is anchored

**There are no `file.ts:123` pins here, on purpose.** The version this replaces, `a5010f2`,
printed 237 of them, 226 of them distinct, and they had rotted wholesale rather than at the
edges. Of the 226, 224 name a path the tree still has, and 95 of those 224 now point at a
different line than they did when they were written:

```sh
git show a5010f2:docs/i18n-inventory.md |
  grep -oE '(src/[A-Za-z0-9_./-]+|index|documentation)\.(ts|html):[0-9]+' | sort -u |
  while IFS=: read -r file line; do
    [ "$(git show "a5010f2:$file" | sed -n "${line}p")" = \
      "$(git show "HEAD:$file" | sed -n "${line}p")" ] && echo same || echo moved
  done | sort | uniq -c                                          # 465 moved, 129 same
```

Two of the 95 show the range. `src/app/app.ts:207` was the `World raised code error` console
line and is now the `export class App` declaration: wrong in a way any reader would notice at a
glance. `src/ui/completions.ts:148` was the `info` prose for `maxPassengerCount` and is now the
`info` for `on` — the same field, in the same table of completions, describing a different API
member. The second is the failure mode that matters, because it lands somewhere plausible and so
nobody checks it, and the only way to keep 237 pins true is to re-pin the file after every commit
that inserts a line anywhere. So a reference here is a file name plus something that can be
grepped: a message key, an exported symbol, a CSS selector. `docs/fork-survey.md` was converted
to the same convention first, after the same kind of failure.

**Counts come with the command that produced them.** Where this file says how many of anything
there are, the command is next to the number, so the next reader re-derives it in a second
instead of trusting a figure whose age they cannot tell.

**What is machine-checked, and what is not.** The catalogs check each other, and several
tests hold the catalog against what draws from it — see _What guards what_ at the end. One of
them now reads this file: `src/i18n/inventory.test.ts` holds the keys it names, the keys it
omits, the counts it prints and the files it points at against the English catalogs — both of
them, `EN_MESSAGES` and `EN_DOCS_MESSAGES` — and against the tree. What
that cannot read is the prose — the English column, the Notes, and every claim about which
module calls what — so a row can still be right about its key and wrong about everything beside
it.

Everything here was re-measured against the tree on **18 August 2026**.

## The module

| File                     | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/i18n/locale.ts`     | `Locale`, `LOCALES`, `DEFAULT_LOCALE`, `LOCALE_NAMES`, `isLocale`, `htmlLang`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/i18n/format.ts`     | `Intl` wrappers: `quantity`, `decimal`, `exact`, `seconds`, `formatNumber`, `formatValue`, `formatList`, `selectPlural`, `interpolate`, `PLURAL_CATEGORIES`, and the types `Quantity`, `ParamValue`, `Countable`, `PluralCategory<L>`, `PluralForms<L>`                                                                                                                                                                                                                                                                                       |
| `src/i18n/catalog.ts`    | `MessageKey`, `MessageCatalog<L>`, `MessageParams<K>`, `MessageArgs<K>`, `translate`                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/i18n/en.ts`         | `EN_MESSAGES` — the reference locale, everything the game itself says                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/i18n/ru.ts`         | `RU_MESSAGES` — the Russian catalog, with its glossary and its translation rules at the top                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/i18n/docs-en.ts`    | `EN_DOCS_MESSAGES`, `DocsMessageKey`, `DocsCatalog` — what the reference pages say, in English. Apart from `en.ts` because no bundle imports it: the pages are static files, so a `docs.*` key in `en.ts` was prose every player downloaded and no player could be shown                                                                                                                                                                                                                                                                      |
| `src/i18n/docs-ru.ts`    | `RU_DOCS_MESSAGES` — the same pages in Russian, typed as `DocsCatalog` so the pair stays in step the way `en.ts` and `ru.ts` do                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/i18n/detect.ts`     | `resolveLocale`, `browserLocaleSources`, `localeFromQuery`, `readStoredLocale`, `storeLocale`, `localeFromLanguages`, `LOCALE_QUERY_KEY`, `LOCALE_STORAGE_KEY`, `LocaleSources`                                                                                                                                                                                                                                                                                                                                                               |
| `src/i18n/index.ts`      | `t`, `translateIn`, `getLocale`, `setLocale`, `loadLocale`, `isLocaleLoaded`, `format`, `formatList`, `CATALOG_LOADERS`, and a re-export of most of the above. Four of those exports do not come through: `RU_MESSAGES`, deliberately, since a re-export is a static import; `interpolate` and `MessageParams`, which nothing outside `catalog.ts` uses; and `format.ts`'s `formatList`, because the `formatList` here is a different function — a wrapper that supplies the active locale, importing the other under the name `formatListIn` |
| `src/i18n/test-setup.ts` | No exports. Vitest's one setup file, named as `setupFiles` in `vite.config.ts`: it awaits every catalog before a test file's first line, because catalogs are fetched rather than bundled and a dozen test files say `setLocale("ru")` and assert about Russian next                                                                                                                                                                                                                                                                          |

Calling it looks like this:

```ts
import { format, seconds, setLocale, t } from "./i18n/index.ts";

t("game.button.start"); // "Start" / "Запустить"
t("game.elevator.label", { number: 3 }); // "Elevator 3" / "Лифт 3"
t("level.people.html", { count: 5 }); // 5 people / 5 пассажиров
format(seconds(60)); // "60s" / "60 с"
setLocale("ru"); // everything drawn after this renders in Russian
```

The parameters are named and typed per key: `t("game.elevator.label")` with no arguments, or
with `{ floor: 3 }` instead of `{ number: 3 }`, does not compile. Counts go through
`Intl.PluralRules`, which is why Russian gets four forms where English gets two —
`level.sandbox.spawnRate.html` renders 1 пассажир, 2 пассажира, 5 пассажиров, 1,5 пассажира
— and numbers go through `Intl.NumberFormat`, which is why Russian gets `1,5` and a
non-breaking space before a unit.

The Russian counted phrases are not always in the dictionary form, and `src/i18n/ru.ts` says why
at length under _Numerals_: they have to be grammatical in the sentence they are built into.
After «Перевезите» the noun is accusative, so `level.people.html` reads 1 пассажира rather
than the nominative 1 пассажир.

## How to read the tables

- **Key** — what to pass to `t`, and the only address a row has. Where the message is used is
  the heading it sits under; to find the call site, grep for the key.
- **English** — the reference wording, shortened to fit: whitespace collapsed to one line, long
  values cut and marked `…`, markup dropped unless the row is about the markup, and a `.code`
  block reduced to as much as makes it recognizable. Where a message has plural forms this is
  the `other` form. `src/i18n/en.ts` is the authority, not this column — nothing here is quotable
  as the message.
- **Notes** — plural categories, the parameters the message takes, and anything about the call
  site that whoever edits the message has to respect.

Key names carry two suffixes that mean something:

- `.html` — the value is trusted markup, for `innerHTML` or a `raw()` interpolation. Everything
  in one comes from this repository; nothing a player wrote is ever interpolated into one. Every
  other key is plain text for `textContent`, an attribute or `confirm()`.
- `.code` — the value is example code. Only its `//` comments are translated; the code itself is
  byte-identical in every locale, and `src/i18n/catalog.test.ts` enforces that rather than
  trusting it.

## Where the strings are

The catalog holds **492 keys** in two locales, each locale spread over two files. `src/i18n/en.ts`
is the reference — its text is the English wording, extracted verbatim — and `src/i18n/ru.ts` is
the Russian translation; `src/i18n/docs-en.ts` and `src/i18n/docs-ru.ts` are the same thing for the
reference pages, kept in files of their own so that the bundle cannot reach them. The types make
English the shape everything else is measured against: a Russian catalog missing a key, carrying a
key English does not have, or giving a plural message the wrong number of forms is a compile
error, not a runtime surprise.

```sh
grep -hoE '^  "[^"]+"' src/i18n/en.ts src/i18n/docs-en.ts | wc -l       # 492
grep -hoE '^  "[^"]+"' src/i18n/en.ts src/i18n/docs-en.ts | tr -d '"' | cut -d. -f1 | sort | uniq -c | sort -rn
```

| Prefix         | Keys    | What reads them                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs.*`       | 93      | one of them, `docs.basics.example.code`, by `src/ui/completions.ts`, and it is the one that stays in `src/i18n/en.ts` for that reason; the other 92 by nothing, and they live in `src/i18n/docs-en.ts` and `src/i18n/docs-ru.ts`, which only `src/page.test.ts` imports                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `tutorial.*`   | 75      | `src/game/tutorial.ts` (the 16 programs), `src/widgets/tutorial-panel/ui/tutorial-panel.ts` (the 48 prose keys and the panel's own five), `src/pages/game/index.ts` (the four of the finish overlay), `src/widgets/level-switcher/ui/level-switcher.ts` (the block caption); `tutorial.bar.title.html` is read by none of them                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `skyscraper.*` | 14      | `src/game/skyscraper.ts`, whose getters read all fourteen; the card four of them end up on is `src/widgets/level-briefing/ui/level-briefing.ts`, which is handed the finished strings and so names no key itself. Ten of the fourteen are starting programs, one per level                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `game.*`       | 204     | `src/ui/templates.ts` (18), `src/pages/game/index.ts` (11 + 5), `src/widgets/goal-bar/ui/goal-bar.ts` (8), `src/entities/level-tier/ui/requirement-text.ts` (14), `src/entities/level-tier/ui/tier-hint.ts` (3), `src/widgets/verdict-toast/ui/verdict-toast.ts` (2), `src/widgets/level-switcher/ui/level-switcher.ts` (10), `src/widgets/building-stage/lib/hover-card-text.ts` (15), `src/widgets/stats-panel/ui/stats-panel.ts` (3), `src/widgets/editor-pane/ui/editor-pane.ts` (3), `src/features/switch-theme` (4), `src/features/switch-layout` (5), `src/widgets/app-bar/ui/settings-menu.ts` (7), `src/main.ts` (3, the workspace pane/splitter labels); the two speed labels are written by both of the first two; the other 91, under `game.hotkeys.*`, `game.docs.*` and `game.apiRef.*`, by none of them yet — see below |
| `page.*`       | 26      | `index.html`, through `data-i18n` and `data-i18n-attr`; `page.noscript` excepted, see below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `completion.*` | 37      | `src/ui/completions.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `level.*`      | 14      | `src/game/levels.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `fitness.*`    | 11      | `src/app/fitness.ts`, `src/game/fitness.ts`, `src/main.ts`, `src/cli/bench.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `error.*`      | 10      | `src/game/elevator-interface.ts`, `src/pages/game/index.ts`, `src/game/user-code.ts`, `src/game/movable.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `editor.*`     | 8       | `src/main.ts`, `src/pages/game/index.ts`, `src/ui/editor.ts`, `src/ui/default-code.ts`, `src/widgets/editor-pane/ui/editor-pane.ts`, `src/features/manage-code-slots/ui/code-slots.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Total**      | **492** |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Which keys nothing reads:

```sh
grep -hoE '^  "[^"]+"' src/i18n/en.ts src/i18n/docs-en.ts | tr -d '"' | while read -r key; do
  grep -rqF --exclude=en.ts --exclude=ru.ts --exclude=docs-en.ts --exclude=docs-ru.ts \
    --exclude='*.test.ts' -e "$key" index.html src || echo "$key"
done
```

The four catalog files are excluded by name rather than by `--exclude='docs-*.ts'`, which would
also drop `src/features/docs-reference/ui/docs-modal.ts` and hand back 24 `game.docs.*` keys as
unread.

It lists **93 keys**: 85 `docs.*`, and eight the catalog carries that nothing on screen asks for
— six tooltips under `page.stats.*`, `game.level.title.html` and `tutorial.bar.title.html`.
Two things the grep cannot see, both of which make it optimistic rather than pessimistic: it
matches text rather than calls, so a key that is a prefix of another key counts as read whenever
the longer one is, and a key named only in a comment counts as read too. The prefix case costs
nothing today — the same grep with each key required to end where the key ends lists the same 93
— and the comment case costs two. `page.noscript` is one: nothing renders it, and `index.html`
names it in a comment saying so. `docs.play.statistics.html` is the other: it is a paragraph of
the reference page like its neighbors, and `src/game/world.ts` names it twice in prose
explaining what the statistics panel measures. So the true figure is 95, of which 86 are
`docs.*` — every one the pages hold, bar the skeleton the popup borrows. The grep also needs
`src/widgets/tutorial-panel/ui/tutorial-panel.ts` and `src/game/tutorial.ts` to be in the tree, since between them that
is what reads the 64 `tutorial.level*` messages: the panel each level's prose, the level table each
level's two programs.

**`page.noscript` cannot be wired, and the comment in `index.html` is the reason.** A browser
running this code parses the children of `<noscript>` as text rather than as elements, so in the
only situation where the message could be replaced there is nothing there to replace; and a
browser with scripting off has nothing running to replace it with. The key is kept for the day
the build renders the shell per language.
`src/ui/localize-page.test.ts`, in "leaves the noscript message in English, where it cannot be
reached", pins that: it parses the page with `DOMParser`, which _does_ see the paragraph, and
requires `localizePage` to leave it alone even in Russian.

**The 86 `docs.*` keys have no call site because the reference page answers for itself.**
`documentation.html` and `documentation.ru.html` are two static files rather than one document
translated at run time. That duplication is deliberate and no longer silent — see _Known
overlap_ at the end, and `src/page.test.ts`, which holds the two pages and the two catalogs in
step.

They are also the reason `src/i18n/docs-en.ts` and `src/i18n/docs-ru.ts` exist. `en.ts` is
imported statically, so every key in it is bytes the player downloads before the first level
draws; 86 keys of help text that only a static file ever shows are bytes nobody can be shown.
Moving them into modules that nothing but `src/page.test.ts` imports takes them out of the build
by structure rather than by hoping the bundler proves them dead.

## The strings

### `index.html` — the page shell, 26 `page.*` keys

The shell ships its English in the markup and names the message beside it: `data-i18n` for an
element's words, `data-i18n-attr="attribute:key"` for its attributes. `src/ui/localize-page.ts`
walks the document and rewrites both, at start-up and again after every language change.

| Key                             | English                                                                                                        | Notes                                                                                                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page.title`                    | Elevator Saga - the elevator programming game                                                                  | twice: the `<title>`, and the `og:title` meta                                                                                                                         |
| `page.description`              | Elevator Saga is a programming game: write JavaScript to transport people efficiently.                         | twice: the `description` meta, and the `og:description` one                                                                                                           |
| `page.imageAlt`                 | Four elevators carrying people between six floors, with the JavaScript program driving them in the editor bel… | the `og:image:alt` meta                                                                                                                                               |
| `page.skipLink`                 | Skip to the code editor                                                                                        |                                                                                                                                                                       |
| `page.brand`                    | Elevator Saga                                                                                                  | the one `<h1>`, drawn as the app bar's brand name; see _What could not be keyed cleanly_                                                                              |
| `page.language.label`           | Language                                                                                                       | the `aria-label` of the picker's `<select>`; written by the settings popover with `t()`, not by an attribute; its options are `LOCALE_NAMES` and are never translated |
| `page.noscript`                 | Your browser does not appear to support JavaScript. This page contains a browser-based programming game imple… | the one key with no element, and it cannot have one: see _Where the strings are_                                                                                      |
| `page.world.label`              | Building                                                                                                       | an `aria-label`                                                                                                                                                       |
| `page.stats.label`              | Simulation statistics                                                                                          | an `aria-label`                                                                                                                                                       |
| `page.stats.transported`        | Transported                                                                                                    |                                                                                                                                                                       |
| `page.stats.elapsedTime`        | Elapsed time                                                                                                   |                                                                                                                                                                       |
| `page.stats.transportedPerSec`  | Transported/s                                                                                                  |                                                                                                                                                                       |
| `page.stats.avgWaitTime`        | Avg delivery time                                                                                              | the key names the `World` field, which is `avgWaitTime`; the label names what it measures, which is not a wait                                                        |
| `page.stats.avgPickupTime`      | Avg wait for a car                                                                                             | the first half of the row above it, and the only one of the four that is a wait: it stops when a car takes the passenger, so the ride is outside it                   |
| `page.stats.avgPickupTimeTitle` | The clock starts when a passenger appears and stops when a car takes them, and the row below it is the…        | a `title` attribute on the same cell as `page.stats.avgPickupTime`; text of `docs.play.statistics.html` word for word                                                 |
| `page.stats.avgRideTime`        | Avg ride time                                                                                                  | the other half: boarding to stepping out, the span the two delivery times above it do not name                                                                        |
| `page.stats.avgRideTimeTitle`   | The clock starts when a car takes a passenger and stops when they step out at their floor, so this and…        | a `title` attribute on the same cell as `page.stats.avgRideTime`; text of `docs.play.statistics.html` word for word                                                   |
| `page.stats.maxWaitTime`        | Max delivery time                                                                                              | likewise, and this is the figure the eight wait-limited levels are judged on                                                                                          |
| `page.stats.moves`              | Moves                                                                                                          |                                                                                                                                                                       |
| `page.stats.movesTitle`         | One move is counted each time a car crosses the halfway mark between one floor and the next                    | a `title` attribute on the same cell as `page.stats.moves`                                                                                                            |
| `page.stats.stops`              | Stops                                                                                                          | door openings rather than floors crossed, so a long trip is many of the row above and one of this one                                                                 |
| `page.stats.stopsTitle`         | One stop is counted each time a car comes to rest at a floor and opens its doors, so a car sent to the…        | a `title` attribute on the same cell as `page.stats.stops`; text of `docs.play.statistics.html` word for word                                                         |
| `page.stats.peoplePerStop`      | People per stop                                                                                                | boardings and alightings together, over the stops above; both ends of a journey count, so it reads higher than the trade's figure of the same name                    |
| `page.stats.peoplePerStopTitle` | Everyone who got in or out, over the stops counted above, so opening the doors where nobody is waiting…        | a `title` attribute on the same cell as `page.stats.peoplePerStop`; text of `docs.play.statistics.html` word for word                                                 |
| `page.stats.avgLoad`            | Avg load                                                                                                       | how full the cars were, as a percentage; averaged over the moves the row above counts, so a car that never moved is absent rather than empty                          |
| `page.stats.avgLoadTitle`       | How full the cars were, averaged over the moves counted above, so a car standing still is not in the…          | a `title` attribute on the same cell as `page.stats.avgLoad`; text of `docs.play.statistics.html` word for word                                                       |

The shell links to the reference page nowhere. It used to: a `Learning track` link and a
`<nav>` of three, retargeted per language by a third attribute, `data-i18n-doc`. Those went with
the header they sat in — the help the game offers is now the docs dialog, and
`documentation.html` and `documentation.ru.html` are standalone pages the build still emits and
still translates key for key. Six `page.*` keys went with them.

### `documentation.html` — the reference page, 93 `docs.*` keys

One of these is read. The editor's skeleton completion inserts `docs.basics.example.code`, so
the program the popup offers and the program the help page walks through are the same bytes in
whichever language the reader is in; it is filed here rather than under `src/ui/completions.ts`
because this is where its wording is decided, and the popup borrows it. It is also why that one
key sits in `src/i18n/en.ts` while the other 86 sit in `src/i18n/docs-en.ts`. Those 86 have no
call site: their English is on screen in `documentation.html` and their Russian in
`documentation.ru.html`. `src/page.test.ts` holds every one of them to being the same text as
the passage it was lifted from, in both languages, and its "leaves no docs.\* message unchecked"
case makes sure no key escapes that comparison.

| Key                                                 | English                                                                                                         | Notes                                                                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `docs.page.title`                                   | Elevator Saga - help and API documentation                                                                      |                                                                                                                                    |
| `docs.page.description`                             | Help and API documentation for Elevator Saga.                                                                   |                                                                                                                                    |
| `docs.page.tagline`                                 | Help and API documentation                                                                                      |                                                                                                                                    |
| `docs.nav.label`                                    | Game                                                                                                            |                                                                                                                                    |
| `docs.nav.back`                                     | Back to the game                                                                                                |                                                                                                                                    |
| `docs.about.heading`                                | About the game                                                                                                  |                                                                                                                                    |
| `docs.about.p1.html`                                | This is a game of programming! Your task is to program the movement of elevators, by writing a program …        | markup                                                                                                                             |
| `docs.about.p2.html`                                | The goal is to transport people in an efficient manner. Depending on how well you do it, you can progre…        | markup                                                                                                                             |
| `docs.play.heading`                                 | How to play                                                                                                     |                                                                                                                                    |
| `docs.play.track.html`                              | If you have never written one of these programs before, start on the learning track …                           | markup; links into `index.html#level=tutorial-1`                                                                                   |
| `docs.play.start.html`                              | Enter your code in the input window below the game view, and press the Start button to run it …                 | markup; takes `{increase}`, `{decrease}` — the two icon names                                                                      |
| `docs.play.statistics.html`                         | Beside the building is a panel that keeps score while a run is going. Five of its rows need a word. …           | markup                                                                                                                             |
| `docs.play.shortcuts.html`                          | Inside the editor, Ctrl+Enter starts the level again with what you have written …                               | markup; `src/docs.ts` calls `labelModifierKeys` on the page this fills, which is what relabels its two `<kbd data-mod-key>`s       |
| `docs.play.debugging.html`                          | If your program contains an error, you can use the developer tools in your web browser to try and debug it. …   | markup                                                                                                                             |
| `docs.basics.heading`                               | Basics                                                                                                          |                                                                                                                                    |
| `docs.basics.declare.html`                          | Your code must declare an object containing at least two functions called init …                                | markup                                                                                                                             |
| `docs.basics.example.code`                          | { init: function(elevators, floors) { // Do stuff with the elevators and floors, which are both arrays of obj…  | code; only the comments are translated; the one `docs.*` key with a call site — `src/ui/completions.ts` inserts it as the skeleton |
| `docs.basics.called.html`                           | These functions will then be called by the game during the level. init …                                        | markup                                                                                                                             |
| `docs.basics.initPurpose.html`                      | Normally you will put most of your code in the init function, to set up ev…                                     | markup                                                                                                                             |
| `docs.basics.noLibraries.html`                      | The game used to load jQuery and lodash, so older solutions you find on the wiki often call …                   | markup                                                                                                                             |
| `docs.examples.heading`                             | Code examples                                                                                                   |                                                                                                                                    |
| `docs.examples.control.heading`                     | How to control an elevator                                                                                      |                                                                                                                                    |
| `docs.examples.goToFloor`                           | Tell the elevator to move to floor 1 after completing other tasks, if any. A request for the floor already at … |                                                                                                                                    |
| `docs.examples.currentFloor`                        | Calling currentFloor gets the floor number that the elevator currently is on. Note that this is a rounded numb… |                                                                                                                                    |
| `docs.examples.events.heading`                      | Listening for events                                                                                            |                                                                                                                                    |
| `docs.examples.events.intro.html`                   | It is possible to listen for events, like when stopping at a floor, or a button has been pressed. …             | markup                                                                                                                             |
| `docs.examples.idle`                                | Listen for the "idle" event issued by the elevator, when the task queue has been emptied and the elevator is d… |                                                                                                                                    |
| `docs.examples.floorButtonPressed`                  | Listen for the "floor_button_pressed" event, issued when a passenger pressed a button inside the elevator. Thi… |                                                                                                                                    |
| `docs.examples.upButtonPressed`                     | Listen for the "up_button_pressed" event, issued when a passenger pressed the up button on the floor they are … |                                                                                                                                    |
| `docs.examples.events.perElevator.html`             | Every elevator has its own events, so a handler registered on one elevator only ever hears that elevator: …     | markup; answers the fork survey's most-repeated complaint, that only the last elevator responds                                    |
| `docs.api.heading`                                  | API documentation                                                                                               |                                                                                                                                    |
| `docs.table.method`                                 | Method                                                                                                          |                                                                                                                                    |
| `docs.table.property`                               | Property                                                                                                        |                                                                                                                                    |
| `docs.table.event`                                  | Event                                                                                                           |                                                                                                                                    |
| `docs.table.type`                                   | Type                                                                                                            |                                                                                                                                    |
| `docs.table.explanation`                            | Explanation                                                                                                     |                                                                                                                                    |
| `docs.table.example`                                | Example                                                                                                         |                                                                                                                                    |
| `docs.api.events.heading`                           | Event methods                                                                                                   |                                                                                                                                    |
| `docs.api.events.intro`                             | Every elevator and every floor is an event emitter, and these are the methods it gives you. They all return th… |                                                                                                                                    |
| `docs.api.events.on`                                | Register a listener. Listeners run in the order they were registered, and the same function may be registered … |                                                                                                                                    |
| `docs.api.events.once`                              | Register a listener that runs at most once and is then removed. It is removed before it runs, so triggering th… |                                                                                                                                    |
| `docs.api.events.one.html`                          | The older name for once, and the one the original game gave you. Same beha…                                     | markup                                                                                                                             |
| `docs.api.events.off.html`                          | Remove listeners. With a function, removes just that function, however it was registered; without one, removes… | markup                                                                                                                             |
| `docs.api.events.off.example.code`                  | function goHome() { elevator.goToFloor(0); }                                                                    | code; only the comments are translated                                                                                             |
| `docs.api.events.offAll.html`                       | Remove every listener you registered, for every event, on that elevator or floor. The listeners the g…          | markup                                                                                                                             |
| `docs.api.events.outro.html`                        | You rarely need to remove listeners: the elevators and floors are thrown away when a level restarts, and you…   | markup                                                                                                                             |
| `docs.api.elevator.heading`                         | Elevator object                                                                                                 |                                                                                                                                    |
| `docs.api.elevator.goToFloor.html`                  | Queue the elevator to go to specified floor number. If you specify true as second argument, the elevator will … | markup; the popup borrows its first two sentences as `completion.elevator.goToFloor`                                               |
| `docs.api.elevator.goToFloor.example.code`          | elevator.goToFloor(3); // Do it after anything else -- queue: 3                                                 | code; only the comments are translated                                                                                             |
| `docs.api.elevator.stop`                            | Clear the destination queue and stop the elevator if it is moving. Note that you normally don't need to stop e… |                                                                                                                                    |
| `docs.api.elevator.currentFloor`                    | Gets the floor number that the elevator currently is on.                                                        |                                                                                                                                    |
| `docs.api.elevator.currentFloor.example.code`       | if(elevator.currentFloor() === 0) {                                                                             | code; only the comments are translated                                                                                             |
| `docs.api.elevator.goingUpIndicator`                | Gets or sets the going up indicator, which will affect passenger behavior when stopping at floors.              |                                                                                                                                    |
| `docs.api.elevator.goingDownIndicator`              | Gets or sets the going down indicator, which will affect passenger behavior when stopping at floors.            |                                                                                                                                    |
| `docs.api.elevator.maxPassengerCount`               | Gets the maximum number of passengers that can occupy the elevator at the same time.                            |                                                                                                                                    |
| `docs.api.elevator.maxPassengerCount.example.code`  | if(elevator.maxPassengerCount() > 5) {                                                                          | code; only the comments are translated                                                                                             |
| `docs.api.elevator.loadFactor`                      | Gets the load factor of the elevator. 0 means empty, 1 means full. Varies with passenger weights, which vary -… |                                                                                                                                    |
| `docs.api.elevator.loadFactor.example.code`         | if(elevator.loadFactor() < 0.4) {                                                                               | code; only the comments are translated                                                                                             |
| `docs.api.elevator.isFull`                          | Gets whether every spot in the elevator is taken. Use this rather than comparing loadFactor to 1 - passenger w… |                                                                                                                                    |
| `docs.api.elevator.isFull.example.code`             | if(!elevator.isFull()) {                                                                                        | code; only the comments are translated                                                                                             |
| `docs.api.elevator.isEmpty`                         | Gets whether the elevator is carrying nobody at all. Not the opposite of isFull - an elevator with one passeng… |                                                                                                                                    |
| `docs.api.elevator.isEmpty.example.code`            | if(elevator.isEmpty()) {                                                                                        | code; only the comments are translated                                                                                             |
| `docs.api.elevator.isApproachingFloor`              | Gets whether the elevator is moving toward the given floor and has not passed it yet. Only the direction of tr… |                                                                                                                                    |
| `docs.api.elevator.isApproachingFloor.example.code` | if(elevator.isApproachingFloor(2)) {                                                                            | code; only the comments are translated                                                                                             |
| `docs.api.elevator.destinationDirection`            | Gets the direction the elevator is currently going to move toward. Can be "up", "down" or "stopped".            |                                                                                                                                    |
| `docs.api.elevator.destinationQueue`                | The current destination queue, meaning the floor numbers the elevator is scheduled to go to. Can be modified a… |                                                                                                                                    |
| `docs.api.elevator.checkDestinationQueue`           | Checks the destination queue for any new destinations to go to. Note that you only need to call this if you mo… |                                                                                                                                    |
| `docs.api.elevator.getPressedFloors`                | Gets the currently pressed floor numbers as an array.                                                           |                                                                                                                                    |
| `docs.api.elevator.getPressedFloors.example.code`   | if(elevator.getPressedFloors().length > 0) {                                                                    | code; only the comments are translated                                                                                             |
| `docs.api.elevator.servedFloors`                    | Gets the floors this elevator serves, as an array in ascending order. In a zoned building an elevator only ca…  |                                                                                                                                    |
| `docs.api.elevator.servedFloors.example.code`       | if(elevator.servedFloors().includes(floorNum)) {                                                                | code; only the comments are translated                                                                                             |
| `docs.api.elevator.takeRequest`                     | Books this elevator for a journey somebody asked for, in a building where passengers announce a destination i…  |                                                                                                                                    |
| `docs.api.elevator.takeRequest.example.code`        | floor.on("destination_requested", function(destinationFloor, floor) {                                           | code; only the comments are translated                                                                                             |
| `docs.api.elevator.idle`                            | Triggered when the elevator has completed all its tasks and is not doing anything.                              |                                                                                                                                    |
| `docs.api.elevator.floorButtonPressed`              | Triggered when a passenger has pressed a button inside the elevator.                                            |                                                                                                                                    |
| `docs.api.elevator.floorButtonPressed.example.code` | elevator.on("floor_button_pressed", function(floorNum) {                                                        | code; only the comments are translated                                                                                             |
| `docs.api.elevator.passingFloor`                    | Triggered slightly before the elevator will pass a floor. A good time to decide whether to stop at that floor.… |                                                                                                                                    |
| `docs.api.elevator.stoppedAtFloor`                  | Triggered when the elevator has arrived at a floor.                                                             |                                                                                                                                    |
| `docs.api.elevator.stoppedAtFloor.example.code`     | elevator.on("stopped_at_floor", function(floorNum) {                                                            | code; only the comments are translated                                                                                             |
| `docs.api.floor.heading`                            | Floor object                                                                                                    |                                                                                                                                    |
| `docs.api.floor.floorNum`                           | Gets the floor number of the floor object.                                                                      |                                                                                                                                    |
| `docs.api.floor.pendingDestinations`                | Gets the journeys people on this floor have asked for and are still waiting on, as an array of {floorNum, wa…   |                                                                                                                                    |
| `docs.api.floor.pendingDestinations.example.code`   | floor.pendingDestinations().forEach(function(request) {                                                         | code; only the comments are translated                                                                                             |
| `docs.api.floor.upButtonPressed`                    | Triggered when someone has pressed the up button at a floor. Note that passengers will press the button again … |                                                                                                                                    |
| `docs.api.floor.upButtonPressed.example.code`       | floor.on("up_button_pressed", function(floor) {                                                                 | code; only the comments are translated                                                                                             |
| `docs.api.floor.downButtonPressed`                  | Triggered when someone has pressed the down button at a floor. Note that passengers will press the button agai… |                                                                                                                                    |
| `docs.api.floor.downButtonPressed.example.code`     | floor.on("down_button_pressed", function(floor) {                                                               | code; only the comments are translated                                                                                             |
| `docs.api.floor.hallButtonPressed`                  | Triggered when someone has pressed either call button at a floor. Note that passengers will press the button a… |                                                                                                                                    |
| `docs.api.floor.hallButtonPressed.example.code`     | floor.on("hall_button_pressed", function(direction, floor) {                                                    | code; only the comments are translated                                                                                             |
| `docs.api.floor.buttonStateChange.html`             | Triggered when either call button at a floor was lit or cleared. The handler is passed the state of both butto… | markup                                                                                                                             |
| `docs.api.floor.buttonStateChange.example.code`     | floor.on("buttonstate_change", function(buttonStates) {                                                         | code; only the comments are translated                                                                                             |
| `docs.api.floor.destinationRequested`               | Triggered when someone at a floor has asked to be taken to another floor, in a building whose passengers anno…  |                                                                                                                                    |
| `docs.api.floor.destinationRequested.example.code`  | floor.on("destination_requested", function(destinationFloor, floor) {                                           | code; only the comments are translated                                                                                             |

### The learning track — 75 `tutorial.*` keys

The track is the eight levels in `src/game/tutorial.ts`, with ids `tutorial-1` … `tutorial-8`.
Its prose is the largest single group of keys after the reference page, and it is the one group
whose messages were committed before anything read them — the prose _is_ the teaching here, so it
was written into both catalogs first and the panel built against it.

Each level owns eight keys, numbered by position: `tutorial.levelN.title`, `tutorial.levelN.goal`,
`tutorial.levelN.hint1.html`, `.hint2.html`, `.hint3.html`, `tutorial.levelN.explanation.html`,
`tutorial.levelN.startingCode.code` and `tutorial.levelN.solutionCode.code` — 64 in all.
`src/widgets/tutorial-panel/ui/tutorial-panel.ts` writes the six prose keys out as literals in
`TUTORIAL_LEVEL_MESSAGES` and says why in its header: a message key has to reach `t` as a string
literal, because the parameters a message takes are derived from the literal by `Placeholders<S>`
in `src/i18n/catalog.ts`. A key built as ``t(`tutorial.level${n}.title`)`` cannot be
type-checked, and casting one through would trade the whole point of the typed catalog for
brevity — a renamed message would then print its own key at a player instead of failing the
build. The table is typed `Record<TutorialLevelId, …>` and keyed by the level's id rather than by
its position, so that a ninth level inserted in the middle cannot slide one level's prose onto the
next level's building. `TutorialLevelId` is derived from the catalog's own `tutorial.levelN.title`
keys, which is what makes a ninth level's messages added to `src/i18n/en.ts` without a row here
stop the file compiling.

The other two keys are the level's two programs, and they are messages for the same reason
`editor.defaultCode.code` is one: the `//` comments in them are prose written to the player —
`// TODO: this building has two floors, and the elevator only visits one` is the whole of level
1's instruction, and it is read in the editor and again under the third hint. The JavaScript is
byte-identical in every locale and only the comments are translated. `tutorialLevels` in
`src/game/tutorial.ts` reads both through getters rather than fields, so that a program is
rendered when the editor or the panel asks for it rather than when the module is imported, which
is before a locale has been chosen; the keys are written out at each entry, since a key built
from the level's id could not be type-checked either. `tutorial.level8.solutionCode.code` repeats
level 7's program word for word — the graduation level asks for nothing new — and every level owning
the same eight keys is worth more than the saving; `src/game/tutorial.test.ts` holds the two
equal in every locale.

| Key                                 | English                                                                                                         | Notes                                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tutorial.levelN.startingCode.code` | { init: function(elevators, floors) { const elevator = elevators[0]; elevator.on("idle", function() { // TODO:… | code; only the comments are translated; the program the editor is filled with, and the one `src/game/tutorial-solutions.test.ts` proves cannot win |
| `tutorial.levelN.solutionCode.code` | { init: function(elevators, floors) { const elevator = elevators[0]; elevator.on("idle", function() { elevator… | code; only the comments are translated; the answer, shown under the third hint and replayed as the fixture that must win                           |

| Level | `tutorial.levelN.title`                  | What the goal asks for                                                                   |
| ----- | ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1     | The elevator that goes nowhere           | visit both floors and deliver 10 passengers within 60 seconds                            |
| 2     | The same loop, written by hand           | write the `idle` handler yourself; 15 passengers within 60 seconds                       |
| 3     | The buttons inside the car               | `floor_button_pressed`; 15 passengers within 60 seconds                                  |
| 4     | The queue nobody read                    | the missing `checkDestinationQueue`; 15 passengers within 60 seconds                     |
| 5     | The building grew                        | hall calls instead of a blind sweep; 15 passengers, nobody waiting over 37 seconds       |
| 6     | The elevator that lies to its passengers | the indicators; 15 passengers, nobody waiting over 28 seconds                            |
| 7     | The second elevator                      | `elevators.forEach`; 28 passengers within 60 seconds                                     |
| 8     | From memory                              | the whole program on an empty page; 15 passengers within 60 seconds — level 1's building |

The other eleven are the panel and the surfaces around it. There were eighteen. The lesson card
used to open on a row naming the track and counting the player's place in it, close on a footnote
counting the cleared levels again, and carry two buttons between them: one that copied the level's
program into the game's own editor — with a confirmation when there was something to overwrite, and
a live line reporting which way the write had gone — and one that left for the numbered levels. The
seven keys that went with them are not named here, since a key the catalog does not have has no
row to be right or wrong in; what they said, the app bar's level switcher already said, on the one
surface whose whole job is the level in front of the player.

| Key                                 | English                                                                                                 | Notes                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `tutorial.panel.label`              | Learning track                                                                                          | the caption over the level switcher's block of lessons, and nothing else; the name is what is left of a panel that used to open on it     |
| `tutorial.panel.hintSummary`        | Hint {number}                                                                                           | takes `{number}`; the `<summary>` of one of the three hint disclosures                                                                    |
| `tutorial.panel.explanationSummary` | Why this happens                                                                                        | the `<summary>` of the fourth disclosure                                                                                                  |
| `tutorial.solution.copy`            | Copy this program                                                                                       | the accessible name of the button beside the answer, in `src/widgets/tutorial-panel/ui/tutorial-panel.ts`'s `copySolution`                |
| `tutorial.solution.copied`          | Copied to your clipboard.                                                                               | `copySolution`'s `aria-live` line on a successful `navigator.clipboard.writeText`                                                         |
| `tutorial.solution.copyFailed`      | Your browser refused to copy it. Select the code above and copy it yourself.                            | the same line, when the write refuses or the API is missing                                                                               |
| `tutorial.bar.title.html`           | Tutorial level {number} of {count}: {description}                                                       | markup; takes `{number}`, `{count}`, `{description}`; the title of a level bar the level switcher replaced, and the one key nothing reads |
| `tutorial.finish.title`             | The track is finished                                                                                   | the overlay after the last level                                                                                                          |
| `tutorial.finish.message`           | Eight tutorial levels, and the last of them was level 1 of the game itself: the same three floors, the… |                                                                                                                                           |
| `tutorial.finish.nextLevel`         | Next tutorial level                                                                                     | not `game.feedback.next`, which says "Next level" — see the note below                                                                    |
| `tutorial.finish.toLevels`          | Go to level 1                                                                                           | the finish overlay's link out of the track; it carries no program, which is why it no longer says it does                                 |

`tutorial.finish.nextLevel` and `game.feedback.next` are separate keys even though both are "next X"
links in English. Two features sharing one key is a key neither can reword: the day the level
overlay wants different words, the track's overlay changes with it for no reason. The Russian of
`tutorial.finish.nextLevel` is «Следующий учебный уровень» and of `game.feedback.next` is «Следующий
уровень» — two different words for two different destinations.

### `src/game/skyscraper.ts` — 14 `skyscraper.*` keys

The Skyscraper block: levels built on how real lift systems are actually dispatched. One key per
level and no more, which is the whole difference from the learning track above — a lesson there owns
a goal, three hints, an explanation and a program measured to solve it, because it stages one
particular mistake; a level here hands over the building.

Two levels carry a `title` and a `briefing.html` on top of that program, and that is the rule
rather than an accident: a card belongs to the level where a mechanic is met for the first time,
which is `sky2` for traffic profiles and `sky8` for zoning. The card is the widest column on the
screen, and a block that opened one on every level would spend it restating what the level before
had already explained — so the levels after a card are the idea being asked for rather than
described, and their region collapses to leave the building the width. That is why `sky2`'s
paragraph ends by naming the evening peak and lunch traffic it does not itself play: it is the only
place levels 3 to 7 are introduced at all, exactly as `sky8`'s is for 9 and 10.

Every key is read by a getter on the level table, never by a widget. `src/widgets/level-briefing` is
handed the finished `card` by `src/pages/game/index.ts`, and `src/ui/editor.ts` is handed the
finished `startingCode`, so neither names a key. That is what keeps the card localized despite it:
the getters render at the moment they are read, and the page reads them on every redraw, so a
language change composes them again in the new language.

The keys are spelled out in full at the entry that uses them rather than built from the level's
`id`, for the reason `src/game/tutorial.ts` gives for the same choice: a key assembled at runtime is
a key the type checker cannot see, and the day a level is renamed the compiler should be the one to
notice rather than a player meeting an empty editor.

| Key                                  | English                               | Notes                                                                                                                  |
| ------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `skyscraper.sky1.startingCode.code`  | (the program the editor opens with)   | `.code`; only its `//` comment is translated, and `catalog.test.ts` holds the JavaScript byte-identical across locales |
| `skyscraper.sky2.title`              | Everyone starts in the lobby          | the level's name, on the briefing card and nowhere else; the switcher's 118px trigger says "Tower 2" instead           |
| `skyscraper.sky2.briefing.html`      | Ten floors, two cars, and a building… | markup; `<em>` around all three traffic profiles, since this card introduces them for levels 2 to 7                    |
| `skyscraper.sky2.startingCode.code`  | (the round-robin dispatcher)          | `.code`; the same program as `sky1`'s apart from the `//` comment, which is the point — see below                      |
| `skyscraper.sky3.startingCode.code`  | (the sorted sweep)                    | `.code`; two `//` comment lines, and the only starter in the block a fixture also runs on other levels                 |
| `skyscraper.sky4.startingCode.code`  | (the round-robin dispatcher)          | `.code`; `sky2`'s program with a `//` comment pointing at the `idle` handler instead                                   |
| `skyscraper.sky5.startingCode.code`  | (the sorted sweep)                    | `.code`; `sky3`'s program unchanged, comments included                                                                 |
| `skyscraper.sky6.startingCode.code`  | (the round-robin dispatcher)          | `.code`; `sky2`'s program with a `//` comment pointing at `callNextElevator`                                           |
| `skyscraper.sky7.startingCode.code`  | (the round-robin dispatcher)          | `.code`; `sky2`'s program a fourth time, the `//` comment back on `floor_button_pressed`                               |
| `skyscraper.sky8.title`              | Not every car goes everywhere         | the level's name, on the second and last briefing card of the block                                                    |
| `skyscraper.sky8.briefing.html`      | Ten floors, and the two cars no long… | markup; `<em>` around _zones_ and `<code>` around `servedFloors()`, the method the mechanic is played through          |
| `skyscraper.sky8.startingCode.code`  | (the sorted sweep)                    | `.code`; `sky3`'s program with a `//` comment saying that not every car stops at every floor — it stalls this building |
| `skyscraper.sky9.startingCode.code`  | (the zone-aware sweep)                | `.code`; `sky3`'s program with `callNextElevator` filtering on `servedFloors()`, which is `sky8`'s answer              |
| `skyscraper.sky10.startingCode.code` | (the zone-aware sweep)                | `.code`; `sky9`'s program, the `//` comment moved onto the three floors both banks serve                               |

Four of the ten `.code` values are the same program with a different `//` comment, and three more
are the sorted sweep under three comments, and that is deliberate rather than a chance to
deduplicate. The block hands one dispatcher to the player under
four rhythms so that what visibly changes between the levels is the building, not the code; a
shared key with a per-level comment spliced in would put the comment somewhere the translator
cannot see the line it belongs to. `catalog.test.ts` already treats the four as unrelated values
and holds each byte-identical across locales apart from its comment.

Measured, not guessed: every one of these starters has a recorded verdict at its level's pinned
seed — `sky1`'s loses with 35 of the 40 delivered, `sky3`'s takes silver, `sky5`'s bronze, `sky9`'s
bronze, `sky10`'s silver, the other five lose. `src/game/skyscraper.ts` records the figures that bracket each of them and
`src/game/skyscraper-solutions.test.ts` re-runs them, so a wording change that reaches inside the
JavaScript fails a test rather than a level.

### `src/ui/templates.ts` — 16 `game.*` keys

Every template renders its words through `t` as it is built, which is why a language change
cannot rewrite them in place: the presenters build them again. `markup` escapes its
interpolations, so a plain key is interpolated directly and an `.html` key goes through `raw()`.

| Key                         | English                                                                                                      | Notes                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `game.floor.callUp`         | Call an elevator going up from floor {floor}                                                                 | takes `{floor}`; an `aria-label`                                                                             |
| `game.floor.callDown`       | Call an elevator going down from floor {floor}                                                               | takes `{floor}`; an `aria-label`                                                                             |
| `game.elevator.label`       | Elevator {number}                                                                                            | takes `{number}`; the car's own index, counted from zero like the floors                                     |
| `game.elevator.floorButton` | Go to floor {floor}                                                                                          | takes `{floor}`                                                                                              |
| `game.level.title.html`     | Level {number}: {description}                                                                                | markup; takes `{number}`, `{description}`                                                                    |
| `game.level.nav.label`      | Levels                                                                                                       | the `<nav>`'s accessible name                                                                                |
| `game.level.nav.link`       | Level {number}                                                                                               | takes `{number}`; the accessible name of an entry whose visible text is the bare digit                       |
| `game.seed.label`           | Seed                                                                                                         | the caption over the row, not a control                                                                      |
| `game.seed.inputLabel`      | This run's seed — type another one to play it                                                                | the field's `aria-label`; the caption above it says only "Seed", which does not say it can be typed into     |
| `game.seed.invalid`         | A seed can be up to 64 letters, digits, dots, hyphens or underscores.                                        | `setCustomValidity` on the field; replaces the browser's own "match the requested format", which names none  |
| `game.seed.link`            | Seed {seed}: put this run in the address bar                                                                 | takes `{seed}`; accessible name of the link that names this exact run                                        |
| `game.seed.newDrawLink`     | Seed {seed}: draw a new one and start again                                                                  | takes `{seed}`; accessible name of the dice button                                                           |
| `game.seed.helpSummary`     | what a seed does                                                                                             | the `<summary>` of the caveat disclosure                                                                     |
| `game.seed.explanation`     | The same seed brings the same passengers, in the same order — and, played the same way, the exact same run … | a paragraph inside the disclosure, not a tooltip — it used to be a `title` attribute                         |
| `game.seed.console`         | Seed {seed} — the exact same run again, whatever the frame rate: {url}                                       | takes `{seed}` and `{url}`; the `console.log` printed at every start, and the one console line that is keyed |
| `game.feedback.next`        | Next level                                                                                                   | the link in the end-of-level overlay                                                                         |
| `game.codeStatus`           | There is an error in your program:                                                                           | the message beside it is the player's own text and is never translated                                       |

The seed itself is a placeholder in both accessible names and never part of the sentence: it is
the token a player transcribes in order to hand a building to somebody else, so it reads
identically in every locale. Both names repeat it because an accessible name has to stand on its
own — "1234567890, link" describes nothing.

Neither name is held against visible text any more, because neither control has any. The settings
popover draws both of the seed row's actions icon-only — `copy` for the link that names the run,
`dice` for the button that draws a new seed — so these two messages are the whole of what a screen
reader is handed. That retired the key that carried "new draw", the words that used to be the
second one's visible label, and with it the pair check `src/i18n/catalog.test.ts` kept under
_accessible names_: WCAG 2.5.3 constrains a name against visible text, and this row has none left
to constrain it against.

`game.seed.inputLabel` and `game.seed.invalid` arrived with the field between those two buttons,
and neither is a label on screen: the first is what a screen reader reads instead of the visible
caption, and the second is a validation message the browser speaks and shows. Both had to be
written rather than left to the platform — the caption reads "Seed", which says what the row holds
and not that it can be changed, and the browser's own refusal is "Please match the requested
format", which names no format.

The seed explanation used to be a module constant, `SEED_EXPLANATION`. It is now
`t("game.seed.explanation")` inside `seedHelpTemplate`, which runs per render — which is the
point. A `const SEED_EXPLANATION = t(...)` at module scope compiles, reads correctly and freezes
English at import time; see _Rules the wiring has to keep_.

### `src/widgets/building-stage/lib/hover-card-text.ts` — 15 `game.buildingStage.*` keys

The hover cards `widgets/building-stage` shows over an elevator car or a floor's queue — widget
6b's own DOM composition, built on `entities/elevator`, `entities/floor` and `entities/passenger`.
`Elevator` keeps no persistent "doors open" flag, only transient events, so the state line can only
ever say one of moving up, moving down or stopped, never open or closed. `elevatorCardText` and
`floorCardText` take a plain snapshot of engine state rather than the live objects themselves, so
this module is unit-tested without a DOM or a running world, the same way `layout-building.ts` and
`shaft-scale.ts` are.

| Key                                              | English                          | Notes                                                                                      |
| ------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------ |
| `game.buildingStage.elevatorState.movingUp`      | Moving up                        | `isMoving` and a negative `velocityY`, which grows downward                                |
| `game.buildingStage.elevatorState.movingDown`    | Moving down                      | `isMoving` and a non-negative `velocityY`                                                  |
| `game.buildingStage.elevatorState.stopped`       | Stopped                          | `!isMoving`                                                                                |
| `game.buildingStage.elevatorOccupancy`           | Occupied: {occupied}/{capacity}  | takes `{occupied}`, `{capacity}`; riders aboard over `Elevator.maxUsers`                   |
| `game.buildingStage.elevatorServing.up`          | Serving calls going up           | `goingUpIndicator` set, `goingDownIndicator` clear                                         |
| `game.buildingStage.elevatorServing.down`        | Serving calls going down         | `goingDownIndicator` set, `goingUpIndicator` clear                                         |
| `game.buildingStage.elevatorServing.both`        | Serving calls in both directions | both indicators set                                                                        |
| `game.buildingStage.elevatorServing.none`        | Not serving any calls            | neither indicator set                                                                      |
| `game.buildingStage.elevatorPressed.none`        | No floors requested              | `buttonStates` has no lit floor                                                            |
| `game.buildingStage.elevatorPressed.some`        | Requested floors: {floors}       | takes `{floors}`, a `formatList` of the lit floors' own numbers                            |
| `game.buildingStage.floorCard.title`             | Floor {floor}                    | takes `{floor}`, the level itself, numbered the same way as `game.floor.callUp`            |
| `game.buildingStage.floorCard.waiting`           | Waiting: {count}                 | takes `{count}`; a bare figure rather than a counted noun, so it needs no plural forms     |
| `game.buildingStage.floorCard.longestWait`       | Longest wait: {time}             | takes `{time}`, a bare `format(seconds(longestWaitSeconds, 1))`; absent while nobody waits |
| `game.buildingStage.floorCard.destinations.none` | No destinations chosen yet       | nobody waiting has pressed a floor button yet                                              |
| `game.buildingStage.floorCard.destinations.some` | Heading to: {floors}             | takes `{floors}`, a `formatList` of the distinct floors chosen                             |

Not yet mounted anywhere the player reaches, for the same reason `game.goalBar.*` is filed here
rather than under _Deliberately not translated_: `src/entities/elevator/index.ts` and
`src/entities/floor/index.ts` are wired and waiting on `widgets/building-stage` to compose them
with this module's card text, not left out on purpose.

### `src/widgets/stats-panel/ui/stats-panel.ts` — 3 `game.statsPanel.*` keys

The stats panel's own thirteen tiles draw on `presentStats`'s eleven figures (what was
`src/ui/presenters.ts`). Eleven of the thirteen reuse `page.stats.*` captions directly — the same
ones `presentStats` and `goal-bar.ts`'s own meters already show — so this prefix holds only the two
figures with no production precedent, plus the disclosure summary that reveals the panel's nine
secondary tiles.

| Key                          | English     | Notes                                                                                                      |
| ---------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| `game.statsPanel.waitingNow` | Waiting now | takes `world.users.filter(u => u.parent === null \&\& !u.done).length`, the same test `floorSnapshot` uses |
| `game.statsPanel.aboardNow`  | Riding now  | sums every elevator's occupied `userSlots`, the same test `elevatorSnapshot` uses                          |
| `game.statsPanel.more`       | All figures | the summary of the native `<details class="more">` holding the nine secondary tiles                        |

Every figure on those tiles goes through `Intl` rather than `toFixed` and `String`:
`format(quantity(...))` for the per-second rate and `format(seconds(..., 1))` for the delivery
times, the same calls `goal-bar.ts` makes for the figures it shows. That is what gives Russian
`1,5 с`, with a non-breaking space, instead of `1.5s`.

Built and unit-tested, not yet wired into `src/pages/game/index.ts`, matching every widget staged so far in
this migration.

### `src/widgets/level-switcher/ui/level-switcher.ts` — 10 `game.levelSwitcher.*` keys

The app bar's level-switcher popover, and its step buttons either side of the trigger. Two of its
four block captions reuse `tutorial.panel.label` and `game.level.nav.label`, and a level
tile reuses `game.level.nav.link` — this prefix only holds what those cannot say:
the other two blocks' captions and the tiles inside them, the two step buttons, the tile labels the
level list has no counterpart for — it never names a learning-track or Skyscraper level — and the
trigger's own names for those two.

| Key                                           | English                            | Notes                                                                                                               |
| --------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `game.levelSwitcher.prevLabel`                | Previous level                     | an `aria-label` on `.task-prev`, rewritten on every `update()`                                                      |
| `game.levelSwitcher.nextLabel`                | Next level                         | an `aria-label` on `.task-next`, likewise                                                                           |
| `game.levelSwitcher.otherBlockLabel`          | Other                              | the last block's caption — everything that is none of the other three, which today is free play alone               |
| `game.levelSwitcher.sandboxLabel`             | Sandbox                            | both the sandbox tile's visible text and its accessible name; deliberately not the caption of the block holding it  |
| `game.levelSwitcher.skyscraperBlockLabel`     | Skyscraper                         | the Skyscraper block's caption, over the levels built on how real lift systems are dispatched                       |
| `game.levelSwitcher.skyscraperTileLabel`      | Skyscraper level {number}          | takes `{number}`; accessible name of a Skyscraper tile. No `...Cleared` twin: those tiles carry a medal, not a flag |
| `game.levelSwitcher.tutorialTileLabel`        | Tutorial level {number}            | takes `{number}`; accessible name of an open, not-yet-cleared tutorial tile                                         |
| `game.levelSwitcher.tutorialTileClearedLabel` | Tutorial level {number}, completed | takes `{number}`; accessible name of a cleared tutorial tile                                                        |
| `game.levelSwitcher.tutorialTriggerLabel`     | Lesson {number}                    | takes `{number}`; what the 118px trigger reads while a lesson is being played, where the tile labels overflow       |
| `game.levelSwitcher.skyscraperTriggerLabel`   | Tower {number}                     | takes `{number}`; the same job on the same 118px trigger, for a Skyscraper level                                    |

### `src/widgets/goal-bar/ui/goal-bar.ts` and `src/entities/level-tier/ui/requirement-text.ts` — 22 `game.goalBar.*` keys

The level bar's own meters and its tier popover. Not yet mounted anywhere the player reaches
— `presentGoalBar` has no caller outside its own module and its own test file — so this prefix is
read but not, today, shown; it is filed here rather than under _Deliberately not translated_
because that section is for strings that were looked at and left out on purpose, and this one
is wired and waiting on the widget that mounts it.

A main meter's caption is `page.stats.*` wherever the statistics panel already names the same
field — `METER_CAPTION_KEY` maps eleven of the twelve `LevelWorldStats` fields there
directly. `maxPickupTime` is the one figure that panel never shows, so it is the only caption
this prefix supplies. The tier popover's twelve `req.*` sentences are built the same way
`src/game/levels.ts`'s own condition builders are, from nested `t()` calls: a threshold
reaches its sentence already declined, through `level.timeLimit.html`/`.waitLimit.html`/
`.people.html` for the seven time- or count-shaped fields, `floorBudget.html`/`stopBudget.html`
for the two elevator-activity fields, and a bare `format()` call for the three that are already a
percentage or a rate.

Fourteen of the twenty-two — the twelve `req.*` sentences and the two budget messages they
interpolate — are read from `src/entities/level-tier/ui/requirement-text.ts` rather than from
the widget, and are `game.goalBar.*` only because the popover was the first thing to want them.
The end-of-run card's hint is the second: `src/entities/level-tier/ui/tier-hint.ts` composes
the same sentences into `game.feedback.more.*`, so a requirement now reads identically in the
popover that sets the bar and in the line that says what the run missed it by. They stayed under
this prefix rather than being renamed because a key is an address: moving twelve of them would
have rewritten twenty-four Russian and English values to say nothing new.

| Key                                         | English                                               | Notes                                                                                                                                                                                                                                                           |
| ------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game.goalBar.caption.maxPickupTime`        | Max wait for a car                                    | the only main-meter caption not borrowed from `page.stats.*`, since the panel never shows this figure                                                                                                                                                           |
| `game.goalBar.unit.seconds`                 | ` s` (a leading space)                                | `NoParamMessageKey`; appended after `elapsedTime`'s and `maxWaitTime`'s own figures, the two `METER_FORMAT` entries that carry a `unitKey`                                                                                                                      |
| `game.goalBar.unit.floors`                  | ` fl.` (a leading space)                              | likewise, after `moveCount`'s figures                                                                                                                                                                                                                           |
| `game.goalBar.tier.bronze`                  | Bronze                                                | a tier's display name, read by both a popover row and `trigger.titleEarned`'s `{tier}`                                                                                                                                                                          |
| `game.goalBar.tier.silver`                  | Silver                                                |                                                                                                                                                                                                                                                                 |
| `game.goalBar.tier.gold`                    | Gold                                                  |                                                                                                                                                                                                                                                                 |
| `game.goalBar.trigger.titleNone`            | Level stars: none yet. Open requirements              | the tier trigger's title before any tier is earned                                                                                                                                                                                                              |
| `game.goalBar.trigger.titleEarned`          | Level stars: {tier}. Open requirements                | takes `{tier}`, itself `t(TIER_NAME_KEY[earnedTier])`; no single Russian verb agrees with all three tier names — «взято» works for «серебро»/«золото» but not «бронза», which needs «взята» — so the tier's own name is substituted directly instead            |
| `game.goalBar.floorBudget.html`             | {count} floor / {count} floors                        | plural (one, other); takes `{count}`; feeds `req.moveCount.html`'s `{floors}`; Russian keeps the genitive plural «этажей» invariant across all four categories, a deliberate simplification                                                                     |
| `game.goalBar.stopBudget.html`              | {count} stop / {count} stops                          | plural (one, other); takes `{count}`; feeds `req.stopCount.html`'s `{stops}`; Russian declines all four categories properly, unlike `floorBudget.html`'s invariant genitive plural                                                                              |
| `game.goalBar.req.transportedCounter.html`  | transport {people}                                    | takes `{people}`, itself `level.people.html`                                                                                                                                                                                                                    |
| `game.goalBar.req.elapsedTime.html`         | finish within {time}                                  | takes `{time}`, itself `level.timeLimit.html`                                                                                                                                                                                                                   |
| `game.goalBar.req.maxWaitTime.html`         | deliver everyone within {time}                        | takes `{time}`, itself `level.waitLimit.html`; not "no one waits longer than {time}" — `maxWaitTime`/`avgWaitTime` measure spawn-to-delivery, not a wait, the same distinction `page.stats.avgWaitTime` and `.maxWaitTime` already draw                         |
| `game.goalBar.req.avgWaitTime.html`         | average delivery no later than {time}                 | takes `{time}`, itself `level.waitLimit.html`                                                                                                                                                                                                                   |
| `game.goalBar.req.moveCount.html`           | elevators travel no more than {floors}                | takes `{floors}`, itself `floorBudget.html`                                                                                                                                                                                                                     |
| `game.goalBar.req.stopCount.html`           | elevators stop no more than {stops}                   | takes `{stops}`, itself `stopBudget.html`                                                                                                                                                                                                                       |
| `game.goalBar.req.avgLoadFactorOnMove.html` | elevators run {percent} full or more                  | takes `{percent}`, a bare `format(percent(threshold))`                                                                                                                                                                                                          |
| `game.goalBar.req.transportedPerSec.html`   | at least {rate} people per second                     | takes `{rate}`, a bare `format(decimal(threshold, 2))`; Russian takes the genitive singular «человека», not the plural — a two-decimal figure is grammatically fractional (the `other` category), and a fraction takes the genitive singular whatever the value |
| `game.goalBar.req.avgPeoplePerStop.html`    | at least {rate} people per stop                       | takes `{rate}`, likewise; the same genitive-singular reasoning, diverging from `page.stats.peoplePerStop`'s own genitive-plural «Людей на остановку», which has no number governing it                                                                          |
| `game.goalBar.req.maxPickupTime.html`       | never leave anyone waiting more than {time} for a car | takes `{time}`, itself `level.waitLimit.html`                                                                                                                                                                                                                   |
| `game.goalBar.req.avgPickupTime.html`       | average wait for a car no more than {time}            | takes `{time}`, itself `level.waitLimit.html`                                                                                                                                                                                                                   |
| `game.goalBar.req.avgRideTime.html`         | average ride no more than {time}                      | takes `{time}`, itself `level.waitLimit.html`                                                                                                                                                                                                                   |

### `src/widgets/editor-pane/ui/editor-pane.ts` — 5 `game.*` keys

The editor pane's chrome: the code slot switcher (`presentCodeSlots`, drawn as-is from
`#features/manage-code-slots`, contributing no key of its own here), the "Reset code" and "Undo
reset" buttons, and an error banner reusing `game.codeStatus` for its own message line.

Five keys are drawn here. The two button labels, which this pane is now the only reader of — they
were the run controls' while the two rows were one, and `run-controls.ts` kept the run and gave
the code away. The banner's goto link, which `src/ui/error-location.ts`'s `locateCodeError` makes
work by finding a position for the player's own exception. And a tooltip for each of the two
buttons, saying the thing their labels have no room for — which of the two programs comes back.
"Reset code" does not distinguish the level's own starting program from whatever the editor held a
moment ago, and the buttons sit next to each other undoing one another, which is why each carries
a `title` spelling that out.

| Key                              | English                                                | Notes                                                                                                                             |
| -------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `game.button.resetCode`          | Reset code                                             | puts the starter program back, behind a confirmation                                                                              |
| `game.button.undoResetCode`      | Undo reset                                             | hidden until a reset has something to bring back                                                                                  |
| `game.editorPane.gotoLine`       | Line {line} →                                          | takes `{line}`, 1-based; the label of a button hidden whenever `locateCodeError` finds no position for the player's own exception |
| `game.button.resetCodeTitle`     | Put the level's own starting program back in this slot | the `title` on `.resetcode`; a description, the accessible name staying the visible "Reset code" (WCAG 2.5.3)                     |
| `game.button.undoResetCodeTitle` | Bring back the program this slot held before the reset | the `title` on `.undoreset`, likewise                                                                                             |

Built and unit-tested, not yet wired into `src/pages/game/index.ts`, matching every widget staged so far in
this migration.

### `src/features/switch-theme` — 4 `game.switchTheme.*` keys

The settings popover's theme block: a three-way light/dark/system switch, where "system" is not a
fallback but the starting choice — until a player picks otherwise, the page tracks the browser's own
`prefers-color-scheme`. This is one of several blocks that popover composes; see
`widgets/app-bar/ui/settings-menu.ts` for the others, once a later step of the same migration phase
adds it.

| Key                        | English | Notes                                                                      |
| -------------------------- | ------- | -------------------------------------------------------------------------- |
| `game.switchTheme.caption` | Theme   | both the `.setblock`'s visible caption and the button group's `aria-label` |
| `game.switchTheme.system`  | System  | the default choice, and the one that tracks `prefers-color-scheme` live    |
| `game.switchTheme.light`   | Light   |                                                                            |
| `game.switchTheme.dark`    | Dark    |                                                                            |

Built and unit-tested, not yet wired into `src/pages/game/index.ts` or `index.html` — `presentThemeSwitch`
has no caller outside its own module and its own test file yet, matching every widget staged so
far in this migration.

### `src/features/switch-layout` — 5 `game.switchLayout.*` keys

The settings popover's layout block: the same four-way left/right/code/game arrangement
`widgets/workspace-layout` already drives, exposed here through its own `LayoutModeId` type rather
than that widget's `LayoutMode` — `features/**` may not import from `widgets/**` (see
`layout-switch.ts`'s module doc comment) — the two types being structurally identical strings is
what lets a later caller pass one where the other is expected, without a cast. This is one of
several blocks the popover composes; see `widgets/app-bar/ui/settings-menu.ts` for the others, once
a later step of the same migration phase adds it.

Two of the four keys are `onlyCode`/`onlyGame` rather than the bare `code`/`game` a
`LayoutModeId`-keyed lookup would otherwise suggest: a bare `.code` key is a reserved suffix
elsewhere in this catalog (see _Where the strings are_ and `catalog.test.ts`), read as "this
value is a block of example code that must match byte-for-byte across locales" — not what a layout
mode's own label is.

| Key                          | English       | Notes                                                                      |
| ---------------------------- | ------------- | -------------------------------------------------------------------------- |
| `game.switchLayout.caption`  | Layout        | both the `.setblock`'s visible caption and the button group's `aria-label` |
| `game.switchLayout.left`     | Code left     | title and `aria-label` of the "editor on the left" button                  |
| `game.switchLayout.right`    | Code right    | title and `aria-label` of the "editor on the right" button                 |
| `game.switchLayout.onlyCode` | Code only     | title and `aria-label` of the editor-only button                           |
| `game.switchLayout.onlyGame` | Building only | title and `aria-label` of the building-only button                         |

Built and unit-tested, not yet wired into `src/pages/game/index.ts` or `index.html` — `presentLayoutSwitch`
has no caller outside its own module and its own test file yet, matching every widget staged so
far in this migration.

### `src/widgets/app-bar/ui/settings-menu.ts` — 7 `game.appBar.*` keys

The widget that composes `switch-theme`, `switch-layout`, `switch-language` and `manage-seed` into
one settings popover, plus the two elements around and inside it that are this module's own: the
`docsOpen` button beside the popover, and the popover's own hotkeys-opener row and About block.
`docsOpenLabel` and `hotkeysOpenLabel` name openers only — Phase 10 is where the docs and hotkeys
dialogs themselves get built, so both buttons take an injected click callback and do nothing on
their own yet, the same "build inert first" staging every widget in this migration follows.
`aboutForkLabel`/`aboutOriginalLabel`/`aboutCopyright.html` are the only prose in a block that
otherwise consists of two real, hardcoded GitHub URLs — an address is not a translator's business,
so the URLs and the domain text under each link are plain constants rather than catalog keys.

`aboutCopyright.html` is deliberately the same string in both locales: "Elevator Saga © 2015 Magnus
Wolffelt, © 2026 EpicDima, MIT." names a license, and a license notice does not change with the
reader's language.

It is also the whole of the game's route to `licenses.txt`. The footer that used to link that file
went when the app bar took the page over, and a row of its own in the About block would have changed
its shape — so the word "MIT", already in the notice and already naming the thing the file contains,
is the link. That is why the key carries `.html`: the suffix is this catalog's mark for a value
written with `innerHTML` rather than as text.

| Key                               | English                                                                                    | Notes                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `game.appBar.docsOpenLabel`       | Help                                                                                       | the `docsOpen` button's visible label and `title`                                      |
| `game.appBar.settingsLabel`       | Settings                                                                                   | the popover trigger's visible label, `title` and `aria-label`                          |
| `game.appBar.hotkeysOpenLabel`    | Hotkeys                                                                                    | the popover's `keysOpen` row; closes the popover before its own callback fires         |
| `game.appBar.aboutCaption`        | About                                                                                      | the About block's `.cap` caption                                                       |
| `game.appBar.aboutForkLabel`      | This fork                                                                                  | the name over this repository's own URL                                                |
| `game.appBar.aboutOriginalLabel`  | Original                                                                                   | the name over the game this is forked from                                             |
| `game.appBar.aboutCopyright.html` | Elevator Saga © 2015 Magnus Wolffelt, © 2026 EpicDima, `<a href="licenses.txt">`MIT`</a>`. | markup; byte-identical in every locale, like a `.code` key, though not one — see above |

Built and unit-tested, not yet wired into `src/pages/game/index.ts` or `index.html` —
`presentAppBarSettings` has no caller outside its own module and its own test file yet, matching
every widget staged so far in this migration.

### `src/features/hotkeys-help/ui/hotkeys-modal.ts` — 8 `game.hotkeys.*` keys

The `hotkeys-help` feature's own dialog is `<dialog class="keys">`: a title, a close button and
five rows pairing a hotkey with what it does. Two of the five are Mod- bindings, spelled as two
`<kbd>`s joined by `+`, the convention `docs.play.shortcuts.html` already uses;
`src/ui/shortcuts.ts`'s `labelModifierKeys` resolves each pair per visitor at runtime, so nothing
here needs a static paragraph explaining that Windows and Linux read `Ctrl` for `⌘` — relabeling
per visitor is what makes that question not arise. Whoever mounts the dialog live still has to
call `labelModifierKeys` against it themselves, the same way `src/ui/localize-page.ts` already
does for the rest of the page shell.

| Key                         | English            | Notes                                                                           |
| --------------------------- | ------------------ | ------------------------------------------------------------------------------- |
| `game.hotkeys.title`        | Keyboard shortcuts | the dialog's heading                                                            |
| `game.hotkeys.closeTitle`   | Close window       | the close button's `title`                                                      |
| `game.hotkeys.close`        | Close              | the close button's screen-reader-only label                                     |
| `game.hotkeys.startPause`   | Start and pause    | the row naming `Space`                                                          |
| `game.hotkeys.startOver`    | Start over         | the row naming `Ctrl`+`Enter`, as two `<kbd>`s rather than one compressed glyph |
| `game.hotkeys.switchLayout` | Switch layout      | the row naming `Ctrl`+`B`, likewise                                             |
| `game.hotkeys.openDocs`     | Help               | the row naming `F1`                                                             |
| `game.hotkeys.openSettings` | Settings           | the row naming `?`                                                              |

Built and unit-tested against a jsdom `<dialog>` — `polyfillDialogElement`
(`src/shared/ui/test-helpers.ts`) — but not yet wired into `src/pages/game/index.ts` or `settings-menu.ts`'s
`keysopen` opener, matching every widget staged so far in this migration.

### `src/features/docs-reference/ui/docs-modal.ts` — 24 `game.docs.*` keys

The `docs-reference` feature's own dialog is `<dialog class="docs">`: a search box, a guide, the
code skeleton every program starts from, a lead paragraph, and the API reference table below
(`reference.ts`, next). Six keys are the dialog's own chrome, including `empty`, shown in place of
the guide and the reference once a search matches nothing. Fifteen are the guide, split section by
section — `whatToDo`'s four steps are their own keys rather than one holding the whole `<ol>`,
since the list itself is the template's to draw and not a translator's to reproduce, and `step3`
alone carries a `.html` suffix, being the only one of the seven sections with an inline tag.
`intro.example.code` is rendered through `highlightJavaScript` and wrapped in `<pre><code>` at the
presenter, `src/ui/templates.ts`'s own `tutorialAnswerTemplate` convention.

| Key                                      | English                                                                                               | Notes                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `game.docs.title`                        | Help                                                                                                  | the dialog's heading                                                   |
| `game.docs.searchPlaceholder`            | Search: goToFloor, waiting, button…                                                                   | the search input's `placeholder`                                       |
| `game.docs.clearSearch`                  | Clear search                                                                                          | the clear-search button's `title`/`aria-label`                         |
| `game.docs.closeTitle`                   | Close help                                                                                            | the close button's `title`                                             |
| `game.docs.close`                        | Close                                                                                                 | the close button's screen-reader-only label                            |
| `game.docs.empty`                        | Nothing found                                                                                         | shown once a search matches nothing                                    |
| `game.docs.guide.whatGame.heading`       | What kind of game this is                                                                             |                                                                        |
| `game.docs.guide.whatGame.body`          | Elevators move through a building, and people wait on its floors: each one arrived on their own floo… |                                                                        |
| `game.docs.guide.whatToDo.heading`       | What to do                                                                                            |                                                                        |
| `game.docs.guide.whatToDo.step1`         | Pick a level in the header. Each one has its own building — floors, elevator count, elevator capacit… | one `<li>` of the four-step list                                       |
| `game.docs.guide.whatToDo.step2`         | Write your program on the right. It subscribes to elevator and floor events: a button was pressed, a… | likewise                                                               |
| `game.docs.guide.whatToDo.step3.html`    | Press Start and watch. A run can be paused, sped up — all the way to instant, where the outcome is c… | markup; the only step with an inline `<b>`                             |
| `game.docs.guide.whatToDo.step4`         | Didn't work out? Adjust the rule and run again. Three code slots per level hold three different appr… | likewise                                                               |
| `game.docs.guide.carArrows.heading`      | The arrows on the car                                                                                 |                                                                        |
| `game.docs.guide.carArrows.html`         | Each car carries two lit arrows — up and down lamps, the very ones goingUpIndicator and goingDownInd… | markup                                                                 |
| `game.docs.guide.readingResults.heading` | How to tell whether it worked                                                                         |                                                                        |
| `game.docs.guide.readingResults.body`    | The bars under the header show the level's condition: how many people to carry, in how much time, ho… |                                                                        |
| `game.docs.guide.threeStars.heading`     | Three stars                                                                                           |                                                                        |
| `game.docs.guide.threeStars.html`        | Clearing a level earns bronze — that's exactly its own condition. Silver and gold come from how it w… | markup                                                                 |
| `game.docs.guide.tutorialLevels.heading` | The first levels come with an explanation                                                             |                                                                        |
| `game.docs.guide.tutorialLevels.body`    | Tutorial levels have a lesson standing next to the building: step by step, what's happening, which e… |                                                                        |
| `game.docs.intro.heading`                | What a program is made of                                                                             |                                                                        |
| `game.docs.intro.example.code`           | { init: function (elevators, floors) { // subscribe to events here }, update: function (dt, elevator… | code; the skeleton every program starts from; comments translated only |
| `game.docs.lead.html`                    | elevator is an elevator: all of them live in elevators. floor is a floor, and they're in floors. Any… | markup                                                                 |

Built and unit-tested against a jsdom `<dialog>` — `polyfillDialogElement`
(`src/shared/ui/test-helpers.ts`) — but not yet wired into `src/pages/game/index.ts` or `settings-menu.ts`'s
`docsopen` opener, matching every widget staged so far in this migration.

### `src/entities/api-reference/model/reference.ts` — 59 `game.apiRef.*` keys

`API_REFERENCE`'s own structural table — which `sig` belongs to which group, in which order — as
plain data with no `t()` call of its own, mirroring
`src/entities/level/model/level-list.ts`'s own purity: an `elevator` group of sixteen
entries and a `floor` group of three. Every entry names three keys after its own id — `.short` (the
collapsed `<details class="api">` row's summary), `.more` (its expanded paragraph) and `.code` (its
example) — besides the two group labels themselves. English condenses this repository's own
`documentation.html` prose for the same methods rather than translating the Russian cold; Russian
keeps its own established wording, unchanged but for `floorNum.more`'s `floors.length-1`, tightened
to keep the catalog's own rule against a spaced hyphen standing in for a dash. Every `.code` key
holds only its comments in translation, the code itself byte-identical between locales —
`docs.basics.example.code`'s own convention.

Read by `docs-modal.ts` (above), which draws `API_REFERENCE` as the reference table's own rows.

| Key                                                | English                                                                                               | Notes                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `game.apiRef.elevator.groupLabel`                  | Elevator                                                                                              | the heading over `API_REFERENCE`'s elevator group             |
| `game.apiRef.floor.groupLabel`                     | Floor                                                                                                 | the heading over `API_REFERENCE`'s floor group                |
| `game.apiRef.elevator.goToFloor.short`             | Queues a floor for the elevator.                                                                      |                                                               |
| `game.apiRef.elevator.goToFloor.more`              | The floor joins the end of the queue: the elevator gets to it once it has dealt with whatever was qu… |                                                               |
| `game.apiRef.elevator.goToFloor.code`              | // don't queue what's already queued const wanted = floor.floorNum(); if (!elevator.destinationQueue… | code; comments translated only, code identical across locales |
| `game.apiRef.elevator.goToFloorPriority.short`     | The same, but first in the queue: the elevator goes there right away.                                 |                                                               |
| `game.apiRef.elevator.goToFloorPriority.more`      | The second argument puts the floor at the front of the queue and pushes everything else back. It's h… |                                                               |
| `game.apiRef.elevator.goToFloorPriority.code`      | elevator.on("passing_floor", (floorNum, direction) => { if (elevator.loadFactor() < 0.8 && waiting(f… | code; comments translated only, code identical across locales |
| `game.apiRef.elevator.stop.short`                  | Stops and drops the queue. The passengers inside won't thank you.                                     |                                                               |
| `game.apiRef.elevator.stop.more`                   | The elevator stops wherever it is, and the whole queue is cleared. Buttons pressed by the passengers… |                                                               |
| `game.apiRef.elevator.stop.code`                   | elevator.stop(); // put back what was ordered from inside for (const floorNum of elevator.getPressed… | code; comments translated only, code identical across locales |
| `game.apiRef.elevator.currentFloor.short`          | The floor the elevator is on right now.                                                               |                                                               |
| `game.apiRef.elevator.currentFloor.more`           | A whole number, never a fraction: while the elevator is traveling between floors, this answers with…  |                                                               |
| `game.apiRef.elevator.currentFloor.code`           | const distance = Math.abs(elevator.currentFloor() - floor.floorNum());                                | code; comments translated only, code identical across locales |
| `game.apiRef.elevator.destinationQueue.short`      | The floor queue. It's a plain array, and can be edited like one.                                      |                                                               |
| `game.apiRef.elevator.destinationQueue.more`       | The first element is wherever the elevator is headed right now. Reading is free, and so is changing…  |                                                               |
| `game.apiRef.elevator.destinationQueue.code`       | // drop repeats without touching the order elevator.destinationQueue = elevator.destinationQueue.fil… | code; comments translated only, code identical across locales |
| `game.apiRef.elevator.checkDestinationQueue.short` | Re-reads the queue after a manual edit.                                                               |                                                               |
| `game.apiRef.elevator.checkDestinationQueue.more`  | Needed in exactly one case: destinationQueue was changed directly. There's no need to call it after…  |                                                               |
| `game.apiRef.elevator.checkDestinationQueue.code`  | elevator.destinationQueue.sort((a, b) => a - b); elevator.checkDestinationQueue();                    | code; comments translated only, code identical across locales |
| `game.apiRef.elevator.getPressedFloors.short`      | Which buttons are pressed inside the elevator.                                                        |                                                               |
| `game.apiRef.elevator.getPressedFloors.more`       | An array of floor numbers, ascending. These are the passengers' wishes, not a route — the elevator w… |                                                               |
| `game.apiRef.elevator.getPressedFloors.code`       | elevator.on("stopped_at_floor", () => { for (const floorNum of elevator.getPressedFloors()) { elevat… | code; comments translated only, code identical across locales |
| `game.apiRef.elevator.loadFactor.short`            | How full the elevator is: from 0 (empty) to 1 (packed).                                               |                                                               |
| `game.apiRef.elevator.loadFactor.more`             | Counted by the passengers' weight, not by how many there are, so half the seats filled won't read as… |                                                               |
| `game.apiRef.elevator.loadFactor.code`             | floor.on("up_button_pressed", () => { if (elevator.loadFactor() < 0.7) { elevator.goToFloor(floor.fl… | code; comments translated only, code identical across locales |
| `game.apiRef.elevator.maxPassengerCount.short`     | How many people fit inside it.                                                                        |                                                               |
| `game.apiRef.elevator.maxPassengerCount.more`      | A fixed number, worth asking once in init. Elevators in the same building can carry different amount… |                                                               |
| `game.apiRef.elevator.maxPassengerCount.code`      | const big = elevators.filter((elevator) => elevator.maxPassengerCount() >= 8);                        | code; comments translated only, code identical across locales |
| `game.apiRef.elevator.destinationDirection.short`  | Which way it's headed: "up", "down" or "stopped".                                                     |                                                               |
| `game.apiRef.elevator.destinationDirection.more`   | Answers from the first floor in the queue, not from the lamps outside — those are set by hand, and c… |                                                               |
| `game.apiRef.elevator.destinationDirection.code`   | if (elevator.destinationDirection() === "up" && floorNum > elevator.currentFloor()) { elevator.goToF… | code; comments translated only, code identical across locales |
| `game.apiRef.elevator.goingUpIndicator.short`      | The "up" lamp outside. With no argument, it just reads.                                               |                                                               |
| `game.apiRef.elevator.goingUpIndicator.more`       | With an argument, it lights the lamp or turns it off; with none, it reports whether it's lit. People… |                                                               |
| `game.apiRef.elevator.goingUpIndicator.code`       | elevator.goingUpIndicator(true); elevator.goingDownIndicator(false);                                  | code; comments translated only, code identical across locales |
| `game.apiRef.elevator.goingDownIndicator.short`    | The "down" lamp. People decide whether to board by these lamps.                                       |                                                               |
| `game.apiRef.elevator.goingDownIndicator.more`     | The same thing, downward. The pair is usually flipped at the turnaround: reach the top, turn off "up… |                                                               |
| `game.apiRef.elevator.goingDownIndicator.code`     | elevator.on("stopped_at_floor", (floorNum) => { const up = floorNum === 0; elevator.goingUpIndicator… | code; comments translated only, code identical across locales |
| `game.apiRef.elevator.idle.short`                  | The queue ran out — the elevator has nothing left to do.                                              |                                                               |
| `game.apiRef.elevator.idle.more`                   | Fires once, when the elevator reaches the last floor in its queue. Leave it unanswered and the eleva… |                                                               |
| `game.apiRef.elevator.idle.code`                   | elevator.on("idle", () => { elevator.goToFloor(0); });                                                | code; comments translated only, code identical across locales |
| `game.apiRef.elevator.floorButtonPressed.short`    | A passenger inside pressed a floor button.                                                            |                                                               |
| `game.apiRef.elevator.floorButtonPressed.more`     | The floor number arrives as the argument. The event itself changes nothing — until the floor is queu… |                                                               |
| `game.apiRef.elevator.floorButtonPressed.code`     | elevator.on("floor_button_pressed", (floorNum) => { elevator.goToFloor(floorNum); });                 | code; comments translated only, code identical across locales |
| `game.apiRef.elevator.passingFloor.short`          | Passing a floor — there's still time to stop for it.                                                  |                                                               |
| `game.apiRef.elevator.passingFloor.more`           | Fires just before the elevator draws level with the floor — the one place where goToFloor(floorNum,…  |                                                               |
| `game.apiRef.elevator.passingFloor.code`           | elevator.on("passing_floor", (floorNum, direction) => { if (elevator.getPressedFloors().includes(flo… | code; comments translated only, code identical across locales |
| `game.apiRef.elevator.stoppedAtFloor.short`        | Stopped at a floor, doors open.                                                                       |                                                               |
| `game.apiRef.elevator.stoppedAtFloor.more`         | Boarding and alighting have already happened by this point. A good place to reset the lamps and deci… |                                                               |
| `game.apiRef.elevator.stoppedAtFloor.code`         | elevator.on("stopped_at_floor", (floorNum) => { elevator.goingUpIndicator(floorNum === 0); elevator.… | code; comments translated only, code identical across locales |
| `game.apiRef.floor.floorNum.short`                 | The floor's number, counting up from zero at the bottom.                                              |                                                               |
| `game.apiRef.floor.floorNum.more`                  | The lowest floor is 0, the highest is floors.length - 1. Inside a floor's own handler, this is the o… |                                                               |
| `game.apiRef.floor.floorNum.code`                  | floors.forEach((floor) => { floor.on("up_button_pressed", () => { elevators[0].goToFloor(floor.floor… | code; comments translated only, code identical across locales |
| `game.apiRef.floor.upButtonPressed.short`          | The "up" button was pressed outside — a call upward.                                                  |                                                               |
| `game.apiRef.floor.upButtonPressed.more`           | Someone wants to go up. The event arrives on the floor, not on any elevator: which one answers the c… |                                                               |
| `game.apiRef.floor.upButtonPressed.code`           | floor.on("up_button_pressed", () => { nearest(floor.floorNum()).goToFloor(floor.floorNum()); });      | code; comments translated only, code identical across locales |
| `game.apiRef.floor.downButtonPressed.short`        | The "down" button was pressed outside.                                                                |                                                               |
| `game.apiRef.floor.downButtonPressed.more`         | The same thing, downward. If direction doesn't matter yet, both events can be subscribed in one line… |                                                               |
| `game.apiRef.floor.downButtonPressed.code`         | floor.on("up_button_pressed down_button_pressed", () => { elevators[0].goToFloor(floor.floorNum());…  | code; comments translated only, code identical across locales |

### `src/features/run-simulation/ui/run-controls.ts` — 7 `game.button.*` keys

The two buttons the app bar opens with. Only the first changes its word: "Start" before a run and
again once the level is over, "Pause" while the world is drawing, "Resume" where a started run
is standing still. What is on the button is always what the press will do, never what the run is
doing — which is why "Pause" is absent while a headless crunch runs, since the shared controller
is paused throughout one and `!isPaused` alone would say the opposite.

Two of the seven are `title` attributes rather than labels, and each says the thing a two-word
button has no room for. `game.button.startOverTitle` sits on "Start over" at all times.
`game.button.startAgainTitle` is written only in the one state where the primary button's label
repeats itself: the level has ended, its result is on screen, and "Start" now means throwing
that result away.

| Key                            | English                               | Notes                                                                                                             |
| ------------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `game.button.start`            | Start                                 | before the first frame, and again once the level has ended                                                        |
| `game.button.pause`            | Pause                                 | only while the world on screen is being drawn                                                                     |
| `game.button.resume`           | Resume                                | a started run standing still; never offered on the speed control's instant stop, where a press restarts from zero |
| `game.button.startOver`        | Start over                            | restarts the run from the program in the editor; the button "Apply" became                                        |
| `game.button.startOverTitle`   | Start the run from the very beginning | the `title` on `.startover`, the accessible name staying the visible label (WCAG 2.5.3)                           |
| `game.button.startAgainTitle`  | Run it again from the beginning       | the `title` on `.startstop`, and only where its label reads "Start" a second time                                 |
| `game.button.runningInstantly` | Crunching...                          | shown, and both buttons disabled, while a headless crunch is under way; see `src/game/instant-run.ts`             |

### `src/features/adjust-speed/ui/speed-stepper.ts` — 7 `game.timeScale.*` keys

The speed control beside them: two chevrons with the reading between them. The chevrons carry no
word of their own, so each needs a name and the same words again as a `title`, a pointer having no
other way to ask what a bare chevron does. The group is named once rather than the arrows twice
over, and the reading needs a `title` because `2x` alone does not say what it counts.

The stop past the fastest speed is not a speed at all: it is the instant run, a headless crunch
straight to the result, and `game.timeScale.instant` is the `∞x` standing in for a number there.
It is a message for the same reason `game.timeScale.value` is — Russian writes `×`, not the Latin
letter x. Neither of the two `instant*` keys is ever read in the sandbox: free play has no
condition to crunch to, so the stop is not offered there and the reading stays on a number.

| Key                           | English                                                      | Notes                                                                                                 |
| ----------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `game.timeScale.label`        | Run speed                                                    | the `aria-label` on the `role="group"` around all three, which is where the pair is named             |
| `game.timeScale.value`        | {value}x                                                     | takes `{value}`; Russian writes `×`, not the Latin letter x                                           |
| `game.timeScale.valueTitle`   | Run speed: {value}                                           | takes `{value}`, itself `game.timeScale.value` or the reading below                                   |
| `game.timeScale.decrease`     | Slower                                                       | an `aria-label` and the identical `title`; rewritten on every update, so a language change reaches it |
| `game.timeScale.increase`     | Faster                                                       | likewise                                                                                              |
| `game.timeScale.instant`      | ∞x                                                           | the reading on the stop past the fastest speed                                                        |
| `game.timeScale.instantTitle` | Instantly: the run is counted straight through to its result | the `title` there, since `∞x` names no unit and no multiple                                           |

### `src/shared/lib/describe-error.ts` — 3 `error.*` keys

What the code status bar says when the player's program throws something that is not an `Error`:
an empty string, or an object with no message of its own. The text beside them is the player's own
and is never translated, which is why `kind` and the key names are interpolated rather than keyed.

| Key                        | English                       | Notes                    |
| -------------------------- | ----------------------------- | ------------------------ |
| `error.thrown.emptyString` | Thrown empty string           |                          |
| `error.thrown.noMessage`   | Thrown {kind} with no message | takes `{kind}`           |
| `error.thrown.keys`        | {kind} with keys: {keys}      | takes `{kind}`, `{keys}` |

### `src/pages/game/index.ts` — 4 `game.feedback.*` keys

| Key                             | English                                  | Notes                                                              |
| ------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| `game.feedback.success.title`   | Success!                                 |                                                                    |
| `game.feedback.success.message` | Level completed                          |                                                                    |
| `game.feedback.failure.title`   | Level failed                             |                                                                    |
| `game.feedback.failure.message` | Maybe your program needs an improvement? | not shown on the learning track, where a loss is the first outcome |

The locale preference is not app state and is not kept here beside `TIME_SCALE_STORAGE_KEY`:
`LOCALE_STORAGE_KEY` and `readStoredLocale` live in `src/i18n/detect.ts`, shaped after
`readStoredTimeScale` and saying so in a comment.

### `src/widgets/verdict-toast/ui/verdict-toast.ts` and `src/entities/level-tier/ui/tier-hint.ts` — 4 `game.feedback.*` keys

The rest of the end-of-run card: the button that puts it away, and the line under the message
saying what the run would need for its next star. The four sentences above are composed by the
page and handed in; these four the card and the hint read for themselves, which is the division
`src/widgets/verdict-toast/ui/verdict-toast.ts` keeps everywhere — it is told the verdict and
works out none of it.

`game.feedback.dismiss` is not "Close". The word names what the player is saying rather than what
the button does, and it deliberately avoids anything that could be read as offering the run again:
restarting is the app bar's own control, and a second promise of it here would be one too many.

There is a sentence per tier instead of one taking the tier's name because Russian declines it —
«до серебра», «до золота» — and a name interpolated from `game.goalBar.tier.*` would arrive
nominative. That is the same shape, and the same reason, as `game.goalBar.trigger.titleEarned`'s
note above, arrived at from the opposite direction: there the tier name is what could be
substituted and the verb could not, here neither can.

| Key                              | English             | Notes                                                                                                                                                                      |
| -------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game.feedback.dismiss`          | Got it              | the close button, on every card including a losing one                                                                                                                     |
| `game.feedback.more.silver.html` | For silver: {needs} | markup; takes `{needs}`, the unmet requirements joined by `formatList`                                                                                                     |
| `game.feedback.more.gold.html`   | For gold: {needs}   | likewise, for a run that already holds silver                                                                                                                              |
| `game.feedback.more.need.html`   | {req} (now {now})   | markup; takes `{req}`, a `game.goalBar.req.*` sentence, and `{now}`, where the run actually finished — without the second figure the line is a reproach rather than a hint |

### `src/main.ts` — 3 `game.workspace.*` keys

`widgets/workspace-layout` itself takes plain strings, the same way `buildAppBarSkeleton` does —
it has no i18n awareness of its own, matching every widget in this migration. These three are the
`aria-label`s of the two panes the splitter divides and the splitter itself, resolved by
`src/main.ts` at mount time and passed into `buildWorkspaceLayoutSkeleton`'s options. The splitter
is `role="separator"`, not a native form control, so it has no other label to borrow the way a
`<button>` or `<input>` might.

| Key                       | English      | Notes                                                  |
| ------------------------- | ------------ | ------------------------------------------------------ |
| `game.workspace.gamePane` | Simulation   | `aria-label` of `.pane-game`                           |
| `game.workspace.codePane` | Code editor  | `aria-label` of `.pane-code`                           |
| `game.workspace.splitter` | Editor width | `aria-label` of the `role="separator"` splitter handle |

### `src/main.ts` — 2 keys

| Key                     | English                                                                                   | Notes                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `editor.storageRefused` | Not saved — this browser will not store it. Your program is here until you close the tab. | off `storage_refused`, into `#storage_status`; announced rather than drawn, and emptied again by the next `saved` |
| `fitness.measuring`     | Measuring fitness...                                                                      | `console.info`, before `window.runFitnessSuite`'s own summary line; the suite draws nothing on the page           |

### `src/pages/game/index.ts` — 2 `editor.*` keys

| Key                       | English                                                      | Notes              |
| ------------------------- | ------------------------------------------------------------ | ------------------ |
| `editor.confirmReset`     | Do you really want to reset to the default implementation?   | a `window.confirm` |
| `editor.confirmUndoReset` | Do you want to bring back the code as before the last reset? | a `window.confirm` |

Both are asked by the `onResetCode` and `onUndoReset` callbacks `App` hands to `presentControls`.
They were `src/main.ts`'s until the run buttons were gathered into one row: the two buttons that
ask them are drawn by `src/pages/game/index.ts` now, and the app is what knows the editor.

`fitness.measuring` is filed here rather than under `src/app/fitness.ts` because that is where it
is printed; the benchmark itself stopped touching the page.

### `src/ui/editor.ts` and `src/ui/default-code.ts` — 2 keys

| Key                       | English                                                                                                        | Notes                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `editor.label`            | Elevator program                                                                                               | the editor's `aria-label`              |
| `editor.defaultCode.code` | { init: function(elevators, floors) { const elevator = elevators[0]; // Let's use the first elevator // Whene… | code; only the comments are translated |

`defaultCode()` in `src/ui/default-code.ts` is a function and not a constant, for the reason its
own JSDoc gives: `t` answers for the locale active when it is called, and a module-scope `const`
would answer for whichever locale happened to be active when the module was first imported. The
same file's `DEV_TEST_CODE` is deliberately outside the catalog — no player ever sees it now that
`#devtest` has been retired; it is the yardstick `level-tiers-solutions.test.ts` measures the
tiers against, and a fixture whose comments moved with the language would be a different fixture in
each locale.

### `src/features/manage-code-slots/ui/code-slots.ts` — 3 `editor.slot.*` keys

The code slot switcher: three buttons in the bar above the editor, one per independent scratch
slot a level can hold. All three keys are dynamic now, and none is written by `index.html`:
`editor.slot.tablist.label` names the `.slots` group in `editorPaneTemplate`
(`src/widgets/editor-pane/ui/editor-pane.ts`), and `codeSlotTemplate` calls the other two once per
button, with `{number}`, the same pattern `game.elevator.label` uses for the car index. They are
prefixed `editor.` rather than `page.` because they name a control that belongs to the editor
rather than to the page shell around it.

`editor.slot.tab.label` used to read "Code slot {number}" and sit in an `aria-label` over a button
whose visible text was the bare number. It is the visible text itself now, which is what WCAG 2.5.3
(Label in Name) asks: an accessible name of "Code slot 1" over a visible "1" contains neither the
other, so a player saying "click code one" was matching against a sentence nobody had shown them.

| Key                         | English        | Notes                                                                                                                                       |
| --------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `editor.slot.tablist.label` | Code slots     | the `aria-label` of the `.slots` group, written by `editorPaneTemplate`                                                                     |
| `editor.slot.tab.label`     | Code {number}  | takes `{number}`; the visible text of one `.codeslot` button, and so its accessible name                                                    |
| `editor.slot.tab.title`     | Draft {number} | takes `{number}`; the `title` on the same button — a description beside the name, saying the three are drafts rather than versions or tries |

### `src/game/levels.ts` — 14 keys

| Key                                          | English                                                                                                     | Notes                                                                                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `level.transportWithinTime.html`             | Transport {people} in {time} or less                                                                        | markup; takes `{people}`, `{time}`                                                                                                      |
| `level.transportWithMaxWait.html`            | Transport {people} and let no one take more than {waitTime} to be delivered                                 | markup; takes `{people}`, `{waitTime}`                                                                                                  |
| `level.transportWithinTimeWithMaxWait.html`  | Transport {people} in {time} or less and let no one take more than {waitTime} to be delivered               | markup; takes `{people}`, `{time}`, `{waitTime}`                                                                                        |
| `level.transportWithinMoves.html`            | Transport {people} using {moves} or less                                                                    | markup; takes `{people}`, `{moves}`                                                                                                     |
| `level.transportWithinMovesWithMaxWait.html` | Transport {people} using {moves} or less and let no one take more than {waitTime} to be delivered           | markup; takes `{people}`, `{moves}`, `{waitTime}`                                                                                       |
| `level.people.html`                          | `<span class='emphasis-color'>`{count}`</span>` people                                                      | plural (one, other; `one` is "person"); markup; takes `{count}`; shared by all five sentences above                                     |
| `level.timeLimit.html`                       | `<span class='emphasis-color'>`{count}`</span>` seconds                                                     | plural (one, other); markup; takes `{count}`; the accusative «за 30 секунд» in Russian                                                  |
| `level.waitLimit.html`                       | `<span class='emphasis-color'>`{count}`</span>` seconds                                                     | plural (one, other); markup; takes `{count}`; the same English as above and the genitive «дольше 30 секунд» in Russian                  |
| `level.moveLimit.html`                       | `<span class='emphasis-color'>`{count}`</span>` elevator moves                                              | plural (one, other); markup; takes `{count}`                                                                                            |
| `level.sandbox.html`                         | Sandbox: {floors}, {elevators} of {capacityLabel} {capacities}, {spawnRate}. No goal, so the run never ends | markup; takes `{floors}`, `{elevators}`, `{capacityLabel}`, `{capacities}`, `{spawnRate}`; composed from the four sandbox phrases below |
| `level.sandbox.floors.html`                  | `<span class='emphasis-color'>`{count}`</span>` floors                                                      | plural (one, other); markup; takes `{count}`                                                                                            |
| `level.sandbox.elevators.html`               | `<span class='emphasis-color'>`{count}`</span>` elevators                                                   | plural (one, other); markup; takes `{count}`                                                                                            |
| `level.sandbox.capacityLabel`                | capacities                                                                                                  | plural (one, other); counted by how many capacities were listed, not by how many cars there are                                         |
| `level.sandbox.spawnRate.html`               | `<span class='emphasis-color'>`{count}`</span>` people per second                                           | plural (one, other); markup; takes `{count}`; one English form for both categories, preserving today's `1 people per second`            |

All six descriptions render through `t` inside a `get description()` on the condition object —
`requireUserCountWithinTime`, `requireUserCountWithMaxWaitTime`,
`requireUserCountWithinTimeWithMaxWaitTime`, `requireUserCountWithinMoves`,
`requireUserCountWithinMovesWithMaxWaitTime` and `requireSandbox`. A getter and not a constant, for the reason under _Rules the wiring has to
keep_. The sandbox's numbers all go through `exact`, because they came out of the address bar and
`Intl.NumberFormat`'s default is three _fraction_ digits, not three significant ones — the
distinction does not matter for `spawnrate=0.0625`, which either way rounds to `0.063`, but it is
why `exact` asks for `maximumFractionDigits` rather than for significant digits:

```sh
node -e 'const f = new Intl.NumberFormat("en");
  console.log(f.resolvedOptions().maximumFractionDigits, f.format(0.0625))'   # 465 0.063
```

### `src/ui/completions.ts` — 37 `completion.*` keys

The editor's completion popup. Only the `info` prose is keyed: a `label` is an identifier the
popup inserts into the player's program and a `detail` is that identifier's signature, so both
stay English in every language — completing `goToFloor` into anything else would be suggesting
code that does not exist.

The tables in this module hold keys rather than rendered entries, and `elevatorMembers` and its
neighbors turn them into completions per call. That shape is not decoration: the module is
imported long before the player's language is resolved, so a module-scope constant holding
rendered prose would be English for the rest of the session whatever the page around it said.
`levels.ts` repairs the same fault with `get description()` and `default-code.ts` with a
nullary function.

| Key                                            | English                                                                                                        | Notes                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `completion.events.on`                         | Register a listener. Several event names separated by spaces register the same listener for all of them, and … |                                                                               |
| `completion.events.once`                       | Register a listener that runs at most once and is then removed. Takes a single event name.                     |                                                                               |
| `completion.events.one`                        | The older name for once, and the one the original game gave you. Same behavior, single event name as well.     |                                                                               |
| `completion.events.off`                        | Remove listeners. With a function, removes just that function; without one, removes every listener of the nam… |                                                                               |
| `completion.events.offAll`                     | Remove every listener you registered, for every event, on that elevator or floor. The listeners the game itse… |                                                                               |
| `completion.elevator.goToFloor`                | Queue the elevator to go to specified floor number. If you specify true as second argument, the elevator will… | the first two sentences of `docs.api.elevator.goToFloor.html`, without markup |
| `completion.elevator.stop`                     | Clear the destination queue and stop the elevator if it is moving. Note that the elevator will probably not s… |                                                                               |
| `completion.elevator.currentFloor`             | Gets the floor number that the elevator currently is on. Note that this is a rounded number and does not nece… |                                                                               |
| `completion.elevator.goingUpIndicator`         | Gets or sets the going up indicator, which will affect passenger behavior when stopping at floors.             |                                                                               |
| `completion.elevator.goingDownIndicator`       | Gets or sets the going down indicator, which will affect passenger behavior when stopping at floors.           |                                                                               |
| `completion.elevator.maxPassengerCount`        | Gets the maximum number of passengers that can occupy the elevator at the same time.                           |                                                                               |
| `completion.elevator.loadFactor`               | Gets the load factor of the elevator. 0 means empty, 1 means full. Varies with passenger weights, which vary … |                                                                               |
| `completion.elevator.isFull`                   | Gets whether every spot in the elevator is taken. Use this rather than comparing loadFactor to 1 - passenger … |                                                                               |
| `completion.elevator.isEmpty`                  | Gets whether the elevator is carrying nobody at all. Not the opposite of isFull - an elevator with one passen… |                                                                               |
| `completion.elevator.destinationDirection`     | Gets the direction the elevator is currently going to move toward.                                             |                                                                               |
| `completion.elevator.isApproachingFloor`       | Gets whether the elevator is moving toward the given floor and has not passed it yet. Only the direction of t… |                                                                               |
| `completion.elevator.destinationQueue`         | The current destination queue, meaning the floor numbers the elevator is scheduled to go to. Can be modified … |                                                                               |
| `completion.elevator.checkDestinationQueue`    | Checks the destination queue for any new destinations to go to. Note that you only need to call this if you m… |                                                                               |
| `completion.elevator.getPressedFloors`         | Gets the currently pressed floor numbers as an array.                                                          |                                                                               |
| `completion.elevator.servedFloors`             | Gets the floors this elevator serves, as an array in ascending order. In a zoned building an elevator only ca… |                                                                               |
| `completion.elevator.takeRequest`              | Books this elevator for a journey somebody asked for, in a building where passengers announce a destination …  | the same sentences as `docs.api.elevator.takeRequest`                         |
| `completion.floor.floorNum`                    | Gets the floor number of the floor object.                                                                     |                                                                               |
| `completion.elevator.event.idle`               | Triggered when the elevator has completed all its tasks and is not doing anything.                             |                                                                               |
| `completion.elevator.event.floorButtonPressed` | Triggered when a passenger has pressed a button inside the elevator.                                           |                                                                               |
| `completion.elevator.event.passingFloor`       | Triggered slightly before the elevator will pass a floor. A good time to decide whether to stop at that floor… |                                                                               |
| `completion.elevator.event.stoppedAtFloor`     | Triggered when the elevator has arrived at a floor.                                                            |                                                                               |
| `completion.floor.event.upButtonPressed`       | Triggered when someone has pressed the up button at a floor. Note that passengers will press the button again… |                                                                               |
| `completion.floor.event.downButtonPressed`     | Triggered when someone has pressed the down button at a floor. Note that passengers will press the button aga… |                                                                               |
| `completion.floor.event.hallButtonPressed`     | Triggered when someone has pressed either call button at a floor. Note that passengers will press the button … | the first three sentences of `docs.api.floor.hallButtonPressed`               |
| `completion.floor.event.buttonStateChange`     | Either call button was lit or cleared.                                                                         |                                                                               |
| `completion.floor.pendingDestinations`         | Gets the journeys people on this floor have asked for and are still waiting on, as an array of {floorNum, wa…  | the same sentences as `docs.api.floor.pendingDestinations`                    |
| `completion.floor.event.destinationRequested`  | Triggered when someone at a floor has asked to be taken to another floor, in a building whose passengers ann…  | the first two sentences of `docs.api.floor.destinationRequested`              |
| `completion.global.skeleton`                   | Your code must declare an object containing at least two functions called init and update.                     | the entry whose `apply` is `docs.basics.example.code`                         |
| `completion.global.init`                       | Called when the level starts. Normally you will put most of your code in here, to set up event listeners a…    |                                                                               |
| `completion.global.update`                     | Called repeatedly during the level, at a fixed rate of 100 times per game second. dt is always that fixed …    |                                                                               |
| `completion.initSkeleton.code`                 | init: function(elevators, floors) {                                                                            | code; only the comments are translated                                        |
| `completion.updateSkeleton.code`               | update: function(dt, elevators, floors) {                                                                      | code; only the comments are translated                                        |

### `src/app/fitness.ts`, `src/game/fitness.ts` and `src/cli/bench.ts` — 10 `fitness.*` keys

| Key                         | English                                                                                                         | Notes                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `fitness.results`           | Fitness avg delivery times: {results}                                                                           | takes `{results}`                                                  |
| `fitness.result`            | {scenario}: {value}                                                                                             | takes `{scenario}`, `{value}`                                      |
| `fitness.unknownValue`      | ?                                                                                                               | shown when a scenario produced no average delivery time            |
| `fitness.error`             | Could not compute fitness due to error: {error}                                                                 | takes `{error}`; read from both files                              |
| `fitness.workerTimeout`     | The fitness worker did not finish within {seconds} and was stopped. Does your program have a loop that never …  | takes `{seconds}`; read by the page and by `npm run bench`         |
| `fitness.workerFailed`      | The fitness worker failed                                                                                       | read by the page and by `npm run bench`                            |
| `fitness.workerOutOfMemory` | The fitness worker ran out of memory and was stopped. Is your program keeping something that grows with every … | read by `npm run bench` only; the page's worker has no such report |
| `fitness.scenario.small`    | Small scenario                                                                                                  | `src/game/fitness.ts`; rendered inside the worker                  |
| `fitness.scenario.medium`   | Medium scenario                                                                                                 | `src/game/fitness.ts`                                              |
| `fitness.scenario.large`    | Large scenario                                                                                                  | `src/game/fitness.ts`                                              |
| `fitness.measuring`         | Measuring fitness...                                                                                            | `src/main.ts`; listed above with the editor's other messages       |

The two worker sentences are read from a second place as well. `src/cli/bench.ts` runs the same
suite in a Node worker thread rather than a browser one, and renders both on the command's side for
the reason the page does: a thread that has missed its deadline is not going to answer a question
about wording. The command follows `--locale`, so these two are translated in a terminal exactly as
they are on the page.

The `?` and the `{scenario}: {value}` line it goes into are separate keys rather than one string
with a hole in it, so neither locale has to make "?" agree with a sentence it did not write. The
`s` that used to be appended to `avgWaitTime.toPrecision(3)` now comes from `waitTimeQuantity` in
`src/app/fitness.ts`, and deliberately not from `seconds`, which its JSDoc rules out by name:
`seconds` fixes the number of decimals where `toPrecision(3)` fixed the number of significant
digits, so it would render 7 as `7.0s` where the benchmark has always printed `7.00s`, and moving
a number on screen is the one thing routing this through the catalog was not allowed to do.

The non-breaking space Russian gets — `12,3 с` beside English's `12.3s` — is not `Intl`'s doing
either. CLDR's narrow unit pattern for Russian carries an ordinary space, and `formatNumber` in
`src/i18n/format.ts` replaces it with `NO_BREAK_SPACE` after formatting, for unit styles only:

```sh
node -e 'const s = new Intl.NumberFormat("ru",
    { style: "unit", unit: "second", unitDisplay: "narrow" }).format(60);
  console.log([...s].map((c) => c.codePointAt(0).toString(16)).join(" "))'   # 465 30 20 441
```

### `src/game/user-code.ts`, `src/game/elevator-interface.ts`, `src/game/movable.ts` — 7 `error.*` keys

Everything a player's own program can make the game say.

| Key                             | English                                                                                                        | Notes                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `error.code.noInit`             | Code must contain an init function                                                                             | thrown, then shown in the code status bar                                |
| `error.code.noUpdate`           | Code must contain an update function                                                                           | thrown, then shown in the code status bar                                |
| `error.elevator.notAFloor`      | elevator.{method} was called with {value}, which is not a floor number. It takes a finite number, and this bu… | takes `{method}`, `{value}`, `{topFloor}`                                |
| `error.elevator.queueNotAFloor` | elevator.destinationQueue contained {value}, which is not a floor number. The entry was dropped so the elevat… | takes `{value}`, `{topFloor}`                                            |
| `error.value.array`             | an array                                                                                                       | goes into `error.elevator.notAFloor` and `error.elevator.queueNotAFloor` |
| `error.value.object`            | an object                                                                                                      | goes into `error.elevator.notAFloor` and `error.elevator.queueNotAFloor` |
| `error.movable.busy`            | Object is busy - you should use callback                                                                       | `src/game/movable.ts`                                                    |

`error.value.array` and `error.value.object` are the pattern Russian punishes: a sentence built
around a noun chosen at run time. The first Russian frame read «В elevator.destinationQueue
попало {value}» — a neuter verb in front of a hole that a player fills with «массив», which is
masculine, by writing `elevator.destinationQueue = [[1, 2]]`. Both frames were rewritten so that
the verb agrees with its own subject and never with `{value}`, and `{value}` lands in the
accusative, which for an inanimate masculine noun is spelled like the nominative; `src/i18n/ru.ts`
carries that reasoning beside the two keys. Prefer whole sentences per key; where composition is
unavoidable, write the frame so that no choice of insert can make it ungrammatical, and test it
with an insert that has a gender — `NaN` is spelled the same in every case and gender, so it
proves nothing.

## Deliberately not translated

Not everything a string literal holds is a message to a player. These were looked at and left in
English on purpose; translating them would cost work and buy nothing, and in some cases would do
harm.

The line the `console` entries below draw is what is being reported, not where it is printed.
Each of them reports a bug, a hand-written URL that would not parse, or a broken invariant, and
is addressed to whoever is reading a stack or an address beside it. `game.seed.console` is
printed to the same console and _is_ keyed, because it reports nothing: it goes out at every
successful start, to a player who has done nothing wrong, to tell them how to play the run
again.

| Where                                                                                                                          | What                                                                                                                                | Why                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/game/index.ts`, the `usercode_error` subscription; `src/game/world-controller.ts`, `handleUserCodeError`            | `World raised code error`, `Usercode error on update`                                                                               | `console` diagnostics. The player sees the same failure translated in the code status bar; the console line is for whoever is reading a stack beside it.                                                                                                 |
| `src/game/movable.ts`, `makeSureNotBusy`                                                                                       | `Attempt to use movable while it was busy`                                                                                          | `console` diagnostic accompanying `error.movable.busy`, which _is_ keyed.                                                                                                                                                                                |
| `src/game/observable.ts`, `report`                                                                                             | `Event error handler threw while reporting`                                                                                         | `console` diagnostic about the game's own error reporting failing.                                                                                                                                                                                       |
| `src/app/fitness.ts`, `tryCreateWorker`                                                                                        | `Fitness worker creation failed, running on the main thread instead`                                                                | `console` diagnostic; the player sees only the result.                                                                                                                                                                                                   |
| `src/i18n/index.ts`, the `catch` inside `loadLocale`                                                                           | `Could not load the ru messages; staying in en`                                                                                     | `console` diagnostic about the translation machinery itself. Saying it in the language that failed to load is not an option.                                                                                                                             |
| `src/ui/localize-page.ts`, `warnUnusable`                                                                                      | `Ignoring {attribute}="{key}": the page shell can only name a message that exists and takes no parameters`                          | Addressed to whoever wrote the attribute, quoting an attribute name.                                                                                                                                                                                     |
| `src/game/elevator.ts`, `getFirstPressedFloor`                                                                                 | The deprecation notice, printed once per session behind a module flag                                                               | Addressed to code, quoting an API name.                                                                                                                                                                                                                  |
| `src/pages/game/model/route.ts`, the twelve `console.warn` calls                                                               | `Invalid seed "…", using a fresh one instead`, and eleven more                                                                      | Addressed to whoever hand-wrote the URL, quoting parameter names that are themselves English.                                                                                                                                                            |
| `src/game/world.ts`, `resolveSpawnRate`                                                                                        | `World was created with a spawnRate of …`                                                                                           | Reached only through `WorldOptions`, which is engine-internal and typed; a player's program cannot produce it.                                                                                                                                           |
| `src/shared/lib/dom.ts` `requireElement`; `src/ui/templates.ts` `renderElement`; `renderUser`, what was `src/ui/presenters.ts` | `Missing required element`, `Expected markup describing exactly one element`, `Expected the user template to render an SVG element` | Invariants. If a player ever reads one, the bug is that it was thrown, not that it was in English.                                                                                                                                                       |
| `src/game/fitness.ts`, `requireNothing`                                                                                        | `No requirement`                                                                                                                    | The benchmark's placeholder condition. Nothing draws a level bar during a benchmark, so it never reaches a screen.                                                                                                                                       |
| `src/ui/completions.ts`, the `label` and `detail` fields                                                                       | `elevator.goToFloor`, `(floorNum, directly)`, …                                                                                     | Identifiers and signatures. The popup completes real API names; translating one would suggest code that does not exist. Only `info` is keyed.                                                                                                            |
| `src/ui/default-code.ts`, `DEV_TEST_CODE`                                                                                      | The tier-calibration program                                                                                                        | No player ever sees it: `#devtest` is retired, and what reads it is `level-tiers-solutions.test.ts`, which measures rather than teaches.                                                                                                                 |
| `src/ui/shortcuts.ts`, `modifierKeyLabel`                                                                                      | `⌘` / `Ctrl`                                                                                                                        | Key names. Russian keyboards are labeled `Ctrl` too.                                                                                                                                                                                                     |
| `index.html` and `documentation.html`, `<meta charset>` and `<meta name="viewport">`                                           | `UTF-8`, `width=device-width, initial-scale=1`                                                                                      | Machine values, not prose.                                                                                                                                                                                                                               |
| `documentation.html`, the link to `documentation.ru.html`                                                                      | `Русский`                                                                                                                           | A language's own name. `LOCALE_NAMES` in `src/i18n/locale.ts` holds these, deliberately outside the catalogs: a reader who needs Русский has to find it while the interface is still English.                                                            |
| `documentation.html`, the one-line snippets in _Code examples_                                                                 | `elevator.on("floor_button_pressed", function(floorNum) { … });`                                                                    | Code with no comments in it. Nothing to translate — and `src/page.test.ts` holds that both ways round, so a comment added to one of them fails the suite.                                                                                                |
| `public/elevatorsaga.d.ts`, the whole file                                                                                     | The JSDoc an editor shows over `elevator.goToFloor`                                                                                 | Its own header decides this: the prose is the English of `documentation.html` in both languages' builds, because the names it describes are English identifiers either way and two translations of a declaration would be a second pair to keep in step. |
| `src/game/test-helpers.ts`, `*.test.ts`, `e2e/`                                                                                | Test messages                                                                                                                       | Read by whoever ran the tests.                                                                                                                                                                                                                           |
| `licenses.txt`, generated into `dist/` by `vite.config.ts`                                                                     | License texts                                                                                                                       | Legal texts are quoted, not translated.                                                                                                                                                                                                                  |

**One that is not a decision anybody wrote down.** `src/pages/game/index.ts` prints a line at every start
— `Seed … — the same passengers again, though never quite the same run: …` — and it is prose
addressed to the player, not a diagnostic. It says in English roughly what
`game.seed.explanation` says in the catalog in both languages. The comment above it says why the
line is printed — nobody knows a run is worth repeating until it has already gone wrong — and
says nothing about the language, and the line was written after the catalog existed, so this is
an omission rather than a leftover. It is either worth keying or worth cutting back to the seed
and the URL.

## What could not be keyed cleanly

Seven places where the English source resists a one-string-one-key mapping. All seven are keyed
and all seven ship, so this is a record of how each was resolved rather than a proposal.

1. **Level descriptions are built from parts.** Each of the five builders in
   `src/game/levels.ts` interpolates two or three counted phrases into one sentence, and
   every phrase needs its own plural. One key per sentence, plus one key per phrase
   (`level.people.html`, `level.timeLimit.html`, `level.waitLimit.html`,
   `level.moveLimit.html`), rendered inside out:

   ```ts
   t("level.transportWithinTime.html", {
     people: t("level.people.html", { count: userCount }),
     time: t("level.timeLimit.html", { count: timeLimit }),
   });
   ```

   The alternative — one key per sentence with `{count}` in it — cannot work: a message has one
   plural category, and these sentences count two different things.

2. **Two keys whose English is identical.** `level.timeLimit.html` and
   `level.waitLimit.html` are both "{count} seconds" and neither can be dropped: Russian
   needs the accusative after «за» — «за 21 секунду», «за 30 секунд» — and the genitive after
   «дольше» — «дольше 21 секунды», «дольше 30 секунд». Two of Russian's four forms differ between
   them, so a shared key would be wrong in one of the two sentences for every limit ending in 1,
   2, 3 or 4. Anyone tempted to deduplicate them by their English is looking at the wrong
   language.

3. **`1 people per second`.** `level.sandbox.spawnRate.html` is a plural message whose two
   English forms are the same string, so a sandbox running at one passenger a second still says
   `1 people per second` — exactly what it said before the catalog existed. That was preserved
   rather than fixed, so that wiring the strings up changed nothing on screen, and `src/i18n/en.ts`
   says so beside the key and points here. Russian declines it properly, which is why only the
   English is odd. This is the one wording in the catalog known to be wrong, and correcting it
   is a one-word edit to `en.ts`.

4. **The sandbox's list of capacities is punctuated by the locale.** `formatList`, not a `", "`
   join, because Russian writes decimals with a comma: a joined list reads «вместимостью 6, 9»,
   which is also how six point nine is written. `formatList` gives «6 и 9», which cannot be read
   as one number — and "6 and 9" in English, which reads better anyway.

5. **A message that is a symbol.** `game.timeScale.instant` is `∞x` in English and `∞×` in
   Russian, and it is in the catalog for the sake of one character. The infinity sign is the
   same everywhere; the multiplication sign is not, and Russian writes `×` where English writes
   the Latin letter x — the same split `game.timeScale.value` already had. A translator opening
   the file finds a row that looks untranslatable and is not:

   ```ts
   "game.timeScale.instant": "∞x",
   ```

   Nothing else about the label is prose, which is why the sentence explaining what that stop
   does is a second key, `game.timeScale.instantTitle`, rather than a longer label. A separator
   space is no longer among these cases: the run buttons write their word into a `.lbl` span
   beside the icon rather than as a text node after it, so the gap is the stylesheet's.

6. **One `<h1>`, one string, and the same string in both catalogs.** `page.brand` is the whole
   of the heading, and it is `"Elevator Saga"` in English and in Russian alike: the brand is a
   name, and a name does not translate. The heading used to carry a tagline beside it in the same
   element — "The elevator programming game" — and the two were keyed apart precisely because
   that half _was_ prose and did have to move. The app bar drops the tagline, so the split it
   forced is gone with it.

7. **The docs and the editor say the same thing twice.** `completion.elevator.goToFloor` is the
   first two sentences of `docs.api.elevator.goToFloor.html` without its markup, and it is not
   the only such pair. They are separate keys on purpose: one is plain text in a completion popup,
   the other is markup in a table, and some docs entries have since grown detail the popup does
   not want. What keeps them from drifting is `src/page.test.ts`, in two cases — one for the
   pairs whose English is identical, one for the pairs where the popup's English is a prefix or a
   substring of the page's, which then requires the Russian to be cut the same way. That second
   case exists because the drift it caught was real and was Russian-only.

## Rules the wiring has to keep

Four traps. Each was sprung at least once, and each can be sprung again by the next module that
reaches for `t`.

- **A module-scope constant freezes the language at import time.** `t` answers for the locale
  active when it is called, and modules are imported long before a language is resolved. Three
  files repair this in three shapes, and the shape is chosen by what holds the value:
  `src/game/levels.ts` uses `get description()` because callers hold the condition object;
  `src/ui/default-code.ts` uses a nullary `defaultCode()`; `src/ui/completions.ts` keeps tables
  of keys and renders per call because nothing holds a reference to a completion list.
  `fitnessLevels` is a nullary function that deliberately keeps the constant's name, because
  what other modules mean by it — the list of buildings — did not change.
- **A worker is a second module instance.** `src/app/fitness.ts` posts the player's source to
  `src/app/fitness-worker.ts`, which has its own copy of `src/i18n/index.ts` and its own active
  locale. The locale therefore travels with the request in `FitnessWorkerRequest`, and the worker
  calls `setLocale` on arrival, per message rather than once at import. Anything else that ends
  up in a worker needs the same treatment: a worker inherits nothing from the page that spawned
  it.
- **A static import of a catalog puts it in every chunk that reaches a `t()`.**
  `src/i18n/index.ts` records the measurement that decided this: with both catalogs imported
  statically the page's entry chunk was 135.87 kB and the fitness worker — which draws no
  interface at all — was 95.32 kB, both carrying the whole Russian catalog. So every catalog
  but English is an `import()` of its own, in `CATALOG_LOADERS`. Do not `import { RU_MESSAGES }`
  and do not re-export it from a module the page imports; `src/i18n/index.ts` re-exports English
  only, and the test files that want the Russian catalog as data import `./ru.ts` directly,
  which reaches no bundle.
- **`setLocale` starts the fetch and does not wait for it.** `await loadLocale(locale)` before
  redrawing, or the interface stays English until the catalog lands. A message asked for before
  its catalog arrives renders in English whole — never a raw key, and never an English sentence
  with Russian decimal commas in it, which is why English stays bundled rather than being split
  like the rest.

Start-up is where all four meet. `src/main.ts` awaits `applyPreferredLocale` from
`src/ui/preferred-locale.ts` before the app is constructed: it resolves the language, sets it,
waits for the catalog and writes the shell, so nothing is ever drawn in one language and
replaced in another. `resolveLocale` reads `#lang=` first, then `localStorage`, then
`navigator.languages`, then English, and `browserLocaleSources` reads each source behind its own
`catch` — a browser that throws on `localStorage`, such as Safari in a private window, falls
through to the next source instead of failing to start. None of those three sources calls
`storeLocale`, and `preferred-locale.ts` says why at length: a language found in somebody else's
link is not a choice this reader made. The language picker is what writes storage.

`#lang=ru` needs nothing from `src/pages/game/model/route.ts`, and that is not luck: `parseQuery` keeps every
parameter it finds rather than the ones it understands, and `createParamsUrl` rebuilds the hash
from all of them, replacing only what a link overrides. The language therefore rides along
through the level row and the next-level link without either of them knowing about it.

Changing language mid-run goes through `presentLanguagePicker` in
`src/features/switch-language/ui/language-picker.ts`.
Its `<select>` is one tab stop rather than one per language, announces its own current value
without an `aria-current` to maintain, and opens the platform's own picker on a phone. Its
options are `LOCALE_NAMES`, built from `LOCALES` rather than written out, so a third language
needs no edit to the control and none to `index.html`, which ships the `<select>` empty.

## What guards what

| Test                           | What it holds                                                                                                                                                                                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the type system                | Key parity in both directions, and the right number of plural forms per language. A Russian catalog missing a key does not compile.                                                                                                                                                                  |
| `src/i18n/catalog.test.ts`     | Key order, non-empty values, `{placeholder}` parity, markup confined to `.html` keys and opening and closing the same tags in every locale, `.code` blocks identical but for their comments, the WCAG 2.5.3 pair, and Russian typography — «ёлочки» in pairs, spaced em dashes, ё, no double spaces. |
| `src/i18n/format.test.ts`      | `PLURAL_CATEGORIES` against what ICU actually says, so a wrong guess about a new language fails a test rather than mistranslating a count.                                                                                                                                                           |
| `src/ui/localize-page.test.ts` | That every key `index.html` names exists and takes no parameters; that the shell ships, word for word, the English of every message it names; that the noscript paragraph is left alone; that the modifier keys are relabeled after the shell is rewritten.                                          |
| `src/page.test.ts`             | The two documentation pages as one document in two languages, every `docs.*` message against the passage it was lifted from in both languages, no `docs.*` key left unchecked, and the popup against the page wherever their English agrees.                                                         |
| `src/i18n/inventory.test.ts`   | This file: the keys it names, the keys it omits, the counts it prints, the `src/` paths it points at, the absence of line pins, and the learning track's quoted titles. Not the rest of its prose.                                                                                                   |

That last row said **nothing** through two rebuildings of this document. What closes most of it
is `src/i18n/inventory.test.ts`, which reads this file with `?raw` and checks it against the two
English catalogs, `EN_MESSAGES` and `EN_DOCS_MESSAGES`, read together as the one set of keys a
locale publishes:

1. Every backticked token in this file shaped like a message key — dotted, and with a first
   segment that is one of the catalog's prefixes — is a real `MessageKey`. This catches a key
   renamed in the catalog and left behind here.
2. Every key either catalog holds is named here, except the 64 `tutorial.levelN.*` keys the
   learning track section covers by their shape — its prose and its two programs alike. This
   catches a message added without a row.
3. The **Keys** column of _Where the strings are_ equals the number of keys under each prefix,
   and the **Total** equals how many there are in all.
4. Every backticked `src/…` path exists on disk. This catches a renamed module. Keep it to
   `src/`: a message key such as `docs.play.start.html` is shaped like a file name and is not
   one, and `licenses.txt` only exists once the build has run.
5. No `file.ts:123` pin below _How this file is anchored_, so the convention cannot quietly
   lapse. The two in that section are the examples of what it prevents, and are meant to stay
   wrong.
6. The learning track's table quotes each level title as `EN_MESSAGES` words it, and carries a row
   for every level in it. This is the one column of prose comparable by equality — the titles are
   copied whole rather than abridged — and it had already rotted when the check was added: level
   6's row said "lies to passengers" where the catalog says "lies to its passengers", through
   five checks that all passed because none of them read the column.

What it does not check is everything that cannot be read off `EN_MESSAGES`: the English column of
_The strings_, which is abridged on purpose and so cannot be compared; the Notes and the _What
reads them_ column; the counts in the section headings, which count what a section lists rather than what
the catalog holds; and the 81 and 82 above, which come from a grep over the whole tree. Those
are still prose and can still go quietly out of date. The test's own header says as much, so
whoever reads it knows which columns are guarded and which are taken on trust.

## What changed on screen when this was wired

Even in English, routing text through the catalog changed three things. All three are
improvements, and all three are visible.

1. **Grouped thousands.** Level 18 asks for 2675 people —
   `requireUserCountWithinTimeWithMaxWaitTime(2675, 1800, 45)` — and used to render `2675`;
   `Intl.NumberFormat` renders `2,675` in English and `2 675` in Russian.
2. **Fractional time scales** render `0.5x` in English and `0,5×` in Russian.
3. **Non-breaking spaces** appear between numbers and unit abbreviations in Russian, so `60 с`
   cannot break across a line.

There was a fourth, and it is worth recording where it went. The save confirmation under the
editor had its time formatted through the catalog too, which took `21:03:57 GMT+0300 (Moscow
Standard Time)` down to `21:03:57`; the line itself is gone now, with the message and the
`formatTimeOfDay` wrapper behind it, because there is no status line under the editor and a
confirmation that reports the same success every few seconds is not news.

## Known overlap: `documentation.ru.html`

While this catalog was being written, another change added `documentation.ru.html` — a
separate, fully translated Russian copy of the reference page, with `hreflang` alternates linking
the pair. That covers the same ground as the 86 unread `docs.*` keys, by a different route: a
static file per language instead of one document translated at run time.

Both were kept, which would ordinarily mean maintaining the Russian documentation twice — and it
did: a review of the Russian page put a dozen corrections into `documentation.ru.html`, and every
one of them stayed there while `ru.ts` went on saying the thing that had been corrected.
`src/page.test.ts` now closes that gap from both ends, so the duplication is still there and can
no longer drift silently. What it used to cost besides the upkeep — the whole of the help text
in every player's first download — the move to `src/i18n/docs-en.ts` has taken away. That turns
the choice below from pending into deferred:

- **Keep the static pages** and drop the `docs.*` keys from the catalog, or generate
  `documentation.ru.html` from them at build time. The 86 unread keys have no other call site, so
  removing them touches nothing else — but `docs.basics.example.code` does have one, and would
  have to stay, which is why it never left `src/i18n/en.ts`.
- **Keep the catalog** and reduce `documentation.ru.html` to a redirect.

Whoever takes it up should read `src/page.test.ts` first: whichever side is dropped, those
assertions are the specification of what the surviving side has to keep saying.

## Adding a language

One catalog file, plus three lines the compiler demands anyway:

1. Add the code to `Locale` and `LOCALES` in `src/i18n/locale.ts`, and its endonym to
   `LOCALE_NAMES`. The language picker needs no edit at all: the options are built from
   `LOCALES`.
2. Add the plural categories `Intl` gives that language to `PLURAL_CATEGORIES` in
   `src/i18n/format.ts`. `src/i18n/format.test.ts` checks the list against ICU, so a wrong guess
   fails a test rather than mistranslating a count.
3. Write `src/i18n/<code>.ts` as `MessageCatalog<"<code>">`. Every missing key, every extra key
   and every missing plural form is a compile error.
4. Register it in `CATALOG_LOADERS` in `src/i18n/index.ts`, as a one-line loader that
   `await import()`s the file and assigns it to that locale's own slot. Assigning to the slot by
   name is what makes step 3 bite: the Russian entry is checked against Russian's four plural
   forms and the English one against English's two. The `import()` sits inside that assignment
   rather than around it, so splitting the catalog out of the bundle costs none of the
   checking.

The reference page is a separate job and deliberately so: the game no longer links to it, so the
set of catalogs and the set of translated pages are free to differ. A catalog is one file a
translator can finish in an afternoon; the reference page is nine hundred lines of tables. Ship
the interface first.

The tests in `src/i18n/catalog.test.ts` then check the new catalog for key parity, placeholder
parity, markup that matches the English structure, and example code identical to the English but
for its comments.
