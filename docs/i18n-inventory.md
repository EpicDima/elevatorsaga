# Localisation inventory

Every string the game shows a player, the key it now has in `src/i18n/`, and where it is
still hardcoded. This is the checklist for wiring the catalogue into the page: nothing in
`src/i18n/` is called from anywhere yet, so today the file is a map of work to do rather
than a record of work done.

The catalogue holds **208 keys**, in two locales: `src/i18n/en.ts` is the reference — its
text is the English wording, extracted verbatim — and `src/i18n/ru.ts` is the Russian
translation. The types make English the shape everything else is measured against: a
Russian catalogue missing a key, carrying a key that English does not have, or giving a
plural message the wrong number of forms is a compile error, not a runtime surprise.

## The module

| File                    | What it is                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/i18n/locale.ts`    | `Locale`, `LOCALES`, `DEFAULT_LOCALE`, `LOCALE_NAMES`, `isLocale`, `htmlLang`                                                                                  |
| `src/i18n/format.ts`    | `Intl` wrappers: `quantity`, `decimal`, `seconds`, `formatNumber`, `formatValue`, `formatTimeOfDay`, `selectPlural`, `interpolate`, `PLURAL_CATEGORIES`        |
| `src/i18n/catalogue.ts` | `MessageKey`, `MessageCatalogue<L>`, `MessageParams<K>`, `MessageArgs<K>`, `translate`                                                                         |
| `src/i18n/en.ts`        | `EN_MESSAGES` — the reference locale                                                                                                                           |
| `src/i18n/ru.ts`        | `RU_MESSAGES` — the Russian catalogue, with its glossary at the top                                                                                            |
| `src/i18n/detect.ts`    | `resolveLocale`, `browserLocaleSources`, `localeFromQuery`, `readStoredLocale`, `storeLocale`, `localeFromLanguages`, `LOCALE_QUERY_KEY`, `LOCALE_STORAGE_KEY` |
| `src/i18n/index.ts`     | `t`, `translateIn`, `getLocale`, `setLocale`, `format`, `formatTime`, `CATALOGUES`                                                                             |

Calling it looks like this:

```ts
import { format, seconds, setLocale, t } from "./i18n/index.ts";

t("game.button.start"); // "Start" / "Старт"
t("game.elevator.label", { number: 3 }); // "Elevator 3" / "Лифт 3"
t("challenge.people.html", { count: 5 }); // 5 people / 5 пассажиров
format(seconds(60)); // "60s" / "60 с"
setLocale("ru"); // everything after this renders in Russian
```

The parameters are named and typed per key: `t("game.elevator.label")` with no arguments,
or with `{ floor: 3 }` instead of `{ number: 3 }`, does not compile. Counts go through
`Intl.PluralRules`, which is why Russian gets four forms and not two — 1 пассажир,
2 пассажира, 5 пассажиров, 1,5 пассажира — and numbers go through `Intl.NumberFormat`,
which is why Russian gets `1,5` and a non-breaking space before a unit.

## How to read the tables

- **Key** — what to pass to `t`.
- **Where** — `file:line` of the string as it is hardcoded today, as of commit `b14a23b`
  plus the edits other agents had in flight while this was written. Line numbers rot;
  the keys and the English text do not, so search for the text if a line has moved.
- **English** — the reference wording, trimmed to one line and shortened past 110
  characters. `src/i18n/en.ts` is the authority, not this column.
- **Notes** — plural categories, the parameters the message takes, and anything about the
  call site the wiring has to respect.

Key names carry two suffixes that mean something:

- `.html` — the value contains markup and is meant for `innerHTML` or a `raw()`
  interpolation. Every other key is plain text for `textContent` or an attribute.
- `.code` — the value is example code. Only its `//` comments are translated; the code
  itself is byte-identical in every locale, and a test enforces that.

## Where the strings are

| File                             | Strings |
| -------------------------------- | ------- |
| `documentation.html`             | 80      |
| `src/ui/completions.ts`          | 32      |
| `index.html`                     | 31      |
| `src/ui/templates.ts`            | 18      |
| `src/game/challenges.ts`         | 14      |
| `src/ui/presenters.ts`           | 7       |
| `src/app/fitness.ts`             | 7       |
| `src/app/app.ts`                 | 4       |
| `src/game/elevator-interface.ts` | 4       |
| `src/main.ts`                    | 3       |
| `src/game/fitness.ts`            | 3       |
| `src/game/user-code.ts`          | 2       |
| `src/ui/editor.ts`               | 1       |
| `src/ui/default-code.ts`         | 1       |
| `src/game/movable.ts`            | 1       |
| **Total**                        | **208** |

## The strings

### index.html — 31 strings

| Key                            | Where               | English                                                                                                         | Notes                                                                                                       |
| ------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `page.title`                   | index.html:6        | Elevator Saga - the elevator programming game                                                                   |                                                                                                             |
| `page.description`             | index.html:9        | Elevator Saga is a programming game: write JavaScript to transport people efficiently.                          |                                                                                                             |
| `page.imageAlt`                | index.html:35       | Four elevators carrying people between six floors, with the JavaScript program driving them in the editor belo… |                                                                                                             |
| `page.skipLink`                | index.html:48       | Skip to the code editor                                                                                         |                                                                                                             |
| `page.brand`                   | index.html:52       | Elevator Saga                                                                                                   |                                                                                                             |
| `page.tagline`                 | index.html:52       | The elevator programming game                                                                                   |                                                                                                             |
| `page.nav.label`               | index.html:53       | Help and reference                                                                                              |                                                                                                             |
| `page.nav.help`                | index.html:54       | Help                                                                                                            |                                                                                                             |
| `page.nav.documentation`       | index.html:55       | Documentation                                                                                                   |                                                                                                             |
| `page.nav.wiki`                | index.html:56       | Wiki & Solutions                                                                                                |                                                                                                             |
| `page.noscript`                | index.html:62       | Your browser does not appear to support JavaScript. This page contains a browser-based programming game implem… |                                                                                                             |
| `page.world.label`             | index.html:77       | Building                                                                                                        |                                                                                                             |
| `page.stats.label`             | index.html:87       | Simulation statistics                                                                                           |                                                                                                             |
| `page.stats.transported`       | index.html:89       | Transported                                                                                                     |                                                                                                             |
| `page.stats.elapsedTime`       | index.html:92       | Elapsed time                                                                                                    |                                                                                                             |
| `page.stats.transportedPerSec` | index.html:95       | Transported/s                                                                                                   |                                                                                                             |
| `page.stats.avgWaitTime`       | index.html:98       | Avg waiting time                                                                                                |                                                                                                             |
| `page.stats.maxWaitTime`       | index.html:101      | Max waiting time                                                                                                |                                                                                                             |
| `page.stats.moves`             | index.html:105      | Moves                                                                                                           |                                                                                                             |
| `page.stats.movesTitle`        | index.html:104      | Number of floors that have been travelled by elevators                                                          | `title` attribute on the same cell as `page.stats.moves`                                                    |
| `page.hint.html`               | index.html:120      | In the editor: <kbd data-mod-key>Ctrl</kbd>+<kbd>Enter</kbd> applies your program. <kbd data-mod-key>Ctrl</kbd… | markup; `<kbd data-mod-key>` is rewritten at run time by `applyModKeyLabels`; re-apply after replacing this |
| `page.button.reset`            | index.html:126      | Reset                                                                                                           |                                                                                                             |
| `page.button.undoReset`        | index.html:127      | Undo reset                                                                                                      |                                                                                                             |
| `page.button.save`             | index.html:140      | Save                                                                                                            |                                                                                                             |
| `page.button.apply`            | index.html:141      | Apply                                                                                                           |                                                                                                             |
| `page.helpNote.html`           | index.html:147      | Confused? Open the <a href="documentation.html">Help and API documentation</a> page                             | markup                                                                                                      |
| `page.footer.credits`          | index.html:151      | Made by Magnus Wolffelt and contributors                                                                        |                                                                                                             |
| `page.footer.version`          | index.html:153      | Version                                                                                                         |                                                                                                             |
| `page.footer.source.html`      | index.html:155      | <a href="https://github.com/EpicDima/elevatorsaga">Source code</a> on GitHub, forked from <a href="https://git… | markup                                                                                                      |
| `page.footer.licences.html`    | index.html:159      | <a href="licenses.txt">Licences</a> for the game and everything it bundles                                      | markup                                                                                                      |
| `page.language.label`          | not yet in the page | Language                                                                                                        | the label of the picker the wiring agent adds; its options are `LOCALE_NAMES`, never translated             |

`page.helpNote.html` is the one link the page shell cannot redirect for a reader, because the
href lives inside the message. The Russian entry therefore points at `documentation.ru.html`
rather than `documentation.html`; every other cross-page link is markup and belongs to
whoever builds the nav.

### documentation.html — 80 strings

| Key                                                 | Where                  | English                                                                                                         | Notes                                                  |
| --------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `docs.page.title`                                   | documentation.html:6   | Elevator Saga - help and API documentation                                                                      |                                                        |
| `docs.page.description`                             | documentation.html:7   | Help and API documentation for Elevator Saga.                                                                   |                                                        |
| `docs.page.tagline`                                 | documentation.html:7   | Help and API documentation                                                                                      |                                                        |
| `docs.nav.label`                                    | documentation.html:22  | Game                                                                                                            |                                                        |
| `docs.nav.back`                                     | documentation.html:23  | Back to the game                                                                                                |                                                        |
| `docs.about.heading`                                | documentation.html:31  | About the game                                                                                                  |                                                        |
| `docs.about.p1.html`                                | documentation.html:33  | This is a game of programming!<br /> Your task is to program the movement of elevators, by writing a program i… | markup                                                 |
| `docs.about.p2.html`                                | documentation.html:38  | The goal is to transport people in an efficient manner.<br /> Depending on how well you do it, you can progres… | markup                                                 |
| `docs.play.heading`                                 | documentation.html:44  | How to play                                                                                                     |                                                        |
| `docs.play.apply.html`                              | documentation.html:46  | Enter your code in the input window below the game view, and press the <span class="emphasis-color">Apply</spa… | markup; takes `{increase}`, `{decrease}`               |
| `docs.play.shortcuts.html`                          | documentation.html:86  | Inside the editor, <kbd data-mod-key>Ctrl</kbd>+<kbd>Enter</kbd> applies your program and restarts the challen… | markup; same `data-mod-key` caveat as `page.hint.html` |
| `docs.play.debugging.html`                          | documentation.html:91  | If your program contains an error, you can use the developer tools in your web browser to try and debug it. If… | markup                                                 |
| `docs.basics.heading`                               | documentation.html:102 | Basics                                                                                                          |                                                        |
| `docs.basics.declare.html`                          | documentation.html:104 | Your code must declare an object containing at least two functions called <span class="emphasis-color">init</s… | markup                                                 |
| `docs.basics.example.code`                          | documentation.html:114 | {                                                                                                               | code; only the comments are translated                 |
| `docs.basics.called.html`                           | documentation.html:118 | These functions will then be called by the game during the challenge.<br /> <span class="emphasis-color">init<… | markup                                                 |
| `docs.basics.initPurpose.html`                      | documentation.html:123 | Normally you will put most of your code in the <span class="emphasis-color">init</span> function, to set up ev… | markup                                                 |
| `docs.basics.noLibraries.html`                      | documentation.html:127 | The game used to load jQuery and lodash, so older solutions you find on the wiki often call <span class="empha… | markup                                                 |
| `docs.examples.heading`                             | documentation.html:139 | Code examples                                                                                                   |                                                        |
| `docs.examples.control.heading`                     | documentation.html:140 | How to control an elevator                                                                                      |                                                        |
| `docs.examples.goToFloor`                           | documentation.html:146 | Tell the elevator to move to floor 1 after completing other tasks, if any. A request for the floor already at … |                                                        |
| `docs.examples.currentFloor`                        | documentation.html:155 | Calling currentFloor gets the floor number that the elevator currently is on. Note that this is a rounded numb… |                                                        |
| `docs.examples.events.heading`                      | documentation.html:161 | Listening for events                                                                                            |                                                        |
| `docs.examples.events.intro.html`                   | documentation.html:163 | It is possible to listen for events, like when stopping at a floor, or a button has been pressed. Elevators an… | markup                                                 |
| `docs.examples.idle`                                | documentation.html:175 | Listen for the "idle" event issued by the elevator, when the task queue has been emptied and the elevator is d… |                                                        |
| `docs.examples.floorButtonPressed`                  | documentation.html:182 | Listen for the "floor_button_pressed" event, issued when a passenger pressed a button inside the elevator. Thi… |                                                        |
| `docs.examples.upButtonPressed`                     | documentation.html:189 | Listen for the "up_button_pressed" event, issued when a passenger pressed the up button on the floor they are … |                                                        |
| `docs.api.heading`                                  | documentation.html:6   | API documentation                                                                                               |                                                        |
| `docs.table.method`                                 | documentation.html:210 | Method                                                                                                          |                                                        |
| `docs.table.property`                               | documentation.html:310 | Property                                                                                                        |                                                        |
| `docs.table.event`                                  | documentation.html:557 | Event                                                                                                           |                                                        |
| `docs.table.type`                                   | documentation.html:311 | Type                                                                                                            |                                                        |
| `docs.table.explanation`                            | documentation.html:211 | Explanation                                                                                                     |                                                        |
| `docs.table.example`                                | documentation.html:212 | Example                                                                                                         |                                                        |
| `docs.api.events.heading`                           | documentation.html:197 | Event methods                                                                                                   |                                                        |
| `docs.api.events.intro`                             | documentation.html:199 | Every elevator and every floor is an event emitter, and these are the methods it gives you. They all return th… |                                                        |
| `docs.api.events.on`                                | documentation.html:220 | Register a listener. Listeners run in the order they were registered, and the same function may be registered … |                                                        |
| `docs.api.events.once`                              | documentation.html:236 | Register a listener that runs at most once and is then removed. It is removed before it runs, so triggering th… |                                                        |
| `docs.api.events.one.html`                          | documentation.html:249 | The older name for <span class="emphasis-color">once</span>, and the one the original game gave you. Same beha… | markup                                                 |
| `docs.api.events.off.html`                          | documentation.html:261 | Remove listeners. With a function, removes just that function, however it was registered; without one, removes… | markup                                                 |
| `docs.api.events.off.example.code`                  | documentation.html:274 | function goHome() { elevator.goToFloor(0); }                                                                    | code; only the comments are translated                 |
| `docs.api.events.offAll.html`                       | documentation.html:281 | Remove every listener <em>you</em> registered, for every event, on that elevator or floor. The listeners the g… | markup                                                 |
| `docs.api.events.outro.html`                        | documentation.html:295 | You rarely need to remove listeners: the elevators and floors are thrown away when a challenge restarts, and y… | markup                                                 |
| `docs.api.elevator.heading`                         | documentation.html:300 | Elevator object                                                                                                 |                                                        |
| `docs.api.elevator.goToFloor.html`                  | documentation.html:322 | Queue the elevator to go to specified floor number. If you specify true as second argument, the elevator will … | markup                                                 |
| `docs.api.elevator.goToFloor.example.code`          | documentation.html:335 | elevator.goToFloor(3); // Do it after anything else -- queue: 3                                                 | code; only the comments are translated                 |
| `docs.api.elevator.stop`                            | documentation.html:346 | Clear the destination queue and stop the elevator if it is moving. Note that you normally don't need to stop e… |                                                        |
| `docs.api.elevator.currentFloor`                    | documentation.html:359 | Gets the floor number that the elevator currently is on.                                                        |                                                        |
| `docs.api.elevator.currentFloor.example.code`       | documentation.html:361 | if(elevator.currentFloor() === 0) {                                                                             | code; only the comments are translated                 |
| `docs.api.elevator.goingUpIndicator`                | documentation.html:371 | Gets or sets the going up indicator, which will affect passenger behaviour when stopping at floors.             |                                                        |
| `docs.api.elevator.goingDownIndicator`              | documentation.html:386 | Gets or sets the going down indicator, which will affect passenger behaviour when stopping at floors.           |                                                        |
| `docs.api.elevator.maxPassengerCount`               | documentation.html:401 | Gets the maximum number of passengers that can occupy the elevator at the same time.                            |                                                        |
| `docs.api.elevator.maxPassengerCount.example.code`  | documentation.html:407 | if(elevator.maxPassengerCount() > 5) {                                                                          | code; only the comments are translated                 |
| `docs.api.elevator.loadFactor`                      | documentation.html:416 | Gets the load factor of the elevator. 0 means empty, 1 means full. Varies with passenger weights, which vary -… |                                                        |
| `docs.api.elevator.loadFactor.example.code`         | documentation.html:422 | if(elevator.loadFactor() < 0.4) {                                                                               | code; only the comments are translated                 |
| `docs.api.elevator.isFull`                          | documentation.html:431 | Gets whether every spot in the elevator is taken. Use this rather than comparing loadFactor to 1 - passenger w… |                                                        |
| `docs.api.elevator.isFull.example.code`             | documentation.html:439 | if(!elevator.isFull()) {                                                                                        | code; only the comments are translated                 |
| `docs.api.elevator.isEmpty`                         | documentation.html:448 | Gets whether the elevator is carrying nobody at all. Not the opposite of isFull - an elevator with one passeng… |                                                        |
| `docs.api.elevator.isEmpty.example.code`            | documentation.html:454 | if(elevator.isEmpty()) {                                                                                        | code; only the comments are translated                 |
| `docs.api.elevator.isApproachingFloor`              | documentation.html:474 | Gets whether the elevator is moving toward the given floor and has not passed it yet. Only the direction of tr… |                                                        |
| `docs.api.elevator.isApproachingFloor.example.code` | documentation.html:487 | if(elevator.isApproachingFloor(2)) {                                                                            | code; only the comments are translated                 |
| `docs.api.elevator.destinationDirection`            | documentation.html:463 | Gets the direction the elevator is currently going to move toward. Can be "up", "down" or "stopped".            |                                                        |
| `docs.api.elevator.destinationQueue`                | documentation.html:496 | The current destination queue, meaning the floor numbers the elevator is scheduled to go to. Can be modified a… |                                                        |
| `docs.api.elevator.checkDestinationQueue`           | documentation.html:513 | Checks the destination queue for any new destinations to go to. Note that you only need to call this if you mo… |                                                        |
| `docs.api.elevator.getPressedFloors`                | documentation.html:524 | Gets the currently pressed floor numbers as an array.                                                           |                                                        |
| `docs.api.elevator.getPressedFloors.example.code`   | documentation.html:526 | if(elevator.getPressedFloors().length > 0) {                                                                    | code; only the comments are translated                 |
| `docs.api.elevator.idle`                            | documentation.html:567 | Triggered when the elevator has completed all its tasks and is not doing anything.                              |                                                        |
| `docs.api.elevator.floorButtonPressed`              | documentation.html:578 | Triggered when a passenger has pressed a button inside the elevator.                                            |                                                        |
| `docs.api.elevator.floorButtonPressed.example.code` | documentation.html:581 | elevator.on("floor_button_pressed", function(floorNum) {                                                        | code; only the comments are translated                 |
| `docs.api.elevator.passingFloor`                    | documentation.html:590 | Triggered slightly before the elevator will pass a floor. A good time to decide whether to stop at that floor.… |                                                        |
| `docs.api.elevator.stoppedAtFloor`                  | documentation.html:601 | Triggered when the elevator has arrived at a floor.                                                             |                                                        |
| `docs.api.elevator.stoppedAtFloor.example.code`     | documentation.html:603 | elevator.on("stopped_at_floor", function(floorNum) {                                                            | code; only the comments are translated                 |
| `docs.api.floor.heading`                            | documentation.html:611 | Floor object                                                                                                    |                                                        |
| `docs.api.floor.floorNum`                           | documentation.html:631 | Gets the floor number of the floor object.                                                                      |                                                        |
| `docs.api.floor.upButtonPressed`                    | documentation.html:669 | Triggered when someone has pressed the up button at a floor. Note that passengers will press the button again … |                                                        |
| `docs.api.floor.upButtonPressed.example.code`       | documentation.html:675 | floor.on("up_button_pressed", function(floor) {                                                                 | code; only the comments are translated                 |
| `docs.api.floor.downButtonPressed`                  | documentation.html:684 | Triggered when someone has pressed the down button at a floor. Note that passengers will press the button agai… |                                                        |
| `docs.api.floor.downButtonPressed.example.code`     | documentation.html:690 | floor.on("down_button_pressed", function(floor) {                                                               | code; only the comments are translated                 |
| `docs.api.floor.buttonStateChange.html`             | documentation.html:699 | Triggered when either call button at a floor was lit or cleared. The handler is passed the state of both butto… | markup                                                 |
| `docs.api.floor.buttonStateChange.example.code`     | documentation.html:710 | floor.on("buttonstate_change", function(buttonStates) {                                                         | code; only the comments are translated                 |

### src/ui/templates.ts — 18 strings

| Key                         | Where                   | English                                        | Notes                                                                                        |
| --------------------------- | ----------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `game.floor.callUp`         | src/ui/templates.ts:127 | Call an elevator going up from floor {floor}   | takes `{floor}`; the source builds `floor ${level}` first; the key takes the number directly |
| `game.floor.callDown`       | src/ui/templates.ts:127 | Call an elevator going down from floor {floor} | takes `{floor}`; the source builds `floor ${level}` first; the key takes the number directly |
| `game.elevator.label`       | src/ui/templates.ts:138 | Elevator {number}                              | takes `{number}`                                                                             |
| `game.elevator.floorButton` | src/ui/templates.ts:151 | Go to floor {floor}                            | takes `{floor}`                                                                              |
| `game.challenge.title.html` | src/ui/templates.ts:251 | Challenge #{number}: {description}             | markup; takes `{number}`, `{description}`                                                    |
| `game.timeScale.decrease`   | src/ui/templates.ts:251 | Decrease simulation speed                      |                                                                                              |
| `game.timeScale.increase`   | src/ui/templates.ts:251 | Increase simulation speed                      |                                                                                              |
| `game.feedback.next`        | src/ui/templates.ts:280 | Next challenge                                 |                                                                                              |
| `game.codeStatus`           | src/ui/templates.ts:293 | There is a problem with your code:             |                                                                                              |

Nine of these were added after the first pass over the file, when the challenge navigation
row and the seed line landed. They are listed separately only because their notes are longer
than the table above wants to be:

| Key                        | Where                   | English                                                                                                                                                 | Notes                                                                                                        |
| -------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `game.challenge.nav.label` | src/ui/templates.ts:416 | Challenges                                                                                                                                              | the `<nav>`'s accessible name                                                                                |
| `game.challenge.nav.link`  | src/ui/templates.ts:207 | Challenge {number}                                                                                                                                      | takes `{number}`; the accessible name of an entry whose visible text is the bare digit                       |
| `game.challenge.nav.demo`  | src/ui/templates.ts:206 | Demo                                                                                                                                                    | both the visible label and the accessible name of the endless-demo entry                                     |
| `game.seed.label`          | src/ui/templates.ts:319 | Seed                                                                                                                                                    | the word before the number, not a control                                                                    |
| `game.seed.link`           | src/ui/templates.ts:316 | Seed {seed}: start another run from this seed                                                                                                           | takes `{seed}`; accessible name of the seed when the URL does not pin it                                     |
| `game.seed.newDraw`        | src/ui/templates.ts:317 | new draw                                                                                                                                                | visible label, and the same two words appear inside `game.seed.newDrawLink` — WCAG 2.5.3 requires they match |
| `game.seed.newDrawLink`    | src/ui/templates.ts:317 | Seed {seed}: new draw, start again without it                                                                                                           | takes `{seed}`; accessible name of the control that unpins                                                   |
| `game.seed.helpSummary`    | src/ui/templates.ts:359 | what a seed does                                                                                                                                        | the `<summary>` of the caveat disclosure                                                                     |
| `game.seed.explanation`    | src/ui/templates.ts:263 | The same seed brings the same passengers, in the same order. Frame timing comes from the browser, so the run around them is never quite the same twice. | `SEED_EXPLANATION`; a paragraph, not a tooltip — it used to be a `title` attribute and no longer is          |

The seed itself is a placeholder in both accessible names and never part of the sentence: it
is the token a player transcribes in order to hand a building to somebody else, so it reads
identically in every locale. Both names repeat it because an accessible name has to stand on
its own — "1234567890, link" describes nothing.

### src/ui/presenters.ts — 7 strings

| Key                        | Where                    | English                       | Notes                                                           |
| -------------------------- | ------------------------ | ----------------------------- | --------------------------------------------------------------- |
| `game.timeScale.value`     | src/ui/presenters.ts:181 | {value}x                      | takes `{value}`; Russian writes `×`, not the Latin letter x     |
| `game.button.start`        | src/ui/presenters.ts:256 | Start                         |                                                                 |
| `game.button.pause`        | src/ui/presenters.ts:256 | Pause                         |                                                                 |
| `game.button.restart`      | src/ui/presenters.ts:254 | Restart                       | rendered after an icon, as `" Restart"`; keep the leading space |
| `error.thrown.emptyString` | src/ui/presenters.ts:503 | Thrown empty string           |                                                                 |
| `error.thrown.noMessage`   | src/ui/presenters.ts:480 | Thrown {kind} with no message | takes `{kind}`                                                  |
| `error.thrown.keys`        | src/ui/presenters.ts:481 | {kind} with keys: {keys}      | takes `{kind}`, `{keys}`                                        |

### src/app/app.ts — 4 strings

| Key                             | Where              | English                                  | Notes |
| ------------------------------- | ------------------ | ---------------------------------------- | ----- |
| `game.feedback.success.title`   | src/app/app.ts:391 | Success!                                 |       |
| `game.feedback.success.message` | src/app/app.ts:392 | Challenge completed                      |       |
| `game.feedback.failure.title`   | src/app/app.ts:402 | Challenge failed                         |       |
| `game.feedback.failure.message` | src/app/app.ts:403 | Maybe your program needs an improvement? |       |

### src/main.ts — 3 strings

| Key                       | Where          | English                                                      | Notes                                                                           |
| ------------------------- | -------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `editor.saved`            | src/main.ts:60 | Code saved {time}                                            | takes `{time}`; today `toTimeString()`; `formatTime` drops the time zone suffix |
| `editor.confirmReset`     | src/main.ts:72 | Do you really want to reset to the default implementation?   |                                                                                 |
| `editor.confirmUndoReset` | src/main.ts:78 | Do you want to bring back the code as before the last reset? |                                                                                 |

### src/ui/editor.ts — 1 strings

| Key            | Where                | English          | Notes |
| -------------- | -------------------- | ---------------- | ----- |
| `editor.label` | src/ui/editor.ts:283 | Elevator program |       |

### src/ui/default-code.ts — 1 strings

| Key                       | Where                     | English | Notes                                  |
| ------------------------- | ------------------------- | ------- | -------------------------------------- |
| `editor.defaultCode.code` | src/ui/default-code.ts:19 | {       | code; only the comments are translated |

### src/game/challenges.ts — 14 strings

| Key                                             | Where                      | English                                                                                                     | Notes                                                                                                                                   |
| ----------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `challenge.transportWithinTime.html`            | src/game/challenges.ts:55  | Transport {people} in {time} or less                                                                        | markup; takes `{people}`, `{time}`                                                                                                      |
| `challenge.transportWithMaxWait.html`           | src/game/challenges.ts:78  | Transport {people} and let no one wait more than {waitTime}                                                 | markup; takes `{people}`, `{waitTime}`                                                                                                  |
| `challenge.transportWithinTimeWithMaxWait.html` | src/game/challenges.ts:103 | Transport {people} in {time} or less and let no one wait more than {waitTime}                               | markup; takes `{people}`, `{time}`, `{waitTime}`                                                                                        |
| `challenge.transportWithinMoves.html`           | src/game/challenges.ts:134 | Transport {people} using {moves} or less                                                                    | markup; takes `{people}`, `{moves}`                                                                                                     |
| `challenge.demo`                                | src/game/challenges.ts:152 | Perpetual demo                                                                                              |                                                                                                                                         |
| `challenge.people.html`                         | src/game/challenges.ts:55  | <span class='emphasis-color'>{count}</span> people                                                          | plural (one, other); markup; takes `{count}`; shared by all four challenge sentences                                                    |
| `challenge.timeLimit.html`                      | src/game/challenges.ts:55  | <span class='emphasis-color'>{count}</span> seconds                                                         | plural (one, other); markup; takes `{count}`                                                                                            |
| `challenge.waitLimit.html`                      | src/game/challenges.ts:78  | <span class='emphasis-color'>{count}</span> seconds                                                         | plural (one, other); markup; takes `{count}`                                                                                            |
| `challenge.moveLimit.html`                      | src/game/challenges.ts:134 | <span class='emphasis-color'>{count}</span> elevator moves                                                  | plural (one, other); markup; takes `{count}`                                                                                            |
| `challenge.sandbox.html`                        | src/game/challenges.ts:211 | Sandbox: {floors}, {elevators} of {capacityLabel} {capacities}, {spawnRate}. No goal, so the run never ends | markup; takes `{floors}`, `{elevators}`, `{capacityLabel}`, `{capacities}`, `{spawnRate}`; composed from the four sandbox phrases below |
| `challenge.sandbox.floors.html`                 | src/game/challenges.ts:209 | <span class='emphasis-color'>{count}</span> floors                                                          | plural (one, other); markup; takes `{count}`                                                                                            |
| `challenge.sandbox.elevators.html`              | src/game/challenges.ts:210 | <span class='emphasis-color'>{count}</span> elevators                                                       | plural (one, other); markup; takes `{count}`                                                                                            |
| `challenge.sandbox.capacityLabel`               | src/game/challenges.ts:206 | capacities                                                                                                  | plural (one, other)                                                                                                                     |
| `challenge.sandbox.spawnRate.html`              | src/game/challenges.ts:211 | <span class='emphasis-color'>{count}</span> people per second                                               | plural (one, other); markup; takes `{count}`; one English form for both categories, preserving today's `1 people per second`            |

### src/ui/completions.ts — 32 strings

| Key                                            | Where                     | English                                                                                                         | Notes                                  |
| ---------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `completion.events.on`                         | src/ui/completions.ts:74  | Register a listener. Several event names separated by spaces register the same listener for all of them, and i… |                                        |
| `completion.events.once`                       | src/ui/completions.ts:80  | Register a listener that runs at most once and is then removed. Takes a single event name.                      |                                        |
| `completion.events.one`                        | src/ui/completions.ts:86  | The older name for once, and the one the original game gave you. Same behaviour, single event name as well.     |                                        |
| `completion.events.off`                        | src/ui/completions.ts:92  | Remove listeners. With a function, removes just that function; without one, removes every listener of the name… |                                        |
| `completion.events.offAll`                     | src/ui/completions.ts:98  | Remove every listener you registered, for every event, on that elevator or floor. The listeners the game itsel… |                                        |
| `completion.elevator.goToFloor`                | src/ui/completions.ts:118 | Queue the elevator to go to specified floor number. If you specify true as second argument, the elevator will … |                                        |
| `completion.elevator.stop`                     | src/ui/completions.ts:124 | Clear the destination queue and stop the elevator if it is moving. Note that the elevator will probably not st… |                                        |
| `completion.elevator.currentFloor`             | src/ui/completions.ts:130 | Gets the floor number that the elevator currently is on. Note that this is a rounded number and does not neces… |                                        |
| `completion.elevator.goingUpIndicator`         | src/ui/completions.ts:136 | Gets or sets the going up indicator, which will affect passenger behaviour when stopping at floors.             |                                        |
| `completion.elevator.goingDownIndicator`       | src/ui/completions.ts:142 | Gets or sets the going down indicator, which will affect passenger behaviour when stopping at floors.           |                                        |
| `completion.elevator.maxPassengerCount`        | src/ui/completions.ts:148 | Gets the maximum number of passengers that can occupy the elevator at the same time.                            |                                        |
| `completion.elevator.loadFactor`               | src/ui/completions.ts:154 | Gets the load factor of the elevator. 0 means empty, 1 means full. Varies with passenger weights, which vary -… |                                        |
| `completion.elevator.isFull`                   | src/ui/completions.ts:160 | Gets whether every spot in the elevator is taken. Use this rather than comparing loadFactor to 1 - passenger w… |                                        |
| `completion.elevator.isEmpty`                  | src/ui/completions.ts:166 | Gets whether the elevator is carrying nobody at all. Not the opposite of isFull - an elevator with one passeng… |                                        |
| `completion.elevator.destinationDirection`     | src/ui/completions.ts:172 | Gets the direction the elevator is currently going to move toward.                                              |                                        |
| `completion.elevator.isApproachingFloor`       | src/ui/completions.ts:178 | Gets whether the elevator is moving toward the given floor and has not passed it yet. Only the direction of tr… |                                        |
| `completion.elevator.destinationQueue`         | src/ui/completions.ts:184 | The current destination queue, meaning the floor numbers the elevator is scheduled to go to. Can be modified a… |                                        |
| `completion.elevator.checkDestinationQueue`    | src/ui/completions.ts:190 | Checks the destination queue for any new destinations to go to. Note that you only need to call this if you mo… |                                        |
| `completion.elevator.getPressedFloors`         | src/ui/completions.ts:196 | Gets the currently pressed floor numbers as an array.                                                           |                                        |
| `completion.floor.floorNum`                    | src/ui/completions.ts:216 | Gets the floor number of the floor object.                                                                      |                                        |
| `completion.elevator.event.idle`               | src/ui/completions.ts:240 | Triggered when the elevator has completed all its tasks and is not doing anything.                              |                                        |
| `completion.elevator.event.floorButtonPressed` | src/ui/completions.ts:244 | Triggered when a passenger has pressed a button inside the elevator.                                            |                                        |
| `completion.elevator.event.passingFloor`       | src/ui/completions.ts:248 | Triggered slightly before the elevator will pass a floor. A good time to decide whether to stop at that floor.… |                                        |
| `completion.elevator.event.stoppedAtFloor`     | src/ui/completions.ts:252 | Triggered when the elevator has arrived at a floor.                                                             |                                        |
| `completion.floor.event.upButtonPressed`       | src/ui/completions.ts:266 | Triggered when someone has pressed the up button at a floor. Note that passengers will press the button again … |                                        |
| `completion.floor.event.downButtonPressed`     | src/ui/completions.ts:270 | Triggered when someone has pressed the down button at a floor. Note that passengers will press the button agai… |                                        |
| `completion.floor.event.buttonStateChange`     | src/ui/completions.ts:274 | Either call button was lit or cleared.                                                                          |                                        |
| `completion.global.skeleton`                   | src/ui/completions.ts:340 | Your code must declare an object containing at least two functions called init and update.                      |                                        |
| `completion.global.init`                       | src/ui/completions.ts:347 | Called when the challenge starts. Normally you will put most of your code in here, to set up event listeners a… |                                        |
| `completion.global.update`                     | src/ui/completions.ts:354 | Called repeatedly during the challenge. dt is the number of game seconds that passed since the last time updat… |                                        |
| `completion.initSkeleton.code`                 | src/ui/completions.ts:311 | init: function(elevators, floors) {                                                                             | code; only the comments are translated |
| `completion.updateSkeleton.code`               | src/ui/completions.ts:314 | update: function(dt, elevators, floors) {                                                                       | code; only the comments are translated |

### src/app/fitness.ts — 7 strings

| Key                     | Where                  | English                                                                                                         | Notes                                               |
| ----------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `fitness.measuring`     | src/app/fitness.ts:33  | Measuring fitness...                                                                                            |                                                     |
| `fitness.results`       | src/app/fitness.ts:192 | Fitness avg wait times: {results}                                                                               | takes `{results}`                                   |
| `fitness.result`        | src/app/fitness.ts:188 | {scenario}: {value}                                                                                             | takes `{scenario}`, `{value}`                       |
| `fitness.unknownValue`  | src/app/fitness.ts:187 | ?                                                                                                               | shown when a scenario produced no average wait time |
| `fitness.error`         | src/app/fitness.ts:183 | Could not compute fitness due to error: {error}                                                                 | takes `{error}`                                     |
| `fitness.workerTimeout` | src/app/fitness.ts:145 | The fitness worker did not finish within {seconds} and was stopped. Does your program have a loop that never e… | takes `{seconds}`                                   |
| `fitness.workerFailed`  | src/app/fitness.ts:168 | The fitness worker failed                                                                                       |                                                     |

### src/game/fitness.ts — 3 strings

| Key                       | Where                   | English         | Notes |
| ------------------------- | ----------------------- | --------------- | ----- |
| `fitness.scenario.small`  | src/game/fitness.ts:88  | Small scenario  |       |
| `fitness.scenario.medium` | src/game/fitness.ts:93  | Medium scenario |       |
| `fitness.scenario.large`  | src/game/fitness.ts:103 | Large scenario  |       |

### src/game/user-code.ts — 2 strings

| Key                   | Where                    | English                              | Notes                                     |
| --------------------- | ------------------------ | ------------------------------------ | ----------------------------------------- |
| `error.code.noInit`   | src/game/user-code.ts:47 | Code must contain an init function   | thrown, then shown in the code status bar |
| `error.code.noUpdate` | src/game/user-code.ts:50 | Code must contain an update function | thrown, then shown in the code status bar |

### src/game/elevator-interface.ts — 4 strings

| Key                             | Where                              | English                                                                                                         | Notes                                                                    |
| ------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `error.elevator.notAFloor`      | src/game/elevator-interface.ts:432 | elevator.{method} was called with {value}, which is not a floor number. It takes a finite number, and this bui… | takes `{method}`, `{value}`, `{topFloor}`                                |
| `error.elevator.queueNotAFloor` | src/game/elevator-interface.ts:399 | elevator.destinationQueue contained {value}, which is not a floor number. The entry was dropped so the elevato… | takes `{value}`, `{topFloor}`                                            |
| `error.value.array`             | src/game/elevator-interface.ts:104 | an array                                                                                                        | goes into `error.elevator.notAFloor` and `error.elevator.queueNotAFloor` |
| `error.value.object`            | src/game/elevator-interface.ts:107 | an object                                                                                                       | goes into `error.elevator.notAFloor` and `error.elevator.queueNotAFloor` |

### src/game/movable.ts — 1 strings

| Key                  | Where                  | English                                  | Notes |
| -------------------- | ---------------------- | ---------------------------------------- | ----- |
| `error.movable.busy` | src/game/movable.ts:41 | Object is busy - you should use callback |       |

## Deliberately not translated

Not everything a string literal holds is a message to a player. These were looked at and
left in English on purpose; translating them would cost work and buy nothing, and in some
cases would do harm.

| Where                                                                                                  | What                                                                                                                                | Why                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/app.ts:185`, `src/game/world-controller.ts:196`                                               | `World raised code error`, `Usercode error on update`                                                                               | `console` diagnostics. The player sees the same failure translated in the code status bar; the console line is for whoever is reading a stack next to it. |
| `src/game/movable.ts:160`                                                                              | `Attempt to use movable while it was busy`                                                                                          | `console` diagnostic accompanying `error.movable.busy`, which _is_ keyed.                                                                                 |
| `src/game/observable.ts:181`                                                                           | `Event error handler threw while reporting`                                                                                         | `console` diagnostic about the game's own error reporting failing.                                                                                        |
| `src/app/fitness.ts:111`                                                                               | `Fitness worker creation failed, running on the main thread instead`                                                                | `console` diagnostic; the player sees only the result.                                                                                                    |
| `src/game/elevator.ts:496`                                                                             | The `destinationDirection` deprecation warning                                                                                      | Addressed to code, quoting an API name, and printed once per session.                                                                                     |
| `src/app/router.ts:349, 375, 392, 427, 451, 482, 489, 512, 531`                                        | The sandbox URL warnings                                                                                                            | Addressed to whoever hand-wrote the URL, quoting parameter names that are themselves English.                                                             |
| `src/ui/dom.ts:39`, `src/ui/templates.ts:107`, `src/ui/presenters.ts:95`                               | `Missing required element`, `Expected markup describing exactly one element`, `Expected the user template to render an SVG element` | Invariants. If a player ever reads one, the bug is that it was thrown, not that it was in English.                                                        |
| `src/game/fitness.ts:78`                                                                               | `No requirement`                                                                                                                    | The benchmark's placeholder condition. Nothing renders a challenge bar during a benchmark, so it never reaches a screen.                                  |
| `src/ui/completions.ts` `detail` and `label` fields                                                    | `(floorNum, directly)`, `elevator.goToFloor`, …                                                                                     | Signatures and identifiers. The editor completes real API names; translating them would suggest code that does not exist. Only the `info` prose is keyed. |
| `src/ui/shortcuts.ts:24`                                                                               | `⌘` / `Ctrl`                                                                                                                        | Key names. Russian keyboards are labelled `Ctrl` too.                                                                                                     |
| `index.html:4`, `index.html:5`, `documentation.html:4`                                                 | `charset`, `viewport`                                                                                                               | Machine values, not prose.                                                                                                                                |
| `documentation.html:26`                                                                                | `Русский`                                                                                                                           | A language's own name. `LOCALE_NAMES` in `src/i18n/locale.ts` holds these; they are the same in every locale by definition.                               |
| `documentation.html:179`, `documentation.html:186`, and the other one-line snippets in _Code examples_ | `elevator.on("floor_button_pressed", function(floorNum) { ... } );`                                                                 | Code with no comments in it. Nothing to translate.                                                                                                        |
| `src/game/test-helpers.ts`, `*.test.ts`, `e2e/`                                                        | Test messages                                                                                                                       | Read by whoever ran the tests.                                                                                                                            |
| `licenses.txt`                                                                                         | Licence texts                                                                                                                       | Legal texts are quoted, not translated.                                                                                                                   |

## What could not be keyed cleanly

Five places where the English source resists a one-string-one-key mapping. All five are
keyed; this is what the wiring agent should know about them.

1. **Challenge descriptions are built from parts.** The four builders in
   `src/game/challenges.ts` (lines 55, 78, 103 and 134) each interpolate two or three
   counted phrases into one sentence, and every phrase needs its own plural. One key per
   sentence, plus one key per phrase
   (`challenge.people.html`, `challenge.timeLimit.html`, `challenge.waitLimit.html`,
   `challenge.moveLimit.html`), rendered inside out:

   ```ts
   t("challenge.transportWithinTime.html", {
     people: t("challenge.people.html", { count: userCount }),
     time: t("challenge.timeLimit.html", { count: timeLimit }),
   });
   ```

   The alternative — one key per sentence with `{count}` in it — cannot work: a message
   has one plural category, and these sentences count two different things.

2. **`1 people per second`.** The sandbox description at `src/game/challenges.ts:211`
   pluralises floors and elevators but not the spawn rate, so a rate of exactly 1 reads
   `1 people per second` today. `challenge.sandbox.spawnRate.html` reproduces that by
   giving both English categories the same text; Russian declines it properly. Fixing the
   English is a one-word edit to `en.ts` whenever someone wants the wording changed rather
   than preserved.

3. **`" Restart"` carries a leading space.** `src/ui/presenters.ts:254` writes the label
   after an icon node, and the space is the gap between them. `game.button.restart` is the
   word alone, so the call site keeps the separator:

   ```ts
   startStop.replaceChildren(createIcon("repeat"), ` ${t("game.button.restart")}`);
   ```

4. **One `<h1>`, two strings.** The heading at `index.html:52` puts the game's name and
   its tagline in one element. They are keyed as `page.brand` and `page.tagline`, because
   the brand is a name that stays English and the tagline is prose that does not.

5. **The docs and the editor say the same thing twice.** `completion.elevator.goToFloor`
   is the first two sentences of `docs.api.elevator.goToFloor.html`, without markup. They
   are separate keys on purpose: one is plain text in a completion popup, the other is
   markup in a table, and the docs entry has since grown detail the popup does not want.
   Whoever edits one should read the other.

## What the wiring agent must change

### Before anything renders — `src/main.ts`

```ts
import { browserLocaleSources, htmlLang, resolveLocale, setLocale } from "./i18n/index.ts";

const locale = resolveLocale(browserLocaleSources());
setLocale(locale);
document.documentElement.lang = htmlLang(locale);
```

`resolveLocale` takes `#lang=ru` from the hash first, then `localStorage`, then
`navigator.languages`, then English. `browserLocaleSources` reads each of the three behind
its own `catch`, so a browser that throws on `localStorage` — Safari in a private window,
or any browser told to block site data — falls through to the next source instead of
failing to start. `storeLocale(localStorage, locale)` is there for a language picker; it
returns `false` rather than throwing when it cannot write.

Two ordering traps:

- **Modules that build their strings at import time run before this.**
  `src/game/challenges.ts:243` builds `challenges` as a module constant, so every
  description is rendered the moment the module is imported — before `main.ts` has a body
  to run. The same is true of the completion lists in `src/ui/completions.ts` and the
  scenario descriptions in `src/game/fitness.ts:85`. Each needs to become a function
  called after the locale is known (`createChallenges()`, `createCompletions()`), or its
  descriptions need to be lazy.
- **The fitness worker is a second module instance.** `src/app/fitness.ts` posts the
  player's source to `src/app/fitness-worker.ts`, and `doFitnessSuite` builds the run
  descriptions inside the worker, where the active locale is whatever that instance
  defaults to — English. Either send the locale with `FitnessWorkerRequest` and
  `setLocale` on arrival, or send scenario identifiers back and translate on the main
  thread.

`#lang=ru` needs nothing from `src/app/router.ts`: `parseQuery` keeps unknown keys and
round-trips them into the next-challenge link, so the language survives finishing a
challenge.

### `index.html` — 31 strings

Static markup, so the wiring needs a pass that walks the document once at start-up. Adding
`data-i18n="page.button.save"` attributes and a single loop in `main.ts` keeps the markup
readable; explicit `requireElement` writes work too and are wordier.

- `index.html:2` — `<html lang="en">` must become `htmlLang(locale)` at run time.
- `page.title` and `page.description` are `<title>` and `<meta name="description">`.
- `page.stats.movesTitle` is a `title` attribute, `page.imageAlt` an `alt`,
  `page.nav.label` and `page.world.label` are `aria-label`s.
- `page.hint.html`, `page.helpNote.html`, `page.footer.source.html` and
  `page.footer.licences.html` contain markup: assign with `innerHTML`.
- **After replacing `page.hint.html`, run `applyModKeyLabels` again.** The `<kbd
data-mod-key>` elements are rewritten to `⌘` at start-up, and writing new HTML into that
  paragraph throws the substitution away.
- `page.language.label` has no element yet: the picker is the one piece of markup this
  wiring adds rather than translates. It belongs in the header nav, whose accessible name is
  already `page.nav.label`. Its options come from `LOCALE_NAMES` in `src/i18n/locale.ts` and
  are never translated — a reader who needs Русский has to be able to find it while the
  interface is still English. Choosing one should call `storeLocale` and then reload, or
  re-render everything; a reload is honest here, since the challenge in progress is already
  addressed by the URL and the editor's buffer is already in local storage.
- The two nav links at `index.html:54-55` both point at `documentation.html`. In Russian
  they should point at `documentation.ru.html`. The documentation pages already carry a link
  to each other, so this is the only place the pairing is missing.

### `documentation.html` — 80 strings

The same mechanism, at four times the size, plus `<html lang>` at line 2. The `.code`
blocks keep their code and change only their comments. See the overlap note below before
starting.

### `src/ui/templates.ts` — 18 strings

Note that `markup` escapes its interpolations: a plain key is safe to interpolate directly,
and an `.html` key must go through `raw()`. `floorTemplate` currently builds `floor ${level}`
and drops it into two labels; `game.floor.callUp` and `game.floor.callDown` take `{floor}` as
a number instead, so the local `where` disappears.

The nine strings added since the first pass — the challenge navigation row and the seed line
— have two constraints the rest do not:

- `game.seed.newDraw` is both the visible label and two words inside `game.seed.newDrawLink`.
  They have to keep saying the same thing in every locale (WCAG 2.5.3): a speech-input user
  says what they can see. If a translation changes one, it changes both.
- `SEED_EXPLANATION` at line 263 is a module constant. It is read inside
  `seedHelpTemplate()`, which runs per render, so moving it to `t("game.seed.explanation")`
  at the point of use is correct — but do not leave a `const SEED_EXPLANATION = t(...)` at
  module scope, which would freeze English at import time. The same trap is described under
  `src/game/challenges.ts` below, and it is the single most likely way for this wiring to
  half-work.

### `src/ui/presenters.ts` — 7 strings

Lines 254, 256, 480, 481, 503 for text, plus the number formatting the panel does by hand:

- `presenters.ts:116-119` write `${world.elapsedTime.toFixed(0)}s`,
  `transportedPerSec.toPrecision(3)`, and two `toFixed(1)` wait times. These want
  `format(seconds(world.elapsedTime))` and `format(decimal(world.avgWaitTime, 1))`, which
  is what gives Russian `1,5 с` with a non-breaking space instead of `1.5s`.
- `presenters.ts:181` renders the time scale as `${value}x`; `game.timeScale.value` is
  `{value}x` in English and `{value}×` in Russian.

### `src/app/app.ts` — 4 strings

Lines 391, 392, 402, 403 — the four feedback strings. This is also the natural home for
the locale preference, next to `TIME_SCALE_STORAGE_KEY`: `LOCALE_STORAGE_KEY` and
`readStoredLocale` are shaped after `readStoredTimeScale` deliberately.

### `src/main.ts` — 3 strings

Lines 60, 72, 78. `main.ts:60` builds `Code saved ${savedAt.toTimeString()}`;
`t("editor.saved", { time: formatTime(savedAt) })` renders `21:03:57` where
`toTimeString()` rendered `21:03:57 GMT+0300 (Moscow Standard Time)`. That is a visible
improvement, but it is a change.

### `src/ui/editor.ts`, `src/ui/default-code.ts`

`editor.ts:283` is the editor's `aria-label`. `default-code.ts:19` is the program a player
starts with: `editor.defaultCode.code` translates its comments and leaves every identifier
alone.

### `src/game/challenges.ts` — 14 strings

The five description builders and the sandbox. See _What could not be keyed cleanly_ for
how the counted phrases compose, and the import-time trap above.

### `src/ui/completions.ts` — 32 strings

Only the `info` prose is keyed; `label` and `detail` stay as they are.

### `src/app/fitness.ts`, `src/game/fitness.ts` — 10 strings

`fitness.ts:187` is the `?` shown when a scenario produced no average wait time, and
`fitness.ts:188` the `{scenario}: {value}` line it goes into. The `s` suffix on
`avgWaitTime.toPrecision(3)` at line 187 should become `format(seconds(...))` for the same
reason as the statistics panel.

### `src/game/user-code.ts`, `src/game/elevator-interface.ts`, `src/game/movable.ts`

Six error messages the player reads in the code status bar. `error.value.array` and
`error.value.object` are phrases that compose into `error.elevator.notAFloor` and
`error.elevator.queueNotAFloor`.

## What changes on screen once this is wired

Even in English, routing text through the catalogue changes four things. All four are
improvements, and all four are visible:

1. **Grouped thousands.** Challenge 18 asks for 2675 people and renders `2675` today;
   `Intl.NumberFormat` renders `2,675` in English and `2 675` in Russian.
2. **The saved-code time** loses its `GMT+0300 (Moscow Standard Time)` tail.
3. **Fractional time scales** already render as `0.5x`; in Russian they render `0,5×`.
4. **Non-breaking spaces** appear between numbers and unit abbreviations in Russian, so
   `60 с` cannot break across a line.

## Known overlap: `documentation.ru.html`

While this catalogue was being written, another change added `documentation.ru.html` — a
separate, fully translated Russian copy of the documentation page, with `hreflang`
alternates linking the pair. That covers the same ground as the 80 `docs.*` keys here, by
a different route: a static file per language instead of one document translated at run
time.

Both approaches work; keeping both would mean maintaining the Russian documentation twice.
Whoever wires this up should choose:

- **Keep the static pages** and drop the `docs.*` keys from the catalogue, or generate
  `documentation.ru.html` from them at build time. The `docs.*` keys have no other call
  site, so removing them touches nothing else.
- **Keep the catalogue** and reduce `documentation.ru.html` to a redirect.

Whichever wins, the two Russian translations should be compared first: they were written
independently and will not have chosen the same words everywhere.

## Adding a language

One file, plus two lines that the compiler demands anyway:

1. Add the code to `Locale` and `LOCALES` in `src/i18n/locale.ts`, and its endonym to
   `LOCALE_NAMES`.
2. Add the plural categories `Intl` gives that language to `PLURAL_CATEGORIES` in
   `src/i18n/format.ts`. `src/i18n/format.test.ts` checks the list against ICU, so a wrong
   guess fails a test rather than mistranslating a count.
3. Write `src/i18n/<code>.ts` as `MessageCatalogue<"<code>">`. Every missing key, every
   extra key and every missing plural form is a compile error.
4. Register it in `CATALOGUES` in `src/i18n/index.ts`.

The tests in `src/i18n/catalogue.test.ts` then check the new catalogue for key parity,
placeholder parity, markup that matches the English structure, and example code that is
identical to the English but for its comments.
