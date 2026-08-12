# Localisation inventory

Every string the game shows a player, the key it has in `src/i18n/`, and what reads that key.
Part map of the catalogue, part record of the decisions the wiring took and the reasons behind
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
  done | sort | uniq -c                                          # 95 moved, 129 same
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

**What is machine-checked, and what is not.** The catalogues check each other, and several
tests hold the catalogue against what draws from it — see _What guards what_ at the end. One of
them now reads this file: `src/i18n/inventory.test.ts` holds the keys it names, the keys it
omits, the counts it prints and the files it points at against `EN_MESSAGES` and the tree. What
that cannot read is the prose — the English column, the Notes, and every claim about which
module calls what — so a row can still be right about its key and wrong about everything beside
it.

Everything here was re-measured against the tree on **12 August 2026**.

## The module

| File                     | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/i18n/locale.ts`     | `Locale`, `LOCALES`, `DEFAULT_LOCALE`, `LOCALE_NAMES`, `isLocale`, `htmlLang`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/i18n/format.ts`     | `Intl` wrappers: `quantity`, `decimal`, `exact`, `seconds`, `formatNumber`, `formatValue`, `formatList`, `formatTimeOfDay`, `selectPlural`, `interpolate`, `PLURAL_CATEGORIES`, and the types `Quantity`, `ParamValue`, `Countable`, `PluralCategory<L>`, `PluralForms<L>`                                                                                                                                                                                                                                                                                      |
| `src/i18n/catalogue.ts`  | `MessageKey`, `MessageCatalogue<L>`, `MessageParams<K>`, `MessageArgs<K>`, `translate`                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/i18n/en.ts`         | `EN_MESSAGES` — the reference locale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/i18n/ru.ts`         | `RU_MESSAGES` — the Russian catalogue, with its glossary and its translation rules at the top                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/i18n/detect.ts`     | `resolveLocale`, `browserLocaleSources`, `localeFromQuery`, `readStoredLocale`, `storeLocale`, `localeFromLanguages`, `LOCALE_QUERY_KEY`, `LOCALE_STORAGE_KEY`, `LocaleSources`                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/i18n/index.ts`      | `t`, `translateIn`, `getLocale`, `setLocale`, `loadLocale`, `isLocaleLoaded`, `format`, `formatTime`, `formatList`, `CATALOGUE_LOADERS`, and a re-export of most of the above. Four of those exports do not come through: `RU_MESSAGES`, deliberately, since a re-export is a static import; `interpolate` and `MessageParams`, which nothing outside `catalogue.ts` uses; and `format.ts`'s `formatList`, because the `formatList` here is a different function — a wrapper that supplies the active locale, importing the other under the name `formatListIn` |
| `src/i18n/test-setup.ts` | No exports. Vitest's one setup file, named as `setupFiles` in `vite.config.ts`: it awaits every catalogue before a test file's first line, because catalogues are fetched rather than bundled and a dozen test files say `setLocale("ru")` and assert about Russian next                                                                                                                                                                                                                                                                                        |

Calling it looks like this:

```ts
import { format, seconds, setLocale, t } from "./i18n/index.ts";

t("game.button.start"); // "Start" / "Старт"
t("game.elevator.label", { number: 3 }); // "Elevator 3" / "Лифт 3"
t("challenge.people.html", { count: 5 }); // 5 people / 5 пассажиров
format(seconds(60)); // "60s" / "60 с"
setLocale("ru"); // everything drawn after this renders in Russian
```

The parameters are named and typed per key: `t("game.elevator.label")` with no arguments, or
with `{ floor: 3 }` instead of `{ number: 3 }`, does not compile. Counts go through
`Intl.PluralRules`, which is why Russian gets four forms where English gets two —
`challenge.sandbox.spawnRate.html` renders 1 пассажир, 2 пассажира, 5 пассажиров, 1,5 пассажира
— and numbers go through `Intl.NumberFormat`, which is why Russian gets `1,5` and a
non-breaking space before a unit.

The Russian counted phrases are not always in the dictionary form, and `src/i18n/ru.ts` says why
at length under _Numerals_: they have to be grammatical in the sentence they are built into.
After «Перевезите» the noun is accusative, so `challenge.people.html` reads 1 пассажира rather
than the nominative 1 пассажир.

## How to read the tables

- **Key** — what to pass to `t`, and the only address a row has. Where the message is used is
  the heading it sits under; to find the call site, grep for the key.
- **English** — the reference wording, shortened to fit: whitespace collapsed to one line, long
  values cut and marked `…`, markup dropped unless the row is about the markup, and a `.code`
  block reduced to as much as makes it recognisable. Where a message has plural forms this is
  the `other` form. `src/i18n/en.ts` is the authority, not this column — nothing here is quotable
  as the message.
- **Notes** — plural categories, the parameters the message takes, and anything about the call
  site that whoever edits the message has to respect.

Key names carry two suffixes that mean something:

- `.html` — the value is trusted markup, for `innerHTML` or a `raw()` interpolation. Everything
  in one comes from this repository; nothing a player wrote is ever interpolated into one. Every
  other key is plain text for `textContent`, an attribute or `confirm()`.
- `.code` — the value is example code. Only its `//` comments are translated; the code itself is
  byte-identical in every locale, and `src/i18n/catalogue.test.ts` enforces that rather than
  trusting it.

## Where the strings are

The catalogue holds **301 keys** in two locales. `src/i18n/en.ts` is the reference — its text is
the English wording, extracted verbatim — and `src/i18n/ru.ts` is the Russian translation. The
types make English the shape everything else is measured against: a Russian catalogue missing a
key, carrying a key English does not have, or giving a plural message the wrong number of forms
is a compile error, not a runtime surprise.

```sh
grep -cE '^  "[^"]+":' src/i18n/en.ts                                   # 301
grep -oE '^  "[^"]+"' src/i18n/en.ts | tr -d '"' | cut -d. -f1 | sort | uniq -c | sort -rn
```

| Prefix         | Keys    | What reads them                                                                                                                         |
| -------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `docs.*`       | 85      | one of them, `docs.basics.example.code`, by `src/ui/completions.ts`; the other 84 by nothing                                            |
| `tutorial.*`   | 79      | `src/ui/tutorial-panel.ts`, `src/ui/templates.ts`, `src/app/app.ts`                                                                     |
| `completion.*` | 33      | `src/ui/completions.ts`                                                                                                                 |
| `page.*`       | 33      | `index.html`, through `data-i18n` and `data-i18n-attr`; `page.noscript` excepted, see below                                             |
| `game.*`       | 30      | `src/ui/templates.ts` (18), `src/ui/presenters.ts` (9), `src/app/app.ts` (5); the two speed labels are written by both of the first two |
| `challenge.*`  | 15      | `src/game/challenges.ts`                                                                                                                |
| `fitness.*`    | 11      | `src/app/fitness.ts`, `src/game/fitness.ts`, `src/main.ts`, `src/cli/bench.ts`                                                          |
| `error.*`      | 10      | `src/game/elevator-interface.ts`, `src/ui/presenters.ts`, `src/game/user-code.ts`, `src/game/movable.ts`                                |
| `editor.*`     | 5       | `src/main.ts`, `src/app/app.ts`, `src/ui/editor.ts`, `src/ui/default-code.ts`                                                           |
| **Total**      | **301** |                                                                                                                                         |

Which keys nothing reads:

```sh
grep -oE '^  "[^"]+"' src/i18n/en.ts | tr -d '"' | while read -r key; do
  grep -rqF --exclude=en.ts --exclude=ru.ts --exclude='*.test.ts' -e "$key" index.html src || echo "$key"
done
```

It lists **83 keys, every one of them `docs.*`**. Two things it cannot see, both of which make it
optimistic rather than pessimistic: it matches text rather than calls, so a key that is a prefix
of another key counts as read whenever the longer one is, and a key named only in a comment
counts as read too. The prefix case costs nothing today — the same grep with each key required to
end where the key ends lists the same 83 — and the comment case costs two. `page.noscript` is one:
nothing renders it, and `index.html` names it in a comment saying so. `docs.play.statistics.html`
is the other, and was missed when this figure was last written: it is a paragraph of the reference
page like its neighbours, and `src/game/world.ts` names it twice in prose explaining what the
statistics panel measures. So the true figure is 85. The grep also needs
`src/ui/tutorial-panel.ts` and `src/game/tutorial.ts` to be in the tree, since between them that
is what reads the 64 `tutorial.task*` messages: the panel each task's prose, the task table each
task's two programs.

**`page.noscript` cannot be wired, and the comment in `index.html` is the reason.** A browser
running this code parses the children of `<noscript>` as text rather than as elements, so in the
only situation where the message could be replaced there is nothing there to replace; and a
browser with scripting off has nothing running to replace it with. The key is kept for the day
the build renders the shell per language.
`src/ui/localise-page.test.ts`, in "leaves the noscript message in English, where it cannot be
reached", pins that: it parses the page with `DOMParser`, which _does_ see the paragraph, and
requires `localisePage` to leave it alone even in Russian.

**The 84 `docs.*` keys have no call site because the reference page answers for itself.**
`documentation.html` and `documentation.ru.html` are two static files rather than one document
translated at run time. That duplication is deliberate and no longer silent — see _Known
overlap_ at the end, and `src/page.test.ts`, which holds the two pages and the two catalogues in
step.

## The strings

### `index.html` — the page shell, 33 `page.*` keys

The shell ships its English in the markup and names the message beside it: `data-i18n` for an
element's words, `data-i18n-attr="attribute:key"` for its attributes. `src/ui/localise-page.ts`
walks the document and rewrites both, at start-up and again after every language change.

| Key                             | English                                                                                                            | Notes                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `page.title`                    | Elevator Saga - the elevator programming game                                                                      | twice: the `<title>`, and the `og:title` meta                                                                                                   |
| `page.description`              | Elevator Saga is a programming game: write JavaScript to transport people efficiently.                             | twice: the `description` meta, and the `og:description` one                                                                                     |
| `page.imageAlt`                 | Four elevators carrying people between six floors, with the JavaScript program driving them in the editor bel…     | the `og:image:alt` meta                                                                                                                         |
| `page.skipLink`                 | Skip to the code editor                                                                                            |                                                                                                                                                 |
| `page.brand`                    | Elevator Saga                                                                                                      | first half of the one `<h1>`; see _What could not be keyed cleanly_                                                                             |
| `page.tagline`                  | The elevator programming game                                                                                      | second half of the same `<h1>`                                                                                                                  |
| `page.tutorialLink`             | Learning track                                                                                                     | the only way into the learning track; outside the `<nav>` below it, and `src/app/app.ts` keeps its `href` on the first task not yet cleared     |
| `page.nav.label`                | Help and reference                                                                                                 | an `aria-label`                                                                                                                                 |
| `page.nav.help`                 | Help                                                                                                               | also carries `data-i18n-doc=""`, so the link follows the language and lands at the top                                                          |
| `page.nav.documentation`        | Documentation                                                                                                      | also carries `data-i18n-doc="docs"`                                                                                                             |
| `page.nav.wiki`                 | Wiki & Solutions                                                                                                   | an external link; not retargeted                                                                                                                |
| `page.language.label`           | Language                                                                                                           | the `aria-label` of the picker's `<select>`; its options are `LOCALE_NAMES` and are never translated                                            |
| `page.noscript`                 | Your browser does not appear to support JavaScript. This page contains a browser-based programming game imple…     | the one key with no element, and it cannot have one: see _Where the strings are_                                                                |
| `page.world.label`              | Building                                                                                                           | an `aria-label`                                                                                                                                 |
| `page.stats.label`              | Simulation statistics                                                                                              | an `aria-label`                                                                                                                                 |
| `page.stats.transported`        | Transported                                                                                                        |                                                                                                                                                 |
| `page.stats.elapsedTime`        | Elapsed time                                                                                                       |                                                                                                                                                 |
| `page.stats.transportedPerSec`  | Transported/s                                                                                                      |                                                                                                                                                 |
| `page.stats.avgWaitTime`        | Avg delivery time                                                                                                  | the key names the `World` field, which is `avgWaitTime`; the label names what it measures, which is not a wait                                  |
| `page.stats.avgPickupTime`      | Avg wait for a car                                                                                                 | the row between the two above, and the only one of the three that is a wait: it stops when a car takes the passenger, so the ride is outside it |
| `page.stats.avgPickupTimeTitle` | The clock starts when a passenger appears and stops when a car takes them, so the difference from the aver…        | a `title` attribute on the same cell as `page.stats.avgPickupTime`; text of `docs.play.statistics.html` word for word                           |
| `page.stats.maxWaitTime`        | Max delivery time                                                                                                  | likewise, and this is the figure the eight wait-limited challenges are judged on                                                                |
| `page.stats.moves`              | Moves                                                                                                              |                                                                                                                                                 |
| `page.stats.movesTitle`         | One move is counted each time a car crosses the halfway mark between one floor and the next                        | a `title` attribute on the same cell as `page.stats.moves`                                                                                      |
| `page.stats.avgLoad`            | Avg load                                                                                                           | how full the cars were, as a percentage; averaged over the moves the row above counts, so a car that never moved is absent rather than empty    |
| `page.stats.avgLoadTitle`       | How full the cars were, averaged over the moves counted above, so a car standing still is not in the…              | a `title` attribute on the same cell as `page.stats.avgLoad`; text of `docs.play.statistics.html` word for word                                 |
| `page.hint.html`                | In the editor: your code is saved as you type. `<kbd data-mod-key>`Ctrl`</kbd>`+`<kbd>`Enter`</kbd>` applies it. … | markup; `localisePage` calls `labelModifierKeys` last, having just overwritten with `innerHTML` the `<kbd>` labels it fixes                     |
| `page.editorResize.label`       | Editor height                                                                                                      | the accessible name of the grip under the editor; a `separator` is announced with its value, so the name is what it controls, not what it does  |
| `page.helpNote.html`            | Confused? Open the `<a href="documentation.html">`Help and API documentation`</a>` page                            | markup; the only link whose target is inside the message — the Russian names `documentation.ru.html`                                            |
| `page.footer.credits`           | Made by Magnus Wolffelt and contributors                                                                           |                                                                                                                                                 |
| `page.footer.version`           | Version                                                                                                            | the number beside it comes from `package.json`, through `src/ui/version.ts`                                                                     |
| `page.footer.source.html`       | `<a href="https://github.com/EpicDima/elevatorsaga">`Source code`</a>` on GitHub, forked from …                    | markup                                                                                                                                          |
| `page.footer.licences.html`     | `<a href="licenses.txt">`Licences`</a>` for the game and everything it bundles                                     | markup; `licenses.txt` is generated into `dist/` by `vite.config.ts`                                                                            |

`page.helpNote.html` is the one link the shell cannot retarget from outside, because the `href`
lives inside the message. Every other link into the reference page is an element of the shell and
carries `data-i18n-doc` instead; `src/ui/documentation-links.ts` rewrites those from the attribute on
every language change, which is why the header's two links no longer send a Russian reader to the
English page. That module's own header explains why the mapping lives in `src/ui/` and not in
`src/i18n/locale.ts`: `locale.ts` describes the languages the game speaks, this describes the
files the build emits, and the two sets are allowed to differ.

### `documentation.html` — the reference page, 85 `docs.*` keys

One of these is read. The editor's skeleton completion inserts `docs.basics.example.code`, so
the program the popup offers and the program the help page walks through are the same bytes in
whichever language the reader is in; it is filed here rather than under `src/ui/completions.ts`
because this is where its wording is decided, and the popup borrows it. The other 84 have no
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
| `docs.play.track.html`                              | If you have never written one of these programs before, start on the learning track …                           | markup; links into `index.html#challenge=tutorial-1`                                                                               |
| `docs.play.start.html`                              | Enter your code in the input window below the game view, and press the Start button to run it …                 | markup; takes `{increase}`, `{decrease}` — the two icon names                                                                      |
| `docs.play.statistics.html`                         | Beside the building is a panel that keeps score while a run is going. Five of its rows need a word. …           | markup                                                                                                                             |
| `docs.play.shortcuts.html`                          | Inside the editor, Ctrl+Enter applies your program and restarts the challenge …                                 | markup; same `data-mod-key` caveat as `page.hint.html`                                                                             |
| `docs.play.debugging.html`                          | If your program contains an error, you can use the developer tools in your web browser to try and debug it. …   | markup                                                                                                                             |
| `docs.basics.heading`                               | Basics                                                                                                          |                                                                                                                                    |
| `docs.basics.declare.html`                          | Your code must declare an object containing at least two functions called init …                                | markup                                                                                                                             |
| `docs.basics.example.code`                          | { init: function(elevators, floors) { // Do stuff with the elevators and floors, which are both arrays of obj…  | code; only the comments are translated; the one `docs.*` key with a call site — `src/ui/completions.ts` inserts it as the skeleton |
| `docs.basics.called.html`                           | These functions will then be called by the game during the challenge. init …                                    | markup                                                                                                                             |
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
| `docs.api.events.outro.html`                        | You rarely need to remove listeners: the elevators and floors are thrown away when a challenge restarts, and y… | markup                                                                                                                             |
| `docs.api.elevator.heading`                         | Elevator object                                                                                                 |                                                                                                                                    |
| `docs.api.elevator.goToFloor.html`                  | Queue the elevator to go to specified floor number. If you specify true as second argument, the elevator will … | markup; the popup borrows its first two sentences as `completion.elevator.goToFloor`                                               |
| `docs.api.elevator.goToFloor.example.code`          | elevator.goToFloor(3); // Do it after anything else -- queue: 3                                                 | code; only the comments are translated                                                                                             |
| `docs.api.elevator.stop`                            | Clear the destination queue and stop the elevator if it is moving. Note that you normally don't need to stop e… |                                                                                                                                    |
| `docs.api.elevator.currentFloor`                    | Gets the floor number that the elevator currently is on.                                                        |                                                                                                                                    |
| `docs.api.elevator.currentFloor.example.code`       | if(elevator.currentFloor() === 0) {                                                                             | code; only the comments are translated                                                                                             |
| `docs.api.elevator.goingUpIndicator`                | Gets or sets the going up indicator, which will affect passenger behaviour when stopping at floors.             |                                                                                                                                    |
| `docs.api.elevator.goingDownIndicator`              | Gets or sets the going down indicator, which will affect passenger behaviour when stopping at floors.           |                                                                                                                                    |
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
| `docs.api.elevator.idle`                            | Triggered when the elevator has completed all its tasks and is not doing anything.                              |                                                                                                                                    |
| `docs.api.elevator.floorButtonPressed`              | Triggered when a passenger has pressed a button inside the elevator.                                            |                                                                                                                                    |
| `docs.api.elevator.floorButtonPressed.example.code` | elevator.on("floor_button_pressed", function(floorNum) {                                                        | code; only the comments are translated                                                                                             |
| `docs.api.elevator.passingFloor`                    | Triggered slightly before the elevator will pass a floor. A good time to decide whether to stop at that floor.… |                                                                                                                                    |
| `docs.api.elevator.stoppedAtFloor`                  | Triggered when the elevator has arrived at a floor.                                                             |                                                                                                                                    |
| `docs.api.elevator.stoppedAtFloor.example.code`     | elevator.on("stopped_at_floor", function(floorNum) {                                                            | code; only the comments are translated                                                                                             |
| `docs.api.floor.heading`                            | Floor object                                                                                                    |                                                                                                                                    |
| `docs.api.floor.floorNum`                           | Gets the floor number of the floor object.                                                                      |                                                                                                                                    |
| `docs.api.floor.upButtonPressed`                    | Triggered when someone has pressed the up button at a floor. Note that passengers will press the button again … |                                                                                                                                    |
| `docs.api.floor.upButtonPressed.example.code`       | floor.on("up_button_pressed", function(floor) {                                                                 | code; only the comments are translated                                                                                             |
| `docs.api.floor.downButtonPressed`                  | Triggered when someone has pressed the down button at a floor. Note that passengers will press the button agai… |                                                                                                                                    |
| `docs.api.floor.downButtonPressed.example.code`     | floor.on("down_button_pressed", function(floor) {                                                               | code; only the comments are translated                                                                                             |
| `docs.api.floor.hallButtonPressed`                  | Triggered when someone has pressed either call button at a floor. Note that passengers will press the button a… |                                                                                                                                    |
| `docs.api.floor.hallButtonPressed.example.code`     | floor.on("hall_button_pressed", function(direction, floor) {                                                    | code; only the comments are translated                                                                                             |
| `docs.api.floor.buttonStateChange.html`             | Triggered when either call button at a floor was lit or cleared. The handler is passed the state of both butto… | markup                                                                                                                             |
| `docs.api.floor.buttonStateChange.example.code`     | floor.on("buttonstate_change", function(buttonStates) {                                                         | code; only the comments are translated                                                                                             |

### The learning track — 80 `tutorial.*` keys

The track is the eight tasks in `src/game/tutorial.ts`, with ids `tutorial-1` … `tutorial-8`.
Its prose is the largest single group of keys after the reference page, and it is the one group
whose messages were committed before anything read them — the prose _is_ the teaching here, so it
was written into both catalogues first and the panel built against it.

Each task owns eight keys, numbered by position: `tutorial.taskN.title`, `tutorial.taskN.goal`,
`tutorial.taskN.hint1.html`, `.hint2.html`, `.hint3.html`, `tutorial.taskN.explanation.html`,
`tutorial.taskN.startingCode.code` and `tutorial.taskN.solutionCode.code` — 64 in all.
`src/ui/tutorial-panel.ts` writes the six prose keys out as literals in
`TUTORIAL_TASK_MESSAGES` and says why in its header: a message key has to reach `t` as a string
literal, because the parameters a message takes are derived from the literal by `Placeholders<S>`
in `src/i18n/catalogue.ts`. A key built as ``t(`tutorial.task${n}.title`)`` cannot be
type-checked, and casting one through would trade the whole point of the typed catalogue for
brevity — a renamed message would then print its own key at a player instead of failing the
build. The table is typed `Record<TutorialTaskId, …>` and keyed by the task's id rather than by
its position, so that a ninth task inserted in the middle cannot slide one task's prose onto the
next task's building. `TutorialTaskId` is derived from the catalogue's own `tutorial.taskN.title`
keys, which is what makes a ninth task's messages added to `src/i18n/en.ts` without a row here
stop the file compiling.

The other two keys are the task's two programs, and they are messages for the same reason
`editor.defaultCode.code` is one: the `//` comments in them are prose written to the player —
`// TODO: this building has two floors, and the elevator only visits one` is the whole of task
1's instruction, and it is read in the editor and again under the third hint. The JavaScript is
byte-identical in every locale and only the comments are translated. `tutorialTasks` in
`src/game/tutorial.ts` reads both through getters rather than fields, so that a program is
rendered when the editor or the panel asks for it rather than when the module is imported, which
is before a locale has been chosen; the keys are written out at each entry, since a key built
from the task's id could not be type-checked either. `tutorial.task8.solutionCode.code` repeats
task 7's program word for word — the graduation task asks for nothing new — and every task owning
the same eight keys is worth more than the saving; `src/game/tutorial.test.ts` holds the two
equal in every locale.

| Key                                | English                                                                                                         | Notes                                                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tutorial.taskN.startingCode.code` | { init: function(elevators, floors) { const elevator = elevators[0]; elevator.on("idle", function() { // TODO:… | code; only the comments are translated; the program the editor is filled with, and the one `src/game/tutorial-solutions.test.ts` proves cannot win |
| `tutorial.taskN.solutionCode.code` | { init: function(elevators, floors) { const elevator = elevators[0]; elevator.on("idle", function() { elevator… | code; only the comments are translated; the answer, shown under the third hint and replayed as the fixture that must win                           |

| Task | `tutorial.taskN.title`                   | What the goal asks for                                                                       |
| ---- | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1    | The elevator that goes nowhere           | visit both floors and deliver 10 passengers within 60 seconds                                |
| 2    | The same loop, written by hand           | write the `idle` handler yourself; 15 passengers within 60 seconds                           |
| 3    | The buttons inside the car               | `floor_button_pressed`; 15 passengers within 60 seconds                                      |
| 4    | The queue nobody read                    | the missing `checkDestinationQueue`; 15 passengers within 60 seconds                         |
| 5    | The building grew                        | hall calls instead of a blind sweep; 15 passengers, nobody waiting over 37 seconds           |
| 6    | The elevator that lies to its passengers | the indicators; 15 passengers, nobody waiting over 28 seconds                                |
| 7    | The second elevator                      | `elevators.forEach`; 28 passengers within 60 seconds                                         |
| 8    | From memory                              | the whole program on an empty page; 15 passengers within 60 seconds — challenge 1's building |

The other sixteen are the panel and the surfaces around it.

| Key                                 | English                                                                                                        | Notes                                                                                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `tutorial.panel.label`              | Learning track                                                                                                 | twice: the panel's accessible name, and the words on its first line                                                                             |
| `tutorial.panel.position`           | Task {number} of {count}                                                                                       | takes `{number}`, `{count}`                                                                                                                     |
| `tutorial.panel.progress`           | {cleared} of {count} tasks done                                                                                | plural (one, other); takes `{cleared}`, `{count}`; the count that decides the form is `{count}`                                                 |
| `tutorial.panel.hintSummary`        | Hint {number}                                                                                                  | takes `{number}`; the `<summary>` of one of the three hint disclosures                                                                          |
| `tutorial.panel.explanationSummary` | Why this happens                                                                                               | the `<summary>` of the fourth disclosure                                                                                                        |
| `tutorial.panel.codeTaken`          | Copied into the game editor, waiting when you leave the track.                                                 | the panel's `aria-live` line, written on a successful "Take this program"                                                                       |
| `tutorial.panel.codeRefused`        | Your browser refused to store it. Copy the program out of the editor by hand to keep it.                       | the same line, when the store refused the write — the button is otherwise silent about it                                                       |
| `tutorial.button.takeCode`          | Take this program into your own editor                                                                         |                                                                                                                                                 |
| `tutorial.button.takeCodeConfirm`   | The game editor already holds a program of yours. Replace it with this one?                                    | a `window.confirm`, asked only when there is something to overwrite                                                                             |
| `tutorial.button.leave`             | Leave for the challenges                                                                                       |                                                                                                                                                 |
| `tutorial.bar.title.html`           | Tutorial task {number} of {count}: {description}                                                               | markup; takes `{number}`, `{count}`, `{description}`; the challenge bar's title on the track, counting the track rather than the challenge list |
| `tutorial.finish.title`             | The track is finished                                                                                          | the overlay after the last task                                                                                                                 |
| `tutorial.finish.message`           | Eight tasks, and the last of them was challenge 1: the same three floors, the same elevator, the same fifteen… |                                                                                                                                                 |
| `tutorial.finish.nextTask`          | Next task                                                                                                      | not `game.feedback.next`, which says "Next challenge" — see the note below                                                                      |
| `tutorial.finish.toChallenges`      | Go to challenge 1                                                                                              | the finish overlay's link out of the track; it carries no program, which is why it no longer says it does                                       |

`tutorial.finish.nextTask` and `game.feedback.next` are separate keys although the Russian of both
would fit as «Следующее задание». Two features sharing one key is a key neither can reword: the
day the challenge overlay wants different words, the track's overlay changes with it for no
reason. The Russian of `tutorial.finish.nextTask` is «Следующее учебное задание», which the
challenge overlay would not want.

### `src/ui/templates.ts` — 18 `game.*` keys

Every template renders its words through `t` as it is built, which is why a language change
cannot rewrite them in place: the presenters build them again. `markup` escapes its
interpolations, so a plain key is interpolated directly and an `.html` key goes through `raw()`.

| Key                         | English                                                                                                        | Notes                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `game.floor.callUp`         | Call an elevator going up from floor {floor}                                                                   | takes `{floor}`; an `aria-label`                                                                             |
| `game.floor.callDown`       | Call an elevator going down from floor {floor}                                                                 | takes `{floor}`; an `aria-label`                                                                             |
| `game.elevator.label`       | Elevator {number}                                                                                              | takes `{number}`; the car's index plus one                                                                   |
| `game.elevator.floorButton` | Go to floor {floor}                                                                                            | takes `{floor}`                                                                                              |
| `game.challenge.title.html` | Challenge #{number}: {description}                                                                             | markup; takes `{number}`, `{description}`                                                                    |
| `game.challenge.nav.label`  | Challenges                                                                                                     | the `<nav>`'s accessible name                                                                                |
| `game.challenge.nav.link`   | Challenge {number}                                                                                             | takes `{number}`; the accessible name of an entry whose visible text is the bare digit                       |
| `game.challenge.nav.demo`   | Demo                                                                                                           | both the visible label and the accessible name of the endless-demo entry                                     |
| `game.seed.label`           | Seed                                                                                                           | the word before the number, not a control                                                                    |
| `game.seed.link`            | Seed {seed}: start another run from this seed                                                                  | takes `{seed}`; accessible name of the seed when the URL does not pin it                                     |
| `game.seed.newDraw`         | new draw                                                                                                       | visible label, repeated inside `game.seed.newDrawLink` — WCAG 2.5.3 requires that they match                 |
| `game.seed.newDrawLink`     | Seed {seed}: new draw, start again without it                                                                  | takes `{seed}`; accessible name of the control that unpins                                                   |
| `game.seed.helpSummary`     | what a seed does                                                                                               | the `<summary>` of the caveat disclosure                                                                     |
| `game.seed.explanation`     | The same seed brings the same passengers, in the same order. Frame timing comes from the browser, so the run … | a paragraph inside the disclosure, not a tooltip — it used to be a `title` attribute                         |
| `game.seed.console`         | Seed {seed} — the same passengers again, though never quite the same run: {url}                                | takes `{seed}` and `{url}`; the `console.log` printed at every start, and the one console line that is keyed |
| `game.timeScale.decrease`   | Decrease simulation speed                                                                                      | an `aria-label`                                                                                              |
| `game.timeScale.increase`   | Increase simulation speed                                                                                      | an `aria-label`                                                                                              |
| `game.feedback.next`        | Next challenge                                                                                                 | the link in the end-of-challenge overlay                                                                     |
| `game.codeStatus`           | There is a problem with your code:                                                                             | the message beside it is the player's own text and is never translated                                       |

The seed itself is a placeholder in both accessible names and never part of the sentence: it is
the token a player transcribes in order to hand a building to somebody else, so it reads
identically in every locale. Both names repeat it because an accessible name has to stand on its
own — "1234567890, link" describes nothing.

`game.seed.newDraw` appearing inside `game.seed.newDrawLink` is a constraint a translator cannot
see: the two sit on adjacent lines of a 301-key file and nothing in the file marks them as a
pair. `src/i18n/catalogue.test.ts`, under _accessible names_, is what holds it — it requires the
spoken name to contain the visible label in every locale. Rewording «новый розыгрыш» to «новый
сид» meant changing both, which is exactly the edit where one gets missed.

The seed explanation used to be a module constant, `SEED_EXPLANATION`. It is now
`t("game.seed.explanation")` inside `seedHelpTemplate`, which runs per render — which is the
point. A `const SEED_EXPLANATION = t(...)` at module scope compiles, reads correctly and freezes
English at import time; see _Rules the wiring has to keep_.

### `src/ui/presenters.ts` — 9 `game.*` and 3 `error.*` keys

| Key                         | English                       | Notes                                                                                                          |
| --------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `game.timeScale.value`      | {value}x                      | takes `{value}`; Russian writes `×`, not the Latin letter x                                                    |
| `game.timeScale.decrease`   | Decrease simulation speed     | an `aria-label`, also written by `controlsTemplate`; rewritten on every update so a language change reaches it |
| `game.timeScale.increase`   | Increase simulation speed     | likewise                                                                                                       |
| `game.button.start`         | Start                         |                                                                                                                |
| `game.button.pause`         | Pause                         |                                                                                                                |
| `game.button.restart`       | Restart                       | rendered after an icon as `` ` ${t(...)}` ``; the space belongs to the call site                               |
| `game.button.startOver`     | Start over                    | restarts the run from the program in the editor; the button "Apply" became                                     |
| `game.button.resetCode`     | Reset code                    | puts the starter program back, behind a confirmation                                                           |
| `game.button.undoResetCode` | Undo reset                    | hidden until a reset has something to bring back                                                               |
| `error.thrown.emptyString`  | Thrown empty string           | what the code status bar says when a program throws something with no message                                  |
| `error.thrown.noMessage`    | Thrown {kind} with no message | takes `{kind}`                                                                                                 |
| `error.thrown.keys`         | {kind} with keys: {keys}      | takes `{kind}`, `{keys}`                                                                                       |

Every figure in the statistics panel goes through `Intl` rather than `toFixed` and `String`:
`format(seconds(world.elapsedTime))`, `format(quantity(...))` for the per-second rate, and
`format(seconds(..., 1))` for the two delivery times, which is what gives Russian `1,5 с` with a
non-breaking space instead of `1.5s`.

### `src/app/app.ts` — 4 `game.feedback.*` keys

| Key                             | English                                  | Notes                                                              |
| ------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| `game.feedback.success.title`   | Success!                                 |                                                                    |
| `game.feedback.success.message` | Challenge completed                      |                                                                    |
| `game.feedback.failure.title`   | Challenge failed                         |                                                                    |
| `game.feedback.failure.message` | Maybe your program needs an improvement? | not shown on the learning track, where a loss is the first outcome |

The locale preference is not app state and is not kept here beside `TIME_SCALE_STORAGE_KEY`:
`LOCALE_STORAGE_KEY` and `readStoredLocale` live in `src/i18n/detect.ts`, shaped after
`readStoredTimeScale` and saying so in a comment.

### `src/main.ts` — 2 keys

| Key                 | English              | Notes                                                          |
| ------------------- | -------------------- | -------------------------------------------------------------- |
| `editor.saved`      | Code saved {time}    | takes `{time}`; `formatTime` drops the time zone suffix        |
| `fitness.measuring` | Measuring fitness... | written into the panel beside the editor before the run starts |

### `src/app/app.ts` — 2 `editor.*` keys

| Key                       | English                                                      | Notes              |
| ------------------------- | ------------------------------------------------------------ | ------------------ |
| `editor.confirmReset`     | Do you really want to reset to the default implementation?   | a `window.confirm` |
| `editor.confirmUndoReset` | Do you want to bring back the code as before the last reset? | a `window.confirm` |

Both are asked by the `onResetCode` and `onUndoReset` callbacks `App` hands to `presentControls`.
They were `src/main.ts`'s until the run buttons were gathered into one row: the two buttons that
ask them are drawn by `src/ui/presenters.ts` now, and the app is what knows the editor.

`fitness.measuring` is filed here rather than under `src/app/fitness.ts` because that is where it
is written to the document; the benchmark itself stopped touching the page.

### `src/ui/editor.ts` and `src/ui/default-code.ts` — 2 keys

| Key                       | English                                                                                                        | Notes                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `editor.label`            | Elevator program                                                                                               | the editor's `aria-label`              |
| `editor.defaultCode.code` | { init: function(elevators, floors) { const elevator = elevators[0]; // Let's use the first elevator // Whene… | code; only the comments are translated |

`defaultCode()` in `src/ui/default-code.ts` is a function and not a constant, for the reason its
own JSDoc gives: `t` answers for the locale active when it is called, and a module-scope `const`
would answer for whichever locale happened to be active when the module was first imported. The
same file's `DEV_TEST_CODE` is deliberately outside the catalogue — nobody reaches it without
typing `#devtest` into the address bar, and what it is for is checking that the game still plays.

### `src/game/challenges.ts` — 15 keys

| Key                                              | English                                                                                                     | Notes                                                                                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `challenge.transportWithinTime.html`             | Transport {people} in {time} or less                                                                        | markup; takes `{people}`, `{time}`                                                                                                      |
| `challenge.transportWithMaxWait.html`            | Transport {people} and let no one take more than {waitTime} to be delivered                                 | markup; takes `{people}`, `{waitTime}`                                                                                                  |
| `challenge.transportWithinTimeWithMaxWait.html`  | Transport {people} in {time} or less and let no one take more than {waitTime} to be delivered               | markup; takes `{people}`, `{time}`, `{waitTime}`                                                                                        |
| `challenge.transportWithinMoves.html`            | Transport {people} using {moves} or less                                                                    | markup; takes `{people}`, `{moves}`                                                                                                     |
| `challenge.transportWithinMovesWithMaxWait.html` | Transport {people} using {moves} or less and let no one take more than {waitTime} to be delivered           | markup; takes `{people}`, `{moves}`, `{waitTime}`                                                                                       |
| `challenge.demo`                                 | Perpetual demo                                                                                              |                                                                                                                                         |
| `challenge.people.html`                          | `<span class='emphasis-color'>`{count}`</span>` people                                                      | plural (one, other; `one` is "person"); markup; takes `{count}`; shared by all five sentences above                                     |
| `challenge.timeLimit.html`                       | `<span class='emphasis-color'>`{count}`</span>` seconds                                                     | plural (one, other); markup; takes `{count}`; the accusative «за 30 секунд» in Russian                                                  |
| `challenge.waitLimit.html`                       | `<span class='emphasis-color'>`{count}`</span>` seconds                                                     | plural (one, other); markup; takes `{count}`; the same English as above and the genitive «дольше 30 секунд» in Russian                  |
| `challenge.moveLimit.html`                       | `<span class='emphasis-color'>`{count}`</span>` elevator moves                                              | plural (one, other); markup; takes `{count}`                                                                                            |
| `challenge.sandbox.html`                         | Sandbox: {floors}, {elevators} of {capacityLabel} {capacities}, {spawnRate}. No goal, so the run never ends | markup; takes `{floors}`, `{elevators}`, `{capacityLabel}`, `{capacities}`, `{spawnRate}`; composed from the four sandbox phrases below |
| `challenge.sandbox.floors.html`                  | `<span class='emphasis-color'>`{count}`</span>` floors                                                      | plural (one, other); markup; takes `{count}`                                                                                            |
| `challenge.sandbox.elevators.html`               | `<span class='emphasis-color'>`{count}`</span>` elevators                                                   | plural (one, other); markup; takes `{count}`                                                                                            |
| `challenge.sandbox.capacityLabel`                | capacities                                                                                                  | plural (one, other); counted by how many capacities were listed, not by how many cars there are                                         |
| `challenge.sandbox.spawnRate.html`               | `<span class='emphasis-color'>`{count}`</span>` people per second                                           | plural (one, other); markup; takes `{count}`; one English form for both categories, preserving today's `1 people per second`            |

All seven descriptions render through `t` inside a `get description()` on the condition object —
`requireUserCountWithinTime`, `requireUserCountWithMaxWaitTime`,
`requireUserCountWithinTimeWithMaxWaitTime`, `requireUserCountWithinMoves`,
`requireUserCountWithinMovesWithMaxWaitTime`, `requireDemo` and `requireSandbox`. A getter and not a constant, for the reason under _Rules the wiring has to
keep_. The sandbox's numbers all go through `exact`, because they came out of the address bar and
`Intl.NumberFormat`'s default is three _fraction_ digits, not three significant ones — the
distinction does not matter for `spawnrate=0.0625`, which either way rounds to `0.063`, but it is
why `exact` asks for `maximumFractionDigits` rather than for significant digits:

```sh
node -e 'const f = new Intl.NumberFormat("en");
  console.log(f.resolvedOptions().maximumFractionDigits, f.format(0.0625))'   # 3 0.063
```

### `src/ui/completions.ts` — 33 `completion.*` keys

The editor's completion popup. Only the `info` prose is keyed: a `label` is an identifier the
popup inserts into the player's program and a `detail` is that identifier's signature, so both
stay English in every language — completing `goToFloor` into anything else would be suggesting
code that does not exist.

The tables in this module hold keys rather than rendered entries, and `elevatorMembers` and its
neighbours turn them into completions per call. That shape is not decoration: the module is
imported long before the player's language is resolved, so a module-scope constant holding
rendered prose would be English for the rest of the session whatever the page around it said.
`challenges.ts` repairs the same fault with `get description()` and `default-code.ts` with a
nullary function.

| Key                                            | English                                                                                                        | Notes                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `completion.events.on`                         | Register a listener. Several event names separated by spaces register the same listener for all of them, and … |                                                                               |
| `completion.events.once`                       | Register a listener that runs at most once and is then removed. Takes a single event name.                     |                                                                               |
| `completion.events.one`                        | The older name for once, and the one the original game gave you. Same behaviour, single event name as well.    |                                                                               |
| `completion.events.off`                        | Remove listeners. With a function, removes just that function; without one, removes every listener of the nam… |                                                                               |
| `completion.events.offAll`                     | Remove every listener you registered, for every event, on that elevator or floor. The listeners the game itse… |                                                                               |
| `completion.elevator.goToFloor`                | Queue the elevator to go to specified floor number. If you specify true as second argument, the elevator will… | the first two sentences of `docs.api.elevator.goToFloor.html`, without markup |
| `completion.elevator.stop`                     | Clear the destination queue and stop the elevator if it is moving. Note that the elevator will probably not s… |                                                                               |
| `completion.elevator.currentFloor`             | Gets the floor number that the elevator currently is on. Note that this is a rounded number and does not nece… |                                                                               |
| `completion.elevator.goingUpIndicator`         | Gets or sets the going up indicator, which will affect passenger behaviour when stopping at floors.            |                                                                               |
| `completion.elevator.goingDownIndicator`       | Gets or sets the going down indicator, which will affect passenger behaviour when stopping at floors.          |                                                                               |
| `completion.elevator.maxPassengerCount`        | Gets the maximum number of passengers that can occupy the elevator at the same time.                           |                                                                               |
| `completion.elevator.loadFactor`               | Gets the load factor of the elevator. 0 means empty, 1 means full. Varies with passenger weights, which vary … |                                                                               |
| `completion.elevator.isFull`                   | Gets whether every spot in the elevator is taken. Use this rather than comparing loadFactor to 1 - passenger … |                                                                               |
| `completion.elevator.isEmpty`                  | Gets whether the elevator is carrying nobody at all. Not the opposite of isFull - an elevator with one passen… |                                                                               |
| `completion.elevator.destinationDirection`     | Gets the direction the elevator is currently going to move toward.                                             |                                                                               |
| `completion.elevator.isApproachingFloor`       | Gets whether the elevator is moving toward the given floor and has not passed it yet. Only the direction of t… |                                                                               |
| `completion.elevator.destinationQueue`         | The current destination queue, meaning the floor numbers the elevator is scheduled to go to. Can be modified … |                                                                               |
| `completion.elevator.checkDestinationQueue`    | Checks the destination queue for any new destinations to go to. Note that you only need to call this if you m… |                                                                               |
| `completion.elevator.getPressedFloors`         | Gets the currently pressed floor numbers as an array.                                                          |                                                                               |
| `completion.floor.floorNum`                    | Gets the floor number of the floor object.                                                                     |                                                                               |
| `completion.elevator.event.idle`               | Triggered when the elevator has completed all its tasks and is not doing anything.                             |                                                                               |
| `completion.elevator.event.floorButtonPressed` | Triggered when a passenger has pressed a button inside the elevator.                                           |                                                                               |
| `completion.elevator.event.passingFloor`       | Triggered slightly before the elevator will pass a floor. A good time to decide whether to stop at that floor… |                                                                               |
| `completion.elevator.event.stoppedAtFloor`     | Triggered when the elevator has arrived at a floor.                                                            |                                                                               |
| `completion.floor.event.upButtonPressed`       | Triggered when someone has pressed the up button at a floor. Note that passengers will press the button again… |                                                                               |
| `completion.floor.event.downButtonPressed`     | Triggered when someone has pressed the down button at a floor. Note that passengers will press the button aga… |                                                                               |
| `completion.floor.event.hallButtonPressed`     | Triggered when someone has pressed either call button at a floor. Note that passengers will press the button … | the first three sentences of `docs.api.floor.hallButtonPressed`               |
| `completion.floor.event.buttonStateChange`     | Either call button was lit or cleared.                                                                         |                                                                               |
| `completion.global.skeleton`                   | Your code must declare an object containing at least two functions called init and update.                     | the entry whose `apply` is `docs.basics.example.code`                         |
| `completion.global.init`                       | Called when the challenge starts. Normally you will put most of your code in here, to set up event listeners…  |                                                                               |
| `completion.global.update`                     | Called repeatedly during the challenge. dt is the number of game seconds that passed since the last time upda… |                                                                               |
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
a number on screen is the one thing routing this through the catalogue was not allowed to do.

The non-breaking space Russian gets — `12,3 с` beside English's `12.3s` — is not `Intl`'s doing
either. CLDR's narrow unit pattern for Russian carries an ordinary space, and `formatNumber` in
`src/i18n/format.ts` replaces it with `NO_BREAK_SPACE` after formatting, for unit styles only:

```sh
node -e 'const s = new Intl.NumberFormat("ru",
    { style: "unit", unit: "second", unitDisplay: "narrow" }).format(60);
  console.log([...s].map((c) => c.codePointAt(0).toString(16)).join(" "))'   # 36 30 20 441
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

| Where                                                                                                        | What                                                                                                                                | Why                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/app.ts`, the `usercode_error` subscription; `src/game/world-controller.ts`, `handleUserCodeError`   | `World raised code error`, `Usercode error on update`                                                                               | `console` diagnostics. The player sees the same failure translated in the code status bar; the console line is for whoever is reading a stack beside it.                                                                                                 |
| `src/game/movable.ts`, `makeSureNotBusy`                                                                     | `Attempt to use movable while it was busy`                                                                                          | `console` diagnostic accompanying `error.movable.busy`, which _is_ keyed.                                                                                                                                                                                |
| `src/game/observable.ts`, `report`                                                                           | `Event error handler threw while reporting`                                                                                         | `console` diagnostic about the game's own error reporting failing.                                                                                                                                                                                       |
| `src/app/fitness.ts`, `tryCreateWorker`                                                                      | `Fitness worker creation failed, running on the main thread instead`                                                                | `console` diagnostic; the player sees only the result.                                                                                                                                                                                                   |
| `src/i18n/index.ts`, the `catch` inside `loadLocale`                                                         | `Could not load the ru messages; staying in en`                                                                                     | `console` diagnostic about the translation machinery itself. Saying it in the language that failed to load is not an option.                                                                                                                             |
| `src/ui/localise-page.ts`, `warnUnusable`                                                                    | `Ignoring {attribute}="{key}": the page shell can only name a message that exists and takes no parameters`                          | Addressed to whoever wrote the attribute, quoting an attribute name.                                                                                                                                                                                     |
| `src/game/elevator.ts`, `getFirstPressedFloor`                                                               | The deprecation notice, printed once per session behind a module flag                                                               | Addressed to code, quoting an API name.                                                                                                                                                                                                                  |
| `src/app/router.ts`, the twelve `console.warn` calls                                                         | `Invalid seed "…", using a fresh one instead`, and eleven more                                                                      | Addressed to whoever hand-wrote the URL, quoting parameter names that are themselves English.                                                                                                                                                            |
| `src/game/world.ts`, `resolveSpawnRate`                                                                      | `World was created with a spawnRate of …`                                                                                           | Reached only through `WorldOptions`, which is engine-internal and typed; a player's program cannot produce it.                                                                                                                                           |
| `src/ui/dom.ts` `requireElement`; `src/ui/templates.ts` `renderElement`; `src/ui/presenters.ts` `renderUser` | `Missing required element`, `Expected markup describing exactly one element`, `Expected the user template to render an SVG element` | Invariants. If a player ever reads one, the bug is that it was thrown, not that it was in English.                                                                                                                                                       |
| `src/game/fitness.ts`, `requireNothing`                                                                      | `No requirement`                                                                                                                    | The benchmark's placeholder condition. Nothing draws a challenge bar during a benchmark, so it never reaches a screen.                                                                                                                                   |
| `src/ui/completions.ts`, the `label` and `detail` fields                                                     | `elevator.goToFloor`, `(floorNum, directly)`, …                                                                                     | Identifiers and signatures. The popup completes real API names; translating one would suggest code that does not exist. Only `info` is keyed.                                                                                                            |
| `src/ui/default-code.ts`, `DEV_TEST_CODE`                                                                    | The `#devtest` program                                                                                                              | Unreachable without typing `#devtest` into the address bar, and it exists to check that the game still plays, not to teach anybody the API.                                                                                                              |
| `src/ui/shortcuts.ts`, `modifierKeyLabel`                                                                    | `⌘` / `Ctrl`                                                                                                                        | Key names. Russian keyboards are labelled `Ctrl` too.                                                                                                                                                                                                    |
| `index.html` and `documentation.html`, `<meta charset>` and `<meta name="viewport">`                         | `UTF-8`, `width=device-width, initial-scale=1`                                                                                      | Machine values, not prose.                                                                                                                                                                                                                               |
| `documentation.html`, the link to `documentation.ru.html`                                                    | `Русский`                                                                                                                           | A language's own name. `LOCALE_NAMES` in `src/i18n/locale.ts` holds these, deliberately outside the catalogues: a reader who needs Русский has to find it while the interface is still English.                                                          |
| `documentation.html`, the one-line snippets in _Code examples_                                               | `elevator.on("floor_button_pressed", function(floorNum) { … });`                                                                    | Code with no comments in it. Nothing to translate — and `src/page.test.ts` holds that both ways round, so a comment added to one of them fails the suite.                                                                                                |
| `public/elevatorsaga.d.ts`, the whole file                                                                   | The JSDoc an editor shows over `elevator.goToFloor`                                                                                 | Its own header decides this: the prose is the English of `documentation.html` in both languages' builds, because the names it describes are English identifiers either way and two translations of a declaration would be a second pair to keep in step. |
| `src/game/test-helpers.ts`, `*.test.ts`, `e2e/`                                                              | Test messages                                                                                                                       | Read by whoever ran the tests.                                                                                                                                                                                                                           |
| `licenses.txt`, generated into `dist/` by `vite.config.ts`                                                   | Licence texts                                                                                                                       | Legal texts are quoted, not translated.                                                                                                                                                                                                                  |

**One that is not a decision anybody wrote down.** `src/app/app.ts` prints a line at every start
— `Seed … — the same passengers again, though never quite the same run: …` — and it is prose
addressed to the player, not a diagnostic. It says in English roughly what
`game.seed.explanation` says in the catalogue in both languages. The comment above it says why the
line is printed — nobody knows a run is worth repeating until it has already gone wrong — and
says nothing about the language, and the line was written after the catalogue existed, so this is
an omission rather than a leftover. It is either worth keying or worth cutting back to the seed
and the URL.

## What could not be keyed cleanly

Seven places where the English source resists a one-string-one-key mapping. All seven are keyed
and all seven ship, so this is a record of how each was resolved rather than a proposal.

1. **Challenge descriptions are built from parts.** Each of the five builders in
   `src/game/challenges.ts` interpolates two or three counted phrases into one sentence, and
   every phrase needs its own plural. One key per sentence, plus one key per phrase
   (`challenge.people.html`, `challenge.timeLimit.html`, `challenge.waitLimit.html`,
   `challenge.moveLimit.html`), rendered inside out:

   ```ts
   t("challenge.transportWithinTime.html", {
     people: t("challenge.people.html", { count: userCount }),
     time: t("challenge.timeLimit.html", { count: timeLimit }),
   });
   ```

   The alternative — one key per sentence with `{count}` in it — cannot work: a message has one
   plural category, and these sentences count two different things.

2. **Two keys whose English is identical.** `challenge.timeLimit.html` and
   `challenge.waitLimit.html` are both "{count} seconds" and neither can be dropped: Russian
   needs the accusative after «за» — «за 21 секунду», «за 30 секунд» — and the genitive after
   «дольше» — «дольше 21 секунды», «дольше 30 секунд». Two of Russian's four forms differ between
   them, so a shared key would be wrong in one of the two sentences for every limit ending in 1,
   2, 3 or 4. Anyone tempted to deduplicate them by their English is looking at the wrong
   language.

3. **`1 people per second`.** `challenge.sandbox.spawnRate.html` is a plural message whose two
   English forms are the same string, so a sandbox running at one passenger a second still says
   `1 people per second` — exactly what it said before the catalogue existed. That was preserved
   rather than fixed, so that wiring the strings up changed nothing on screen, and `src/i18n/en.ts`
   says so beside the key and points here. Russian declines it properly, which is why only the
   English is odd. This is the one wording in the catalogue known to be wrong, and correcting it
   is a one-word edit to `en.ts`.

4. **The sandbox's list of capacities is punctuated by the locale.** `formatList`, not a `", "`
   join, because Russian writes decimals with a comma: a joined list reads «вместимостью 6, 9»,
   which is also how six point nine is written. `formatList` gives «6 и 9», which cannot be read
   as one number — and "6 and 9" in English, which reads better anyway.

5. **`" Restart"` carries a leading space.** `presentControls` in `src/ui/presenters.ts` writes
   the label after an icon node, and the space is the gap between them. `game.button.restart` is
   the word alone, so the call site keeps the separator:

   ```ts
   startStop.replaceChildren(createIcon("repeat"), ` ${t("game.button.restart")}`);
   ```

   The space belongs to the line rather than to the message because every language needs it and
   no translator should have to remember to type it.

6. **One `<h1>`, two strings.** The heading in `index.html` puts the game's name and its tagline
   in one element. They are keyed as `page.brand` and `page.tagline`, because the brand is a name
   that stays English and the tagline is prose that does not.

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
  `src/game/challenges.ts` uses `get description()` because callers hold the condition object;
  `src/ui/default-code.ts` uses a nullary `defaultCode()`; `src/ui/completions.ts` keeps tables
  of keys and renders per call because nothing holds a reference to a completion list.
  `fitnessChallenges` is a nullary function that deliberately keeps the constant's name, because
  what other modules mean by it — the list of buildings — did not change.
- **A worker is a second module instance.** `src/app/fitness.ts` posts the player's source to
  `src/app/fitness-worker.ts`, which has its own copy of `src/i18n/index.ts` and its own active
  locale. The locale therefore travels with the request in `FitnessWorkerRequest`, and the worker
  calls `setLocale` on arrival, per message rather than once at import. Anything else that ends
  up in a worker needs the same treatment: a worker inherits nothing from the page that spawned
  it.
- **A static import of a catalogue puts it in every chunk that reaches a `t()`.**
  `src/i18n/index.ts` records the measurement that decided this: with both catalogues imported
  statically the page's entry chunk was 135.87 kB and the fitness worker — which draws no
  interface at all — was 95.32 kB, both carrying the whole Russian catalogue. So every catalogue
  but English is an `import()` of its own, in `CATALOGUE_LOADERS`. Do not `import { RU_MESSAGES }`
  and do not re-export it from a module the page imports; `src/i18n/index.ts` re-exports English
  only, and the test files that want the Russian catalogue as data import `./ru.ts` directly,
  which reaches no bundle.
- **`setLocale` starts the fetch and does not wait for it.** `await loadLocale(locale)` before
  redrawing, or the interface stays English until the catalogue lands. A message asked for before
  its catalogue arrives renders in English whole — never a raw key, and never an English sentence
  with Russian decimal commas in it, which is why English stays bundled rather than being split
  like the rest.

Start-up is where all four meet. `src/main.ts` awaits `applyPreferredLocale` from
`src/ui/preferred-locale.ts` before the app is constructed: it resolves the language, sets it,
waits for the catalogue and writes the shell, so nothing is ever drawn in one language and
replaced in another. `resolveLocale` reads `#lang=` first, then `localStorage`, then
`navigator.languages`, then English, and `browserLocaleSources` reads each source behind its own
`catch` — a browser that throws on `localStorage`, such as Safari in a private window, falls
through to the next source instead of failing to start. None of those three sources calls
`storeLocale`, and `preferred-locale.ts` says why at length: a language found in somebody else's
link is not a choice this reader made. The language picker is what writes storage.

`#lang=ru` needs nothing from `src/app/router.ts`, and that is not luck: `parseQuery` keeps every
parameter it finds rather than the ones it understands, and `createParamsUrl` rebuilds the hash
from all of them, replacing only what a link overrides. The language therefore rides along
through the challenge row and the next-challenge link without either of them knowing about it.

Changing language mid-run goes through `presentLanguagePicker` in `src/ui/language-picker.ts`.
Its `<select>` is one tab stop rather than one per language, announces its own current value
without an `aria-current` to maintain, and opens the platform's own picker on a phone. Its
options are `LOCALE_NAMES`, built from `LOCALES` rather than written out, so a third language
needs no edit to the control and none to `index.html`, which ships the `<select>` empty.

## What guards what

| Test                           | What it holds                                                                                                                                                                                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the type system                | Key parity in both directions, and the right number of plural forms per language. A Russian catalogue missing a key does not compile.                                                                                                                                                                |
| `src/i18n/catalogue.test.ts`   | Key order, non-empty values, `{placeholder}` parity, markup confined to `.html` keys and opening and closing the same tags in every locale, `.code` blocks identical but for their comments, the WCAG 2.5.3 pair, and Russian typography — «ёлочки» in pairs, spaced em dashes, ё, no double spaces. |
| `src/i18n/format.test.ts`      | `PLURAL_CATEGORIES` against what ICU actually says, so a wrong guess about a new language fails a test rather than mistranslating a count.                                                                                                                                                           |
| `src/ui/localise-page.test.ts` | That every key `index.html` names exists and takes no parameters; that the shell ships, word for word, the English of every message it names; that the noscript paragraph is left alone; that the modifier keys are relabelled after the shell is rewritten.                                         |
| `src/page.test.ts`             | The two documentation pages as one document in two languages, every `docs.*` message against the passage it was lifted from in both languages, no `docs.*` key left unchecked, and the popup against the page wherever their English agrees.                                                         |
| `src/i18n/inventory.test.ts`   | This file: the keys it names, the keys it omits, the counts it prints, the `src/` paths it points at, the absence of line pins, and the learning track's quoted titles. Not the rest of its prose.                                                                                                   |

That last row said **nothing** through two rebuildings of this document. What closes most of it
is `src/i18n/inventory.test.ts`, which reads this file with `?raw` and checks it against
`EN_MESSAGES`:

1. Every backticked token in this file shaped like a message key — dotted, and with a first
   segment that is one of the catalogue's prefixes — is a real `MessageKey`. This catches a key
   renamed in the catalogue and left behind here.
2. Every key in `EN_MESSAGES` appears somewhere in this file, except the 64 `tutorial.taskN.*`
   keys the learning track section covers by their shape — its prose and its two programs alike.
   This catches a message added without a row.
3. The **Keys** column of _Where the strings are_ equals the number of `EN_MESSAGES` keys under
   each prefix, and the **Total** equals `Object.keys(EN_MESSAGES).length`.
4. Every backticked `src/…` path exists on disk. This catches a renamed module. Keep it to
   `src/`: a message key such as `docs.play.start.html` is shaped like a file name and is not
   one, and `licenses.txt` only exists once the build has run.
5. No `file.ts:123` pin below _How this file is anchored_, so the convention cannot quietly
   lapse. The two in that section are the examples of what it prevents, and are meant to stay
   wrong.
6. The learning track's table quotes each task title as `EN_MESSAGES` words it, and carries a row
   for every task in it. This is the one column of prose comparable by equality — the titles are
   copied whole rather than abridged — and it had already rotted when the check was added: task
   6's row said "lies to passengers" where the catalogue says "lies to its passengers", through
   five checks that all passed because none of them read the column.

What it does not check is everything that cannot be read off `EN_MESSAGES`: the English column of
_The strings_, which is abridged on purpose and so cannot be compared; the Notes and the _What
reads them_ column; the counts in the section headings, which count what a section lists rather than what
the catalogue holds; and the 81 and 82 above, which come from a grep over the whole tree. Those
are still prose and can still go quietly out of date. The test's own header says as much, so
whoever reads it knows which columns are guarded and which are taken on trust.

## What changed on screen when this was wired

Even in English, routing text through the catalogue changed four things. All four are
improvements, and all four are visible.

1. **Grouped thousands.** Challenge 18 asks for 2675 people —
   `requireUserCountWithinTimeWithMaxWaitTime(2675, 1800, 45)` — and used to render `2675`;
   `Intl.NumberFormat` renders `2,675` in English and `2 675` in Russian.
2. **The saved-code time** lost its tail: `t("editor.saved", { time: formatTime(savedAt) })`
   renders `21:03:57` where `Code saved ${savedAt.toTimeString()}` rendered
   `21:03:57 GMT+0300 (Moscow Standard Time)`.
3. **Fractional time scales** render `0.5x` in English and `0,5×` in Russian.
4. **Non-breaking spaces** appear between numbers and unit abbreviations in Russian, so `60 с`
   cannot break across a line.

## Known overlap: `documentation.ru.html`

While this catalogue was being written, another change added `documentation.ru.html` — a
separate, fully translated Russian copy of the reference page, with `hreflang` alternates linking
the pair. That covers the same ground as the 81 unread `docs.*` keys, by a different route: a
static file per language instead of one document translated at run time.

Both were kept, which would ordinarily mean maintaining the Russian documentation twice — and it
did: a review of the Russian page put a dozen corrections into `documentation.ru.html`, and every
one of them stayed there while `ru.ts` went on saying the thing that had been corrected.
`src/page.test.ts` now closes that gap from both ends, so the duplication is still there and can
no longer drift silently. That turns the choice below from pending into deferred:

- **Keep the static pages** and drop the `docs.*` keys from the catalogue, or generate
  `documentation.ru.html` from them at build time. The 81 unread keys have no other call site, so
  removing them touches nothing else — but `docs.basics.example.code` does have one, and would
  have to stay.
- **Keep the catalogue** and reduce `documentation.ru.html` to a redirect.

Whoever takes it up should read `src/page.test.ts` first: whichever side is dropped, those
assertions are the specification of what the surviving side has to keep saying.

## Adding a language

One catalogue file, plus three lines the compiler demands anyway:

1. Add the code to `Locale` and `LOCALES` in `src/i18n/locale.ts`, and its endonym to
   `LOCALE_NAMES`. The language picker and `index.html` need no edit at all: the options are
   built from `LOCALES`.
2. Add the plural categories `Intl` gives that language to `PLURAL_CATEGORIES` in
   `src/i18n/format.ts`. `src/i18n/format.test.ts` checks the list against ICU, so a wrong guess
   fails a test rather than mistranslating a count.
3. Write `src/i18n/<code>.ts` as `MessageCatalogue<"<code>">`. Every missing key, every extra key
   and every missing plural form is a compile error.
4. Register it in `CATALOGUE_LOADERS` in `src/i18n/index.ts`, as a one-line loader that
   `await import()`s the file and assigns it to that locale's own slot. Assigning to the slot by
   name is what makes step 3 bite: the Russian entry is checked against Russian's four plural
   forms and the English one against English's two. The `import()` sits inside that assignment
   rather than around it, so splitting the catalogue out of the bundle costs none of the
   checking.

The reference page is a separate job and deliberately so: `src/ui/documentation-links.ts` maps a
locale to the file the build emits, and the set of catalogues and the set of translated pages are
allowed to differ. A catalogue is one file a translator can finish in an afternoon; the reference
page is nine hundred lines of tables. Ship the interface first.

The tests in `src/i18n/catalogue.test.ts` then check the new catalogue for key parity, placeholder
parity, markup that matches the English structure, and example code identical to the English but
for its comments.
