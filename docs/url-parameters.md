# URL parameters

Everything after the `#` is a comma-separated list of `key=value` pairs, for example
`#level=7,timescale=8,fullscreen`. Anything unrecognized is left alone and carried into the
"next level" link. Anything malformed falls back to a sane default with a console warning
rather than breaking the page.

| Parameter           | Effect                                                                                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#level=N`          | Starts level `N`, counting from 1. Out of range, missing, or unreadable as a number and not one of the names below: level 1. Every level is open from the first visit, so no address is ever answered with a different one. |
| `#level=sandbox`    | Starts a building of your own instead of a numbered level. See below.                                                                                                                                                       |
| `#level=tutorial-N` | Starts level `N` of the learning track, from `tutorial-1` to `tutorial-8`. A `tutorial-` address the track has no level for starts the first one. See [the learning track](learning-track.md).                              |
| `#level=sky-N`      | Starts level `N` of the Skyscraper block, from `sky-1` to `sky-13`. A `sky-` address the block has no level for starts the first one.                                                                                       |
| `#timescale=X`      | Simulation speed multiplier. Clamped to `0.1`–`64`. Fractions such as `1.5` work. Without it, the speed you last chose is used again — it is kept in `localStorage` under `elevatorTimeScale` — and `2` when there is none. |
| `#seed=S`           | Pins the seed the passenger stream is drawn from. Not the building. Refused on the two blocks that pin their own seed, the learning track and Skyscraper. See below.                                                        |
| `#fullscreen`       | Hides everything except the building.                                                                                                                                                                                       |

`#level` was spelled `#challenge` until the game started calling its challenges levels, and every
link shared before then says so. Those addresses still work — the old spelling is read wherever the
new one would be — and the address bar is rewritten to the new one on arrival, so a link followed
once goes on being shared under the name the game uses now.

`fullscreen` is a flag: on when present and off when explicitly set to `false`
(`#fullscreen=false`). Bare flags now work: in the original, `#fullscreen` without a value was
silently ignored because the parser's regexp demanded one. It is the only flag — the original's
`autostart` and `devtest` are gone, so a link carrying either is read as an unrecognized parameter
and left alone.

## Seeds

Every run draws its passengers from a seeded generator, and shows its seed in the settings menu as
well as printing it to the console. Put that seed back in the URL and the same people
arriving in the same order come back — from the Restart button, from <kbd>Ctrl</kbd>+<kbd>Enter</kbd>
and from a reload alike.

You do not have to type it. When the URL pins no seed, the seed in the menu is a link that pins the
one currently running, so a run worth keeping is one click away after you have seen it. When the URL
does pin one, the menu shows the value with a **new draw** link beside it, which drops the seed and
starts again on fresh passengers. Both links name the level as well as the seed, so either one
is a complete address you can paste at someone.

A URL with no `seed` draws a fresh one on every restart, which is deliberate: a run you cannot get
away from is not what you want when you are stuck on a level.

None of this applies on the learning track or in the Skyscraper block, where the seed belongs to the
level rather than to you: there is no seed line in the menu, nothing is printed, and every restart
replays the same passengers. The track pins one so a lesson shows what it means to show; the block
pins one so that a medal means the same thing to two players. See
[the learning track](learning-track.md).

**What a seed fixes is the passenger stream, and only that.** The building — how many floors, how
many elevators, how large they are — comes from the level number or from the sandbox parameters,
and the seed has no say in it. Two URLs with the same seed and different `level` values are two
different buildings. Everything else about a run does come back: your program and the physics are
both advanced in fixed ticks rather than in whatever a frame happened to be worth, so car positions,
arrival times and button-press counts repeat step for step whatever the display is doing.
`src/game/determinism.test.ts` is where that is held, by running one seed twice at frame schedules
that disagree.

A seed is a string of at most 64 characters from `A-Z a-z 0-9 _ . -`, so `#seed=issue-61` is as
valid as `#seed=1234567890`. It is never read as a number: `0123` and `123` are different seeds,
because a URL that quietly replays something other than what it says is worse than one that does
not work. The character set is narrow because the seed has to come back out of the address bar byte
for byte: a space or a non-Latin letter is percent-encoded on the way in, so `#seed=rush hour` would
return as `rush%20hour`, hash to something else and hand a different passenger stream to whoever
followed the link. A comma cannot reach the parser at all — that is what separates one parameter
from the next. Anything outside the set is refused with a console warning and a fresh seed.

## Sandbox

`#level=sandbox` replaces the numbered level with a building you specify. It has no success
condition — nothing to win, and nothing to fail — so it is for reproducing a case and watching what
your program does with it.

| Parameter          | Effect                                                            | Range   | Default |
| ------------------ | ----------------------------------------------------------------- | ------- | ------- |
| `floors=N`         | Floors in the building                                            | 2–60    | 8       |
| `elevators=N`      | Elevators serving them                                            | 1–12    | 2       |
| `capacities=A-B-C` | Passengers each car holds, cycled over the cars; hyphen-separated | 1–30    | 4       |
| `spawnrate=X`      | Passengers appearing per simulated second                         | 0.01–10 | 0.6     |

The defaults are level 4's building, so a bare `#level=sandbox` starts something known to be
playable. Every bound is either a value the simulation cannot survive or one the page cannot
draw — a one-floor building sends passengers to a floor that does not exist, and cars are drawn ten
pixels per unit of capacity, so how many elevators fit depends on how wide the capacities make
them. Values outside a range are clamped and warned about; values that are not numbers fall back.
`capacities` uses hyphens rather than commas because a comma already separates hash parameters.
