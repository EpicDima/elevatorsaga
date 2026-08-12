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
 */

import "@fontsource/oswald/latin-400.css";
import "@fontsource/oswald/latin-700.css";
import "./styles/style.css";

import { App, readStoredTimeScale } from "./app/app.ts";
import { describeFitnessResults, runFitnessSuite } from "./app/fitness.ts";
import { startRouter } from "./app/router.ts";
import { DEFAULT_TIME_SCALE } from "./app/time-scale.ts";
import { challenges } from "./game/challenges.ts";
import type { FitnessSuiteResult } from "./game/fitness.ts";
import { createWorldController } from "./game/world-controller.ts";
import { formatTime, t } from "./i18n/index.ts";
import { requireElement } from "./ui/dom.ts";
import { CodeEditor, codeMirrorView } from "./ui/editor.ts";
import { presentEditorSize } from "./ui/editor-size.ts";
import { presentLanguagePicker } from "./ui/language-picker.ts";
import { localisePage } from "./ui/localise-page.ts";
import { applyPreferredLocale } from "./ui/preferred-locale.ts";
import { presentVersion } from "./ui/version.ts";

declare global {
  interface Window {
    /**
     * Benchmarks a program over a few headless scenarios, in a worker.
     *
     * The legacy `fitness.js` exposed `fitnessSuite` as a global for the same
     * purpose, and its only call site was commented out because running the
     * benchmark after every keystroke was too slow to be useful. It stays
     * opt-in: call it from the browser console and the answer appears next to
     * the Save button.
     */
    runFitnessSuite: (codeStr?: string) => Promise<FitnessSuiteResult>;
  }
}

/** Largest simulated step, in seconds; the legacy value. */
const MAX_STEP_SECONDS = 1.0 / 60.0;

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

  // Ahead of the editor rather than beside the other buttons below, because a
  // player who left it expanded should find it expanded rather than watch it
  // grow: the height is on `<html>` before CodeMirror measures anything, so
  // there is one layout instead of two and nothing for the eye to catch.
  const expandButton = requireElement("#button_expand");
  if (!(expandButton instanceof HTMLButtonElement)) {
    throw new TypeError("Expected #button_expand to be a <button>");
  }
  presentEditorSize({
    button: expandButton,
    root: document.documentElement,
    storage: localStorage,
  });

  const editor = new CodeEditor(codeMirrorView(requireElement(".code")));
  const saveMessage = requireElement("#save_message");
  const fitnessMessage = requireElement("#fitness_message");

  editor.on("saved", (savedAt) => {
    // `Date.prototype.toTimeString` wrote "21:03:57 GMT+0300 (Moscow Standard
    // Time)", which is a debugging format in one language pretending to be a
    // timestamp in every other. `formatTime` is `Intl.DateTimeFormat` with
    // `timeStyle: "medium"`, so the line now ends where a reader expects it to.
    saveMessage.textContent = t("editor.saved", { time: formatTime(savedAt) });
  });
  editor.on("change", () => {
    // The measurement on show no longer describes the program in the editor.
    fitnessMessage.classList.add("faded");
  });

  requireElement("#button_save").addEventListener("click", () => {
    editor.save();
    editor.focus();
  });
  requireElement("#button_reset").addEventListener("click", () => {
    if (window.confirm(t("editor.confirmReset"))) {
      editor.reset();
    }
    editor.focus();
  });
  requireElement("#button_resetundo").addEventListener("click", () => {
    if (window.confirm(t("editor.confirmUndoReset"))) {
      editor.undoReset();
    }
    editor.focus();
  });
  requireElement("#button_apply").addEventListener("click", () => {
    editor.trigger("apply_code");
  });

  // The skip link. Two things have to be taken off the browser: the focus,
  // which belongs inside CodeMirror rather than on the `<div>` it mounts into,
  // and the navigation -- the hash is the router's, so following `#code` would
  // throw away `challenge=` and `timescale=` and restart the player on the
  // first challenge. The `href` stays for the sake of being a real link.
  requireElement(".skip-link").addEventListener("click", (event) => {
    event.preventDefault();
    editor.focus();
  });

  const app = new App({
    elements: {
      challenge: requireElement(".challenge"),
      tutorial: requireElement(".tutorial"),
      tutorialLink: requireElement(".tutoriallink"),
      world: requireElement(".innerworld"),
      stats: requireElement(".statscontainer"),
      feedback: requireElement(".feedbackcontainer"),
      codeStatus: requireElement(".codestatus"),
    },
    editor,
    worldController: createWorldController(MAX_STEP_SECONDS),
    challenges,
  });

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
}

// Floating on purpose: an entry point has nobody above it to hand a promise to,
// and this one is asynchronous only because the first thing it does is wait for
// the reader's catalogue. Anything that throws afterwards surfaces as an
// unhandled rejection, which is the same console entry a throw from the old
// synchronous `main` produced.
void main();
