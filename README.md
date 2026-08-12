# Elevator Saga

[![CI](https://github.com/EpicDima/elevatorsaga/actions/workflows/ci.yml/badge.svg)](https://github.com/EpicDima/elevatorsaga/actions/workflows/ci.yml)

![Challenge 5 in progress: four elevators carrying people between six floors, passengers waiting on
the landings, one of them marked yellow as the longest the panel is reporting, the statistics panel
counting them, and the JavaScript program driving it all in the editor
below](public/images/screenshot.png)

Elevator Saga is a programming game. You are given a building, a few elevators and a stream of
impatient people, and the only control you have is a small JavaScript program: an object with an
`init` function that runs once and an `update` function that runs repeatedly. Nineteen of the 20
challenges set a target — transport 15 people in 60 seconds, or 100 people using no more than 63
elevator moves, or 50 people with none of them taking longer than 21 seconds to deliver — and you
keep rewriting your program until it clears them. The twentieth sets none: it is an endless demo
you can leave running.

You play in the browser. Type your program in the editor next to the building, press **Apply**
(or <kbd>Ctrl</kbd>+<kbd>Enter</kbd>) to restart the challenge with it, and watch. Your code is
saved to `localStorage` as you go, so closing the tab does not lose it;
<kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>S</kbd> saves it immediately rather than opening the browser's
save dialog. The full API — every method,
property and event on the elevator and floor objects, with examples — is in
[documentation.html](documentation.html), which is served alongside the game
([in Russian](documentation.ru.html)). If challenge 1 and a starter program you are left to reverse
engineer are not where you want to begin, [the learning track](#the-learning-track) teaches the same
API one small mistake at a time.

This is a modernized fork of [Magnus Wolffelt's original](https://github.com/magwo/elevatorsaga),
which is still playable at [play.elevatorsaga.com](https://play.elevatorsaga.com/). The challenges,
the physics and the scoring are unchanged; the code underneath is not. jQuery, lodash, riot and
CodeMirror 5 are gone, the simulation is TypeScript with unit tests, and a pile of long-standing
bugs are fixed. If you are bringing a solution over from the original, read
[Breaking changes for player code](#breaking-changes-for-player-code) first.

## What this fork adds

Everything here is additive: no challenge got easier or harder, and a program written for the
original is scored by the same rules.

- **A learning track.** Eight small buildings that teach the API before the challenges ask for it,
  behind the **Learning track** link in the header. Seven of them hand you a program that runs and
  loses, and ask you to work out why: an elevator that only visits one floor, a destination queue
  that is filled and never started, indicators that lie to the passengers. Three hints are there
  when you want them — the third is the answer — beside a note on what the run was actually doing.
  The track remembers what you have cleared, so the header link takes you to the first task you
  have not, and the eighth task is challenge 1's building and challenge 1's bar, so the program
  that clears it is one you can take straight into challenge 1. See
  [The learning track](#the-learning-track).
- **A jump list for the challenges.** Every challenge is a link in the bar above the building, so
  reaching challenge 12 no longer means either winning eleven of them or hand-editing the address
  bar. The one being played is marked, and the last entry is the endless demo.
- **Repeatable runs.** Every run draws its passengers from a seed, which is shown in the bar and
  printed to the console as the run starts. Following the seed link, or writing `#seed=…` yourself,
  brings the same people back in the same order to every restart — enough to compare two programs
  on one problem instead of on two different ones. A second link drops the seed again when you are
  done with it. It does not make a run frame-for-frame identical: the browser decides how long a
  frame is.
- **A sandbox building.** `#challenge=sandbox` takes `floors`, `elevators`, `capacities` and
  `spawnrate`, so you can build the case your program is failing on rather than looking for a
  shipped challenge that resembles it. See [URL parameters](#url-parameters).
- **Three more methods on the elevator.** `isFull()`, `isEmpty()` and `isApproachingFloor(n)` —
  the three checks nearly every published solution had already written by hand out of `loadFactor`
  and `destinationQueue`.
- **One more event on the floor.** `hall_button_pressed` fires for either call button and hands its
  handler the direction, so a program that treats a call as a call — which is most of them, since
  the queue an elevator ends up with is a list of floors either way — writes one handler instead of
  registering the same one twice.
- **Room to work in the editor.** Drag the grip under the editor to any height between six lines and
  85% of the window, and it is still that height next visit. From the keyboard it is a focusable
  splitter: <kbd>↑</kbd> and <kbd>↓</kbd> move it a line at a time, <kbd>Page Up</kbd> and
  <kbd>Page Down</kbd> five, <kbd>Home</kbd> and <kbd>End</kbd> go to either end, and a double-click
  gives the shipped height back. The shipped height holds about fifteen lines at the editor's
  `14px/1.4`, and the starter program is fifteen lines, so anything you write past it was being read
  through a letterbox. A phone still gets the shorter editor its own rule asks for, and a height
  chosen on a wide screen is clamped rather than carried onto a narrow one.
- **Autocompletion in the editor.** The elevator and floor API is offered as you type, and on
  <kbd>Ctrl</kbd>+<kbd>Space</kbd>, with the same one-line descriptions the reference page uses.
  It is added to the JavaScript language's own completions rather than replacing them, so keywords
  and the identifiers already in your program are still there.
- **Types for your own editor.** A TypeScript declaration file describing the whole player API ships
  with the site, so a solution kept in a file of your own is offered the same API as you type, with
  a description on every member of it and, on top of those, type checking. See
  [Writing your solution in your own editor](#writing-your-solution-in-your-own-editor).
- **Two more figures on the panel.** `Avg wait for a car` is the part of the commute a passenger
  spends standing on a floor, which is the half the panel never separated: both clocks it has always
  shown run from a passenger appearing to their stepping out, ride included. `Avg load` is how full
  the cars were, averaged over the moves counted above it. Read that one beside the number
  delivered rather than on its own — of three programs measured on the same eighteen-floor
  building, the one that filled its cars best delivered the fewest people, at nearly twice the wait
  of the program whose cars were emptiest.
- **A Russian API reference**, at [documentation.ru.html](documentation.ru.html).

## The learning track

Challenge 1 hands you a building, a starter program that sends one elevator between two floors and
never explains itself, and a reference page that assumes you already know which of its methods you
are looking for. The track is what comes before that: eight small buildings, behind the **Learning
track** link in the header or at `#challenge=tutorial-1`, each one built around a single mistake.

Every task starts with a program that runs and loses, and asks you to find out why. The elevator
that only ever visits one of two floors; the handler nobody subscribed; the passengers whose buttons
are ignored; the destination queue that is filled and never started; the car that sweeps nine floors
because it never asked who was waiting; the indicators that tell everybody it is going up, so half
the building refuses to board; the second elevator that stands still all run. The eighth is an empty
`init` in challenge 1's building, against challenge 1's bar.

The buildings are tuned so that the lesson is not a coin flip. Each task pins the seed it is played
on, and on that seed the program you are handed loses and the task's own answer wins — both
measured, not hoped for. `src/game/tutorial-solutions.test.ts` replays both programs of every task
on ten seeds, and `src/game/tutorial-sweep.test.ts` replays three of them on four hundred: the two
whose bar is a worst case rather than a total, where one unlucky passenger decides the run, and the
one whose answer is measured losing a seed. A change to the physics that quietly turns a lesson
upside down fails the suite instead of reaching a player.

Each task carries three hints, folded away until you want one — the third is the answer in full,
because a hint you cannot get past is not a hint — and a **Why this happens** note on what the run
was really doing. The editor belongs to the task: what you write is kept per task and your own
program in the game's editor is left alone until you press **Take this program into your own
editor**, which copies what is in front of you across for when you leave. Cleared tasks are
remembered in `localStorage`, so the header link goes to the first one you have not cleared — back
to task 1 once there is none — and nothing is ever locked: every task is playable by its address
from the first visit.

A task refuses two things you can write in the URL, each with a console warning and each taken back
out of the address bar. `seed`, because whether the given program really loses is a fact about the
passenger stream as much as about the program — task 5's sweep does win on some seeds — so
`#challenge=tutorial-5,seed=42a` would sit a player in front of a broken program winning. And
`devtest`, whose reference solution is no answer to any of the first seven tasks — and each task
already hands out its own answer as its last hint. Because the seed is the task's rather than yours, the bar above the building
shows no seed line while a task is open — there is nothing there to pin and nothing to unpin — and
Restart brings back the same passengers rather than a fresh draw. An address that names no task,
such as `tutorial-9`, starts the first task rather than challenge 1: whoever wrote it was asking for
the track.

The whole track — titles, goals, hints and explanations — is translated, so it can be played in
Russian as well as English.

## Writing your solution in your own editor

The editor on the page is fine for small changes, but a solution you are actually working on tends
to live in a real file somewhere. `public/elevatorsaga.d.ts` is a TypeScript declaration file that
describes everything player code can reach — every method, property and event on the elevator and
floor objects, each with a description of its own. Those descriptions are written for this file
rather than lifted from elsewhere: of the twenty members the reference page, the in-page completion
popup and the declaration all describe, not one is described here in the words either of the other
two uses. Point your editor at it and you get completion, hover documentation and type checking for
a plain `.js` file: no build step, no TypeScript in your program, nothing to compile before pasting
it back into the game.

It catches the mistakes that are otherwise a silent failed run: a misspelled event name, `goToFloor`
called with a string, a `passing_floor` handler that expects the wrong arguments, a method the
original game had and this fork does not.

### Getting the file

From a clone it is `public/elevatorsaga.d.ts` — copy it next to your solution. Vite copies `public/`
into `dist/` verbatim, so a site you are running serves the same bytes from its root:

```sh
curl -O http://localhost:5173/elevatorsaga.d.ts   # npm run dev
curl -O http://localhost:4173/elevatorsaga.d.ts   # ...or npm run preview, after npm run build
```

### Making your editor see it

Either give the directory a `tsconfig.json`:

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": true
  }
}
```

Any editor that runs the TypeScript language service — VS Code, Zed, Neovim, WebStorm — reads it
from there. Every `.d.ts` beside it is included automatically, so nothing has to name the file;
`checkJs` is what extends the checking to `.js`, and without it you get completion and no
diagnostics.

Or, if you would rather not have a config file, name it from the top of your solution:

```js
// @ts-check
/// <reference path="./elevatorsaga.d.ts" />
```

Both lines are needed. The `reference` is what finds the declaration, and it alone buys completion
and hover text; `// @ts-check` is what turns the diagnostics on, and a lone `.js` file with no
`tsconfig.json` has no other way to ask for them — without it a misspelled event name is offered no
correction and reported nowhere.

### Annotating your program

Either way, one line above your program tells the editor what the object you are writing is:

```js
/** @type {ElevatorSaga.Solution} */
({
  init: function (elevators, floors) {
    var elevator = elevators[0];

    elevator.on("idle", function () {
      elevator.goToFloor(0);
    });

    floors.forEach(function (floor) {
      floor.on("up_button_pressed", function () {
        elevator.goToFloor(floor.floorNum());
      });
    });
  },

  update: function (dt, elevators, floors) {},
});
```

Without that annotation `elevators` and `floors` are `any`, and it costs more than the completion
list: under the `"strict": true` printed above, this very example is six errors, one per parameter
that has lost its type — the two `init` takes, the `floor` its `forEach` callback takes, and the
three on `update` — each reported as implicitly having an `any` type. With the annotation the same
file compiles clean, `elevators` and `floors` are `readonly ElevatorSaga.Elevator[]` and
`readonly ElevatorSaga.Floor[]`, and everything below follows.

**Keep the parentheses around the object.** The game wraps your program in them for you, but only
when it starts with `{` — a program that starts with a comment does not, so a bare `{ … }`
underneath one is evaluated as a block and dies on **Apply** with `SyntaxError: Function statements
require a function name`. Written as above it pastes back into the game unchanged, comment and all.

The declaration describes _this fork_, including `isFull()`, `isEmpty()` and
`isApproachingFloor(n)`, which the original game does not have. It is not maintained by hand alone:
`src/api-declarations.test.ts` compares it against the live facades — every member, the type of
each, every event, and the arguments each handler is given — so the suite fails when the two
disagree. The header of that file says how far the comparison reaches and where it stops.

## Scoring a solution without a browser

The same benchmark the **Fitness** button runs — three buildings, six seeds, everything averaged —
is also a command:

```sh
npm run bench -- sweep.js
```

The file is a program in exactly the form the in-page editor takes: an object literal with `init`
and `update`, parentheses optional. Nothing is drawn and no browser is involved — the simulation
never needed one — so a full report takes under a second. Save this as `sweep.js` and the numbers
below are what you get, on any machine:

```js
{
  init: function (elevators, floors) {
    elevators.forEach(function (elevator) {
      elevator.on("idle", function () {
        floors.forEach(function (floor) {
          elevator.goToFloor(floor.floorNum());
        });
      });
    });
  },
  update: function () {},
}
```

```
program: sweep.js
seeds:   1, 2, 3, 4, 5, 6
locale:  en

scenario         transportedPerSec  avgWaitTime  avgPickupTime  transportedCount  avgLoadFactorOnMove
Small scenario               0.578        8.339          3.128           115.500                0.279
Medium scenario              1.398       13.158          5.464           279.500                0.553
Large scenario               1.480       45.271         22.820           296.000                0.582
```

`avgWaitTime` is the whole journey, spawn to delivery, ride included; `avgPickupTime` is the part
of it spent standing on a floor, so the difference between them is the ride. A sweep that visits
every floor in turn spends over a third of its passengers' time collecting them in the smallest
building, and slightly over half of it in the largest.
`avgLoadFactorOnMove` is how full the cars were, averaged over every floor they crossed — a sweep
carries a light load because it goes to floors nobody called it to.

| Option             | What it does                                                           |
| ------------------ | ---------------------------------------------------------------------- |
| `--seeds <list>`   | Comma-separated seeds, one run of all three scenarios each, averaged   |
| `--locale <tag>`   | Language for the scenario names: `en` or `ru`                          |
| `--timeout <secs>` | Whole seconds to finish in, `1` to `2147483`. Default `60`, no way off |
| `--json`           | The report as JSON, with the numbers unrounded                         |
| `-h`, `--help`     | The usage text                                                         |
| `--`               | End of options: what follows is the program file, whatever it is named |

No option may be given twice, and an option that takes a value will not swallow the next option as
one — write `--seeds=-1` for a seed that starts with a dash.

Two things make it usable as a check rather than as a curiosity. The numbers are reproducible: the
seeds fix the buildings, so the same program scores the same to the last decimal, and two programs
can be compared without wondering which drew the easier traffic. And the report owns standard
output — everything the run itself prints, including the stack of a program that threw and any
`console.log` you are debugging with, goes to standard error instead, so `--json` is safe to pipe.
One thing is out of its reach: descriptors belong to a process rather than to the thread the run
happens in, so a program that writes to file descriptor 1 directly — which takes an `import()` of
`node:fs` to arrange — lands in the middle of the report. Writing one that does is aiming at the
report rather than debugging.
The exit code is `0` when the program was scored, `1` when it threw, would not compile or ran out
of time, and `2` when the command itself could not proceed — bad arguments, a file it could not
read, or a defect in the tool. A script scoring a directory of programs can therefore tell a bad
program from a benchmark that has stopped working: a `2` means nothing was measured, and nothing is
printed about the program at all.

A program that never returns is stopped rather than waited on. The run happens in a worker thread
with a deadline on it, the same arrangement the page uses for the **Fitness** button and the same
minute by default, so a `while (true)` in an `update()` costs you a message and an exit code
instead of a terminal you have to go and kill:

```sh
npm run bench -- spinner.js --timeout 5
```

```
program: spinner.js
seeds:   1, 2, 3, 4, 5, 6
locale:  en

error: The fitness worker did not finish within 5s and was stopped. Does your program have a loop that never ends?
```

Pipe from the entry point rather than through `npm run`, which prints the script it is about to run
on the same stream:

```sh
node src/cli/bench.ts solution.js --seeds 42 --json | jq '.scenarios[].result.avgWaitTime'
for f in solutions/*.js; do node src/cli/bench.ts "$f" --seeds 1,2,3; done
```

Running the TypeScript entry point directly is Node's own type stripping, which is on by default
from Node 22.18 and 24. On an earlier 22.x, `node --experimental-strip-types src/cli/bench.ts` does
the same thing.

## Quick start

Node 22 or newer is required.

```sh
npm ci
npm run dev
```

Then open <http://localhost:5173/>. The help and API page is at
<http://localhost:5173/documentation.html>, and in Russian at
<http://localhost:5173/documentation.ru.html>. The dev server hot-reloads on save.

To produce the static site and check it locally:

```sh
npm run build     # emits dist/index.html and the two documentation pages
npm run preview   # serves dist/ at http://localhost:4173/
```

The build sets a relative base path, so `dist/` can be dropped on any static host, including a
GitHub Pages project sub-path, without further configuration.

## Scripts

| Script                  | What it does                                                  |
| ----------------------- | ------------------------------------------------------------- |
| `npm run dev`           | Vite dev server with hot module replacement                   |
| `npm run build`         | Typechecks, then builds the three pages into `dist/`          |
| `npm run preview`       | Serves the built `dist/` for a final look before deploying    |
| `npm run typecheck`     | `tsc --noEmit` over the whole project                         |
| `npm run bench`         | Scores a solution file headlessly; see above                  |
| `npm test`              | Runs the Vitest suite once                                    |
| `npm run test:watch`    | Runs the suite in watch mode                                  |
| `npm run test:coverage` | Runs the suite and writes a V8 coverage report to `coverage/` |
| `npm run test:e2e`      | Runs the Playwright smoke tests against the built site        |
| `npm run screenshot`    | Recaptures `public/images/screenshot.png` from the game       |
| `npm run lint`          | ESLint over the repository                                    |
| `npm run lint:fix`      | ESLint with `--fix`                                           |
| `npm run format`        | Rewrites files with Prettier                                  |
| `npm run format:check`  | Fails if anything is not Prettier-formatted                   |

## Project structure

```
src/
  game/     the simulation: elevators, floors, passengers, physics, challenges,
            the event emitter, and the facades handed to player code
  ui/       DOM presenters, markup templates, inline SVG icons, CodeMirror editor
  app/      hash router, challenge orchestration, fitness benchmark worker
  cli/      the benchmark as a terminal command; the only part of src/ not
            meant for a browser
  i18n/     message catalogue, locale detection, plural and number formatting
  styles/   the single stylesheet
  main.ts   entry point: wires the three layers together and starts the router
  docs.ts   entry point for the documentation pages (styles and font only)
```

The layering rule is one-directional and worth keeping: **`src/game` never touches the DOM.** It
imports nothing from `src/ui` or `src/app`, holds no element references, and has no opinion about
how a lift is drawn. That is why the simulation runs under Vitest's plain `node` environment with no
jsdom and no rendering setup at all, and why the fitness benchmark can run the whole thing inside a
web worker. `src/ui` renders what `src/game` reports; `src/app` is the glue that decides which
challenge is running and feeds the player's code in.

## URL parameters

Everything after the `#` is a comma-separated list of `key=value` pairs, for example
`#challenge=7,timescale=8,autostart`. Anything unrecognized is left alone and carried into the
"next challenge" link. Anything malformed falls back to a sane default with a console warning
rather than breaking the page.

| Parameter               | Effect                                                                                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#challenge=N`          | Starts challenge `N`, counting from 1. Out of range, missing, or unreadable as a number and not one of the two names below: challenge 1.                                                                                    |
| `#challenge=sandbox`    | Starts a building of your own instead of a numbered challenge. See below.                                                                                                                                                   |
| `#challenge=tutorial-N` | Starts task `N` of the learning track, from `tutorial-1` to `tutorial-8`. A `tutorial-` address no task has starts the first one. See [The learning track](#the-learning-track).                                            |
| `#autostart`            | Starts the simulation immediately instead of waiting for the Start button.                                                                                                                                                  |
| `#timescale=X`          | Simulation speed multiplier. Clamped to `0.1`–`64`. Fractions such as `1.5` work. Without it, the speed you last chose is used again — it is kept in `localStorage` under `elevatorTimeScale` — and `2` when there is none. |
| `#seed=S`               | Pins the seed the passenger stream is drawn from. Not the building. Refused on a learning task. See below.                                                                                                                  |
| `#devtest`              | Loads the built-in reference solution into the editor, replacing what is there. Refused on a learning task.                                                                                                                 |
| `#fullscreen`           | Hides everything except the building.                                                                                                                                                                                       |

The three flags — `autostart`, `devtest` and `fullscreen` — are on when present and off when
explicitly set to `false` (`#autostart=false`). Bare flags now work: in the original, `#fullscreen`
without a value was silently ignored because the parser's regexp demanded one.

### Seeds

Every run draws its passengers from a seeded generator, and shows its seed in the bar above the
building as well as printing it to the console. Put that seed back in the URL and the same people
arriving in the same order come back — from the Restart button, from <kbd>Ctrl</kbd>+<kbd>Enter</kbd>
and from a reload alike.

You do not have to type it. When the URL pins no seed, the seed in the bar is a link that pins the
one currently running, so a run worth keeping is one click away after you have seen it. When the URL
does pin one, the bar shows the value with a **new draw** link beside it, which drops the seed and
starts again on fresh passengers. Both links name the challenge as well as the seed, so either one
is a complete address you can paste at someone.

A URL with no `seed` draws a fresh one on every restart, which is deliberate: a run you cannot get
away from is not what you want when you are stuck on a challenge.

None of this applies on the learning track, where the seed belongs to the task rather than to you:
there is no seed line in the bar, nothing is printed, and every restart replays the same passengers.
See [The learning track](#the-learning-track).

**What a seed fixes is the passenger stream, and only that.** The building — how many floors, how
many elevators, how large they are — comes from the challenge number or from the sandbox parameters,
and the seed has no say in it. Two URLs with the same seed and different `challenge` values are two
different buildings. Frame lengths come from the browser too, so your program is asked to decide at
slightly different moments each time and two interactive runs of one seed still diverge in their
timing. Only the headless paths — the fitness benchmark and the test suite, which drive the clock
themselves — repeat a run step for step.

A seed is a string of at most 64 characters from `A-Z a-z 0-9 _ . -`, so `#seed=issue-61` is as
valid as `#seed=1234567890`. It is never read as a number: `0123` and `123` are different seeds,
because a URL that quietly replays something other than what it says is worse than one that does
not work. The character set is narrow because the seed has to come back out of the address bar byte
for byte: a space or a non-Latin letter is percent-encoded on the way in, so `#seed=rush hour` would
return as `rush%20hour`, hash to something else and hand a different passenger stream to whoever
followed the link. A comma cannot reach the parser at all — that is what separates one parameter
from the next. Anything outside the set is refused with a console warning and a fresh seed.

### Sandbox

`#challenge=sandbox` replaces the numbered challenge with a building you specify. It has no success
condition — nothing to win, and nothing to fail — so it is for reproducing a case and watching what
your program does with it.

| Parameter          | Effect                                                            | Range   | Default |
| ------------------ | ----------------------------------------------------------------- | ------- | ------- |
| `floors=N`         | Floors in the building                                            | 2–60    | 8       |
| `elevators=N`      | Elevators serving them                                            | 1–12    | 2       |
| `capacities=A-B-C` | Passengers each car holds, cycled over the cars; hyphen-separated | 1–30    | 4       |
| `spawnrate=X`      | Passengers appearing per simulated second                         | 0.01–10 | 0.6     |

The defaults are challenge 4's building, so a bare `#challenge=sandbox` starts something known to
be playable. Every bound is either a value the simulation cannot survive or one the page cannot
draw — a one-floor building sends passengers to a floor that does not exist, and cars are drawn ten
pixels per unit of capacity, so how many elevators fit depends on how wide the capacities make
them. Values outside a range are clamped and warned about; values that are not numbers fall back.
`capacities` uses hyphens rather than commas because a comma already separates hash parameters.

## Breaking changes for player code

A solution written for the original game will very likely need edits. These are the changes that
matter, in rough order of how often they bite.

**lodash and jQuery are gone.** The page used to load jQuery, lodash and riot as plain scripts,
which left `_`, `$` and `riot` sitting on `window` where player code could reach them. `index.html`
is now a single ES module and loads none of them, so all three are gone. Rewrite with the standard
library: `_.each` → `Array.prototype.forEach` or `for...of`, `_.map`/`_.filter`/`_.reduce` → the
array methods of the same name, `_.min`/`_.max` → `Math.min`/`Math.max` (or a `sort` for
`_.minBy`-style calls), `_.range` → `Array.from({ length: n }, (_, i) => i)`, `_.random` →
`Math.random`, `_.contains` → `Array.prototype.includes`, `_.isEmpty(arr)` → `arr.length === 0`.
Nothing else from the simulation is global either — the old build leaked `Elevator`, `User`,
`World`, `challenges`, `limitNumber` and friends into the global scope, and all of it is
module-scoped now.

**Floors are facades now, not the real thing.** `init(elevators, floors)` and
`update(dt, elevators, floors)` are handed `FloorInterface` objects. The whole surface, defined in
`src/game/floor-interface.ts`, is:

- `floorNum()` — the floor number, counting up from 0 at the bottom
- `level` — the same number as a property; undocumented, but kept because published solutions use it
- `buttonStates` — a read-only `{ up, down }` **snapshot**, rebuilt on every read, so assigning to
  it or mutating it no longer clears the building's call buttons
- `on` / `off` / `once` / `one` / `offAll` for `up_button_pressed`, `down_button_pressed`,
  `hall_button_pressed` and `buttonstate_change`

Everything else the old `Floor` object exposed — `yPosition`, `getSpawnPosY`, `elevatorAvailable`,
`pressUpButton`, `pressDownButton`, `trigger` — is unreachable. The three `*_button_pressed`
handlers are also passed the facade rather than the internal floor. This closes upstream issue
[#3](https://github.com/magwo/elevatorsaga/issues/3). `hall_button_pressed` is the one event in
that list the original does not have; it is described under
[Asked for upstream, and here already](#asked-for-upstream-and-here-already).

**The event emitter is a rewrite; the surface solutions use is not.** `src/game/observable.ts`
replaces riot's `riot.observable` and the near-copy of it in `unobservable.js`. Everything player
code was written against still works, including the parts the old game never documented:

- `this` inside a `function` handler is still the elevator or floor the handler was registered on,
  so `elevator.on("idle", function () { this.goToFloor(0); })` behaves as it always did. Handlers
  are invoked with the facade as their receiver, which is what riot's `fn.apply(el, args)` did.
- A handler registered for several space-separated events is still passed the name of the event
  that fired as an extra first argument:
  `elevator.on("floor_button_pressed passing_floor", function (eventName, floorNum, direction) { ... })`.
  A registration that names a single event is unaffected.
- `off("*")` still unregisters everything, and a handler passed alongside the wildcard is still
  ignored. `offAll()` is the named spelling of the same thing, and both exist on floors as well as
  elevators. `off("event")` and `off("event", handler)` are unchanged, and accept space-separated
  names.
- `one()` still registers a single-shot handler. It is an alias of `once()` and, like riot's, takes
  a single event name. The one difference is the order of removal and invocation: the handler comes
  off before it runs rather than after, so re-triggering the same event from inside it does not
  recurse.

**A handler registered during a dispatch no longer runs for the event in flight.** Both old
emitters iterated the live handler array; the new one iterates a snapshot, matching how DOM
`EventTarget` behaves. Removing a handler mid-dispatch still takes effect immediately.

**`idle` fires in more situations, and is not re-entrant.** The elevator now re-checks its
destination queue whenever it halts, not only when it halted exactly at the head of the queue, so
`stop()` and clearing `destinationQueue` mid-flight eventually produce `idle`. Calling
`checkDestinationQueue()` from inside your own `idle` handler — which the documentation recommends
— is supported and will not re-enter `idle`.

**The elevator object's methods live on its prototype.** It is a class instance now rather than a
bag of own properties built by mixin, so `Object.keys(elevator)`, `for...in`,
`elevator.hasOwnProperty("goToFloor")` and `JSON.stringify(elevator)` see less than they used to.
Every documented method and property behaves identically; `destinationQueue` is still an own,
writable array.

**Nothing else on the elevator changed.** `goToFloor`, `stop`, `checkDestinationQueue`,
`destinationQueue`, `currentFloor`, `loadFactor`, `maxPassengerCount`, `destinationDirection`,
`getPressedFloors`, `getFirstPressedFloor`, `goingUpIndicator`, `goingDownIndicator` and the
`idle` / `floor_button_pressed` / `passing_floor` / `stopped_at_floor` events all keep their names,
arities and payloads. `isFull()`, `isEmpty()` and `isApproachingFloor(n)` are additions, as the
floor's `hall_button_pressed` above is, so a solution that uses them is one you cannot take back to
[play.elevatorsaga.com](https://play.elevatorsaga.com/). So are `once()` and `offAll()`, which is
easy to miss because what they do is not new: riot's observable and the `unobservable.js` near-copy
of it each define `on`, `off`, `one` and `trigger` and no other method, so those two names are this
emitter's spellings of `one()` and `off("*")` rather than the original's.

**Your saved code survives.** The editor still reads and writes the same `localStorage` key,
`elevatorCrushCode_v5`, and the reset backup still uses `develevateBackupCode`. Open the modernized
game in the same browser profile and your program is where you left it. Reads and writes are wrapped
in `try`/`catch` now, so a browser that refuses storage degrades instead of crashing.

## Fixed bugs

The modernization closed a number of issues from the
[upstream tracker](https://github.com/magwo/elevatorsaga/issues). Several of these change simulation
outcomes, so a solution that scraped past a challenge before may now behave differently — usually
better.

- [#59](https://github.com/magwo/elevatorsaga/issues/59) /
  [#74](https://github.com/magwo/elevatorsaga/issues/74) /
  [#98](https://github.com/magwo/elevatorsaga/issues/98) — flipping an indicator on an elevator
  parked at a floor now re-offers boarding, instead of leaving passengers standing there forever.
- [#88](https://github.com/magwo/elevatorsaga/issues/88) /
  [#83](https://github.com/magwo/elevatorsaga/issues/83) /
  [#27](https://github.com/magwo/elevatorsaga/issues/27) — one of your handlers throwing no longer
  kills the other handlers registered for that event, and no longer disables itself permanently.
- [#92](https://github.com/magwo/elevatorsaga/issues/92) — `stop()` eventually emits `idle`. It
  previously left the elevator parked with no event and no way to notice.
- [#105](https://github.com/magwo/elevatorsaga/issues/105) — the one-second boarding dwell is no
  longer skipped on the paths that halt an elevator without reaching the head of its queue, and it
  now covers the re-offer as well, so an elevator can no longer accept a passenger and drive off in
  the same frame.
- [#117](https://github.com/magwo/elevatorsaga/issues/117) /
  [#20](https://github.com/magwo/elevatorsaga/issues/20) — elevators no longer start the challenge
  with `moveCount === 1`. Their initial placement was being counted as a move, which quietly taxed
  every "move as little as possible" challenge.
- [#110](https://github.com/magwo/elevatorsaga/issues/110) — a passenger who is refused boarding
  because the elevator is heading the wrong way presses the call button again, instead of waiting
  in silence for a call that was never registered.
- [#3](https://github.com/magwo/elevatorsaga/issues/3) — player code gets a floor facade rather
  than the live `Floor` object, so a solution can no longer corrupt the simulation by poking at it.
- [#119](https://github.com/magwo/elevatorsaga/issues/119) — the editor no longer reindents code on
  paste, which used to mangle anything pasted in from an external editor.

Four more, without upstream issues:

- `maxWaitTime` counted the walk-away animation of passengers who had already been delivered,
  inflating the statistic by a random 1–1.5 seconds per person. Delivered passengers are now
  excluded, which makes the statistic deterministic and the challenges it decides — 8, 9, 11 to 15
  and 18 — marginally easier than the same challenges upstream. **A score from here is not
  comparable with a score from [play.elevatorsaga.com](https://play.elevatorsaga.com/)**, and a
  solution posted on the upstream wiki that cleared one of them by a fraction of a second may not
  be doing the same work here that it did there. What the figure is has not changed and will not:
  it is measured from a passenger appearing to their stepping out at their floor, so it includes
  the ride, and a passenger carried nineteen floors after boarding a car that was already standing
  there — no wait at all — still sets it. Upstream calls it a waiting time and this fork used to
  print that on the panel; the panel now says `Avg delivery time` and `Max delivery time`, which is
  what the same unchanged number has always been. The waiting time upstream meant by the old name is
  on the panel too, in a row of its own between them — see
  [What this fork adds](#what-this-fork-adds).
- A malformed `#challenge` or `#timescale` used to be fatal. `#challenge=abc` indexed the challenge
  list with `NaN` and killed the page before anything was drawn; `#timescale=abc` set the world's
  time scale to `NaN`, which froze the simulation with no way out short of editing the URL by hand.
  Both are validated and fall back to a default now.
- `goToFloor(NaN)` — or `undefined`, or `"abc"`, or a typo that evaluated to an object — used to
  queue `NaN` as a destination, and from there the elevator's position, its current floor and its
  whole queue were `NaN` for the rest of the run. Nothing recovered it, and nothing said so: no
  error, no pause, no hint, while every passenger it was carrying stayed stranded. A destination
  that is not a floor number is now refused and reported through the same "problem with your code"
  banner as any other mistake in a solution, and the same goes for a non-finite entry assigned
  straight into `destinationQueue`. Anything that names a real floor still behaves exactly as it
  did, in or out of range.
- A negative `spawnRate` froze the tab on the first frame. The spawn loop runs while the time since
  the last arrival exceeds `1 / spawnRate`, and with a negative rate that threshold is negative:
  every pass subtracted a negative number, so the clock ran backwards, the condition never became
  false, and the loop went on creating passengers until the tab died. A rate that is not a positive
  number is now read as "nobody arrives", reported once on the console. Nothing in the shipped
  challenges asked for one, and `#spawnrate` in the URL is clamped before it gets this far — it was
  reachable by building a `World` directly, which is what the challenge definitions and anyone
  embedding the engine do.

### Reported, reproduced, and not a bug here

- [#111](https://github.com/magwo/elevatorsaga/issues/111) /
  [#138](https://github.com/magwo/elevatorsaga/issues/138) — "only the last elevator responds to my
  handlers", filed by two people, which usually means either a real bug or a documentation failure.
  It is the second, and it is written down rather than closed silently, because "cannot reproduce"
  is a worse answer than "here is what you actually hit". Every elevator interface carries its own
  emitter and dispatches with itself as `this`. Registering handlers with `forEach` on a
  three-elevator building, each handler hears its own elevator, once each; registering the same
  handlers in a `for` loop with `var`, all three of those events arrive at the third elevator.
  `var` gives the whole function a single binding, so by the time any handler runs the variable
  holds the elevator the loop finished on — `let` and `forEach` give each iteration its own.
  `src/game/world-controller.test.ts` asserts the engine half of that, so nobody can ever repair the
  simulation for a fault that is not in it.
- [#124](https://github.com/magwo/elevatorsaga/issues/124) — "user doesn't enter the elevator when
  it stops enroute". The reporter calls `stop()` from a `passing_floor` handler and expects the
  passenger on that floor to board. The car is travelling at speed when the handler runs, so the
  nearest position it can physically reach is the one it would coast to, which is past the floor;
  boarding is offered on arrival at a floor, and the car never arrives at one. `stop()` says as much
  in the API documentation — "the elevator will probably not stop at a floor, so passengers will not
  get out" — and what the reporter wanted is spelled `goToFloor`. `src/game/world.test.ts`
  reproduces the whole scenario under "stopping en route", alongside the one-line change that makes
  the same passenger board, so the difference is pinned rather than argued.

  This one was listed as _fixed_ here until 2026-08-12, filed with #59 / #74 / #98 above. It never
  was: those are about an elevator standing still with the wrong indicator lit, and no indicator can
  help a car that is not level with a floor.

## Asked for upstream, and here already

Some of what this fork does answers feature requests that are still open on the upstream tracker.
None of it was taken from those threads — each was built for its own reasons and the match found
afterwards — but somebody arriving from one of those issues should be told their wish is already
granted here rather than having to work it out from a feature list.

- [#34](https://github.com/magwo/elevatorsaga/issues/34) — "allow replay a challenge with the exact
  same passengers", so that a case can be reproduced instead of waited for. That is what the seed
  is: `#seed=…` brings the same people back in the same order to every restart, and
  `src/game/determinism.test.ts` holds three seeds to it across frame rates that differ, wander and
  differ by a nanosecond. The reporter also asked that a replayed challenge not count as passed;
  it does count here, because the seed changes who arrives and not what winning takes.
- [#103](https://github.com/magwo/elevatorsaga/issues/103) — a playground without a challenge's
  constraints, "just random popup guests", to debug a program against. `#challenge=sandbox` is a
  building with no success condition and four parameters to shape it.
- [#68](https://github.com/magwo/elevatorsaga/issues/68) — <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>S</kbd>
  should save the code rather than open the browser's save dialog. It does: the editor takes the
  binding, suppresses the browser's default, and writes to storage there and then instead of waiting
  out the autosave delay.
- [#133](https://github.com/magwo/elevatorsaga/issues/133) — TypeScript for the API, and
  [#137](https://github.com/magwo/elevatorsaga/pull/137) — autocompletion inside the game. Both
  ship, and are described under [What this fork adds](#what-this-fork-adds).
- [#52](https://github.com/magwo/elevatorsaga/issues/52) — "average time spent in the elevator", and
  [PR #82](https://github.com/magwo/elevatorsaga/pull/82), which asked for the reported time to be
  split into waiting, travelling and total. `Avg wait for a car` on the panel is the wait; the two
  delivery clocks beside it are the total they were always measuring; the travelling time is what
  is left between them. A related request,
  [#77](https://github.com/magwo/elevatorsaga/issues/77), is answered only in part: how long people
  have been waiting is now a number on the panel, but it is not drawn beside the passenger it
  belongs to, and the yellow mark still picks out the longest commute rather than the longest wait.
- [#108](https://github.com/magwo/elevatorsaga/issues/108) — "how am I supposed to know how many
  elevators there are?", and [PR #113](https://github.com/magwo/elevatorsaga/pull/113), which said
  the sentence describing `init` and `update` explains nothing. They are the same paragraph, and it
  now says what those two functions are handed: the same two arrays every call, so
  `elevators.length` is the count; `this` is the object you declared, so a program can keep its
  state there; and `init` runs on the first frame the game actually runs — code applied while it is
  paused waits for Start — with `update` on that frame and every one after, which is why `dt` and
  not a tally of calls measures game time.
- [#33](https://github.com/magwo/elevatorsaga/issues/33) — "Add a `floor.hall_button_pressed` event
  to the API", because handling a call the same way whichever button rang it meant registering the
  same handler for both events and then working out which one had called it. The event is here, and
  its handler is passed the direction first — `"up"` or `"down"`, the words the rest of the API uses
  for one — and the floor second, which the issue's own sketch does not ask for because it closes
  over the floor, but which a handler shared between floors needs. It is raised immediately after
  `up_button_pressed` or `down_button_pressed` for the same press, in that order whichever order
  the two were registered in, so a program listening for both hears about that press twice and
  always hears the specific event first.
- [PR #104](https://github.com/magwo/elevatorsaga/pull/104) — a control to expand and collapse the
  code editor. What shipped is more than the PR asked for: the editor's bottom edge is a grip, so
  every height in the range is available rather than two, and the choice is remembered. The PR's own
  mechanism is not what shipped: it writes a height onto the element, which would have outranked the
  narrow-viewport rule that shrinks the editor on a phone forever after. The chosen height is a
  token of its own here and the stylesheet clamps it, so the phone still gets its own answer.

The rest of the tracker's feature requests are not answered here, and nothing in this list is a
claim about upstream's plans for them.

## Development

Tests are co-located with the code they cover: `src/game/elevator.ts` is tested by
`src/game/elevator.test.ts`. Vitest picks up `src/**/*.test.ts`. To run one file:

```sh
npx vitest run src/game/elevator.test.ts
npx vitest src/game/elevator.test.ts   # ...in watch mode
npx vitest run -t "destination queue"  # ...or filter by test name across all files
```

The default test environment is plain `node`, because the simulation core has no DOM dependency and
starting jsdom for it would only make the suite slower. A test that genuinely needs a DOM opts in
per file with a docblock on the very first line:

```ts
// @vitest-environment jsdom
```

That is how `src/app/app.test.ts`, `src/page.test.ts`, `src/i18n/detect.test.ts` and every `src/ui`
test that touches an element runs. Two in `src/ui` do not and are left on `node`:
`completions.test.ts` and `error-location.test.ts` both work on plain data — a completion table and
a stack trace — and neither builds anything to put on a page.

### End-to-end tests

`e2e/` holds a handful of Playwright smoke tests. They exist to answer one question the unit tests
cannot: does the thing that actually ships come up in a real browser? So they run against the
**production build** — `npm run test:e2e` builds the site and serves `dist/` with `vite preview`
before the first test — and they stay few on purpose: fourteen files. What they cover is everything
whose proof is the browser itself. The game comes up and a challenge is played through to
"Success!"; a program survives a reload in `localStorage`, a pasted block keeps the indentation it
arrived with, <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>S</kbd> writes it the moment it is pressed without
the browser's own save dialog opening, and a program that will not compile or throws
mid-simulation raises the error banner instead of failing silently. Then the parts that are only
real once an address bar and a browser are involved: a pinned seed brings the same passengers back
on reload while an unpinned run draws a new building each time, a parameter the router refused
leaves the address bar without breaking the Back button, the page arrives in the language the
browser asks for and follows the picker to the other one, and a learning task shows its panel,
keeps its answer folded until asked, and hands its program to the editor. Finally the flat
statements: the help page and the licence notices are reachable from the footer, the link preview
points at an image that is really served, both pages reflow onto a 320 px phone, and the keyboard
reaches the editor in one tab stop from the busiest challenge. Behaviour is covered in depth by the
Vitest suite; repeating it through a browser would only buy slower, flakier versions of tests that
already exist.

```sh
npm run test:e2e                       # the whole suite
npx playwright test e2e/game.spec.ts   # ...one file
npx playwright test --ui               # ...interactively
npx playwright show-report             # the report from the last run
```

Chromium has to be present the first time: `npx playwright install chromium`. The two runners cannot
see each other's files — Vitest collects `src/**/*.test.ts`, Playwright collects `e2e/**/*.spec.ts`.

`public/images/screenshot.png` is captured by `e2e/screenshot.spec.ts`, which is deliberately
excluded from the suite and run on its own with `npm run screenshot`; nothing in CI rewrites it. It
lives under `public/` because it is also the site's `og:image`: Vite copies that directory to the
root of `dist/`, so the picture at the top of this file and the one in a link preview are the same
file. The run it captures is drawn from a pinned seed, so recapturing after a change to the look of
the game shows that change rather than a fresh crowd; the spec says which seed and why.

Before opening a pull request, run what CI runs: `npm run typecheck`, `npm run lint`,
`npm run format:check`, `npm test`, `npm run build` and `npm run test:e2e`. CI runs the same five
checks — `npm run test:coverage` in place of `npm test`, which is the same suite plus a coverage
report — on Node 22 and Node 24 for every push to `master` and every pull request — only the two active
LTS lines are covered, since odd-numbered Node releases never become LTS — and runs the end-to-end
tests alongside them in a job of their own, so a browser download never holds up the fast checks.

### Why TypeScript is held at 6

`package.json` pins `typescript` to `^6.0.3` even though npm's `latest` is 7.x. It is
`typescript-eslint` that decides this: 8.66 declares `typescript: ">=4.8.4 <6.1.0"` as a peer
dependency, and the lint configuration here is `strictTypeChecked` plus `stylisticTypeChecked` —
rules that ask the compiler about types rather than reading the syntax tree, and so run against
whatever compiler API that package was built for. Moving to 7 fails the install outright on npm's
peer resolution, and forcing it past that would leave the type-aware half of `npm run lint`
running against an API its own dependency does not claim to support. The pin comes off when
typescript-eslint ships a release that widens the range.

### The original implementation

Comments throughout `src/` cite the code they were ported from by `file:line` — `libs/riot.js:40-42`,
`world.js:22-23`, `interfaces.js:6`. Those files were deleted in 2.0, so the citations point at the
tag `legacy-1.x` (commit `e0c55bf`), the last revision before the modernization, where the originals
sit unchanged:

```sh
git show legacy-1.x:libs/riot.js
```

### Deploying

`.github/workflows/deploy.yml` builds the site and publishes it with the official GitHub Pages
actions, but it is **manual only** — run it from the Actions tab. Pages has to be pointed at Actions
in the repository settings before a push trigger would publish anything.

To make it automatic instead:

1. In **Settings → Pages → Build and deployment**, change **Source** from "Deploy from a branch" to
   **GitHub Actions**. Do this first: while the source is a branch, the workflow's deploy step has
   nothing to publish to and will fail.
2. Add a push trigger to `.github/workflows/deploy.yml`, alongside `workflow_dispatch:`:

   ```yaml
   on:
     push:
       branches: [master]
     workflow_dispatch:
   ```

## Credits and licence

Elevator Saga was created by [Magnus Wolffelt](https://github.com/magwo) and its
[contributors](https://github.com/magwo/elevatorsaga/graphs/contributors). This repository is a
TypeScript modernization of that work.

The project is released under the MIT Licence — copyright © 2015 Magnus Wolffelt for the original
game, © 2026 EpicDima for this rewrite. See [LICENSE.txt](LICENSE.txt) for the full text.

The code editor is [CodeMirror 6](https://codemirror.net/) by Marijn Haverbeke and contributors,
with its [Lezer](https://lezer.codemirror.net/) parser for JavaScript, both licensed under the
[MIT Licence](https://github.com/codemirror/dev/blob/main/LICENSE). Together they are around 500 kB
of the built bundle — most of what the browser downloads.

The twelve interface icons in `src/ui/icons.ts` are the glyph outlines of
[Font Awesome](https://fontawesome.com/) 4.1.0 by Dave Gandy, copied verbatim from the SVG
webfont the legacy game shipped. Font Awesome 4 is licensed
`Font: SIL OFL 1.1, CSS: MIT License`; only the font artwork is used here, so the
[SIL OFL 1.1](https://scripts.sil.org/OFL) applies. The full licence text and the upstream
copyright notice are in [src/ui/fontawesome-license.txt](src/ui/fontawesome-license.txt), and
[src/ui/fontawesome-glyphs.json](src/ui/fontawesome-glyphs.json) records which glyph came from
which codepoint.

The interface font is [Oswald](https://fonts.google.com/specimen/Oswald), copyright © 2016 The
Oswald Project Authors, licensed under the [SIL OFL 1.1](https://scripts.sil.org/OFL) and
self-hosted via [Fontsource](https://fontsource.org/) — which is why four `.woff`/`.woff2` files
are copied into `dist/assets/` by a build.

None of this stays in the repository only. `npm run build` collects the licence of every runtime
dependency out of `node_modules`, adds the game's own and the Font Awesome notice, and writes the
lot to `dist/licenses.txt`, which the footer of both pages links to. The generator is the
`licenseNotices` plugin at the top of [vite.config.ts](vite.config.ts); add a dependency and its
terms appear in the next build without anyone having to remember.
