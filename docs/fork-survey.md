# What other people built on top of Elevator Saga

Surveyed **10 August 2026**. Upstream ([magwo/elevatorsaga](https://github.com/magwo/elevatorsaga))
has had no commit since 21 November 2022 and has **352 forks**; the fork network is where most of
the work since then happened, and almost none of it is linked from anywhere.

This is a shopping list, not an archive. Everything below is here because it is an idea we could
take — a feature, a fix, or a lesson from someone who tried it and hit a wall.

## How this was gathered, and what it misses

All 352 forks were listed through the GitHub API, then filtered: a fork whose last push is within a
day or two of the moment it was created, with no stars and upstream's own file count, is somebody's
saved solution. That left **57 candidates**, of which **29 were compared against upstream**
(`compare/master...owner:branch`, which returns the exact commit count ahead and every commit
message in one call). Of those, **18 are genuinely ahead**; the rest turned out to be zero-commit
forks that had merely drifted behind. The top forks were then read directly — READMEs, diffs,
`package.json` — over `raw.githubusercontent.com`.

Everything in the fork section was verified this way. **The remaining 28 candidates were not
compared** (unauthenticated API is 60 requests an hour and this cost 33), and neither were the ~295
forks the filter discarded — the filter is good but not perfect, so something could be hiding there.

The sections after the fork list come from a separate web search across English, Russian, Chinese
and Japanese sources. Claims there are marked with what was actually read.

Everything examined is MIT, inheriting upstream's licence, with `LICENSE.txt` unmodified — so code
can be lifted with attribution, not just reimplemented. The one exception is
[2xh](https://github.com/2xh/elevatorsaga), which renamed the file to `LICENSE` and whose contents
were not checked. Anything adopted from a fork should carry a line in our `LICENSE.txt` naming the
author.

## Forks that are actually ahead of upstream

Ordered by how much we would want what they have.

### Worth taking

**[avodonosov/elevatorsaga](https://github.com/avodonosov/elevatorsaga)** — 5 commits ahead ·
[play](https://avodonosov.github.io/elevatorsaga/) ·
[diff](https://github.com/magwo/elevatorsaga/compare/master...avodonosov:elevatorsaga:master)

The single best idea in the entire fork network, and the smallest. Two things:

1. **Seeded replay.** Every run generates a seed, prints it to the console with the two ways to
   replay it (`?seed=…` in the URL, or `window.GameSeed = "…"`) and the instruction to stop. So when
   a solution fails a wait-time challenge you can run _the same building again_ instead of guessing.
2. **The oldest-waiting passenger is drawn in red**, and passengers who are leaving are greyed out
   harder. This is the answer to "why did my max-wait blow up" rendered directly into the picture.

Its README is also honest about the part that did not work: seeding `Math.random` was **not enough
to make replays deterministic** — "in rare cases, the replay behaves differently than the original
run", and the author guesses at animation timing. That is a warning worth heeding and a place where
we are better positioned than they were: our simulation is stepped at a fixed `dtMax` with a
substep loop, and the test suite already drives whole challenges under a seeded RNG reproducibly. A
replay here needs the seed _and_ the frame timing, and we already have the machinery for the second
half.

_Cost:_ small. _Conflict with our fidelity contract:_ none — a seed and a colour do not change the
simulation.

**[2xh/elevatorsaga](https://github.com/2xh/elevatorsaga)** — 19 commits ahead, self-versioned 1.8.0
· [play](https://2xh.github.io/elevatorsaga/) ·
[diff](https://github.com/magwo/elevatorsaga/compare/master...2xh:elevatorsaga:master)

The most feature-complete browser fork. Commit history covers destination dispatch mode, challenges
rewritten to suit it, **floor heights that can vary**, a **worker**-based fitness run, "reduce
updates when paused", and elevator speed changes with the spec suite updated to match. Its
documentation page adds `getExactCurrentFloor()`, `getExactFutureFloorIfStopped()` ("the exact floor
the elevator will stop at if it decelerates now"), `isApproachingFloor()`, `isFull()`, `isEmpty()`
and `getMaxSpeed()`, plus ➕/➖ time-speed buttons, custom challenges with your own options, and
right-click-Save to toggle autosave.

_Worth taking:_ `getExactFutureFloorIfStopped()` and `isApproachingFloor()` are the two API gaps
players hit constantly; the custom-challenge builder answers the most-repeated feature request
below. Destination dispatch is a design decision rather than a patch — it is the one real-world
elevator concept the original omits, and players ask for it, but it changes what the challenges
mean.

_Conflict:_ the API additions are additive and safe. Changing elevator speed or floor heights is
not: it would break score comparability with upstream, which we have so far kept.

**[jaredkrinke/elevatorsaga](https://github.com/jaredkrinke/elevatorsaga)** — 2 commits ahead,
offered upstream as the still-open
[PR #137](https://github.com/magwo/elevatorsaga/pull/137) · demo:
<https://jaredkrinke.github.io/elevatorsaga/>

Swaps CodeMirror for Monaco and wires in TypeScript declarations, giving real autocomplete over the
elevator API. This is the **most-requested feature in the whole survey** (see below) and it is
already written, by the author of SIC-1. Upstream never merged it: "I realize this repository isn't
being maintained, but I wanted to open a pull request here for visibility."

_Cost for us:_ we deliberately moved to CodeMirror 6 and split it into its own chunk (~500 kB);
Monaco is several times that and does not tree-shake. The valuable half is not the editor swap but
**the type declarations** — shipping a first-party `.d.ts` for the player API would feed
autocomplete in whatever editor we use, and would end the duplicated typing effort three separate
people have already done independently ([Josef37's
gist](https://gist.github.com/Josef37/e075b6a005a47d146c7e7ab9ed7ae893), filed as
[#133](https://github.com/magwo/elevatorsaga/issues/133); [steinuil's
gist](https://gist.github.com/steinuil/21b49b96eaaac4b792a0c69a7d82a4f9); `bekk/elevator-saga-ts`).
We generate our facades from TypeScript already, so we are the one fork that can emit those
declarations instead of hand-writing them.

### Worth reading before we build the same thing

**[minimusubi/elevatorsaga](https://github.com/minimusubi/elevatorsaga)** — **64 commits ahead**,
last pushed April 2025, default branch `main`

A parallel modernization, and the closest thing to a competitor to this repository: full TypeScript
conversion, Monaco, lodash replaced with radashi, ESLint 9 + Prettier, CSS variables, Google
Analytics removed, `Floor` → `FloorInterface` in user code, private emitter listeners, error
catching in event handlers, HTML escaping in the error display. Same problems, solved independently
— worth reading precisely because they made **different** calls: they took the breaking change we
refused, changing the first argument of event handlers from a string to an `EmitterEvent` object and
deprecating some events and methods, and they build with plain `tsc` plus a copy script rather than
a bundler.

_Verdict:_ nothing to lift wholesale, plenty to compare against. If we ever want a second opinion on
a design decision in `src/game/observable.ts`, this is where to look.

**[chrismooredev/elevatorsaga](https://github.com/chrismooredev/elevatorsaga)** — 35 commits ahead

Another TypeScript conversion, from 2020-ish, that went further in one direction we did not:
**player code as an ES module** (an explicit breaking change in their history) and "make users'
error call stack look better" — the second is directly relevant to a complaint people repeat about
this game. Also Monaco, and stronger typing of the observable and its subclasses.

**[cornacchia/elevatorsaga-blockly](https://github.com/cornacchia/elevatorsaga-blockly)** — 12
commits ahead, ~300 files changed

The game rebuilt around [Blockly](https://developers.google.com/blockly): drag-and-drop blocks
instead of typing JavaScript, plus a written manual, a **debug exercise**, and explanation text.
Clearly built for teaching. Not something to merge, but the strongest evidence in the survey that
the game gets used in classrooms — and the "debug exercise" idea (hand the player a broken solution
and ask them to fix it) is a genuinely good challenge format that costs us nothing structurally.

**[DiscoElevator/elevatorsaga](https://github.com/DiscoElevator/elevatorsaga)** — 39 commits ahead

Went the multiplayer route: a game server, user accounts with token relogin, per-user code storage
and a **rating**. Also restructured into `src/`, added a Webpack-era `npm run dev`/`build`, and
shipped a **Russian** `documentation_RU.html`. Worth reading for what a leaderboard implies, and as
a caution: it is the heaviest fork here and the least likely to still run.

**[didil/gowasm-elevatorsaga](https://github.com/didil/gowasm-elevatorsaga)** — 16 commits ahead, 15
stars (the most-starred fork) · [play](https://didil.github.io/gowasm-elevatorsaga/)

Solutions written in **Go**, compiled to WASM by a server-side Docker build, cached by hash, then
loaded into the page. The build service is not worth copying; the interesting half is the proof that
the engine can be driven across a language boundary, and the JS↔WASM shim that does it.

**[mostafa-hz/elevatorsaga](https://github.com/mostafa-hz/elevatorsaga)** — 12 commits ahead

Reinforcement-learning agents playing the game in the browser (`agents.js`, model import/export,
reward-function tuning, exploration control). Together with
[ednussi/ElevatorSaga](https://github.com/ednussi/ElevatorSaga) (a Python re-simulation used for
Q-learning, DQN and multi-agent experiments) it is the second independent request for the same
thing: **a deterministic headless runner** you can point a bot at and score over many seeds. We are
one small entry point away from having that — the fitness suite already runs challenges headless.

**[WebCabin/elevatorsaga](https://github.com/WebCabin/elevatorsaga)** — 6 commits ahead

Replaced the code editor entirely with [wcPlay](https://github.com/WebCabin/wcPlay), a visual
node-graph editor. Same instinct as the Blockly fork, different decade.

### Localization, and what it tells us

Three independent translation efforts, none aware of each other, all forced to fork the whole game
because there is no i18n seam:

- **[shoheihagiwara/elevatorsaga](https://github.com/shoheihagiwara/elevatorsaga)** — 14 commits, a
  Japanese `documentation_ja.html`, itself merged from two other people's branches
  (`recuraki/document_ja`, plus PRs from `yukicode` and `codyfet`). Published at
  <https://shoheihagiwara.github.io/elevatorsaga/documentation_ja.html>.
- **[Double-oxygeN/elevatorsaga](https://double-oxygen.net/elevator-saga/)** — a fully Japanese UI
  and docs based on 1.6.5. _(Read: the hosted page.)_
- **[gamesedu/elevatorsaga-gr](https://github.com/gamesedu/elevatorsaga-gr)** — 13 commits, Greek,
  and something more interesting alongside it: **read-only lines in the starter code**, iterated over
  four commits until only the first line was locked. That is a teaching affordance — hand out a
  skeleton the student cannot break.

The lesson is not any one translation; it is that **an i18n hook would collect community
translations**, and that the fork tax for wanting one today is the entire repository.

### Noted for completeness

- **[raux/elevatorsaga](https://github.com/raux/elevatorsaga)** — 4 commits: Python and Java ports
  with a NiceGUI-based strategy visualization.
- **[codeskyca/elevatorsaga](https://github.com/codeskyca/elevatorsaga)** — 5 commits, pushed
  February 2026 (the most recently active fork found): "updated challenge", "upgraded checking
  algorithm". Small, unread beyond commit subjects.
- **[VyunSergey/elevatorsaga](https://github.com/VyunSergey/elevatorsaga)** — 5 commits: a
  collection of other people's published solutions plus `alg_stats.txt` comparing them. Useful as a
  ready-made benchmark corpus if we ever want to score algorithms against each other.
- **[AbdellaToronto/elevatorsaga](https://github.com/AbdellaToronto/elevatorsaga)** — 3 commits,
  RxJS added to `index.html`, first challenge only.
- **[ejrv/Codelemate](https://github.com/ejrv/Codelemate)** — 4 commits, `index.html` only; a
  rebrand.
- **[David-McEwen/elevatorsaga](https://github.com/David-McEwen/elevatorsaga)** — 1 commit, styling
  for embedding the game in another page.

## Derivatives outside the fork network

From the web search. Read means the page was opened.

- **[zgca-forge/Elevator](https://zgca-forge.github.io/Elevator/index.html)** (`pip install
elevator-py`) — a real Python re-engine with a client/server HTTP API, and two things the browser
  game lacks: **energy-consumption tracking with per-elevator rates**, and physics-based
  acceleration. An energy or moves-style secondary metric gives a challenge a second axis to
  optimise without new mechanics. _(Read: docs index.)_
- **[Cargo Dispatch](https://matthuggins.com/lab/cargo-dispatch)** (Show HN, March 2026,
  [thread](https://news.ycombinator.com/item?id=47302772)) — the closest living analogue: write
  TypeScript to control warehouse robots, five levels, a 0.5×/1×/2×/4× speed selector, a split
  Edit/Run mode and a live per-robot status panel. No replay, no seeds, no sharing, no level editor,
  and it does not credit Elevator Saga. The Edit/Run split and the live status panel are cheap wins.
  _(Read: the game page.)_
- **[Coding Lift](https://habr.com/ru/articles/843708/)** — a Russian indie taking the same premise
  with a fictional compiler; plans to show **how happy the passengers are** rather than raw seconds.
  The top comment on the article is "don't build your own, use Elevator Saga". _(Read: comments.)_
- **[avanderw.co.za/elevator-saga](https://avanderw.co.za/elevator-saga/)** — a verbatim mirror of
  1.6.5. Nothing to take. _(Read.)_

## Complaints and bugs people hit in the wild

With where we stand on each. Ours are stated from this repository; theirs are linked.

| What people report                                                                                                                                                                                                         | Us                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Passengers won't board an elevator that stops for them en route** — [#124](https://github.com/magwo/elevatorsaga/issues/124), and [larschdk on HN](https://news.ycombinator.com/item?id=27487111)                        | Fixed, with tests. See the `#59/#74/#98/#124` entry in the README.                                                                                                                                                                                                                                                   |
| **magwo himself: "the additional-people-not-getting-on is kind of an architectural problem with the game"** — [HN, 2015](https://news.ycombinator.com/item?id=8929314)                                                     | This is the root of that family. Our re-offer on indicator change plus the boarding dwell covers the reported cases.                                                                                                                                                                                                 |
| **Two free moves per elevator at the start** — [avereveard on HN](https://news.ycombinator.com/item?id=8929314), upstream [#117](https://github.com/magwo/elevatorsaga/issues/117)                                         | Fixed; `moveCount` starts at 0, pinned by tests.                                                                                                                                                                                                                                                                     |
| **Passengers don't re-press the call button** — [#110](https://github.com/magwo/elevatorsaga/issues/110)                                                                                                                   | Fixed, with tests.                                                                                                                                                                                                                                                                                                   |
| **Syntax errors are swallowed by the logging catch** — [juloo](https://news.ycombinator.com/item?id=27487111), [Lobsters](https://lobste.rs/s/w1dac5/), [mschaef](https://news.ycombinator.com/item?id=37306262)           | We surface compile and runtime failures in an error banner and have e2e tests for both. Whether the _message_ is good enough is worth a look.                                                                                                                                                                        |
| **`world.transportedCounter = 999999` in `init` wins any challenge** — [benwaffle 2015](https://news.ycombinator.com/item?id=8933287), [a2h 2022](https://news.ycombinator.com/item?id=33273543)                           | **Still true here**: `src/app/app.ts:216` puts the world on `window` (as `legacy-1.x:app.js:169` did) and player code runs in global scope. Deliberate — it is the debugging hook people use from the console, and this is a single-player game — but it is the thing to close first if a leaderboard is ever added. |
| **`checkDestinationQueue()` after mutating the queue is "awfully redundant"** — Ideka, and [swyx: "the docs need a lot of work"](https://news.ycombinator.com/item?id=33249988)                                            | Documented, not changed. Making it implicit is a real option.                                                                                                                                                                                                                                                        |
| **Only the last elevator responds to my handlers** — [#111](https://github.com/magwo/elevatorsaga/issues/111), duplicated by [#138](https://github.com/magwo/elevatorsaga/issues/138)                                      | Reported twice by different people, which usually means either a real bug or a documentation failure. Unverified against our engine — worth a test.                                                                                                                                                                  |
| **Level 6 is winnable by starving everyone above the ground floor** — [pavel_lishin](https://news.ycombinator.com/item?id=8929314)                                                                                         | Unverified. Challenge 6 has no max-wait bound, so probably still true.                                                                                                                                                                                                                                               |
| **The difficulty cliff forces a rewrite, and you're not told which passenger blew the limit** — [SamBam](https://news.ycombinator.com/item?id=27487111), upstream [#135](https://github.com/magwo/elevatorsaga/issues/135) | Open. avodonosov's red highlight is the cheapest answer.                                                                                                                                                                                                                                                             |

All links in this table were read via the HN Algolia API or the issue pages themselves, except
[#111](https://github.com/magwo/elevatorsaga/issues/111)/[#138](https://github.com/magwo/elevatorsaga/issues/138),
known only from titles and state.

## What people keep asking for

Ranked by how many independent times it came up.

1. **Autocomplete and types in the editor** — [#133](https://github.com/magwo/elevatorsaga/issues/133),
   [PR #137](https://github.com/magwo/elevatorsaga/pull/137), three independent `.d.ts` efforts,
   plus requests on [Lobsters](https://lobste.rs/s/w1dac5/) and
   [HN](https://news.ycombinator.com/item?id=37306262). The clearest single win.
2. **Real error reporting** — line numbers, highlighting, unswallowed stack traces.
3. **More levels, and custom ones** — upstream
   [#114](https://github.com/magwo/elevatorsaga/issues/114); magwo in 2015: "especially I would
   appreciate help with adding more challenges… for a good difficulty curve". Built already by 2xh.
4. **Realistic traffic profiles instead of uniform random spawns** — joelthelion on HN, where
   **magwo confirmed there is unused code for spawn distribution patterns**. Morning up-peak and
   evening down-peak would also be what makes destination dispatch interesting.
5. **Restart on demand, and time-speed control** — shipped by 2xh and by Cargo Dispatch.
6. **A hall of fame of ranked algorithms** — [zxcvbn4038](https://news.ycombinator.com/item?id=33249988).
   Note the tension with the `transportedCounter` row above.
7. **Destination dispatch / a floor selector outside the car** —
   [paxys](https://news.ycombinator.com/item?id=33249988).
8. **Better diagnostics about why you failed** — upstream
   [#135](https://github.com/magwo/elevatorsaga/issues/135); CobrastanJorji wanted each elevator's
   planned stops and ETAs visualised.
9. **`idle` should also fire when a button is pressed** —
   [pepijndevos](https://news.ycombinator.com/item?id=8929314).
10. **A "this car is full" affordance** — [curmudgeon22](https://news.ycombinator.com/item?id=33249988);
    2xh's `isFull()` is half of it.
11. **Solutions in any language, scored on CPU and memory too** — wezm on Lobsters; the Go/WASM fork
    is the only partial answer.
12. **A responsive layout** — asked for in 2015 by someone teaching from a projector. Done here.

## Ideas from adjacent games

- **Zachtronics-style score histograms instead of a global leaderboard.** A per-challenge
  distribution of average wait or move count with your own marker on it gives competition without
  creating a cheat target — which matters given the row above. Friend-only boards were their
  escape hatch for trusted competition.
- **Opus Magnum's looping GIF export.** The shareable artifact for a solution is an animation of it
  running, not a URL.
- **[SIC-1](https://jaredkrinke.itch.io/sic-1/devlog)** — breakpoints, save slots, per-puzzle stats,
  an in-game reference manual, and one forum thread per puzzle. Same author as the Monaco PR.
- **Screeps room replay** — a tick scrubber with deep-linkable ticks, and the thing their players
  then asked for: an **event-coloured scrollbar**, so you can find the interesting tick instead of
  scrubbing blindly. For us that is a mark where a passenger crossed the wait threshold.
- **CodinGame replays** — a replay file that carries everything the bot wrote plus the referee's
  per-turn input, and a standing request for "replay in the same conditions". Seeded runs turn "it
  failed once out of five" into something debuggable.

## Dead ends — do not chase these again

- **"The Elevator Saga" on thecasecentre.org** is a business-school case study about paying for an
  elevator in a Budapest apartment block. Name collision only.
- **[onlyred/elevator_saga](https://github.com/onlyred/elevator_saga)** — a three-file Python toy,
  abandoned.
- **Chinese sources**: only mirrors, CSDN/OSCHINA reposts and solution walkthroughs. No extended
  version or translation found, despite searching 汉化 / 增加关卡 / 重写. One CSDN post refused the
  connection.
- **Reddit** is unfetchable from this environment; treat r/programming and r/javascript as
  **uncovered**, not empty. The [MetaFilter thread](https://www.metafilter.com/146807/) returns 403.
- **No Rust port** was found.
- **`MR-Stan`, `Zarel`, `jeffersonhwang`, `robertleeplummerjr`, `runofthemillgeek`, `nivoset`,
  `koalazak`, `rasata`, `lowenhere`, `dominikgoss`, `Endika`** — compared, and behind or level with
  upstream with no commits of their own. Their large repository size is vendored `libs/`, not new
  work.
