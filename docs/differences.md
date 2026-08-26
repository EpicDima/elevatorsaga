# Differences from the original game

This repository is a TypeScript modernization of
[Magnus Wolffelt's Elevator Saga](https://github.com/magwo/elevatorsaga), which is still
playable at [play.elevatorsaga.com](https://play.elevatorsaga.com/). The levels, the physics and
the scoring are unchanged; the code underneath is not.

## What this fork adds

Everything here is additive: no level got easier or harder, and a program written for the original
is scored by the same rules.

- **A learning track.** Eight small buildings that teach the API before the levels ask for it,
  under **Learning track** in the level menu at the top of the page. Seven of them hand you a
  program that runs and loses, and ask you to work out why: an elevator that only visits one floor,
  a destination queue that is filled and never started, indicators that lie to the passengers.
  Three hints are there when you want them — the third is the answer — beside a note on what the run
  was actually doing. The track remembers what you have cleared and marks those tiles in the menu,
  and the eighth of them is level 1's building and level 1's bar, so the program that clears it is
  one you can take straight into level 1. See [the learning track](learning-track.md).
- **A jump list for the levels.** Every level is a tile in the level menu at the top of the page, so
  going back to level 3 to try another program on it is one click rather than an edit to the address
  bar.
  Nothing is locked: the list is a table of contents, not a gate, and any level in it opens from the
  first visit whether or not the ones below it have been cleared. What you have earned shows as
  stars on the tile instead. The one being played is marked, and the menu runs learning track,
  numbered levels, Skyscraper, free play.
- **A Skyscraper block.** Thirteen levels on how real lift systems are actually run — morning and
  evening peaks and the lunch hour, cars that serve only part of the building, and buildings whose
  passengers name the floor they want instead of pressing a call button. They are `#level=sky-1` to
  `#level=sky-13` and sit in their own block in the menu, because the numbered levels are the
  original's and a decade of published solutions is scored against them. Each pins its own seed, so
  a medal means the same thing to two players.
- **Repeatable runs.** Every run draws its passengers from a seed, which is shown in the settings
  menu and printed to the console as the run starts. Following the seed link, or writing `#seed=…` yourself,
  brings the same people back in the same order to every restart — enough to compare two programs
  on one problem instead of on two different ones. A second link drops the seed again when you are
  done with it. The whole run repeats, not only the passengers: player code and physics advance in
  fixed ticks rather than in whatever a frame was worth, so the cars end up in the same places at
  the same times whatever the display is doing.
- **A sandbox building.** `#level=sandbox` takes `floors`, `elevators`, `capacities` and
  `spawnrate`, so you can build the case your program is failing on rather than looking for a
  shipped level that resembles it. See [URL parameters](url-parameters.md).
- **Plain functions instead of an object.** The program the game hands you declares `init` and
  `update` at the top level, so there are no outer braces to balance and no comma between the two,
  and a `const`, a `let` or a helper function beside them is shared by both — which is where a
  program's state goes now. `update` is optional: leave it out and nothing happens on a tick.
  Nothing was taken away, either. A solution written as the original's object literal still runs
  exactly as it did, and the one thing that used to trip such a solution up here — a `//` comment
  above its opening `{`, which made the game read the program as a block and die on **Start** with
  `SyntaxError: Function statements require a function name` — no longer does.
- **Five more methods on the elevator.** `isFull()`, `isEmpty()` and `isApproachingFloor(n)` —
  the three checks nearly every published solution had already written by hand out of `loadFactor`
  and `destinationQueue` — and `servedFloors()`, which answers the question a zoned building makes
  worth asking: which floors does this car stop at? `takeRequest(from, to)` is the fifth, and the
  only one that does something rather than reporting something: it books this car for one journey
  somebody is waiting to make.
- **Two more events on the floor, and one more method.** `hall_button_pressed` fires for either call
  button and hands its handler the direction, so a program that treats a call as a call — which is
  most of them, since the queue an elevator ends up with is a list of floors either way — writes one
  handler instead of registering the same one twice. `destination_requested` is the call a building
  with no call buttons makes instead: its passengers name the floor they are going to, and a program
  answers by sending a car for that journey. `pendingDestinations()` is the same question asked
  rather than waited for — the journeys people here are still waiting on, and how many of them.
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
  [Writing solutions outside the game](writing-solutions.md).
- **Five more figures on the panel.** `Avg wait for a car` and `Avg ride time` are the two halves of
  the commute the panel never separated: both clocks it has always shown run from a passenger
  appearing to their stepping out, ride included, and these are the wait and the ride the industry
  that builds real lifts measures a building by. `Stops` counts door openings rather than floors
  crossed, and `People per stop` is everyone who got in or out over those stops, which is the pair
  round-trip-time analysis is built out of. `Avg load` is how full the cars were, averaged over the
  moves counted above it. Read that one beside the number delivered rather than on its own — of
  three programs measured on the same eighteen-floor building, the one that filled its cars best
  delivered the fewest people, at nearly twice the wait of the program whose cars were emptiest.
- **A Russian API reference**, at
  [documentation.ru.html](https://epicdima.github.io/elevatorsaga/documentation.ru.html).

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
- `pendingDestinations()` — a fresh `{ floorNum, waiting }[]`, in floor order, of the journeys
  people here are still waiting on
- `on` / `off` / `once` / `one` / `offAll` for `up_button_pressed`, `down_button_pressed`,
  `hall_button_pressed`, `destination_requested` and `buttonstate_change`

Everything else the old `Floor` object exposed — `yPosition`, `getSpawnPosY`, `elevatorAvailable`,
`pressUpButton`, `pressDownButton`, `trigger` — is unreachable, and every handler that is handed a
floor is handed the facade rather than the internal one. This closes upstream issue
[#3](https://github.com/magwo/elevatorsaga/issues/3). Not one of those members reaches the
simulation — the five that write anything write only the caller's own handler list — which is what
keeps handing this object out safe; the verb a destination-dispatch program needs is
`takeRequest` on the elevator, which had verbs already. Two of the events the original does not
have: `hall_button_pressed`, described under
[Asked for upstream, and here already](#asked-for-upstream-and-here-already), and
`destination_requested`, which is raised only in a building whose passengers announce where they
are going instead of pressing a call button.

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
arities and payloads. `isFull()`, `isEmpty()`, `isApproachingFloor(n)`, `servedFloors()` and
`takeRequest(from, to)` are additions, as the floor's new events and `pendingDestinations()` above
are, so a solution that uses them is one you cannot take back to
[play.elevatorsaga.com](https://play.elevatorsaga.com/). So are `once()` and `offAll()`, which is
easy to miss because what they do is not new: riot's observable and the `unobservable.js` near-copy
of it each define `on`, `off`, `one` and `trigger` and no other method, so those two names are this
emitter's spellings of `one()` and `off("*")` rather than the original's.

**Your saved code survives, and each level now keeps its own.** Every numbered level has its own
program — under `develevateChallengeCode_<level>_<slot>` in `localStorage`, a prefix left spelled
the way it was so that nothing saved before the rename went missing — instead of all nineteen
sharing the one buffer the legacy key held, so changing your answer on level 8 no longer touches
what you left on level 7. Each level also offers three interchangeable slots for a program you want
to keep, switched with the buttons above the editor: nothing built into them means "attempt" or
"goal", they are just three places to put code so you never have to lose one to try another. The
legacy key, `elevatorCrushCode_v5`, is read once as the starting point for level 1's first slot —
the one slot a player who saved code before slots existed will find it under — and stays in use for
the sandbox, which has no level index of its own to key a slot by. The reset backup follows the same
split, one per level and slot rather than the single `develevateBackupCode` it used to share. Reads
and writes are wrapped in `try`/`catch`, so a browser that refuses storage degrades instead of
crashing.

## Fixed bugs

The modernization closed a number of issues from the
[upstream tracker](https://github.com/magwo/elevatorsaga/issues). Several of these change simulation
outcomes, so a solution that scraped past a level before may now behave differently — usually
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
  [#20](https://github.com/magwo/elevatorsaga/issues/20) — elevators no longer start the level
  with `moveCount === 1`. Their initial placement was being counted as a move, which quietly taxed
  every "move as little as possible" level.
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
  excluded, which makes the statistic deterministic and the levels it decides — 8, 9, 11 to 15
  and 18 — marginally easier than the same levels upstream. **A score from here is not
  comparable with a score from [play.elevatorsaga.com](https://play.elevatorsaga.com/)**, and a
  solution posted on the upstream wiki that cleared one of them by a fraction of a second may not
  be doing the same work here that it did there. What the figure is has not changed and will not:
  it is measured from a passenger appearing to their stepping out at their floor, so it includes
  the ride, and a passenger carried nineteen floors after boarding a car that was already standing
  there — no wait at all — still sets it. Upstream calls it a waiting time and this fork used to
  print that on the panel; the panel now says `Avg delivery time` and `Max delivery time`, which is
  what the same unchanged number has always been. The waiting time upstream meant by the old name is
  on the panel too, in a row of its own between them, with the ride it leaves out in the row under
  it — see [What this fork adds](#what-this-fork-adds).
- A malformed `#level` or `#timescale` used to be fatal. `#level=abc` indexed the level list
  with `NaN` and killed the page before anything was drawn; `#timescale=abc` set the world's
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
  levels asked for one, and `#spawnrate` in the URL is clamped before it gets this far — it was
  reachable by building a `World` directly, which is what the level definitions and anyone
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
  passenger on that floor to board. The car is traveling at speed when the handler runs, so the
  nearest position it can physically reach is the one it would coast to, which is past the floor;
  boarding is offered on arrival at a floor, and the car never arrives at one. `stop()` says as much
  in the API documentation — "the elevator will probably not stop at a floor, so passengers will not
  get out" — and what the reporter wanted is spelled `goToFloor`. `src/game/world.test.ts`
  reproduces the whole scenario under "stopping en route", alongside the one-line change that makes
  the same passenger board, so the difference is pinned rather than argued. It reads like the
  indicator bugs under [Fixed bugs](#fixed-bugs) and is not one of them: those are about a car
  standing still with the wrong indicator lit, and no indicator can help a car that is not level
  with a floor.

## Asked for upstream, and here already

Some of what this fork does answers feature requests that are still open on the upstream tracker.
None of it was taken from those threads — each was built for its own reasons and the match found
afterwards — but somebody arriving from one of those issues should be told their wish is already
granted here rather than having to work it out from a feature list.

- [#34](https://github.com/magwo/elevatorsaga/issues/34) — "allow replay a challenge with the exact
  same passengers", so that a case can be reproduced instead of waited for. That is what the seed
  is: `#seed=…` brings the same people back in the same order to every restart, and
  `src/game/determinism.test.ts` holds three seeds to it across frame rates that differ, wander and
  differ by a nanosecond. The reporter also asked that a replayed level not count as passed;
  it does count here, because the seed changes who arrives and not what winning takes.
- [#103](https://github.com/magwo/elevatorsaga/issues/103) — a playground without a level's
  constraints, "just random popup guests", to debug a program against. `#level=sandbox` is a
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
  split into waiting, traveling and total. `Avg wait for a car` on the panel is the wait; the two
  delivery clocks beside it are the total they were always measuring; the traveling time is what
  is left between them. A related request,
  [#77](https://github.com/magwo/elevatorsaga/issues/77), is answered only in part: how long people
  have been waiting is now a number on the panel, but it is not drawn beside the passenger it
  belongs to, and the yellow mark still picks out the longest commute rather than the longest wait.
- [#108](https://github.com/magwo/elevatorsaga/issues/108) — "how am I supposed to know how many
  elevators there are?", and [PR #113](https://github.com/magwo/elevatorsaga/pull/113), which said
  the sentence describing `init` and `update` explains nothing. They are the same paragraph, and it
  now says what those two functions are handed: the same two arrays every call, so
  `elevators.length` is the count; whatever the program declares at the top level beside them is
  shared by both, which is where its state goes; and `init` runs on the first frame the game
  actually runs — code applied while it is paused waits for Start — with `update` on that frame and
  every one after, which is why `dt` and not a tally of calls measures game time.
- [#33](https://github.com/magwo/elevatorsaga/issues/33) — "Add a `floor.hall_button_pressed` event
  to the API", because handling a call the same way whichever button rang it meant registering the
  same handler for both events and then working out which one had called it. The event is here, and
  its handler is passed the direction first — `"up"` or `"down"`, the words the rest of the API uses
  for one — and the floor second, which the issue's own sketch does not ask for because it closes
  over the floor, but which a handler shared between floors needs. Every press raises the pair:
  `up_button_pressed` or `down_button_pressed` first and `hall_button_pressed` after it, in that
  order whichever order the two were registered in, so a program listening for both hears about
  that press twice and always hears the specific event first. Something can come between them, but
  only a press one of your own handlers made — the game's own passengers press again while a call
  is being delivered, and each such call arrives whole.
- [PR #104](https://github.com/magwo/elevatorsaga/pull/104) — a control to expand and collapse the
  code editor. What shipped is more than the PR asked for: the editor's bottom edge is a grip, so
  every height in the range is available rather than two, and the choice is remembered. The PR's own
  mechanism is not what shipped: it writes a height onto the element, which would have outranked the
  narrow-viewport rule that shrinks the editor on a phone forever after. The chosen height is a
  token of its own here and the stylesheet clamps it, so the phone still gets its own answer.

The rest of the tracker's feature requests are not answered here, and nothing in this list is a
claim about upstream's plans for them.
