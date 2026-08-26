import type { PluralForms } from "./format.ts";

/**
 * `.html` values are trusted markup, `.code` values are translated only in
 * their `//` comments, and object values are plural forms chosen by
 * `Intl.PluralRules`.
 */
export const EN_MESSAGES = {
  // The game screen (index.html).

  "page.title": "Elevator Saga - the elevator programming game",
  "page.description":
    "Elevator Saga is a programming game: write JavaScript to transport people efficiently.",
  "page.imageAlt":
    "Four elevators carrying people between six floors, with the JavaScript program driving them in the editor below.",
  "page.skipLink": "Skip to the code editor",
  // Not translated: this is the game's name.
  "page.brand": "Elevator Saga",
  "page.language.label": "Language",
  "page.noscript":
    "Your browser does not appear to support JavaScript. This page contains a browser-based programming game implemented in JavaScript.",
  "page.world.label": "Building",
  "page.stats.label": "Simulation statistics",
  "page.stats.transported": "Transported",
  "page.stats.transportedTitle":
    "How many passengers have reached the floor they asked for, so somebody still riding is not counted yet",
  "page.stats.elapsedTime": "Elapsed time",
  "page.stats.elapsedTimeTitle":
    "The run's own clock, which the speed control makes pass faster or slower than real time, and which every other time in this panel is measured in",
  "page.stats.transportedPerSec": "Transported/s",
  "page.stats.transportedPerSecTitle":
    "Everyone delivered so far, over the time the run has taken, so it is the whole run's average rather than the rate at this moment",
  // The full journey (spawn to delivery), not just the wait; see
  // World's avgWaitTime/maxWaitTime.
  "page.stats.avgWaitTime": "Avg delivery time",
  "page.stats.avgWaitTimeTitle":
    "The whole journey, from a passenger appearing in the building to stepping out at the floor they asked for, averaged over those already delivered, so the ride counts in it as much as the wait does",
  "page.stats.avgPickupTime": "Avg wait for a car",
  "page.stats.avgPickupTimeTitle":
    "The clock starts when a passenger appears and stops when a car takes them, and the row below it is the rest of the journey",
  "page.stats.avgRideTime": "Avg ride time",
  "page.stats.avgRideTimeTitle":
    "The clock starts when a car takes a passenger and stops when they step out at their floor, so this and the wait above it add up to the delivery time",
  "page.stats.maxWaitTime": "Max delivery time",
  "page.stats.maxWaitTimeTitle":
    "The longest any one passenger's whole journey has run, which keeps climbing while somebody is still on their way and never comes down again",
  "page.stats.moves": "Moves",
  "page.stats.movesTitle":
    "One move is counted each time a car crosses the halfway mark between one floor and the next",
  "page.stats.stops": "Stops",
  "page.stats.stopsTitle":
    "One stop is counted each time a car comes to rest at a floor and opens its doors, so a car sent to the floor it is already standing on counts another one",
  "page.stats.peoplePerStop": "People per stop",
  "page.stats.peoplePerStopTitle":
    "Everyone who got in or out, over the stops counted above, so opening the doors where nobody is waiting brings it down",
  "page.stats.avgLoad": "Avg load",
  "page.stats.avgLoadTitle":
    "How full the cars were, averaged over the moves counted above, so a car standing still is not in the figure at all",

  // The building view.

  "game.floor.callUp": "Call an elevator going up from floor {floor}",
  "game.floor.callDown": "Call an elevator going down from floor {floor}",
  "game.elevator.label": "Elevator {number}",
  "game.elevator.floorButton": "Go to floor {floor}",
  // The elevator's state line always says exactly one of these three.
  "game.buildingStage.elevatorState.movingUp": "Moving up",
  "game.buildingStage.elevatorState.movingDown": "Moving down",
  "game.buildingStage.elevatorState.stopped": "Stopped",
  "game.buildingStage.elevatorOccupancy": "Occupied: {occupied}/{capacity}",
  "game.buildingStage.elevatorServing.up": "Serving calls going up",
  "game.buildingStage.elevatorServing.down": "Serving calls going down",
  "game.buildingStage.elevatorServing.both": "Serving calls in both directions",
  "game.buildingStage.elevatorServing.none": "Not serving any calls",
  "game.buildingStage.elevatorPressed.none": "No floors requested",
  "game.buildingStage.elevatorPressed.some": "Requested floors: {floors}",
  "game.buildingStage.floorCard.title": "Floor {floor}",
  "game.buildingStage.floorCard.waiting": "Waiting: {count}",
  "game.buildingStage.floorCard.longestWait": "Longest wait: {time}",
  "game.buildingStage.floorCard.destinations.none": "No destinations chosen yet",
  "game.buildingStage.floorCard.destinations.some": "Heading to: {floors}",
  "game.statsPanel.waitingNow": "Waiting now",
  "game.statsPanel.waitingNowTitle":
    "How many passengers are standing on a floor at this moment with no car yet carrying them",
  "game.statsPanel.aboardNow": "Riding now",
  "game.statsPanel.aboardNowTitle":
    "How many passengers are inside a car at this moment, on their way",
  "game.statsPanel.more": "All figures",
  // Level tiles show a bare number; screen readers get this name instead.
  "game.level.nav.label": "Levels",
  "game.level.nav.link": "Level {number}",
  "game.levelSwitcher.prevLabel": "Previous level",
  "game.levelSwitcher.nextLabel": "Next level",
  "game.levelSwitcher.tutorialBlockLabel": "Learning",
  "game.levelSwitcher.otherBlockLabel": "Other",
  "game.levelSwitcher.sandboxLabel": "Sandbox",
  "game.levelSwitcher.skyscraperBlockLabel": "Skyscraper",
  "game.levelSwitcher.skyscraperTileLabel": "Skyscraper level {number}",
  "game.levelSwitcher.tutorialTileLabel": "Tutorial level {number}",
  // {tier} is a game.goalBar.tier.* name, only rendered once a medal is earned.
  "game.levelSwitcher.levelTileEarnedLabel": "Level {number}, {tier}",
  "game.levelSwitcher.skyscraperTileEarnedLabel": "Skyscraper level {number}, {tier}",
  "game.levelSwitcher.tutorialTileEarnedLabel": "Tutorial level {number}, {tier}",
  "game.levelSwitcher.tutorialTriggerLabel": "Lesson {number}",
  "game.levelSwitcher.skyscraperTriggerLabel": "Tower {number}",
  // Hidden when locateCodeError finds nothing for the player's exception.
  "game.editorPane.gotoLine": "Line {line} →",
  // {seed} is a token the player transcribes; it must render the same in every locale.
  "game.seed.label": "Seed",
  "game.seed.inputLabel": "This run's seed — type another one to play it",
  "game.seed.link": "Seed {seed}: put this run in the address bar",
  "game.seed.newDrawLink": "Seed {seed}: draw a new one and start again",
  "game.seed.invalid": "A seed can be up to 64 letters, digits, dots, hyphens or underscores.",
  "game.seed.helpSummary": "what a seed does",
  "game.seed.explanation":
    "The same seed brings the same passengers, in the same order — and, played the same way, the exact same run: every elevator movement, arrival and button press repeats exactly, whatever the browser's frame rate. The seed stays yours across restarts, reloads and levels until you type another one or draw one with the dice.",
  "game.seed.console": "Seed {seed} — the exact same run again, whatever the frame rate: {url}",
  "game.switchTheme.caption": "Theme",
  "game.switchTheme.system": "System",
  "game.switchTheme.light": "Light",
  "game.switchTheme.dark": "Dark",
  // Named onlyCode/onlyGame, not code/game: a bare "code" key would collide
  // with catalog.test.ts's reserved .code suffix.
  "game.switchLayout.caption": "Layout",
  "game.switchLayout.left": "Code left",
  "game.switchLayout.right": "Code right",
  "game.switchLayout.onlyCode": "Code only",
  "game.switchLayout.onlyGame": "Building only",
  "game.workspace.gamePane": "Simulation",
  "game.workspace.codePane": "Code editor",
  "game.workspace.splitter": "Editor width",
  "game.appBar.docsOpenLabel": "Help",
  "game.appBar.settingsLabel": "Settings",
  "game.appBar.hotkeysOpenLabel": "Hotkeys",
  "game.appBar.aboutCaption": "About",
  "game.appBar.aboutForkLabel": "This game",
  "game.appBar.aboutOriginalLabel": "Original",
  "game.appBar.aboutCopyright.html":
    'Elevator Saga © 2015 Magnus Wolffelt,<br /> © 2026 EpicDima,<br /> <a href="licenses.txt">MIT</a>',
  "game.hotkeys.title": "Keyboard shortcuts",
  "game.hotkeys.closeTitle": "Close window",
  "game.hotkeys.close": "Close",
  "game.hotkeys.startPause": "Start and pause",
  "game.hotkeys.startOver": "Start over",
  "game.hotkeys.switchLayout": "Switch layout",
  "game.hotkeys.openDocs": "Help",
  "game.hotkeys.openSettings": "Settings",
  "game.docs.title": "Help",
  "game.docs.searchPlaceholder": "Search: goToFloor, waiting, button…",
  "game.docs.clearSearch": "Clear search",
  "game.docs.closeTitle": "Close help",
  "game.docs.close": "Close",
  "game.docs.empty": "Nothing found",
  // step3 alone carries .html: it has an inline <b>, the other steps do not.
  "game.docs.guide.whatGame.heading": "What kind of game this is",
  "game.docs.guide.whatGame.body":
    "Elevators move through a building, and people wait on its floors: each one arrived on their own floor and wants to reach another. They press their own buttons. Nobody drives the elevators — a program you write does, instead. You can't move an elevator with the mouse, and that's the whole game: the only way to get people where they're going is to give the building a rule it can follow on its own.",
  "game.docs.guide.whatToDo.heading": "What to do",
  "game.docs.guide.whatToDo.step1":
    "Pick a level in the header. Each one has its own building — floors, elevator count, elevator capacity — and its own conditions.",
  "game.docs.guide.whatToDo.step2":
    "Write your program on the right. It subscribes to elevator and floor events: a button was pressed, an elevator went idle, we're passing a floor.",
  "game.docs.guide.whatToDo.step3.html":
    "Press <b>Start</b> and watch. A run can be paused, sped up — all the way to instant, where the outcome is computed at once — and started over: the building is the same every time, and people arrive by the same seed.",
  "game.docs.guide.whatToDo.step4":
    "Didn't work out? Adjust the rule and run again. Three code slots per level hold three different approaches, and you can switch between them on the fly.",
  "game.docs.guide.carArrows.heading": "The arrows on the car",
  "game.docs.guide.carArrows.html":
    "Each car carries two lit arrows — <b>up</b> and <b>down</b> lamps, the very ones <b>goingUpIndicator</b> and <b>goingDownIndicator</b> control. People on a floor watch them and only board if the elevator is headed their way: with the down lamp off, someone headed down just waits for the next one. Light both and everyone boards; a full elevator turns both off by itself. Who the elevator is carrying right now shows in the card that pops up on hover.",
  "game.docs.guide.readingResults.heading": "How to tell whether it worked",
  "game.docs.guide.readingResults.body":
    "The bars under the header show the level's condition: how many people to carry, in how much time, how many floors the elevators may travel past, and how many seconds people may wait. The tiles below track the same things in more detail — average delivery time, worst wait, elevator load — and chart how each one moved over the run. A level is cleared once everyone's been carried and no limit was broken.",
  "game.docs.guide.threeStars.heading": "Three stars",
  "game.docs.guide.threeStars.html":
    "Clearing a level earns bronze — that's exactly its own condition. Silver and gold come from <em>how</em> it was cleared: with room to spare, without running elevators empty, without making people wait. The card on the right, in the goal bar, shows exactly what each star needs — and which of them are being held right now. Some levels ask nothing beyond their own condition, and clearing one of those is gold outright. Stars gate nothing: every level is open from the first visit, and silver and gold stay on the list to come back for.",
  "game.docs.guide.tutorialLevels.heading": "The first levels come with an explanation",
  "game.docs.guide.tutorialLevels.body":
    "Tutorial levels have a lesson standing next to the building: step by step, what's happening, which event a program sees it through, and what answering it looks like. The hints open one at a time, and the last of them holds a working program with a button that copies it.",
  "game.docs.intro.heading": "What a program is made of",
  "game.docs.intro.example.code": `function init(elevators, floors) {
  // subscribe to events here
}

function update(dt, elevators, floors) {
  // called continuously while a run is in progress
}`,
  "game.docs.lead.html":
    "<code>elevator</code> is an elevator: all of them live in <code>elevators</code>. <code>floor</code> is a floor, and they're in <code>floors</code>. Any row below can be expanded — details and an example live underneath.",
  "game.apiRef.elevator.groupLabel": "Elevator",
  "game.apiRef.floor.groupLabel": "Floor",
  "game.apiRef.elevator.goToFloor.short": "Queues a floor for the elevator.",
  "game.apiRef.elevator.goToFloor.more":
    "The floor joins the end of the queue: the elevator gets to it once it has dealt with whatever was queued earlier. The same floor can be queued twice — and the elevator will stop there twice, so it's worth checking the queue before adding to it.",
  "game.apiRef.elevator.goToFloor.code": `// don't queue what's already queued
const wanted = floor.floorNum();
if (!elevator.destinationQueue.includes(wanted)) {
  elevator.goToFloor(wanted);
}`,
  "game.apiRef.elevator.goToFloorPriority.short":
    "The same, but first in the queue: the elevator goes there right away.",
  "game.apiRef.elevator.goToFloorPriority.more":
    "The second argument puts the floor at the front of the queue and pushes everything else back. It's how you pick up someone the elevator is passing anyway. Answer every call this way, though, and the queue never reaches its end — whoever is last in it waits forever.",
  "game.apiRef.elevator.goToFloorPriority.code": `elevator.on("passing_floor", (floorNum, direction) => {
  if (elevator.loadFactor() < 0.8 && waiting(floorNum, direction)) {
    elevator.goToFloor(floorNum, true);
  }
});`,
  "game.apiRef.elevator.stop.short":
    "Stops and drops the queue. The passengers inside won't thank you.",
  "game.apiRef.elevator.stop.more":
    "The elevator stops wherever it is, and the whole queue is cleared. Buttons pressed by the passengers inside stay pressed, though — the route has to be rebuilt after stop(), or people end up along for the ride.",
  "game.apiRef.elevator.stop.code": `elevator.stop();
// put back what was ordered from inside
for (const floorNum of elevator.getPressedFloors()) {
  elevator.goToFloor(floorNum);
}`,
  "game.apiRef.elevator.currentFloor.short": "The floor the elevator is on right now.",
  "game.apiRef.elevator.currentFloor.more":
    "A whole number, never a fraction: while the elevator is traveling between floors, this answers with whichever floor it last passed. destinationDirection() knows which way it's headed while that's true.",
  "game.apiRef.elevator.currentFloor.code": `const distance = Math.abs(elevator.currentFloor() - floor.floorNum());`,
  "game.apiRef.elevator.destinationQueue.short":
    "The floor queue. It's a plain array, and can be edited like one.",
  "game.apiRef.elevator.destinationQueue.more":
    "The first element is wherever the elevator is headed right now. Reading is free, and so is changing it — but an edit needs checkDestinationQueue() afterward: the elevator doesn't notice a change to the array by itself.",
  "game.apiRef.elevator.destinationQueue.code": `// drop repeats without touching the order
elevator.destinationQueue = elevator.destinationQueue.filter(
  (floorNum, index, all) => all.indexOf(floorNum) === index,
);
elevator.checkDestinationQueue();`,
  "game.apiRef.elevator.checkDestinationQueue.short": "Re-reads the queue after a manual edit.",
  "game.apiRef.elevator.checkDestinationQueue.more":
    "Needed in exactly one case: destinationQueue was changed directly. There's no need to call it after goToFloor() or stop() — they already do it themselves.",
  "game.apiRef.elevator.checkDestinationQueue.code": `elevator.destinationQueue.sort((a, b) => a - b);
elevator.checkDestinationQueue();`,
  "game.apiRef.elevator.getPressedFloors.short": "Which buttons are pressed inside the elevator.",
  "game.apiRef.elevator.getPressedFloors.more":
    "An array of floor numbers, ascending. These are the passengers' wishes, not a route — the elevator won't go there until the floor joins the queue. A button turns off once the doors have opened on that floor.",
  "game.apiRef.elevator.getPressedFloors.code": `elevator.on("stopped_at_floor", () => {
  for (const floorNum of elevator.getPressedFloors()) {
    elevator.goToFloor(floorNum);
  }
});`,
  "game.apiRef.elevator.loadFactor.short":
    "How full the elevator is: from 0 (empty) to 1 (packed).",
  "game.apiRef.elevator.loadFactor.more":
    "Counted by the passengers' weight, not by how many there are, so half the seats filled won't read as exactly 0.5. A threshold is usually given some slack: a full elevator won't take anyone regardless, and a call still gets answered.",
  "game.apiRef.elevator.loadFactor.code": `floor.on("up_button_pressed", () => {
  if (elevator.loadFactor() < 0.7) {
    elevator.goToFloor(floor.floorNum());
  }
});`,
  "game.apiRef.elevator.maxPassengerCount.short": "How many people fit inside it.",
  "game.apiRef.elevator.maxPassengerCount.more":
    'A fixed number, worth asking once in init. Elevators in the same building can carry different amounts — 4 seats and 10 seats, say — and once they do, "nearest" and "big enough" stop being the same elevator.',
  "game.apiRef.elevator.maxPassengerCount.code": `const big = elevators.filter((elevator) => elevator.maxPassengerCount() >= 8);`,
  "game.apiRef.elevator.destinationDirection.short":
    'Which way it\'s headed: "up", "down" or "stopped".',
  "game.apiRef.elevator.destinationDirection.more":
    'Answers from the first floor in the queue, not from the lamps outside — those are set by hand, and can say anything at all. An empty queue reads as "stopped".',
  "game.apiRef.elevator.destinationDirection.code": `if (elevator.destinationDirection() === "up" && floorNum > elevator.currentFloor()) {
  elevator.goToFloor(floorNum, true);
}`,
  "game.apiRef.elevator.goingUpIndicator.short":
    'The "up" lamp outside. With no argument, it just reads.',
  "game.apiRef.elevator.goingUpIndicator.more":
    "With an argument, it lights the lamp or turns it off; with none, it reports whether it's lit. People on a floor decide whether to board by these lamps: light both and everyone boards, light neither and nobody does.",
  "game.apiRef.elevator.goingUpIndicator.code": `elevator.goingUpIndicator(true);
elevator.goingDownIndicator(false);`,
  "game.apiRef.elevator.goingDownIndicator.short":
    'The "down" lamp. People decide whether to board by these lamps.',
  "game.apiRef.elevator.goingDownIndicator.more":
    'The same thing, downward. The pair is usually flipped at the turnaround: reach the top, turn off "up", turn on "down". Forget to, and the elevator fills with people headed the wrong way.',
  "game.apiRef.elevator.goingDownIndicator.code": `elevator.on("stopped_at_floor", (floorNum) => {
  const up = floorNum === 0;
  elevator.goingUpIndicator(up);
  elevator.goingDownIndicator(!up);
});`,
  "game.apiRef.elevator.idle.short": "The queue ran out — the elevator has nothing left to do.",
  "game.apiRef.elevator.idle.more":
    "Fires once, when the elevator reaches the last floor in its queue. Leave it unanswered and the elevator just sits wherever it stopped — and most waiting happens downstairs.",
  "game.apiRef.elevator.idle.code": `elevator.on("idle", () => {
  elevator.goToFloor(0);
});`,
  "game.apiRef.elevator.floorButtonPressed.short": "A passenger inside pressed a floor button.",
  "game.apiRef.elevator.floorButtonPressed.more":
    "The floor number arrives as the argument. The event itself changes nothing — until the floor is queued, the elevator won't go there, and the passenger just keeps riding along.",
  "game.apiRef.elevator.floorButtonPressed.code": `elevator.on("floor_button_pressed", (floorNum) => {
  elevator.goToFloor(floorNum);
});`,
  "game.apiRef.elevator.passingFloor.short": "Passing a floor — there's still time to stop for it.",
  "game.apiRef.elevator.passingFloor.more":
    'Fires just before the elevator draws level with the floor — the one place where goToFloor(floorNum, true) actually makes sense. direction is "up" or "down": which way the elevator is going, not which way the passenger wants.',
  "game.apiRef.elevator.passingFloor.code": `elevator.on("passing_floor", (floorNum, direction) => {
  if (elevator.getPressedFloors().includes(floorNum)) {
    elevator.goToFloor(floorNum, true);
  }
});`,
  "game.apiRef.elevator.stoppedAtFloor.short": "Stopped at a floor, doors open.",
  "game.apiRef.elevator.stoppedAtFloor.more":
    "Boarding and alighting have already happened by this point. A good place to reset the lamps and decide where to go next — especially if the queue is now empty.",
  "game.apiRef.elevator.stoppedAtFloor.code": `elevator.on("stopped_at_floor", (floorNum) => {
  elevator.goingUpIndicator(floorNum === 0);
  elevator.goingDownIndicator(floorNum !== 0);
});`,
  "game.apiRef.floor.floorNum.short": "The floor's number, counting up from zero at the bottom.",
  "game.apiRef.floor.floorNum.more":
    "The lowest floor is 0, the highest is floors.length - 1. Inside a floor's own handler, this is the only way to find out where the button was pressed — the number doesn't arrive with the event.",
  "game.apiRef.floor.floorNum.code": `floors.forEach((floor) => {
  floor.on("up_button_pressed", () => {
    elevators[0].goToFloor(floor.floorNum());
  });
});`,
  "game.apiRef.floor.upButtonPressed.short": 'The "up" button was pressed outside — a call upward.',
  "game.apiRef.floor.upButtonPressed.more":
    "Someone wants to go up. The event arrives on the floor, not on any elevator: which one answers the call is your decision. The button turns off once any elevator opens its doors on that floor — even if nobody actually boards it.",
  "game.apiRef.floor.upButtonPressed.code": `floor.on("up_button_pressed", () => {
  nearest(floor.floorNum()).goToFloor(floor.floorNum());
});`,
  "game.apiRef.floor.downButtonPressed.short": 'The "down" button was pressed outside.',
  "game.apiRef.floor.downButtonPressed.more":
    "The same thing, downward. If direction doesn't matter yet, both events can be subscribed in one line — space-separated.",
  "game.apiRef.floor.downButtonPressed.code": `floor.on("up_button_pressed down_button_pressed", () => {
  elevators[0].goToFloor(floor.floorNum());
});`,
  "game.timeScale.label": "Run speed",
  "game.timeScale.decrease": "Slower",
  "game.timeScale.increase": "Faster",
  "game.timeScale.value": "{value}x",
  "game.timeScale.valueTitle": "Run speed: {value}",
  "game.timeScale.instant": "∞x",
  "game.timeScale.instantTitle": "Instantly: the run is counted straight through to its result",
  // The label always names what happens next: Start, Pause or Resume.
  "game.button.start": "Start",
  "game.button.pause": "Pause",
  "game.button.resume": "Resume",
  "game.button.startAgainTitle": "Run it again from the beginning",
  "game.button.startOver": "Start over",
  "game.button.startOverTitle": "Start the run from the very beginning",
  "game.button.resetCode": "Reset code",
  "game.button.undoResetCode": "Undo reset",
  "game.button.resetCodeTitle": "Put the level's own starting program back in this slot",
  "game.button.undoResetCodeTitle": "Bring back the program this slot held before the reset",
  "game.button.runningInstantly": "Crunching...",
  "game.feedback.success.title": "Success!",
  "game.feedback.success.message": "Level completed",
  "game.feedback.failure.title": "Level failed",
  "game.feedback.failure.message": "Maybe your program needs an improvement?",
  // {tier} is a game.goalBar.tier.* name.
  "game.feedback.tierEarned": "Level stars: {tier}",
  "game.feedback.next": "Next level",
  "game.feedback.dismiss": "Got it",
  // {needs} is a formatList of game.feedback.more.need.html entries.
  "game.feedback.more.silver.html": "For silver: {needs}",
  "game.feedback.more.gold.html": "For gold: {needs}",
  "game.feedback.more.need.html": "{req} (now {now})",
  "game.codeStatus": "There is an error in your program:",

  "game.goalBar.caption.maxPickupTime": "Max wait for a car",
  "game.goalBar.unit.seconds": " s",
  "game.goalBar.unit.floors": " fl.",
  "game.goalBar.tier.bronze": "Bronze",
  "game.goalBar.tier.silver": "Silver",
  "game.goalBar.tier.gold": "Gold",
  "game.goalBar.trigger.titleNone": "Level stars: none yet. Open requirements",
  "game.goalBar.trigger.titleEarned": "Level stars: {tier}. Open requirements",
  "game.goalBar.floorBudget.html": {
    one: "{count} floor",
    other: "{count} floors",
  },
  "game.goalBar.stopBudget.html": {
    one: "{count} stop",
    other: "{count} stops",
  },
  "game.goalBar.req.transportedCounter.html": "transport {people}",
  "game.goalBar.req.elapsedTime.html": "finish within {time}",
  // Measures spawn-to-delivery, not a wait; see page.stats.avgWaitTime.
  "game.goalBar.req.maxWaitTime.html": "deliver everyone within {time}",
  "game.goalBar.req.avgWaitTime.html": "average delivery no later than {time}",
  "game.goalBar.req.moveCount.html": "elevators travel no more than {floors}",
  "game.goalBar.req.stopCount.html": "elevators stop no more than {stops}",
  "game.goalBar.req.avgLoadFactorOnMove.html": "elevators run {percent} full or more",
  "game.goalBar.req.transportedPerSec.html": "at least {rate} people per second",
  "game.goalBar.req.avgPeoplePerStop.html": "at least {rate} people per stop",
  "game.goalBar.req.maxPickupTime.html": "never leave anyone waiting more than {time} for a car",
  "game.goalBar.req.avgPickupTime.html": "average wait for a car no more than {time}",
  "game.goalBar.req.avgRideTime.html": "average ride no more than {time}",

  // The editor (src/ui/editor.ts).

  "editor.label": "Elevator program",
  "editor.storageRefused":
    "Not saved — this browser will not store it. Your program is here until you close the tab.",
  "editor.confirmReset": "Do you really want to reset to the default implementation?",
  "editor.confirmUndoReset": "Do you want to bring back the code as before the last reset?",
  "editor.slot.tablist.label": "Code slots",
  // "Draft," not "version": there is no history, just three slots.
  "editor.slot.tab.label": "Code {number}",
  "editor.slot.tab.title": "Draft {number}",
  "editor.defaultCode.code": `function init(elevators, floors) {
    const elevator = elevators[0]; // Let's use the first elevator

    // Whenever the elevator is idle (has no more queued destinations) ...
    elevator.on("idle", function() {
        // let's go to all the floors (or did we forget one?)
        elevator.goToFloor(0);
        elevator.goToFloor(1);
    });
}

function update(dt, elevators, floors) {
    // Called on every tick — use it or leave it empty, both are fine
}
`,

  // Level goal sentences (src/game/levels.ts); counted phrases are separate
  // keys so each can carry its own language's plural forms.

  "level.transportWithinTime.html": "Transport {people} in {time} or less",
  "level.transportWithMaxWait.html":
    "Transport {people} and let no one take more than {waitTime} to be delivered",
  "level.transportWithinTimeWithMaxWait.html":
    "Transport {people} in {time} or less and let no one take more than {waitTime} to be delivered",
  "level.transportWithinMoves.html": "Transport {people} using {moves} or less",
  "level.transportWithinMovesWithMaxWait.html":
    "Transport {people} using {moves} or less and let no one take more than {waitTime} to be delivered",
  "level.people.html": {
    one: "<span class='emphasis-color'>{count}</span> person",
    other: "<span class='emphasis-color'>{count}</span> people",
  },
  "level.timeLimit.html": {
    one: "<span class='emphasis-color'>{count}</span> second",
    other: "<span class='emphasis-color'>{count}</span> seconds",
  },
  // "one" never renders (values always carry a decimal); kept for symmetry.
  "level.waitLimit.html": {
    one: "<span class='emphasis-color'>{count}</span> second",
    other: "<span class='emphasis-color'>{count}</span> seconds",
  },
  "level.moveLimit.html": {
    one: "<span class='emphasis-color'>{count}</span> elevator move",
    other: "<span class='emphasis-color'>{count}</span> elevator moves",
  },

  "level.sandbox.html":
    "Sandbox: {floors}, {elevators} of {capacityLabel} {capacities}, {spawnRate}. No goal, so the run never ends",
  "level.sandbox.floors.html": {
    one: "<span class='emphasis-color'>{count}</span> floor",
    other: "<span class='emphasis-color'>{count}</span> floors",
  },
  "level.sandbox.elevators.html": {
    one: "<span class='emphasis-color'>{count}</span> elevator",
    other: "<span class='emphasis-color'>{count}</span> elevators",
  },
  "level.sandbox.capacityLabel": {
    one: "capacity",
    other: "capacities",
  },
  // Deliberately not inflected: both forms are the same string today.
  "level.sandbox.spawnRate.html": {
    one: "<span class='emphasis-color'>{count}</span> people per second",
    other: "<span class='emphasis-color'>{count}</span> people per second",
  },

  // The completion popup; only the info lines are prose.

  "completion.events.on":
    "Register a listener. Several event names separated by spaces register the same listener for all of them, and it is then called with the name of the event that fired as its first argument.",
  "completion.events.once":
    "Register a listener that runs at most once and is then removed. Takes a single event name.",
  "completion.events.one":
    "The older name for once, and the one the original game gave you. Same behavior, single event name as well.",
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
    "Gets or sets the going up indicator, which will affect passenger behavior when stopping at floors.",
  "completion.elevator.goingDownIndicator":
    "Gets or sets the going down indicator, which will affect passenger behavior when stopping at floors.",
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
  "completion.elevator.servedFloors":
    "Gets the floors this elevator serves, as an array in ascending order. In a zoned building an elevator only carries passengers between the floors of its own zone, and its arrival clears no call button elsewhere. goToFloor will still send it anywhere, but such a trip carries nobody and still costs moves. An elevator with no zone of its own reports every floor in the building.",
  "completion.elevator.takeRequest":
    "Books this elevator for a journey somebody asked for, in a building where passengers announce a destination instead of pressing a call button. The people waiting on the first floor for the second one will board this elevator and no other, whichever way its indicators point. Booking does not move the elevator: send it with goToFloor, first to fetch them and then to where they are going. Returns false when there is no such journey to take, because nobody is waiting for it or because this elevator does not serve both ends of it.",
  "completion.floor.floorNum": "Gets the floor number of the floor object.",
  "completion.floor.pendingDestinations":
    "Gets the journeys people on this floor have asked for and are still waiting on, as an array in ascending floor order. Each entry has floorNum, where they are going, and waiting, how many of them are going there. What buttonStates is to a building with call buttons: everything the floor is asking for right now, rather than only what was announced when destination_requested fired. A request stays here until somebody boards an elevator for it, so this is where you find a request you booked an elevator for and then never sent it to fetch. Empty in a building with call buttons.",
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
  "completion.floor.event.destinationRequested":
    "Triggered when someone at a floor has asked to be taken to another floor, in a building whose passengers announce a destination instead of pressing a call button. The handler is passed the floor they want to reach and the floor they are waiting on.",
  "completion.global.skeleton":
    "Your code must declare a function called init. It can declare update alongside it, and anything else it needs.",
  "completion.global.init":
    "Called when the level starts. Normally you will put most of your code in here, to set up event listeners and logic.",
  "completion.global.update":
    "Called repeatedly during the level, at a fixed rate of 100 times per game second. dt is always that fixed step. Declaring it is optional.",
  "completion.initSkeleton.code": `function init(elevators, floors) {
    // Do stuff with the elevators and floors, which are both arrays of objects
}`,
  "completion.updateSkeleton.code": `function update(dt, elevators, floors) {
    // Do more stuff with the elevators and floors
}`,

  // The fitness benchmark (src/app/fitness.ts).

  "fitness.measuring": "Measuring fitness...",
  "fitness.results": "Fitness avg delivery times: {results}",
  "fitness.result": "{scenario}: {value}",
  "fitness.unknownValue": "?",
  "fitness.error": "Could not compute fitness due to error: {error}",
  "fitness.workerTimeout":
    "The fitness worker did not finish within {seconds} and was stopped. Does your program have a loop that never ends?",
  "fitness.workerFailed": "The fitness worker failed",
  "fitness.workerOutOfMemory":
    "The fitness worker ran out of memory and was stopped. Is your program keeping something that grows with every passenger?",
  "fitness.scenario.small": "Small scenario",
  "fitness.scenario.medium": "Medium scenario",
  "fitness.scenario.large": "Large scenario",

  // Error banner text; API names and player-passed values stay in English.

  "error.code.noInit": "Code must contain an init function",
  // update is optional, so this is only ever about one that was declared as something else.
  "error.code.updateNotFunction": "Code declares update as something other than a function",
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

  // The one help-page string the game itself renders; the rest is in docs-en.ts.

  "docs.basics.example.code": `function init(elevators, floors) {
    // Do stuff with the elevators and floors, which are both arrays of objects
}

function update(dt, elevators, floors) {
    // Do more stuff with the elevators and floors
    // dt is always the same fraction of a game second: update runs 100 times per
    // simulated second, however fast or slow the browser is actually drawing
}`,

  // Tutorial levels (src/game/tutorial.ts). Every per-level key ends in
  // .html, even plain text, since the panel builds key names by
  // interpolating the level and hint number into a fixed suffix.

  "tutorial.level1.title": "The elevator that goes nowhere",
  "tutorial.level1.goal":
    "Make the elevator visit both floors of this building and deliver 10 passengers within 60 seconds.",
  "tutorial.level1.hint1.html":
    "Look at the building rather than at the code. The elevator is standing on floor 0, and floor 0 is the only thing in its queue. How many floors does this building have?",
  "tutorial.level1.hint2.html":
    'Floors are numbered from zero, so the top floor here is <span class="emphasis-color">1</span>. The same handler needs one more line beside the one already in it.',
  "tutorial.level1.hint3.html":
    'The answer: add <span class="emphasis-color">elevator.goToFloor(1);</span> after the line that is already there, so that every time the elevator falls idle it queues both floors.',
  "tutorial.level1.explanation.html":
    "goToFloor does not drive anywhere. It appends the floor to the end of destinationQueue and calls checkDestinationQueue, and the elevator works through that queue on its own. So goToFloor(0) while the car is already on floor 0 is a legal trip of zero length: the car arrives where it stands, opens its doors, people get in, the queue is empty again, idle fires again, and the same thing happens again. That is why the car fills up while the moves counter stays at zero. A passenger boards on arrival and gets out on the floor they asked for, and this elevator never reaches it. One more thing worth saying out loud: a floor number outside the building is not an error, it is quietly clamped to the nearest real floor. Somebody who counts floors from one writes goToFloor(2) here and wins as well, because 2 becomes 1.",

  "tutorial.level1.startingCode.code": `function init(elevators, floors) {
    const elevator = elevators[0];

    elevator.on("idle", function() {
        // TODO: this building has two floors, and the elevator only visits one
        elevator.goToFloor(0);
    });
}

function update(dt, elevators, floors) {
}
`,
  "tutorial.level1.solutionCode.code": `function init(elevators, floors) {
    const elevator = elevators[0];

    elevator.on("idle", function() {
        elevator.goToFloor(0);
        elevator.goToFloor(1);
    });
}

function update(dt, elevators, floors) {
}`,

  "tutorial.level2.title": "The same loop, written by hand",
  "tutorial.level2.goal":
    "Write the handler that sends the elevator round all three floors, and deliver 15 passengers within 60 seconds.",
  "tutorial.level2.hint1.html":
    "Everything you need was on the first tutorial level: you saw it there, you just did not write it. The event that fires when the elevator has run out of destinations is called idle.",
  "tutorial.level2.hint2.html":
    'A subscription looks like <span class="emphasis-color">elevator.on("idle", …)</span> — the name of the event as a string, the handler as a function. Inside the handler goes one goToFloor call per floor of the building.',
  "tutorial.level2.hint3.html":
    'The answer: subscribe to <span class="emphasis-color">idle</span> and queue floors 0, 1 and 2 inside the handler, the way tutorial level 1 did it for two floors.',
  "tutorial.level2.explanation.html":
    "init is called once, on the first frame of the run and before the world has taken a single step, and all it normally does is subscribe to events. The first idle is sent by the game itself, on the line right after your init returns, so subscribing is enough to set the whole thing going. The other function, update(dt, elevators, floors), is called on every simulated tick instead — 100 times a game second. The track never uses it, and that is deliberate: asking the building about its state on every tick gives worse programs than answering the events it sends you. Worse, not forbidden — polling will get you through any level on this track.",

  "tutorial.level2.startingCode.code": `function init(elevators, floors) {
    const elevator = elevators[0];

    // TODO: send the elevator round all three floors, over and over
}

function update(dt, elevators, floors) {
}
`,
  "tutorial.level2.solutionCode.code": `function init(elevators, floors) {
    const elevator = elevators[0];

    elevator.on("idle", function() {
        elevator.goToFloor(0);
        elevator.goToFloor(1);
        elevator.goToFloor(2);
    });
}

function update(dt, elevators, floors) {
}`,

  "tutorial.level3.title": "The buttons inside the car",
  "tutorial.level3.goal":
    "Take the people who are already aboard where they asked to go, and deliver 15 passengers within 60 seconds.",
  "tutorial.level3.hint1.html":
    "The floor buttons inside the car are lit, which means the game has already announced them. The events an elevator sends are listed in the editor completion popup and on the help page.",
  "tutorial.level3.hint2.html":
    'The event is <span class="emphasis-color">floor_button_pressed</span>, and the floor that was pressed arrives as the argument of the handler.',
  "tutorial.level3.hint3.html":
    'The answer: subscribe to <span class="emphasis-color">floor_button_pressed</span> on the elevator and send it to the floor the handler was given. Leave the idle handler where it is.',
  "tutorial.level3.explanation.html":
    "A passenger who has got in presses their own floor, and the game reports it with floor_button_pressed, carrying the floor number as the argument. The lit buttons can also be read by polling them yourself, with getPressedFloors(), but reacting to the event is the habit worth building. Notice that the goToFloor(0) in the idle handler is no longer in anybody's way: now that the cabin buttons are answered, it simply means the car goes back to the ground floor when it has nothing else to do.",

  "tutorial.level3.startingCode.code": `function init(elevators, floors) {
    const elevator = elevators[0];

    elevator.on("idle", function() {
        elevator.goToFloor(0);
    });

    // TODO: they are already aboard and have already pressed their floors
}

function update(dt, elevators, floors) {
}
`,
  "tutorial.level3.solutionCode.code": `function init(elevators, floors) {
    const elevator = elevators[0];

    elevator.on("idle", function() {
        elevator.goToFloor(0);
    });

    elevator.on("floor_button_pressed", function(floorNum) {
        elevator.goToFloor(floorNum);
    });
}

function update(dt, elevators, floors) {
}`,

  "tutorial.level4.title": "The queue nobody read",
  "tutorial.level4.goal":
    "Find the one line this program is missing and deliver 15 passengers within 60 seconds.",
  "tutorial.level4.hint1.html":
    "Watch the elevator for twenty seconds. It is not merely standing still: nobody is getting in. So it has never once arrived.",
  "tutorial.level4.hint2.html":
    'The queue is not empty, but the elevator knows nothing about it. Once <span class="emphasis-color">destinationQueue</span> has been changed by hand, the game has to be told, and the method that tells it is in the list of the elevator methods.',
  "tutorial.level4.hint3.html":
    'The answer is one line: call <span class="emphasis-color">elevator.checkDestinationQueue();</span> straight after the assignment, inside the same idle handler.',
  "tutorial.level4.explanation.html":
    "A full car standing still and an empty car standing still differ the way an elevator that arrived and opened its doors differs from an elevator that never arrived at all. Boarding happens on arrival, and nowhere else. Someone who presses a button beside a standing car usually nudges it: the game re-offers the floor to the car with goToFloor(floor, true), and on tutorial levels 1 to 3 that is what kept filling the cabin. Here the nudge does nothing. The queue is not empty, it holds 0, 1, 2, 3, and goToFloor drops a request that equals the adjacent end of a non-empty queue before it ever gets as far as checking the queue: floor 0 is asked for, floor 0 is already at the head, and the call returns. The car stands there for the rest of the run. goToFloor calls checkDestinationQueue for you; assigning the queue does not.",

  "tutorial.level4.startingCode.code": `function init(elevators, floors) {
    const elevator = elevators[0];

    // Somebody rewrote the round trip as a queue.
    elevator.on("idle", function() {
        elevator.destinationQueue = [0, 1, 2, 3];
    });

    elevator.on("floor_button_pressed", function(floorNum) {
        elevator.goToFloor(floorNum);
    });
}

function update(dt, elevators, floors) {
}
`,
  "tutorial.level4.solutionCode.code": `function init(elevators, floors) {
    const elevator = elevators[0];

    elevator.on("idle", function() {
        elevator.destinationQueue = [0, 1, 2, 3];
        elevator.checkDestinationQueue();
    });

    elevator.on("floor_button_pressed", function(floorNum) {
        elevator.goToFloor(floorNum);
    });
}

function update(dt, elevators, floors) {
}`,

  "tutorial.level5.title": "The building grew",
  "tutorial.level5.goal":
    "Send the elevator where it is actually called: deliver 15 passengers, and let nobody's delivery take longer than 37 seconds.",
  "tutorial.level5.hint1.html":
    "The trouble is not how fast the elevator goes, it is that it goes to floors where nobody is standing. Who in this game knows that somebody is waiting? The second argument of init has not been used once so far.",
  "tutorial.level5.hint2.html":
    'Walk the floors with <span class="emphasis-color">floors.forEach</span> and subscribe each one to <span class="emphasis-color">up_button_pressed</span> and <span class="emphasis-color">down_button_pressed</span>. A floor knows its own number: <span class="emphasis-color">floor.floorNum()</span>. Once the calls are answered the sweep is no longer needed — delete it.',
  "tutorial.level5.hint3.html":
    'The answer: keep the <span class="emphasis-color">floor_button_pressed</span> handler, throw the sweep out entirely, and inside <span class="emphasis-color">floors.forEach</span> subscribe to both call buttons, each of them sending the elevator to <span class="emphasis-color">floor.floorNum()</span>.',
  "tutorial.level5.explanation.html":
    'A blind sweep does not scale: its worst waiting time is the length of one lap, and the lap grows with the building. Floors can call an elevator themselves. Both events hand the floor over as the argument, so floor.floorNum() can come from the argument or from the closure, whichever reads better. Subscribing to both events in one line is possible — floor.on("up_button_pressed down_button_pressed", …) — but then the first argument is the name of the event that fired and the floor moves along into second place; that is why there are two separate handlers here. And to be honest about the result: the new program makes more moves than the sweep did, not fewer. It wins by no longer carrying air.',

  "tutorial.level5.startingCode.code": `function init(elevators, floors) {
    const elevator = elevators[0];

    elevator.on("idle", function() {
        elevator.destinationQueue = [0, 1, 2, 3, 4, 5, 6, 7, 8];
        elevator.checkDestinationQueue();
    });

    elevator.on("floor_button_pressed", function(floorNum) {
        elevator.goToFloor(floorNum);
    });

    // TODO: ask the floors who wants an elevator instead of visiting them all
}

function update(dt, elevators, floors) {
}
`,
  "tutorial.level5.solutionCode.code": `function init(elevators, floors) {
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
}

function update(dt, elevators, floors) {
}`,

  "tutorial.level6.title": "The elevator that lies to its passengers",
  "tutorial.level6.goal":
    "Work out why half the building refuses to board, and deliver 15 passengers with nobody's delivery taking longer than 28 seconds.",
  "tutorial.level6.hint1.html":
    "Do not watch the counters, watch the call arrows. One of them lights up partway through the run and never goes out again. Which way was the person who pressed it planning to go?",
  "tutorial.level6.hint2.html":
    "An elevator whose going-down indicator is off is telling passengers that it will not go down, and they let it pass. Both indicators are on to begin with.",
  "tutorial.level6.hint3.html":
    'The answer: <span class="emphasis-color">elevator.goingDownIndicator(true);</span> instead of <span class="emphasis-color">false</span>. Deleting both indicator lines gives exactly the same run, because a car is built with both of them lit. Switching both of them off is a different program altogether, and one that nobody boards at all.',
  "tutorial.level6.explanation.html":
    "A passenger only gets into a car that suits the trip they are making: the game asks isSuitableForTravelBetween, and that looks at the indicators. A passenger turned away presses the call button again. The arrow stays lit for a separate reason, and it is the same reason the symptom is visible at all: an arriving elevator clears only the call buttons that correspond to the indicators it has lit, so a car with the down arrow dark physically cannot clear a call to go down. Worse, a standing car is not re-offered either — the game nudges a standing car only when its indicator matches the direction of the call. Both indicators are on to begin with, so those two lines fix nothing. They only break.",

  "tutorial.level6.startingCode.code": `function init(elevators, floors) {
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
}

function update(dt, elevators, floors) {
}
`,
  "tutorial.level6.solutionCode.code": `function init(elevators, floors) {
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
}

function update(dt, elevators, floors) {
}`,

  "tutorial.level7.title": "The second elevator",
  "tutorial.level7.goal": "Put both elevators to work and deliver 28 passengers within 60 seconds.",
  "tutorial.level7.hint1.html":
    "There are people sitting in the second elevator and it is going nowhere: nobody has told it anything. How many times does this program say elevators[0]?",
  "tutorial.level7.hint2.html":
    'Register the cabin button handler inside <span class="emphasis-color">elevators.forEach</span>, so that every car listens to its own buttons. A call from a floor has to pick a car: the least loaded one, by <span class="emphasis-color">loadFactor()</span>, for instance.',
  "tutorial.level7.hint3.html":
    'The answer: a small function that walks <span class="emphasis-color">elevators</span> and returns the car with the lowest <span class="emphasis-color">loadFactor()</span>; the cabin button handler registered on every car through <span class="emphasis-color">elevators.forEach</span>; and both call buttons of every floor sending the chosen car to <span class="emphasis-color">floor.floorNum()</span>. Any rule that keeps both cars working clears this building.',
  "tutorial.level7.explanation.html":
    "elevators[0] is not the elevator, it is the first elevator. This building has two of them, and the last levels of the game have eight. A program written with elevators.forEach works with one car and with eight alike, and it is the program you will carry into the real levels. Choosing by loadFactor() is the cheapest sensible rule: 0 is empty, 1 is full. It is not the only rule that clears this building, anything that keeps both cars busy will do, but a rule you can check against the picture on screen is easier to debug.",

  "tutorial.level7.startingCode.code": `function init(elevators, floors) {
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
}

function update(dt, elevators, floors) {
}
`,
  "tutorial.level7.solutionCode.code": `function init(elevators, floors) {
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
}

function update(dt, elevators, floors) {
}`,

  "tutorial.level8.title": "From memory",
  "tutorial.level8.goal":
    "Write the program on an empty page and deliver 15 passengers within 60 seconds.",
  "tutorial.level8.hint1.html":
    "The program falls into two halves: telling a car where to go, and finding out that somebody is waiting for one. You have written both. Which of the two functions is called once, and which one on every frame?",
  "tutorial.level8.hint2.html":
    "The game announces the people inside a car and the people waiting on a floor with different events, and the two are subscribed in different places: on the elevator, and on every floor.",
  "tutorial.level8.hint3.html":
    'The answer is the program from tutorial level 7, unchanged — it works just as well with one elevator. Subscribe to <span class="emphasis-color">floor_button_pressed</span> on every car, subscribe to both call buttons on every floor, and send a car to <span class="emphasis-color">floor.floorNum()</span>. Write the whole of it: the half where a car simply parks at floor 0 and knows nothing but its own cabin buttons is the half that loses runs.',
  "tutorial.level8.explanation.html":
    "Nothing here is new, and that is the point. This is the building of level 1 and the bar of level 1, copied deliberately: three floors, one elevator, 15 passengers in 60 seconds. Win here and level 1 is already solved, by the very program now in the editor. The margin here is also the thinnest on the track, and that is not the track's doing: at 0.3 passengers a second the fifteenth passenger does not appear in the building until about the forty-seventh second of the sixty, so the minute is tighter than it looks. That is a property of level 1, and you have met it early.",

  "tutorial.level8.startingCode.code": `function init(elevators, floors) {
    // TODO: nothing here is new. You have written all of it already.
}

function update(dt, elevators, floors) {
}
`,
  // Same as level 7's answer -- level 8 asks for nothing new. tutorial.test.ts
  // checks the two stay equal in every locale.
  "tutorial.level8.solutionCode.code": `function init(elevators, floors) {
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
}

function update(dt, elevators, floors) {
}`,

  // "Tutorial level" (the track) and "level {number}" (the game) are named
  // separately so a player cannot read one for the other.

  "tutorial.panel.hintSummary": "Hint {number}",
  "tutorial.panel.explanationSummary": "Why this happens",
  "tutorial.solution.copy": "Copy this program",
  "tutorial.solution.copied": "Copied to your clipboard.",
  "tutorial.solution.copyFailed":
    "Your browser refused to copy it. Select the code above and copy it yourself.",
  "tutorial.finish.title": "The track is finished",
  "tutorial.finish.message":
    "Eight tutorial levels, and the last of them was level 1 of the game itself: the same three floors, the same elevator, the same fifteen passengers in sixty seconds. The program in the editor solves it. Level 1 opens with a program of its own, so copy this one out of the editor before you go if you would rather start from it.",
  "tutorial.finish.nextLevel": "Next tutorial level",
  "tutorial.finish.toLevels": "Go to level 1",

  // Skyscraper levels: one key per level, no hints or explanation. Only sky2,
  // sky8 and sky11 carry a title/briefing, where a new mechanic first
  // appears; briefings never quote a scored number.
  "skyscraper.sky1.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function callNextElevator(floor) {
        // TODO: one call, one car, one trip -- nobody is picked up on the way
        elevators[next].goToFloor(floor.floorNum());
        next = (next + 1) % elevators.length;
    }

    elevators.forEach(function(elevator) {
        elevator.on("floor_button_pressed", function(floorNum) {
            elevator.goToFloor(floorNum);
        });
        elevator.on("idle", function() {
            elevator.goToFloor(0);
        });
    });

    floors.forEach(function(floor) {
        floor.on("up_button_pressed", function() {
            callNextElevator(floor);
        });
        floor.on("down_button_pressed", function() {
            callNextElevator(floor);
        });
    });
}

function update(dt, elevators, floors) {
}
`,

  "skyscraper.sky2.title": "Everyone starts in the lobby",
  "skyscraper.sky2.briefing.html":
    'Ten floors, two cars, and a building that has just opened its doors. Every level from here on sets the crowd a rhythm of its own, and this one is the <em>morning up-peak</em>: for as long as the run lasts every passenger appears in the lobby and every one of them is going up. The buttons upstairs stay dark, so "which floor called?" is a question with one answer, and picking a car for the call decides almost nothing. What decides the run is the trip back. A car returns to the lobby empty whatever you do, so the only figure you can change is how many people it carried on the way out — and the program you start with sends a car off the moment the first passenger presses a button. The levels after this one turn the rhythm around: an <em>evening down-peak</em> with the whole building trying to reach the street, and <em>lunch traffic</em> running both ways at once.',

  "skyscraper.sky2.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function callNextElevator(floor) {
        elevators[next].goToFloor(floor.floorNum());
        next = (next + 1) % elevators.length;
    }

    elevators.forEach(function(elevator) {
        elevator.on("floor_button_pressed", function(floorNum) {
            // TODO: the car leaves the instant one person is aboard
            elevator.goToFloor(floorNum);
        });
        elevator.on("idle", function() {
            elevator.goToFloor(0);
        });
    });

    floors.forEach(function(floor) {
        floor.on("up_button_pressed", function() {
            callNextElevator(floor);
        });
        floor.on("down_button_pressed", function() {
            callNextElevator(floor);
        });
    });
}

function update(dt, elevators, floors) {
}
`,

  "skyscraper.sky3.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function insertStop(elevator, floorNum) {
        // A stopped car that is asked for the floor it is already on has
        // nothing to do -- whoever could board has boarded.
        if (floorNum === elevator.currentFloor() && elevator.destinationDirection() === "stopped") {
            return;
        }
        const queue = elevator.destinationQueue.slice();
        if (queue.indexOf(floorNum) === -1) {
            queue.push(floorNum);
        }
        const here = elevator.currentFloor();
        queue.sort(function(a, b) {
            return Math.abs(a - here) - Math.abs(b - here);
        });
        elevator.destinationQueue = queue;
        elevator.checkDestinationQueue();
    }

    function callNextElevator(floor) {
        insertStop(elevators[next], floor.floorNum());
        next = (next + 1) % elevators.length;
    }

    elevators.forEach(function(elevator) {
        elevator.on("floor_button_pressed", function(floorNum) {
            insertStop(elevator, floorNum);
        });
        elevator.on("idle", function() {
            if (elevator.currentFloor() !== 0) {
                elevator.goToFloor(0);
            }
        });
    });

    floors.forEach(function(floor) {
        floor.on("up_button_pressed", function() {
            callNextElevator(floor);
        });
        floor.on("down_button_pressed", function() {
            callNextElevator(floor);
        });
    });
}

function update(dt, elevators, floors) {
}
`,

  "skyscraper.sky4.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function callNextElevator(floor) {
        elevators[next].goToFloor(floor.floorNum());
        next = (next + 1) % elevators.length;
    }

    elevators.forEach(function(elevator) {
        elevator.on("floor_button_pressed", function(floorNum) {
            elevator.goToFloor(floorNum);
        });
        elevator.on("idle", function() {
            // TODO: the lobby is where nobody is waiting this evening
            elevator.goToFloor(0);
        });
    });

    floors.forEach(function(floor) {
        floor.on("up_button_pressed", function() {
            callNextElevator(floor);
        });
        floor.on("down_button_pressed", function() {
            callNextElevator(floor);
        });
    });
}

function update(dt, elevators, floors) {
}
`,

  "skyscraper.sky5.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function insertStop(elevator, floorNum) {
        // A stopped car that is asked for the floor it is already on has
        // nothing to do -- whoever could board has boarded.
        if (floorNum === elevator.currentFloor() && elevator.destinationDirection() === "stopped") {
            return;
        }
        const queue = elevator.destinationQueue.slice();
        if (queue.indexOf(floorNum) === -1) {
            queue.push(floorNum);
        }
        const here = elevator.currentFloor();
        queue.sort(function(a, b) {
            return Math.abs(a - here) - Math.abs(b - here);
        });
        elevator.destinationQueue = queue;
        elevator.checkDestinationQueue();
    }

    function callNextElevator(floor) {
        insertStop(elevators[next], floor.floorNum());
        next = (next + 1) % elevators.length;
    }

    elevators.forEach(function(elevator) {
        elevator.on("floor_button_pressed", function(floorNum) {
            insertStop(elevator, floorNum);
        });
        elevator.on("idle", function() {
            if (elevator.currentFloor() !== 0) {
                elevator.goToFloor(0);
            }
        });
    });

    floors.forEach(function(floor) {
        floor.on("up_button_pressed", function() {
            callNextElevator(floor);
        });
        floor.on("down_button_pressed", function() {
            callNextElevator(floor);
        });
    });
}

function update(dt, elevators, floors) {
}
`,

  "skyscraper.sky6.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function callNextElevator(floor) {
        // TODO: the calls are in the lobby and upstairs at the same time
        elevators[next].goToFloor(floor.floorNum());
        next = (next + 1) % elevators.length;
    }

    elevators.forEach(function(elevator) {
        elevator.on("floor_button_pressed", function(floorNum) {
            elevator.goToFloor(floorNum);
        });
        elevator.on("idle", function() {
            elevator.goToFloor(0);
        });
    });

    floors.forEach(function(floor) {
        floor.on("up_button_pressed", function() {
            callNextElevator(floor);
        });
        floor.on("down_button_pressed", function() {
            callNextElevator(floor);
        });
    });
}

function update(dt, elevators, floors) {
}
`,

  "skyscraper.sky7.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function callNextElevator(floor) {
        elevators[next].goToFloor(floor.floorNum());
        next = (next + 1) % elevators.length;
    }

    elevators.forEach(function(elevator) {
        elevator.on("floor_button_pressed", function(floorNum) {
            // TODO: one errand at a time, and every errand crosses the building
            elevator.goToFloor(floorNum);
        });
        elevator.on("idle", function() {
            elevator.goToFloor(0);
        });
    });

    floors.forEach(function(floor) {
        floor.on("up_button_pressed", function() {
            callNextElevator(floor);
        });
        floor.on("down_button_pressed", function() {
            callNextElevator(floor);
        });
    });
}

function update(dt, elevators, floors) {
}
`,

  "skyscraper.sky8.title": "Not every car goes everywhere",
  "skyscraper.sky8.briefing.html":
    "Ten floors, and the two cars no longer do the same job: one of them serves the lobby and floors 1 to 4, the other the lobby and floors 5 to 9. Real towers are built this way, and the reason is arithmetic — a car that stops at every floor of a tall building spends its whole day stopping, so the floors are split into <em>zones</em> and each bank of cars is given one. Ask a car for a floor outside its zone and the machine does not argue: it drives there, opens its doors, and nobody gets in. Worse, the call is still outstanding. The floor's lamp is already lit, so the button that would have called somebody else does nothing when it is pressed again, and that floor waits for the rest of the run. <code>elevator.servedFloors()</code> is the list of floors a car will actually serve, and from here on choosing a car starts with it.",

  "skyscraper.sky8.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function insertStop(elevator, floorNum) {
        // A stopped car that is asked for the floor it is already on has
        // nothing to do -- whoever could board has boarded.
        if (floorNum === elevator.currentFloor() && elevator.destinationDirection() === "stopped") {
            return;
        }
        const queue = elevator.destinationQueue.slice();
        if (queue.indexOf(floorNum) === -1) {
            queue.push(floorNum);
        }
        const here = elevator.currentFloor();
        queue.sort(function(a, b) {
            return Math.abs(a - here) - Math.abs(b - here);
        });
        elevator.destinationQueue = queue;
        elevator.checkDestinationQueue();
    }

    function callNextElevator(floor) {
        // TODO: in this building not every car stops at every floor
        insertStop(elevators[next], floor.floorNum());
        next = (next + 1) % elevators.length;
    }

    elevators.forEach(function(elevator) {
        elevator.on("floor_button_pressed", function(floorNum) {
            insertStop(elevator, floorNum);
        });
        elevator.on("idle", function() {
            if (elevator.currentFloor() !== 0) {
                elevator.goToFloor(0);
            }
        });
    });

    floors.forEach(function(floor) {
        floor.on("up_button_pressed", function() {
            callNextElevator(floor);
        });
        floor.on("down_button_pressed", function() {
            callNextElevator(floor);
        });
    });
}

function update(dt, elevators, floors) {
}
`,

  "skyscraper.sky9.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function insertStop(elevator, floorNum) {
        // A stopped car that is asked for the floor it is already on has
        // nothing to do -- whoever could board has boarded.
        if (floorNum === elevator.currentFloor() && elevator.destinationDirection() === "stopped") {
            return;
        }
        const queue = elevator.destinationQueue.slice();
        if (queue.indexOf(floorNum) === -1) {
            queue.push(floorNum);
        }
        const here = elevator.currentFloor();
        queue.sort(function(a, b) {
            return Math.abs(a - here) - Math.abs(b - here);
        });
        elevator.destinationQueue = queue;
        elevator.checkDestinationQueue();
    }

    function callNextElevator(floor) {
        // TODO: the filter is the easy half -- silver asks who waited longest
        const floorNum = floor.floorNum();
        for (let tries = 0; tries < elevators.length; tries++) {
            const elevator = elevators[next];
            next = (next + 1) % elevators.length;
            if (elevator.servedFloors().includes(floorNum)) {
                insertStop(elevator, floorNum);
                return;
            }
        }
    }

    elevators.forEach(function(elevator) {
        elevator.on("floor_button_pressed", function(floorNum) {
            insertStop(elevator, floorNum);
        });
        elevator.on("idle", function() {
            if (elevator.currentFloor() !== 0) {
                elevator.goToFloor(0);
            }
        });
    });

    floors.forEach(function(floor) {
        floor.on("up_button_pressed", function() {
            callNextElevator(floor);
        });
        floor.on("down_button_pressed", function() {
            callNextElevator(floor);
        });
    });
}

function update(dt, elevators, floors) {
}
`,

  "skyscraper.sky10.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function insertStop(elevator, floorNum) {
        // A stopped car that is asked for the floor it is already on has
        // nothing to do -- whoever could board has boarded.
        if (floorNum === elevator.currentFloor() && elevator.destinationDirection() === "stopped") {
            return;
        }
        const queue = elevator.destinationQueue.slice();
        if (queue.indexOf(floorNum) === -1) {
            queue.push(floorNum);
        }
        const here = elevator.currentFloor();
        queue.sort(function(a, b) {
            return Math.abs(a - here) - Math.abs(b - here);
        });
        elevator.destinationQueue = queue;
        elevator.checkDestinationQueue();
    }

    function callNextElevator(floor) {
        // TODO: floors 6 to 8 are served by both banks; this takes whichever is next
        const floorNum = floor.floorNum();
        for (let tries = 0; tries < elevators.length; tries++) {
            const elevator = elevators[next];
            next = (next + 1) % elevators.length;
            if (elevator.servedFloors().includes(floorNum)) {
                insertStop(elevator, floorNum);
                return;
            }
        }
    }

    elevators.forEach(function(elevator) {
        elevator.on("floor_button_pressed", function(floorNum) {
            insertStop(elevator, floorNum);
        });
        elevator.on("idle", function() {
            if (elevator.currentFloor() !== 0) {
                elevator.goToFloor(0);
            }
        });
    });

    floors.forEach(function(floor) {
        floor.on("up_button_pressed", function() {
            callNextElevator(floor);
        });
        floor.on("down_button_pressed", function() {
            callNextElevator(floor);
        });
    });
}

function update(dt, elevators, floors) {
}
`,

  "skyscraper.sky11.title": "Nobody presses up or down",
  "skyscraper.sky11.briefing.html":
    "The hall buttons are gone. Instead of pressing up or down, a passenger keys the floor they want into a panel by the doors and waits for whichever car the system promises them — this is <em>destination dispatch</em>, and every tower built this century is run on it. Your program hears <code>destination_requested</code> with the floor somebody wants, and answers it with <code>elevator.takeRequest(from, to)</code>: that books the car for that trip, and those people will board that car and no other. Booking is a promise about which car, not an instruction to go anywhere: the car still has to be sent, by <code>goToFloor</code> or by filling its <code>destinationQueue</code> and calling <code>checkDestinationQueue()</code>. And a floor whose journey is booked stops asking — it has been answered, as far as it knows — so a promise nobody keeps is worse than no promise at all.",

  "skyscraper.sky11.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    elevators.forEach(function(elevator) {
        elevator.on("floor_button_pressed", function(floorNum) {
            elevator.goToFloor(floorNum);
        });
    });

    floors.forEach(function(floor) {
        floor.on("destination_requested", function(destinationFloor) {
            const elevator = elevators[next];
            next = (next + 1) % elevators.length;
            // TODO: the car is booked for this trip, and nothing has sent it
            elevator.takeRequest(floor.floorNum(), destinationFloor);
        });
    });
}

function update(dt, elevators, floors) {
}
`,

  "skyscraper.sky12.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    elevators.forEach(function(elevator) {
        elevator.on("floor_button_pressed", function(floorNum) {
            elevator.goToFloor(floorNum);
        });
    });

    floors.forEach(function(floor) {
        floor.on("destination_requested", function(destinationFloor) {
            // TODO: whoever's turn it is, wherever that car happens to be
            const elevator = elevators[next];
            next = (next + 1) % elevators.length;
            if (elevator.takeRequest(floor.floorNum(), destinationFloor)) {
                elevator.goToFloor(floor.floorNum());
            }
        });
    });
}

function update(dt, elevators, floors) {
}
`,

  "skyscraper.sky13.startingCode.code": `function init(elevators, floors) {
    function insertStop(elevator, floorNum) {
        // A stopped car that is asked for the floor it is already on has
        // nothing to do -- whoever could board has boarded.
        if (floorNum === elevator.currentFloor() && elevator.destinationDirection() === "stopped") {
            return;
        }
        const queue = elevator.destinationQueue.slice();
        if (queue.indexOf(floorNum) === -1) {
            queue.push(floorNum);
        }
        const here = elevator.currentFloor();
        queue.sort(function(a, b) {
            return Math.abs(a - here) - Math.abs(b - here);
        });
        elevator.destinationQueue = queue;
        elevator.checkDestinationQueue();
    }

    function nearestWithRoom(floorNum) {
        let best = null;
        elevators.forEach(function(elevator) {
            if (elevator.loadFactor() > 0.7) {
                return;
            }
            const distance = Math.abs(elevator.currentFloor() - floorNum);
            if (best === null || distance < best.distance) {
                best = { elevator: elevator, distance: distance };
            }
        });
        return best === null ? null : best.elevator;
    }

    floors.forEach(function(floor) {
        floor.on("destination_requested", function(destinationFloor) {
            // TODO: one journey answered, one car sent -- the queue on this
            // floor is going to eight different places this minute
            const elevator = nearestWithRoom(floor.floorNum());
            if (elevator !== null && elevator.takeRequest(floor.floorNum(), destinationFloor)) {
                insertStop(elevator, floor.floorNum());
            }
        });
    });

    elevators.forEach(function(elevator) {
        elevator.on("floor_button_pressed", function(floorNum) {
            insertStop(elevator, floorNum);
        });
        elevator.on("idle", function() {
            if (elevator.currentFloor() !== 0) {
                elevator.goToFloor(0);
            }
        });
    });
}

function update(dt, elevators, floors) {
}
`,
} as const satisfies Readonly<Record<string, string | PluralForms<"en">>>;
