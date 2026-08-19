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

import { App, readStoredTimeScale } from "./app/app.ts";
import { describeFitnessResults, runFitnessSuite } from "./app/fitness.ts";
import { challenges } from "./game/challenges.ts";
import type { FitnessSuiteResult } from "./game/fitness.ts";
import { TICK_SECONDS, createWorldController } from "./game/world-controller.ts";
import { formatTime, t } from "./i18n/index.ts";
import { startRouter } from "./pages/game/model/route.ts";
import { CodeEditor, codeMirrorView } from "./ui/editor.ts";
import { applyStoredEditorHeight, presentEditorResize } from "./ui/editor-size.ts";
import { presentGlobalShortcuts } from "./ui/global-shortcuts.ts";
import { localisePage } from "./ui/localise-page.ts";
import { applyPreferredLocale } from "./ui/preferred-locale.ts";
import { labelModifierKeys } from "./ui/shortcuts.ts";
import { presentVersion } from "./ui/version.ts";
import { DEFAULT_TIME_SCALE } from "#features/adjust-speed/model/time-scale.ts";
import { docsModalTemplate, presentDocsModal } from "#features/docs-reference/index.ts";
import { hotkeysModalTemplate, presentHotkeysModal } from "#features/hotkeys-help/index.ts";
import { DEFAULT_CODE_SLOT } from "#features/manage-code-slots/model/code-slots.ts";
import { presentLanguagePicker } from "#features/switch-language/index.ts";
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
     * opt-in: call it from the browser console and the answer appears in the
     * status line under the editor.
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
  // platform, which used to be a call of its own here: the hint is one of the
  // messages the shell holds, so rewriting it and relabelling it belong
  // together and cannot be left in an order this file happens to get right.
  await applyPreferredLocale(document, navigator.userAgent);
  presentVersion();

  // Ahead of the editor rather than after it, because a player who left the
  // editor tall should find it tall rather than watch it grow: the height is on
  // `<html>` before CodeMirror measures anything, so there is one layout instead
  // of two and nothing for the eye to catch.
  applyStoredEditorHeight(document.documentElement, localStorage);

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

  // After it, because the grip measures the box it resizes, and there is no box
  // until CodeMirror has mounted one.
  presentEditorResize({
    handle: requireElement("#editor_resize"),
    editor: requireElement(".cm-editor"),
    root: document.documentElement,
    storage: localStorage,
  });
  const saveMessage = requireElement("#save_message");
  const fitnessMessage = requireElement("#fitness_message");

  editor.on("saved", (savedAt) => {
    // `Date.prototype.toTimeString` wrote "21:03:57 GMT+0300 (Moscow Standard
    // Time)", which is a debugging format in one language pretending to be a
    // timestamp in every other. `formatTime` is `Intl.DateTimeFormat` with
    // `timeStyle: "medium"`, so the line now ends where a reader expects it to.
    saveMessage.textContent = t("editor.saved", { time: formatTime(savedAt) });
    saveMessage.classList.remove("refused");
  });
  // The other half of that line, and the reason `storage_refused` exists at
  // all: until this, the event was raised by every refused write in the editor
  // and listened to by nothing, so a store that had stopped taking programs
  // said so nowhere on the page. The visible cost was "Reset code" -- refused,
  // it leaves the program exactly where it was and used to look indis-
  // tinguishable from a button that does not work -- but the silence was worse
  // between resets, where a player types all afternoon under a line reading
  // "Code saved 14:32" from the last write that happened to fit.
  //
  // `aria-live="polite"` is already on the paragraph for the save line, so this
  // is announced as well as shown, and the two cannot contradict each other:
  // `saved` is raised only for a write that reached the store.
  editor.on("storage_refused", () => {
    saveMessage.textContent = t("editor.storageRefused");
    saveMessage.classList.add("refused");
  });
  editor.on("change", () => {
    // The measurement on show no longer describes the program in the editor.
    fitnessMessage.classList.add("faded");
    // `canUndoReset` answers for the program on screen, so typing moves it as
    // surely as pressing Reset does: without this, the pane would go on
    // offering to undo a reset the player has already typed over.
    editorPane.update();
  });

  // The four buttons that used to be wired here -- Save, Apply, Reset and Undo
  // reset -- are run controls and editor-pane tools now, drawn and driven by
  // the app and this file respectively; see `presentControls` in
  // `src/ui/presenters.ts` and `editorPane` above. Save has no successor: the
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
      tutorialLink: requireElement(".tutoriallink"),
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

  // Wired after the app exists, because changing the language has to redraw what
  // the app has already drawn. The two halves of that are deliberately separate:
  // `localisePage` rewrites the shell, which it does by re-reading the document,
  // and `App.relocalise` rewrites the game -- the challenge bar, the statistics
  // figures, the building's accessible names and the end-of-challenge overlay --
  // without tearing down the run in progress.
  const languagePicker = requireElement(".languagepicker");
  if (!(languagePicker instanceof HTMLSelectElement)) {
    throw new TypeError("Expected .languagepicker to be a <select>");
  }
  presentLanguagePicker({
    select: languagePicker,
    storage: localStorage,
    redraw: () => {
      localisePage(document, navigator.userAgent);
      app.relocalise();
    },
  });

  window.runFitnessSuite = async (codeStr = editor.getCode()): Promise<FitnessSuiteResult> => {
    fitnessMessage.classList.add("faded");
    fitnessMessage.textContent = t("fitness.measuring");
    const results = await runFitnessSuite(codeStr);
    fitnessMessage.textContent = describeFitnessResults(results);
    fitnessMessage.classList.remove("faded");
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
  // and hotkeys dialogs, the workspace's two panes -- holding the ten regions
  // above exactly as they were, one level deeper -- the app bar that replaces
  // `.header`, and the shortcuts that tie all of it together. Ordered so that
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
  // the eight regions `<main>` held directly until now, in the order it held
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
  workspaceElements.codePane.append(
    requireElement(".code"),
    requireElement(".editorresize"),
    requireElement(".hint"),
    requireElement(".editorstatus"),
  );
  mainRegion.append(workspaceElements.workspace);
  const workspaceController = presentWorkspaceLayout({
    elements: workspaceElements,
    root: document.documentElement,
    storage: localStorage,
  });

  // The app bar: `buildAppBarSkeleton` already builds `<header class="appbar">`
  // holding the brand, so that becomes the new header -- `.header` stays on it
  // too, since `e2e/language-picker.spec.ts`, `e2e/documentation.spec.ts` and
  // `e2e/reflow.spec.ts` all still look a live page up by that class. The old
  // header's own `<h1>` is kept rather than replaced -- only its two children
  // (`page.brand`, `page.tagline`) are swapped for the brand mark and name --
  // so the page never holds two, and every heading-role assertion across the
  // e2e suite keeps finding the one it always has. `.headertools` moves in
  // whole: `.tutoriallink` and the old Help/Documentation/Wiki nav and
  // language picker keep running unchanged, beside the new bar. `levelSwitcherMount`
  // goes in between the two, matching the mockup's own brand-then-`.task` order
  // -- see its own declaration above for why it was built rather than found.
  let layoutMode: LayoutMode = readLayoutMode(localStorage);

  const { appBar, brand } = buildAppBarSkeleton(document, { brandName: t("page.brand") });
  appBar.classList.add("header");

  const oldHeader = requireElement(".header");
  const oldH1 = requireElement("h1", oldHeader);
  oldH1.replaceChildren(brand);
  appBar.prepend(oldH1);
  appBar.append(levelSwitcherMount);
  appBar.append(requireElement(".headertools", oldHeader));
  appBar.insertAdjacentHTML("beforeend", appBarSettingsTemplate(app.currentSeedLink));
  oldHeader.replaceWith(appBar);

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
