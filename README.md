# Elevator Saga

[![CI](https://github.com/EpicDima/elevatorsaga/actions/workflows/ci.yml/badge.svg)](https://github.com/EpicDima/elevatorsaga/actions/workflows/ci.yml)

Elevator Saga is a programming game. You are given a building, a few elevators and a stream of
impatient people, and the only control you have is a small JavaScript program: an object with an
`init` function that runs once and an `update` function that runs repeatedly. Each of the 19
challenges sets a target — transport 15 people in 60 seconds, or 100 people using no more than 63
elevator moves, or 50 people without anyone waiting longer than 21 seconds — and you keep rewriting
your program until it clears them.

You play in the browser. Type your program in the editor next to the building, press **Apply**
(or <kbd>Ctrl</kbd>+<kbd>Enter</kbd>) to restart the challenge with it, and watch. Your code is
saved to `localStorage` as you go, so closing the tab does not lose it. The full API — every method,
property and event on the elevator and floor objects, with examples — is in
[documentation.html](documentation.html), which is served alongside the game.

This is a modernized fork of [Magnus Wolffelt's original](https://github.com/magwo/elevatorsaga),
which is still playable at [play.elevatorsaga.com](https://play.elevatorsaga.com/). The game itself
is unchanged; the code underneath is not. jQuery, lodash, riot and CodeMirror 5 are gone, the
simulation is TypeScript with unit tests, and a pile of long-standing bugs are fixed. If you are
bringing a solution over from the original, read
[Breaking changes for player code](#breaking-changes-for-player-code) first.

## Quick start

Node 22 or newer is required.

```sh
npm ci
npm run dev
```

Then open <http://localhost:5173/>. The help and API page is at
<http://localhost:5173/documentation.html>. The dev server hot-reloads on save.

To produce the static site and check it locally:

```sh
npm run build     # emits dist/index.html and dist/documentation.html
npm run preview   # serves dist/ at http://localhost:4173/
```

The build sets a relative base path, so `dist/` can be dropped on any static host, including a
GitHub Pages project sub-path, without further configuration.

## Scripts

| Script                  | What it does                                                  |
| ----------------------- | ------------------------------------------------------------- |
| `npm run dev`           | Vite dev server with hot module replacement                   |
| `npm run build`         | Typechecks, then builds the two pages into `dist/`            |
| `npm run preview`       | Serves the built `dist/` for a final look before deploying    |
| `npm run typecheck`     | `tsc --noEmit` over the whole project                         |
| `npm test`              | Runs the Vitest suite once                                    |
| `npm run test:watch`    | Runs the suite in watch mode                                  |
| `npm run test:coverage` | Runs the suite and writes a V8 coverage report to `coverage/` |
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
  styles/   the single stylesheet
  main.ts   entry point: wires the three layers together and starts the router
  docs.ts   entry point for documentation.html (styles and font only)
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

| Parameter      | Effect                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| `#challenge=N` | Starts challenge `N`, counting from 1. Out of range, non-numeric or missing values start challenge 1. |
| `#autostart`   | Starts the simulation immediately instead of waiting for the Start button.                            |
| `#timescale=X` | Simulation speed multiplier. Clamped to `0.1`–`64`; defaults to `2`. Fractions such as `1.5` work.    |
| `#devtest`     | Loads the built-in reference solution into the editor, replacing what is there.                       |
| `#fullscreen`  | Hides everything except the building.                                                                 |

The three flags — `autostart`, `devtest` and `fullscreen` — are on when present and off when
explicitly set to `false` (`#autostart=false`). Bare flags now work: in the original, `#fullscreen`
without a value was silently ignored because the parser's regexp demanded one.

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

**Multi-event handlers no longer get the event name.** Registering one handler for several
space-separated events still works, but riot used to prepend the name as an extra first argument
whenever it did. The new emitter (`src/game/observable.ts`) does not, so a handler receives exactly
the arguments the documentation lists for each event:

```js
// Before: (eventName, floorNum, direction)
// Now:    (floorNum, direction) — and floor_button_pressed passes no direction
elevator.on("floor_button_pressed passing_floor", function (floorNum, direction) { ... });
```

If you relied on the name to tell the events apart, register two handlers instead.

**Floors are facades now, not the real thing.** `init(elevators, floors)` and
`update(dt, elevators, floors)` are handed `FloorInterface` objects. The whole surface, defined in
`src/game/floor-interface.ts`, is:

- `floorNum()` — the floor number, counting up from 0 at the bottom
- `level` — the same number as a property; undocumented, but kept because published solutions use it
- `buttonStates` — a read-only `{ up, down }` **snapshot**, rebuilt on every read, so assigning to
  it or mutating it no longer clears the building's call buttons
- `on` / `off` / `once` for `up_button_pressed`, `down_button_pressed` and `buttonstate_change`

Everything else the old `Floor` object exposed — `yPosition`, `getSpawnPosY`, `elevatorAvailable`,
`pressUpButton`, `pressDownButton`, `trigger` — is unreachable. The `up_button_pressed` and
`down_button_pressed` handlers are also passed the facade rather than the internal floor. This
closes upstream issue [#3](https://github.com/magwo/elevatorsaga/issues/3).

**`off("*")` is gone; use `offAll()`.** riot treated `"*"` as a wildcard when unregistering. The
replacement is an explicit `offAll()` method on the emitter. `off("event")` and
`off("event", handler)` are unchanged, and both still accept space-separated names.

**`one()` is now `once()`.** riot gave every observable a `one()` for single-shot handlers; the
method is named `once()`. It was never documented, but it worked, so solutions in the wild use it.

**`this` inside an event handler is no longer the elevator.** riot invoked handlers with
`fn.apply(el, args)`. The new emitter calls `handler(...args)` with no receiver, and module code is
strict, so in a `function` handler `this` is now `undefined`:

```js
// Used to work, now throws:
elevator.on("idle", function () {
  this.goToFloor(0);
});
// Write this instead:
elevator.on("idle", () => {
  elevator.goToFloor(0);
});
```

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
arities and payloads.

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
  [#98](https://github.com/magwo/elevatorsaga/issues/98) /
  [#124](https://github.com/magwo/elevatorsaga/issues/124) — flipping an indicator on an elevator
  parked at a floor now re-offers boarding, instead of leaving passengers standing there forever.
- [#88](https://github.com/magwo/elevatorsaga/issues/88) /
  [#83](https://github.com/magwo/elevatorsaga/issues/83) /
  [#27](https://github.com/magwo/elevatorsaga/issues/27) — one of your handlers throwing no longer
  kills the other handlers registered for that event, and no longer disables itself permanently.
- [#92](https://github.com/magwo/elevatorsaga/issues/92) — `stop()` eventually emits `idle`. It
  previously left the elevator parked with no event and no way to notice.
- [#105](https://github.com/magwo/elevatorsaga/issues/105) — the one-second boarding dwell is no
  longer skipped on the paths that halt an elevator without reaching the head of its queue.
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

Two more, without upstream issues:

- `maxWaitTime` counted the walk-away animation of passengers who had already been delivered,
  inflating the statistic by a random 1–1.5 seconds per person. Delivered passengers are now
  excluded, which makes the wait-time challenges both easier and deterministic.
- A malformed `#challenge` or `#timescale` used to be fatal. `#challenge=abc` indexed the challenge
  list with `NaN` and killed the page before anything was drawn; `#timescale=abc` set the world's
  time scale to `NaN`, which froze the simulation with no way out short of editing the URL by hand.
  Both are validated and fall back to a default now.

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

That is how the `src/ui` tests, `src/app/app.test.ts` and `src/page.test.ts` run.

Before opening a pull request, run what CI runs: `npm run typecheck`, `npm run lint`,
`npm run format:check`, `npm test` and `npm run build`. CI executes all five on Node 22 and Node 24
for every push to `master` and every pull request; only the two active LTS lines are covered,
since odd-numbered Node releases never become LTS.

### Deploying

`.github/workflows/deploy.yml` builds the site and publishes it with the official GitHub Pages
actions, but it is **manual only** — run it from the Actions tab. The repository is still published
by hand with `autopublish.sh`, which merges `master` into a `gh-pages` branch, and an automatic
workflow would overwrite the live site without warning.

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

3. Retire `autopublish.sh` and the `gh-pages` branch, so exactly one thing writes to the site.

## Credits and licence

Elevator Saga was created by [Magnus Wolffelt](https://github.com/magwo) and its
[contributors](https://github.com/magwo/elevatorsaga/graphs/contributors). This repository is a
TypeScript modernization of that work.

The project is released under the MIT Licence, copyright © 2015 Magnus Wolffelt — see
[LICENSE.txt](LICENSE.txt) for the full text.

The interface icons in `src/ui/icons.ts` are traced from [Font Awesome](https://fontawesome.com/)
Free 4.1, by Dave Gandy. The icon artwork is licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and the underlying font under the
[SIL OFL 1.1](https://scripts.sil.org/OFL).

The interface font is [Oswald](https://fonts.google.com/specimen/Oswald), licensed under the
[SIL OFL 1.1](https://scripts.sil.org/OFL) and self-hosted via
[Fontsource](https://fontsource.org/).
