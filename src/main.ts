/**
 * The entry point: builds the game out of its parts and starts it.
 *
 * Everything here is wiring, which is why there is no logic to test: the parts
 * being wired together are covered by their own unit tests.
 *
 * Ported from the `$(function() { ... })` block of the legacy `app.js`. Two
 * things that used to be in `index.html` are gone: the Google Analytics snippet,
 * and the render-blocking `<link>` tags for jQuery, lodash, riot, CodeMirror 5,
 * the Font Awesome webfont and Google's copy of Oswald. The font is self-hosted
 * now, and only in the two weights the design uses.
 *
 * `400.css` and `700.css` rather than the `latin-*.css` subsets those two used
 * to be. The subset files carry no `unicode-range`, so the pair of them claimed
 * the whole plane while holding Latin glyphs only, and every Cyrillic character
 * on the page fell through to the `Arial` fallback: the Russian game was not
 * set in the game's typeface at all, and being wider than condensed Oswald it
 * wrapped the header at different widths -- 537 of the 981 viewport widths
 * between 320px and 1300px gave the two locales headers of different heights.
 * These files declare every subset with the `unicode-range` the subsets omit,
 * which is what keeps the right face on the right character. The cost is eight
 * more font binaries copied into `dist/assets/`; the range gates them, so an
 * English player downloads none of them and a Russian one downloads 13 kB.
 */

import "@fontsource/oswald/400.css";
import "@fontsource/oswald/700.css";
import "./styles/style.css";

import { describeFitnessResults, runFitnessSuite } from "./app/fitness.ts";
import { challenges } from "./game/challenges.ts";
import type { FitnessSuiteResult } from "./game/fitness.ts";
import { TICK_SECONDS, createWorldController } from "./game/world-controller.ts";
import { t } from "./i18n/index.ts";
import { App, readStoredTimeScale } from "./pages/game/index.ts";
import { startRouter } from "./pages/game/model/route.ts";
import { CodeEditor, codeMirrorView } from "./ui/editor.ts";
import { presentGlobalShortcuts } from "./ui/global-shortcuts.ts";
import { localisePage } from "./ui/localise-page.ts";
import { applyPreferredLocale } from "./ui/preferred-locale.ts";
import { labelModifierKeys } from "./ui/shortcuts.ts";
import { DEFAULT_TIME_SCALE } from "#features/adjust-speed/model/time-scale.ts";
import { docsModalTemplate, presentDocsModal } from "#features/docs-reference/index.ts";
import { hotkeysModalTemplate, presentHotkeysModal } from "#features/hotkeys-help/index.ts";
import { DEFAULT_CODE_SLOT } from "#features/manage-code-slots/model/code-slots.ts";
import { requireElement } from "#shared/lib/dom.ts";
import {
  appBarSettingsTemplate,
  buildAppBarSkeleton,
  presentAppBarSettings,
  type AppBarSettingsController,
} from "#widgets/app-bar/index.ts";
import { presentEditorPane } from "#widgets/editor-pane/index.ts";
import {
  buildWorkspaceLayoutSkeleton,
  presentWorkspaceLayout,
  readLayoutMode,
  type LayoutMode,
} from "#widgets/workspace-layout/index.ts";

/**
 * Where Ctrl-B / Cmd-B takes the workspace next.
 *
 * A ring over `design/ui-mockup.html`'s own `.seg-fill` button order (`left`,
 * `right`, `code`, `game`) rather than the mockup's own array-and-modulo, so
 * the map stays exhaustive over {@link LayoutMode} and every lookup is typed
 * as returning a mode rather than `LayoutMode | undefined` under
 * `noUncheckedIndexedAccess` -- an index signature would need the latter; a
 * `Record` keyed by the type itself does not.
 */
const NEXT_LAYOUT_MODE: Readonly<Record<LayoutMode, LayoutMode>> = {
  right: "left",
  left: "code",
  code: "game",
  game: "right",
};

declare global {
  interface Window {
    /**
     * Benchmarks a program over a few headless scenarios, in a worker.
     *
     * The legacy `fitness.js` exposed `fitnessSuite` as a global for the same
     * purpose, and its only call site was commented out because running the
     * benchmark after every keystroke was too slow to be useful. It stays
     * opt-in: call it from the browser console, which is also where the answer
     * now arrives -- `design/ui-mockup.html` draws no status line under the
     * editor for it to be printed into, and a console command reporting to the
     * console it was typed into is the shorter path anyway.
     */
    runFitnessSuite: (codeStr?: string) => Promise<FitnessSuiteResult>;
  }
}

/**
 * Builds the game and starts it.
 *
 * @returns A promise that settles once the game is running.
 */
async function main(): Promise<void> {
  // Awaited, and before anything is drawn, so that the shell and the game it
  // frames are never in two languages at once: for a reader of a language whose
  // catalogue is fetched rather than bundled this is a round trip in front of
  // the first frame, and `src/ui/preferred-locale.ts` is where that is weighed
  // against the alternative. It also relabels the shortcut keys for the
  // platform, which used to be a call of its own here: a `<kbd data-mod-key>`
  // can sit inside a message the shell rewrites, so rewriting and relabelling
  // belong together and cannot be left in an order this file happens to get
  // right.
  await applyPreferredLocale(document, navigator.userAgent);

  // The editor pane's chrome -- the slot switcher, the reset/undo-reset tools,
  // the error banner and the `.editor` mount CodeMirror needs -- has to exist
  // before `codeMirrorView` can be built over that mount, and `CodeEditor` has
  // to exist before the callbacks below, which act on it, can be written. Two
  // mutable cells break that circle: the callbacks read `editorRef`/`appRef`
  // rather than closing over `editor`/`app` themselves, so they can be written
  // here and filled in once each object actually exists -- `editorRef` a few
  // lines down, `appRef` once `App` is built below. Until then `canUndoReset`
  // and `currentSlot`, the two this pane calls synchronously while drawing its
  // own first frame, fall back to `false` and `DEFAULT_CODE_SLOT` -- not merely
  // safe placeholders but the actually correct answers for a page that has
  // built neither yet: there is nothing to undo, and `App`'s own `#currentSlot`
  // field opens on the same default.
  // eslint-disable-next-line prefer-const -- assigned once, below the closures that read it: the single write is what breaks the circle above.
  let editorRef: CodeEditor | undefined;
  // eslint-disable-next-line prefer-const -- see editorRef, just above.
  let appRef: App | undefined;
  // `App` is built (and runs its first route, through `startRouter`) well
  // before `presentAppBarSettings` exists to hand its `onSeedChange` option
  // a real target -- the popover it returns a controller for is assembled
  // much further down, once the app bar itself is. Same cell, same reason.
  // eslint-disable-next-line prefer-const -- see editorRef, above.
  let settingsControllerRef: AppBarSettingsController | undefined;

  const editorPane = presentEditorPane(requireElement(".code"), {
    currentSlot: () => appRef?.currentCodeSlot ?? DEFAULT_CODE_SLOT,
    onSelectSlot: (slot) => {
      appRef?.selectCodeSlot(slot);
    },
    canUndoReset: () => editorRef?.canUndoReset() ?? false,
    onResetCode: () => {
      if (editorRef === undefined) {
        return;
      }
      // `window.confirm`, as `src/widgets/tutorial-panel/ui/tutorial-panel.ts`
      // explains at the one other place the game asks before throwing a
      // program away. The update afterwards is what puts "Undo reset" on
      // screen: a refused reset leaves nothing to undo, and asking the editor
      // covers both outcomes without this having to know which it got.
      if (window.confirm(t("editor.confirmReset"))) {
        editorRef.reset();
        editorPane.update();
      }
      editorRef.focus();
    },
    onUndoReset: () => {
      if (editorRef === undefined) {
        return;
      }
      if (window.confirm(t("editor.confirmUndoReset"))) {
        editorRef.undoReset();
        editorPane.update();
      }
      editorRef.focus();
    },
    onGotoLine: (line) => {
      if (editorRef === undefined) {
        return;
      }
      // `column: 1` is synthetic: the pane only ever locates a line, and
      // `CodeEditor.markError` -- the one way to move the editor's own view --
      // wants both. Its underline spans the column onward, so a wrong column
      // here would draw a shorter mark than the automatic one this repeats
      // rather than a wrong jump; what actually moves the view is the
      // `EditorView.scrollIntoView` `markError` dispatches alongside it.
      editorRef.markError({ line, column: 1 });
      editorRef.focus();
    },
  });

  const editor = new CodeEditor(codeMirrorView(editorPane.editorMount));
  editorRef = editor;

  // What the editor still has to say for itself, and all of it: see
  // `#storage_status`'s own comment in `index.html` for why the save
  // confirmation that used to share this region is gone and this half is not.
  const storageStatus = requireElement("#storage_status");

  // The reason `storage_refused` exists at all: until it was listened to, the
  // event was raised by every refused write in the editor and heard by
  // nothing, so a store that had stopped taking programs said so nowhere on
  // the page. The visible cost was "Reset code" -- refused, it leaves the
  // program exactly where it was and looked indistinguishable from a button
  // that does not work -- but the silence was worse between resets, where a
  // player types all afternoon believing the work is being kept.
  editor.on("storage_refused", () => {
    storageStatus.textContent = t("editor.storageRefused");
  });
  // The withdrawal, not a confirmation: nothing is written here on a
  // successful save, because a full quota is not a permanent condition -- a
  // tab closing or a cache being cleared is enough -- and a warning left
  // standing after the writes start landing again tells a player their work is
  // at risk when it is not. Emptying a `role="status"` announces nothing,
  // which is exactly right for news that has stopped being news.
  editor.on("saved", () => {
    storageStatus.textContent = "";
  });
  editor.on("change", () => {
    // `canUndoReset` answers for the program on screen, so typing moves it as
    // surely as pressing Reset does: without this, the pane would go on
    // offering to undo a reset the player has already typed over.
    editorPane.update();
  });

  // The four buttons that used to be wired here -- Save, Apply, Reset and Undo
  // reset -- are run controls and editor-pane tools now, drawn and driven by
  // the app and this file respectively; see `presentControls` in
  // `src/pages/game/index.ts` and `editorPane` above. Save has no successor: the
  // editor has always autosaved a second after the last keystroke, so the
  // button was a promise the game had already kept.

  // The skip link. Two things have to be taken off the browser: the focus,
  // which belongs inside CodeMirror rather than on the `<div>` it mounts into,
  // and the navigation -- the hash is the router's, so following `#code` would
  // throw away `challenge=` and `timescale=` and restart the player on the
  // first challenge. The `href` stays for the sake of being a real link.
  requireElement(".skip-link").addEventListener("click", (event) => {
    event.preventDefault();
    editor.focus();
  });

  // Built here rather than found by `requireElement`, unlike every other
  // region `App` draws into: `widgets/level-switcher` sits in the app bar
  // alongside the brand, and the app bar itself is not assembled until further
  // down this function -- see the comment there for why. Detached from the
  // document until then, which costs nothing: `App`'s constructor only writes
  // into it and wires click listeners, neither of which needs the element to
  // be on screen yet, and the mockup's own `.task` slot is exactly where it is
  // appended once the bar exists.
  const levelSwitcherMount = document.createElement("div");
  levelSwitcherMount.className = "levelswitcher";

  const app = new App({
    elements: {
      controls: requireElement(".controls"),
      tutorial: requireElement(".tutorial"),
      levelSwitcher: levelSwitcherMount,
      goalBar: requireElement(".challenge"),
      world: requireElement(".innerworld"),
      stats: requireElement(".statscontainer"),
      feedback: requireElement(".feedbackcontainer"),
    },
    editor,
    editorPane,
    worldController: createWorldController(TICK_SECONDS),
    challenges,
    onSeedChange: (seed) => {
      settingsControllerRef?.setSeed(seed);
    },
  });
  appRef = app;

  window.runFitnessSuite = async (codeStr = editor.getCode()): Promise<FitnessSuiteResult> => {
    // Printed as well as returned. The console shows a returned promise's value
    // on its own, so the formatted line is the part that would otherwise be
    // lost -- `describeFitnessResults` is what turns four scenarios' worth of
    // numbers into a sentence, and re-deriving it from the object at the prompt
    // is work nobody should have to do twice. The "measuring" line goes with
    // it: the benchmark takes seconds, and a command that answers nothing until
    // it is finished looks like a command that did nothing.
    console.info(t("fitness.measuring"));
    const results = await runFitnessSuite(codeStr);
    console.info(describeFitnessResults(results));
    return results;
  };

  editor.trigger("change");

  startRouter(
    (params, query) => {
      app.handleRoute(params, query);
    },
    {
      challengeCount: challenges.length,
      defaultTimeScale: () => readStoredTimeScale(localStorage) ?? DEFAULT_TIME_SCALE,
    },
  );

  // Everything below mounts the new shell over the run just started: the docs
  // and hotkeys dialogs, the workspace's two panes -- holding the five regions
  // above exactly as they were, one level deeper -- the app bar that replaces
  // the shipped `<header>`, and the shortcuts that tie all of it together.
  // Ordered so that
  // nothing here composes a piece that does not exist yet: the two dialogs
  // first, since nothing else depends on them; the workspace next, since the
  // app bar's settings popover needs its `setLayoutMode`; the app bar third,
  // since it needs both the workspace controller and the dialogs' own
  // `open()`; the keyboard dispatcher last, since every shortcut but Space
  // calls into one of the other three.

  document.body.insertAdjacentHTML("beforeend", docsModalTemplate());
  const docsDialog = requireElement(".docs");
  if (!(docsDialog instanceof HTMLDialogElement)) {
    throw new TypeError("Expected .docs to be a <dialog>");
  }
  const docsModal = presentDocsModal(docsDialog);

  document.body.insertAdjacentHTML("beforeend", hotkeysModalTemplate());
  const hotkeysDialog = requireElement(".keys");
  if (!(hotkeysDialog instanceof HTMLDialogElement)) {
    throw new TypeError("Expected .keys to be a <dialog>");
  }
  labelModifierKeys(hotkeysDialog, navigator.userAgent);
  const hotkeysModal = presentHotkeysModal(hotkeysDialog);

  // The workspace shell: `.pane-game`/`.pane-code` become the new parents of
  // the five regions `<main>` held directly until now, in the order it held
  // them. Moving an already-mounted element with `append` reparents it
  // without tearing anything down, CodeMirror included, so every one of them
  // keeps running exactly as built above.
  const mainRegion = requireElement("main");
  const workspaceElements = buildWorkspaceLayoutSkeleton(document, {
    gamePane: t("game.workspace.gamePane"),
    codePane: t("game.workspace.codePane"),
    splitter: t("game.workspace.splitter"),
  });
  workspaceElements.gamePane.append(
    requireElement(".challenge"),
    requireElement(".tutorial"),
    requireElement(".controls"),
    requireElement(".world"),
  );
  workspaceElements.codePane.append(requireElement(".code"));
  mainRegion.append(workspaceElements.workspace);
  const workspaceController = presentWorkspaceLayout({
    elements: workspaceElements,
    root: document.documentElement,
    storage: localStorage,
  });

  // The app bar: `buildAppBarSkeleton` builds `<header class="appbar">` holding
  // the brand, and that replaces the `<header>` `index.html` ships whole. The
  // shipped one is a heading and nothing else now -- the tutorial link, the help
  // nav and the language picker that used to sit under it are each answered
  // elsewhere in this bar, as that file's own comment records -- and the brand
  // name the skeleton draws is itself an `<h1>`, so the document has exactly one
  // heading before this line and exactly one after it.
  //
  // The order is `design/ui-mockup.html`'s own: brand, `.task` level switcher,
  // `.barspace`, then the two trailing buttons `appBarSettingsTemplate` draws.
  // `.barspace` is the seam. Everything appended before it is pushed left and
  // everything after it right, so the run controls and the speed -- still drawn
  // into `.controls` under the building at this phase -- land in the bar by
  // being inserted ahead of it, with nothing else here having to move.
  // `levelSwitcherMount` is built rather than found; see its own declaration
  // above for why.
  let layoutMode: LayoutMode = readLayoutMode(localStorage);

  const { appBar } = buildAppBarSkeleton(document, { brandName: t("page.brand") });
  appBar.append(levelSwitcherMount);
  const barSpace = document.createElement("div");
  barSpace.className = "barspace";
  appBar.append(barSpace);
  appBar.insertAdjacentHTML("beforeend", appBarSettingsTemplate(app.currentSeedLink));
  requireElement("header").replaceWith(appBar);

  // `presentThemeSwitch`, composed inside `presentAppBarSettings`, never reads
  // `matchMedia` itself -- see its own module comment -- so the popover this
  // mounts is otherwise ignorant of the system theme changing under it.
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const settingsController = presentAppBarSettings(appBar, {
    root: document.documentElement,
    storage: localStorage,
    prefersDark: () => darkQuery.matches,
    initialLayoutMode: layoutMode,
    onSelectLayout: (mode) => {
      layoutMode = mode;
      workspaceController.setLayoutMode(mode);
    },
    redrawLanguage: () => {
      localisePage(document, navigator.userAgent);
      app.relocalise();
      docsModal.update();
      hotkeysModal.update();
      labelModifierKeys(hotkeysDialog, navigator.userAgent);
      settingsController.update();
    },
    seed: app.currentSeedLink,
    onOpenDocs: () => {
      docsModal.open();
    },
    onOpenHotkeys: () => {
      hotkeysModal.open();
    },
  });
  settingsControllerRef = settingsController;
  darkQuery.addEventListener("change", () => {
    settingsController.notifySystemThemeChange();
  });

  presentGlobalShortcuts({
    root: document,
    startStopButton: requireElement(".startstop"),
    startOverButton: requireElement(".startover"),
    settingsOpenButton: requireElement(".setopen"),
    onOpenDocs: () => {
      docsModal.open();
    },
    onCycleLayout: () => {
      layoutMode = NEXT_LAYOUT_MODE[layoutMode];
      workspaceController.setLayoutMode(layoutMode);
      settingsController.setActiveLayoutMode(layoutMode);
    },
  });
}

// Floating on purpose: an entry point has nobody above it to hand a promise to,
// and this one is asynchronous only because the first thing it does is wait for
// the reader's catalogue. Anything that throws afterwards surfaces as an
// unhandled rejection, which is the same console entry a throw from the old
// synchronous `main` produced.
void main();
