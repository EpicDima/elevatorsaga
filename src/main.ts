/** The entry point: builds the game out of its parts and starts it. */

import "./styles/index.css";

import { describeFitnessResults, runFitnessSuite } from "./app/fitness.ts";
import { chapter1Levels } from "./game/chapter1.ts";
import type { FitnessSuiteResult } from "./game/fitness.ts";
import { TICK_SECONDS, createWorldController } from "./game/world-controller.ts";
import { t } from "./i18n/index.ts";
import { App, readStoredTimeScale } from "./pages/game/index.ts";
import { startRouter } from "./pages/game/model/route.ts";
import { CodeEditor, codeMirrorView } from "./ui/editor.ts";
import { presentGlobalShortcuts } from "./ui/global-shortcuts.ts";
import { localizePage } from "./ui/localize-page.ts";
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
  presentStageColumn,
  presentWorkspaceLayout,
  readLayoutMode,
  type LayoutMode,
  type StageColumnController,
} from "#widgets/workspace-layout/index.ts";

/**
 * Where Ctrl-B / Cmd-B takes the workspace next: a ring over the switcher's button order.
 *
 * Written as a `Record`, not an array and a modulo, so every lookup is typed as returning a
 * mode rather than `LayoutMode | undefined` under `noUncheckedIndexedAccess`.
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
     * Opt-in, called from the browser console: there's no status line under the editor to
     * print the answer into.
     */
    runFitnessSuite: (codeStr?: string) => Promise<FitnessSuiteResult>;
  }
}

/** Builds the game and starts it. */
async function main(): Promise<void> {
  // Awaited before anything is drawn, so the shell and the game are never in two languages
  // at once. Also relabels the shortcut keys for the platform, since a `<kbd data-mod-key>`
  // can sit inside a message the shell rewrites — rewriting and relabeling must stay together.
  await applyPreferredLocale(document, navigator.userAgent);

  // The editor pane's chrome must exist before CodeMirror mounts into it, but the callbacks
  // below need `editor`/`app`, which don't exist yet. Two mutable cells break the circle: the
  // callbacks close over `editorRef`/`appRef` and are filled in once each object is built.
  // eslint-disable-next-line prefer-const -- assigned once, below the closures that read it.
  let editorRef: CodeEditor | undefined;
  // eslint-disable-next-line prefer-const -- see editorRef, just above.
  let appRef: App | undefined;
  // `App` runs its first route well before `presentAppBarSettings` exists to receive
  // `onSeedChange`. Same cell, same reason.
  // eslint-disable-next-line prefer-const -- see editorRef, above.
  let settingsControllerRef: AppBarSettingsController | undefined;
  // The router runs its first route before the column that scrolls exists. Same cell, same reason.
  // eslint-disable-next-line prefer-const -- see editorRef, above.
  let stageColumnRef: StageColumnController | undefined;

  const editorPane = presentEditorPane(requireElement(".code"), {
    currentSlot: () => appRef?.currentCodeSlot ?? DEFAULT_CODE_SLOT,
    onSelectSlot: (slot) => {
      appRef?.selectCodeSlot(slot);
    },
    onResetCode: () => {
      if (editorRef === undefined) {
        return;
      }
      if (window.confirm(t("editor.confirmReset"))) {
        editorRef.reset();
      }
      editorRef.focus();
    },
    onGotoLine: (line) => {
      if (editorRef === undefined) {
        return;
      }
      // `column: 1` is synthetic: markError wants both line and column, but this pane only
      // ever locates a line. A wrong column here would just draw a shorter underline, not a
      // wrong jump — the view itself moves via markError's own scrollIntoView.
      editorRef.markError({ line, column: 1 });
      editorRef.focus();
    },
  });

  const editor = new CodeEditor(codeMirrorView(editorPane.editorMount));
  editorRef = editor;

  const storageStatus = requireElement("#storage_status");

  // Without this, a full quota fails silently: the player keeps typing, believing the work
  // is being saved.
  editor.on("storage_refused", () => {
    storageStatus.textContent = t("editor.storageRefused");
  });
  // Clears the warning rather than confirming success: a full quota isn't permanent, and a
  // stale warning after writes resume would tell the player their work is at risk when it
  // isn't.
  editor.on("saved", () => {
    storageStatus.textContent = "";
  });

  // preventDefault stops two things: default focus, which belongs inside CodeMirror, and
  // navigation — the hash is the router's, so following `#code` would drop `level=` and
  // restart the player on the first level.
  requireElement(".skip-link").addEventListener("click", (event) => {
    event.preventDefault();
    editor.focus();
  });

  // Built here rather than found by requireElement: the app bar it belongs in isn't
  // assembled until further down, but App's constructor only needs to write into it and
  // wire listeners, not have it on screen yet.
  const levelSwitcherMount = document.createElement("div");
  levelSwitcherMount.className = "levelswitcher";

  const app = new App({
    elements: {
      controls: requireElement(".controls"),
      tutorial: requireElement(".tutorial"),
      levelSwitcher: levelSwitcherMount,
      goalBar: requireElement(".level"),
      world: requireElement(".innerworld"),
      stats: requireElement(".statscontainer"),
      feedback: requireElement(".feedbackcontainer"),
    },
    editor,
    editorPane,
    worldController: createWorldController(TICK_SECONDS),
    chapter1Levels,
    onSeedChange: (seed) => {
      settingsControllerRef?.setSeed(seed);
    },
  });
  appRef = app;

  window.runFitnessSuite = async (codeStr = editor.getCode()): Promise<FitnessSuiteResult> => {
    // Printed as well as returned: the console already shows the resolved value, so this is
    // the formatted sentence that would otherwise be lost. The "measuring" line exists
    // because the benchmark takes seconds and would otherwise look like it did nothing.
    console.info(t("fitness.measuring"));
    const results = await runFitnessSuite(codeStr);
    console.info(describeFitnessResults(results));
    return results;
  };

  startRouter(
    (params, query) => {
      app.handleRoute(params, query);
      // The column is still parked where the level before left it, which on a taller
      // building is nowhere near the same place.
      stageColumnRef?.park();
    },
    {
      chapter1LevelCount: chapter1Levels.length,
      defaultTimeScale: () => readStoredTimeScale(localStorage) ?? DEFAULT_TIME_SCALE,
    },
  );

  // Order matters: dialogs first since nothing depends on them, the workspace next since the
  // app bar's settings need its setLayoutMode, the app bar third since it needs the workspace
  // and the dialogs, shortcuts last since they call into all three.

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

  // Moving an already-mounted element with `append` reparents it without tearing anything
  // down, CodeMirror included. `.stagearea` is deliberately not `.stage`/`.stagerow`, which
  // building-stage rebuilds on every redraw — a panel living there would be thrown away
  // mid-lesson.
  const mainRegion = requireElement("main");
  const workspaceElements = buildWorkspaceLayoutSkeleton(document, {
    gamePane: t("game.workspace.gamePane"),
    codePane: t("game.workspace.codePane"),
    splitter: t("game.workspace.splitter"),
  });
  // Held rather than looked up twice: appending to the detached column takes the card out of
  // the document, so a second `requireElement` would find nothing.
  const lessonCard = requireElement(".tutorial");
  const stageArea = document.createElement("div");
  stageArea.className = "stagearea";
  stageArea.append(lessonCard, requireElement(".world"));
  const stageColumn = presentStageColumn({ column: stageArea, lesson: lessonCard });
  stageColumnRef = stageColumn;

  // A lesson, or a building taller than the pane, puts the lobby below the fold, so a run
  // started from up the column would move elevators nobody can see. Only on the pause-to-
  // running edge, so changing speed mid-run doesn't drag the column away from what is being read.
  let running = false;
  app.worldController.on("timescale_changed", () => {
    const nowRunning = !app.worldController.isPaused;
    if (nowRunning && !running) {
      stageColumn.showGround();
    }
    running = nowRunning;
  });
  workspaceElements.gamePane.append(
    requireElement(".level"),
    stageArea,
    requireElement(".statscontainer"),
  );
  workspaceElements.codePane.append(requireElement(".code"));
  mainRegion.append(workspaceElements.workspace);
  const workspaceController = presentWorkspaceLayout({
    elements: workspaceElements,
    root: document.documentElement,
    storage: localStorage,
  });
  // The first route ran before any of this existed, and the panes it measures are only now
  // laid out — so the opening park is done here rather than from the router's callback.
  stageColumn.park();

  // `.barspace` is the seam: everything appended before it is pushed left, everything after
  // it right. `.controls` is reparented, not rebuilt — it was already drawn and wired in the
  // App constructor and is the one region the app never redraws.
  let layoutMode: LayoutMode = readLayoutMode(localStorage);

  const { appBar } = buildAppBarSkeleton(document, { brandName: t("page.brand") });
  appBar.append(levelSwitcherMount, requireElement(".controls"));
  const barSpace = document.createElement("div");
  barSpace.className = "barspace";
  appBar.append(barSpace);
  appBar.insertAdjacentHTML("beforeend", appBarSettingsTemplate(app.currentSeedLink));
  requireElement("header").replaceWith(appBar);

  // presentThemeSwitch never reads matchMedia itself, so this popover would otherwise miss
  // the system theme changing under it.
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
      localizePage(document, navigator.userAgent);
      app.relocalize();
      docsModal.update();
      hotkeysModal.update();
      labelModifierKeys(hotkeysDialog, navigator.userAgent);
      settingsController.update();
    },
    seed: app.currentSeedLink,
    onSeed: (seed) => {
      app.playSeed(seed);
    },
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

// Floating on purpose: an entry point has nobody above it to hand a promise to. Anything
// that throws afterward surfaces as an unhandled rejection.
void main();
