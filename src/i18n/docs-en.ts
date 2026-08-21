/**
 * The reference pages' English text: what `documentation.html` says.
 *
 * Not read by anything the browser runs. The two reference pages are static
 * HTML, and this is the reference they are held to: `page.test.ts` compares
 * every passage of both of them against the message it was lifted from, which
 * is what keeps the English page and the Russian one one document in two
 * languages rather than two that drift.
 *
 * Hence a module of its own rather than a section of `en.ts`. A key in
 * `EN_MESSAGES` is downloaded by every player — the catalog is statically
 * imported by everything that calls `t()`, so it lands whole in the entry
 * chunk — and this text is read by a test and by nothing else. Nothing outside
 * the tests imports this file, so none of it reaches a bundle.
 *
 * `docs.basics.example.code` is the exception that stays in `en.ts`: the
 * completion popup inserts it.
 *
 * The suffix rules are `en.ts`'s, and `catalog.test.ts` enforces them here too:
 * `.html` is trusted markup, `.code` is example code whose comments alone are
 * translated, anything else is plain text.
 */

/** Everything the reference pages say, in English. */
export const EN_DOCS_MESSAGES = {
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
    "The goal is to transport people in an efficient manner.<br /> Depending on how well you do it, you can progress through the ever more difficult levels.<br /> Only the very best programs will be able to complete all the levels.",
  "docs.play.heading": "How to play",
  // The first thing under "How to play", because a reader who has arrived here
  // not knowing the API has already found the one page that assumes they do.
  // The address is written out rather than assembled from `tutorialLevels`: the
  // reference pages are static HTML with no script of their own, so the same
  // text has to be spellable by hand into both of them. `src/page.test.ts`
  // holds the pages and this key to the first level's real id.
  "docs.play.track.html":
    'If you have never written one of these programs before, start on the <a href="index.html#level=tutorial-1">learning track</a>, which is also the <span class="emphasis-color">Learning track</span> link at the top of the game. It is eight small buildings that introduce this API one mistake at a time: each hands you a program that loses, and asks you to find the one thing wrong with it, with hints and an explanation of what the run was actually doing.',
  "docs.play.start.html":
    'Enter your code in the input window below the game view, and press the <span class="emphasis-color">Start</span> button to run it. There is nothing to apply first: your program is saved as you type, and every run reads it afresh. While a run is going that button reads <span class="emphasis-color">Pause</span>, and <span class="emphasis-color">Start over</span> beside it throws the run away and begins the level again with whatever the editor holds by then.<br /> You can increase or decrease the speed of time by pressing the {increase} and {decrease} buttons.',
  "docs.play.statistics.html":
    'Beside the building is a panel that keeps score while a run is going. Eight of its rows need a word. <span class="emphasis-color">Moves</span> first. One move is counted each time a car crosses the halfway mark between one floor and the next, so a trip of three floors is three moves. A car that turns round mid-flight pays twice for the mark it crosses and re-crosses, and braking carries a car on across a mark it was turned back just short of. Three of the levels are judged on that number, totalled over every car in the building, as well as on the people delivered, so on those a car that shuttles about empty can lose the run. Under it, <span class="emphasis-color">Stops</span>, which counts something quite different. One stop is counted each time a car comes to rest at a floor and opens its doors, so a car sent to the floor it is already standing on counts another one. That trip of three floors is three moves and a single stop, and the two rows are worth reading against each other — a program that sends a car off to every call the moment it lights up shows many stops for few moves, and one that lets a car finish what it is already doing shows the reverse. Then <span class="emphasis-color">People per stop</span>. Everyone who got in or out, over the stops counted above, so opening the doors where nobody is waiting brings it down. Both ends of a journey count here, the boarding and the getting out, so the figure sits higher than the number a lift engineer would quote for the same building; what it is good for is the direction it moves in rather than the size of it. Then the clocks. <span class="emphasis-color">Avg delivery time</span> and <span class="emphasis-color">Max delivery time</span> both run from the moment a passenger appears in the building to the moment they step out of a car at the floor they asked for, so the ride counts in them as much as the wait for it does: somebody who walks straight into a car already standing at their floor, and waits not one second for it, still adds every second of a nineteen-floor journey to both. Nine of the game\'s levels and two of the tutorial ones are judged on the second of them, which is the largest total any one passenger has reached — it keeps climbing while somebody is still on their way, and once reached it never comes down again. Between the two of them sit the two halves that neither one names. <span class="emphasis-color">Avg wait for a car</span> first. The clock starts when a passenger appears and stops when a car takes them, and the row below it is the rest of the journey. Only the passengers a car has already reached are in that average, so it is not where somebody left standing on a floor turns up — the maximum is. The row below it is <span class="emphasis-color">Avg ride time</span>. The clock starts when a car takes a passenger and stops when they step out at their floor, so this and the wait above it add up to the delivery time. The three of them are the three spans the lift industry measures a real building by, and they only add up exactly once nobody is in flight: a passenger still riding has already put their wait into the one average and has nothing yet to put into the other. Last, <span class="emphasis-color">Avg load</span>. How full the cars were, averaged over the moves counted above, so a car standing still is not in the figure at all — parking costs nothing here, and in several of the levels it is the right thing to do. In an ordinary run the figure sits far below full, and that is not a fault to be fixed: cars are rarely full, and nothing in the game pays for filling them. Nor does a higher figure mean better play. Of three programs run on the same eighteen-floor building, the one that holds a car at its floor until it is nearly full before setting off got its cars to about 70% and delivered the fewest people of the three, at nearly twice the wait of the best of them, while the program that delivered the most carried the emptiest cars of all, under a half. What the number is good for is comparing two programs that deliver about the same: at equal numbers delivered, the one with the higher load did it with fewer trips that carried nobody.',
  "docs.play.shortcuts.html":
    'Inside the editor, <kbd data-mod-key>Ctrl</kbd>+<kbd>Enter</kbd> starts the level again with what you have written, which is what the <span class="emphasis-color">Start over</span> button does; <kbd data-mod-key>Ctrl</kbd>+<kbd>S</kbd> writes the program to storage at once instead of waiting for the autosave, and keeps your browser\'s own save dialog out of the way; <kbd>Tab</kbd> indents, and <kbd>Esc</kbd> moves the focus back out of the editor.',
  "docs.play.debugging.html":
    'If your program contains an error, you can use the developer tools in your web browser to try and debug it. If you want to start over with the code, press the <span class="emphasis-color">Reset code</span> button. This will revert the code to a working but simplistic implementation, and an <span class="emphasis-color">Undo reset</span> button appears beside it for as long as there is something to bring back.<br /> If you have a favorite text editor, such as <a href="https://www.sublimetext.com/">Sublime Text</a>, feel free to edit the code there and paste it into the game editor.<br /> Your code is automatically saved in your local storage, so don\'t worry - it doesn\'t disappear if you accidentally close the browser.',

  // ----------------------------------------------- the help page: the basics

  "docs.basics.heading": "Basics",
  "docs.basics.declare.html":
    'Your code must declare an object containing at least two functions called <span class="emphasis-color">init</span> and <span class="emphasis-color">update</span>. Like this:',
  // The example this section walks through is `docs.basics.example.code`, in
  // `en.ts`: the completion popup inserts the same text, so that one message
  // ships with the game.
  "docs.basics.called.html":
    'These functions will then be called by the game during the level.<br /> <span class="emphasis-color">init</span> runs once, on the first frame of the run rather than at the moment you apply your code, and <span class="emphasis-color">update</span> runs on that same frame and on every simulated step after it — 100 times per game second, on a fixed schedule tied to game time rather than to how often the browser draws. That means <span class="emphasis-color">dt</span> is always the same value, and two runs of the same seed and the same play take the exact same sequence of steps whether the browser is fast or slow. Both functions are handed the same two arrays — one holding every elevator in the building, one holding every floor — so <span class="emphasis-color">elevators.length</span> is how many cars you have to work with, and neither array is replaced between calls. Both are called on the object you declared, so <span class="emphasis-color">this</span> inside them is that object: anything your program needs to remember from one frame to the next can live on <span class="emphasis-color">this</span> instead of in a variable outside. That holds as long as you write them with <span class="emphasis-color">function</span> — an arrow function keeps the <span class="emphasis-color">this</span> of wherever it was written, which here is the page rather than your object.',
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
    'You rarely need to remove listeners: the elevators and floors are thrown away when a level restarts, and your <span class="emphasis-color">init</span> is called afresh on the new ones. Removing is useful when you want a listener to apply only for a while.',

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
  "docs.api.elevator.servedFloors":
    "Gets the floors this elevator serves, as an array in ascending order. In a zoned building an elevator only carries passengers between the floors of its own zone, and its arrival clears no call button elsewhere. goToFloor will still send it anywhere, but such a trip carries nobody and still costs moves. An elevator with no zone of its own reports every floor in the building.",
  "docs.api.elevator.servedFloors.example.code": `if(elevator.servedFloors().includes(floorNum)) {
    // Sending it anywhere else is a trip that carries nobody.
    elevator.goToFloor(floorNum);
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
    'Triggered when someone has pressed either call button at a floor. Note that passengers will press the button again if they fail to enter an elevator. The handler is passed the direction that was asked for, either "up" or "down", and the floor the button was pressed on. It always follows the up_button_pressed or down_button_pressed event for the same press, never precedes it, so a program listening for both hears about that press twice.',
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
} as const satisfies Readonly<Record<string, string>>;

/** Every message the reference pages are answerable for, by name. */
export type DocsMessageKey = keyof typeof EN_DOCS_MESSAGES;

/**
 * A complete translation of the reference pages.
 *
 * The counterpart to `MessageCatalog` for text no locale renders: plain strings
 * throughout, since a page that says the same thing to one reader and to many
 * has nothing to pluralise.
 */
export type DocsCatalog = Readonly<Record<DocsMessageKey, string>>;
