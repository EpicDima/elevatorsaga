/**
 * The English catalogue: the reference locale.
 *
 * Every string here was lifted from the interface as it stands — `index.html`,
 * `documentation.html`, the templates, the presenters, the level conditions
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
  // The page's `<h1>`, drawn as the app bar's brand name. The same string in
  // both catalogues, and translated in neither: it is the game's name.
  "page.brand": "Elevator Saga",
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
  // `avgWaitTime` and `maxWaitTime`, and those cannot be renamed: the level
  // conditions in src/game/levels.ts are written against them, and every
  // upstream score ever posted was measured by them. The two rows between them
  // are the halves neither of them names: the wait, and then the ride.
  "page.stats.avgWaitTime": "Avg delivery time",
  // Sits under the average rather than beside its own maximum, which the panel
  // does not show, and above the ride it leaves out: the three rows read down
  // as a sum, the whole and then its two parts. "Wait for a car" rather than
  // "wait", because the row above claims the word and this is the row that has
  // a right to it.
  "page.stats.avgPickupTime": "Avg wait for a car",
  "page.stats.avgPickupTimeTitle":
    "The clock starts when a passenger appears and stops when a car takes them, and the row below it is the rest of the journey",
  // The ride, and the third of the three spans the lift industry measures a
  // building by: waiting time, transit time, journey time. It goes under the
  // wait rather than under the delivery time above them both, so the two parts
  // are adjacent and the reader can see them add up. "Ride" and not "transit",
  // which is the trade's word for it and nobody else's.
  "page.stats.avgRideTime": "Avg ride time",
  "page.stats.avgRideTimeTitle":
    "The clock starts when a car takes a passenger and stops when they step out at their floor, so this and the wait above it add up to the delivery time",
  "page.stats.maxWaitTime": "Max delivery time",
  "page.stats.moves": "Moves",
  "page.stats.movesTitle":
    "One move is counted each time a car crosses the halfway mark between one floor and the next",
  // Under the moves because the two are read against each other: a long journey
  // is many moves and one stop, and a program that answers every call the
  // moment it lights up makes many stops for few moves. This is the `S` of the
  // round-trip-time arithmetic a lift is actually sized by.
  "page.stats.stops": "Stops",
  "page.stats.stopsTitle":
    "One stop is counted each time a car comes to rest at a floor and opens its doors, so a car sent to the floor it is already standing on counts another one",
  // And the `P` beside it. Both ends of a journey count, so this is not the
  // boardings-per-stop a lift engineer would quote for the same building; what
  // it is for is the direction it moves in, which the two of them share.
  "page.stats.peoplePerStop": "People per stop",
  "page.stats.peoplePerStopTitle":
    "Everyone who got in or out, over the stops counted above, so opening the doors where nobody is waiting brings it down",
  // Last, and under the row it is measured against: `avgLoadFactorOnMove` is
  // sampled once per move, so it is a mean over the count above rather than
  // over time, and a parked car is absent from it rather than counted as empty.
  // "Avg load" and not "Avg load factor", because the column has no room for
  // the second word and nothing in the panel needs it; the tooltip and the help
  // page are where a figure this easy to read backwards gets explained.
  "page.stats.avgLoad": "Avg load",
  "page.stats.avgLoadTitle":
    "How full the cars were, averaged over the moves counted above, so a car standing still is not in the figure at all",

  // ------------------------------------------------------- the building view
  // src/ui/templates.ts.

  "game.floor.callUp": "Call an elevator going up from floor {floor}",
  "game.floor.callDown": "Call an elevator going down from floor {floor}",
  "game.elevator.label": "Elevator {number}",
  "game.elevator.floorButton": "Go to floor {floor}",
  // The hover cards `widgets/building-stage` shows over a car or a floor.
  // src/widgets/building-stage/lib/hover-card-text.ts. The engine keeps no
  // persistent "doors open" flag, only transient events, so the elevator's
  // state line only ever says one of these three things.
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
  // The stats panel's own new figures: src/widgets/stats-panel. Its other
  // eleven tiles reuse "page.stats.*" directly, the same captions
  // `presentStats` and the goal bar's own meters already show; these two
  // counts have no production precedent to reuse, because `presentStats`
  // never tracked them. Paired present-tense captions on purpose, so the
  // two read as opposites of each other at a glance.
  "game.statsPanel.waitingNow": "Waiting now",
  "game.statsPanel.aboardNow": "Riding now",
  // Summary text for the "<details>" holding the panel's nine secondary
  // tiles.
  "game.statsPanel.more": "All figures",
  "game.level.title.html": "Level {number}: {description}",
  // A level tile shows a bare number, because nineteen of them have to fit
  // across a phone; the name each one carries is what a screen reader announces
  // in their place, so it has to say what the number means on its own.
  "game.level.nav.label": "Levels",
  "game.level.nav.link": "Level {number}",
  // The level switcher's own popover: `widgets/level-switcher`. Two of its
  // three block captions reuse "game.level.nav.label" (levels) and
  // "tutorial.panel.label" (the learning track), so only what is new to this
  // widget is here — the third block's caption and the tile inside it, the
  // step buttons either side of the popover trigger, and the two tile labels
  // the level list has no counterpart for, since it never names a
  // learning-track level.
  "game.levelSwitcher.prevLabel": "Previous level",
  "game.levelSwitcher.nextLabel": "Next level",
  // Caption and tile, and deliberately not the same word: the block is
  // whatever is neither a lesson nor a numbered level, which today is free
  // play alone. Naming the block after its only tile would say "Sandbox"
  // twice over and promise nothing else will ever join it.
  "game.levelSwitcher.otherBlockLabel": "Other",
  "game.levelSwitcher.sandboxLabel": "Sandbox",
  "game.levelSwitcher.tutorialTileLabel": "Tutorial level {number}",
  "game.levelSwitcher.tutorialTileClearedLabel": "Tutorial level {number}, completed",
  // What the 118px trigger says while a lesson is the level being played. The
  // tile labels above are written for a grid, where the state on the end of
  // them is the point, and on the trigger they overflow. Shortening them to
  // "Level {number}" is what the numbered levels are already called, and the
  // trigger is the only thing on screen that says where the player is at all
  // times, so the track's levels are named by the other word for them here --
  // a lesson, which is what the help page calls the panel each one comes with.
  // A numbered level and the sandbox need no key of their own: "Level
  // {number}" and "Sandbox" are already what they are called.
  "game.levelSwitcher.tutorialTriggerLabel": "Lesson {number}",
  // The editor pane's own goto link: `widgets/editor-pane`. Points at the line
  // "src/ui/error-location.ts"'s locateCodeError found for the player's own
  // exception; the button that carries it is hidden whenever that comes back
  // empty.
  "game.editorPane.gotoLine": "Line {line} →",
  // The seed row, which is two rows really: three controls that say what the
  // run is and let the player say what it should be, and a disclosure that says
  // how far the promise goes. The seed itself is a placeholder rather than part
  // of the sentence — it is the token a player transcribes, and it must read the
  // same in every language.
  //
  // `link` and `newDrawLink` name the row's two icon buttons, on `aria-label`
  // and on `title` both, and the glyph is all there is to go on: nothing about a
  // pair of dice or a pair of pages says which seed it acts on. So each names
  // the seed as well as the gesture — a name has to stand on its own, and
  // "1234567890, link" describes nothing.
  //
  // `inputLabel` names the field between them, which has no visible label of its
  // own: the block's "Seed" caption is a `<span>` beside it, not a `<label>`
  // for it. It says what the field holds *and* what typing in it does, because
  // a text box that navigates on Enter is not what a text box usually is.
  "game.seed.label": "Seed",
  "game.seed.inputLabel": "This run's seed — type another one to play it",
  "game.seed.link": "Seed {seed}: put this run in the address bar",
  "game.seed.newDrawLink": "Seed {seed}: draw a new one and start again",
  // Shown by the field itself, through `setCustomValidity`, when what was typed
  // could not survive the address bar. Says which characters rather than "wrong
  // format", because the player has to fix it: the browser's own message for a
  // `pattern` names no pattern.
  "game.seed.invalid": "A seed can be up to 64 letters, digits, dots, hyphens or underscores.",
  "game.seed.helpSummary": "what a seed does",
  "game.seed.explanation":
    "The same seed brings the same passengers, in the same order — and, played the same way, the exact same run: every elevator movement, arrival and button press repeats exactly, whatever the browser's frame rate. The seed stays yours across restarts, reloads and levels until you type another one or draw one with the dice.",
  // The same sentence the disclosure makes, compressed onto the console line
  // printed at every start. It is keyed and the other console strings are not,
  // because it is not a diagnostic: the rest report a bug, a malformed URL or a
  // broken invariant, and this one is addressed to a player who has done
  // nothing wrong and is being told how to play the run again. The seed and the
  // URL are placeholders for the same reason they are everywhere else -- they
  // are transcribed, not read.
  "game.seed.console": "Seed {seed} — the exact same run again, whatever the frame rate: {url}",
  // Settings: features/switch-theme. "System" is not a fallback but the
  // starting choice: until the theme is touched, the page follows the
  // system's own light/dark switch (see presentThemeSwitch's doc comment on
  // prefersDark).
  "game.switchTheme.caption": "Theme",
  "game.switchTheme.system": "System",
  "game.switchTheme.light": "Light",
  "game.switchTheme.dark": "Dark",
  // Settings: features/switch-layout. The four modes switch the same layout
  // `widgets/workspace-layout` does, but under its own name -- LayoutModeId,
  // not LayoutMode -- because features may not import from widgets (see
  // layout-switch.ts's module doc comment). Named "onlyCode"/"onlyGame"
  // rather than bare "code"/"game": a bare "code" would collide with
  // catalogue.test.ts's reserved ".code" suffix, which demands the value be
  // byte-identical across locales -- a promise meant for example code, not a
  // layout mode's label.
  "game.switchLayout.caption": "Layout",
  "game.switchLayout.left": "Code left",
  "game.switchLayout.right": "Code right",
  "game.switchLayout.onlyCode": "Code only",
  "game.switchLayout.onlyGame": "Building only",
  // widgets/workspace-layout's own aria-labels: the two panes the splitter
  // divides, and the splitter itself, which is a `role="separator"` rather
  // than a native form control and so has no label of its own to borrow.
  "game.workspace.gamePane": "Simulation",
  "game.workspace.codePane": "Code editor",
  "game.workspace.splitter": "Editor width",
  // Settings: widgets/app-bar's settings-menu.ts, the widget composing
  // switch-theme, switch-layout, switch-language and manage-seed into the one
  // popover `design/ui-mockup.html` draws. docsOpenLabel and hotkeysOpenLabel
  // name openers only -- Phase 10 is where the docs and hotkeys dialogs
  // themselves get built, so both buttons take an injected click callback and
  // do nothing on their own yet. aboutForkLabel/aboutOriginalLabel/
  // aboutCopyright are the only prose in a block that is otherwise two real,
  // hardcoded GitHub URLs -- addresses are not a translator's business.
  "game.appBar.docsOpenLabel": "Help",
  "game.appBar.settingsLabel": "Settings",
  "game.appBar.hotkeysOpenLabel": "Hotkeys",
  "game.appBar.aboutCaption": "About",
  "game.appBar.aboutForkLabel": "This fork",
  "game.appBar.aboutOriginalLabel": "Original",
  // The one link out of the game to `licenses.txt`, the notice file the build
  // writes into `dist/` -- see `settings-menu.ts`'s own About block comment for
  // why it is the licence's name rather than a row of its own.
  "game.appBar.aboutCopyright.html":
    'Elevator Saga © 2015 Magnus Wolffelt, © 2026 EpicDima, <a href="licenses.txt">MIT</a>.',
  // Hotkeys: features/hotkeys-help's keys dialog, design/ui-mockup.html's own
  // `<dialog class="keys">`. Every Mod- binding is spelled out as two <kbd>s
  // joined by "+" (documentation.html's own <kbd data-mod-key> convention,
  // resolved at runtime by src/ui/shortcuts.ts's labelModifierKeys) rather
  // than the mockup's Mac-only "⌘⏎"/"⌘B" glyphs, and the mockup's own
  // Windows/Linux hint paragraph is dropped: labelModifierKeys already
  // relabels the kbd per visitor, so the hint's own question does not arise.
  "game.hotkeys.title": "Keyboard shortcuts",
  "game.hotkeys.closeTitle": "Close window",
  "game.hotkeys.close": "Close",
  "game.hotkeys.startPause": "Start and pause",
  "game.hotkeys.startOver": "Start over",
  "game.hotkeys.switchLayout": "Switch layout",
  "game.hotkeys.openDocs": "Help",
  "game.hotkeys.openSettings": "Settings",
  // Docs: features/docs-reference's help dialog, design/ui-mockup.html's own
  // `<dialog class="docs">` -- the chrome around the guide and the API
  // reference, not their content.
  "game.docs.title": "Help",
  "game.docs.searchPlaceholder": "Search: goToFloor, waiting, button…",
  "game.docs.clearSearch": "Clear search",
  "game.docs.closeTitle": "Close help",
  "game.docs.close": "Close",
  "game.docs.empty": "Nothing found",
  // The guide: design/ui-mockup.html's own GUIDE template literal, ported
  // section by section. whatToDo's four steps are their own keys rather than
  // one holding the whole <ol>, because the list markup is the template's to
  // draw, not a translator's to reproduce; step3 keeps a .html suffix because
  // it alone has an inline <b>, and the rest do not.
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
    "Clearing a level earns bronze — that's exactly its own condition. Silver and gold come from <em>how</em> it was cleared: with room to spare, without running elevators empty, without making people wait. The card on the right, in the goal bar, shows exactly what each star needs — and which of them are being held right now. Stars gate nothing: every level is open from the first visit, and silver and gold stay on the list to come back for.",
  "game.docs.guide.tutorialLevels.heading": "The first levels come with an explanation",
  "game.docs.guide.tutorialLevels.body":
    "Tutorial levels have a lesson standing next to the building: step by step, what's happening, which event a program sees it through, and what answering it looks like. The hints open one at a time, and the last of them holds a working program with a button that copies it.",
  // The code skeleton every program starts from, and the one paragraph naming
  // elevator/elevators/floor/floors before the reference dives into each --
  // design/ui-mockup.html's own docsBody.innerHTML assembly, between the
  // guide and the API rows.
  "game.docs.intro.heading": "What a program is made of",
  "game.docs.intro.example.code": `{
  init: function (elevators, floors) {
    // subscribe to events here
  },
  update: function (dt, elevators, floors) {
    // called continuously while a run is in progress
  }
}`,
  "game.docs.lead.html":
    "<code>elevator</code> is an elevator: all of them live in <code>elevators</code>. <code>floor</code> is a floor, and they're in <code>floors</code>. Any row below can be expanded — details and an example live underneath.",
  // The API reference: entities/api-reference/model/reference.ts holds the
  // structural table (which sig belongs to which group, in which order); each
  // triplet below is one <details class="api"> row's short summary, longer
  // explanation and example. English condenses this repository's own
  // documentation.html prose for the same methods rather than translating the
  // Russian cold; Russian is design/ui-mockup.html's own API_DOCS text,
  // verbatim but for floorNum.more's "floors.length-1", tightened to satisfy
  // this catalogue's own hyphen-is-not-a-dash rule.
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
    "A whole number, never a fraction: while the elevator is travelling between floors, this answers with whichever floor it last passed. destinationDirection() knows which way it's headed while that's true.",
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
  // The speed control. The two arrows say what they do to the run rather than
  // what they do to a number -- "Slower", not "Decrease simulation speed" --
  // because that is the whole of what they are for, and because both words are
  // also the buttons' `title`, where a sentence would be a paragraph. The group
  // around them carries `label`, so a reader arriving at either arrow hears
  // what the pair is for first.
  "game.timeScale.label": "Run speed",
  "game.timeScale.decrease": "Slower",
  "game.timeScale.increase": "Faster",
  "game.timeScale.value": "{value}x",
  "game.timeScale.valueTitle": "Run speed: {value}",
  // The last stop of that control, past 20x, where the run is counted straight
  // through with nothing drawn. The infinity sign rather than an abbreviation,
  // and it keeps the multiplication sign the finite stops carry: "8x 20x inf"
  // reads as three different kinds of thing, "8x 20x oox" as one control at its
  // end. The title is the only place the word "instantly" is actually written,
  // so it also has to say what an instant run costs the player -- there is
  // nothing to watch.
  "game.timeScale.instant": "∞x",
  "game.timeScale.instantTitle": "Instantly: the run is counted straight through to its result",
  // The run cluster: two buttons, and the primary one says three things.
  // "Start" before the first tick and again once a run has finished, "Pause"
  // while it plays, "Resume" when it is standing still part-way through -- so
  // the word on the button is always the thing that will happen, never the
  // state the run is in.
  "game.button.start": "Start",
  "game.button.pause": "Pause",
  "game.button.resume": "Resume",
  // Said on the primary button's own `title`, and only once a run has ended:
  // there "Start" means throwing away a result the player is still reading,
  // which it means nowhere else on the page.
  "game.button.startAgainTitle": "Run it again from the beginning",
  // The second button. It throws away the run on screen and begins the same
  // level again with whatever is in the editor, which is what the old
  // "Apply" did; it is named for its effect rather than for the mechanism,
  // because the program is applied on every start now and there is nothing
  // left for the player to press "Apply" for. Its `title` says the part the
  // label has no room for -- and carries the whole name once the bar is narrow
  // enough to hide the label.
  //
  // `resetCode` and `undoResetCode` say "code" where the buttons beside them do
  // not, because they are the two in the row that act on the editor rather than
  // on the run, and "Reset" next to "Start over" would otherwise read as a
  // second way to restart the simulation.
  "game.button.startOver": "Start over",
  "game.button.startOverTitle": "Start the run from the very beginning",
  "game.button.resetCode": "Reset code",
  "game.button.undoResetCode": "Undo reset",
  // The tooltips on those two, which the mockup gives its own reset button and
  // which say the part the label has no room for: *which* code comes back.
  // "Reset code" alone does not distinguish the level's starting program from
  // whatever the player had a moment ago, and the two buttons sit side by side
  // undoing each other.
  "game.button.resetCodeTitle": "Put the level's own starting program back in this slot",
  "game.button.undoResetCodeTitle": "Bring back the program this slot held before the reset",
  // What the primary button says while a crunch is under way, in place of
  // "Start". Echoes `fitness.measuring`'s three ASCII dots — the one other
  // button in the game that replaces its own label while it works. There is no
  // "Run instantly" label any more: the button that carried it is gone, and
  // asking for a crunch is now the last stop of the speed control
  // (`game.timeScale.instant`).
  "game.button.runningInstantly": "Crunching...",
  "game.feedback.success.title": "Success!",
  "game.feedback.success.message": "Level completed",
  "game.feedback.failure.title": "Level failed",
  "game.feedback.failure.message": "Maybe your program needs an improvement?",
  "game.feedback.next": "Next level",
  // The verdict card's close button. It puts the card away and does nothing
  // else — "Got it" rather than "Close" because that is what the player is
  // saying, and deliberately not a word that could be read as offering the run
  // again: that is the app bar's own button, and one promise of it is enough.
  "game.feedback.dismiss": "Got it",
  // The line under the message: what the run would have to do for its next
  // star. One sentence per tier rather than one with the tier's name
  // interpolated, because Russian declines it — «до серебра», «до золота» —
  // and a name lifted out of `game.goalBar.tier.*` would arrive nominative.
  // `{needs}` is the unmet requirements, punctuated by `formatList`; each of
  // them is `game.feedback.more.need.html`, which pairs what was asked with
  // where the run actually finished. Without that second figure the line is a
  // reproach rather than a hint, which is `design/ui-mockup.html`'s own
  // reasoning for printing it.
  "game.feedback.more.silver.html": "For silver: {needs}",
  "game.feedback.more.gold.html": "For gold: {needs}",
  "game.feedback.more.need.html": "{req} (now {now})",
  "game.codeStatus": "There is an error in your program:",

  // The level bar's own meters and tier popover: `widgets/goal-bar`. Main
  // meter captions reuse "page.stats.*" directly in code rather than
  // duplicating them here — "maxPickupTime" is the one figure that panel
  // never shows, so it is the only caption that needs a key of its own.
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
  // "deliver everyone within {time}", not "no one waits longer than {time}":
  // maxWaitTime/avgWaitTime measure spawn-to-delivery, not a wait — see
  // page.stats.avgWaitTime's and page.stats.maxWaitTime's own doc comments.
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

  // ------------------------------------------------------------- the editor
  // src/ui/editor.ts, src/main.ts and src/ui/default-code.ts.

  "editor.label": "Elevator program",
  "editor.storageRefused":
    "Not saved — this browser will not store it. Your program is here until you close the tab.",
  "editor.confirmReset": "Do you really want to reset to the default implementation?",
  "editor.confirmUndoReset": "Do you want to bring back the code as before the last reset?",
  "editor.slot.tablist.label": "Code slots",
  // The visible word on a slot button, and its tooltip. A bare "1" says
  // nothing about what pressing it does, which is why it used to need an
  // `aria-label` saying it instead -- a label a sighted player never saw and a
  // screen-reader user heard in place of the number rather than beside it. The
  // mockup writes the noun out on the button itself, and the tooltip says what
  // the three of them are for: drafts, not versions or attempts, so that
  // nobody expects a history.
  "editor.slot.tab.label": "Code {number}",
  "editor.slot.tab.title": "Draft {number}",
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

  // --------------------------------------------------------------- levels
  // src/game/levels.ts. The counted phrases are separate messages so that
  // each can carry the plural forms its own language needs; the sentences then
  // compose them. The markup is the same `emphasis-color` span the level
  // bar has always highlighted the numbers with.

  "level.transportWithinTime.html": "Transport {people} in {time} or less",
  // "to be delivered" rather than "wait", because the limit these three
  // sentences announce is `World.maxWaitTime`, which stops at the passenger's
  // floor and not at the door of the car. A player who reads it as a wait
  // optimises for boarding people quickly and then loses the run to the ride.
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
  // `one` here can never print, and stays anyway. All three places that build
  // this phrase (src/game/levels.ts) pass `decimal(maxWaitTime, 1)`, and a number
  // written with a tenth is `other` in English as much as in Russian: the
  // fifteen-second limit reads "more than 15.0 seconds", and a one-second limit
  // would read "1.0 seconds" rather than "1 second". The form is kept because
  // the key is a plural message like the ones around it -- a limit that stopped
  // being written with a decimal would need it back, and it is one word.
  "level.waitLimit.html": {
    one: "<span class='emphasis-color'>{count}</span> second",
    other: "<span class='emphasis-color'>{count}</span> seconds",
  },
  "level.moveLimit.html": {
    one: "<span class='emphasis-color'>{count}</span> elevator move",
    other: "<span class='emphasis-color'>{count}</span> elevator moves",
  },

  // The sandbox describes the building the URL asked for rather than a goal.
  // Its counts are the player's own, so all four Russian categories are
  // reachable here — `#spawnrate=1`, `=2` and `=5` pick three different forms.
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
  // English does not inflect this one today: a sandbox running at one passenger
  // a second says "1 people per second". The wording is left exactly as it is —
  // both forms are the same string — so that nothing on screen changes; see
  // docs/i18n-inventory.md, which records it as the one thing here worth fixing.
  "level.sandbox.spawnRate.html": {
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
    "Called when the level starts. Normally you will put most of your code in here, to set up event listeners and logic.",
  "completion.global.update":
    "Called repeatedly during the level, at a fixed rate of 100 times per game second. dt is always that fixed step.",
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
  // Everything that can end up in the "there is an error in your program"
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
  "docs.basics.example.code": `{
    init: function(elevators, floors) {
        // Do stuff with the elevators and floors, which are both arrays of objects
    },
    update: function(dt, elevators, floors) {
        // Do more stuff with the elevators and floors
        // dt is always the same fraction of a game second: update runs 100 times per
        // simulated second, however fast or slow the browser is actually drawing
    }
}`,
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

  // ------------------------------------------------------ the learning track
  // The eight levels themselves live in src/game/tutorial.ts — the building, the
  // bar, the seed and the two programs — and everything the player reads around
  // them lives here. Every number quoted below is the number in that table
  // rather than the one in docs/tutorial-plan.md, which is older in three
  // places: level 4 runs at 0.8 passengers a second, level 5 is nine floors with
  // a wait limit of 37, and level 6 is 0.25 a second with a limit of 28.
  //
  // Every per-level message ends in `.html`, uniformly, including the ones whose
  // value is plain text. Two reasons, and the second is the one a later reader
  // will otherwise try to "fix". First, the panel builds these key names by
  // interpolating the level number and the hint number, so a suffix that varied
  // from level to level could not be built at all. Second, it is legal:
  // `catalogue.test.ts` only forbids markup under a key that is *not* `.html`,
  // and its tag-matching test is satisfied by two empty tag lists, so a plain
  // value under a `.html` key breaks nothing.
  //
  // Both programs of every level are here as well, under `.code` keys, and the
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
  // `tutorial-solutions.test.ts` proves the level with are one string in one
  // place. A copy nothing compares was the thing to avoid and still is:
  // `tutorial.level8.solutionCode.code` is level 7's program word for word,
  // because level 8 asks for nothing new, and `src/game/tutorial.test.ts` holds
  // the two equal in every locale rather than leaving them to be edited apart.
  //
  // The two code keys come last in each level's group, so that the prose keys
  // stay next to one another: a translator reads the two catalogues side by
  // side, and a twelve-line program between two sentences is twelve lines of
  // scrolling. The Russian typography rules draw the same line — a code block
  // is indented, and "has no double spaces" applies to every key that does not
  // end in `.code`.

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

  "tutorial.level1.startingCode.code": `{
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
  "tutorial.level1.solutionCode.code": `{
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

  "tutorial.level2.startingCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        // TODO: send the elevator round all three floors, over and over
    },
    update: function(dt, elevators, floors) {
    }
}`,
  "tutorial.level2.solutionCode.code": `{
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

  "tutorial.level3.startingCode.code": `{
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
  "tutorial.level3.solutionCode.code": `{
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

  "tutorial.level4.startingCode.code": `{
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
  "tutorial.level4.solutionCode.code": `{
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

  "tutorial.level5.startingCode.code": `{
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
  "tutorial.level5.solutionCode.code": `{
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

  "tutorial.level6.startingCode.code": `{
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
  "tutorial.level6.solutionCode.code": `{
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

  "tutorial.level7.startingCode.code": `{
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
  "tutorial.level7.solutionCode.code": `{
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

  "tutorial.level8.startingCode.code": `{
    init: function(elevators, floors) {
        // TODO: nothing here is new. You have written all of it already.
    },
    update: function(dt, elevators, floors) {
    }
}`,
  // Tutorial level 7's answer, word for word, which is the answer level 8 is
  // measured against: the graduation level asks for nothing new. Written out
  // rather than pointed at, so that every level owns the same eight keys and a
  // translator meets no exception; `src/game/tutorial.test.ts` holds the two
  // equal in every locale, which is what a copy needs to be allowed to exist.
  "tutorial.level8.solutionCode.code": `{
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

  // The panel around the levels, the bar that used to stand above them and the
  // screen after the last one. The seed line, the statistics and the editor are
  // the game's own and say the same things here as everywhere else.
  //
  // "Tutorial level" is a level of the track and "level {number}" is a level of
  // the game; the first is qualified so that the player cannot read one for the
  // other.
  //
  // `tutorial.panel.label` is the caption over the level switcher's block of
  // lessons, and nothing else — the name is what is left of a panel that used
  // to open on it. The panel itself now says nothing about the track: it is
  // named after the level it is teaching, because eight lessons that each begin
  // by saying which of eight they are put the track between the player and the
  // level in front of them. Where they are on it is the app bar's level
  // switcher: its trigger reads `game.levelSwitcher.tutorialTriggerLabel`, and
  // the tiles behind it say which lessons are done.

  "tutorial.panel.label": "Learning track",
  "tutorial.panel.hintSummary": "Hint {number}",
  "tutorial.panel.explanationSummary": "Why this happens",
  "tutorial.solution.copy": "Copy this program",
  // The clipboard write's two outcomes, at the size and just under the answer
  // the button sits on. `navigator.clipboard.writeText` can refuse for
  // reasons a player has no way to fix from here — no permission, no secure
  // context — so the refusal says what to do instead rather than only that it
  // failed: the program is still on screen, right above the line saying so.
  "tutorial.solution.copied": "Copied to your clipboard.",
  "tutorial.solution.copyFailed":
    "Your browser refused to copy it. Select the code above and copy it yourself.",
  "tutorial.bar.title.html": "Tutorial level {number} of {count}: {description}",
  "tutorial.finish.title": "The track is finished",
  "tutorial.finish.message":
    "Eight tutorial levels, and the last of them was level 1 of the game itself: the same three floors, the same elevator, the same fifteen passengers in sixty seconds. The program in the editor solves it. Level 1 opens with a program of its own, so copy this one out of the editor before you go if you would rather start from it.",
  "tutorial.finish.nextLevel": "Next tutorial level",
  "tutorial.finish.toLevels": "Go to level 1",
} as const satisfies Readonly<Record<string, string | PluralForms<"en">>>;
