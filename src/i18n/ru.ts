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
 * | level              | уровень              |
 * | tutorial level     | учебный уровень      |
 * | lesson             | урок                 |
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
  // Слова «время» в подписи нет, хотя цифра — время. Панель статистики стоит
  // теперь полосой под зданием, а не карточкой в 240 px сбоку от него, и на
  // экране 1040×600 плитке достаётся 128 px под подпись. «Сред. время доставки»
  // просило 153, «Макс. время доставки» — 155, и обе подписи обрезались до
  // «СРЕД. ВРЕМЯ ДОС…» и «МАКС. ВРЕМЯ ДОС…», то есть до неразличимости. Без
  // «времени» — 107 и 109 против тех же 128; запас больше, чем у английских
  // подписей (121 из 128 у самой длинной). Ничего не потеряно: рядом с цифрой
  // стоит «с», а макет и вовсе пишет здесь «Средняя доставка». Замерено в
  // Chromium на собранной странице.
  "page.stats.avgWaitTime": "Сред. доставка",
  // А вот это — то самое время ожидания: отсчёт останавливается, когда за
  // пассажиром приехали, а разницу с «Сред. временем доставки» показывает
  // строка ниже. Три строки подряд читаются как сумма: целое, а под ним обе его
  // половины. «Ожидание кабины», а не «время ожидания»: по глоссарию кабина —
  // это движущийся ящик, которого и ждут, а строка при этом остаётся короткой.
  // 21 знак против 20 у соседей — колонка в 240 px это держит, замерено в
  // Chromium на собранной странице.
  "page.stats.avgPickupTime": "Сред. ожидание кабины",
  "page.stats.avgPickupTimeTitle":
    "Отсчёт идёт от появления пассажира до того момента, как его забрала кабина, а строка под ней — это остальная часть пути",
  // Поездка — третий из трёх отрезков, которыми лифтовое дело меряет здание:
  // ожидание, поездка, весь путь. Строка стоит под ожиданием, а не под «Сред.
  // временем доставки», которое их обоих в себя включает: так две половины
  // оказываются рядом и видно, что они складываются в третью. «Поездка», а не
  // «время в пути», — так это называет строка выше, объясняя, чего в ней нет.
  //
  // 19 знаков против 21 у самой длинной строки панели, так что колонка в 240 px
  // держит её тем же запасом, что и соседей.
  "page.stats.avgRideTime": "Сред. время поездки",
  "page.stats.avgRideTimeTitle":
    "Отсчёт идёт от того момента, как кабина забрала пассажира, до того, как он вышел на своём этаже, так что эта строка и ожидание над ней вместе дают время доставки",
  // Пара к «Сред. доставке» — то же слово и та же причина его укоротить,
  // расписанная там. «Макс.», а не макетное «Худшее»: макет ставит здесь
  // «Худшее ожидание», а это не ожидание, а весь путь (см. выше), и цифра
  // действительно максимум — `world.ts` берёт её через `Math.max` по всем, кто
  // ещё в пути.
  "page.stats.maxWaitTime": "Макс. доставка",
  "page.stats.moves": "Перемещения",
  "page.stats.movesTitle":
    "Перемещение засчитывается каждый раз, когда кабина проходит середину пути от одного этажа до соседнего",
  // Под перемещениями, потому что читают их друг против друга: длинный рейс —
  // это много перемещений и одна остановка, а программа, которая едет на каждый
  // загоревшийся вызов, набирает много остановок при малом числе перемещений.
  // Это то самое `S`, из которого считают время кругового рейса, когда
  // подбирают лифты для настоящего дома.
  "page.stats.stops": "Остановки",
  "page.stats.stopsTitle":
    "Остановка засчитывается каждый раз, когда кабина замирает на этаже и открывает двери, так что кабина, отправленная на этаж, где она и так стоит, добавляет ещё одну",
  // И `P` рядом с ним. Считаются оба конца пути, так что это не то число
  // вошедших на остановку, которое назвал бы для того же дома лифтовик; ценно
  // здесь направление, в котором цифра движется, а оно у них общее.
  "page.stats.peoplePerStop": "Людей на остановку",
  "page.stats.peoplePerStopTitle":
    "Все, кто вошёл или вышел, поделённые на остановки из строки выше, так что открытые двери там, где никого нет, эту цифру снижают",
  // «Загрузка» — по глоссарию, и без «фактора»: это самая короткая строка в
  // панели (14 знаков), и место здесь дорого. Цифру легче всего понять
  // наоборот, поэтому подсказка и справка объясняют её длиннее обычного.
  "page.stats.avgLoad": "Сред. загрузка",
  "page.stats.avgLoadTitle":
    "Насколько полными были кабины — в среднем по тем же перемещениям, что считаются выше, так что стоящая кабина в цифру не попадает вовсе",

  // ----------------------------------------------------------------- здание

  "game.floor.callUp": "Вызвать лифт вверх с этажа {floor}",
  "game.floor.callDown": "Вызвать лифт вниз с этажа {floor}",
  "game.elevator.label": "Лифт {number}",
  "game.elevator.floorButton": "Ехать на этаж {floor}",
  // Всплывающие карточки над кабиной и этажом: widgets/building-stage.
  // src/widgets/building-stage/lib/hover-card-text.ts. У движка нет
  // постоянного флага «двери открыты», только мгновенные события, поэтому
  // строка состояния — всегда одно из этих трёх.
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
  // Новые показатели самой панели статистики: src/widgets/stats-panel.
  // Остальные одиннадцать плиток используют "page.stats.*" напрямую — те же
  // подписи, что уже показывают presentStats и метры полосы цели; у этих
  // двух счётчиков нет прообраза в продакшене, потому что presentStats их
  // никогда не считал. Подписи нарочно в настоящем времени и парой, чтобы
  // читались как противоположности с одного взгляда.
  "game.statsPanel.waitingNow": "Ждут сейчас",
  "game.statsPanel.aboardNow": "Едут сейчас",
  // Текст сводки для «<details>» с девятью дополнительными плитками панели.
  "game.statsPanel.more": "Все показатели",
  "game.challenge.title.html": "Уровень {number}: {description}",
  "game.challenge.nav.label": "Уровни",
  "game.challenge.nav.link": "Уровень {number}",
  "game.levelSwitcher.prevLabel": "Предыдущий уровень",
  "game.levelSwitcher.nextLabel": "Следующий уровень",
  // Заголовок блока и плитка внутри него названы по-разному нарочно. «Остальное» —
  // это средний род существительного «остальной» в значении «всё прочее»: то, что
  // не урок и не пронумерованный уровень. Сейчас там одна песочница, но назвать
  // блок её именем — значит дважды написать одно слово и заранее пообещать, что
  // ничего другого в блоке не появится.
  "game.levelSwitcher.otherBlockLabel": "Остальное",
  "game.levelSwitcher.sandboxLabel": "Песочница",
  "game.levelSwitcher.tutorialTileLabel": "Учебный уровень {number}",
  "game.levelSwitcher.tutorialTileClearedLabel": "Учебный уровень {number}, пройден",
  "game.levelSwitcher.challengeTileLockedLabel": "Уровень {number}, заблокирован",
  // Что написано на кнопке шириной 118px, когда играется урок. Подписи плиток
  // выше сделаны для сетки, где состояние в конце — это и есть смысл подписи;
  // на кнопке они не помещаются: «Учебный уровень 1» просит больше, чем 96px
  // внутри неё, и вся учебная дорожка читалась бы как «Учебный уро...».
  // Укоротить до «Уровень 1» нельзя: ровно так называется и первый уровень
  // игры, а кнопка в шапке — единственное, что всё время говорит игроку, где
  // он находится. Поэтому здесь «Урок» — то самое слово, которым дорожка зовёт
  // свои уровни в справке («рядом со зданием стоит урок»), и короткое.
  // Уровню и песочнице отдельный ключ не нужен: «Уровень {number}» и
  // «Песочница» и так их имена.
  "game.levelSwitcher.tutorialTriggerLabel": "Урок {number}",
  // Ссылка «к строке» панели редактора: widgets/editor-pane. Указывает на
  // строку, которую locateCodeError из src/ui/error-location.ts нашла для
  // исключения игрока; кнопка, которая её несёт, скрыта, если строка не
  // найдена.
  "game.editorPane.gotoLine": "строка {line} →",
  "game.seed.label": "Сид",
  // У поля нет своей подписи: «Сид» рядом с ним — это `<span>`, заголовок
  // блока, а не `<label>`. Поэтому имя говорит и что в поле лежит, и что с ним
  // можно сделать: строка ввода, которая по Enter перезапускает прогон, — не
  // то, чем строка ввода бывает обычно.
  "game.seed.inputLabel": "Сид этого прогона — впишите другой, чтобы сыграть его",
  "game.seed.link": "Сид {seed}: вынести этот прогон в адресную строку",
  "game.seed.newDrawLink": "Сид {seed}: взять новый и начать заново",
  // Поле показывает это само, через setCustomValidity, когда набранное не
  // пережило бы адресную строку. Перечисляет символы, а не сообщает о «неверном
  // формате»: игроку это исправлять, а собственное сообщение браузера про
  // pattern не называет никакого формата.
  "game.seed.invalid":
    "В сиде — до 64 символов: латинские буквы, цифры, точки, дефисы и подчёркивания.",
  "game.seed.helpSummary": "что задаёт сид",
  "game.seed.explanation":
    "Один и тот же сид приводит тех же пассажиров и в том же порядке — а если ещё и играть одинаково, то и весь прогон повторяется в точности: каждое движение лифта, прибытие и нажатие кнопки — один в один, независимо от частоты кадров браузера. Сид остаётся вашим — переживает и перезапуск, и перезагрузку, и переход на другой уровень, — пока вы не впишете другой или не бросите кубик.",
  "game.seed.console":
    "Сид {seed} — тот же самый прогон один в один, независимо от частоты кадров: {url}",
  // Настройки: features/switch-theme. "Как в системе" — не запасной вариант,
  // а исходный: пока тему не трогали, страница темнеет и светлеет вместе с
  // системой (см. doc comment у presentThemeSwitch про prefersDark).
  "game.switchTheme.caption": "Тема",
  "game.switchTheme.system": "Как в системе",
  "game.switchTheme.light": "Светлая",
  "game.switchTheme.dark": "Тёмная",
  // Настройки: features/switch-layout. Четыре режима переключают ту же
  // раскладку, что и рабочая область (widgets/workspace-layout), но своим
  // именем — LayoutModeId, не LayoutMode — потому что features не может
  // импортировать widgets (см. doc comment у layout-switch.ts). Ключи
  // "onlyCode"/"onlyGame", а не голое "code"/"game" ("code" совпало бы с
  // зарезервированным суффиксом ".code" из catalogue.test.ts, который требует
  // побайтового совпадения между локалями — это подпись к примеру кода, а не
  // к режиму раскладки).
  "game.switchLayout.caption": "Раскладка",
  "game.switchLayout.left": "Код слева",
  "game.switchLayout.right": "Код справа",
  "game.switchLayout.onlyCode": "Только код",
  "game.switchLayout.onlyGame": "Только здание",
  // Собственные aria-label'ы widgets/workspace-layout: две панели, которые
  // разделяет разделитель, и сам разделитель — у него нет собственной
  // подписи, потому что это `role="separator"`, а не обычный элемент формы.
  "game.workspace.gamePane": "Симуляция",
  "game.workspace.codePane": "Редактор кода",
  "game.workspace.splitter": "Ширина редактора",
  // Настройки: widgets/app-bar's settings-menu.ts — виджет, который собирает
  // switch-theme, switch-layout, switch-language и manage-seed в одном
  // попапе, который рисует design/ui-mockup.html. docsOpenLabel и
  // hotkeysOpenLabel называют только кнопки-открыватели — сами окна справки
  // и горячих клавиш появятся в фазе 10, поэтому обе кнопки принимают
  // колбэк клика извне и сами пока ничего не делают. aboutForkLabel/
  // aboutOriginalLabel/aboutCopyright — единственный текст в блоке, который
  // в остальном состоит из двух настоящих, зашитых адресов на GitHub:
  // адреса — не дело переводчика.
  "game.appBar.docsOpenLabel": "Справка",
  "game.appBar.settingsLabel": "Настройки",
  "game.appBar.hotkeysOpenLabel": "Горячие клавиши",
  "game.appBar.aboutCaption": "Об игре",
  "game.appBar.aboutForkLabel": "Этот форк",
  "game.appBar.aboutOriginalLabel": "Оригинал",
  // Единственная ссылка из игры на licenses.txt — файл с уведомлениями,
  // который сборка кладёт в dist/; почему это имя лицензии, а не отдельная
  // строка блока, объяснено в собственном комментарии settings-menu.ts.
  "game.appBar.aboutCopyright.html":
    'Elevator Saga © 2015 Magnus Wolffelt, © 2026 EpicDima, <a href="licenses.txt">MIT</a>.',
  // Горячие клавиши: своё окно features/hotkeys-help, `<dialog class="keys">`
  // из design/ui-mockup.html. Каждое сочетание с Mod записано двумя <kbd>,
  // соединёнными «+» (тот же приём, что и в documentation.html через
  // <kbd data-mod-key>, подпись которому в рантайме даёт
  // src/ui/shortcuts.ts's labelModifierKeys), а не сжатыми Mac-глифами
  // мокапа («⌘⏎», «⌘B»); собственная подсказка мокапа про Windows и Linux
  // опущена — labelModifierKeys и так подставляет нужную подпись сама.
  "game.hotkeys.title": "Горячие клавиши",
  "game.hotkeys.closeTitle": "Закрыть окно",
  "game.hotkeys.close": "Закрыть",
  "game.hotkeys.startPause": "Пуск и пауза",
  "game.hotkeys.startOver": "Начать заново",
  "game.hotkeys.switchLayout": "Сменить раскладку",
  "game.hotkeys.openDocs": "Справка",
  "game.hotkeys.openSettings": "Настройки",
  // Справка: окно features/docs-reference, `<dialog class="docs">` из
  // design/ui-mockup.html — обвязка вокруг рассказа и справочника API, а не
  // их содержимое.
  "game.docs.title": "Справка",
  "game.docs.searchPlaceholder": "Поиск: goToFloor, ожидание, кнопка…",
  "game.docs.clearSearch": "Стереть запрос",
  "game.docs.closeTitle": "Закрыть справку",
  "game.docs.close": "Закрыть",
  "game.docs.empty": "Ничего не нашлось",
  // Рассказ «как играть»: собственный шаблон GUIDE из design/ui-mockup.html,
  // перенесённый раздел за разделом. Четыре шага whatToDo — отдельные ключи,
  // а не один с разметкой <ol> целиком: список рисует шаблон, а не
  // переводчик; suffix .html остаётся только у step3, потому что лишь в нём
  // есть <b>, у остальных шагов разметки нет.
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
    "За пройденный уровень дают бронзу — это ровно его условие. Серебро и золото достаются за то, <em>как</em> он пройден: уложиться с запасом, не гонять лифты вхолостую, не заставлять людей ждать. Что именно нужно для каждой звезды, показывает карточка справа в строке целей: там же видно, какие из них держатся прямо сейчас. Ход по уровням звёзды не меняют — следующий открывает бронза, а серебро и золото остаются в списке.",
  "game.docs.guide.tutorialLevels.heading": "Первые уровни — с объяснением",
  "game.docs.guide.tutorialLevels.body":
    "У учебных уровней рядом со зданием стоит урок: шаг за шагом, что происходит, каким событием это видно из программы и как выглядит ответ на него. Его можно свернуть и вернуть кнопкой над зданием.",
  // Скелет программы, с которого начинается любой код, и единственный абзац,
  // называющий elevator/elevators/floor/floors перед тем, как справочник
  // разбирает их по одному — из той же сборки docsBody.innerHTML в
  // design/ui-mockup.html, между рассказом и строками API.
  "game.docs.intro.heading": "Из чего состоит программа",
  "game.docs.intro.example.code": `{
  init: function (elevators, floors) {
    // здесь подписываются на события
  },
  update: function (dt, elevators, floors) {
    // вызывается всё время, пока идёт прогон
  }
}`,
  "game.docs.lead.html":
    "<code>elevator</code> — это лифт: все они лежат в <code>elevators</code>. <code>floor</code> — этаж, они в <code>floors</code>. Любую строку ниже можно раскрыть: под ней подробности и пример.",
  // Справочник API: структурную таблицу (какая sig какой группе принадлежит
  // и в каком порядке) хранит entities/api-reference/model/reference.ts;
  // каждая тройка ниже — краткое описание, подробности и пример одной строки
  // <details class="api">. Русский текст — дословно API_DOCS из
  // design/ui-mockup.html, кроме floorNum.more, где «floors.length - 1»
  // сжато до «floors.length-1», чтобы не нарушать собственное правило этого
  // каталога «дефис — не тире».
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
  // Регулятор скорости. Стрелки говорят, что станет с прогоном, а не что
  // станет с числом: «Медленнее», а не «Уменьшить скорость симуляции». Обе
  // подписи заодно висят у кнопок в title, где целое предложение читалось бы
  // как абзац. Имя всей группы — у обёртки, чтобы попавший на стрелку читатель
  // сперва услышал, к чему она относится. Всё три — дословно из макета.
  "game.timeScale.label": "Скорость прогона",
  "game.timeScale.decrease": "Медленнее",
  "game.timeScale.increase": "Быстрее",
  "game.timeScale.value": "{value}×",
  "game.timeScale.valueTitle": "Скорость прогона: {value}",
  // Последняя ступень регулятора, за 20×: прогон досчитывается до итога, и на
  // экране при этом не рисуется ничего. Знак бесконечности, а не сокращение, и
  // знак умножения при нём тот же, что у остальных ступеней, — иначе «∞»
  // выпадает из ряда «6× 10× 20×» и читается как что-то другое. Подсказка —
  // единственное место, где слово «мгновенно» вообще написано, поэтому она же
  // и предупреждает: смотреть будет не на что.
  "game.timeScale.instant": "∞×",
  "game.timeScale.instantTitle": "Мгновенно: прогон досчитывается сразу до итога",
  // Кнопки прогона: их две, и главная говорит три разные вещи. «Запустить» до
  // первого тика и после последнего, «Пауза» пока идёт, «Продолжить» когда
  // прогон стоит на середине, — то есть на кнопке всегда написано то, что
  // произойдёт, а не то, в каком состоянии прогон сейчас.
  "game.button.start": "Запустить",
  "game.button.pause": "Пауза",
  "game.button.resume": "Продолжить",
  // Висит в title главной кнопки, и только когда прогон уже закончился: там
  // «Запустить» означает выбросить итог, который игрок ещё читает, — больше
  // нигде на странице оно этого не значит.
  "game.button.startAgainTitle": "Пустить прогон заново",
  // Вторая кнопка. Она выбрасывает прогон с экрана и начинает тот же уровень
  // заново с тем кодом, который сейчас в редакторе, — это и делала прежняя
  // «Применить»; названа по результату, а не по механизму, потому что код
  // теперь применяется при каждом запуске и нажимать «Применить» больше не за
  // чем. Её title договаривает то, на что в подписи нет места, и он же
  // остаётся единственным именем кнопки, когда шапка сузилась и подпись
  // спряталась.
  //
  // «Код» в двух последних — потому что они одни в ряду действуют на редактор,
  // а не на симуляцию: «Сбросить» рядом с «Заново» прочли бы как ещё один
  // способ перезапустить прогон.
  "game.button.startOver": "Заново",
  "game.button.startOverTitle": "Начать прогон с самого начала",
  "game.button.resetCode": "Сбросить код",
  "game.button.undoResetCode": "Вернуть код",
  // Подсказки к этим двум: макет даёт такую своей кнопке сброса, и она
  // договаривает то, на что в подписи не хватает места, — какой именно код
  // вернётся. «Сбросить код» само по себе не отличает исходную программу
  // уровня от той, что была минуту назад, а кнопки стоят рядом и отменяют
  // друг друга. Первая — дословно из макета.
  "game.button.resetCodeTitle": "Вернуть в этот слот исходный код уровня",
  "game.button.undoResetCodeTitle": "Вернуть код, который был в слоте до сброса",
  // Что написано на главной кнопке, пока идёт просчёт, — вместо «Запустить».
  // «Прогоняем…» вторит «Считаем эффективность…» у fitness.measuring: глагол в
  // настоящем времени и многоточие, единственная другая кнопка игры,
  // подменяющая свою подпись на время работы. Подписи «Прогнать мгновенно»
  // больше нет: кнопка, на которой она стояла, убрана, а просят просчёт теперь
  // последней ступенью регулятора скорости (game.timeScale.instant).
  "game.button.runningInstantly": "Прогоняем…",
  "game.feedback.success.title": "Получилось!",
  "game.feedback.success.message": "Уровень пройден",
  "game.feedback.failure.title": "Уровень провален",
  "game.feedback.failure.message": "Может быть, программу стоит доработать?",
  "game.feedback.next": "Следующий уровень",
  // Кнопка, закрывающая карточку итога, и только это. «Понятно» — то, что
  // говорит игрок, а не то, что делает кнопка: «Закрыть» описывало бы механику,
  // а слова вроде «Заново» обещали бы перезапуск, который живёт в шапке, и
  // второго способа его пообещать быть не должно.
  "game.feedback.dismiss": "Понятно",
  // Строка под сообщением: чего не хватило до следующей звезды. Для каждого
  // ранга своя фраза, а не одна с подстановкой названия, — «до серебра» и «до
  // золота» стоят в родительном падеже, а game.goalBar.tier.* даёт
  // именительный. В {needs} подставляются невыполненные требования, разделённые
  // formatList; каждое из них — game.feedback.more.need.html, где рядом с
  // требованием стоит то, что вышло на самом деле. Без второго числа строка
  // превращается в упрёк вместо подсказки — так рассуждает и сам макет.
  "game.feedback.more.silver.html": "До серебра: {needs}",
  "game.feedback.more.gold.html": "До золота: {needs}",
  "game.feedback.more.need.html": "{req} (сейчас {now})",
  "game.codeStatus": "Ошибка в вашей программе:",

  // Полоса цели уровня и всплывающий список требований по рангам:
  // `widgets/goal-bar`. Подписи основных счётчиков берутся прямо из
  // "page.stats.*" в коде, без дублирования здесь — «maxPickupTime» это
  // единственная величина, которую панель статистики не показывает, поэтому
  // только для неё нужен отдельный ключ.
  // Параллельно page.stats.avgPickupTime «Сред. ожидание кабины» — та же
  // величина, но максимум, а не среднее.
  "game.goalBar.caption.maxPickupTime": "Макс. ожидание кабины",
  "game.goalBar.unit.seconds": " с",
  "game.goalBar.unit.floors": " эт.",
  "game.goalBar.tier.bronze": "Бронза",
  "game.goalBar.tier.silver": "Серебро",
  "game.goalBar.tier.gold": "Золото",
  "game.goalBar.trigger.titleNone": "Звёзды уровня: пока ни одной. Открыть требования",
  // Не «взято {tier}», как в макете: «взято» не согласуется с «бронза»
  // (нужно «взята»), хотя согласуется с «серебро»/«золото». Вместо этого имя
  // ранга подставляется прямо, с заглавной буквы.
  "game.goalBar.trigger.titleEarned": "Звёзды уровня: {tier}. Открыть требования",
  // Родительный множественный «этажей» неизменен после «не больше» вне
  // зависимости от числа — то же упрощение, что и в самом макете.
  "game.goalBar.floorBudget.html": {
    one: "{count} этажей",
    few: "{count} этажей",
    many: "{count} этажей",
    other: "{count} этажей",
  },
  // Полное склонение, в отличие от floorBudget.html — не порт макета, у
  // которого нет прецедента для этой фразы, поэтому по умолчанию выбрана
  // грамматически правильная форма.
  "game.goalBar.stopBudget.html": {
    one: "{count} остановки",
    few: "{count} остановок",
    many: "{count} остановок",
    other: "{count} остановки",
  },
  "game.goalBar.req.transportedCounter.html": "перевезти {people}",
  "game.goalBar.req.elapsedTime.html": "уложиться в {time}",
  // Переформулировано относительно «никто не ждёт дольше {time}» из макета —
  // это вернуло бы ту самую путаницу, которую уже исправляют собственные
  // комментарии page.stats.avgWaitTime/.maxWaitTime: maxWaitTime/avgWaitTime
  // измеряют время от появления до доставки, а не ожидание.
  "game.goalBar.req.maxWaitTime.html": "никого не доставлять дольше {time}",
  // См. обоснование maxWaitTime выше, здесь не повторяется дословно.
  "game.goalBar.req.avgWaitTime.html": "доставлять в среднем не дольше {time}",
  "game.goalBar.req.moveCount.html": "лифты проезжают не больше {floors}",
  "game.goalBar.req.stopCount.html": "лифты останавливаются не больше {stops}",
  "game.goalBar.req.avgLoadFactorOnMove.html": "лифты заполнены на {percent} и выше",
  // Родительный единственного «человека», не множественного: число с двумя
  // знаками после запятой грамматически дробное (форма other в русском), а
  // дробные числа требуют родительного единственного.
  "game.goalBar.req.transportedPerSec.html": "не меньше {rate} человека в секунду",
  // То же обоснование про родительный единственный; расходится с родительным
  // множественным собственной подписи page.stats.peoplePerStop «Людей на
  // остановку» — там нет управляющего числа.
  "game.goalBar.req.avgPeoplePerStop.html": "не меньше {rate} человека на остановку",
  "game.goalBar.req.maxPickupTime.html": "никого не забирать дольше {time}",
  "game.goalBar.req.avgPickupTime.html": "забирать в среднем не дольше {time}",
  "game.goalBar.req.avgRideTime.html": "везти в среднем не дольше {time}",

  // --------------------------------------------------------------- редактор

  "editor.label": "Программа для лифтов",
  "editor.storageRefused":
    "Не сохранено — браузер отказывается хранить код. Программа останется здесь, пока открыта вкладка.",
  "editor.confirmReset": "Точно сбросить код до стандартной реализации?",
  "editor.confirmUndoReset": "Вернуть код, который был до сброса?",
  "editor.slot.tablist.label": "Слоты кода",
  // Видимая подпись слота и подсказка к нему. Голая цифра ничего не говорит о
  // том, что будет по нажатию, — из-за этого ей и нужен был отдельный
  // `aria-label`, которого зрячий игрок не видел, а незрячий слышал вместо
  // цифры, а не вместе с ней. В макете существительное написано прямо на
  // кнопке, а подсказка объясняет, что это за три штуки: черновики, а не
  // версии и не попытки, чтобы никто не ждал от них истории изменений.
  "editor.slot.tab.label": "Код {number}",
  "editor.slot.tab.title": "Черновик {number}",
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

  // ----------------------------------------------------------------- уровни

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
  // other: лимиты уровней — 21 и 45 секунд — читаются как «дольше 21,0 секунды»
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
  // приписывало общий лимит одному лифту — а лифтов на этих уровнях от двух до
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
  "completion.floor.event.hallButtonPressed":
    'Срабатывает, когда на этаже нажали любую из кнопок вызова. Учтите, что пассажиры нажмут её снова, если не смогли зайти в лифт. Обработчику передаётся направление вызова — "up" или "down" — и этаж, на котором нажали кнопку.',
  "completion.floor.event.buttonStateChange":
    "Одна из кнопок вызова на этаже загорелась или погасла.",
  "completion.global.skeleton":
    "Ваш код должен объявлять объект, в котором есть хотя бы две функции — init и update.",
  "completion.global.init":
    "Вызывается в начале уровня. Обычно основную часть кода пишут здесь: настраивают обработчики событий и логику.",
  "completion.global.update":
    "Вызывается многократно по ходу уровня, с фиксированной частотой 100 раз в игровую секунду. dt всегда равен этому фиксированному шагу.",
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
    "Цель — возить пассажиров эффективно.<br /> Чем лучше это получается, тем дальше вы продвигаетесь по всё более сложным уровням.<br /> Пройти все уровни под силу только самым лучшим программам.",
  "docs.play.heading": "Как играть",
  // «Дорожка», а не «трек»: слово стоит рядом с названием ссылки в шапке игры
  // («Учебная дорожка»), и читатель должен узнать в тексте ту самую ссылку.
  "docs.play.track.html":
    'Если вы никогда не писали таких программ, начните с <a href="index.html#level=tutorial-1">учебной дорожки</a> — на неё ведёт и ссылка <span class="emphasis-color">Учебная дорожка</span> в шапке игры. Это восемь небольших зданий, которые знакомят с этим API по одной ошибке за раз: в каждом выдаётся программа, которая проигрывает, и нужно найти в ней единственную ошибку — рядом есть подсказки и разбор того, что на самом деле происходило в прогоне.',
  "docs.play.start.html":
    'Напишите код в окне под игровым полем и нажмите кнопку <span class="emphasis-color">Старт</span>, чтобы запустить его. Ничего применять заранее не нужно: программа сохраняется сама, пока вы печатаете, и каждый прогон читает её заново. Во время прогона та же кнопка читается как <span class="emphasis-color">Пауза</span>, а соседняя <span class="emphasis-color">С начала</span> обрывает прогон и начинает уровень сначала с тем кодом, что к этому времени в редакторе.<br /> Скорость времени можно увеличивать и уменьшать кнопками {increase} и {decrease}.',
  "docs.play.statistics.html":
    'Рядом со зданием есть панель, которая ведёт счёт по ходу прогона. Восемь строк в ней стоит пояснить. Сначала <span class="emphasis-color">Перемещения</span>. Перемещение засчитывается каждый раз, когда кабина проходит середину пути от одного этажа до соседнего: проехать три этажа — это три перемещения. Кабина, повернувшая назад уже за серединой, проходит её дважды, и засчитываются оба раза; тормозит она не мгновенно, так что и поворот назад незадолго до середины обычно обходится в те же два. На трёх уровнях оценивается не только число перевезённых пассажиров, но и число перемещений — одно на все лифты здания, — так что там кабина, которая катается вхолостую, способна провалить прогон. Под ними — <span class="emphasis-color">Остановки</span>, и считают они совсем другое. Остановка засчитывается каждый раз, когда кабина замирает на этаже и открывает двери, так что кабина, отправленная на этаж, где она и так стоит, добавляет ещё одну. Те самые три этажа — это три перемещения и одна остановка, и две строки стоит читать друг против друга: программа, которая шлёт кабину на каждый вызов, едва тот загорелся, наберёт много остановок при малом числе перемещений, а та, что даёт кабине закончить начатое, — наоборот. Дальше — <span class="emphasis-color">Людей на остановку</span>. Все, кто вошёл или вышел, поделённые на остановки из строки выше, так что открытые двери там, где никого нет, эту цифру снижают. Считаются оба конца пути, и посадка, и выход, поэтому цифра выходит выше той, которую для того же дома назвал бы лифтовик; полезна она направлением, в котором движется, а не своей величиной. Дальше два времени. <span class="emphasis-color">Сред. доставка</span> и <span class="emphasis-color">Макс. доставка</span> отсчитываются от момента, когда пассажир появился в здании, до момента, когда он вышел из кабины на нужном ему этаже, так что поездка входит в них наравне с ожиданием: тот, кто сразу зашёл в стоявшую у его этажа кабину и не ждал ни секунды, всё равно добавит к обеим цифрам каждую секунду поездки на девятнадцать этажей. По второй из них оцениваются девять уровней игры и два учебных уровня; это наибольшее время, которое набрал хоть один пассажир, — пока кто-то ещё в пути, оно продолжает расти, а набранного уже не теряет. Между ними стоят обе половины, которыми ни та ни другая цифра не является. Сначала <span class="emphasis-color">Сред. ожидание кабины</span>. Отсчёт идёт от появления пассажира до того момента, как его забрала кабина, а строка под ней — это остальная часть пути. В среднее попадают только те, до кого кабина уже доехала, так что тот, кто так и остался стоять на этаже, виден не здесь, а в максимуме. Строка под ней — <span class="emphasis-color">Сред. время поездки</span>. Отсчёт идёт от того момента, как кабина забрала пассажира, до того, как он вышел на своём этаже, так что эта строка и ожидание над ней вместе дают время доставки. Все три — те самые три отрезка, которыми лифтовое дело меряет настоящее здание, и сходятся они в точности лишь тогда, когда никто не едет: у того, кто ещё в кабине, ожидание в среднее уже попало, а поездке пока попасть некуда. Наконец, <span class="emphasis-color">Сред. загрузка</span>. Насколько полными были кабины — в среднем по тем же перемещениям, что считаются выше, так что стоящая кабина в цифру не попадает вовсе: за простой здесь ничего не снимается, а на нескольких уровнях он и есть верный ход. В обычном прогоне цифра держится далеко от полной кабины, и исправлять тут нечего: кабины редко бывают полными, и за то, чтобы их набить, игра ничего не даёт. И выше — не значит лучше. Из трёх программ, прогнанных на одном и том же восемнадцатиэтажном здании, та, что держит кабину на этаже, пока она не наберётся почти полной, дошла до загрузки около семи десятых — и перевезла меньше всех троих, а ждали у неё почти вдвое дольше, чем у лучшей; у лучшей же кабины оказались самыми пустыми, меньше половины. Полезна эта цифра для сравнения двух программ, которые перевозят примерно поровну: при равном числе перевезённых та, у которой загрузка выше, обошлась меньшим числом пустых рейсов.',
  "docs.play.shortcuts.html":
    'В редакторе <kbd data-mod-key>Ctrl</kbd>+<kbd>Enter</kbd> начинает уровень заново с тем, что вы написали, — то же самое делает кнопка <span class="emphasis-color">С начала</span>; <kbd data-mod-key>Ctrl</kbd>+<kbd>S</kbd> записывает программу в хранилище сразу, не дожидаясь автосохранения, и не даёт открыться окну сохранения браузера; <kbd>Tab</kbd> добавляет отступ, а <kbd>Esc</kbd> убирает фокус из редактора.',
  "docs.play.debugging.html":
    'Если в программе ошибка, попробуйте разобраться с ней через инструменты разработчика в браузере. Чтобы начать с чистого листа, нажмите кнопку <span class="emphasis-color">Сбросить код</span>: код вернётся к рабочей, но совсем простой реализации, а рядом появится кнопка <span class="emphasis-color">Вернуть код</span> — она будет там, пока есть что возвращать.<br /> Если у вас есть любимый текстовый редактор, например <a href="https://www.sublimetext.com/">Sublime Text</a>, пишите код в нём и вставляйте в редактор игры.<br /> Код сам сохраняется в локальном хранилище браузера, так что не переживайте — он не пропадёт, если вы случайно закроете браузер.',

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
        // dt — всегда одна и та же доля игровой секунды: update вызывается 100 раз в
        // секунду игрового времени, независимо от того, как быстро на самом деле рисует браузер
    }
}`,
  "docs.basics.called.html":
    'Эти функции игра вызывает по ходу уровня.<br /> <span class="emphasis-color">init</span> вызывается один раз, на первом кадре прогона, а не в момент, когда вы применили код; <span class="emphasis-color">update</span> — на том же шаге и на каждом следующем шаге симуляции — 100 раз в игровую секунду, по расписанию, привязанному к игровому времени, а не к тому, как часто рисует браузер. Поэтому <span class="emphasis-color">dt</span> всегда одно и то же значение, а два прогона с одним и тем же сидом и одинаковыми действиями проходят одну и ту же последовательность шагов — независимо от того, быстрый браузер или медленный. Обеим передаются одни и те же два массива — все лифты здания и все его этажи, — так что <span class="emphasis-color">elevators.length</span> и есть число кабин, которыми вы распоряжаетесь; между вызовами эти массивы не подменяются. Обе функции вызываются на объекте, который вы объявили, так что <span class="emphasis-color">this</span> внутри них — этот самый объект: всё, что программе нужно помнить от кадра к кадру, можно хранить на <span class="emphasis-color">this</span>, а не во внешней переменной. Это верно, пока они написаны через <span class="emphasis-color">function</span>: стрелочная функция сохраняет <span class="emphasis-color">this</span> того места, где её написали, а здесь это страница, а не ваш объект.',
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
    'Снимать обработчики обычно не нужно: при перезапуске уровня лифты и этажи выбрасываются, а ваш <span class="emphasis-color">init</span> вызывается заново уже на новых. Снятие пригодится, когда обработчик должен действовать только какое-то время.',

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
  "docs.api.floor.hallButtonPressed":
    'Срабатывает, когда на этаже нажали любую из кнопок вызова. Учтите, что пассажиры нажмут её снова, если не смогли зайти в лифт. Обработчику передаётся направление вызова — "up" или "down" — и этаж, на котором нажали кнопку. Всегда приходит после события up_button_pressed или down_button_pressed для того же нажатия и никогда раньше него, так что программа, подписанная на оба, узнает об этом нажатии дважды.',
  "docs.api.floor.hallButtonPressed.example.code": `floor.on("hall_button_pressed", function(direction, floor) {
    // Может, отправить лифт, который и так едет в эту сторону?
})`,
  "docs.api.floor.buttonStateChange.html":
    'Срабатывает, когда одна из кнопок вызова на этаже загорелась или погасла. Обработчику передаётся состояние обеих кнопок: объект со свойствами <span class="emphasis-color">up</span> и <span class="emphasis-color">down</span>, каждое из которых — либо <span class="emphasis-color">"activated"</span>, либо пустая строка. Это снимок на момент события, так что сохранённый объект о более поздних нажатиях не расскажет.',
  "docs.api.floor.buttonStateChange.example.code": `floor.on("buttonstate_change", function(buttonStates) {
    if(buttonStates.up === "" && buttonStates.down === "") {
        // Здесь больше никто не ждёт?
    }
})`,

  // -------------------------------------------------------- учебная дорожка
  // «Учебный уровень» — это уровень дорожки, «уровень N» — уровень игры;
  // первый пишется с уточнением, чтобы игрок не спутал одно с другим, и по той
  // же причине кнопка выхода ведёт «к уровням игры».
  //
  // Исключение — строка положения в панели, `tutorial.panel.position`. Она
  // стоит сразу за названием дорожки: `tutorial.panel.label` идёт перед ней в
  // той же строке и набран полужирным, так что уточнение там уже сделано, а
  // повтор давал «Учебная дорожка Учебный уровень 7 из 8». В заголовке над
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
  // этого же уровня: игрок читает программу в редакторе, а подсказки — рядом,
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
    "Всё нужное было на первом учебном уровне: вы это видели, но не писали сами. Событие, которое случается, когда у лифта кончились цели, называется idle.",
  "tutorial.task2.hint2.html":
    'Подписка выглядит так: <span class="emphasis-color">elevator.on("idle", …)</span> — имя события строкой, обработчик функцией. Внутри обработчика — столько вызовов goToFloor, сколько в доме этажей.',
  "tutorial.task2.hint3.html":
    'Ответ: подпишитесь на <span class="emphasis-color">idle</span> и поставьте внутри обработчика в очередь этажи 0, 1 и 2 — так же, как на первом учебном уровне это было сделано для двух этажей.',
  "tutorial.task2.explanation.html":
    "init вызывают один раз, на первом кадре прогона и до того, как мир сделает хоть один шаг, и обычно он только подписывается на события. Первое idle игра посылает сама, строкой сразу после того, как ваш init вернул управление, поэтому одной подписки хватает, чтобы всё завертелось. Вторая функция, update(dt, elevators, floors), наоборот, вызывается на каждом шаге симуляции — 100 раз в игровую секунду. Дорожка ей ни разу не пользуется, и это намеренно: опрашивать состояние дома на каждом шаге — путь к программам похуже тех, которые просто отвечают на события. Похуже, но не запрещено: опросом проходится любой уровень дорожки.",

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
    "Стоящая полная кабина и стоящая пустая кабина отличаются так же, как лифт, который приехал и открыл двери, отличается от лифта, который не приехал ни разу. Посадка происходит в момент приезда, и больше нигде. Тот, кто нажал кнопку рядом со стоящей кабиной, обычно эту кабину и подталкивает: игра заново предлагает ей этот этаж вызовом goToFloor(floor, true), и на учебных уровнях с первого по третий кабину наполняло именно это. Здесь толчок не делает ничего. Очередь не пуста, в ней 0, 1, 2, 3, а goToFloor отбрасывает просьбу, совпадающую с ближним концом непустой очереди, ещё до того, как дело дойдёт до проверки очереди: просят нулевой этаж, нулевой этаж и так первый в очереди, вызов возвращается. И кабина стоит так до конца прогона. goToFloor вызывает checkDestinationQueue за вас, а присваивание очереди — нет.",

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
    "elevators[0] — это не «лифт», это «первый лифт». В этом доме их два, а на последних уровнях игры их восемь. Программа, написанная через elevators.forEach, одинаково работает и с одной кабиной, и с восемью, и именно её вы унесёте на настоящие уровни. Выбирать по loadFactor() — самое дешёвое разумное правило: 0 — пусто, 1 — полно. Оно не единственное рабочее, годится что угодно, лишь бы обе кабины были при деле, но правило, которое сверяется с картинкой на экране, отлаживать легче.",

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
    'Ответ — программа с седьмого учебного уровня без изменений: с одним лифтом она работает не хуже. Подпишитесь на <span class="emphasis-color">floor_button_pressed</span> у каждой кабины, подпишитесь на обе кнопки вызова у каждого этажа и отправляйте кабину на <span class="emphasis-color">floor.floorNum()</span>. Пишите программу целиком: та половина, где кабина просто стоит на нулевом этаже и знает только свои кнопки, прогоны проигрывает.',
  "tutorial.task8.explanation.html":
    "Здесь нет ничего нового, и в этом всё дело. Это дом уровня 1 и планка уровня 1, взятые намеренно: три этажа, один лифт, 15 пассажиров за 60 секунд. Выиграв здесь, вы уже прошли уровень 1 — той самой программой, которая сейчас в редакторе. И запас времени здесь самый маленький на дорожке, причём дорожка тут ни при чём: при 0,3 пассажира в секунду пятнадцатый человек появляется в доме примерно на сорок седьмой секунде из шестидесяти, так что минута теснее, чем кажется. Это свойство уровня 1, и вы столкнулись с ним заранее.",

  "tutorial.task8.startingCode.code": `{
    init: function(elevators, floors) {
        // TODO: здесь нет ничего нового. Всё это вы уже писали.
    },
    update: function(dt, elevators, floors) {
    }
}`,
  // Ответ седьмого уровня слово в слово: выпускной уровень не просит ничего
  // нового. Выписан целиком, а не подставлен ссылкой, чтобы у каждого уровня
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

  // Панель вокруг уровней, полоса над ними и экран после последнего. Строка
  // сида, статистика и редактор — общие с остальной игрой и говорят здесь то
  // же самое, что и везде.

  "tutorial.panel.label": "Учебная дорожка",
  "tutorial.panel.position": "Уровень {number} из {count}",
  "tutorial.panel.progress": {
    one: "Пройдено {cleared} из {count} уровня",
    few: "Пройдено {cleared} из {count} уровней",
    many: "Пройдено {cleared} из {count} уровней",
    other: "Пройдено {cleared} из {count} уровня",
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
  "tutorial.button.takeCode": "Забрать программу в свой редактор",
  "tutorial.button.takeCodeConfirm": "В редакторе игры уже лежит ваша программа. Заменить её этой?",
  "tutorial.button.leave": "Выйти к уровням игры",
  "tutorial.solution.copy": "Скопировать программу",
  "tutorial.solution.copied": "Скопировано в буфер обмена.",
  "tutorial.solution.copyFailed":
    "Браузер отказался скопировать программу. Выделите её в блоке выше и скопируйте вручную.",
  "tutorial.bar.title.html": "Учебный уровень {number} из {count}: {description}",
  "tutorial.finish.title": "Дорожка пройдена",
  "tutorial.finish.message":
    "Восемь учебных уровней, и последний из них был уровнем 1 самой игры: те же три этажа, тот же лифт, те же пятнадцать пассажиров за шестьдесят секунд. Программа, которая сейчас в редакторе, его решает, а на панели есть кнопка, которая скопирует её в ваш редактор, — заберите программу с собой, прежде чем уходить.",
  "tutorial.finish.nextTask": "Следующий учебный уровень",
  "tutorial.finish.toChallenges": "Перейти к уровню 1",
};
