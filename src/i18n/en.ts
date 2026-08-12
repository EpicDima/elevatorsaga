/**
 * The English catalogue: the reference locale.
 *
 * Every string here was lifted from the interface as it stands — `index.html`,
 * `documentation.html`, the templates, the presenters, the challenge conditions
 * and the error messages the player's own code can produce — with the wording
 * untouched. Where the page shell had wrapped a sentence across several source
 * lines, the wrapping is gone and nothing else is: HTML collapses that
 * whitespace, so the rendered text is identical.
 *
 * This catalogue defines the key set. `MessageKey` is `keyof typeof
 * EN_MESSAGES`, so a translation that forgets a key does not compile, a
 * translation that invents one does not compile either, and asking for a key
 * that was never written down does not compile anywhere.
 *
 * Three key suffixes carry meaning, and `catalogue.test.ts` enforces all three:
 *
 * - `.html` — the value is trusted markup, to be assigned as HTML. Everything
 *   in it comes from this repository; nothing player-authored is ever
 *   interpolated into one.
 * - `.code` — the value is a block of player-facing example code. Only the
 *   comments in it are translated; the code itself is byte-identical in every
 *   locale, which is checked rather than promised.
 * - anything else — plain text, for `textContent`, an attribute or `confirm()`.
 *   Markup in one of these is a bug.
 *
 * A value written as an object rather than a string has plural forms, chosen by
 * `Intl.PluralRules`. The English entries only need `one` and `other`, which is
 * exactly why the choice cannot be `count === 1 ? a : b`: Russian needs four.
 */

import type { PluralForms } from "./format.ts";

/**
 * Every message the game can show, in English.
 *
 * `as const` is what makes the keys and the `{placeholder}` names visible to
 * the type system, so both are checked at every call site.
 */
export const EN_MESSAGES = {
  // ---------------------------------------------------------------- the game
  // index.html, and the parts of it the presenters fill in.

  "page.title": "Elevator Saga - the elevator programming game",
  "page.description":
    "Elevator Saga is a programming game: write JavaScript to transport people efficiently.",
  "page.imageAlt":
    "Four elevators carrying people between six floors, with the JavaScript program driving them in the editor below.",
  "page.skipLink": "Skip to the code editor",
  "page.brand": "Elevator Saga",
  "page.tagline": "The elevator programming game",
  // The header's way into the learning track, and deliberately not one of the
  // `page.nav.*` keys below it: those three are the links inside a landmark
  // named "Help and reference", and this one goes to the game rather than to
  // something to read about it.
  "page.tutorialLink": "Learning track",
  "page.nav.label": "Help and reference",
  "page.nav.help": "Help",
  "page.nav.documentation": "Documentation",
  "page.nav.wiki": "Wiki & Solutions",
  // The picker's options are not here: a language is named in its own language,
  // so that the reader who needs Русский can find it while the interface is
  // still English. Those endonyms live in `LOCALE_NAMES`, in `./locale.ts`.
  "page.language.label": "Language",
  "page.noscript":
    "Your browser does not appear to support JavaScript. This page contains a browser-based programming game implemented in JavaScript.",
  "page.world.label": "Building",
  "page.stats.label": "Simulation statistics",
  "page.stats.transported": "Transported",
  "page.stats.elapsedTime": "Elapsed time",
  "page.stats.transportedPerSec": "Transported/s",
  // Neither of these is a waiting time, whatever the two keys are called. Both
  // are measured from the moment a passenger appears to the moment they step
  // out of a car at their floor -- `World.registerUser` records the span on
  // `exited_elevator`, the same instant the row above counts them -- so the
  // ride is inside them and a passenger who never waited at all still adds to
  // both. What a delivery takes, in the sense a delivery time is normally read:
  // from the order to the goods in hand.
  //
  // The keys keep their names because they name the `World` fields they render,
  // `avgWaitTime` and `maxWaitTime`, and those cannot be renamed: the challenge
  // conditions in src/game/challenges.ts are written against them, and every
  // upstream score ever posted was measured by them. The row between them is
  // the wait neither of them is.
  "page.stats.avgWaitTime": "Avg delivery time",
  // Sits between the two averages rather than beside its own maximum, which the
  // panel does not show: the pair a player reads together is this one, and what
  // separates them is the ride. "Wait for a car" rather than "wait", because
  // the rows above claim the word and this is the row that has a right to it.
  "page.stats.avgPickupTime": "Avg wait for a car",
  "page.stats.avgPickupTimeTitle":
    "The clock starts when a passenger appears and stops when a car takes them, so the difference from the average delivery time is the ride",
  "page.stats.maxWaitTime": "Max delivery time",
  "page.stats.moves": "Moves",
  "page.stats.movesTitle":
    "One move is counted each time a car crosses the halfway mark between one floor and the next",
  // Last, and under the row it is measured against: `avgLoadFactorOnMove` is
  // sampled once per move, so it is a mean over the count above rather than
  // over time, and a parked car is absent from it rather than counted as empty.
  // "Avg load" and not "Avg load factor", because the column has no room for
  // the second word and nothing in the panel needs it; the tooltip and the help
  // page are where a figure this easy to read backwards gets explained.
  "page.stats.avgLoad": "Avg load",
  "page.stats.avgLoadTitle":
    "How full the cars were, averaged over the moves counted above, so a car standing still is not in the figure at all",
  // The last sentence is the grip's documentation. It is here, in a paragraph
  // everybody can read, rather than in a `title` on the grip itself, because a
  // tooltip never opens for a keyboard or a touchscreen -- and the two gestures
  // it would have named are precisely the ones a player without a mouse needs.
  "page.hint.html":
    "In the editor: <kbd data-mod-key>Ctrl</kbd>+<kbd>Enter</kbd> applies your program. <kbd data-mod-key>Ctrl</kbd>+<kbd>S</kbd> saves it. <kbd>Tab</kbd> indents. <kbd>Esc</kbd> moves the focus back out. Drag the grip above this line to resize the editor, or focus it and press <kbd>↑</kbd> or <kbd>↓</kbd>; double-click it to restore the height.",
  // The grip under the editor. Its name is what it controls rather than what it
  // does -- a `separator` is announced with its role and its value, so "Editor
  // height, 320" reads as a whole where "Resize the editor, 320" would not.
  "page.editorResize.label": "Editor height",
  "page.button.reset": "Reset",
  "page.button.undoReset": "Undo reset",
  "page.button.save": "Save",
  "page.button.apply": "Apply",
  "page.helpNote.html":
    'Confused? Open the <a href="documentation.html">Help and API documentation</a> page',
  "page.footer.credits": "Made by Magnus Wolffelt and contributors",
  "page.footer.version": "Version",
  "page.footer.source.html":
    '<a href="https://github.com/EpicDima/elevatorsaga">Source code</a> on GitHub, forked from <a href="https://github.com/magwo/elevatorsaga">the original</a>',
  "page.footer.licences.html":
    '<a href="licenses.txt">Licences</a> for the game and everything it bundles',

  // ------------------------------------------------------- the building view
  // src/ui/templates.ts and src/ui/presenters.ts.

  "game.floor.callUp": "Call an elevator going up from floor {floor}",
  "game.floor.callDown": "Call an elevator going down from floor {floor}",
  "game.elevator.label": "Elevator {number}",
  "game.elevator.floorButton": "Go to floor {floor}",
  "game.challenge.title.html": "Challenge #{number}: {description}",
  // The navigation row shows bare numbers, because twenty entries have to fit
  // across a phone; the name each one carries is what a screen reader announces
  // in their place, so it has to say what the number means on its own.
  "game.challenge.nav.label": "Challenges",
  "game.challenge.nav.link": "Challenge {number}",
  "game.challenge.nav.demo": "Demo",
  // The seed line, which is two lines really: a control that says what the run
  // is, and a disclosure that says how far the promise goes. The seed itself is
  // a placeholder rather than part of the sentence — it is the token a player
  // transcribes, and it must read the same in every language.
  //
  // Both accessible names repeat the seed, because a name has to stand on its
  // own (WCAG 2.5.3) and "1234567890, link" describes nothing. `newDraw` is the
  // one string that is both the visible label and part of its own name, so a
  // translation has to keep the two saying the same words.
  "game.seed.label": "Seed",
  "game.seed.link": "Seed {seed}: start another run from this seed",
  "game.seed.newDraw": "new draw",
  "game.seed.newDrawLink": "Seed {seed}: new draw, start again without it",
  "game.seed.helpSummary": "what a seed does",
  "game.seed.explanation":
    "The same seed brings the same passengers, in the same order. Frame timing comes from the browser, so the run around them is never quite the same twice.",
  // The same sentence the disclosure makes, compressed onto the console line
  // printed at every start. It is keyed and the other console strings are not,
  // because it is not a diagnostic: the rest report a bug, a malformed URL or a
  // broken invariant, and this one is addressed to a player who has done
  // nothing wrong and is being told how to play the run again. The seed and the
  // URL are placeholders for the same reason they are everywhere else -- they
  // are transcribed, not read.
  "game.seed.console":
    "Seed {seed} — the same passengers again, though never quite the same run: {url}",
  "game.timeScale.decrease": "Decrease simulation speed",
  "game.timeScale.increase": "Increase simulation speed",
  "game.timeScale.value": "{value}x",
  "game.button.start": "Start",
  "game.button.pause": "Pause",
  "game.button.restart": "Restart",
  "game.feedback.success.title": "Success!",
  "game.feedback.success.message": "Challenge completed",
  "game.feedback.failure.title": "Challenge failed",
  "game.feedback.failure.message": "Maybe your program needs an improvement?",
  "game.feedback.next": "Next challenge",
  "game.codeStatus": "There is a problem with your code:",

  // ------------------------------------------------------------- the editor
  // src/ui/editor.ts, src/main.ts and src/ui/default-code.ts.

  "editor.label": "Elevator program",
  "editor.saved": "Code saved {time}",
  "editor.confirmReset": "Do you really want to reset to the default implementation?",
  "editor.confirmUndoReset": "Do you want to bring back the code as before the last reset?",
  "editor.defaultCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0]; // Let's use the first elevator

        // Whenever the elevator is idle (has no more queued destinations) ...
        elevator.on("idle", function() {
            // let's go to all the floors (or did we forget one?)
            elevator.goToFloor(0);
            elevator.goToFloor(1);
        });
    },
    update: function(dt, elevators, floors) {
        // We normally don't need to do anything here
    }
}`,

  // --------------------------------------------------------------- challenges
  // src/game/challenges.ts. The counted phrases are separate messages so that
  // each can carry the plural forms its own language needs; the sentences then
  // compose them. The markup is the same `emphasis-color` span the challenge
  // bar has always highlighted the numbers with.

  "challenge.transportWithinTime.html": "Transport {people} in {time} or less",
  // "to be delivered" rather than "wait", because the limit these three
  // sentences announce is `World.maxWaitTime`, which stops at the passenger's
  // floor and not at the door of the car. A player who reads it as a wait
  // optimises for boarding people quickly and then loses the run to the ride.
  "challenge.transportWithMaxWait.html":
    "Transport {people} and let no one take more than {waitTime} to be delivered",
  "challenge.transportWithinTimeWithMaxWait.html":
    "Transport {people} in {time} or less and let no one take more than {waitTime} to be delivered",
  "challenge.transportWithinMoves.html": "Transport {people} using {moves} or less",
  "challenge.transportWithinMovesWithMaxWait.html":
    "Transport {people} using {moves} or less and let no one take more than {waitTime} to be delivered",
  "challenge.demo": "Perpetual demo",
  "challenge.people.html": {
    one: "<span class='emphasis-color'>{count}</span> person",
    other: "<span class='emphasis-color'>{count}</span> people",
  },
  "challenge.timeLimit.html": {
    one: "<span class='emphasis-color'>{count}</span> second",
    other: "<span class='emphasis-color'>{count}</span> seconds",
  },
  // `one` here can never print, and stays anyway. All three places that build
  // this phrase (src/game/challenges.ts) pass `decimal(maxWaitTime, 1)`, and a number
  // written with a tenth is `other` in English as much as in Russian: the
  // fifteen-second limit reads "more than 15.0 seconds", and a one-second limit
  // would read "1.0 seconds" rather than "1 second". The form is kept because
  // the key is a plural message like the ones around it -- a limit that stopped
  // being written with a decimal would need it back, and it is one word.
  "challenge.waitLimit.html": {
    one: "<span class='emphasis-color'>{count}</span> second",
    other: "<span class='emphasis-color'>{count}</span> seconds",
  },
  "challenge.moveLimit.html": {
    one: "<span class='emphasis-color'>{count}</span> elevator move",
    other: "<span class='emphasis-color'>{count}</span> elevator moves",
  },

  // The sandbox describes the building the URL asked for rather than a goal.
  // Its counts are the player's own, so all four Russian categories are
  // reachable here — `#spawnrate=1`, `=2` and `=5` pick three different forms.
  "challenge.sandbox.html":
    "Sandbox: {floors}, {elevators} of {capacityLabel} {capacities}, {spawnRate}. No goal, so the run never ends",
  "challenge.sandbox.floors.html": {
    one: "<span class='emphasis-color'>{count}</span> floor",
    other: "<span class='emphasis-color'>{count}</span> floors",
  },
  "challenge.sandbox.elevators.html": {
    one: "<span class='emphasis-color'>{count}</span> elevator",
    other: "<span class='emphasis-color'>{count}</span> elevators",
  },
  "challenge.sandbox.capacityLabel": {
    one: "capacity",
    other: "capacities",
  },
  // English does not inflect this one today: a sandbox running at one passenger
  // a second says "1 people per second". The wording is left exactly as it is —
  // both forms are the same string — so that nothing on screen changes; see
  // docs/i18n-inventory.md, which records it as the one thing here worth fixing.
  "challenge.sandbox.spawnRate.html": {
    one: "<span class='emphasis-color'>{count}</span> people per second",
    other: "<span class='emphasis-color'>{count}</span> people per second",
  },

  // ------------------------------------------------ the completion popup
  // src/ui/completions.ts. Only the `info` lines are prose; the `detail` of an
  // entry is a signature and the `label` is an identifier, so both stay
  // English. The popup's whole-program skeleton is the same text as the example
  // under "Basics", so it reuses `docs.basics.example.code` rather than keeping
  // a second copy for a translator to keep in step; only the two halves, which
  // exist nowhere else, have keys of their own.

  "completion.events.on":
    "Register a listener. Several event names separated by spaces register the same listener for all of them, and it is then called with the name of the event that fired as its first argument.",
  "completion.events.once":
    "Register a listener that runs at most once and is then removed. Takes a single event name.",
  "completion.events.one":
    "The older name for once, and the one the original game gave you. Same behaviour, single event name as well.",
  "completion.events.off":
    'Remove listeners. With a function, removes just that function; without one, removes every listener of the named events. The single name "*" removes every listener of every event.',
  "completion.events.offAll":
    "Remove every listener you registered, for every event, on that elevator or floor. The listeners the game itself needs are separate, so the object keeps working.",
  "completion.elevator.goToFloor":
    "Queue the elevator to go to specified floor number. If you specify true as second argument, the elevator will go to that floor directly, and then go to any other queued floors.",
  "completion.elevator.stop":
    "Clear the destination queue and stop the elevator if it is moving. Note that the elevator will probably not stop at a floor, so passengers will not get out.",
  "completion.elevator.currentFloor":
    "Gets the floor number that the elevator currently is on. Note that this is a rounded number and does not necessarily mean the elevator is in a stopped state.",
  "completion.elevator.goingUpIndicator":
    "Gets or sets the going up indicator, which will affect passenger behaviour when stopping at floors.",
  "completion.elevator.goingDownIndicator":
    "Gets or sets the going down indicator, which will affect passenger behaviour when stopping at floors.",
  "completion.elevator.maxPassengerCount":
    "Gets the maximum number of passengers that can occupy the elevator at the same time.",
  "completion.elevator.loadFactor":
    "Gets the load factor of the elevator. 0 means empty, 1 means full. Varies with passenger weights, which vary - not an exact measure.",
  "completion.elevator.isFull":
    "Gets whether every spot in the elevator is taken. Use this rather than comparing loadFactor to 1 - passenger weights vary, so a completely full elevator only reads about 0.775 on average.",
  "completion.elevator.isEmpty":
    "Gets whether the elevator is carrying nobody at all. Not the opposite of isFull - an elevator with one passenger out of four is neither.",
  "completion.elevator.destinationDirection":
    "Gets the direction the elevator is currently going to move toward.",
  "completion.elevator.isApproachingFloor":
    "Gets whether the elevator is moving toward the given floor and has not passed it yet. Only the direction of travel counts, so a floor further along that way is approaching too, even if the elevator is going to stop before it.",
  "completion.elevator.destinationQueue":
    "The current destination queue, meaning the floor numbers the elevator is scheduled to go to. Can be modified and emptied if desired. Note that you need to call checkDestinationQueue() for the change to take effect immediately.",
  "completion.elevator.checkDestinationQueue":
    "Checks the destination queue for any new destinations to go to. Note that you only need to call this if you modify the destination queue explicitly.",
  "completion.elevator.getPressedFloors": "Gets the currently pressed floor numbers as an array.",
  "completion.floor.floorNum": "Gets the floor number of the floor object.",
  "completion.elevator.event.idle":
    "Triggered when the elevator has completed all its tasks and is not doing anything.",
  "completion.elevator.event.floorButtonPressed":
    "Triggered when a passenger has pressed a button inside the elevator.",
  "completion.elevator.event.passingFloor":
    'Triggered slightly before the elevator will pass a floor. A good time to decide whether to stop at that floor. Note that this event is not triggered for the destination floor. Direction is either "up" or "down".',
  "completion.elevator.event.stoppedAtFloor": "Triggered when the elevator has arrived at a floor.",
  "completion.floor.event.upButtonPressed":
    "Triggered when someone has pressed the up button at a floor. Note that passengers will press the button again if they fail to enter an elevator.",
  "completion.floor.event.downButtonPressed":
    "Triggered when someone has pressed the down button at a floor. Note that passengers will press the button again if they fail to enter an elevator.",
  "completion.floor.event.hallButtonPressed":
    'Triggered when someone has pressed either call button at a floor. Note that passengers will press the button again if they fail to enter an elevator. The handler is passed the direction that was asked for, either "up" or "down", and the floor the button was pressed on.',
  "completion.floor.event.buttonStateChange": "Either call button was lit or cleared.",
  "completion.global.skeleton":
    "Your code must declare an object containing at least two functions called init and update.",
  "completion.global.init":
    "Called when the challenge starts. Normally you will put most of your code in here, to set up event listeners and logic.",
  "completion.global.update":
    "Called repeatedly during the challenge. dt is the number of game seconds that passed since the last time update was called.",
  "completion.initSkeleton.code": `init: function(elevators, floors) {
    // Do stuff with the elevators and floors, which are both arrays of objects
}`,
  "completion.updateSkeleton.code": `update: function(dt, elevators, floors) {
    // Do more stuff with the elevators and floors
}`,

  // ------------------------------------------------------ the fitness benchmark
  // src/app/fitness.ts and the scenario names in src/game/fitness.ts.

  "fitness.measuring": "Measuring fitness...",
  // The number in each column is `World.avgWaitTime` from one scenario, so this
  // line is named the way the panel names it rather than the way the field is.
  "fitness.results": "Fitness avg delivery times: {results}",
  "fitness.result": "{scenario}: {value}",
  "fitness.unknownValue": "?",
  "fitness.error": "Could not compute fitness due to error: {error}",
  "fitness.workerTimeout":
    "The fitness worker did not finish within {seconds} and was stopped. Does your program have a loop that never ends?",
  "fitness.workerFailed": "The fitness worker failed",
  // Reached from the benchmark command only: a program that allocates without
  // stopping exhausts the thread's heap, and Node ends the thread rather than
  // letting it report. Said here rather than passed on from Node, whose own
  // sentence is about heap sizes and does not mention the program.
  "fitness.workerOutOfMemory":
    "The fitness worker ran out of memory and was stopped. Is your program keeping something that grows with every passenger?",
  "fitness.scenario.small": "Small scenario",
  "fitness.scenario.medium": "Medium scenario",
  "fitness.scenario.large": "Large scenario",

  // ------------------------------------------------------------ error messages
  // Everything that can end up in the "there is a problem with your code"
  // banner. Method names, event names and the values the player passed stay in
  // English: they are the API, not prose.

  "error.code.noInit": "Code must contain an init function",
  "error.code.noUpdate": "Code must contain an update function",
  "error.elevator.notAFloor":
    "elevator.{method} was called with {value}, which is not a floor number. It takes a finite number, and this building has floors 0 to {topFloor}.",
  "error.elevator.queueNotAFloor":
    "elevator.destinationQueue contained {value}, which is not a floor number. The entry was dropped so the elevator keeps running; destinationQueue takes finite numbers, and this building has floors 0 to {topFloor}.",
  "error.value.array": "an array",
  "error.value.object": "an object",
  "error.movable.busy": "Object is busy - you should use callback",
  "error.thrown.emptyString": "Thrown empty string",
  "error.thrown.noMessage": "Thrown {kind} with no message",
  "error.thrown.keys": "{kind} with keys: {keys}",

  // ---------------------------------------------------- the help page: shell
  // documentation.html.

  "docs.page.title": "Elevator Saga - help and API documentation",
  "docs.page.description": "Help and API documentation for Elevator Saga.",
  "docs.page.tagline": "Help and API documentation",
  "docs.nav.label": "Game",
  "docs.nav.back": "Back to the game",

  // ------------------------------------------------- the help page: the game

  "docs.about.heading": "About the game",
  "docs.about.p1.html":
    'This is a game of programming!<br /> Your task is to program the movement of elevators, by writing a program in <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide">JavaScript</a>.',
  "docs.about.p2.html":
    "The goal is to transport people in an efficient manner.<br /> Depending on how well you do it, you can progress through the ever more difficult challenges.<br /> Only the very best programs will be able to complete all the challenges.",
  "docs.play.heading": "How to play",
  // The first thing under "How to play", because a reader who has arrived here
  // not knowing the API has already found the one page that assumes they do.
  // The address is written out rather than assembled from `tutorialTasks`: the
  // reference pages are static HTML with no script of their own, so the same
  // text has to be spellable by hand into both of them. `src/page.test.ts`
  // holds the pages and this key to the first task's real id.
  "docs.play.track.html":
    'If you have never written one of these programs before, start on the <a href="index.html#challenge=tutorial-1">learning track</a>, which is also the <span class="emphasis-color">Learning track</span> link at the top of the game. It is eight small buildings that introduce this API one mistake at a time: each hands you a program that loses, and asks you to find the one thing wrong with it, with hints and an explanation of what the run was actually doing.',
  "docs.play.apply.html":
    'Enter your code in the input window below the game view, and press the <span class="emphasis-color">Apply</span> button to start the challenge.<br /> You can increase or decrease the speed of time by pressing the {increase} and {decrease} buttons.',
  "docs.play.statistics.html":
    'Beside the building is a panel that keeps score while a run is going. Five of its rows need a word. <span class="emphasis-color">Moves</span> first. One move is counted each time a car crosses the halfway mark between one floor and the next, so a trip of three floors is three moves. A car that turns round mid-flight pays twice for the mark it crosses and re-crosses, and braking carries a car on across a mark it was turned back just short of. Three of the challenges are judged on that number, totalled over every car in the building, as well as on the people delivered, so on those a car that shuttles about empty can lose the run. Then the two clocks. <span class="emphasis-color">Avg delivery time</span> and <span class="emphasis-color">Max delivery time</span> both run from the moment a passenger appears in the building to the moment they step out of a car at the floor they asked for, so the ride counts in them as much as the wait for it does: somebody who walks straight into a car already standing at their floor, and waits not one second for it, still adds every second of a nineteen-floor journey to both. Nine of the challenges and two of the tasks on the learning track are judged on the second of them, which is the largest total any one passenger has reached — it keeps climbing while somebody is still on their way, and once reached it never comes down again. Between the two of them sits <span class="emphasis-color">Avg wait for a car</span>, which is the wait neither of them is. The clock starts when a passenger appears and stops when a car takes them, so the difference from the average delivery time is the ride. Only the passengers a car has already reached are in that average, so it is not where somebody left standing on a floor turns up — the maximum is. Last, <span class="emphasis-color">Avg load</span>. How full the cars were, averaged over the moves counted above, so a car standing still is not in the figure at all — parking costs nothing here, and in several of the challenges it is the right thing to do. In an ordinary run the figure sits far below full, and that is not a fault to be fixed: cars are rarely full, and nothing in the game pays for filling them. Nor does a higher figure mean better play. Of three programs run on the same eighteen-floor building, the one that holds a car at its floor until it is nearly full before setting off got its cars to about 70% and delivered the fewest people of the three, at nearly twice the wait of the best of them, while the program that delivered the most carried the emptiest cars of all, under a half. What the number is good for is comparing two programs that deliver about the same: at equal numbers delivered, the one with the higher load did it with fewer trips that carried nobody.',
  "docs.play.shortcuts.html":
    "Inside the editor, <kbd data-mod-key>Ctrl</kbd>+<kbd>Enter</kbd> applies your program and restarts the challenge, <kbd data-mod-key>Ctrl</kbd>+<kbd>S</kbd> saves it, <kbd>Tab</kbd> indents, and <kbd>Esc</kbd> moves the focus back out of the editor.",
  "docs.play.debugging.html":
    'If your program contains an error, you can use the developer tools in your web browser to try and debug it. If you want to start over with the code, press the <span class="emphasis-color">Reset</span> button. This will revert the code to a working but simplistic implementation.<br /> If you have a favorite text editor, such as <a href="https://www.sublimetext.com/">Sublime Text</a>, feel free to edit the code there and paste it into the game editor.<br /> Your code is automatically saved in your local storage, so don\'t worry - it doesn\'t disappear if you accidentally close the browser.',

  // ----------------------------------------------- the help page: the basics

  "docs.basics.heading": "Basics",
  "docs.basics.declare.html":
    'Your code must declare an object containing at least two functions called <span class="emphasis-color">init</span> and <span class="emphasis-color">update</span>. Like this:',
  "docs.basics.example.code": `{
    init: function(elevators, floors) {
        // Do stuff with the elevators and floors, which are both arrays of objects
    },
    update: function(dt, elevators, floors) {
        // Do more stuff with the elevators and floors
        // dt is the number of game seconds that passed since the last time update was called
    }
}`,
  "docs.basics.called.html":
    'These functions will then be called by the game during the challenge.<br /> <span class="emphasis-color">init</span> runs once, on the first frame of the run rather than at the moment you apply your code, and <span class="emphasis-color">update</span> runs on that same frame and on every frame after it — as often as the browser draws, which is why <span class="emphasis-color">dt</span>, and not the number of calls, is what tells you how much game time has passed. Both are handed the same two arrays — one holding every elevator in the building, one holding every floor — so <span class="emphasis-color">elevators.length</span> is how many cars you have to work with, and neither array is replaced between calls. Both are called on the object you declared, so <span class="emphasis-color">this</span> inside them is that object: anything your program needs to remember from one frame to the next can live on <span class="emphasis-color">this</span> instead of in a variable outside. That holds as long as you write them with <span class="emphasis-color">function</span> — an arrow function keeps the <span class="emphasis-color">this</span> of wherever it was written, which here is the page rather than your object.',
  "docs.basics.initPurpose.html":
    'Normally you will put most of your code in the <span class="emphasis-color">init</span> function, to set up event listeners and logic.',
  "docs.basics.noLibraries.html":
    'The game used to load jQuery and lodash, so older solutions you find on the wiki often call <span class="emphasis-color">$</span> or <span class="emphasis-color">_</span>. Neither is loaded any more and neither is in scope for your program: a solution that uses them will fail with <span class="emphasis-color">$ is not defined</span> or <span class="emphasis-color">_ is not defined</span>. Most of what they were used for here — <span class="emphasis-color">_.filter</span>, <span class="emphasis-color">_.map</span>, <span class="emphasis-color">_.each</span> and friends — is a built-in array method (<span class="emphasis-color">filter</span>, <span class="emphasis-color">map</span>, <span class="emphasis-color">forEach</span>) in every browser that can run this game. <span class="emphasis-color">_.min</span> and <span class="emphasis-color">_.max</span> are the exception: <span class="emphasis-color">Math.min</span> is not an array method, and it takes its arguments one at a time rather than an array, so <span class="emphasis-color">_.min(floorNums)</span> has to become <span class="emphasis-color">Math.min(...floorNums)</span>. Watch the empty array while you are at it: <span class="emphasis-color">Math.min()</span> with nothing to compare is <span class="emphasis-color">Infinity</span> rather than a floor, and <span class="emphasis-color">goToFloor</span> refuses it, so an empty <span class="emphasis-color">getPressedFloors()</span> needs an answer of its own.',

  // ---------------------------------------------- the help page: the examples

  "docs.examples.heading": "Code examples",
  "docs.examples.control.heading": "How to control an elevator",
  "docs.examples.goToFloor":
    "Tell the elevator to move to floor 1 after completing other tasks, if any. A request for the floor already at the end of the queue that it would be added to is dropped, so asking for the same floor over and over does not pile up. That is the only case that is dropped: a floor that is somewhere else in the queue will be queued again.",
  "docs.examples.currentFloor":
    "Calling currentFloor gets the floor number that the elevator currently is on. Note that this is a rounded number and does not necessarily mean the elevator is in a stopped state.",
  "docs.examples.events.heading": "Listening for events",
  "docs.examples.events.intro.html":
    'It is possible to listen for events, like when stopping at a floor, or a button has been pressed. Elevators and floors both understand <span class="emphasis-color">on</span>, <span class="emphasis-color">once</span>, <span class="emphasis-color">one</span>, <span class="emphasis-color">off</span> and <span class="emphasis-color">offAll</span>; see <a href="#events">event methods</a> below for what each of them does.',
  "docs.examples.idle":
    'Listen for the "idle" event issued by the elevator, when the task queue has been emptied and the elevator is doing nothing. In this example we tell it to move to floor 0.',
  "docs.examples.floorButtonPressed":
    'Listen for the "floor_button_pressed" event, issued when a passenger pressed a button inside the elevator. This indicates that the passenger wants to go to that floor.',
  "docs.examples.upButtonPressed":
    'Listen for the "up_button_pressed" event, issued when a passenger pressed the up button on the floor they are waiting on. This indicates that the passenger wants to go to another floor. The handler is passed the floor the button was pressed on.',
  "docs.examples.events.perElevator.html":
    'Every elevator has its own events, so a handler registered on one elevator only ever hears that elevator: a building with four of them needs the handler registered four times, and <span class="emphasis-color">elevators.forEach(function(elevator) { ... })</span> is the short way to write that. If everything your handlers do seems to happen to the last elevator instead, the loop that registered them is the place to look, not the elevators. <span class="emphasis-color">for (var i = 0; i &lt; elevators.length; i++) { var elevator = elevators[i]; elevator.on("idle", function() { elevator.goToFloor(0); }); }</span> registers each handler on the right elevator, but <span class="emphasis-color">var</span> gives the whole function a single <span class="emphasis-color">elevator</span> binding, and every handler runs later, after the loop has finished — by then that one binding holds the elevator the loop ended on, and that is the elevator all of them drive. <span class="emphasis-color">let</span> and <span class="emphasis-color">const</span> give each iteration a binding of its own, so <span class="emphasis-color">for (const elevator of elevators)</span> and <span class="emphasis-color">forEach</span> do what the <span class="emphasis-color">var</span> version looks like it does. Floors work the same way, and so does anything else a handler closes over in a loop.',

  // --------------------------------------------- the help page: the reference

  "docs.api.heading": "API documentation",
  "docs.table.method": "Method",
  "docs.table.property": "Property",
  "docs.table.event": "Event",
  "docs.table.type": "Type",
  "docs.table.explanation": "Explanation",
  "docs.table.example": "Example",

  "docs.api.events.heading": "Event methods",
  "docs.api.events.intro":
    "Every elevator and every floor is an event emitter, and these are the methods it gives you. They all return the object they were called on, so they can be chained.",
  "docs.api.events.on":
    "Register a listener. Listeners run in the order they were registered, and the same function may be registered more than once. Several event names separated by spaces register the same listener for all of them; when you name more than one, the listener is called with the name of the event that fired as its first argument, ahead of that event's own arguments.",
  "docs.api.events.once":
    "Register a listener that runs at most once and is then removed. It is removed before it runs, so triggering the same event from inside it will not run it again. Takes a single event name.",
  "docs.api.events.one.html":
    'The older name for <span class="emphasis-color">once</span>, and the one the original game gave you. Same behaviour, single event name as well.',
  "docs.api.events.off.html":
    'Remove listeners. With a function, removes just that function, however it was registered; without one, removes every listener of the named events. Accepts space separated names like <span class="emphasis-color">on</span> does, and the single name <span class="emphasis-color">"*"</span> for every event at once — a function passed alongside the star is ignored. You need a reference to the function you registered, so an inline anonymous function cannot be removed.',
  "docs.api.events.off.example.code": `function goHome() { elevator.goToFloor(0); }
elevator.on("idle", goHome);
elevator.off("idle", goHome); // Just this one
elevator.off("idle"); // Every idle listener
elevator.off("*"); // Every listener, of every event`,
  "docs.api.events.offAll.html":
    'Remove every listener <em>you</em> registered, for every event, on that elevator or floor. The listeners the game itself needs are separate, so the object keeps working — anything you register afterwards still fires. This is <span class="emphasis-color">off("*")</span> with a name of its own.',
  "docs.api.events.outro.html":
    'You rarely need to remove listeners: the elevators and floors are thrown away when a challenge restarts, and your <span class="emphasis-color">init</span> is called afresh on the new ones. Removing is useful when you want a listener to apply only for a while.',

  "docs.api.elevator.heading": "Elevator object",
  "docs.api.elevator.goToFloor.html":
    'Queue the elevator to go to specified floor number. If you specify true as second argument, the elevator will go to that floor directly, and then go to any other queued floors. The request is dropped if the floor is already at the end of the queue it would join: the back for a normal call, the front for a call with true. The same floor further along the queue is queued again. A floor number outside the building is clamped to the nearest real floor, but a value that is not a number at all — <span class="emphasis-color">NaN</span>, <span class="emphasis-color">undefined</span>, a string that does not parse — is refused and reported as an error in your code.',
  "docs.api.elevator.goToFloor.example.code": `elevator.goToFloor(3); // Do it after anything else -- queue: 3
elevator.goToFloor(2, true); // Do it before anything else -- queue: 2, 3
elevator.goToFloor(3); // Dropped, 3 is already last
elevator.goToFloor(2, true); // Dropped, 2 is already first
elevator.goToFloor(2); // Queued anyway -- queue: 2, 3, 2`,
  "docs.api.elevator.stop":
    "Clear the destination queue and stop the elevator if it is moving. Note that you normally don't need to stop elevators - it is intended for advanced solutions with in-transit rescheduling logic. Also, note that the elevator will probably not stop at a floor, so passengers will not get out.",
  "docs.api.elevator.currentFloor": "Gets the floor number that the elevator currently is on.",
  "docs.api.elevator.currentFloor.example.code": `if(elevator.currentFloor() === 0) {
    // Do something special?
}`,
  "docs.api.elevator.goingUpIndicator":
    "Gets or sets the going up indicator, which will affect passenger behaviour when stopping at floors.",
  "docs.api.elevator.goingDownIndicator":
    "Gets or sets the going down indicator, which will affect passenger behaviour when stopping at floors.",
  "docs.api.elevator.maxPassengerCount":
    "Gets the maximum number of passengers that can occupy the elevator at the same time.",
  "docs.api.elevator.maxPassengerCount.example.code": `if(elevator.maxPassengerCount() > 5) {
    // Use this elevator for something special, because it's big
}`,
  "docs.api.elevator.loadFactor":
    "Gets the load factor of the elevator. 0 means empty, 1 means full. Varies with passenger weights, which vary - not an exact measure.",
  "docs.api.elevator.loadFactor.example.code": `if(elevator.loadFactor() < 0.4) {
    // Maybe use this elevator, since it's not full yet?
}`,
  "docs.api.elevator.isFull":
    "Gets whether every spot in the elevator is taken. Use this rather than comparing loadFactor to 1 - passenger weights vary, so a completely full elevator only reads about 0.775 on average. Someone who has started walking in counts, since they have taken their spot already.",
  "docs.api.elevator.isFull.example.code": `if(!elevator.isFull()) {
    // Maybe pick someone up on the way?
}`,
  "docs.api.elevator.isEmpty":
    "Gets whether the elevator is carrying nobody at all. Not the opposite of isFull - an elevator with one passenger out of four is neither.",
  "docs.api.elevator.isEmpty.example.code": `if(elevator.isEmpty()) {
    // Nobody on board - go wait somewhere useful?
}`,
  "docs.api.elevator.isApproachingFloor":
    "Gets whether the elevator is moving toward the given floor and has not passed it yet. Only the direction of travel counts, so a floor further along that way is approaching too, even if the elevator is going to stop before it. It is the same test the game itself makes before triggering passing_floor, so a floor this says no to can no longer raise that event. An elevator standing still is approaching nothing, and neither is one that has arrived at the floor you ask about. A floor number outside the building is clamped to the nearest real floor, and a value that is not a number at all - including a forgotten argument - is refused and reported as an error in your code, just like goToFloor.",
  "docs.api.elevator.isApproachingFloor.example.code": `if(elevator.isApproachingFloor(2)) {
    // Maybe stop and pick up whoever is waiting there?
}`,
  "docs.api.elevator.destinationDirection":
    'Gets the direction the elevator is currently going to move toward. Can be "up", "down" or "stopped".',
  "docs.api.elevator.destinationQueue":
    "The current destination queue, meaning the floor numbers the elevator is scheduled to go to. Can be modified and emptied if desired. Note that you need to call checkDestinationQueue() for the change to take effect immediately. The next time the queue is checked, every entry in it that is not a finite number is dropped in one pass, and the first of them is reported as an error in your code - only the first, and only once per elevator. A finite floor number outside the building is left where it is, and sends the elevator past the end of the shaft.",
  "docs.api.elevator.checkDestinationQueue":
    "Checks the destination queue for any new destinations to go to. Note that you only need to call this if you modify the destination queue explicitly.",
  "docs.api.elevator.getPressedFloors": "Gets the currently pressed floor numbers as an array.",
  "docs.api.elevator.getPressedFloors.example.code": `if(elevator.getPressedFloors().length > 0) {
    // Maybe go to some chosen floor first?
}`,
  "docs.api.elevator.idle":
    "Triggered when the elevator has completed all its tasks and is not doing anything.",
  "docs.api.elevator.floorButtonPressed":
    "Triggered when a passenger has pressed a button inside the elevator.",
  "docs.api.elevator.floorButtonPressed.example.code": `elevator.on("floor_button_pressed", function(floorNum) {
    // Maybe tell the elevator to go to that floor?
})`,
  "docs.api.elevator.passingFloor":
    'Triggered slightly before the elevator will pass a floor. A good time to decide whether to stop at that floor. Note that this event is not triggered for the destination floor. Direction is either "up" or "down".',
  "docs.api.elevator.stoppedAtFloor": "Triggered when the elevator has arrived at a floor.",
  "docs.api.elevator.stoppedAtFloor.example.code": `elevator.on("stopped_at_floor", function(floorNum) {
    // Maybe decide where to go next?
})`,

  "docs.api.floor.heading": "Floor object",
  "docs.api.floor.floorNum": "Gets the floor number of the floor object.",
  "docs.api.floor.upButtonPressed":
    "Triggered when someone has pressed the up button at a floor. Note that passengers will press the button again if they fail to enter an elevator. The handler is passed the floor the button was pressed on.",
  "docs.api.floor.upButtonPressed.example.code": `floor.on("up_button_pressed", function(floor) {
    // Maybe tell an elevator to go to this floor?
})`,
  "docs.api.floor.downButtonPressed":
    "Triggered when someone has pressed the down button at a floor. Note that passengers will press the button again if they fail to enter an elevator. The handler is passed the floor the button was pressed on.",
  "docs.api.floor.downButtonPressed.example.code": `floor.on("down_button_pressed", function(floor) {
    // Maybe tell an elevator to go to this floor?
})`,
  "docs.api.floor.hallButtonPressed":
    'Triggered when someone has pressed either call button at a floor. Note that passengers will press the button again if they fail to enter an elevator. The handler is passed the direction that was asked for, either "up" or "down", and the floor the button was pressed on. It is triggered just after the up_button_pressed or down_button_pressed event for the same press, so a program listening for both hears about that press twice.',
  "docs.api.floor.hallButtonPressed.example.code": `floor.on("hall_button_pressed", function(direction, floor) {
    // Maybe send an elevator that is already going that way?
})`,
  "docs.api.floor.buttonStateChange.html":
    'Triggered when either call button at a floor was lit or cleared. The handler is passed the state of both buttons: an object with an <span class="emphasis-color">up</span> and a <span class="emphasis-color">down</span> property, each either <span class="emphasis-color">"activated"</span> or the empty string. It is a snapshot taken when the event fired, so holding on to it will not show you later presses.',
  "docs.api.floor.buttonStateChange.example.code": `floor.on("buttonstate_change", function(buttonStates) {
    if(buttonStates.up === "" && buttonStates.down === "") {
        // Nobody is waiting here any more?
    }
})`,

  // ------------------------------------------------------ the learning track
  // The eight tasks themselves live in src/game/tutorial.ts — the building, the
  // bar, the seed and the two programs — and everything the player reads around
  // them lives here. Every number quoted below is the number in that table
  // rather than the one in docs/tutorial-plan.md, which is older in three
  // places: task 4 runs at 0.8 passengers a second, task 5 is nine floors with
  // a wait limit of 37, and task 6 is 0.25 a second with a limit of 28.
  //
  // Every per-task message ends in `.html`, uniformly, including the ones whose
  // value is plain text. Two reasons, and the second is the one a later reader
  // will otherwise try to "fix". First, the panel builds these key names by
  // interpolating the task number and the hint number, so a suffix that varied
  // from task to task could not be built at all. Second, it is legal:
  // `catalogue.test.ts` only forbids markup under a key that is *not* `.html`,
  // and its tag-matching test is satisfied by two empty tag lists, so a plain
  // value under a `.html` key breaks nothing.
  //
  // Both programs of every task are here as well, under `.code` keys, and the
  // suffix is the whole argument: only the `//` comments in them are
  // translated, the JavaScript being byte-identical in every locale, and
  // `catalogue.test.ts` checks that rather than trusting it. They belong here
  // because the comments are prose addressed to the player — a Russian reader
  // was being told "TODO: this building has two floors" in the editor, in the
  // one program on the track they are asked to change, and again under the
  // third hint. `editor.defaultCode.code` had been under this rule since the
  // catalogue was written; the track was an oversight rather than a decision,
  // which is why `docs/i18n-inventory.md` never listed it as one.
  //
  // Still one copy of each program, not two. src/game/tutorial.ts reads these
  // keys and everything else reads that table, so the program the editor is
  // filled with, the program the panel shows as the answer and the program
  // `tutorial-solutions.test.ts` proves the task with are one string in one
  // place. A copy nothing compares was the thing to avoid and still is:
  // `tutorial.task8.solutionCode.code` is task 7's program word for word,
  // because task 8 asks for nothing new, and `src/game/tutorial.test.ts` holds
  // the two equal in every locale rather than leaving them to be edited apart.
  //
  // The two code keys come last in each task's group, so that the prose keys
  // stay next to one another: a translator reads the two catalogues side by
  // side, and a twelve-line program between two sentences is twelve lines of
  // scrolling. The Russian typography rules draw the same line — a code block
  // is indented, and "has no double spaces" applies to every key that does not
  // end in `.code`.

  "tutorial.task1.title": "The elevator that goes nowhere",
  "tutorial.task1.goal":
    "Make the elevator visit both floors of this building and deliver 10 passengers within 60 seconds.",
  "tutorial.task1.hint1.html":
    "Look at the building rather than at the code. The elevator is standing on floor 0, and floor 0 is the only thing in its queue. How many floors does this building have?",
  "tutorial.task1.hint2.html":
    'Floors are numbered from zero, so the top floor here is <span class="emphasis-color">1</span>. The same handler needs one more line beside the one already in it.',
  "tutorial.task1.hint3.html":
    'The answer: add <span class="emphasis-color">elevator.goToFloor(1);</span> after the line that is already there, so that every time the elevator falls idle it queues both floors.',
  "tutorial.task1.explanation.html":
    "goToFloor does not drive anywhere. It appends the floor to the end of destinationQueue and calls checkDestinationQueue, and the elevator works through that queue on its own. So goToFloor(0) while the car is already on floor 0 is a legal trip of zero length: the car arrives where it stands, opens its doors, people get in, the queue is empty again, idle fires again, and the same thing happens again. That is why the car fills up while the moves counter stays at zero. A passenger boards on arrival and gets out on the floor they asked for, and this elevator never reaches it. One more thing worth saying out loud: a floor number outside the building is not an error, it is quietly clamped to the nearest real floor. Somebody who counts floors from one writes goToFloor(2) here and wins as well, because 2 becomes 1.",

  "tutorial.task1.startingCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        elevator.on("idle", function() {
            // TODO: this building has two floors, and the elevator only visits one
            elevator.goToFloor(0);
        });
    },
    update: function(dt, elevators, floors) {
    }
}`,
  "tutorial.task1.solutionCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        elevator.on("idle", function() {
            elevator.goToFloor(0);
            elevator.goToFloor(1);
        });
    },
    update: function(dt, elevators, floors) {
    }
}`,

  "tutorial.task2.title": "The same loop, written by hand",
  "tutorial.task2.goal":
    "Write the handler that sends the elevator round all three floors, and deliver 15 passengers within 60 seconds.",
  "tutorial.task2.hint1.html":
    "Everything you need was in the first task: you saw it there, you just did not write it. The event that fires when the elevator has run out of destinations is called idle.",
  "tutorial.task2.hint2.html":
    'A subscription looks like <span class="emphasis-color">elevator.on("idle", …)</span> — the name of the event as a string, the handler as a function. Inside the handler goes one goToFloor call per floor of the building.',
  "tutorial.task2.hint3.html":
    'The answer: subscribe to <span class="emphasis-color">idle</span> and queue floors 0, 1 and 2 inside the handler, the way task 1 did it for two floors.',
  "tutorial.task2.explanation.html":
    "init is called once, on the first frame of the run and before the world has taken a single step, and all it normally does is subscribe to events. The first idle is sent by the game itself, on the line right after your init returns, so subscribing is enough to set the whole thing going. The other function, update(dt, elevators, floors), is called on every frame instead. The track never uses it, and that is deliberate: asking the building about its state on every frame gives worse programs than answering the events it sends you. Worse, not forbidden — polling will get you through any task on this track.",

  "tutorial.task2.startingCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        // TODO: send the elevator round all three floors, over and over
    },
    update: function(dt, elevators, floors) {
    }
}`,
  "tutorial.task2.solutionCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        elevator.on("idle", function() {
            elevator.goToFloor(0);
            elevator.goToFloor(1);
            elevator.goToFloor(2);
        });
    },
    update: function(dt, elevators, floors) {
    }
}`,

  "tutorial.task3.title": "The buttons inside the car",
  "tutorial.task3.goal":
    "Take the people who are already aboard where they asked to go, and deliver 15 passengers within 60 seconds.",
  "tutorial.task3.hint1.html":
    "The floor buttons inside the car are lit, which means the game has already announced them. The events an elevator sends are listed in the editor completion popup and on the help page.",
  "tutorial.task3.hint2.html":
    'The event is <span class="emphasis-color">floor_button_pressed</span>, and the floor that was pressed arrives as the argument of the handler.',
  "tutorial.task3.hint3.html":
    'The answer: subscribe to <span class="emphasis-color">floor_button_pressed</span> on the elevator and send it to the floor the handler was given. Leave the idle handler where it is.',
  "tutorial.task3.explanation.html":
    "A passenger who has got in presses their own floor, and the game reports it with floor_button_pressed, carrying the floor number as the argument. The lit buttons can also be read by polling them yourself, with getPressedFloors(), but reacting to the event is the habit worth building. Notice that the goToFloor(0) in the idle handler is no longer in anybody's way: now that the cabin buttons are answered, it simply means the car goes back to the ground floor when it has nothing else to do.",

  "tutorial.task3.startingCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        elevator.on("idle", function() {
            elevator.goToFloor(0);
        });

        // TODO: they are already aboard and have already pressed their floors
    },
    update: function(dt, elevators, floors) {
    }
}`,
  "tutorial.task3.solutionCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        elevator.on("idle", function() {
            elevator.goToFloor(0);
        });

        elevator.on("floor_button_pressed", function(floorNum) {
            elevator.goToFloor(floorNum);
        });
    },
    update: function(dt, elevators, floors) {
    }
}`,

  "tutorial.task4.title": "The queue nobody read",
  "tutorial.task4.goal":
    "Find the one line this program is missing and deliver 15 passengers within 60 seconds.",
  "tutorial.task4.hint1.html":
    "Watch the elevator for twenty seconds. It is not merely standing still: nobody is getting in. So it has never once arrived.",
  "tutorial.task4.hint2.html":
    'The queue is not empty, but the elevator knows nothing about it. Once <span class="emphasis-color">destinationQueue</span> has been changed by hand, the game has to be told, and the method that tells it is in the list of the elevator methods.',
  "tutorial.task4.hint3.html":
    'The answer is one line: call <span class="emphasis-color">elevator.checkDestinationQueue();</span> straight after the assignment, inside the same idle handler.',
  "tutorial.task4.explanation.html":
    "A full car standing still and an empty car standing still differ the way an elevator that arrived and opened its doors differs from an elevator that never arrived at all. Boarding happens on arrival, and nowhere else. Someone who presses a button beside a standing car usually nudges it: the game re-offers the floor to the car with goToFloor(floor, true), and in tasks 1 to 3 that is what kept filling the cabin. Here the nudge does nothing. The queue is not empty, it holds 0, 1, 2, 3, and goToFloor drops a request that equals the adjacent end of a non-empty queue before it ever gets as far as checking the queue: floor 0 is asked for, floor 0 is already at the head, and the call returns. The car stands there for the rest of the run. goToFloor calls checkDestinationQueue for you; assigning the queue does not.",

  "tutorial.task4.startingCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        // Somebody rewrote the round trip as a queue.
        elevator.on("idle", function() {
            elevator.destinationQueue = [0, 1, 2, 3];
        });

        elevator.on("floor_button_pressed", function(floorNum) {
            elevator.goToFloor(floorNum);
        });
    },
    update: function(dt, elevators, floors) {
    }
}`,
  "tutorial.task4.solutionCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        elevator.on("idle", function() {
            elevator.destinationQueue = [0, 1, 2, 3];
            elevator.checkDestinationQueue();
        });

        elevator.on("floor_button_pressed", function(floorNum) {
            elevator.goToFloor(floorNum);
        });
    },
    update: function(dt, elevators, floors) {
    }
}`,

  "tutorial.task5.title": "The building grew",
  "tutorial.task5.goal":
    "Send the elevator where it is actually called: deliver 15 passengers, and let nobody's delivery take longer than 37 seconds.",
  "tutorial.task5.hint1.html":
    "The trouble is not how fast the elevator goes, it is that it goes to floors where nobody is standing. Who in this game knows that somebody is waiting? The second argument of init has not been used once so far.",
  "tutorial.task5.hint2.html":
    'Walk the floors with <span class="emphasis-color">floors.forEach</span> and subscribe each one to <span class="emphasis-color">up_button_pressed</span> and <span class="emphasis-color">down_button_pressed</span>. A floor knows its own number: <span class="emphasis-color">floor.floorNum()</span>. Once the calls are answered the sweep is no longer needed — delete it.',
  "tutorial.task5.hint3.html":
    'The answer: keep the <span class="emphasis-color">floor_button_pressed</span> handler, throw the sweep out entirely, and inside <span class="emphasis-color">floors.forEach</span> subscribe to both call buttons, each of them sending the elevator to <span class="emphasis-color">floor.floorNum()</span>.',
  "tutorial.task5.explanation.html":
    'A blind sweep does not scale: its worst waiting time is the length of one lap, and the lap grows with the building. Floors can call an elevator themselves. Both events hand the floor over as the argument, so floor.floorNum() can come from the argument or from the closure, whichever reads better. Subscribing to both events in one line is possible — floor.on("up_button_pressed down_button_pressed", …) — but then the first argument is the name of the event that fired and the floor moves along into second place; that is why there are two separate handlers here. And to be honest about the result: the new program makes more moves than the sweep did, not fewer. It wins by no longer carrying air.',

  "tutorial.task5.startingCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        elevator.on("idle", function() {
            elevator.destinationQueue = [0, 1, 2, 3, 4, 5, 6, 7, 8];
            elevator.checkDestinationQueue();
        });

        elevator.on("floor_button_pressed", function(floorNum) {
            elevator.goToFloor(floorNum);
        });

        // TODO: ask the floors who wants an elevator instead of visiting them all
    },
    update: function(dt, elevators, floors) {
    }
}`,
  "tutorial.task5.solutionCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        elevator.on("floor_button_pressed", function(floorNum) {
            elevator.goToFloor(floorNum);
        });

        floors.forEach(function(floor) {
            floor.on("up_button_pressed", function() {
                elevator.goToFloor(floor.floorNum());
            });
            floor.on("down_button_pressed", function() {
                elevator.goToFloor(floor.floorNum());
            });
        });
    },
    update: function(dt, elevators, floors) {
    }
}`,

  "tutorial.task6.title": "The elevator that lies to its passengers",
  "tutorial.task6.goal":
    "Work out why half the building refuses to board, and deliver 15 passengers with nobody's delivery taking longer than 28 seconds.",
  "tutorial.task6.hint1.html":
    "Do not watch the counters, watch the call arrows. One of them lights up partway through the run and never goes out again. Which way was the person who pressed it planning to go?",
  "tutorial.task6.hint2.html":
    "An elevator whose going-down indicator is off is telling passengers that it will not go down, and they let it pass. Both indicators are on to begin with.",
  "tutorial.task6.hint3.html":
    'The answer: <span class="emphasis-color">elevator.goingDownIndicator(true);</span> instead of <span class="emphasis-color">false</span>. Deleting both indicator lines gives exactly the same run, because a car is built with both of them lit. Switching both of them off is a different program altogether, and one that nobody boards at all.',
  "tutorial.task6.explanation.html":
    "A passenger only gets into a car that suits the trip they are making: the game asks isSuitableForTravelBetween, and that looks at the indicators. A passenger turned away presses the call button again. The arrow stays lit for a separate reason, and it is the same reason the symptom is visible at all: an arriving elevator clears only the call buttons that correspond to the indicators it has lit, so a car with the down arrow dark physically cannot clear a call to go down. Worse, a standing car is not re-offered either — the game nudges a standing car only when its indicator matches the direction of the call. Both indicators are on to begin with, so those two lines fix nothing. They only break.",

  "tutorial.task6.startingCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        // Somebody decided to show the passengers which way the elevator is going.
        elevator.goingUpIndicator(true);
        elevator.goingDownIndicator(false);

        elevator.on("floor_button_pressed", function(floorNum) {
            elevator.goToFloor(floorNum);
        });

        floors.forEach(function(floor) {
            floor.on("up_button_pressed", function() {
                elevator.goToFloor(floor.floorNum());
            });
            floor.on("down_button_pressed", function() {
                elevator.goToFloor(floor.floorNum());
            });
        });
    },
    update: function(dt, elevators, floors) {
    }
}`,
  "tutorial.task6.solutionCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        elevator.goingUpIndicator(true);
        elevator.goingDownIndicator(true);

        elevator.on("floor_button_pressed", function(floorNum) {
            elevator.goToFloor(floorNum);
        });

        floors.forEach(function(floor) {
            floor.on("up_button_pressed", function() {
                elevator.goToFloor(floor.floorNum());
            });
            floor.on("down_button_pressed", function() {
                elevator.goToFloor(floor.floorNum());
            });
        });
    },
    update: function(dt, elevators, floors) {
    }
}`,

  "tutorial.task7.title": "The second elevator",
  "tutorial.task7.goal": "Put both elevators to work and deliver 28 passengers within 60 seconds.",
  "tutorial.task7.hint1.html":
    "There are people sitting in the second elevator and it is going nowhere: nobody has told it anything. How many times does this program say elevators[0]?",
  "tutorial.task7.hint2.html":
    'Register the cabin button handler inside <span class="emphasis-color">elevators.forEach</span>, so that every car listens to its own buttons. A call from a floor has to pick a car: the least loaded one, by <span class="emphasis-color">loadFactor()</span>, for instance.',
  "tutorial.task7.hint3.html":
    'The answer: a small function that walks <span class="emphasis-color">elevators</span> and returns the car with the lowest <span class="emphasis-color">loadFactor()</span>; the cabin button handler registered on every car through <span class="emphasis-color">elevators.forEach</span>; and both call buttons of every floor sending the chosen car to <span class="emphasis-color">floor.floorNum()</span>. Any rule that keeps both cars working clears this building.',
  "tutorial.task7.explanation.html":
    "elevators[0] is not the elevator, it is the first elevator. This building has two of them, and the last challenges of the game have eight. A program written with elevators.forEach works with one car and with eight alike, and it is the program you will carry into the real challenges. Choosing by loadFactor() is the cheapest sensible rule: 0 is empty, 1 is full. It is not the only rule that clears this building, anything that keeps both cars busy will do, but a rule you can check against the picture on screen is easier to debug.",

  "tutorial.task7.startingCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        elevator.on("floor_button_pressed", function(floorNum) {
            elevator.goToFloor(floorNum);
        });

        floors.forEach(function(floor) {
            floor.on("up_button_pressed", function() {
                elevator.goToFloor(floor.floorNum());
            });
            floor.on("down_button_pressed", function() {
                elevator.goToFloor(floor.floorNum());
            });
        });
    },
    update: function(dt, elevators, floors) {
    }
}`,
  "tutorial.task7.solutionCode.code": `{
    init: function(elevators, floors) {
        function pickElevator() {
            let best = elevators[0];
            elevators.forEach(function(elevator) {
                if (elevator.loadFactor() < best.loadFactor()) {
                    best = elevator;
                }
            });
            return best;
        }

        elevators.forEach(function(elevator) {
            elevator.on("floor_button_pressed", function(floorNum) {
                elevator.goToFloor(floorNum);
            });
        });

        floors.forEach(function(floor) {
            floor.on("up_button_pressed", function() {
                pickElevator().goToFloor(floor.floorNum());
            });
            floor.on("down_button_pressed", function() {
                pickElevator().goToFloor(floor.floorNum());
            });
        });
    },
    update: function(dt, elevators, floors) {
    }
}`,

  "tutorial.task8.title": "From memory",
  "tutorial.task8.goal":
    "Write the program on an empty page and deliver 15 passengers within 60 seconds.",
  "tutorial.task8.hint1.html":
    "The program falls into two halves: telling a car where to go, and finding out that somebody is waiting for one. You have written both. Which of the two functions is called once, and which one on every frame?",
  "tutorial.task8.hint2.html":
    "The game announces the people inside a car and the people waiting on a floor with different events, and the two are subscribed in different places: on the elevator, and on every floor.",
  "tutorial.task8.hint3.html":
    'The answer is the program from task 7, unchanged — it works just as well with one elevator. Subscribe to <span class="emphasis-color">floor_button_pressed</span> on every car, subscribe to both call buttons on every floor, and send a car to <span class="emphasis-color">floor.floorNum()</span>. Write the whole of it: the half where a car simply parks at floor 0 and knows nothing but its own cabin buttons is the half that loses runs.',
  "tutorial.task8.explanation.html":
    "Nothing here is new, and that is the point. This is the building of challenge 1 and the bar of challenge 1, copied deliberately: three floors, one elevator, 15 passengers in 60 seconds. Win here and challenge 1 is already solved, by the very program now in the editor. The margin here is also the thinnest on the track, and that is not the track's doing: at 0.3 passengers a second the fifteenth passenger does not appear in the building until about the forty-seventh second of the sixty, so the minute is tighter than it looks. That is a property of challenge 1, and you have met it early.",

  "tutorial.task8.startingCode.code": `{
    init: function(elevators, floors) {
        // TODO: nothing here is new. You have written all of it already.
    },
    update: function(dt, elevators, floors) {
    }
}`,
  // Task 7's answer, word for word, which is the answer task 8 is measured
  // against: the graduation task asks for nothing new. Written out rather than
  // pointed at, so that every task owns the same eight keys and a translator
  // meets no exception; `src/game/tutorial.test.ts` holds the two equal in
  // every locale, which is what a copy needs to be allowed to exist.
  "tutorial.task8.solutionCode.code": `{
    init: function(elevators, floors) {
        function pickElevator() {
            let best = elevators[0];
            elevators.forEach(function(elevator) {
                if (elevator.loadFactor() < best.loadFactor()) {
                    best = elevator;
                }
            });
            return best;
        }

        elevators.forEach(function(elevator) {
            elevator.on("floor_button_pressed", function(floorNum) {
                elevator.goToFloor(floorNum);
            });
        });

        floors.forEach(function(floor) {
            floor.on("up_button_pressed", function() {
                pickElevator().goToFloor(floor.floorNum());
            });
            floor.on("down_button_pressed", function() {
                pickElevator().goToFloor(floor.floorNum());
            });
        });
    },
    update: function(dt, elevators, floors) {
    }
}`,

  // The panel around the tasks, the bar above them and the screen after the
  // last one. The seed line, the statistics and the editor are the game's own
  // and say the same things here as everywhere else.

  "tutorial.panel.label": "Learning track",
  "tutorial.panel.position": "Task {number} of {count}",
  "tutorial.panel.progress": {
    one: "{cleared} of {count} task done",
    other: "{cleared} of {count} tasks done",
  },
  "tutorial.panel.hintSummary": "Hint {number}",
  "tutorial.panel.explanationSummary": "Why this happens",
  // What the panel says after "Take this program" — the button writes into a
  // buffer the player cannot see from here, so without a line of its own it is
  // a button that does nothing visible. The refusal is worth its own key rather
  // than silence: the copy is gone and the program is still on screen, so the
  // one useful thing to say is how to keep it by hand.
  "tutorial.panel.codeTaken": "Copied into the game editor, waiting when you leave the track.",
  "tutorial.panel.codeRefused":
    "Your browser refused to store it. Copy the program out of the editor by hand to keep it.",
  "tutorial.button.restart": "Start over",
  "tutorial.button.takeCode": "Take this program into your own editor",
  "tutorial.button.takeCodeConfirm":
    "The game editor already holds a program of yours. Replace it with this one?",
  "tutorial.button.leave": "Leave for the challenges",
  "tutorial.bar.title.html": "Tutorial task {number} of {count}: {description}",
  "tutorial.finish.title": "The track is finished",
  "tutorial.finish.message":
    "Eight tasks, and the last of them was challenge 1: the same three floors, the same elevator, the same fifteen passengers in sixty seconds. The program in the editor solves it, and the panel has a button that copies it into your own editor — take it with you before you go.",
  "tutorial.finish.nextTask": "Next task",
  "tutorial.finish.toChallenges": "Go to challenge 1",
} as const satisfies Readonly<Record<string, string | PluralForms<"en">>>;
