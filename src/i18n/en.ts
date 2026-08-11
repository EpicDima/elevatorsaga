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
  "page.nav.label": "Help and reference",
  "page.nav.help": "Help",
  "page.nav.documentation": "Documentation",
  "page.nav.wiki": "Wiki & Solutions",
  "page.noscript":
    "Your browser does not appear to support JavaScript. This page contains a browser-based programming game implemented in JavaScript.",
  "page.world.label": "Building",
  "page.stats.label": "Simulation statistics",
  "page.stats.transported": "Transported",
  "page.stats.elapsedTime": "Elapsed time",
  "page.stats.transportedPerSec": "Transported/s",
  "page.stats.avgWaitTime": "Avg waiting time",
  "page.stats.maxWaitTime": "Max waiting time",
  "page.stats.moves": "Moves",
  "page.stats.movesTitle": "Number of floors that have been travelled by elevators",
  "page.hint.html":
    "In the editor: <kbd data-mod-key>Ctrl</kbd>+<kbd>Enter</kbd> applies your program. <kbd data-mod-key>Ctrl</kbd>+<kbd>S</kbd> saves it. <kbd>Tab</kbd> indents. <kbd>Esc</kbd> moves the focus back out.",
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
        var elevator = elevators[0]; // Let's use the first elevator

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
  "challenge.transportWithMaxWait.html":
    "Transport {people} and let no one wait more than {waitTime}",
  "challenge.transportWithinTimeWithMaxWait.html":
    "Transport {people} in {time} or less and let no one wait more than {waitTime}",
  "challenge.transportWithinMoves.html": "Transport {people} using {moves} or less",
  "challenge.demo": "Perpetual demo",
  "challenge.people.html": {
    one: "<span class='emphasis-color'>{count}</span> person",
    other: "<span class='emphasis-color'>{count}</span> people",
  },
  "challenge.timeLimit.html": {
    one: "<span class='emphasis-color'>{count}</span> second",
    other: "<span class='emphasis-color'>{count}</span> seconds",
  },
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
  "fitness.results": "Fitness avg wait times: {results}",
  "fitness.result": "{scenario}: {value}",
  "fitness.unknownValue": "?",
  "fitness.error": "Could not compute fitness due to error: {error}",
  "fitness.workerTimeout":
    "The fitness worker did not finish within {seconds} and was stopped. Does your program have a loop that never ends?",
  "fitness.workerFailed": "The fitness worker failed",
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
  "docs.play.apply.html":
    'Enter your code in the input window below the game view, and press the <span class="emphasis-color">Apply</span> button to start the challenge.<br /> You can increase or decrease the speed of time by pressing the {increase} and {decrease} buttons.',
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
    'These functions will then be called by the game during the challenge.<br /> <span class="emphasis-color">init</span> will be called when the challenge starts, and <span class="emphasis-color">update</span> repeatedly during the challenge.',
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
  "docs.api.floor.buttonStateChange.html":
    'Triggered when either call button at a floor was lit or cleared. The handler is passed the state of both buttons: an object with an <span class="emphasis-color">up</span> and a <span class="emphasis-color">down</span> property, each either <span class="emphasis-color">"activated"</span> or the empty string. It is a snapshot taken when the event fired, so holding on to it will not show you later presses.',
  "docs.api.floor.buttonStateChange.example.code": `floor.on("buttonstate_change", function(buttonStates) {
    if(buttonStates.up === "" && buttonStates.down === "") {
        // Nobody is waiting here any more?
    }
})`,
} as const satisfies Readonly<Record<string, string | PluralForms<"en">>>;
