# Localisation inventory

Every string the game shows a player, the key it now has in `src/i18n/`, and where it is
still hardcoded. This is the checklist for wiring the catalogue into the page — part map of
work to do, part record of work done.

**Wiring status.** Ninety-three of the 209 keys are live, and the mechanism is finished.
The game draws itself from the catalogue: the challenge bar, the building, the statistics
panel, the feedback overlay, the editor's own messages and every error a player's code can
raise call `t` at the moment they are drawn. So does the page shell — `index.html` carries
`data-i18n` attributes that `src/ui/localise-page.ts` rewrites once a catalogue is in
memory. So does start-up: `src/main.ts:63` awaits `applyPreferredLocale`, which resolves
the language from `#lang=`, storage and `navigator.languages`, fetches that catalogue and
writes the shell before anything is drawn, so nothing is ever shown in one language and
replaced in another.

What is left is 116 keys in three places, none of which is the mechanism:

- the 81 `docs.*` keys, which nothing calls, because `documentation.html` and
  `documentation.ru.html` still answer for that page as two static files rather than one
  document translated at run time — see _Known overlap_, which is now a decision deferred
  rather than a decision pending, since `src/page.test.ts` holds the two in step;
- the 32 `completion.*` keys, which `src/ui/completions.ts` cannot use because it has never
  imported `t` at all — its `info` prose is still 32 English strings in module-scope const
  arrays. This is task #60, and it is the last place the import-time trap below is live;
- `editor.defaultCode.code`, which exists translated in both catalogues and has no call
  site, because `src/ui/default-code.ts` still carries the same program in English as
  `DEFAULT_CODE`. This is task #61.

There is also no language picker: `page.language.label` is in the catalogue and has no
element to name, so a reader changes language by changing the browser's, or by putting
`#lang=ru` in the address bar.

Rows below are marked **wired** where the call site already reads from the catalogue.

The catalogue holds **209 keys**, in two locales: `src/i18n/en.ts` is the reference — its
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
| `src/i18n/index.ts`     | `t`, `translateIn`, `getLocale`, `setLocale`, `loadLocale`, `isLocaleLoaded`, `format`, `formatTime`, `CATALOGUE_LOADERS`                                      |

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
- **Where** — `file:line`, re-pinned against commit `2f357de`. For a wired row that is the
  call site: the `t(...)` that renders the message, or the element whose `data-i18n`
  attribute names it. For a row that is not wired it is the English itself, still written
  out where the wiring will have to find it. Line numbers rot, and 174 of the 209 rows had
  to be moved in this pass — `challenge.sandbox.spawnRate.html` by 67 lines, `editor.label`
  by 471 — so search for the key, or for the text, if a line has moved again.
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

| File                             | Strings | Status                |
| -------------------------------- | ------- | --------------------- |
| `documentation.html`             | 81      | hardcoded             |
| `src/ui/completions.ts`          | 32      | hardcoded (#60)       |
| `index.html`                     | 31      | **29 wired**          |
| `src/ui/templates.ts`            | 18      | **wired**             |
| `src/game/challenges.ts`         | 14      | **wired**             |
| `src/ui/presenters.ts`           | 7       | **wired**             |
| `src/app/fitness.ts`             | 6       | **wired**             |
| `src/main.ts`                    | 4       | **wired**             |
| `src/app/app.ts`                 | 4       | **wired**             |
| `src/game/elevator-interface.ts` | 4       | **wired**             |
| `src/game/fitness.ts`            | 3       | **wired**             |
| `src/game/user-code.ts`          | 2       | **wired**             |
| `src/ui/editor.ts`               | 1       | **wired**             |
| `src/ui/default-code.ts`         | 1       | hardcoded (#61)       |
| `src/game/movable.ts`            | 1       | **wired**             |
| nowhere yet                      | 1       | `page.language.label` |
| **Total**                        | **209** | **93 wired**          |

Two of `index.html`'s thirty-one are not counted as wired, for different reasons.
`page.noscript` is unreachable by design — a browser with scripting on parses the children
of `<noscript>` as text, so there is no element to write into, and a browser with scripting
off has nothing to write with; the key is kept for the day the build renders the shell per
language, and `index.html` says so where the message is. `page.language.label` names a
control nobody has built yet.

`src/main.ts` gained a string rather than losing one: `fitness.measuring` is set on the
panel beside the editor, which is this file's business, so its call site moved here out of
`src/app/fitness.ts` when the benchmark stopped touching the document.

## The strings

### index.html — 31 strings, 29 wired

| Key                            | Where               | English                                                                                                         | Notes                                                                                                                                 |
| ------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `page.title`                   | index.html:14       | Elevator Saga - the elevator programming game                                                                   | **wired**; also the `og:title` at index.html:39                                                                                       |
| `page.description`             | index.html:18       | Elevator Saga is a programming game: write JavaScript to transport people efficiently.                          | **wired**; also the `og:description` at index.html:44                                                                                 |
| `page.imageAlt`                | index.html:50       | Four elevators carrying people between six floors, with the JavaScript program driving them in the editor belo… | **wired**; an `alt` attribute                                                                                                         |
| `page.skipLink`                | index.html:63       | Skip to the code editor                                                                                         | **wired**                                                                                                                             |
| `page.brand`                   | index.html:68       | Elevator Saga                                                                                                   | **wired**                                                                                                                             |
| `page.tagline`                 | index.html:69       | The elevator programming game                                                                                   | **wired**                                                                                                                             |
| `page.nav.label`               | index.html:71       | Help and reference                                                                                              | **wired**; an `aria-label`                                                                                                            |
| `page.nav.help`                | index.html:72       | Help                                                                                                            | **wired**                                                                                                                             |
| `page.nav.documentation`       | index.html:73       | Documentation                                                                                                   | **wired**                                                                                                                             |
| `page.nav.wiki`                | index.html:74       | Wiki & Solutions                                                                                                | **wired**                                                                                                                             |
| `page.noscript`                | index.html:89       | Your browser does not appear to support JavaScript. This page contains a browser-based programming game implem… | not wired, and cannot be: see the note under _Where the strings are_                                                                  |
| `page.world.label`             | index.html:110      | Building                                                                                                        | **wired**; an `aria-label`                                                                                                            |
| `page.stats.label`             | index.html:125      | Simulation statistics                                                                                           | **wired**; an `aria-label`                                                                                                            |
| `page.stats.transported`       | index.html:128      | Transported                                                                                                     | **wired**                                                                                                                             |
| `page.stats.elapsedTime`       | index.html:132      | Elapsed time                                                                                                    | **wired**                                                                                                                             |
| `page.stats.transportedPerSec` | index.html:136      | Transported/s                                                                                                   | **wired**                                                                                                                             |
| `page.stats.avgWaitTime`       | index.html:140      | Avg waiting time                                                                                                | **wired**                                                                                                                             |
| `page.stats.maxWaitTime`       | index.html:144      | Max waiting time                                                                                                | **wired**                                                                                                                             |
| `page.stats.moves`             | index.html:151      | Moves                                                                                                           | **wired**                                                                                                                             |
| `page.stats.movesTitle`        | index.html:152      | One move is counted each time a car crosses the halfway mark between one floor and the next                     | **wired**; a `title` attribute on the same cell as `page.stats.moves`                                                                 |
| `page.hint.html`               | index.html:167      | In the editor: <kbd data-mod-key>Ctrl</kbd>+<kbd>Enter</kbd> applies your program. <kbd data-mod-key>Ctrl</kbd… | **wired**; markup; `localisePage` calls `labelModifierKeys` last, having just overwritten the `<kbd data-mod-key>` labels it rewrites |
| `page.button.reset`            | index.html:174      | Reset                                                                                                           | **wired**                                                                                                                             |
| `page.button.undoReset`        | index.html:175      | Undo reset                                                                                                      | **wired**                                                                                                                             |
| `page.button.save`             | index.html:190      | Save                                                                                                            | **wired**                                                                                                                             |
| `page.button.apply`            | index.html:191      | Apply                                                                                                           | **wired**                                                                                                                             |
| `page.helpNote.html`           | index.html:196      | Confused? Open the <a href="documentation.html">Help and API documentation</a> page                             | **wired**; markup                                                                                                                     |
| `page.footer.credits`          | index.html:201      | Made by Magnus Wolffelt and contributors                                                                        | **wired**                                                                                                                             |
| `page.footer.version`          | index.html:208      | Version                                                                                                         | **wired**                                                                                                                             |
| `page.footer.source.html`      | index.html:211      | <a href="https://github.com/EpicDima/elevatorsaga">Source code</a> on GitHub, forked from <a href="https://git… | **wired**; markup                                                                                                                     |
| `page.footer.licences.html`    | index.html:216      | <a href="licenses.txt">Licences</a> for the game and everything it bundles                                      | **wired**; markup                                                                                                                     |
| `page.language.label`          | not yet in the page | Language                                                                                                        | the label of the picker nobody has built; its options are `LOCALE_NAMES`, never translated                                            |

`page.helpNote.html` is the one link the page shell cannot redirect for a reader, because the
href lives inside the message. The Russian entry therefore points at `documentation.ru.html`
rather than `documentation.html`; every other cross-page link is markup and belongs to
whoever builds the nav.

### documentation.html — 81 strings, none wired

Nothing calls a `docs.*` key. The Where column here is the English itself, in the static
page, and the Russian of every row is already written in `src/i18n/ru.ts` and already on
screen in `documentation.ru.html` — see _Known overlap_.

| Key                                                 | Where                  | English                                                                                                         | Notes                                                  |
| --------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `docs.page.title`                                   | documentation.html:6   | Elevator Saga - help and API documentation                                                                      |                                                        |
| `docs.page.description`                             | documentation.html:7   | Help and API documentation for Elevator Saga.                                                                   |                                                        |
| `docs.page.tagline`                                 | documentation.html:7   | Help and API documentation                                                                                      |                                                        |
| `docs.nav.label`                                    | documentation.html:27  | Game                                                                                                            |                                                        |
| `docs.nav.back`                                     | documentation.html:28  | Back to the game                                                                                                |                                                        |
| `docs.about.heading`                                | documentation.html:36  | About the game                                                                                                  |                                                        |
| `docs.about.p1.html`                                | documentation.html:38  | This is a game of programming!<br /> Your task is to program the movement of elevators, by writing a program i… | markup                                                 |
| `docs.about.p2.html`                                | documentation.html:43  | The goal is to transport people in an efficient manner.<br /> Depending on how well you do it, you can progres… | markup                                                 |
| `docs.play.heading`                                 | documentation.html:49  | How to play                                                                                                     |                                                        |
| `docs.play.apply.html`                              | documentation.html:51  | Enter your code in the input window below the game view, and press the <span class="emphasis-color">Apply</spa… | markup; takes `{increase}`, `{decrease}`               |
| `docs.play.statistics.html`                         | documentation.html:91  | Beside the building is a panel that keeps score while a run is going. Most of it says what it is; <span class=… | markup                                                 |
| `docs.play.shortcuts.html`                          | documentation.html:98  | Inside the editor, <kbd data-mod-key>Ctrl</kbd>+<kbd>Enter</kbd> applies your program and restarts the challen… | markup; same `data-mod-key` caveat as `page.hint.html` |
| `docs.play.debugging.html`                          | documentation.html:103 | If your program contains an error, you can use the developer tools in your web browser to try and debug it. If… | markup                                                 |
| `docs.basics.heading`                               | documentation.html:114 | Basics                                                                                                          |                                                        |
| `docs.basics.declare.html`                          | documentation.html:116 | Your code must declare an object containing at least two functions called <span class="emphasis-color">init</s… | markup                                                 |
| `docs.basics.example.code`                          | documentation.html:120 | {                                                                                                               | code; only the comments are translated                 |
| `docs.basics.called.html`                           | documentation.html:130 | These functions will then be called by the game during the challenge.<br /> <span class="emphasis-color">init<… | markup                                                 |
| `docs.basics.initPurpose.html`                      | documentation.html:135 | Normally you will put most of your code in the <span class="emphasis-color">init</span> function, to set up ev… | markup                                                 |
| `docs.basics.noLibraries.html`                      | documentation.html:139 | The game used to load jQuery and lodash, so older solutions you find on the wiki often call <span class="empha… | markup                                                 |
| `docs.examples.heading`                             | documentation.html:161 | Code examples                                                                                                   |                                                        |
| `docs.examples.control.heading`                     | documentation.html:162 | How to control an elevator                                                                                      |                                                        |
| `docs.examples.goToFloor`                           | documentation.html:168 | Tell the elevator to move to floor 1 after completing other tasks, if any. A request for the floor already at … |                                                        |
| `docs.examples.currentFloor`                        | documentation.html:177 | Calling currentFloor gets the floor number that the elevator currently is on. Note that this is a rounded numb… |                                                        |
| `docs.examples.events.heading`                      | documentation.html:183 | Listening for events                                                                                            |                                                        |
| `docs.examples.events.intro.html`                   | documentation.html:185 | It is possible to listen for events, like when stopping at a floor, or a button has been pressed. Elevators an… | markup                                                 |
| `docs.examples.idle`                                | documentation.html:197 | Listen for the "idle" event issued by the elevator, when the task queue has been emptied and the elevator is d… |                                                        |
| `docs.examples.floorButtonPressed`                  | documentation.html:204 | Listen for the "floor_button_pressed" event, issued when a passenger pressed a button inside the elevator. Thi… |                                                        |
| `docs.examples.upButtonPressed`                     | documentation.html:211 | Listen for the "up_button_pressed" event, issued when a passenger pressed the up button on the floor they are … |                                                        |
| `docs.api.heading`                                  | documentation.html:217 | API documentation                                                                                               |                                                        |
| `docs.table.method`                                 | documentation.html:232 | Method                                                                                                          |                                                        |
| `docs.table.property`                               | documentation.html:332 | Property                                                                                                        |                                                        |
| `docs.table.event`                                  | documentation.html:582 | Event                                                                                                           |                                                        |
| `docs.table.type`                                   | documentation.html:333 | Type                                                                                                            |                                                        |
| `docs.table.explanation`                            | documentation.html:233 | Explanation                                                                                                     |                                                        |
| `docs.table.example`                                | documentation.html:234 | Example                                                                                                         |                                                        |
| `docs.api.events.heading`                           | documentation.html:219 | Event methods                                                                                                   |                                                        |
| `docs.api.events.intro`                             | documentation.html:221 | Every elevator and every floor is an event emitter, and these are the methods it gives you. They all return th… |                                                        |
| `docs.api.events.on`                                | documentation.html:242 | Register a listener. Listeners run in the order they were registered, and the same function may be registered … |                                                        |
| `docs.api.events.once`                              | documentation.html:258 | Register a listener that runs at most once and is then removed. It is removed before it runs, so triggering th… |                                                        |
| `docs.api.events.one.html`                          | documentation.html:271 | The older name for <span class="emphasis-color">once</span>, and the one the original game gave you. Same beha… | markup                                                 |
| `docs.api.events.off.html`                          | documentation.html:283 | Remove listeners. With a function, removes just that function, however it was registered; without one, removes… | markup                                                 |
| `docs.api.events.off.example.code`                  | documentation.html:292 | function goHome() { elevator.goToFloor(0); }                                                                    | code; only the comments are translated                 |
| `docs.api.events.offAll.html`                       | documentation.html:303 | Remove every listener <em>you</em> registered, for every event, on that elevator or floor. The listeners the g… | markup                                                 |
| `docs.api.events.outro.html`                        | documentation.html:317 | You rarely need to remove listeners: the elevators and floors are thrown away when a challenge restarts, and y… | markup                                                 |
| `docs.api.elevator.heading`                         | documentation.html:322 | Elevator object                                                                                                 |                                                        |
| `docs.api.elevator.goToFloor.html`                  | documentation.html:344 | Queue the elevator to go to specified floor number. If you specify true as second argument, the elevator will … | markup                                                 |
| `docs.api.elevator.goToFloor.example.code`          | documentation.html:356 | elevator.goToFloor(3); // Do it after anything else -- queue: 3                                                 | code; only the comments are translated                 |
| `docs.api.elevator.stop`                            | documentation.html:368 | Clear the destination queue and stop the elevator if it is moving. Note that you normally don't need to stop e… |                                                        |
| `docs.api.elevator.currentFloor`                    | documentation.html:381 | Gets the floor number that the elevator currently is on.                                                        |                                                        |
| `docs.api.elevator.currentFloor.example.code`       | documentation.html:383 | if(elevator.currentFloor() === 0) {                                                                             | code; only the comments are translated                 |
| `docs.api.elevator.goingUpIndicator`                | documentation.html:393 | Gets or sets the going up indicator, which will affect passenger behaviour when stopping at floors.             |                                                        |
| `docs.api.elevator.goingDownIndicator`              | documentation.html:408 | Gets or sets the going down indicator, which will affect passenger behaviour when stopping at floors.           |                                                        |
| `docs.api.elevator.maxPassengerCount`               | documentation.html:423 | Gets the maximum number of passengers that can occupy the elevator at the same time.                            |                                                        |
| `docs.api.elevator.maxPassengerCount.example.code`  | documentation.html:428 | if(elevator.maxPassengerCount() > 5) {                                                                          | code; only the comments are translated                 |
| `docs.api.elevator.loadFactor`                      | documentation.html:438 | Gets the load factor of the elevator. 0 means empty, 1 means full. Varies with passenger weights, which vary -… |                                                        |
| `docs.api.elevator.loadFactor.example.code`         | documentation.html:443 | if(elevator.loadFactor() < 0.4) {                                                                               | code; only the comments are translated                 |
| `docs.api.elevator.isFull`                          | documentation.html:453 | Gets whether every spot in the elevator is taken. Use this rather than comparing loadFactor to 1 - passenger w… |                                                        |
| `docs.api.elevator.isFull.example.code`             | documentation.html:460 | if(!elevator.isFull()) {                                                                                        | code; only the comments are translated                 |
| `docs.api.elevator.isEmpty`                         | documentation.html:470 | Gets whether the elevator is carrying nobody at all. Not the opposite of isFull - an elevator with one passeng… |                                                        |
| `docs.api.elevator.isEmpty.example.code`            | documentation.html:475 | if(elevator.isEmpty()) {                                                                                        | code; only the comments are translated                 |
| `docs.api.elevator.isApproachingFloor`              | documentation.html:496 | Gets whether the elevator is moving toward the given floor and has not passed it yet. Only the direction of tr… |                                                        |
| `docs.api.elevator.isApproachingFloor.example.code` | documentation.html:508 | if(elevator.isApproachingFloor(2)) {                                                                            | code; only the comments are translated                 |
| `docs.api.elevator.destinationDirection`            | documentation.html:485 | Gets the direction the elevator is currently going to move toward. Can be "up", "down" or "stopped".            |                                                        |
| `docs.api.elevator.destinationQueue`                | documentation.html:518 | The current destination queue, meaning the floor numbers the elevator is scheduled to go to. Can be modified a… |                                                        |
| `docs.api.elevator.checkDestinationQueue`           | documentation.html:538 | Checks the destination queue for any new destinations to go to. Note that you only need to call this if you mo… |                                                        |
| `docs.api.elevator.getPressedFloors`                | documentation.html:549 | Gets the currently pressed floor numbers as an array.                                                           |                                                        |
| `docs.api.elevator.getPressedFloors.example.code`   | documentation.html:551 | if(elevator.getPressedFloors().length > 0) {                                                                    | code; only the comments are translated                 |
| `docs.api.elevator.idle`                            | documentation.html:592 | Triggered when the elevator has completed all its tasks and is not doing anything.                              |                                                        |
| `docs.api.elevator.floorButtonPressed`              | documentation.html:603 | Triggered when a passenger has pressed a button inside the elevator.                                            |                                                        |
| `docs.api.elevator.floorButtonPressed.example.code` | documentation.html:606 | elevator.on("floor_button_pressed", function(floorNum) {                                                        | code; only the comments are translated                 |
| `docs.api.elevator.passingFloor`                    | documentation.html:615 | Triggered slightly before the elevator will pass a floor. A good time to decide whether to stop at that floor.… |                                                        |
| `docs.api.elevator.stoppedAtFloor`                  | documentation.html:626 | Triggered when the elevator has arrived at a floor.                                                             |                                                        |
| `docs.api.elevator.stoppedAtFloor.example.code`     | documentation.html:628 | elevator.on("stopped_at_floor", function(floorNum) {                                                            | code; only the comments are translated                 |
| `docs.api.floor.heading`                            | documentation.html:636 | Floor object                                                                                                    |                                                        |
| `docs.api.floor.floorNum`                           | documentation.html:656 | Gets the floor number of the floor object.                                                                      |                                                        |
| `docs.api.floor.upButtonPressed`                    | documentation.html:694 | Triggered when someone has pressed the up button at a floor. Note that passengers will press the button again … |                                                        |
| `docs.api.floor.upButtonPressed.example.code`       | documentation.html:700 | floor.on("up_button_pressed", function(floor) {                                                                 | code; only the comments are translated                 |
| `docs.api.floor.downButtonPressed`                  | documentation.html:709 | Triggered when someone has pressed the down button at a floor. Note that passengers will press the button agai… |                                                        |
| `docs.api.floor.downButtonPressed.example.code`     | documentation.html:715 | floor.on("down_button_pressed", function(floor) {                                                               | code; only the comments are translated                 |
| `docs.api.floor.buttonStateChange.html`             | documentation.html:724 | Triggered when either call button at a floor was lit or cleared. The handler is passed the state of both butto… | markup                                                 |
| `docs.api.floor.buttonStateChange.example.code`     | documentation.html:734 | floor.on("buttonstate_change", function(buttonStates) {                                                         | code; only the comments are translated                 |

### src/ui/templates.ts — 18 strings, all wired

Every template here renders its words through `t` as it is built, which is why changing
language mid-run cannot rewrite them: only starting a challenge builds them again.

| Key                         | Where                   | English                                        | Notes                                                     |
| --------------------------- | ----------------------- | ---------------------------------------------- | --------------------------------------------------------- |
| `game.floor.callUp`         | src/ui/templates.ts:137 | Call an elevator going up from floor {floor}   | **wired**; takes `{floor}`; an `aria-label`               |
| `game.floor.callDown`       | src/ui/templates.ts:137 | Call an elevator going down from floor {floor} | **wired**; takes `{floor}`; an `aria-label`               |
| `game.elevator.label`       | src/ui/templates.ts:148 | Elevator {number}                              | **wired**; takes `{number}`; the car's index plus one     |
| `game.elevator.floorButton` | src/ui/templates.ts:161 | Go to floor {floor}                            | **wired**; takes `{floor}`                                |
| `game.challenge.title.html` | src/ui/templates.ts:449 | Challenge #{number}: {description}             | **wired**; markup; takes `{number}`, `{description}`      |
| `game.timeScale.decrease`   | src/ui/templates.ts:450 | Decrease simulation speed                      | **wired**; an `aria-label`                                |
| `game.timeScale.increase`   | src/ui/templates.ts:450 | Increase simulation speed                      | **wired**; an `aria-label`                                |
| `game.feedback.next`        | src/ui/templates.ts:479 | Next challenge                                 | **wired**                                                 |
| `game.codeStatus`           | src/ui/templates.ts:492 | There is a problem with your code:             | **wired**; the message beside it is the player's own text |

Nine of these were added after the first pass over the file, when the challenge navigation
row and the seed line landed. They are listed separately only because their notes are longer
than the table above wants to be:

| Key                        | Where                   | English                                                                                                                                                 | Notes                                                                                                   |
| -------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `game.challenge.nav.label` | src/ui/templates.ts:450 | Challenges                                                                                                                                              | **wired**; the `<nav>`'s accessible name                                                                |
| `game.challenge.nav.link`  | src/ui/templates.ts:219 | Challenge {number}                                                                                                                                      | **wired**; takes `{number}`; the accessible name of an entry whose visible text is the bare digit       |
| `game.challenge.nav.demo`  | src/ui/templates.ts:216 | Demo                                                                                                                                                    | **wired**; both the visible label and the accessible name of the endless-demo entry                     |
| `game.seed.label`          | src/ui/templates.ts:304 | Seed                                                                                                                                                    | **wired**; the word before the number, not a control                                                    |
| `game.seed.link`           | src/ui/templates.ts:302 | Seed {seed}: start another run from this seed                                                                                                           | **wired**; takes `{seed}`; accessible name of the seed when the URL does not pin it                     |
| `game.seed.newDraw`        | src/ui/templates.ts:303 | new draw                                                                                                                                                | **wired**; visible label, repeated inside `game.seed.newDrawLink` — WCAG 2.5.3 requires that they match |
| `game.seed.newDrawLink`    | src/ui/templates.ts:303 | Seed {seed}: new draw, start again without it                                                                                                           | **wired**; takes `{seed}`; accessible name of the control that unpins                                   |
| `game.seed.helpSummary`    | src/ui/templates.ts:366 | what a seed does                                                                                                                                        | **wired**; the `<summary>` of the caveat disclosure                                                     |
| `game.seed.explanation`    | src/ui/templates.ts:366 | The same seed brings the same passengers, in the same order. Frame timing comes from the browser, so the run around them is never quite the same twice. | **wired**; a paragraph inside the disclosure, not a tooltip — it used to be a `title` attribute         |

The seed itself is a placeholder in both accessible names and never part of the sentence: it
is the token a player transcribes in order to hand a building to somebody else, so it reads
identically in every locale. Both names repeat it because an accessible name has to stand on
its own — "1234567890, link" describes nothing.

### src/ui/presenters.ts — 7 strings, all wired

| Key                        | Where                    | English                       | Notes                                                           |
| -------------------------- | ------------------------ | ----------------------------- | --------------------------------------------------------------- |
| `game.timeScale.value`     | src/ui/presenters.ts:241 | {value}x                      | takes `{value}`; Russian writes `×`, not the Latin letter x     |
| `game.button.start`        | src/ui/presenters.ts:352 | Start                         |                                                                 |
| `game.button.pause`        | src/ui/presenters.ts:353 | Pause                         |                                                                 |
| `game.button.restart`      | src/ui/presenters.ts:349 | Restart                       | rendered after an icon, as `" Restart"`; keep the leading space |
| `error.thrown.emptyString` | src/ui/presenters.ts:606 | Thrown empty string           |                                                                 |
| `error.thrown.noMessage`   | src/ui/presenters.ts:583 | Thrown {kind} with no message | takes `{kind}`                                                  |
| `error.thrown.keys`        | src/ui/presenters.ts:584 | {kind} with keys: {keys}      | takes `{kind}`, `{keys}`                                        |

### src/app/app.ts — 4 strings, all wired

| Key                             | Where              | English                                  | Notes |
| ------------------------------- | ------------------ | ---------------------------------------- | ----- |
| `game.feedback.success.title`   | src/app/app.ts:515 | Success!                                 |       |
| `game.feedback.success.message` | src/app/app.ts:516 | Challenge completed                      |       |
| `game.feedback.failure.title`   | src/app/app.ts:528 | Challenge failed                         |       |
| `game.feedback.failure.message` | src/app/app.ts:529 | Maybe your program needs an improvement? |       |

### src/main.ts — 4 strings, all wired

| Key                       | Where           | English                                                      | Notes                                                                     |
| ------------------------- | --------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `editor.saved`            | src/main.ts:75  | Code saved {time}                                            | **wired**; takes `{time}`; `formatTime` drops the time zone suffix        |
| `editor.confirmReset`     | src/main.ts:87  | Do you really want to reset to the default implementation?   | **wired**; a `window.confirm`                                             |
| `editor.confirmUndoReset` | src/main.ts:93  | Do you want to bring back the code as before the last reset? | **wired**; a `window.confirm`                                             |
| `fitness.measuring`       | src/main.ts:127 | Measuring fitness...                                         | **wired**; written into the panel beside the editor before the run starts |

### src/ui/editor.ts — 1 string, wired

| Key            | Where                | English          | Notes |
| -------------- | -------------------- | ---------------- | ----- |
| `editor.label` | src/ui/editor.ts:754 | Elevator program |       |

### src/ui/default-code.ts — 1 string, not wired (#61)

Outstanding, and not because the translation is missing: the Russian of this program is in
`src/i18n/ru.ts` already, and so is the English. What is missing is the call. `DEFAULT_CODE`
is a template literal that carries the same program a third time, `src/ui/editor.ts` imports
that constant, and `editor.defaultCode.code` has no call site anywhere in the tree — so a
Russian reader who has never saved anything is handed English comments, and the two copies
can drift apart with nothing to notice. That is task #61.

| Key                       | Where                     | English | Notes                                                    |
| ------------------------- | ------------------------- | ------- | -------------------------------------------------------- |
| `editor.defaultCode.code` | src/ui/default-code.ts:15 | {       | code; only the comments are translated; nothing calls it |

### src/game/challenges.ts — 14 strings, all wired

| Key                                             | Where                      | English                                                                                                     | Notes                                                                                                                                   |
| ----------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `challenge.transportWithinTime.html`            | src/game/challenges.ts:77  | Transport {people} in {time} or less                                                                        | markup; takes `{people}`, `{time}`                                                                                                      |
| `challenge.transportWithMaxWait.html`           | src/game/challenges.ts:105 | Transport {people} and let no one wait more than {waitTime}                                                 | markup; takes `{people}`, `{waitTime}`                                                                                                  |
| `challenge.transportWithinTimeWithMaxWait.html` | src/game/challenges.ts:140 | Transport {people} in {time} or less and let no one wait more than {waitTime}                               | markup; takes `{people}`, `{time}`, `{waitTime}`                                                                                        |
| `challenge.transportWithinMoves.html`           | src/game/challenges.ts:177 | Transport {people} using {moves} or less                                                                    | markup; takes `{people}`, `{moves}`                                                                                                     |
| `challenge.demo`                                | src/game/challenges.ts:200 | Perpetual demo                                                                                              |                                                                                                                                         |
| `challenge.people.html`                         | src/game/challenges.ts:78  | <span class='emphasis-color'>{count}</span> people                                                          | plural (one, other); markup; takes `{count}`; shared by all four challenge sentences                                                    |
| `challenge.timeLimit.html`                      | src/game/challenges.ts:79  | <span class='emphasis-color'>{count}</span> seconds                                                         | plural (one, other); markup; takes `{count}`                                                                                            |
| `challenge.waitLimit.html`                      | src/game/challenges.ts:112 | <span class='emphasis-color'>{count}</span> seconds                                                         | plural (one, other); markup; takes `{count}`                                                                                            |
| `challenge.moveLimit.html`                      | src/game/challenges.ts:179 | <span class='emphasis-color'>{count}</span> elevator moves                                                  | plural (one, other); markup; takes `{count}`                                                                                            |
| `challenge.sandbox.html`                        | src/game/challenges.ts:265 | Sandbox: {floors}, {elevators} of {capacityLabel} {capacities}, {spawnRate}. No goal, so the run never ends | markup; takes `{floors}`, `{elevators}`, `{capacityLabel}`, `{capacities}`, `{spawnRate}`; composed from the four sandbox phrases below |
| `challenge.sandbox.floors.html`                 | src/game/challenges.ts:266 | <span class='emphasis-color'>{count}</span> floors                                                          | plural (one, other); markup; takes `{count}`                                                                                            |
| `challenge.sandbox.elevators.html`              | src/game/challenges.ts:267 | <span class='emphasis-color'>{count}</span> elevators                                                       | plural (one, other); markup; takes `{count}`                                                                                            |
| `challenge.sandbox.capacityLabel`               | src/game/challenges.ts:271 | capacities                                                                                                  | plural (one, other)                                                                                                                     |
| `challenge.sandbox.spawnRate.html`              | src/game/challenges.ts:278 | <span class='emphasis-color'>{count}</span> people per second                                               | plural (one, other); markup; takes `{count}`; one English form for both categories, preserving today's `1 people per second`            |

### src/ui/completions.ts — 32 strings, none wired (#60)

Outstanding, and the largest thing left that is not the documentation page. The file does
not import from `src/i18n/` at all: its `info` prose is 32 English string literals inside
module-scope `const` arrays, so a player typing `elevator.` in the editor is told what the
method does in English whatever language the rest of the page is in. It is also the last
place the import-time trap is still live — a module-scope constant is evaluated once, before
any catalogue is chosen, so simply swapping the literals for `t(...)` would freeze the
English rather than fix it. Whatever wires this has to defer the read to the moment the
completion list is built, the way `src/game/challenges.ts` defers its descriptions. That is
task #60.

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
| `completion.initSkeleton.code`                 | src/ui/completions.ts:320 | init: function(elevators, floors) {                                                                             | code; only the comments are translated |
| `completion.updateSkeleton.code`               | src/ui/completions.ts:325 | update: function(dt, elevators, floors) {                                                                       | code; only the comments are translated |

### src/app/fitness.ts — 6 strings, all wired

| Key                     | Where                  | English                                                                                                         | Notes                                               |
| ----------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `fitness.results`       | src/app/fitness.ts:253 | Fitness avg wait times: {results}                                                                               | takes `{results}`                                   |
| `fitness.result`        | src/app/fitness.ts:249 | {scenario}: {value}                                                                                             | takes `{scenario}`, `{value}`                       |
| `fitness.unknownValue`  | src/app/fitness.ts:248 | ?                                                                                                               | shown when a scenario produced no average wait time |
| `fitness.error`         | src/app/fitness.ts:243 | Could not compute fitness due to error: {error}                                                                 | takes `{error}`                                     |
| `fitness.workerTimeout` | src/app/fitness.ts:159 | The fitness worker did not finish within {seconds} and was stopped. Does your program have a loop that never e… | takes `{seconds}`                                   |
| `fitness.workerFailed`  | src/app/fitness.ts:187 | The fitness worker failed                                                                                       |                                                     |

### src/game/fitness.ts — 3 strings, all wired

| Key                       | Where                   | English         | Notes |
| ------------------------- | ----------------------- | --------------- | ----- |
| `fitness.scenario.small`  | src/game/fitness.ts:118 | Small scenario  |       |
| `fitness.scenario.medium` | src/game/fitness.ts:127 | Medium scenario |       |
| `fitness.scenario.large`  | src/game/fitness.ts:137 | Large scenario  |       |

### src/game/user-code.ts — 2 strings, all wired

| Key                   | Where                    | English                              | Notes                                     |
| --------------------- | ------------------------ | ------------------------------------ | ----------------------------------------- |
| `error.code.noInit`   | src/game/user-code.ts:53 | Code must contain an init function   | thrown, then shown in the code status bar |
| `error.code.noUpdate` | src/game/user-code.ts:56 | Code must contain an update function | thrown, then shown in the code status bar |

### src/game/elevator-interface.ts — 4 strings, all wired

| Key                             | Where                              | English                                                                                                         | Notes                                                                    |
| ------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `error.elevator.notAFloor`      | src/game/elevator-interface.ts:438 | elevator.{method} was called with {value}, which is not a floor number. It takes a finite number, and this bui… | takes `{method}`, `{value}`, `{topFloor}`                                |
| `error.elevator.queueNotAFloor` | src/game/elevator-interface.ts:404 | elevator.destinationQueue contained {value}, which is not a floor number. The entry was dropped so the elevato… | takes `{value}`, `{topFloor}`                                            |
| `error.value.array`             | src/game/elevator-interface.ts:109 | an array                                                                                                        | goes into `error.elevator.notAFloor` and `error.elevator.queueNotAFloor` |
| `error.value.object`            | src/game/elevator-interface.ts:112 | an object                                                                                                       | goes into `error.elevator.notAFloor` and `error.elevator.queueNotAFloor` |

### src/game/movable.ts — 1 string, wired

| Key                  | Where                  | English                                  | Notes |
| -------------------- | ---------------------- | ---------------------------------------- | ----- |
| `error.movable.busy` | src/game/movable.ts:49 | Object is busy - you should use callback |       |

## Deliberately not translated

Not everything a string literal holds is a message to a player. These were looked at and
left in English on purpose; translating them would cost work and buy nothing, and in some
cases would do harm.

| Where                                                                                                  | What                                                                                                                                | Why                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/app.ts:207`, `src/game/world-controller.ts:196`                                               | `World raised code error`, `Usercode error on update`                                                                               | `console` diagnostics. The player sees the same failure translated in the code status bar; the console line is for whoever is reading a stack next to it.  |
| `src/game/movable.ts:168`                                                                              | `Attempt to use movable while it was busy`                                                                                          | `console` diagnostic accompanying `error.movable.busy`, which _is_ keyed.                                                                                  |
| `src/game/observable.ts:181`                                                                           | `Event error handler threw while reporting`                                                                                         | `console` diagnostic about the game's own error reporting failing.                                                                                         |
| `src/app/fitness.ts:122`                                                                               | `Fitness worker creation failed, running on the main thread instead`                                                                | `console` diagnostic; the player sees only the result.                                                                                                     |
| `src/game/elevator.ts:497`                                                                             | The `getFirstPressedFloor` deprecation warning                                                                                      | Addressed to code, quoting an API name, and printed once per session. This row said `destinationDirection` until now, and never matched the line it cited. |
| `src/app/router.ts:444, 543, 569, 586, 623, 650, 683, 691, 731, 756`                                   | The ten URL parameter warnings                                                                                                      | Addressed to whoever hand-wrote the URL, quoting parameter names that are themselves English.                                                              |
| `src/ui/dom.ts:39`, `src/ui/templates.ts:118`, `src/ui/presenters.ts:116`                              | `Missing required element`, `Expected markup describing exactly one element`, `Expected the user template to render an SVG element` | Invariants. If a player ever reads one, the bug is that it was thrown, not that it was in English.                                                         |
| `src/game/fitness.ts:85`                                                                               | `No requirement`                                                                                                                    | The benchmark's placeholder condition. Nothing renders a challenge bar during a benchmark, so it never reaches a screen.                                   |
| `src/ui/completions.ts` `detail` and `label` fields                                                    | `(floorNum, directly)`, `elevator.goToFloor`, …                                                                                     | Signatures and identifiers. The editor completes real API names; translating them would suggest code that does not exist. Only the `info` prose is keyed.  |
| `src/ui/shortcuts.ts:24`                                                                               | `⌘` / `Ctrl`                                                                                                                        | Key names. Russian keyboards are labelled `Ctrl` too.                                                                                                      |
| `index.html:4`, `index.html:5`, `documentation.html:4`                                                 | `charset`, `viewport`                                                                                                               | Machine values, not prose.                                                                                                                                 |
| `documentation.html:31`                                                                                | `Русский`                                                                                                                           | A language's own name. `LOCALE_NAMES` in `src/i18n/locale.ts` holds these; they are the same in every locale by definition.                                |
| `documentation.html:202`, `documentation.html:209`, and the other one-line snippets in _Code examples_ | `elevator.on("floor_button_pressed", function(floorNum) { ... } );`                                                                 | Code with no comments in it. Nothing to translate.                                                                                                         |
| `src/game/test-helpers.ts`, `*.test.ts`, `e2e/`                                                        | Test messages                                                                                                                       | Read by whoever ran the tests.                                                                                                                             |
| `licenses.txt`                                                                                         | Licence texts                                                                                                                       | Legal texts are quoted, not translated.                                                                                                                    |

## What could not be keyed cleanly

Five places where the English source resists a one-string-one-key mapping. All five are
keyed and all five now ship, so what follows is a record of how each was resolved rather
than a proposal.

1. **Challenge descriptions are built from parts.** The four builders in
   `src/game/challenges.ts` (lines 77, 105, 140 and 177) each interpolate two or three
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
   has one plural category, and these sentences count two different things. Each of the
   four sits inside a `get description()` on the condition object, which is what keeps the
   sentence out of the import-time trap; see below.

2. **`1 people per second`.** The sandbox description at `src/game/challenges.ts:278`
   pluralises floors and elevators but not the spawn rate, so a rate of exactly 1 reads
   `1 people per second` today. `challenge.sandbox.spawnRate.html` reproduces that by
   giving both English categories the same text; Russian declines it properly. Fixing the
   English is a one-word edit to `en.ts` whenever someone wants the wording changed rather
   than preserved.

3. **`" Restart"` carries a leading space.** `src/ui/presenters.ts:349` writes the label
   after an icon node, and the space is the gap between them. `game.button.restart` is the
   word alone, so the call site keeps the separator:

   ```ts
   startStop.replaceChildren(createIcon("repeat"), ` ${t("game.button.restart")}`);
   ```

4. **One `<h1>`, two strings.** The heading at `index.html:68-69` puts the game's name and
   its tagline in one element. They are keyed as `page.brand` and `page.tagline`, because
   the brand is a name that stays English and the tagline is prose that does not.

5. **The docs and the editor say the same thing twice.** `completion.elevator.goToFloor`
   is the first two sentences of `docs.api.elevator.goToFloor.html`, without markup. They
   are separate keys on purpose: one is plain text in a completion popup, the other is
   markup in a table, and the docs entry has since grown detail the popup does not want.
   Whoever edits one should read the other.

## What is done, and what is left

The sections below were written as instructions to whoever wired the catalogue in. Most of
that work has landed, so each one now says what shape the answer took — the reasoning is
worth keeping even where the request is spent — and the two that are still open say so.

### Before anything renders — `src/main.ts` — done

`src/main.ts:63` awaits `applyPreferredLocale(document, navigator.userAgent)`, which is
`src/ui/preferred-locale.ts`: it resolves the language, sets it, waits for the catalogue and
writes the shell, all before the app is constructed. Nothing is drawn in one language and
replaced in another, which is the whole reason the first draw waits.

`resolveLocale` takes `#lang=ru` from the hash first, then `localStorage`, then
`navigator.languages`, then English. `browserLocaleSources` reads each of the three behind
its own `catch`, so a browser that throws on `localStorage` — Safari in a private window,
or any browser told to block site data — falls through to the next source instead of
failing to start. `storeLocale(localStorage, locale)` is called for none of the three, and
is still waiting for the language picker, for the reasons `preferred-locale.ts` sets out at
length: a language found in somebody else's link is not a choice this reader made.

Two ordering traps. Both were sprung once, and both are fixed, but the second half of the
wiring can spring them again:

- **Modules that build their strings at import time run before this.** `challenges` at
  `src/game/challenges.ts:312` is still a module constant, and that is now safe, because
  what it holds are condition objects whose `description` is a `get description()` getter
  rather than a rendered string — the sentence is built when the challenge bar asks for it,
  in whatever language is active by then. That is the shape this fix took, rather than the
  `createChallenges()` factory this document originally proposed: it left every caller
  alone. The fitness scenarios needed the other shape, so `fitnessChallenges` is a nullary
  function that deliberately keeps the constant's name, because what other modules mean by
  it — the list of buildings — did not change. `src/ui/completions.ts` is the one place the
  trap is still live: its prose is not lazy, and it is not keyed either (#60).
- **The fitness worker is a second module instance.** `src/app/fitness.ts` posts the
  player's source to `src/app/fitness-worker.ts`, and `doFitnessSuite` builds the run
  descriptions inside the worker, where the active locale is whatever that instance
  defaults to. Fixed by sending the locale with `FitnessWorkerRequest` and calling
  `setLocale` on arrival; a test asserts the worker answers in the language it was asked
  in. Anything else that ends up in a worker needs the same treatment — a worker inherits
  nothing from the page that spawned it.

A third trap, also fixed, which the rest of the wiring has to keep fixed: **a static import
of a catalogue puts it in every chunk that reaches a `t()`.** Both catalogues imported
statically cost 42.75 kB in the entry chunk and 42.31 kB in the fitness worker — which draws
nothing — to serve seventeen keys. Every catalogue but English is now fetched by
`loadLocale`, and English stays bundled because it is the fallback that keeps `t`
synchronous. So:

- **Do not `import { RU_MESSAGES }`,** and do not re-export it from a module the page
  imports. `src/i18n/index.ts` deliberately re-exports English only. The two test files
  that want a catalogue as data import `./ru.ts` directly, which reaches no bundle.
- **`await loadLocale(locale)` before redrawing.** `setLocale` alone starts the fetch but
  does not wait, so the interface stays English until it lands.
- A message asked for before its catalogue arrives renders in English, whole — never a raw
  key, and never an English sentence with Russian decimal commas in it.

`#lang=ru` needs nothing from `src/app/router.ts`: `parseQuery` keeps unknown keys and
round-trips them into the next-challenge link, so the language survives finishing a
challenge.

### `index.html` — done, apart from the picker and two links

The shell carries `data-i18n` and `data-i18n-attr` attributes and `src/ui/localise-page.ts`
walks the document once per language change, which is the marked-up-document answer rather
than the selector-table one; that module's own header says why. `<html lang>` is written
from the locale that could actually be rendered, not the one that was asked for. Two things
are still open:

- `page.language.label` has no element: the picker is the one piece of markup this wiring
  would add rather than translate. It belongs in the header nav, whose accessible name is
  already `page.nav.label`. Its options come from `LOCALE_NAMES` in `src/i18n/locale.ts` and
  are never translated — a reader who needs Русский has to be able to find it while the
  interface is still English. Choosing one should call `storeLocale` and then reload, or
  re-render everything; a reload is honest here, since the challenge in progress is already
  addressed by the URL and the editor's buffer is already in local storage.
- The two nav links at `index.html:72-73` both point at `documentation.html`. In Russian
  they should point at `documentation.ru.html`. `page.helpNote.html` already does the
  equivalent, because its `href` is inside the message; these two are markup, so they need
  the same treatment the picker's author will be adding anyway.

### `documentation.html` — 81 strings, not started

The same mechanism, at four times the size, plus `<html lang>` at line 2. The `.code`
blocks keep their code and change only their comments. Nothing is wired, and nothing is
broken by that: `documentation.ru.html` is a complete Russian page today. See _Known
overlap_ before starting.

### `src/ui/templates.ts` — done

`markup` escapes its interpolations, so a plain key is interpolated directly and an `.html`
key goes through `raw()`. `floorTemplate` no longer builds `floor ${level}` and drops it
into two labels: `game.floor.callUp` and `game.floor.callDown` take `{floor}` as a number,
so the local disappeared with the concatenation.

Two constraints on the challenge navigation row and the seed line outlive the wiring:

- `game.seed.newDraw` is both the visible label and two words inside `game.seed.newDrawLink`.
  They have to keep saying the same thing in every locale (WCAG 2.5.3): a speech-input user
  says what they can see. If a translation changes one, it changes both.
- The seed explanation used to be a module constant, `SEED_EXPLANATION`. It is now
  `t("game.seed.explanation")` inside `seedHelpTemplate()`, which runs per render — which is
  the point. A `const SEED_EXPLANATION = t(...)` at module scope would have compiled, read
  correctly and frozen English at import time, which is the same trap as the challenge
  descriptions above and the single most likely way for the rest of this wiring to
  half-work.

### `src/ui/presenters.ts` — done

Every figure in the statistics panel goes through `Intl` rather than `toFixed` and `String`:
`format(seconds(world.elapsedTime))`, `format(quantity(...))` for the per-second rate, and
`format(seconds(..., 1))` for the two wait times, which is what gives Russian `1,5 с` with a
non-breaking space instead of `1.5s`. The time scale renders through
`game.timeScale.value`, `{value}x` in English and `{value}×` in Russian.

### `src/app/app.ts` — done

The four feedback strings render through `t` as the overlay is built. The locale preference
did not end up here beside `TIME_SCALE_STORAGE_KEY` after all — `LOCALE_STORAGE_KEY` and
`readStoredLocale` live in `src/i18n/detect.ts`, shaped after `readStoredTimeScale` and
saying so in a comment, because the language is not the app's state in the way the time
scale is.

### `src/main.ts` — done

`t("editor.saved", { time: formatTime(savedAt) })` renders `21:03:57` where the old
`Code saved ${savedAt.toTimeString()}` rendered `21:03:57 GMT+0300 (Moscow Standard Time)`.
That was a visible improvement, and it was a change.

### `src/ui/editor.ts` — done; `src/ui/default-code.ts` — outstanding (#61)

`editor.ts:754` is the editor's `aria-label` and reads from the catalogue.
`default-code.ts:15` is the program a player starts with, and it does not:
`editor.defaultCode.code` translates its comments and leaves every identifier alone, but
nothing calls it, so the English `DEFAULT_CODE` is still what a Russian reader is handed.

### `src/game/challenges.ts` — done

The four description builders, the perpetual demo and the sandbox each render through `t`
inside a `get description()` — six getters, at lines 76, 104, 139, 176, 199 and 259. See
_What could not be keyed cleanly_ for how the counted phrases compose, and the import-time
trap above for why a getter and not a constant.

### `src/ui/completions.ts` — outstanding (#60)

Only the `info` prose is to be keyed; `label` and `detail` stay as they are, because they
are the API's own identifiers. Nothing has been done here yet, and the module scope this
prose sits in means the fix has to be lazier than a search and replace.

### Done — `src/app/fitness.ts`, `src/game/fitness.ts`, `src/game/user-code.ts`, `src/game/elevator-interface.ts`, `src/game/movable.ts`

All sixteen of these are wired; nothing here is outstanding. Kept as a section because two
of the decisions taken in them apply to the rest of the wiring:

- The `?` shown when a scenario produced no average wait time, and the `{scenario}: {value}`
  line it goes into, are separate keys rather than one string with a hole in it, so neither
  locale has to make "?" agree with a sentence it did not write. The `s` suffix that used
  to be appended to `avgWaitTime.toPrecision(3)` now goes through `format(seconds(...))`,
  which is what puts the non-breaking space in `60 с`.
- `error.value.array` and `error.value.object` are phrases that compose into
  `error.elevator.notAFloor` and `error.elevator.queueNotAFloor`. Composing a sentence from
  a noun chosen at run time is the pattern Russian punishes: the first draft of the frame
  agreed with the interpolated noun instead of with the subject and read
  «В elevator.destinationQueue попало массив», neuter verb against a masculine noun, which
  a player could reach with `elevator.destinationQueue = [[1, 2]]`. Both frames now agree
  with their own subject and let `{value}` land in a case that is spelled the same either
  way. Prefer whole sentences per key; where composition is unavoidable, write the frame so
  that no choice of insert can make it ungrammatical, and test it with an insert that has
  gender — `NaN` is spelled identically in every case and gender, so it proves nothing.

## What changed on screen when this was wired

Even in English, routing text through the catalogue changed four things. All four are
improvements, all four are visible, and all four have now landed:

1. **Grouped thousands.** Challenge 18 asks for 2675 people and used to render `2675`;
   `Intl.NumberFormat` renders `2,675` in English and `2 675` in Russian.
2. **The saved-code time** lost its `GMT+0300 (Moscow Standard Time)` tail.
3. **Fractional time scales** render `0.5x` in English and `0,5×` in Russian.
4. **Non-breaking spaces** appear between numbers and unit abbreviations in Russian, so
   `60 с` cannot break across a line.

## Known overlap: `documentation.ru.html`

While this catalogue was being written, another change added `documentation.ru.html` — a
separate, fully translated Russian copy of the documentation page, with `hreflang`
alternates linking the pair. That covers the same ground as the 81 `docs.*` keys here, by
a different route: a static file per language instead of one document translated at run
time.

Both were kept, which would ordinarily mean maintaining the Russian documentation twice —
and it did: a review of the Russian page put a dozen corrections into
`documentation.ru.html`, and every one of them stayed there while `ru.ts` went on saying
the thing that had been corrected. `src/page.test.ts` now closes that gap from both ends. It
holds the two pages to being one document in two languages — same headings, same tables in
the same order, same anchors, same examples — and it holds every `docs.*` message to being
the same text as the passage it was lifted from, in both languages. So the duplication is
still there and can no longer drift silently, which turns the choice below from pending into
deferred:

- **Keep the static pages** and drop the `docs.*` keys from the catalogue, or generate
  `documentation.ru.html` from them at build time. The `docs.*` keys have no other call
  site, so removing them touches nothing else.
- **Keep the catalogue** and reduce `documentation.ru.html` to a redirect.

Whoever takes it up should read `src/page.test.ts` first: whichever side is dropped, those
assertions are the specification of what the surviving side has to keep saying.

## Adding a language

One file, plus two lines that the compiler demands anyway:

1. Add the code to `Locale` and `LOCALES` in `src/i18n/locale.ts`, and its endonym to
   `LOCALE_NAMES`.
2. Add the plural categories `Intl` gives that language to `PLURAL_CATEGORIES` in
   `src/i18n/format.ts`. `src/i18n/format.test.ts` checks the list against ICU, so a wrong
   guess fails a test rather than mistranslating a count.
3. Write `src/i18n/<code>.ts` as `MessageCatalogue<"<code>">`. Every missing key, every
   extra key and every missing plural form is a compile error.
4. Register it in `CATALOGUE_LOADERS` in `src/i18n/index.ts`, as a one-line loader that
   `await import()`s the file and files it in the catalogue slot for that locale. Writing
   the locale's key out literally is what keeps it type-checked; a generic index would not
   be.

The tests in `src/i18n/catalogue.test.ts` then check the new catalogue for key parity,
placeholder parity, markup that matches the English structure, and example code that is
identical to the English but for its comments.
