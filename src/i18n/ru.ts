import type { MessageCatalog } from "./catalog.ts";

/**
 * The Russian catalog, checked against `MessageCatalog<"ru">` key by key.
 * Code is never translated, only prose and the comments inside example code;
 * `catalog.test.ts` checks placeholders and that `.code` blocks stay byte for
 * byte the same as the English code.
 */
export const RU_MESSAGES: MessageCatalog<"ru"> = {
  // The game screen (index.html).

  "page.title": "Elevator Saga — игра про программирование лифтов, редизайн",
  "page.description":
    "Elevator Saga в новом оформлении: напишите на JavaScript программу, которая эффективно возит " +
    "пассажиров. 19 уровней, обучающий трек, песочница любого размера и повторяемые запуски.",
  "page.imageAlt":
    "Четыре лифта возят пассажиров между шестью этажами, а ниже, в редакторе, — управляющая ими программа на JavaScript.",
  "page.skipLink": "Перейти к редактору кода",
  "page.brand": "Elevator Saga",
  "page.tagline":
    "Игра про программирование: вы пишете на JavaScript код, который управляет лифтами в здании, " +
    "а пассажиры всё прибывают — готова ваша программа к ним или нет. Это Elevator Saga в новом " +
    "оформлении: 19 уровней, обучающий трек, который начинается с пустого редактора, песочница " +
    "со зданием любого размера и запуски, которые можно повторить в точности.",
  "page.language.label": "Язык",
  "page.noscript":
    "Похоже, ваш браузер не поддерживает JavaScript. На этой странице — игра про программирование, которая на JavaScript и написана.",
  "page.world.label": "Здание",
  "page.stats.label": "Статистика симуляции",
  "page.stats.transported": "Перевезено",
  "page.stats.transportedTitle":
    "Сколько пассажиров добрались до нужного им этажа, так что тот, кто ещё едет, сюда пока не попал",
  "page.stats.elapsedTime": "Прошло времени",
  "page.stats.elapsedTimeTitle":
    "Собственные часы прогона: регулятор скорости заставляет их идти быстрее или медленнее настоящих, и в них измерено всякое другое время на этой панели",
  "page.stats.transportedPerSec": "Перевезено в сек.",
  "page.stats.transportedPerSecTitle":
    "Все доставленные к этому моменту, делённые на время прогона, так что это среднее за весь прогон, а не скорость прямо сейчас",
  "page.stats.avgWaitTime": "Сред. доставка",
  "page.stats.avgWaitTimeTitle":
    "Весь путь — от появления пассажира в здании до выхода на нужном ему этаже, — усреднённый по тем, кого уже довезли, так что поездка входит сюда наравне с ожиданием",
  "page.stats.avgPickupTime": "Сред. ожидание кабины",
  "page.stats.avgPickupTimeTitle":
    "Отсчёт идёт от появления пассажира до того момента, как его забрала кабина, а строка под ней — это остальная часть пути",
  "page.stats.avgRideTime": "Сред. время поездки",
  "page.stats.avgRideTimeTitle":
    "Отсчёт идёт от того момента, как кабина забрала пассажира, до того, как он вышел на своём этаже, так что эта строка и ожидание над ней вместе дают время доставки",
  "page.stats.maxWaitTime": "Макс. доставка",
  "page.stats.maxWaitTimeTitle":
    "Самый долгий путь одного пассажира: он растёт, пока кто-то ещё в пути, и обратно уже не опускается",
  "page.stats.moves": "Перемещения",
  "page.stats.movesTitle":
    "Перемещение засчитывается каждый раз, когда кабина проходит середину пути от одного этажа до соседнего",
  "page.stats.stops": "Остановки",
  "page.stats.stopsTitle":
    "Остановка засчитывается каждый раз, когда кабина замирает на этаже и открывает двери, так что кабина, отправленная на этаж, где она и так стоит, добавляет ещё одну",
  "page.stats.peoplePerStop": "Людей на остановку",
  "page.stats.peoplePerStopTitle":
    "Все, кто вошёл или вышел, поделённые на остановки из строки выше, так что открытые двери там, где никого нет, эту цифру снижают",
  "page.stats.avgLoad": "Сред. загрузка",
  "page.stats.avgLoadTitle":
    "Насколько полными были кабины — в среднем по тем же перемещениям, что считаются выше, так что стоящая кабина в цифру не попадает вовсе",

  // The building view.

  "game.floor.callUp": "Вызвать лифт вверх с этажа {floor}",
  "game.floor.callDown": "Вызвать лифт вниз с этажа {floor}",
  "game.elevator.label": "Лифт {number}",
  "game.elevator.floorButton": "Ехать на этаж {floor}",
  // The elevator's state line always says exactly one of these three.
  "game.buildingStage.elevatorState.movingUp": "Едет вверх",
  "game.buildingStage.elevatorState.movingDown": "Едет вниз",
  "game.buildingStage.elevatorState.stopped": "Стоит",
  "game.buildingStage.elevatorOccupancy": "Занято: {occupied}/{capacity}",
  "game.buildingStage.elevatorServing.up": "Обслуживает вызовы вверх",
  "game.buildingStage.elevatorServing.down": "Обслуживает вызовы вниз",
  "game.buildingStage.elevatorServing.both": "Обслуживает вызовы в обе стороны",
  "game.buildingStage.elevatorServing.none": "Не обслуживает вызовы",
  "game.buildingStage.elevatorPressed.none": "Нет нажатых этажей",
  "game.buildingStage.elevatorPressed.some": "Нажаты этажи: {floors}",
  "game.buildingStage.floorCard.title": "Этаж {floor}",
  "game.buildingStage.floorCard.waiting": "Ожидают: {count}",
  "game.buildingStage.floorCard.longestWait": "Дольше всех ждёт: {time}",
  "game.buildingStage.floorCard.destinations.none": "Направления ещё не выбраны",
  "game.buildingStage.floorCard.destinations.some": "Едут на: {floors}",
  "game.statsPanel.waitingNow": "Ждут сейчас",
  "game.statsPanel.waitingNowTitle":
    "Сколько пассажиров прямо сейчас стоят на этажах и ещё не едут ни в одной кабине",
  "game.statsPanel.aboardNow": "Едут сейчас",
  "game.statsPanel.aboardNowTitle": "Сколько пассажиров прямо сейчас находятся в кабинах и едут",
  "game.statsPanel.more": "Все показатели",
  "game.levelSwitcher.prevLabel": "Предыдущий уровень",
  "game.levelSwitcher.nextLabel": "Следующий уровень",
  "game.levelSwitcher.tutorialBlockLabel": "Обучение",
  "game.levelSwitcher.otherBlockLabel": "Остальное",
  "game.levelSwitcher.sandboxLabel": "Песочница",
  "game.levelSwitcher.chapterBlockLabel": "Глава {number}",
  "game.levelSwitcher.tutorialTileLabel": "Учебный уровень {number}",
  "game.levelSwitcher.levelTileLabel": "Уровень {chapter}-{number}",
  // {tier} names a game.goalBar.tier.* rank in the nominative, as an
  // appositive, so it needs no gender agreement (unlike a predicate, where
  // "bronze" and "gold" take different verb endings).
  "game.levelSwitcher.levelTileEarnedLabel": "Уровень {chapter}-{number}, {tier}",
  "game.levelSwitcher.tutorialTileEarnedLabel": "Учебный уровень {number}, {tier}",
  "game.levelSwitcher.tutorialTriggerLabel": "Урок {number}",
  // Hidden when locateCodeError finds nothing for the player's exception.
  "game.editorPane.gotoLine": "строка {line} →",
  // {seed} is a token the player transcribes; it must render the same in every locale.
  "game.seed.label": "Сид",
  "game.seed.inputLabel": "Сид этого прогона — впишите другой, чтобы сыграть его",
  "game.seed.link": "Сид {seed}: вынести этот прогон в адресную строку",
  "game.seed.newDrawLink": "Сид {seed}: взять новый и начать заново",
  "game.seed.invalid":
    "В сиде — до 64 символов: латинские буквы, цифры, точки, дефисы и подчёркивания.",
  "game.seed.explanation":
    "Один и тот же сид приводит тех же пассажиров и в том же порядке — а если играть так же, прогон повторится в точности.",
  "game.seed.console":
    "Сид {seed} — тот же самый прогон один в один, независимо от частоты кадров: {url}",
  "game.switchTheme.caption": "Тема",
  "game.switchTheme.system": "Как в системе",
  "game.switchTheme.light": "Светлая",
  "game.switchTheme.dark": "Тёмная",
  // Named onlyCode/onlyGame, not code/game: a bare "code" key would collide
  // with catalog.test.ts's reserved .code suffix.
  "game.switchLayout.caption": "Раскладка",
  "game.switchLayout.left": "Код слева",
  "game.switchLayout.right": "Код справа",
  "game.switchLayout.onlyCode": "Только код",
  "game.switchLayout.onlyGame": "Только здание",
  "game.workspace.gamePane": "Симуляция",
  "game.workspace.codePane": "Редактор кода",
  "game.workspace.splitter": "Ширина редактора",
  "game.appBar.docsOpenLabel": "Справка",
  "game.appBar.settingsLabel": "Настройки",
  "game.appBar.hotkeysOpenLabel": "Горячие клавиши",
  "game.appBar.sourceCaption": "Код и лицензия",
  "game.appBar.sourceForkLabel": "Эта игра",
  "game.appBar.sourceOriginalLabel": "Оригинал",
  "game.appBar.sourceCopyright.html":
    'Elevator Saga © 2015 Magnus Wolffelt,<br /> © 2026 EpicDima,<br /> <a href="licenses.txt">MIT</a>',
  "game.hotkeys.title": "Горячие клавиши",
  "game.hotkeys.closeTitle": "Закрыть окно",
  "game.hotkeys.close": "Закрыть",
  "game.hotkeys.nothingFocused": "Когда ничего не в фокусе",
  "game.hotkeys.outsideEditor": "Вне редактора кода",
  "game.hotkeys.startPause": "Пуск и пауза",
  "game.hotkeys.startOver": "Начать заново",
  "game.hotkeys.switchLayout": "Сменить раскладку",
  "game.hotkeys.openDocs": "Справка",
  "game.hotkeys.openSettings": "Настройки",
  "game.hotkeys.editorOnly": "В редакторе кода",
  "game.hotkeys.applyCode": "Применить код и начать заново",
  "game.hotkeys.saveNow": "Сохранить сразу",
  "game.hotkeys.completions": "Подсказать вызов",
  "game.hotkeys.find": "Найти и заменить",
  "game.hotkeys.findNext": "Следующее совпадение",
  "game.hotkeys.findPrevious": "Предыдущее совпадение",
  "game.hotkeys.selectNextMatch": "Добавить к выделению следующее вхождение",
  "game.hotkeys.indent": "Отступ",
  "game.hotkeys.leaveEditor": "Убрать фокус из редактора",
  "game.docs.title": "Справка",
  "game.docs.searchPlaceholder": "Поиск: goToFloor, ожидание, кнопка…",
  "game.docs.clearSearch": "Стереть запрос",
  "game.docs.closeTitle": "Закрыть справку",
  "game.docs.close": "Закрыть",
  "game.docs.empty": "Ничего не нашлось",
  // step3 alone carries .html: it has an inline <b>, the other steps do not.
  "game.docs.guide.whatGame.heading": "Что это за игра",
  "game.docs.guide.whatGame.body":
    "В здании ездят лифты, а на этажах ждут люди: каждый пришёл на свой этаж и хочет попасть на другой. Кнопки они жмут сами. Лифтами не управляет никто — ими управляет программа, которую пишете вы. Мышью лифт не подвинуть, и в этом вся игра: единственный способ довезти людей — объяснить зданию правило, по которому оно поедет само.",
  "game.docs.guide.whatToDo.heading": "Что делать",
  "game.docs.guide.whatToDo.step1":
    "Выберите уровень в шапке. У каждого своё здание — этажи, число лифтов и их вместимость — и свои условия.",
  "game.docs.guide.whatToDo.step2":
    "Напишите программу справа. Она подписывается на события лифтов и этажей: «нажали кнопку», «лифт освободился», «проезжаем этаж».",
  "game.docs.guide.whatToDo.step3.html":
    "Нажмите <b>Запустить</b> и смотрите. Прогон можно поставить на паузу, ускорить — вплоть до мгновенного, когда итог считается сразу, — и начать заново: здание каждый раз одно и то же, а люди приходят по одному и тому же seed.",
  "game.docs.guide.whatToDo.step4":
    "Не сошлось — правьте правило и запускайте снова. Три слота кода на уровень хранят три разных подхода, между ними можно переключаться прямо на ходу.",
  "game.docs.guide.carArrows.heading": "Стрелки на кабине",
  "game.docs.guide.carArrows.html":
    "На каждой кабине горят две стрелки — лампы <b>вверх</b> и <b>вниз</b>, те самые, которыми распоряжаются <b>goingUpIndicator</b> и <b>goingDownIndicator</b>. Люди на этаже смотрят на них и заходят, только если лифт собрался в их сторону: с погашенной лампой «вниз» едущий вниз останется ждать следующего. Горят обе — заходят все подряд; полный лифт гасит обе сам. Кого лифт берёт прямо сейчас, написано в карточке, которая всплывает при наведении на кабину.",
  "game.docs.guide.readingResults.heading": "Как понять, что получилось",
  "game.docs.guide.readingResults.body":
    "Шкалы под шапкой показывают условие уровня: сколько человек надо перевезти, за какое время, сколько этажей позволено проехать лифтам и сколько секунд ждать людям. Плитки внизу считают то же самое подробнее — среднюю доставку, худшее ожидание, загрузку лифтов, — и рисуют, как это менялось по ходу прогона. Уровень засчитан, когда людей перевезли и ни один предел не нарушен.",
  "game.docs.guide.threeStars.heading": "Три звезды",
  "game.docs.guide.threeStars.html":
    "За пройденный уровень дают бронзу — это ровно его условие. Серебро и золото достаются за то, <em>как</em> он пройден: уложиться с запасом, не гонять лифты вхолостую, не заставлять людей ждать. Что именно нужно для каждой звезды, показывает карточка справа в строке целей: там же видно, какие из них держатся прямо сейчас. Некоторые уровни не требуют ничего сверх своего условия — за такой сразу дают золото. Ничего звёзды не запирают — любой уровень открыт с первого захода, а серебро и золото остаются в списке.",
  "game.docs.guide.tutorialLevels.heading": "Первые уровни — с объяснением",
  "game.docs.guide.tutorialLevels.body":
    "У учебных уровней рядом со зданием стоит урок: шаг за шагом, что происходит, каким событием это видно из программы и как выглядит ответ на него. Подсказки открываются по одной, а в последней лежит рабочая программа и кнопка, которая её копирует.",
  "game.docs.intro.heading": "Из чего состоит программа",
  "game.docs.intro.example.code": `function init(elevators, floors) {
  // здесь подписываются на события
}

function update(dt, elevators, floors) {
  // вызывается всё время, пока идёт прогон
}`,
  "game.docs.lead.html":
    "<code>elevator</code> — это лифт: все они лежат в <code>elevators</code>. <code>floor</code> — этаж, они в <code>floors</code>. Любую строку ниже можно раскрыть: под ней подробности и пример.",
  "game.apiRef.elevator.groupLabel": "Лифт",
  "game.apiRef.floor.groupLabel": "Этаж",
  "game.apiRef.elevator.goToFloor.short": "Поставить этаж в очередь лифта.",
  "game.apiRef.elevator.goToFloor.more":
    "Этаж встаёт в конец очереди: лифт доедет до него, когда разберётся с тем, что заказали раньше. Один и тот же этаж можно записать дважды — и лифт остановится там дважды, поэтому перед добавлением очередь стоит проверить.",
  "game.apiRef.elevator.goToFloor.code": `// не заказываем то, что уже заказано
const wanted = floor.floorNum();
if (!elevator.destinationQueue.includes(wanted)) {
  elevator.goToFloor(wanted);
}`,
  "game.apiRef.elevator.goToFloorPriority.short":
    "То же, но первым в очереди: лифт поедет туда сразу.",
  "game.apiRef.elevator.goToFloorPriority.more":
    "Второй аргумент ставит этаж в начало очереди, остальное подождёт. Так подбирают человека, мимо которого лифт всё равно проезжает. Если же отвечать этим на каждый вызов, очередь никогда не дойдёт до конца: последние в ней будут ждать вечно.",
  "game.apiRef.elevator.goToFloorPriority.code": `elevator.on("passing_floor", (floorNum, direction) => {
  if (elevator.loadFactor() < 0.8 && waiting(floorNum, direction)) {
    elevator.goToFloor(floorNum, true);
  }
});`,
  "game.apiRef.elevator.stop.short": "Встать и забыть очередь. Пассажиры внутри этого не оценят.",
  "game.apiRef.elevator.stop.more":
    "Лифт останавливается там, где есть, и очередь очищается целиком. Кнопки, нажатые пассажирами внутри, при этом остаются нажатыми — маршрут после stop() придётся собрать заново, иначе люди поедут кататься.",
  "game.apiRef.elevator.stop.code": `elevator.stop();
// вернуть в очередь то, что заказали изнутри
for (const floorNum of elevator.getPressedFloors()) {
  elevator.goToFloor(floorNum);
}`,
  "game.apiRef.elevator.currentFloor.short": "Этаж, на котором лифт сейчас.",
  "game.apiRef.elevator.currentFloor.more":
    "Целое число, а не дробь: пока лифт едет между этажами, отвечает тот этаж, который он последним миновал. Куда он при этом движется, знает destinationDirection().",
  "game.apiRef.elevator.currentFloor.code": `const distance = Math.abs(elevator.currentFloor() - floor.floorNum());`,
  "game.apiRef.elevator.destinationQueue.short":
    "Очередь этажей. Её можно править как обычный массив.",
  "game.apiRef.elevator.destinationQueue.more":
    "Первый элемент — то, куда лифт едет прямо сейчас. Читать можно свободно, менять — тоже, но после правки нужен checkDestinationQueue(): сам по себе лифт изменения в массиве не заметит.",
  "game.apiRef.elevator.destinationQueue.code": `// выбросить повторы, не трогая порядок
elevator.destinationQueue = elevator.destinationQueue.filter(
  (floorNum, index, all) => all.indexOf(floorNum) === index,
);
elevator.checkDestinationQueue();`,
  "game.apiRef.elevator.checkDestinationQueue.short": "Перечитать очередь после ручной правки.",
  "game.apiRef.elevator.checkDestinationQueue.more":
    "Нужен ровно в одном случае: вы поменяли destinationQueue напрямую. После goToFloor() и stop() вызывать его не надо — они это делают сами.",
  "game.apiRef.elevator.checkDestinationQueue.code": `elevator.destinationQueue.sort((a, b) => a - b);
elevator.checkDestinationQueue();`,
  "game.apiRef.elevator.getPressedFloors.short": "Какие кнопки нажаты внутри лифта.",
  "game.apiRef.elevator.getPressedFloors.more":
    "Массив номеров по возрастанию. Это желания пассажиров, а не маршрут: пока этаж не попал в очередь, лифт туда не поедет. Кнопка гаснет, когда двери открылись на этом этаже.",
  "game.apiRef.elevator.getPressedFloors.code": `elevator.on("stopped_at_floor", () => {
  for (const floorNum of elevator.getPressedFloors()) {
    elevator.goToFloor(floorNum);
  }
});`,
  "game.apiRef.elevator.loadFactor.short": "Насколько лифт полон: от 0 (пусто) до 1 (битком).",
  "game.apiRef.elevator.loadFactor.more":
    "Считается по весу пассажиров, а не по их числу, поэтому ровной половины при половине мест не будет. Порог принято брать с запасом: полный лифт всё равно никого не возьмёт, а вызов на себя заберёт.",
  "game.apiRef.elevator.loadFactor.code": `floor.on("up_button_pressed", () => {
  if (elevator.loadFactor() < 0.7) {
    elevator.goToFloor(floor.floorNum());
  }
});`,
  "game.apiRef.elevator.maxPassengerCount.short": "Сколько человек в него влезает.",
  "game.apiRef.elevator.maxPassengerCount.more":
    "Число постоянное, его удобно спросить один раз в init. В одном здании лифты бывают разной вместимости — например, на 4 и на 10 человек, — и тогда «ближайший» и «подходящий» перестают быть одним и тем же.",
  "game.apiRef.elevator.maxPassengerCount.code": `const big = elevators.filter((elevator) => elevator.maxPassengerCount() >= 8);`,
  "game.apiRef.elevator.destinationDirection.short": 'Куда едет: "up", "down" или "stopped".',
  "game.apiRef.elevator.destinationDirection.more":
    'Отвечает по первому этажу в очереди, а не по лампам снаружи: лампы вы ставите сами, и они могут говорить что угодно. Если очередь пуста — "stopped".',
  "game.apiRef.elevator.destinationDirection.code": `if (elevator.destinationDirection() === "up" && floorNum > elevator.currentFloor()) {
  elevator.goToFloor(floorNum, true);
}`,
  "game.apiRef.elevator.goingUpIndicator.short":
    "Лампа «вверх» снаружи. Без аргумента — прочитать.",
  "game.apiRef.elevator.goingUpIndicator.more":
    "С аргументом — зажечь или погасить, без аргумента — узнать, горит ли. По лампам люди на этаже решают, заходить ли им: если горят обе, зайдут все подряд, если не горит ни одна — не зайдёт никто.",
  "game.apiRef.elevator.goingUpIndicator.code": `elevator.goingUpIndicator(true);
elevator.goingDownIndicator(false);`,
  "game.apiRef.elevator.goingDownIndicator.short":
    "Лампа «вниз». По лампам люди решают, заходить ли.",
  "game.apiRef.elevator.goingDownIndicator.more":
    "То же самое, только вниз. Менять их принято на развороте: доехали до верхней точки — погасили «вверх», зажгли «вниз». Забытая лампа набивает лифт людьми, которым не по пути.",
  "game.apiRef.elevator.goingDownIndicator.code": `elevator.on("stopped_at_floor", (floorNum) => {
  const up = floorNum === 0;
  elevator.goingUpIndicator(up);
  elevator.goingDownIndicator(!up);
});`,
  "game.apiRef.elevator.idle.short": "Очередь опустела — лифту нечего делать.",
  "game.apiRef.elevator.idle.more":
    "Приходит один раз, когда лифт доехал до последнего этажа очереди. Если на событие не ответить, лифт так и останется стоять там, где встал, — а ждут чаще всего внизу.",
  "game.apiRef.elevator.idle.code": `elevator.on("idle", () => {
  elevator.goToFloor(0);
});`,
  "game.apiRef.elevator.floorButtonPressed.short": "Пассажир внутри нажал кнопку этажа.",
  "game.apiRef.elevator.floorButtonPressed.more":
    "Номер этажа приходит аргументом. Само событие ничего не меняет: пока вы не поставите этаж в очередь, лифт туда не поедет — человек так и будет ездить с вами.",
  "game.apiRef.elevator.floorButtonPressed.code": `elevator.on("floor_button_pressed", (floorNum) => {
  elevator.goToFloor(floorNum);
});`,
  "game.apiRef.elevator.passingFloor.short": "Проезжаем этаж; ещё можно успеть остановиться.",
  "game.apiRef.elevator.passingFloor.more":
    'Приходит чуть раньше, чем лифт поравняется с этажом, — это единственное место, где имеет смысл goToFloor(floorNum, true). direction — "up" или "down", то есть куда мы едем, а не куда хочет пассажир.',
  "game.apiRef.elevator.passingFloor.code": `elevator.on("passing_floor", (floorNum, direction) => {
  if (elevator.getPressedFloors().includes(floorNum)) {
    elevator.goToFloor(floorNum, true);
  }
});`,
  "game.apiRef.elevator.stoppedAtFloor.short": "Встали на этаже, двери открыты.",
  "game.apiRef.elevator.stoppedAtFloor.more":
    "Посадка и высадка к этому моменту уже произошли. Удобное место, чтобы переставить лампы и решить, куда ехать дальше, — особенно если очередь после остановки опустела.",
  "game.apiRef.elevator.stoppedAtFloor.code": `elevator.on("stopped_at_floor", (floorNum) => {
  elevator.goingUpIndicator(floorNum === 0);
  elevator.goingDownIndicator(floorNum !== 0);
});`,
  "game.apiRef.floor.floorNum.short": "Номер этажа, считая с нуля снизу.",
  "game.apiRef.floor.floorNum.more":
    "У самого нижнего этажа номер 0, у верхнего — floors.length-1. Внутри обработчика этажа это единственный способ узнать, где нажали: номер в событие не приходит.",
  "game.apiRef.floor.floorNum.code": `floors.forEach((floor) => {
  floor.on("up_button_pressed", () => {
    elevators[0].goToFloor(floor.floorNum());
  });
});`,
  "game.apiRef.floor.upButtonPressed.short": "Снаружи нажали кнопку «вверх» — вызов наверх.",
  "game.apiRef.floor.upButtonPressed.more":
    "Человек хочет ехать выше. Событие приходит этажу, а не лифту: кому отдать вызов, решаете вы. Кнопка гаснет, когда на этом этаже открывает двери любой лифт, — даже если человек в него не влез.",
  "game.apiRef.floor.upButtonPressed.code": `floor.on("up_button_pressed", () => {
  nearest(floor.floorNum()).goToFloor(floor.floorNum());
});`,
  "game.apiRef.floor.downButtonPressed.short": "Снаружи нажали кнопку «вниз».",
  "game.apiRef.floor.downButtonPressed.more":
    "То же самое, но человек едет вниз. Если направление вам пока не важно, оба события подписываются одной строкой — через пробел.",
  "game.apiRef.floor.downButtonPressed.code": `floor.on("up_button_pressed down_button_pressed", () => {
  elevators[0].goToFloor(floor.floorNum());
});`,
  "game.timeScale.label": "Скорость прогона",
  "game.timeScale.decrease": "Медленнее",
  "game.timeScale.increase": "Быстрее",
  "game.timeScale.value": "{value}×",
  "game.timeScale.valueTitle": "Скорость прогона: {value}",
  "game.timeScale.instant": "∞×",
  "game.timeScale.instantTitle": "Мгновенно: прогон досчитывается сразу до итога",
  // The label always names what happens next: Start, Pause or Resume.
  "game.button.start": "Запустить",
  "game.button.pause": "Пауза",
  "game.button.resume": "Продолжить",
  "game.button.startAgainTitle": "Пустить прогон заново",
  "game.button.startOver": "Заново",
  "game.button.startOverTitle": "Начать прогон с самого начала",
  "game.button.resetCode": "Сбросить код",
  "game.button.resetCodeTitle": "Вернуть в этот слот исходный код уровня",
  "game.button.runningInstantly": "Прогоняем…",
  "game.feedback.success.title": "Получилось!",
  "game.feedback.success.message": "Уровень пройден",
  "game.feedback.failure.title": "Уровень провален",
  "game.feedback.failure.message": "Может быть, программу стоит доработать?",
  // {tier} is a game.goalBar.tier.* name.
  "game.feedback.tierEarned": "Звёзды уровня: {tier}",
  "game.feedback.next": "Следующий уровень",
  "game.feedback.dismiss": "Понятно",
  // {needs} is a formatList of game.feedback.more.need.html entries.
  "game.feedback.more.silver.html": "До серебра: {needs}",
  "game.feedback.more.gold.html": "До золота: {needs}",
  "game.feedback.more.need.html": "{req} (сейчас {now})",
  "game.codeStatus": "Ошибка в вашей программе:",

  // The only goal-bar caption not copied from page.stats.*, since the stats
  // panel has no maxPickupTime of its own; compare page.stats.avgPickupTime
  // «Сред. ожидание кабины» — same metric, but the max, not the average.
  "game.goalBar.caption.maxPickupTime": "Макс. ожидание кабины",
  "game.goalBar.unit.seconds": " с",
  "game.goalBar.unit.floors": " эт.",
  "game.goalBar.tier.bronze": "Бронза",
  "game.goalBar.tier.silver": "Серебро",
  "game.goalBar.tier.gold": "Золото",
  "game.goalBar.trigger.titleNone": "Звёзды уровня: пока ни одной. Открыть требования",
  // {tier} substitutes directly, capitalized, not as «взято {tier}»: «взято»
  // doesn't agree with «бронза» (needs «взята»), though it agrees with
  // «серебро»/«золото».
  "game.goalBar.trigger.titleEarned": "Звёзды уровня: {tier}. Открыть требования",
  // Genitive plural «этажей» stays fixed after «не больше» regardless of count.
  "game.goalBar.floorBudget.html": {
    one: "{count} этажей",
    few: "{count} этажей",
    many: "{count} этажей",
    other: "{count} этажей",
  },
  // Unlike floorBudget.html, this one declines fully.
  "game.goalBar.stopBudget.html": {
    one: "{count} остановки",
    few: "{count} остановок",
    many: "{count} остановок",
    other: "{count} остановки",
  },
  "game.goalBar.req.transportedCounter.html": "перевезти {people}",
  "game.goalBar.req.elapsedTime.html": "уложиться в {time}",
  // maxWaitTime/avgWaitTime measure spawn-to-delivery time, not queueing time.
  "game.goalBar.req.maxWaitTime.html": "никого не доставлять дольше {time}",
  "game.goalBar.req.avgWaitTime.html": "доставлять в среднем не дольше {time}",
  "game.goalBar.req.moveCount.html": "лифты проезжают не больше {floors}",
  "game.goalBar.req.stopCount.html": "лифты останавливаются не больше {stops}",
  "game.goalBar.req.avgLoadFactorOnMove.html": "лифты заполнены на {percent} и выше",
  // Genitive singular «человека»: a two-decimal number is grammatically
  // fractional (the `other` form), and fractions take the genitive singular.
  "game.goalBar.req.transportedPerSec.html": "не меньше {rate} человека в секунду",
  "game.goalBar.req.avgPeoplePerStop.html": "не меньше {rate} человека на остановку",
  "game.goalBar.req.maxPickupTime.html": "никого не забирать дольше {time}",
  "game.goalBar.req.avgPickupTime.html": "забирать в среднем не дольше {time}",
  "game.goalBar.req.avgRideTime.html": "везти в среднем не дольше {time}",

  // The code editor.

  "editor.label": "Программа для лифтов",
  "editor.storageRefused":
    "Не сохранено — браузер отказывается хранить код. Программа останется здесь, пока открыта вкладка.",
  "editor.confirmReset": "Точно сбросить код до стандартной реализации?",
  // Панель поиска узкая, поэтому подписи кнопок короткие: не «учитывать регистр», а «регистр».
  "editor.phrase.find": "Найти",
  "editor.phrase.replace": "Заменить",
  "editor.phrase.next": "далее",
  "editor.phrase.previous": "назад",
  "editor.phrase.all": "все",
  "editor.phrase.matchCase": "регистр",
  "editor.phrase.regexp": "регулярка",
  "editor.phrase.byWord": "целиком",
  "editor.phrase.replaceOne": "заменить",
  "editor.phrase.replaceAll": "заменить все",
  "editor.phrase.goToLine": "Перейти к строке",
  "editor.phrase.go": "перейти",
  "editor.phrase.currentMatch": "текущее совпадение",
  "editor.phrase.onLine": "в строке",
  "editor.phrase.replacedMatches": "заменено совпадений: $",
  "editor.phrase.replacedOnLine": "заменено совпадение в строке $",
  "editor.phrase.close": "закрыть",
  "editor.phrase.controlCharacter": "Управляющий символ",
  "editor.phrase.foldLine": "Свернуть строку",
  "editor.phrase.unfoldLine": "Развернуть строку",
  "editor.phrase.foldedCode": "свёрнутый код",
  "editor.phrase.unfold": "развернуть",
  // «Свёрнуты строки с 3 по 7»: предлог уезжает в первую половину, потому что вторая — общая.
  "editor.phrase.foldedLines": "Свёрнуты строки с",
  "editor.phrase.unfoldedLines": "Развёрнуты строки с",
  "editor.phrase.to": "по",
  "editor.phrase.completions": "Автодополнение",
  "editor.phrase.selectionDeleted": "Выделение удалено",
  "editor.slot.tablist.label": "Слоты кода",
  "editor.slot.tab.label": "Код {number}",
  "editor.slot.tab.title": "Черновик {number}",
  "editor.defaultCode.code": `function init(elevators, floors) {
    const elevator = elevators[0]; // Возьмём первый лифт

    // Как только лифт освободится (в очереди не осталось этажей)...
    elevator.on("idle", function() {
        // ...поедем по всем этажам (или мы про какой-то забыли?)
        elevator.goToFloor(0);
        elevator.goToFloor(1);
    });
}

function update(dt, elevators, floors) {
    // Вызывается на каждом тике — можно использовать, можно оставить пустым
}
`,

  // Level goal descriptions.

  "level.transportWithinTime.html": "Перевезите {people} за {time} или быстрее",
  // "Delivery doesn't take longer", not "wait": the limit is World.maxWaitTime,
  // measured from spawn to delivery, not to boarding.
  "level.transportWithMaxWait.html":
    "Перевезите {people}, и пусть доставка каждого не длится дольше {waitTime}",
  "level.transportWithinTimeWithMaxWait.html":
    "Перевезите {people} за {time} или быстрее, и пусть доставка каждого не длится дольше {waitTime}",
  "level.transportWithinMoves.html": "Перевезите {people}, уложившись в {moves}",
  "level.transportWithinMovesWithMaxWait.html":
    "Перевезите {people}, уложившись в {moves}, и пусть доставка каждого не длится дольше {waitTime}",
  // Accusative after «Перевезите»; for an animate noun it matches the
  // genitive: 1 пассажира, 5 пассажиров.
  "level.people.html": {
    one: "<span class='emphasis-color'>{count}</span> пассажира",
    few: "<span class='emphasis-color'>{count}</span> пассажира",
    many: "<span class='emphasis-color'>{count}</span> пассажиров",
    other: "<span class='emphasis-color'>{count}</span> пассажира",
  },
  // Accusative after «за»: за 21 секунду, за 23 секунды, за 30 секунд.
  "level.timeLimit.html": {
    one: "<span class='emphasis-color'>{count}</span> секунду",
    few: "<span class='emphasis-color'>{count}</span> секунды",
    many: "<span class='emphasis-color'>{count}</span> секунд",
    other: "<span class='emphasis-color'>{count}</span> секунды",
  },
  // Genitive after «дольше»: дольше 21 секунды, дольше 30 секунд. Only the
  // `other` form ever renders: every call site passes a number with decimals,
  // which Russian always resolves to `other`.
  "level.waitLimit.html": {
    one: "<span class='emphasis-color'>{count}</span> секунды",
    few: "<span class='emphasis-color'>{count}</span> секунд",
    many: "<span class='emphasis-color'>{count}</span> секунд",
    other: "<span class='emphasis-color'>{count}</span> секунды",
  },
  // Accusative after «уложившись в»: в 21 перемещение, в 60 перемещений. No
  // «лифта» qualifier: this counts moves across every elevator in the
  // building, not one car.
  "level.moveLimit.html": {
    one: "<span class='emphasis-color'>{count}</span> перемещение",
    few: "<span class='emphasis-color'>{count}</span> перемещения",
    many: "<span class='emphasis-color'>{count}</span> перемещений",
    other: "<span class='emphasis-color'>{count}</span> перемещения",
  },
  "level.sandbox.html":
    "Песочница: {floors}, {elevators} {capacityLabel} {capacities}, {spawnRate}. Цели нет, поэтому симуляция никогда не закончится",
  "level.sandbox.floors.html": {
    one: "<span class='emphasis-color'>{count}</span> этаж",
    few: "<span class='emphasis-color'>{count}</span> этажа",
    many: "<span class='emphasis-color'>{count}</span> этажей",
    other: "<span class='emphasis-color'>{count}</span> этажа",
  },
  "level.sandbox.elevators.html": {
    one: "<span class='emphasis-color'>{count}</span> лифт",
    few: "<span class='emphasis-color'>{count}</span> лифта",
    many: "<span class='emphasis-color'>{count}</span> лифтов",
    other: "<span class='emphasis-color'>{count}</span> лифта",
  },
  // «Вместимостью» doesn't decline by count, but all four forms are still
  // required by the type.
  "level.sandbox.capacityLabel": {
    one: "вместимостью",
    few: "вместимостью",
    many: "вместимостью",
    other: "вместимостью",
  },
  "level.sandbox.spawnRate.html": {
    one: "<span class='emphasis-color'>{count}</span> пассажир в секунду",
    few: "<span class='emphasis-color'>{count}</span> пассажира в секунду",
    many: "<span class='emphasis-color'>{count}</span> пассажиров в секунду",
    other: "<span class='emphasis-color'>{count}</span> пассажира в секунду",
  },

  // Editor autocomplete tooltips.

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
  "completion.elevator.servedFloors":
    "Возвращает массив этажей, которые обслуживает лифт, по возрастанию. В здании с зонами лифт возит пассажиров только между этажами своей зоны, а на остальных этажах его приезд не гасит кнопку вызова. goToFloor по-прежнему увезёт его куда угодно, но в такой поездке никто не поедет, а ходы за неё всё равно спишутся. Лифт без своей зоны возвращает все этажи здания.",
  "completion.elevator.takeRequest":
    "Закрепляет за лифтом поездку, о которой попросили, — в здании, где пассажиры называют этаж назначения вместо кнопки вызова. Те, кто ждёт на первом указанном этаже поездки до второго, сядут именно в этот лифт и ни в какой другой, куда бы ни смотрели его индикаторы. Закрепление не двигает лифт: отправьте его через goToFloor — сначала за пассажирами, потом туда, куда они едут. Возвращает false, если такой поездки нет: её никто не ждёт или лифт не обслуживает оба её конца.",
  "completion.floor.floorNum": "Возвращает номер этажа.",
  "completion.floor.pendingDestinations":
    "Возвращает поездки, о которых попросили с этого этажа и которых всё ещё ждут, — массив по возрастанию этажа. У каждого элемента есть floorNum, куда едут, и waiting, сколько человек туда едет. То же для здания без кнопок вызова, что и buttonStates для обычного: всё, о чём этаж просит прямо сейчас, а не только то, что прозвучало в момент destination_requested. Просьба остаётся здесь, пока по ней кто-нибудь не сядет в лифт, так что именно тут находится просьба, за которой вы закрепили лифт, но так и не отправили его. В здании с кнопками вызова массив пуст.",
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
  "completion.floor.event.hallButtonPressed":
    'Срабатывает, когда на этаже нажали любую из кнопок вызова. Учтите, что пассажиры нажмут её снова, если не смогли зайти в лифт. Обработчику передаётся направление вызова — "up" или "down" — и этаж, на котором нажали кнопку.',
  "completion.floor.event.buttonStateChange":
    "Одна из кнопок вызова на этаже загорелась или погасла.",
  "completion.floor.event.destinationRequested":
    "Срабатывает, когда пассажир на этаже попросил отвезти его на другой этаж — в здании, где вместо кнопок вызова называют этаж назначения. Обработчику передаётся нужный пассажиру этаж и этаж, на котором он ждёт.",
  "completion.global.skeleton":
    "Ваш код должен объявлять функцию init. Рядом можно объявить update — и всё остальное, что понадобится.",
  "completion.global.init":
    "Вызывается в начале уровня. Обычно основную часть кода пишут здесь: настраивают обработчики событий и логику.",
  "completion.global.update":
    "Вызывается многократно по ходу уровня, с фиксированной частотой 100 раз в игровую секунду. dt всегда равен этому фиксированному шагу. Объявлять её необязательно.",
  "completion.initSkeleton.code": `function init(elevators, floors) {
    // Делайте что-нибудь с лифтами и этажами: и те и другие — массивы объектов
}`,
  "completion.updateSkeleton.code": `function update(dt, elevators, floors) {
    // Ещё что-нибудь с лифтами и этажами
}`,

  // Fitness scoring.

  "fitness.measuring": "Считаем эффективность…",
  // Names avgWaitTime the way page.stats does, not the way the field is named.
  "fitness.results": "Эффективность, среднее время доставки: {results}",
  "fitness.result": "{scenario}: {value}",
  "fitness.unknownValue": "?",
  "fitness.error": "Не удалось посчитать эффективность из-за ошибки: {error}",
  "fitness.workerTimeout":
    "Воркер оценки эффективности не закончил работу за {seconds} и был остановлен. Нет ли в вашей программе бесконечного цикла?",
  "fitness.workerFailed": "Воркер оценки эффективности завершился с ошибкой",
  // CLI-only: a worker that leaks memory is killed by Node before it can
  // report, so this uses its own wording, not Node's heap-size message.
  "fitness.workerOutOfMemory":
    "Воркеру оценки эффективности не хватило памяти, и он был остановлен. Не копит ли ваша программа что-то с каждым пассажиром?",
  "fitness.scenario.small": "Маленький сценарий",
  "fitness.scenario.medium": "Средний сценарий",
  "fitness.scenario.large": "Большой сценарий",

  // Errors.

  "error.code.noInit": "В коде должна быть функция init",
  "error.code.updateNotFunction": "В коде объявлен update, но это не функция",
  // {value} can be a quoted string, NaN, undefined, or one of the two nouns
  // below; the verb agrees with the subject and never with {value}, so the
  // sentence stays grammatical for every shape it takes.
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

  // The only docs string the game itself renders; autocomplete inserts it as a
  // skeleton. The rest of the docs live in docs-ru.ts, outside the build.

  "docs.basics.example.code": `function init(elevators, floors) {
    // Делайте что-нибудь с лифтами и этажами: и те и другие — массивы объектов
}

function update(dt, elevators, floors) {
    // Ещё что-нибудь с лифтами и этажами
    // dt — всегда одна и та же доля игровой секунды: update вызывается 100 раз в
    // секунду игрового времени, независимо от того, как быстро на самом деле рисует браузер
}`,

  // Tutorial levels. «Дом» names the building here and in the .code
  // comments, not «здание» as everywhere else — kept apart deliberately.

  "tutorial.level1.title": "Лифт, который никуда не едет",
  "tutorial.level1.goal":
    "Сделайте так, чтобы лифт заезжал на оба этажа этого дома, и перевезите 10 пассажиров за 60 секунд.",
  "tutorial.level1.hint1.html":
    "Смотрите не в код, а на дом. Лифт стоит на нулевом этаже, и в очереди у него тот же нулевой этаж. Сколько всего этажей в этом доме?",
  "tutorial.level1.hint2.html":
    'Этажи нумеруются с нуля, поэтому верхний этаж здесь — <span class="emphasis-color">1</span>. В том же обработчике нужна ещё одна строка рядом с уже написанной.',
  "tutorial.level1.hint3.html":
    'Ответ: добавьте <span class="emphasis-color">elevator.goToFloor(1);</span> следом за уже написанной строкой — тогда лифт, освободившись, будет ставить в очередь оба этажа.',
  "tutorial.level1.explanation.html":
    '<span class="emphasis-color">goToFloor</span> никуда не едет. Он дописывает этаж в конец <span class="emphasis-color">destinationQueue</span> и вызывает <span class="emphasis-color">checkDestinationQueue</span>, а дальше лифт разбирает очередь сам. Поэтому <span class="emphasis-color">goToFloor(0)</span>, когда кабина и так стоит на нулевом этаже, — это законная поездка нулевой длины: лифт приезжает туда, где стоит, открывает двери, люди заходят, очередь снова пуста, снова срабатывает <span class="emphasis-color">idle</span>, и снова происходит то же самое.\n\nВот почему кабина наполняется, а счётчик перемещений держится на нуле. Пассажир садится в момент приезда и выходит на том этаже, который попросил, а этот лифт до него не доезжает.\n\nИ ещё одно, о чём стоит сказать вслух: номер этажа за пределами дома — не ошибка, его молча приводят к ближайшему настоящему этажу. Тот, кто считает этажи с единицы, напишет здесь <span class="emphasis-color">goToFloor(2)</span> и тоже выиграет, потому что 2 превратится в 1.',

  "tutorial.level1.startingCode.code": `function init(elevators, floors) {
    const elevator = elevators[0];

    elevator.on("idle", function() {
        // TODO: в этом доме два этажа, а лифт заезжает только на один
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

  "tutorial.level2.title": "Тот же круг, но своими руками",
  "tutorial.level2.goal":
    "Напишите обработчик, который гоняет лифт по всем трём этажам, и перевезите 15 пассажиров за 60 секунд.",
  "tutorial.level2.hint1.html":
    'Всё нужное было на первом учебном уровне: вы это видели, но не писали сами. Событие, которое случается, когда у лифта кончились цели, называется <span class="emphasis-color">idle</span>.',
  "tutorial.level2.hint2.html":
    'Подписка выглядит так: <span class="emphasis-color">elevator.on("idle", …)</span> — имя события строкой, обработчик функцией. Внутри обработчика — столько вызовов <span class="emphasis-color">goToFloor</span>, сколько в доме этажей.',
  "tutorial.level2.hint3.html":
    'Ответ: подпишитесь на <span class="emphasis-color">idle</span> и поставьте внутри обработчика в очередь этажи 0, 1 и 2 — так же, как на первом учебном уровне это было сделано для двух этажей.',
  "tutorial.level2.explanation.html":
    '<span class="emphasis-color">init</span> вызывают один раз, на первом кадре прогона и до того, как мир сделает хоть один шаг, и обычно он только подписывается на события. Первое <span class="emphasis-color">idle</span> игра посылает сама, строкой сразу после того, как ваш <span class="emphasis-color">init</span> вернул управление, поэтому одной подписки хватает, чтобы всё завертелось.\n\nВторая функция, <span class="emphasis-color">update(dt, elevators, floors)</span>, наоборот, вызывается на каждом шаге симуляции — 100 раз в игровую секунду. Дорожка ей ни разу не пользуется, и это намеренно: опрашивать состояние дома на каждом шаге — путь к программам похуже тех, которые просто отвечают на события. Похуже, но не запрещено: опросом проходится любой уровень дорожки.',

  "tutorial.level2.startingCode.code": `function init(elevators, floors) {
    const elevator = elevators[0];

    // TODO: гоняйте лифт по всем трём этажам, круг за кругом
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

  "tutorial.level3.title": "Кнопки внутри кабины",
  "tutorial.level3.goal":
    "Отвезите тех, кто уже в кабине, туда, куда они попросили, и перевезите 15 пассажиров за 60 секунд.",
  "tutorial.level3.hint1.html":
    "В кабине горят кнопки этажей — значит, игра о них уже сообщила. События, которые присылает лифт, перечислены во всплывающей подсказке редактора и на странице справки.",
  "tutorial.level3.hint2.html":
    'Событие называется <span class="emphasis-color">floor_button_pressed</span>, а нажатый этаж приходит аргументом обработчика.',
  "tutorial.level3.hint3.html":
    'Ответ: подпишитесь на <span class="emphasis-color">floor_button_pressed</span> у лифта и отправляйте его на тот этаж, который пришёл обработчику. Обработчик <span class="emphasis-color">idle</span> оставьте как есть.',
  "tutorial.level3.explanation.html":
    'Пассажир, который зашёл в кабину, нажимает свой этаж, и игра сообщает об этом событием <span class="emphasis-color">floor_button_pressed</span>, передавая номер этажа аргументом. Горящие кнопки можно опрашивать и самому, через <span class="emphasis-color">getPressedFloors()</span>, но привычку стоит заводить другую: отвечать на событие.\n\nЗаметьте, что <span class="emphasis-color">goToFloor(0)</span> в обработчике <span class="emphasis-color">idle</span> теперь никому не мешает — раз кнопки кабины обработаны, эта строка просто означает «вернуться на нулевой этаж, когда делать нечего».',

  "tutorial.level3.startingCode.code": `function init(elevators, floors) {
    const elevator = elevators[0];

    elevator.on("idle", function() {
        elevator.goToFloor(0);
    });

    // TODO: они уже в кабине и уже нажали свои этажи
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

  "tutorial.level4.title": "Очередь, которую никто не прочитал",
  "tutorial.level4.goal":
    "Найдите строку, которой не хватает этой программе, и перевезите 15 пассажиров за 60 секунд.",
  "tutorial.level4.hint1.html":
    "Посмотрите на лифт секунд двадцать. Он не просто стоит: в него никто не заходит. Значит, он ни разу не приехал.",
  "tutorial.level4.hint2.html":
    'Очередь не пуста, но лифт о ней ничего не знает. После того как <span class="emphasis-color">destinationQueue</span> изменили вручную, игре надо об этом сообщить, и нужный метод есть в списке методов лифта.',
  "tutorial.level4.hint3.html":
    'Ответ — одна строка: вызовите <span class="emphasis-color">elevator.checkDestinationQueue();</span> сразу после присваивания, в том же обработчике <span class="emphasis-color">idle</span>.',
  "tutorial.level4.explanation.html":
    'Стоящая полная кабина и стоящая пустая кабина отличаются так же, как лифт, который приехал и открыл двери, отличается от лифта, который не приехал ни разу. Посадка происходит в момент приезда, и больше нигде.\n\nТот, кто нажал кнопку рядом со стоящей кабиной, обычно эту кабину и подталкивает: игра заново предлагает ей этот этаж вызовом <span class="emphasis-color">goToFloor(floor, true)</span>, и на учебных уровнях с первого по третий кабину наполняло именно это. Здесь толчок не делает ничего.\n\nОчередь не пуста, в ней 0, 1, 2, 3, а <span class="emphasis-color">goToFloor</span> отбрасывает просьбу, совпадающую с ближним концом непустой очереди, ещё до того, как дело дойдёт до проверки очереди: просят нулевой этаж, нулевой этаж и так первый в очереди, вызов возвращается. И кабина стоит так до конца прогона. <span class="emphasis-color">goToFloor</span> вызывает <span class="emphasis-color">checkDestinationQueue</span> за вас, а присваивание очереди — нет.',

  "tutorial.level4.startingCode.code": `function init(elevators, floors) {
    const elevator = elevators[0];

    // Кто-то переписал тот же круг через очередь этажей.
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

  "tutorial.level5.title": "Дом вырос",
  "tutorial.level5.goal":
    "Отправляйте лифт туда, куда его действительно зовут: перевезите 15 пассажиров так, чтобы доставка каждого не длилась дольше 37 секунд.",
  "tutorial.level5.hint1.html":
    'Дело не в скорости лифта, а в том, что он ездит туда, где никто не стоит. Кто в этой игре знает, что человек ждёт? Второй аргумент <span class="emphasis-color">init</span> до сих пор ни разу не понадобился.',
  "tutorial.level5.hint2.html":
    'Пройдите по этажам через <span class="emphasis-color">floors.forEach</span> и подпишите каждый на <span class="emphasis-color">up_button_pressed</span> и <span class="emphasis-color">down_button_pressed</span>. Свой номер этаж знает сам: <span class="emphasis-color">floor.floorNum()</span>. Когда вызовы обрабатываются, объезд больше не нужен — удалите его.',
  "tutorial.level5.hint3.html":
    'Ответ: обработчик <span class="emphasis-color">floor_button_pressed</span> оставьте, объезд выбросите целиком, а внутри <span class="emphasis-color">floors.forEach</span> подпишитесь на обе кнопки вызова, и пусть каждая отправляет лифт на <span class="emphasis-color">floor.floorNum()</span>.',
  "tutorial.level5.explanation.html":
    'Слепой объезд не масштабируется: в худшем случае человек ждёт целый круг, а круг растёт вместе с домом. Этажи умеют звать лифт сами.\n\nОба события передают этаж аргументом, так что <span class="emphasis-color">floor.floorNum()</span> можно взять хоть из аргумента, хоть из замыкания — как читается лучше. Подписаться на оба события одной строкой тоже можно, <span class="emphasis-color">floor.on("up_button_pressed down_button_pressed", …)</span>, но тогда первым аргументом придёт имя сработавшего события, а этаж сдвинется на второе место; поэтому здесь два отдельных обработчика.\n\nИ честно о результате: новая программа делает не меньше перемещений, чем объезд, а больше. Выигрывает она тем, что больше не возит воздух.',

  "tutorial.level5.startingCode.code": `function init(elevators, floors) {
    const elevator = elevators[0];

    elevator.on("idle", function() {
        elevator.destinationQueue = [0, 1, 2, 3, 4, 5, 6, 7, 8];
        elevator.checkDestinationQueue();
    });

    elevator.on("floor_button_pressed", function(floorNum) {
        elevator.goToFloor(floorNum);
    });

    // TODO: спрашивайте у этажей, кому нужен лифт, вместо объезда всех подряд
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

  "tutorial.level6.title": "Лифт, который врёт пассажирам",
  "tutorial.level6.goal":
    "Разберитесь, почему половина дома не садится в лифт, и перевезите 15 пассажиров так, чтобы доставка каждого не длилась дольше 28 секунд.",
  "tutorial.level6.hint1.html":
    "Смотрите не на счётчики, а на стрелки вызова. Одна из них загорается по ходу прогона и больше не гаснет. В какую сторону собирался ехать тот, кто её нажал?",
  "tutorial.level6.hint2.html":
    "Лифт с погашенным индикатором «вниз» говорит пассажирам, что вниз он не поедет, и они его пропускают. Изначально оба индикатора включены.",
  "tutorial.level6.hint3.html":
    'Ответ: <span class="emphasis-color">elevator.goingDownIndicator(true);</span> вместо <span class="emphasis-color">false</span>. Удалить обе строки с индикаторами — ровно то же самое, потому что лифт и так создаётся с обоими включёнными. А вот выключить оба — совсем другая программа, в которую вообще никто не садится.',
  "tutorial.level6.explanation.html":
    'Пассажир садится только в тот лифт, который подходит для его поездки: игра спрашивает <span class="emphasis-color">isSuitableForTravelBetween</span>, а тот смотрит на индикаторы. Кого не пустили, тот жмёт кнопку вызова снова.\n\nСтрелка не гаснет по отдельной причине, и по этой же причине симптом вообще видно: приехавший лифт гасит только те кнопки вызова, которые соответствуют его горящим индикаторам, так что кабина с потухшей стрелкой «вниз» физически не может погасить вызов вниз. Хуже того, стоящей кабине этаж и не предлагают заново: игра подталкивает стоящую кабину только тогда, когда её индикатор совпадает с направлением вызова.\n\nОба индикатора включены изначально, так что эти две строки ничего не чинят. Они только ломают.',

  "tutorial.level6.startingCode.code": `function init(elevators, floors) {
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

  "tutorial.level7.title": "Второй лифт",
  "tutorial.level7.goal": "Заставьте работать оба лифта и перевезите 28 пассажиров за 60 секунд.",
  "tutorial.level7.hint1.html":
    'Во втором лифте сидят люди, и он никуда не едет: ему никто ничего не сказал. Сколько раз в этой программе написано <span class="emphasis-color">elevators[0]</span>?',
  "tutorial.level7.hint2.html":
    'Обработчик кнопок кабины подпишите внутри <span class="emphasis-color">elevators.forEach</span>, чтобы каждый лифт слушал свои кнопки. А для вызова с этажа лифт надо выбрать: например, наименее загруженный по <span class="emphasis-color">loadFactor()</span>.',
  "tutorial.level7.hint3.html":
    'Ответ: маленькая функция, которая проходит по <span class="emphasis-color">elevators</span> и возвращает кабину с наименьшим <span class="emphasis-color">loadFactor()</span>; обработчик кнопок кабины, подписанный на каждый лифт через <span class="emphasis-color">elevators.forEach</span>; и обе кнопки вызова на каждом этаже, отправляющие выбранную кабину на <span class="emphasis-color">floor.floorNum()</span>.\n\nПодойдёт любое правило, при котором работают оба лифта.',
  "tutorial.level7.explanation.html":
    '<span class="emphasis-color">elevators[0]</span> — это не «лифт», это «первый лифт». В этом доме их два, а на последних уровнях игры их восемь. Программа, написанная через <span class="emphasis-color">elevators.forEach</span>, одинаково работает и с одной кабиной, и с восемью, и именно её вы унесёте на настоящие уровни.\n\nВыбирать по <span class="emphasis-color">loadFactor()</span> — самое дешёвое разумное правило: 0 — пусто, 1 — полно. Оно не единственное рабочее, годится что угодно, лишь бы обе кабины были при деле, но правило, которое сверяется с картинкой на экране, отлаживать легче.',

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

  "tutorial.level8.title": "По памяти",
  "tutorial.level8.goal":
    "Напишите программу с чистого листа и перевезите 15 пассажиров за 60 секунд.",
  "tutorial.level8.hint1.html":
    'Программа делится на две половины: сказать кабине, куда ехать, и узнать, что лифта кто-то ждёт. Обе вы уже писали. Страница пуста, так что начните с двух функций самого редактора: какая из них, <span class="emphasis-color">init</span> или <span class="emphasis-color">update</span>, вызывается один раз, а какая — каждый кадр?',
  "tutorial.level8.hint2.html":
    "О людях внутри кабины и о людях, ждущих на этаже, игра сообщает разными событиями, и подписываться на них надо в разных местах: на лифте и на каждом этаже.",
  "tutorial.level8.hint3.html":
    'Ответ — программа с седьмого учебного уровня без изменений: с одним лифтом она работает не хуже. Подпишитесь на <span class="emphasis-color">floor_button_pressed</span> у каждой кабины, подпишитесь на обе кнопки вызова у каждого этажа и отправляйте кабину на <span class="emphasis-color">floor.floorNum()</span>.\n\nПишите программу целиком: та половина, где кабина просто стоит на нулевом этаже и знает только свои кнопки, прогоны проигрывает.',
  "tutorial.level8.explanation.html":
    "Здесь нет ничего нового, и в этом всё дело. Это дом уровня 1 и планка уровня 1, взятые намеренно: три этажа, один лифт, 15 пассажиров за 60 секунд. Выиграв здесь, вы уже прошли уровень 1 — той самой программой, которая сейчас в редакторе.\n\nИ запас времени здесь самый маленький на дорожке, причём дорожка тут ни при чём: при 0,3 пассажира в секунду пятнадцатый человек появляется в доме примерно на сорок седьмой секунде из шестидесяти, так что минута теснее, чем кажется. Это свойство уровня 1, и вы столкнулись с ним заранее.",

  "tutorial.level8.startingCode.code": `function init(elevators, floors) {
    // TODO: здесь нет ничего нового. Всё это вы уже писали.
}

function update(dt, elevators, floors) {
}
`,
  // Identical to level 7's answer, on purpose: the finale asks nothing new.
  // Written out in full so every level keeps the same eight keys;
  // src/game/tutorial.test.ts checks the two stay equal.
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

  // «Учебный уровень» (the track) and «уровень N» (the game) are named
  // separately so a player cannot read one for the other.

  "tutorial.panel.hintSummary": "Подсказка {number}",
  "tutorial.panel.explanationSummary": "Почему так получается",
  "tutorial.solution.copy": "Скопировать программу",
  "tutorial.solution.copied": "Скопировано в буфер обмена.",
  "tutorial.solution.copyFailed":
    "Браузер отказался скопировать программу. Выделите её и скопируйте вручную.",
  "tutorial.finish.title": "Дорожка пройдена",
  "tutorial.finish.message":
    "Восемь учебных уровней, и последний из них был уровнем 1 самой игры: те же три этажа, тот же лифт, те же пятнадцать пассажиров за шестьдесят секунд. Программа, которая сейчас в редакторе, его решает. Уровень 1 открывается со своей программой, поэтому скопируйте эту из редактора, прежде чем уходить, если хотите начать с неё.",
  "tutorial.finish.nextLevel": "Следующий учебный уровень",
  "tutorial.finish.toLevels": "Перейти к уровню 1",

  // Chapter two's levels (src/game/chapter2.ts): one key per level, no hints.
  // Only levels 2, 8 and 11 carry a briefing, where a mechanic first
  // appears; "round-trip time" is «время кругового рейса» in Russian.
  "chapter2.level1.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function callNextElevator(floor) {
        // TODO: один вызов, одна кабина, один рейс -- по пути никого не берут
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

  "chapter2.level2.title": "Все начинают в холле",
  "chapter2.level2.briefing.html":
    "Десять этажей, две кабины и здание, которое только что открыло двери. Каждый следующий уровень задаёт толпе свой ритм, а этот — <em>утренний пик</em>: пока идёт рейс, каждый пассажир появляется в холле и каждый едет вверх. Кнопки на этажах не горят, поэтому у вопроса «кто вызвал?» один ответ, и выбор кабины под вызов не решает почти ничего. Решает обратный путь. Кабина возвращается в холл пустой, что бы вы ни делали, так что единственное число, которое вы можете изменить, — сколько человек она увезла наверх. А программа, с которой вы начинаете, отправляет кабину в путь, едва первый пассажир нажал кнопку. Дальше ритм разворачивается: <em>вечерний пик</em>, когда всё здание рвётся на улицу, и <em>обед</em>, который идёт в обе стороны сразу.",

  "chapter2.level2.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function callNextElevator(floor) {
        elevators[next].goToFloor(floor.floorNum());
        next = (next + 1) % elevators.length;
    }

    elevators.forEach(function(elevator) {
        elevator.on("floor_button_pressed", function(floorNum) {
            // TODO: кабина уезжает, едва внутри оказался один человек
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

  "chapter2.level3.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function insertStop(elevator, floorNum) {
        // Стоящей кабине, которую зовут на этаж, где она и так стоит,
        // делать нечего -- кто мог сесть, тот сел.
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

  "chapter2.level4.startingCode.code": `function init(elevators, floors) {
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
            // TODO: в холле сегодня вечером никто не ждёт
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

  "chapter2.level5.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function insertStop(elevator, floorNum) {
        // Стоящей кабине, которую зовут на этаж, где она и так стоит,
        // делать нечего -- кто мог сесть, тот сел.
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

  "chapter2.level6.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function callNextElevator(floor) {
        // TODO: вызовы горят и в холле, и наверху одновременно
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

  "chapter2.level7.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function callNextElevator(floor) {
        elevators[next].goToFloor(floor.floorNum());
        next = (next + 1) % elevators.length;
    }

    elevators.forEach(function(elevator) {
        elevator.on("floor_button_pressed", function(floorNum) {
            // TODO: одно поручение за раз, и каждое пересекает всё здание
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

  "chapter2.level8.title": "Не всякая кабина едет всюду",
  "chapter2.level8.briefing.html":
    "Десять этажей, и две кабины больше не делают одну и ту же работу: одна обслуживает холл и этажи с 1-го по 4-й, другая — холл и этажи с 5-го по 9-й. Настоящие башни устроены именно так, и причина — арифметика: кабина, которая останавливается на каждом этаже высокого здания, весь день только и делает, что останавливается, поэтому этажи делят на <em>зоны</em> и каждому банку кабин отдают свою. Попросите кабину о чужом этаже — машина не станет спорить: доедет, откроет двери, и никто не сядет. Хуже того, вызов останется висеть. Лампа на этаже уже горит, поэтому кнопка, которая позвала бы другую кабину, при повторном нажатии не делает ничего, и этот этаж будет ждать до конца рейса. <code>elevator.servedFloors()</code> — список этажей, которые кабина действительно обслуживает, и с него теперь начинается всякий выбор кабины.",

  "chapter2.level8.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function insertStop(elevator, floorNum) {
        // Стоящей кабине, которую зовут на этаж, где она и так стоит,
        // делать нечего -- кто мог сесть, тот сел.
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
        // TODO: в этом здании не каждая кабина останавливается на каждом этаже
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

  "chapter2.level9.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function insertStop(elevator, floorNum) {
        // Стоящей кабине, которую зовут на этаж, где она и так стоит,
        // делать нечего -- кто мог сесть, тот сел.
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
        // TODO: фильтр -- лёгкая половина; серебро спрашивает, кто ждал дольше всех
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

  "chapter2.level10.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    function insertStop(elevator, floorNum) {
        // Стоящей кабине, которую зовут на этаж, где она и так стоит,
        // делать нечего -- кто мог сесть, тот сел.
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
        // TODO: этажи с 6 по 8 обслуживают оба банка; здесь берётся тот, чья очередь
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

  "chapter2.level11.title": "Никто не жмёт «вверх» и «вниз»",
  "chapter2.level11.briefing.html":
    "Кнопок вызова на этажах больше нет. Вместо «вверх» и «вниз» пассажир набирает нужный этаж на панели у дверей и ждёт ту кабину, которую ему пообещала система, — это <em>назначение по этажу</em>, и на нём работает любая башня, построенная в этом веке. Программа слышит <code>destination_requested</code> с этажом, который кто-то назвал, и отвечает вызовом <code>elevator.takeRequest(from, to)</code>: он закрепляет кабину за этой поездкой, и эти люди сядут в неё и ни в какую другую. Закрепить — значит пообещать кабину, а не отправить её куда-нибудь: отправлять её по-прежнему нужно самому — через <code>goToFloor</code> или через <code>destinationQueue</code>, а следом <code>checkDestinationQueue()</code>. А этаж, чья поездка закреплена, больше не просит — ему, с его точки зрения, уже ответили, — так что невыполненное обещание хуже, чем никакого.",

  "chapter2.level11.startingCode.code": `function init(elevators, floors) {
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
            // TODO: кабина закреплена за поездкой, и никто её не отправил
            elevator.takeRequest(floor.floorNum(), destinationFloor);
        });
    });
}

function update(dt, elevators, floors) {
}
`,

  "chapter2.level12.startingCode.code": `function init(elevators, floors) {
    let next = 0;

    elevators.forEach(function(elevator) {
        elevator.on("floor_button_pressed", function(floorNum) {
            elevator.goToFloor(floorNum);
        });
    });

    floors.forEach(function(floor) {
        floor.on("destination_requested", function(destinationFloor) {
            // TODO: чья очередь, та и едет, где бы она сейчас ни стояла
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

  "chapter2.level13.startingCode.code": `function init(elevators, floors) {
    function insertStop(elevator, floorNum) {
        // Стоящей кабине, которую зовут на этаж, где она и так стоит,
        // делать нечего -- кто мог сесть, тот сел.
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
            // TODO: одна поездка -- одна кабина, а очередь на этом этаже
            // едет сейчас в восемь разных мест
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
};
