# Elevator Saga

[![CI](https://github.com/EpicDima/elevatorsaga/actions/workflows/ci.yml/badge.svg)](https://github.com/EpicDima/elevatorsaga/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE.txt)

A programming game: you get a building, a few elevators and a stream of impatient people, and the
only control you have is a small JavaScript program.

### [▶ Play it](https://elevatorsaga.epicdima.com/)

![Level 5 in progress: four elevators carrying people between six floors, passengers waiting on
the landings and riding in the cars, one of the riders marked yellow as the one behind the panel's
Max delivery time, the statistics counting them along the bottom of the building, and the JavaScript
program driving it all in the editor to the right](public/images/screenshot.png)

## How it works

Your program declares an `init` function that runs once and, if it wants one, an `update` function
that runs repeatedly. Every level sets a target — transport 15 people in 60 seconds, or 100 people
using no more than 63 elevator moves, or 50 people with none of them taking longer than 21 seconds
to deliver — and you keep rewriting until it clears them. Chapter one is the original's levels;
chapter two is about how real lift systems are run. The sandbox sets no target at all: it is a
building of your own size you can leave running.

Type in the editor beside the building and press **Start**. There is nothing to apply first: your
code is saved to `localStorage` as you type, and every run reads whatever is in the editor at the
moment it begins. The full API — every method, property and event, with examples — ships with the
game, in [English](https://elevatorsaga.epicdima.com/documentation.html) and in
[Russian](https://elevatorsaga.epicdima.com/documentation.ru.html), as is the interface.

New to it? [The learning track](docs/learning-track.md) is eight small buildings that teach the same
API one mistake at a time, before level 1 asks for it.

## About this fork

A modernized fork of [Magnus Wolffelt's original](https://github.com/magwo/elevatorsaga), still
playable at [play.elevatorsaga.com](https://play.elevatorsaga.com/). The original's levels, its
physics and its scoring are unchanged; the code underneath is not. jQuery, lodash, riot and CodeMirror 5 are gone,
the simulation is TypeScript with unit tests, and a pile of long-standing upstream bugs are fixed.

What it adds, all of it additive — no level got easier or harder:

- **A learning track** and **a jump list for the levels**, with nothing locked behind anything.
- **A second chapter** on how real lift systems are run: morning and evening peaks, cars that serve
  only part of the building, and passengers who name the floor they want instead of pressing a call
  button.
- **Repeatable runs.** `#seed=…` brings the same passengers back to every restart.
- **A sandbox building** you size yourself: floors, elevators, capacities, spawn rate.
- **More API.** `isFull()`, `isEmpty()`, `isApproachingFloor(n)`, `servedFloors()` and
  `takeRequest(from, to)` on the elevator; `hall_button_pressed`, `destination_requested` and
  `pendingDestinations()` on the floor.
- **A better editor.** Resizable, with autocompletion for the player API.
- **Types for your own editor.** A declaration file describing the whole player API ships with the
  site.
- **A headless benchmark.** `npm run bench -- solution.js` scores a program without a browser.
- **More statistics**, including the wait and the ride as separate figures.

Bringing a solution over from the original? Read
[breaking changes for player code](docs/differences.md#breaking-changes-for-player-code) first.

## Quick start

Node 22 or newer.

```sh
npm ci
npm run dev       # http://localhost:7377/
```

To produce the static site and check it locally:

```sh
npm run build     # emits dist/index.html and the two documentation pages
npm run preview   # serves dist/ at http://localhost:7477/
```

The build sets a relative base path, so `dist/` can be dropped on any static host, including a
GitHub Pages project sub-path, without further configuration.

## Documentation

| Document                                                        | What is in it                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [The learning track](docs/learning-track.md)                    | The eight lessons, what each one teaches, and how the track behaves             |
| [Writing solutions outside the game](docs/writing-solutions.md) | The TypeScript declaration file, and the benchmark as a terminal command        |
| [URL parameters](docs/url-parameters.md)                        | `#level`, `#seed`, `#timescale`, `#fullscreen`, and the sandbox                 |
| [Differences from the original](docs/differences.md)            | What this fork adds, what it breaks, what it fixed, and what upstream asked for |
| [Development](docs/development.md)                              | Scripts, project structure, tests, and deployment                               |

## Contributing

Before opening a pull request, run what CI runs:

```sh
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build && npm run test:e2e
```

See [Development](docs/development.md) for the layout of `src/`, how the tests are organized, and
how the site is deployed.

## Credits and license

Elevator Saga was created by [Magnus Wolffelt](https://github.com/magwo) and its
[contributors](https://github.com/magwo/elevatorsaga/graphs/contributors). This repository is a
TypeScript modernization of that work.

Released under the MIT License — copyright © 2015 Magnus Wolffelt for the original game, © 2026
EpicDima for this rewrite. See [LICENSE.txt](LICENSE.txt).

The code editor is [CodeMirror 6](https://codemirror.net/) with its
[Lezer](https://lezer.codemirror.net/) parser, both MIT. The interface icons are glyph outlines from
[Font Awesome](https://fontawesome.com/) 4.1.0, used under the
[SIL OFL 1.1](https://scripts.sil.org/OFL); the notice is in
[src/shared/ui/fontawesome-license.txt](src/shared/ui/fontawesome-license.txt). No webfont is
shipped — the interface uses the reader's own system UI face. `npm run build` collects the license
of every runtime dependency into `dist/licenses.txt`, which the footer of both pages links to.
