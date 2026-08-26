# Writing solutions outside the game

Two ways to work on a solution away from the page: a TypeScript declaration file that gives your
own editor the whole player API, and a benchmark that scores a program from the terminal.

## In your own editor

The editor on the page is fine for small changes, but a solution you are actually working on tends
to live in a real file somewhere. `public/elevatorsaga.d.ts` is a TypeScript declaration file that
describes everything player code can reach — every method, property and event on the elevator and
floor objects, each with a description of its own. Those descriptions are written for this file
rather than lifted from elsewhere: where the reference page, the in-page completion popup and the
declaration all describe one member, no two of them describe it in the same words. Point your editor
at it and you get completion, hover documentation and type checking for
a plain `.js` file: no build step, no TypeScript in your program, nothing to compile before pasting
it back into the game.

It catches the mistakes that are otherwise a silent failed run: a misspelled event name, `goToFloor`
called with a string, a `passing_floor` handler that expects the wrong arguments, a method the
original game had and this fork does not.

### Getting the file

From a clone it is `public/elevatorsaga.d.ts` — copy it next to your solution. Vite copies `public/`
into `dist/` verbatim, so a site you are running serves the same bytes from its root:

```sh
curl -O http://localhost:7377/elevatorsaga.d.ts   # npm run dev
curl -O http://localhost:7477/elevatorsaga.d.ts   # ...or npm run preview, after npm run build
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
underneath one is evaluated as a block and dies on **Start** with `SyntaxError: Function statements
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
Small scenario               0.580        8.266          3.051           116.000                0.280
Medium scenario              1.411       13.004          5.277           282.167                0.556
Large scenario               1.479       44.852         22.495           295.833                0.582
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
