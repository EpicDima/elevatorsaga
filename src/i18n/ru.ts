/**
 * Русский каталог / the Russian catalogue.
 *
 * Typed as `MessageCatalogue<"ru">`, so it is checked against the English one
 * key by key: a missing message is a compile error, an invented one is a
 * compile error, and a counted message that forgets `few` or `many` is a
 * compile error too. `catalogue.test.ts` adds what the type system cannot see —
 * that the `{placeholders}` match, that no plain key smuggles in markup, and
 * that the code in the `.code` blocks is byte for byte the English code with
 * only its comments translated.
 *
 * ## Glossary
 *
 * Fixed vocabulary; the same English word is the same Russian word everywhere,
 * and the one word that is not says so in its own row. The first eight were
 * given with the task, the rest are chosen here and written down so the next
 * translator does not have to guess:
 *
 * | English            | Русский              |
 * | ------------------ | -------------------- |
 * | elevator           | лифт                 |
 * | car (elevator car) | кабина               |
 * | floor              | этаж                 |
 * | challenge          | задание              |
 * | user, passenger    | пассажир             |
 * | load factor        | загрузка             |
 * | destination queue  | очередь этажей       |
 * | wait time          | время ожидания       |
 * | delivery time      | время доставки       |
 * | transported        | перевезено           |
 * | building           | здание, в дорожке — дом |
 * | code, program      | код, программа       |
 * | editor             | редактор             |
 * | event              | событие              |
 * | listener, handler  | обработчик           |
 * | to trigger (event) | срабатывать          |
 * | to register (on)   | подписать            |
 * | to remove (off)    | снять                |
 * | elevator move      | перемещение          |
 * | indicator          | индикатор            |
 * | callback           | колбэк               |
 * | fitness            | эффективность        |
 * | scenario           | сценарий             |
 * | worker             | воркер               |
 * | sandbox            | песочница            |
 * | local storage      | локальное хранилище  |
 * | developer tools    | инструменты разработчика |
 * | simulation speed   | скорость симуляции   |
 * | seed               | сид                  |
 * | run                | прогон               |
 * | new draw           | новый сид            |
 *
 * «Кабина» is the moving box and «лифт» the thing player code holds a handle
 * on, which is the distinction the English draws between "car" and "elevator" —
 * it needs "car" because "elevator" is the API object. Russian could say «лифт»
 * throughout and lose nothing a player needed, so the two are kept apart only
 * where the English keeps them apart: the prose about a car's own movement.
 *
 * «Здание» is the game's word for a building and «дом» the learning track's,
 * which is the one place the table above is not a single word. Not variety: the
 * hints of a task and the `//` comments of the program the player is editing
 * have to name the thing on screen with the same word, and they do —
 * `tutorial.task1.hint1.html` asks «Сколько всего этажей в этом доме?» about
 * the building `tutorial.task1.startingCode.code` calls «этот дом», which is
 * also the line `e2e/tutorial.spec.ts` looks for to tell a Russian editor from
 * an English one. «Дом» is the shorter, plainer word, and the track points at a
 * building the player is watching rather than describing buildings in general,
 * which is what everything outside `tutorial.*` does: the help page, the
 * challenge descriptions, the errors about a floor number and the accessible
 * name of the building view all keep «здание».
 *
 * «Сид» rather than «зерно»: it is what Russian-speaking players of every game
 * that has one already call it, and the word they will search for.
 *
 * English "new draw" keeps a lottery metaphor that Russian has no noun for.
 * «Розыгрыш» is a prize draw, a sporting fixture or a practical joke, and never
 * the act of drawing a fresh random value; «жеребьёвка» is the drawing of lots
 * between named participants, which is not this either. So the Russian names the
 * outcome instead of the metaphor — «новый сид» — which is also what the link
 * actually produces, and loses nothing a player needed.
 *
 * ## Rules followed here
 *
 * - **Code is never translated.** Method names, event names, signatures,
 *   property names and literal values stay exactly as player code spells them:
 *   `goToFloor`, `"up_button_pressed"`, `"stopped"`, `init`, `update`. Only
 *   prose, labels and the comments inside example code are Russian. Where a
 *   literal string value is quoted, it keeps its ASCII quotes — `"up"` is a
 *   value, not a quotation.
 * - **Typography.** «Ёлочки» for quotation, em dash with spaces around it — like
 *   this — and ё written wherever it belongs. The non-breaking space between a
 *   number and its unit comes from `Intl` (see `formatNumber`), not from here.
 * - **Register.** Buttons are short and imperative: Старт, Пауза, Заново.
 *   Challenge descriptions speak to the player directly — «Перевезите…» — with
 *   no bureaucratic nouns («осуществите транспортировку» is exactly what this
 *   file is written to avoid).
 * - **Numerals.** The counted phrases are grammatical in the sentence they are
 *   built into, which is not always the dictionary form. Nominative would be
 *   1 пассажир, 2 пассажира, 5 пассажиров, 1,5 пассажира; after «Перевезите»
 *   the noun is in the accusative, and for an animate noun that means
 *   1 пассажира, 2 пассажира, 5 пассажиров. Seconds appear in two cases and so
 *   need two entries: «за 30 секунд» (accusative) and «дольше 30 секунд»
 *   (genitive), which differ in the singular — «за 21 секунду» against «дольше
 *   21 секунды».
 */

import type { MessageCatalogue } from "./catalogue.ts";

/** Every message the game can show, in Russian. */
export const RU_MESSAGES: MessageCatalogue<"ru"> = {
  // ------------------------------------------------------------------- игра

  "page.title": "Elevator Saga — игра про программирование лифтов",
  "page.description":
    "Elevator Saga — игра про программирование: напишите на JavaScript программу, которая эффективно возит пассажиров.",
  "page.imageAlt":
    "Четыре лифта возят пассажиров между шестью этажами, а ниже, в редакторе, — управляющая ими программа на JavaScript.",
  "page.skipLink": "Перейти к редактору кода",
  "page.brand": "Elevator Saga",
  "page.tagline": "Игра про программирование лифтов",
  "page.tutorialLink": "Учебная дорожка",
  "page.nav.label": "Справка и документация",
  "page.nav.help": "Справка",
  "page.nav.documentation": "Документация",
  "page.nav.wiki": "Вики и решения",
  "page.language.label": "Язык",
  "page.noscript":
    "Похоже, ваш браузер не поддерживает JavaScript. На этой странице — игра про программирование, которая на JavaScript и написана.",
  "page.world.label": "Здание",
  "page.stats.label": "Статистика симуляции",
  "page.stats.transported": "Перевезено",
  "page.stats.elapsedTime": "Прошло времени",
  "page.stats.transportedPerSec": "Перевезено/с",
  // Ни то ни другое не время ожидания, как бы ни назывались ключи: обе цифры
  // считаются от появления пассажира до того момента, как он вышел из кабины на
  // своём этаже, так что поездка входит в них наравне с ожиданием. Слово то же,
  // что и в строке выше: пассажира перевозят, и вот сколько это заняло.
  //
  // Длина совпадает с прежней буква в букву — 20 знаков, как и «время
  // ожидания», — так что колонка в 240 px остаётся прежней.
  "page.stats.avgWaitTime": "Сред. время доставки",
  // А вот это — то самое время ожидания: отсчёт останавливается, когда за
  // пассажиром приехали, так что разница с «Сред. временем доставки» и есть
  // поездка. «Ожидание кабины», а не «время ожидания»: по глоссарию кабина —
  // это движущийся ящик, которого и ждут, а строка при этом остаётся короткой.
  // 21 знак против 20 у соседей — колонка в 240 px это держит, замерено в
  // Chromium на собранной странице.
  "page.stats.avgPickupTime": "Сред. ожидание кабины",
  "page.stats.avgPickupTimeTitle":
    "Отсчёт идёт от появления пассажира до того момента, как его забрала кабина, поэтому разница со средним временем доставки — это поездка",
  "page.stats.maxWaitTime": "Макс. время доставки",
  "page.stats.moves": "Перемещения",
  "page.stats.movesTitle":
    "Перемещение засчитывается каждый раз, когда кабина проходит середину пути от одного этажа до соседнего",
  // «Загрузка» — по глоссарию, и без «фактора»: это самая короткая строка в
  // панели (14 знаков), и место здесь дорого. Цифру легче всего понять
  // наоборот, поэтому подсказка и справка объясняют её длиннее обычного.
  "page.stats.avgLoad": "Сред. загрузка",
  "page.stats.avgLoadTitle":
    "Насколько полными были кабины — в среднем по тем же перемещениям, что считаются выше, так что стоящая кабина в цифру не попадает вовсе",
  "page.hint.html":
    "В редакторе: <kbd data-mod-key>Ctrl</kbd>+<kbd>Enter</kbd> применяет программу. <kbd data-mod-key>Ctrl</kbd>+<kbd>S</kbd> сохраняет её. <kbd>Tab</kbd> добавляет отступ. <kbd>Esc</kbd> убирает фокус из редактора.",
  "page.button.reset": "Сбросить",
  "page.button.undoReset": "Вернуть код",
  "page.button.save": "Сохранить",
  "page.button.apply": "Применить",
  "page.helpNote.html":
    'Не разобрались? Откройте страницу <a href="documentation.ru.html">справки и документации по API</a>',
  "page.footer.credits": "Сделали Magnus Wolffelt и другие участники",
  "page.footer.version": "Версия",
  "page.footer.source.html":
    '<a href="https://github.com/EpicDima/elevatorsaga">Исходный код</a> на GitHub, форк <a href="https://github.com/magwo/elevatorsaga">оригинала</a>',
  "page.footer.licences.html":
    '<a href="licenses.txt">Лицензии</a> игры и всего, что входит в её сборку',

  // ----------------------------------------------------------------- здание

  "game.floor.callUp": "Вызвать лифт вверх с этажа {floor}",
  "game.floor.callDown": "Вызвать лифт вниз с этажа {floor}",
  "game.elevator.label": "Лифт {number}",
  "game.elevator.floorButton": "Ехать на этаж {floor}",
  "game.challenge.title.html": "Задание №{number}: {description}",
  "game.challenge.nav.label": "Задания",
  "game.challenge.nav.link": "Задание {number}",
  "game.challenge.nav.demo": "Демо",
  "game.seed.label": "Сид",
  "game.seed.link": "Сид {seed}: начать ещё один прогон с этим сидом",
  "game.seed.newDraw": "новый сид",
  "game.seed.newDrawLink": "Сид {seed}: новый сид, начать заново без прежнего",
  "game.seed.helpSummary": "что задаёт сид",
  "game.seed.explanation":
    "Один и тот же сид приводит тех же пассажиров и в том же порядке. А вот когда придёт очередной кадр, решает браузер, поэтому всё остальное в прогоне каждый раз складывается немного иначе.",
  "game.seed.console":
    "Сид {seed} — снова те же пассажиры, но прогон каждый раз складывается немного иначе: {url}",
  "game.timeScale.decrease": "Уменьшить скорость симуляции",
  "game.timeScale.increase": "Увеличить скорость симуляции",
  "game.timeScale.value": "{value}×",
  "game.button.start": "Старт",
  "game.button.pause": "Пауза",
  "game.button.restart": "Заново",
  "game.feedback.success.title": "Получилось!",
  "game.feedback.success.message": "Задание выполнено",
  "game.feedback.failure.title": "Задание провалено",
  "game.feedback.failure.message": "Может быть, программу стоит доработать?",
  "game.feedback.next": "Следующее задание",
  "game.codeStatus": "С вашим кодом что-то не так:",

  // --------------------------------------------------------------- редактор

  "editor.label": "Программа для лифтов",
  "editor.saved": "Код сохранён в {time}",
  "editor.confirmReset": "Точно сбросить код до стандартной реализации?",
  "editor.confirmUndoReset": "Вернуть код, который был до сброса?",
  "editor.defaultCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0]; // Возьмём первый лифт

        // Как только лифт освободится (в очереди не осталось этажей)...
        elevator.on("idle", function() {
            // ...поедем по всем этажам (или мы про какой-то забыли?)
            elevator.goToFloor(0);
            elevator.goToFloor(1);
        });
    },
    update: function(dt, elevators, floors) {
        // Обычно здесь ничего делать не нужно
    }
}`,

  // ---------------------------------------------------------------- задания

  "challenge.transportWithinTime.html": "Перевезите {people} за {time} или быстрее",
  // Не «ждёт», а «доставка не длится»: ограничение в этих трёх фразах — это
  // World.maxWaitTime, а он останавливается на этаже пассажира, а не у дверей
  // кабины. Тот, кто прочитает его как время ожидания, будет оптимизировать
  // посадку и проиграет прогон на поездке. Управление у «дольше» прежнее,
  // родительный падеж, так что формы challenge.waitLimit.html не меняются.
  "challenge.transportWithMaxWait.html":
    "Перевезите {people}, и пусть доставка каждого не длится дольше {waitTime}",
  "challenge.transportWithinTimeWithMaxWait.html":
    "Перевезите {people} за {time} или быстрее, и пусть доставка каждого не длится дольше {waitTime}",
  "challenge.transportWithinMoves.html": "Перевезите {people}, уложившись в {moves}",
  // «Уложившись в» уже управляет ходами (винительный падеж, формы
  // challenge.moveLimit.html), поэтому вторая половина фразы присоединяется
  // ровно так же, как во фразе со временем: запятая и «и пусть».
  "challenge.transportWithinMovesWithMaxWait.html":
    "Перевезите {people}, уложившись в {moves}, и пусть доставка каждого не длится дольше {waitTime}",
  "challenge.demo": "Бесконечная демонстрация",
  // Винительный падеж после «Перевезите»; у одушевлённого существительного он
  // совпадает с родительным: 1 пассажира, 5 пассажиров.
  "challenge.people.html": {
    one: "<span class='emphasis-color'>{count}</span> пассажира",
    few: "<span class='emphasis-color'>{count}</span> пассажира",
    many: "<span class='emphasis-color'>{count}</span> пассажиров",
    other: "<span class='emphasis-color'>{count}</span> пассажира",
  },
  // Винительный падеж после «за»: за 21 секунду, за 23 секунды, за 30 секунд.
  "challenge.timeLimit.html": {
    one: "<span class='emphasis-color'>{count}</span> секунду",
    few: "<span class='emphasis-color'>{count}</span> секунды",
    many: "<span class='emphasis-color'>{count}</span> секунд",
    other: "<span class='emphasis-color'>{count}</span> секунды",
  },
  // Родительный падеж после «дольше»: дольше 21 секунды, дольше 30 секунд.
  //
  // На экране, впрочем, всегда оказывается только форма other. Все три места,
  // где собирается эта фраза (src/game/challenges.ts), передают сюда
  // decimal(maxWaitTime, 1), а число с десятыми в русском всегда попадает в
  // other: лимиты заданий — 21 и 45 секунд — читаются как «дольше 21,0 секунды»
  // и «дольше 45,0 секунды», а не «дольше 21 секунды» и «дольше 45 секунд».
  // Формы one, few и many всё равно остаются: их требует тип, они правильные, и
  // целого числа сюда просто никто не передаёт.
  "challenge.waitLimit.html": {
    one: "<span class='emphasis-color'>{count}</span> секунды",
    few: "<span class='emphasis-color'>{count}</span> секунд",
    many: "<span class='emphasis-color'>{count}</span> секунд",
    other: "<span class='emphasis-color'>{count}</span> секунды",
  },
  // Винительный падеж после «уложившись в»: в 21 перемещение, в 24 перемещения,
  // в 60 перемещений. Слово «лифта» отсюда убрано: счётчик складывает
  // перемещения всех кабин здания, а не одной, и в единственном числе оно
  // приписывало общий лимит одному лифту — а лифтов в этих заданиях от двух до
  // шести. Панель, на которой игрок видит этот счёт, называет его тем же словом
  // без уточнений — «Перемещения».
  "challenge.moveLimit.html": {
    one: "<span class='emphasis-color'>{count}</span> перемещение",
    few: "<span class='emphasis-color'>{count}</span> перемещения",
    many: "<span class='emphasis-color'>{count}</span> перемещений",
    other: "<span class='emphasis-color'>{count}</span> перемещения",
  },
  "challenge.sandbox.html":
    "Песочница: {floors}, {elevators} {capacityLabel} {capacities}, {spawnRate}. Цели нет, поэтому симуляция никогда не закончится",
  "challenge.sandbox.floors.html": {
    one: "<span class='emphasis-color'>{count}</span> этаж",
    few: "<span class='emphasis-color'>{count}</span> этажа",
    many: "<span class='emphasis-color'>{count}</span> этажей",
    other: "<span class='emphasis-color'>{count}</span> этажа",
  },
  "challenge.sandbox.elevators.html": {
    one: "<span class='emphasis-color'>{count}</span> лифт",
    few: "<span class='emphasis-color'>{count}</span> лифта",
    many: "<span class='emphasis-color'>{count}</span> лифтов",
    other: "<span class='emphasis-color'>{count}</span> лифта",
  },
  // Русскому здесь ничего склонять не нужно: «вместимостью» одинаково подходит
  // и одному лифту, и списку из четырёх. Форма всё равно нужна во всех четырёх
  // категориях — этого требует тип, и это честнее, чем делать вид, что счёт
  // здесь ни при чём.
  "challenge.sandbox.capacityLabel": {
    one: "вместимостью",
    few: "вместимостью",
    many: "вместимостью",
    other: "вместимостью",
  },
  "challenge.sandbox.spawnRate.html": {
    one: "<span class='emphasis-color'>{count}</span> пассажир в секунду",
    few: "<span class='emphasis-color'>{count}</span> пассажира в секунду",
    many: "<span class='emphasis-color'>{count}</span> пассажиров в секунду",
    other: "<span class='emphasis-color'>{count}</span> пассажира в секунду",
  },

  // ------------------------------------------------------ подсказки в редакторе

  "completion.events.on":
    "Подписать обработчик. Несколько имён событий через пробел подписывают его сразу на все, и тогда первым аргументом ему приходит имя сработавшего события.",
  "completion.events.once":
    "Подписать обработчик, который сработает не больше одного раза и будет снят. Принимает одно имя события.",
  "completion.events.one":
    "Старое имя для once — то самое, что было в оригинальной игре. Ведёт себя так же и тоже принимает одно имя события.",
  "completion.events.off":
    'Снять обработчики. Если передать функцию, снимется только она; если не передавать — все обработчики названных событий. Единственное имя "*" снимает обработчики всех событий.',
  "completion.events.offAll":
    "Снять все обработчики, которые подписали вы, на все события этого лифта или этажа. Обработчики, нужные самой игре, живут отдельно, так что объект продолжает работать.",
  "completion.elevator.goToFloor":
    "Поставить в очередь поездку лифта на указанный этаж. Если вторым аргументом передать true, лифт поедет туда сразу, а уже потом — по остальным этажам из очереди.",
  "completion.elevator.stop":
    "Очистить очередь этажей и остановить лифт, если он едет. Учтите, что лифт, скорее всего, встанет не на этаже, так что пассажиры не выйдут.",
  "completion.elevator.currentFloor":
    "Возвращает этаж, на котором лифт сейчас находится. Учтите, что это округлённое число и оно не обязательно означает, что лифт стоит.",
  "completion.elevator.goingUpIndicator":
    "Возвращает или задаёт индикатор движения вверх — от него зависит, как поведут себя пассажиры при остановке на этаже.",
  "completion.elevator.goingDownIndicator":
    "Возвращает или задаёт индикатор движения вниз — от него зависит, как поведут себя пассажиры при остановке на этаже.",
  "completion.elevator.maxPassengerCount":
    "Возвращает, сколько пассажиров помещается в лифт одновременно.",
  "completion.elevator.loadFactor":
    "Возвращает загрузку лифта: 0 — пустой, 1 — полный. Зависит от веса пассажиров, а он разный, так что мера неточная.",
  "completion.elevator.isFull":
    "Возвращает, все ли места в лифте заняты. Пользуйтесь этим, а не сравнением загрузки с 1: вес пассажиров разный, поэтому у полностью набитого лифта загрузка в среднем всего около 0,775.",
  "completion.elevator.isEmpty":
    "Возвращает, пуст ли лифт. Это не противоположность isFull: лифт с одним пассажиром из четырёх не подходит ни под то, ни под другое.",
  "completion.elevator.destinationDirection":
    "Возвращает направление, в котором лифт собирается ехать.",
  "completion.elevator.isApproachingFloor":
    "Возвращает, едет ли лифт к указанному этажу и не проехал ли его. Учитывается только направление движения, так что лифт считается приближающимся и к тем этажам, которые лежат дальше по ходу движения, даже если он остановится раньше.",
  "completion.elevator.destinationQueue":
    "Текущая очередь этажей — номера этажей, на которые лифт собирается заехать. Её можно менять и очищать. Учтите, что после изменения нужно вызвать checkDestinationQueue(), чтобы оно подействовало сразу.",
  "completion.elevator.checkDestinationQueue":
    "Смотрит, не появилось ли в очереди этажей новых пунктов назначения. Вызывать это нужно, только если вы меняли очередь вручную.",
  "completion.elevator.getPressedFloors": "Возвращает массив номеров нажатых этажей.",
  "completion.floor.floorNum": "Возвращает номер этажа.",
  "completion.elevator.event.idle": "Срабатывает, когда лифт выполнил все задачи и ничем не занят.",
  "completion.elevator.event.floorButtonPressed":
    "Срабатывает, когда пассажир нажал кнопку внутри лифта.",
  "completion.elevator.event.passingFloor":
    'Срабатывает незадолго до того, как лифт проедет мимо этажа. Удобный момент, чтобы решить, останавливаться ли на нём. Учтите, что для этажа назначения это событие не срабатывает. Направление — "up" или "down".',
  "completion.elevator.event.stoppedAtFloor": "Срабатывает, когда лифт приехал на этаж.",
  "completion.floor.event.upButtonPressed":
    "Срабатывает, когда на этаже нажали кнопку вызова вверх. Учтите, что пассажиры нажмут её снова, если не смогли зайти в лифт.",
  "completion.floor.event.downButtonPressed":
    "Срабатывает, когда на этаже нажали кнопку вызова вниз. Учтите, что пассажиры нажмут её снова, если не смогли зайти в лифт.",
  "completion.floor.event.buttonStateChange":
    "Одна из кнопок вызова на этаже загорелась или погасла.",
  "completion.global.skeleton":
    "Ваш код должен объявлять объект, в котором есть хотя бы две функции — init и update.",
  "completion.global.init":
    "Вызывается в начале задания. Обычно основную часть кода пишут здесь: настраивают обработчики событий и логику.",
  "completion.global.update":
    "Вызывается многократно по ходу задания. dt — сколько игровых секунд прошло с прошлого вызова update.",
  "completion.initSkeleton.code": `init: function(elevators, floors) {
    // Делайте что-нибудь с лифтами и этажами: и те и другие — массивы объектов
}`,
  "completion.updateSkeleton.code": `update: function(dt, elevators, floors) {
    // Ещё что-нибудь с лифтами и этажами
}`,

  // ------------------------------------------------------ оценка эффективности

  "fitness.measuring": "Считаем эффективность…",
  // В каждой колонке — World.avgWaitTime одного сценария, поэтому строка
  // называет его так же, как панель, а не так, как названо поле.
  "fitness.results": "Эффективность, среднее время доставки: {results}",
  "fitness.result": "{scenario}: {value}",
  "fitness.unknownValue": "?",
  "fitness.error": "Не удалось посчитать эффективность из-за ошибки: {error}",
  "fitness.workerTimeout":
    "Воркер оценки эффективности не закончил работу за {seconds} и был остановлен. Нет ли в вашей программе бесконечного цикла?",
  "fitness.workerFailed": "Воркер оценки эффективности завершился с ошибкой",
  // Встречается только в консольной команде: программа, которая бесконечно
  // выделяет память, съедает кучу потока, и Node завершает поток, не давая ему
  // отчитаться. Своя формулировка, а не сообщение Node: там речь о размерах
  // кучи и ни слова о программе.
  "fitness.workerOutOfMemory":
    "Воркеру оценки эффективности не хватило памяти, и он был остановлен. Не копит ли ваша программа что-то с каждым пассажиром?",
  "fitness.scenario.small": "Маленький сценарий",
  "fitness.scenario.medium": "Средний сценарий",
  "fitness.scenario.large": "Большой сценарий",

  // ---------------------------------------------------------------- ошибки

  "error.code.noInit": "В коде должна быть функция init",
  "error.code.noUpdate": "В коде должна быть функция update",
  // {value} is whatever the player passed, and both of these frames have to
  // stay grammatical for every shape of it: a quoted string, NaN, undefined, or
  // one of the two nouns below. So the verb agrees with the subject and never
  // with {value}, and {value} lands in the accusative, which for an inanimate
  // masculine noun is spelled like the nominative. That is what «содержит
  // массив» and «получил объект» rely on. An earlier wording, «В
  // elevator.destinationQueue попало {value}», did not: «попало» is neuter and
  // «массив» is masculine, so the one sentence a player sees when they put an
  // array in the queue was ungrammatical.
  "error.elevator.notAFloor":
    "elevator.{method} получил {value} — это не номер этажа. Нужно конечное число, а этажи в этом здании — от 0 до {topFloor}.",
  "error.elevator.queueNotAFloor":
    "elevator.destinationQueue содержит {value} — это не номер этажа. Запись отброшена, чтобы лифт продолжал работать; destinationQueue принимает конечные числа, а этажи в этом здании — от 0 до {topFloor}.",
  "error.value.array": "массив",
  "error.value.object": "объект",
  "error.movable.busy": "Объект занят — воспользуйтесь колбэком",
  "error.thrown.emptyString": "Брошена пустая строка",
  "error.thrown.noMessage": "Брошен {kind} без сообщения",
  "error.thrown.keys": "{kind} с ключами: {keys}",

  // ------------------------------------------------------- справка: страница

  "docs.page.title": "Elevator Saga — справка и документация по API",
  "docs.page.description": "Справка и документация по API для Elevator Saga.",
  "docs.page.tagline": "Справка и документация по API",
  "docs.nav.label": "Игра",
  "docs.nav.back": "Вернуться к игре",

  // ----------------------------------------------------------- справка: игра

  "docs.about.heading": "Об игре",
  "docs.about.p1.html":
    'Это игра про программирование!<br /> Ваша задача — управлять движением лифтов, написав программу на <a href="https://developer.mozilla.org/ru/docs/Web/JavaScript/Guide">JavaScript</a>.',
  "docs.about.p2.html":
    "Цель — возить пассажиров эффективно.<br /> Чем лучше это получается, тем дальше вы продвигаетесь по всё более сложным заданиям.<br /> Пройти все задания под силу только самым лучшим программам.",
  "docs.play.heading": "Как играть",
  // «Дорожка», а не «трек»: слово стоит рядом с названием ссылки в шапке игры
  // («Учебная дорожка»), и читатель должен узнать в тексте ту самую ссылку.
  "docs.play.track.html":
    'Если вы никогда не писали таких программ, начните с <a href="index.html#challenge=tutorial-1">учебной дорожки</a> — на неё ведёт и ссылка <span class="emphasis-color">Учебная дорожка</span> в шапке игры. Это восемь небольших зданий, которые знакомят с этим API по одной ошибке за раз: в каждом выдаётся программа, которая проигрывает, и нужно найти в ней единственную ошибку — рядом есть подсказки и разбор того, что на самом деле происходило в прогоне.',
  "docs.play.apply.html":
    'Напишите код в окне под игровым полем и нажмите кнопку <span class="emphasis-color">Применить</span>, чтобы начать задание.<br /> Скорость времени можно увеличивать и уменьшать кнопками {increase} и {decrease}.',
  "docs.play.statistics.html":
    'Рядом со зданием есть панель, которая ведёт счёт по ходу прогона. Пять строк в ней стоит пояснить. Сначала <span class="emphasis-color">Перемещения</span>. Перемещение засчитывается каждый раз, когда кабина проходит середину пути от одного этажа до соседнего: проехать три этажа — это три перемещения. Кабина, повернувшая назад уже за серединой, проходит её дважды, и засчитываются оба раза; тормозит она не мгновенно, так что и поворот назад незадолго до середины обычно обходится в те же два. В трёх заданиях оценивается не только число перевезённых пассажиров, но и число перемещений — одно на все лифты здания, — так что там кабина, которая катается вхолостую, способна провалить прогон. Дальше два времени. <span class="emphasis-color">Сред. время доставки</span> и <span class="emphasis-color">Макс. время доставки</span> отсчитываются от момента, когда пассажир появился в здании, до момента, когда он вышел из кабины на нужном ему этаже, так что поездка входит в них наравне с ожиданием: тот, кто сразу зашёл в стоявшую у его этажа кабину и не ждал ни секунды, всё равно добавит к обеим цифрам каждую секунду поездки на девятнадцать этажей. По второй из них оцениваются девять заданий и две задачи учебной дорожки; это наибольшее время, которое набрал хоть один пассажир, — пока кто-то ещё в пути, оно продолжает расти, а набранного уже не теряет. Между ними и стоит <span class="emphasis-color">Сред. ожидание кабины</span> — то самое время ожидания, которым те две цифры не являются. Отсчёт идёт от появления пассажира до того момента, как его забрала кабина, поэтому разница со средним временем доставки — это поездка. В среднее попадают только те, до кого кабина уже доехала, так что тот, кто так и остался стоять на этаже, виден не здесь, а в максимуме. Наконец, <span class="emphasis-color">Сред. загрузка</span>. Насколько полными были кабины — в среднем по тем же перемещениям, что считаются выше, так что стоящая кабина в цифру не попадает вовсе: за простой здесь ничего не снимается, а в нескольких заданиях он и есть верный ход. В обычном прогоне цифра держится далеко от полной кабины, и исправлять тут нечего: кабины редко бывают полными, и за то, чтобы их набить, игра ничего не даёт. И выше — не значит лучше. Из трёх программ, прогнанных на одном и том же восемнадцатиэтажном здании, та, что держит кабину на этаже, пока она не наберётся почти полной, дошла до загрузки около семи десятых — и перевезла меньше всех троих, а ждали у неё почти вдвое дольше, чем у лучшей; у лучшей же кабины оказались самыми пустыми, меньше половины. Полезна эта цифра для сравнения двух программ, которые перевозят примерно поровну: при равном числе перевезённых та, у которой загрузка выше, обошлась меньшим числом пустых рейсов.',
  "docs.play.shortcuts.html":
    "В редакторе <kbd data-mod-key>Ctrl</kbd>+<kbd>Enter</kbd> применяет программу и перезапускает задание, <kbd data-mod-key>Ctrl</kbd>+<kbd>S</kbd> сохраняет её, <kbd>Tab</kbd> добавляет отступ, а <kbd>Esc</kbd> убирает фокус из редактора.",
  "docs.play.debugging.html":
    'Если в программе ошибка, попробуйте разобраться с ней через инструменты разработчика в браузере. Чтобы начать с чистого листа, нажмите кнопку <span class="emphasis-color">Сбросить</span>: код вернётся к рабочей, но совсем простой реализации.<br /> Если у вас есть любимый текстовый редактор, например <a href="https://www.sublimetext.com/">Sublime Text</a>, пишите код в нём и вставляйте в редактор игры.<br /> Код сам сохраняется в локальном хранилище браузера, так что не переживайте — он не пропадёт, если вы случайно закроете браузер.',

  // ---------------------------------------------------------- справка: основы

  "docs.basics.heading": "Основы",
  "docs.basics.declare.html":
    'Ваш код должен объявлять объект, в котором есть хотя бы две функции — <span class="emphasis-color">init</span> и <span class="emphasis-color">update</span>. Вот так:',
  "docs.basics.example.code": `{
    init: function(elevators, floors) {
        // Делайте что-нибудь с лифтами и этажами: и те и другие — массивы объектов
    },
    update: function(dt, elevators, floors) {
        // Ещё что-нибудь с лифтами и этажами
        // dt — сколько игровых секунд прошло с прошлого вызова update
    }
}`,
  "docs.basics.called.html":
    'Эти функции игра вызывает по ходу задания.<br /> <span class="emphasis-color">init</span> вызывается в начале задания, а <span class="emphasis-color">update</span> — многократно, пока оно идёт.',
  "docs.basics.initPurpose.html":
    'Обычно основную часть кода пишут в функции <span class="emphasis-color">init</span>: там настраивают обработчики событий и логику.',
  "docs.basics.noLibraries.html":
    'Раньше игра подключала jQuery и lodash, поэтому в старых решениях с вики часто встречаются <span class="emphasis-color">$</span> и <span class="emphasis-color">_</span>. Ни та, ни другая библиотека больше не подключается, и вашей программе они недоступны: решение с ними упадёт с ошибкой <span class="emphasis-color">$ is not defined</span> или <span class="emphasis-color">_ is not defined</span>. Почти всё, ради чего они здесь были нужны, — <span class="emphasis-color">_.filter</span>, <span class="emphasis-color">_.map</span>, <span class="emphasis-color">_.each</span> и им подобные — есть у самих массивов (<span class="emphasis-color">filter</span>, <span class="emphasis-color">map</span>, <span class="emphasis-color">forEach</span>) в любом браузере, который потянет эту игру. Исключение — <span class="emphasis-color">_.min</span> и <span class="emphasis-color">_.max</span>: <span class="emphasis-color">Math.min</span> методом массива не является и принимает аргументы по одному, а не массивом, поэтому вместо <span class="emphasis-color">_.min(floorNums)</span> придётся писать <span class="emphasis-color">Math.min(...floorNums)</span>. Заодно следите за пустым массивом: <span class="emphasis-color">Math.min()</span> без единого аргумента возвращает <span class="emphasis-color">Infinity</span>, а не этаж, и <span class="emphasis-color">goToFloor</span> такое значение не примет, так что случай пустого <span class="emphasis-color">getPressedFloors()</span> придётся разобрать отдельно.',

  // -------------------------------------------------------- справка: примеры

  "docs.examples.heading": "Примеры кода",
  "docs.examples.control.heading": "Как управлять лифтом",
  "docs.examples.goToFloor":
    "Отправить лифт на этаж 1 после всех остальных дел, если они есть. Если этот этаж уже стоит в том конце очереди, куда его собирались добавить, запрос отбрасывается — так что повторные запросы одного и того же этажа не копятся. Это единственный случай, когда запрос отбрасывается: этаж, стоящий в очереди где-то ещё, добавится ещё раз.",
  "docs.examples.currentFloor":
    "Вызов currentFloor возвращает этаж, на котором лифт сейчас находится. Учтите, что это округлённое число и оно не обязательно означает, что лифт стоит.",
  "docs.examples.events.heading": "Как слушать события",
  "docs.examples.events.intro.html":
    'События можно слушать — например, остановку на этаже или нажатие кнопки. И лифты, и этажи понимают <span class="emphasis-color">on</span>, <span class="emphasis-color">once</span>, <span class="emphasis-color">one</span>, <span class="emphasis-color">off</span> и <span class="emphasis-color">offAll</span>; что делает каждый из них, написано ниже, в разделе <a href="#events">методы событий</a>.',
  "docs.examples.idle":
    'Слушаем событие "idle": лифт присылает его, когда очередь задач опустела и делать ему нечего. В этом примере мы отправляем лифт на этаж 0.',
  "docs.examples.floorButtonPressed":
    'Слушаем событие "floor_button_pressed": оно приходит, когда пассажир нажал кнопку внутри лифта. Значит, он хочет попасть на этот этаж.',
  "docs.examples.upButtonPressed":
    'Слушаем событие "up_button_pressed": оно приходит, когда пассажир нажал кнопку вызова вверх на этаже, где он ждёт. Значит, он хочет уехать на другой этаж. Обработчику передаётся этаж, на котором нажали кнопку.',
  "docs.examples.events.perElevator.html":
    'У каждого лифта свои события, поэтому обработчик, подписанный на один лифт, слышит только его: в здании из четырёх лифтов обработчик придётся подписать четыре раза, и короче всего это записывается как <span class="emphasis-color">elevators.forEach(function(elevator) { ... })</span>. Если же все обработчики словно управляют одним и тем же, последним лифтом, искать надо не в лифтах, а в цикле, который их подписывал. <span class="emphasis-color">for (var i = 0; i &lt; elevators.length; i++) { var elevator = elevators[i]; elevator.on("idle", function() { elevator.goToFloor(0); }); }</span> подписывает каждый обработчик на свой лифт, но <span class="emphasis-color">var</span> заводит одну-единственную переменную <span class="emphasis-color">elevator</span> на всю функцию, а срабатывают обработчики позже, когда цикл давно закончился, — и к этому моменту в ней лежит лифт, на котором цикл остановился, им они все и управляют. <span class="emphasis-color">let</span> и <span class="emphasis-color">const</span> заводят на каждой итерации свою переменную, поэтому <span class="emphasis-color">for (const elevator of elevators)</span> и <span class="emphasis-color">forEach</span> делают то, чего ждёшь от варианта с <span class="emphasis-color">var</span>, но не получаешь. С этажами всё устроено так же — и с любой другой переменной, которую обработчик захватывает в замыкание внутри цикла.',

  // ---------------------------------------------------------- справка: API

  "docs.api.heading": "Документация по API",
  "docs.table.method": "Метод",
  "docs.table.property": "Свойство",
  "docs.table.event": "Событие",
  "docs.table.type": "Тип",
  "docs.table.explanation": "Описание",
  "docs.table.example": "Пример",

  "docs.api.events.heading": "Методы событий",
  "docs.api.events.intro":
    "Каждый лифт и каждый этаж — источник событий, и вот какие методы он вам даёт. Все они возвращают объект, у которого были вызваны, так что вызовы можно собирать в цепочку.",
  "docs.api.events.on":
    "Подписать обработчик. Обработчики вызываются в порядке подписки, и одну и ту же функцию можно подписать несколько раз. Несколько имён событий через пробел подписывают один обработчик сразу на все; если имён больше одного, первым аргументом обработчику приходит имя сработавшего события, а за ним — аргументы самого события.",
  "docs.api.events.once":
    "Подписать обработчик, который сработает не больше одного раза и будет снят. Снимается он до вызова, поэтому то же событие, вызванное изнутри него, второй раз его не запустит. Принимает одно имя события.",
  "docs.api.events.one.html":
    'Старое имя для <span class="emphasis-color">once</span> — то самое, что было в оригинальной игре. Ведёт себя так же и тоже принимает одно имя события.',
  "docs.api.events.off.html":
    'Снять обработчики. Если передать функцию, снимется только она, как бы она ни была подписана; если не передавать — снимутся все обработчики названных событий. Имена можно перечислять через пробел, как в <span class="emphasis-color">on</span>, а единственное имя <span class="emphasis-color">"*"</span> снимает обработчики всех событий сразу — функция, переданная вместе со звёздочкой, игнорируется. Нужна ссылка на подписанную функцию, поэтому анонимную функцию, объявленную прямо в вызове, снять нельзя.',
  "docs.api.events.off.example.code": `function goHome() { elevator.goToFloor(0); }
elevator.on("idle", goHome);
elevator.off("idle", goHome); // Только этот
elevator.off("idle"); // Все обработчики idle
elevator.off("*"); // Все обработчики всех событий`,
  "docs.api.events.offAll.html":
    'Снять все обработчики, которые подписали <em>вы</em>, на все события этого лифта или этажа. Обработчики, нужные самой игре, живут отдельно, так что объект продолжает работать — и всё, что вы подпишете потом, будет срабатывать как обычно. Это <span class="emphasis-color">off("*")</span> под собственным именем.',
  "docs.api.events.outro.html":
    'Снимать обработчики обычно не нужно: при перезапуске задания лифты и этажи выбрасываются, а ваш <span class="emphasis-color">init</span> вызывается заново уже на новых. Снятие пригодится, когда обработчик должен действовать только какое-то время.',

  "docs.api.elevator.heading": "Объект лифта",
  "docs.api.elevator.goToFloor.html":
    'Поставить в очередь поездку лифта на указанный этаж. Если вторым аргументом передать true, лифт поедет туда сразу, а уже потом — по остальным этажам из очереди. Запрос отбрасывается, если этаж уже стоит в том конце очереди, куда он попал бы: в хвосте при обычном вызове и в голове при вызове с true. Тот же этаж дальше по очереди добавится ещё раз. Номер этажа за пределами здания подтягивается к ближайшему существующему этажу, а вот значение, которое числом не является вовсе, — <span class="emphasis-color">NaN</span>, <span class="emphasis-color">undefined</span>, строка, которую не удаётся преобразовать в число, — не принимается: игра сообщает об ошибке в вашем коде.',
  "docs.api.elevator.goToFloor.example.code": `elevator.goToFloor(3); // Поехать после всего остального — очередь: 3
elevator.goToFloor(2, true); // Поехать раньше всего остального — очередь: 2, 3
elevator.goToFloor(3); // Отброшено: 3 уже последний
elevator.goToFloor(2, true); // Отброшено: 2 уже первый
elevator.goToFloor(2); // Всё равно добавится — очередь: 2, 3, 2`,
  "docs.api.elevator.stop":
    "Очистить очередь этажей и остановить лифт, если он едет. Обычно останавливать лифты не нужно — это на случай продвинутых решений, которые перестраивают маршрут на ходу. И учтите, что лифт, скорее всего, встанет не на этаже, так что пассажиры не выйдут.",
  "docs.api.elevator.currentFloor": "Возвращает этаж, на котором лифт сейчас находится.",
  "docs.api.elevator.currentFloor.example.code": `if(elevator.currentFloor() === 0) {
    // Сделать что-нибудь особенное?
}`,
  "docs.api.elevator.goingUpIndicator":
    "Возвращает или задаёт индикатор движения вверх — от него зависит, как поведут себя пассажиры при остановке на этаже.",
  "docs.api.elevator.goingDownIndicator":
    "Возвращает или задаёт индикатор движения вниз — от него зависит, как поведут себя пассажиры при остановке на этаже.",
  "docs.api.elevator.maxPassengerCount":
    "Возвращает, сколько пассажиров помещается в лифт одновременно.",
  "docs.api.elevator.maxPassengerCount.example.code": `if(elevator.maxPassengerCount() > 5) {
    // Приспособить этот лифт под что-то особенное — он большой
}`,
  "docs.api.elevator.loadFactor":
    "Возвращает загрузку лифта: 0 — пустой, 1 — полный. Зависит от веса пассажиров, а он разный, так что мера неточная.",
  "docs.api.elevator.loadFactor.example.code": `if(elevator.loadFactor() < 0.4) {
    // Может, взять этот лифт — он ещё не полный?
}`,
  "docs.api.elevator.isFull":
    "Возвращает, все ли места в лифте заняты. Пользуйтесь этим, а не сравнением загрузки с 1: вес пассажиров разный, поэтому у полностью набитого лифта загрузка в среднем всего около 0,775. Тот, кто только начал заходить, уже считается — место он занял.",
  "docs.api.elevator.isFull.example.code": `if(!elevator.isFull()) {
    // Может, подобрать кого-нибудь по пути?
}`,
  "docs.api.elevator.isEmpty":
    "Возвращает, пуст ли лифт. Это не противоположность isFull: лифт с одним пассажиром из четырёх не подходит ни под то, ни под другое.",
  "docs.api.elevator.isEmpty.example.code": `if(elevator.isEmpty()) {
    // Никого на борту — поехать ждать туда, где будет полезнее?
}`,
  "docs.api.elevator.isApproachingFloor":
    "Возвращает, едет ли лифт к указанному этажу и не проехал ли его. Учитывается только направление движения, так что лифт считается приближающимся и к тем этажам, которые лежат дальше по ходу движения, даже если он остановится раньше. Это та же проверка, которую делает сама игра перед событием passing_floor, так что если она ответила «нет», для этого этажа событие уже не сработает. Стоящий лифт не приближается ни к чему, и тот, что уже приехал на нужный этаж, — тоже. Номер этажа за пределами здания подтягивается к ближайшему существующему этажу, а значение, которое числом не является вовсе (в том числе забытый аргумент), не принимается: игра сообщает об ошибке в вашем коде, как и в goToFloor.",
  "docs.api.elevator.isApproachingFloor.example.code": `if(elevator.isApproachingFloor(2)) {
    // Может, остановиться и забрать тех, кто там ждёт?
}`,
  "docs.api.elevator.destinationDirection":
    'Возвращает направление, в котором лифт собирается ехать. Возможные значения — "up", "down" и "stopped".',
  "docs.api.elevator.destinationQueue":
    "Текущая очередь этажей — номера этажей, на которые лифт собирается заехать. Её можно менять и очищать. Учтите, что после изменения нужно вызвать checkDestinationQueue(), чтобы оно подействовало сразу. При ближайшей проверке очереди все записи, которые конечными числами не являются, отбрасываются разом, а игра сообщает об ошибке в вашем коде, называя только первую такую запись, — и только один раз для каждого лифта. Номер этажа за пределами здания, если это конечное число, из очереди не убирается: лифт просто уедет за пределы шахты.",
  "docs.api.elevator.checkDestinationQueue":
    "Смотрит, не появилось ли в очереди этажей новых пунктов назначения. Вызывать это нужно, только если вы меняли очередь вручную.",
  "docs.api.elevator.getPressedFloors": "Возвращает массив номеров нажатых этажей.",
  "docs.api.elevator.getPressedFloors.example.code": `if(elevator.getPressedFloors().length > 0) {
    // Может, сначала заехать на один из выбранных этажей?
}`,
  "docs.api.elevator.idle": "Срабатывает, когда лифт выполнил все задачи и ничем не занят.",
  "docs.api.elevator.floorButtonPressed": "Срабатывает, когда пассажир нажал кнопку внутри лифта.",
  "docs.api.elevator.floorButtonPressed.example.code": `elevator.on("floor_button_pressed", function(floorNum) {
    // Может, отправить лифт на этот этаж?
})`,
  "docs.api.elevator.passingFloor":
    'Срабатывает незадолго до того, как лифт проедет мимо этажа. Удобный момент, чтобы решить, останавливаться ли на нём. Учтите, что для этажа назначения это событие не срабатывает. Направление — "up" или "down".',
  "docs.api.elevator.stoppedAtFloor": "Срабатывает, когда лифт приехал на этаж.",
  "docs.api.elevator.stoppedAtFloor.example.code": `elevator.on("stopped_at_floor", function(floorNum) {
    // Может, решить, куда ехать дальше?
})`,

  "docs.api.floor.heading": "Объект этажа",
  "docs.api.floor.floorNum": "Возвращает номер этажа.",
  "docs.api.floor.upButtonPressed":
    "Срабатывает, когда на этаже нажали кнопку вызова вверх. Учтите, что пассажиры нажмут её снова, если не смогли зайти в лифт. Обработчику передаётся этаж, на котором нажали кнопку.",
  "docs.api.floor.upButtonPressed.example.code": `floor.on("up_button_pressed", function(floor) {
    // Может, отправить сюда какой-нибудь лифт?
})`,
  "docs.api.floor.downButtonPressed":
    "Срабатывает, когда на этаже нажали кнопку вызова вниз. Учтите, что пассажиры нажмут её снова, если не смогли зайти в лифт. Обработчику передаётся этаж, на котором нажали кнопку.",
  "docs.api.floor.downButtonPressed.example.code": `floor.on("down_button_pressed", function(floor) {
    // Может, отправить сюда какой-нибудь лифт?
})`,
  "docs.api.floor.buttonStateChange.html":
    'Срабатывает, когда одна из кнопок вызова на этаже загорелась или погасла. Обработчику передаётся состояние обеих кнопок: объект со свойствами <span class="emphasis-color">up</span> и <span class="emphasis-color">down</span>, каждое из которых — либо <span class="emphasis-color">"activated"</span>, либо пустая строка. Это снимок на момент события, так что сохранённый объект о более поздних нажатиях не расскажет.',
  "docs.api.floor.buttonStateChange.example.code": `floor.on("buttonstate_change", function(buttonStates) {
    if(buttonStates.up === "" && buttonStates.down === "") {
        // Здесь больше никто не ждёт?
    }
})`,

  // -------------------------------------------------------- учебная дорожка
  // «Учебное задание» — это задание дорожки, «задание №N» — задание игры;
  // первое пишется с уточнением, чтобы игрок не спутал одно с другим, и по той
  // же причине кнопка выхода ведёт «к заданиям игры».
  //
  // Исключение — строка положения в панели, `tutorial.panel.position`. Она
  // стоит сразу за названием дорожки: `tutorial.panel.label` идёт перед ней в
  // той же строке и набран полужирным, так что уточнение там уже сделано, а
  // повтор давал «Учебная дорожка Учебное задание 7 из 8». В заголовке над
  // зданием, `tutorial.bar.title.html`, названия дорожки рядом нет, поэтому
  // уточнение остаётся.
  //
  // В строках дорожки здание всюду называется домом — и в подсказках, и в
  // комментариях программ; почему в дорожке «дом», а за её пределами «здание»,
  // сказано в глоссарии в начале файла. Остальное по глоссарию: лифт, кабина,
  // пассажир, загрузка, очередь этажей, обработчик, подписать, прогон.
  //
  // В ключах `.code` переведены только комментарии: сам код побайтово тот же,
  // что и в английском каталоге, и это проверяет `catalogue.test.ts`, а не
  // честное слово. Слова в комментариях намеренно те же, что в подсказках
  // этого же задания: игрок читает программу в редакторе, а подсказки — рядом,
  // в панели, и «этот дом», «круг», «объезд» должны в обоих местах означать
  // одно и то же.

  "tutorial.task1.title": "Лифт, который никуда не едет",
  "tutorial.task1.goal":
    "Сделайте так, чтобы лифт заезжал на оба этажа этого дома, и перевезите 10 пассажиров за 60 секунд.",
  "tutorial.task1.hint1.html":
    "Смотрите не в код, а на дом. Лифт стоит на нулевом этаже, и в очереди у него тот же нулевой этаж. Сколько всего этажей в этом доме?",
  "tutorial.task1.hint2.html":
    'Этажи нумеруются с нуля, поэтому верхний этаж здесь — <span class="emphasis-color">1</span>. В том же обработчике нужна ещё одна строка рядом с уже написанной.',
  "tutorial.task1.hint3.html":
    'Ответ: добавьте <span class="emphasis-color">elevator.goToFloor(1);</span> следом за уже написанной строкой — тогда лифт, освободившись, будет ставить в очередь оба этажа.',
  "tutorial.task1.explanation.html":
    "goToFloor никуда не едет. Он дописывает этаж в конец destinationQueue и вызывает checkDestinationQueue, а дальше лифт разбирает очередь сам. Поэтому goToFloor(0), когда кабина и так стоит на нулевом этаже, — это законная поездка нулевой длины: лифт приезжает туда, где стоит, открывает двери, люди заходят, очередь снова пуста, снова срабатывает idle, и снова происходит то же самое. Вот почему кабина наполняется, а счётчик перемещений держится на нуле. Пассажир садится в момент приезда и выходит на том этаже, который попросил, а этот лифт до него не доезжает. И ещё одно, о чём стоит сказать вслух: номер этажа за пределами дома — не ошибка, его молча приводят к ближайшему настоящему этажу. Тот, кто считает этажи с единицы, напишет здесь goToFloor(2) и тоже выиграет, потому что 2 превратится в 1.",

  "tutorial.task1.startingCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        elevator.on("idle", function() {
            // TODO: в этом доме два этажа, а лифт заезжает только на один
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

  "tutorial.task2.title": "Тот же круг, но своими руками",
  "tutorial.task2.goal":
    "Напишите обработчик, который гоняет лифт по всем трём этажам, и перевезите 15 пассажиров за 60 секунд.",
  "tutorial.task2.hint1.html":
    "Всё нужное было в первом учебном задании: вы это видели, но не писали сами. Событие, которое случается, когда у лифта кончились цели, называется idle.",
  "tutorial.task2.hint2.html":
    'Подписка выглядит так: <span class="emphasis-color">elevator.on("idle", …)</span> — имя события строкой, обработчик функцией. Внутри обработчика — столько вызовов goToFloor, сколько в доме этажей.',
  "tutorial.task2.hint3.html":
    'Ответ: подпишитесь на <span class="emphasis-color">idle</span> и поставьте внутри обработчика в очередь этажи 0, 1 и 2 — так же, как в первом учебном задании это было сделано для двух этажей.',
  "tutorial.task2.explanation.html":
    "init вызывают один раз, на первом кадре прогона и до того, как мир сделает хоть один шаг, и обычно он только подписывается на события. Первое idle игра посылает сама, строкой сразу после того, как ваш init вернул управление, поэтому одной подписки хватает, чтобы всё завертелось. Вторая функция, update(dt, elevators, floors), наоборот, вызывается каждый кадр. Дорожка ей ни разу не пользуется, и это намеренно: опрашивать состояние дома на каждом кадре — путь к программам похуже тех, которые просто отвечают на события. Похуже, но не запрещено: опросом проходится любое задание дорожки.",

  "tutorial.task2.startingCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        // TODO: гоняйте лифт по всем трём этажам, круг за кругом
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

  "tutorial.task3.title": "Кнопки внутри кабины",
  "tutorial.task3.goal":
    "Отвезите тех, кто уже в кабине, туда, куда они попросили, и перевезите 15 пассажиров за 60 секунд.",
  "tutorial.task3.hint1.html":
    "В кабине горят кнопки этажей — значит, игра о них уже сообщила. События, которые присылает лифт, перечислены во всплывающей подсказке редактора и на странице справки.",
  "tutorial.task3.hint2.html":
    'Событие называется <span class="emphasis-color">floor_button_pressed</span>, а нажатый этаж приходит аргументом обработчика.',
  "tutorial.task3.hint3.html":
    'Ответ: подпишитесь на <span class="emphasis-color">floor_button_pressed</span> у лифта и отправляйте его на тот этаж, который пришёл обработчику. Обработчик idle оставьте как есть.',
  "tutorial.task3.explanation.html":
    "Пассажир, который зашёл в кабину, нажимает свой этаж, и игра сообщает об этом событием floor_button_pressed, передавая номер этажа аргументом. Горящие кнопки можно опрашивать и самому, через getPressedFloors(), но привычку стоит заводить другую: отвечать на событие. Заметьте, что goToFloor(0) в обработчике idle теперь никому не мешает — раз кнопки кабины обработаны, эта строка просто означает «вернуться на нулевой этаж, когда делать нечего».",

  "tutorial.task3.startingCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        elevator.on("idle", function() {
            elevator.goToFloor(0);
        });

        // TODO: они уже в кабине и уже нажали свои этажи
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

  "tutorial.task4.title": "Очередь, которую никто не прочитал",
  "tutorial.task4.goal":
    "Найдите строку, которой не хватает этой программе, и перевезите 15 пассажиров за 60 секунд.",
  "tutorial.task4.hint1.html":
    "Посмотрите на лифт секунд двадцать. Он не просто стоит: в него никто не заходит. Значит, он ни разу не приехал.",
  "tutorial.task4.hint2.html":
    'Очередь не пуста, но лифт о ней ничего не знает. После того как <span class="emphasis-color">destinationQueue</span> изменили вручную, игре надо об этом сообщить, и нужный метод есть в списке методов лифта.',
  "tutorial.task4.hint3.html":
    'Ответ — одна строка: вызовите <span class="emphasis-color">elevator.checkDestinationQueue();</span> сразу после присваивания, в том же обработчике idle.',
  "tutorial.task4.explanation.html":
    "Стоящая полная кабина и стоящая пустая кабина отличаются так же, как лифт, который приехал и открыл двери, отличается от лифта, который не приехал ни разу. Посадка происходит в момент приезда, и больше нигде. Тот, кто нажал кнопку рядом со стоящей кабиной, обычно эту кабину и подталкивает: игра заново предлагает ей этот этаж вызовом goToFloor(floor, true), и в учебных заданиях с первого по третье кабину наполняло именно это. Здесь толчок не делает ничего. Очередь не пуста, в ней 0, 1, 2, 3, а goToFloor отбрасывает просьбу, совпадающую с ближним концом непустой очереди, ещё до того, как дело дойдёт до проверки очереди: просят нулевой этаж, нулевой этаж и так первый в очереди, вызов возвращается. И кабина стоит так до конца прогона. goToFloor вызывает checkDestinationQueue за вас, а присваивание очереди — нет.",

  "tutorial.task4.startingCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        // Кто-то переписал тот же круг через очередь этажей.
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

  "tutorial.task5.title": "Дом вырос",
  "tutorial.task5.goal":
    "Отправляйте лифт туда, куда его действительно зовут: перевезите 15 пассажиров так, чтобы доставка каждого не длилась дольше 37 секунд.",
  "tutorial.task5.hint1.html":
    "Дело не в скорости лифта, а в том, что он ездит туда, где никто не стоит. Кто в этой игре знает, что человек ждёт? Второй аргумент init до сих пор ни разу не понадобился.",
  "tutorial.task5.hint2.html":
    'Пройдите по этажам через <span class="emphasis-color">floors.forEach</span> и подпишите каждый на <span class="emphasis-color">up_button_pressed</span> и <span class="emphasis-color">down_button_pressed</span>. Свой номер этаж знает сам: <span class="emphasis-color">floor.floorNum()</span>. Когда вызовы обрабатываются, объезд больше не нужен — удалите его.',
  "tutorial.task5.hint3.html":
    'Ответ: обработчик <span class="emphasis-color">floor_button_pressed</span> оставьте, объезд выбросите целиком, а внутри <span class="emphasis-color">floors.forEach</span> подпишитесь на обе кнопки вызова, и пусть каждая отправляет лифт на <span class="emphasis-color">floor.floorNum()</span>.',
  "tutorial.task5.explanation.html":
    'Слепой объезд не масштабируется: в худшем случае человек ждёт целый круг, а круг растёт вместе с домом. Этажи умеют звать лифт сами. Оба события передают этаж аргументом, так что floor.floorNum() можно взять хоть из аргумента, хоть из замыкания — как читается лучше. Подписаться на оба события одной строкой тоже можно, floor.on("up_button_pressed down_button_pressed", …), но тогда первым аргументом придёт имя сработавшего события, а этаж сдвинется на второе место; поэтому здесь два отдельных обработчика. И честно о результате: новая программа делает не меньше перемещений, чем объезд, а больше. Выигрывает она тем, что больше не возит воздух.',

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

        // TODO: спрашивайте у этажей, кому нужен лифт, вместо объезда всех подряд
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

  "tutorial.task6.title": "Лифт, который врёт пассажирам",
  "tutorial.task6.goal":
    "Разберитесь, почему половина дома не садится в лифт, и перевезите 15 пассажиров так, чтобы доставка каждого не длилась дольше 28 секунд.",
  "tutorial.task6.hint1.html":
    "Смотрите не на счётчики, а на стрелки вызова. Одна из них загорается по ходу прогона и больше не гаснет. В какую сторону собирался ехать тот, кто её нажал?",
  "tutorial.task6.hint2.html":
    "Лифт с погашенным индикатором «вниз» говорит пассажирам, что вниз он не поедет, и они его пропускают. Изначально оба индикатора включены.",
  "tutorial.task6.hint3.html":
    'Ответ: <span class="emphasis-color">elevator.goingDownIndicator(true);</span> вместо <span class="emphasis-color">false</span>. Удалить обе строки с индикаторами — ровно то же самое, потому что лифт и так создаётся с обоими включёнными. А вот выключить оба — совсем другая программа, в которую вообще никто не садится.',
  "tutorial.task6.explanation.html":
    "Пассажир садится только в тот лифт, который подходит для его поездки: игра спрашивает isSuitableForTravelBetween, а тот смотрит на индикаторы. Кого не пустили, тот жмёт кнопку вызова снова. Стрелка не гаснет по отдельной причине, и по этой же причине симптом вообще видно: приехавший лифт гасит только те кнопки вызова, которые соответствуют его горящим индикаторам, так что кабина с потухшей стрелкой «вниз» физически не может погасить вызов вниз. Хуже того, стоящей кабине этаж и не предлагают заново: игра подталкивает стоящую кабину только тогда, когда её индикатор совпадает с направлением вызова. Оба индикатора включены изначально, так что эти две строки ничего не чинят. Они только ломают.",

  "tutorial.task6.startingCode.code": `{
    init: function(elevators, floors) {
        const elevator = elevators[0];

        // Кто-то решил показывать пассажирам, в какую сторону едет лифт.
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

  "tutorial.task7.title": "Второй лифт",
  "tutorial.task7.goal": "Заставьте работать оба лифта и перевезите 28 пассажиров за 60 секунд.",
  "tutorial.task7.hint1.html":
    "Во втором лифте сидят люди, и он никуда не едет: ему никто ничего не сказал. Сколько раз в этой программе написано elevators[0]?",
  "tutorial.task7.hint2.html":
    'Обработчик кнопок кабины подпишите внутри <span class="emphasis-color">elevators.forEach</span>, чтобы каждый лифт слушал свои кнопки. А для вызова с этажа лифт надо выбрать: например, наименее загруженный по <span class="emphasis-color">loadFactor()</span>.',
  "tutorial.task7.hint3.html":
    'Ответ: маленькая функция, которая проходит по <span class="emphasis-color">elevators</span> и возвращает кабину с наименьшим <span class="emphasis-color">loadFactor()</span>; обработчик кнопок кабины, подписанный на каждый лифт через <span class="emphasis-color">elevators.forEach</span>; и обе кнопки вызова на каждом этаже, отправляющие выбранную кабину на <span class="emphasis-color">floor.floorNum()</span>. Подойдёт любое правило, при котором работают оба лифта.',
  "tutorial.task7.explanation.html":
    "elevators[0] — это не «лифт», это «первый лифт». В этом доме их два, а в последних заданиях игры их восемь. Программа, написанная через elevators.forEach, одинаково работает и с одной кабиной, и с восемью, и именно её вы унесёте в настоящие задания. Выбирать по loadFactor() — самое дешёвое разумное правило: 0 — пусто, 1 — полно. Оно не единственное рабочее, годится что угодно, лишь бы обе кабины были при деле, но правило, которое сверяется с картинкой на экране, отлаживать легче.",

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

  "tutorial.task8.title": "По памяти",
  "tutorial.task8.goal":
    "Напишите программу с чистого листа и перевезите 15 пассажиров за 60 секунд.",
  "tutorial.task8.hint1.html":
    "Программа делится на две половины: сказать кабине, куда ехать, и узнать, что лифта кто-то ждёт. Обе вы уже писали. Какая из двух функций вызывается один раз, а какая — каждый кадр?",
  "tutorial.task8.hint2.html":
    "О людях внутри кабины и о людях, ждущих на этаже, игра сообщает разными событиями, и подписываться на них надо в разных местах: на лифте и на каждом этаже.",
  "tutorial.task8.hint3.html":
    'Ответ — программа из седьмого учебного задания без изменений: с одним лифтом она работает не хуже. Подпишитесь на <span class="emphasis-color">floor_button_pressed</span> у каждой кабины, подпишитесь на обе кнопки вызова у каждого этажа и отправляйте кабину на <span class="emphasis-color">floor.floorNum()</span>. Пишите программу целиком: та половина, где кабина просто стоит на нулевом этаже и знает только свои кнопки, прогоны проигрывает.',
  "tutorial.task8.explanation.html":
    "Здесь нет ничего нового, и в этом всё дело. Это дом задания №1 и планка задания №1, взятые намеренно: три этажа, один лифт, 15 пассажиров за 60 секунд. Выиграв здесь, вы уже решили задание №1 — той самой программой, которая сейчас в редакторе. И запас времени здесь самый маленький на дорожке, причём дорожка тут ни при чём: при 0,3 пассажира в секунду пятнадцатый человек появляется в доме примерно на сорок седьмой секунде из шестидесяти, так что минута теснее, чем кажется. Это свойство задания №1, и вы столкнулись с ним заранее.",

  "tutorial.task8.startingCode.code": `{
    init: function(elevators, floors) {
        // TODO: здесь нет ничего нового. Всё это вы уже писали.
    },
    update: function(dt, elevators, floors) {
    }
}`,
  // Ответ седьмого задания слово в слово: выпускное задание не просит ничего
  // нового. Выписан целиком, а не подставлен ссылкой, чтобы у каждого задания
  // были одни и те же восемь ключей и переводчик не встречал исключений;
  // равенство двух ответов держит `src/game/tutorial.test.ts`.
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

  // Панель вокруг заданий, полоса над ними и экран после последнего. Строка
  // сида, статистика и редактор — общие с остальной игрой и говорят здесь то
  // же самое, что и везде.

  "tutorial.panel.label": "Учебная дорожка",
  "tutorial.panel.position": "Задание {number} из {count}",
  "tutorial.panel.progress": {
    one: "Пройдено {cleared} из {count} задания",
    few: "Пройдено {cleared} из {count} заданий",
    many: "Пройдено {cleared} из {count} заданий",
    other: "Пройдено {cleared} из {count} задания",
  },
  "tutorial.panel.hintSummary": "Подсказка {number}",
  "tutorial.panel.explanationSummary": "Почему так получается",
  // Обе строки называют место, куда программа попадает, «редактором игры», а
  // место, откуда её берут, — «редактором на этой странице». В английском тексте
  // второе — просто «the editor», но по-русски голое «редактор» сразу после
  // «редактора игры» читается как отсылка к нему же, то есть ровно наоборот.
  "tutorial.panel.codeTaken":
    "Программа скопирована в редактор игры — она будет ждать вас, когда вы выйдете с дорожки.",
  "tutorial.panel.codeRefused":
    "Браузер отказался сохранить программу. Скопируйте её из редактора на этой странице вручную, чтобы она не пропала.",
  "tutorial.button.restart": "Начать заново",
  "tutorial.button.takeCode": "Забрать программу в свой редактор",
  "tutorial.button.takeCodeConfirm": "В редакторе игры уже лежит ваша программа. Заменить её этой?",
  "tutorial.button.leave": "Выйти к заданиям игры",
  "tutorial.bar.title.html": "Учебное задание {number} из {count}: {description}",
  "tutorial.finish.title": "Дорожка пройдена",
  "tutorial.finish.message":
    "Восемь заданий, и последнее из них было заданием №1: те же три этажа, тот же лифт, те же пятнадцать пассажиров за шестьдесят секунд. Программа, которая сейчас в редакторе, его решает, а на панели есть кнопка, которая скопирует её в ваш редактор, — заберите программу с собой, прежде чем уходить.",
  "tutorial.finish.nextTask": "Следующее учебное задание",
  "tutorial.finish.toChallenges": "Перейти к заданию №1",
};
