/**
 * Renders the learning track's panel from a level index, looking prose up
 * from the catalog at draw time so a language change redraws it correctly.
 */

import { tutorialLevels } from "#game/tutorial.ts";
import { t, type MessageKey } from "#i18n/index.ts";
import { query, queryAll, requireElement } from "#shared/lib/dom.ts";
import { markup, raw, renderElement } from "#shared/ui/markup.ts";

import { highlightJavaScript } from "../../../ui/code-highlight.ts";
import { changedLines } from "../../../ui/line-diff.ts";

/** Every level's title-message key, read off {@link MessageKey}. */
type TutorialTitleKey = Extract<MessageKey, `tutorial.level${number}.title`>;

/** A title key's level id, e.g. `tutorial.level3.title` to `tutorial-3`. */
type LevelIdOf<K> = K extends `tutorial.level${infer N extends number}.title`
  ? `tutorial-${N}`
  : never;

/** The ids of the levels the catalog describes. */
type TutorialLevelId = LevelIdOf<TutorialTitleKey>;

/** The four things the catalog says about one level. */
interface TutorialLevelMessages {
  /** Its name. */
  readonly title: MessageKey;
  /** What it asks the player to do. */
  readonly goal: MessageKey;
  /** Its three hints, from a nudge to the answer. */
  readonly hints: readonly [MessageKey, MessageKey, MessageKey];
  /** Why the level behaves the way it does, read after it is cleared. */
  readonly explanation: MessageKey;
}

/**
 * Which messages describe which level, keyed by level id rather than position
 * in `tutorialLevels` — a level inserted between two others would otherwise
 * misalign a positional table's rows.
 */
const TUTORIAL_LEVEL_MESSAGES = {
  "tutorial-1": {
    title: "tutorial.level1.title",
    goal: "tutorial.level1.goal",
    hints: [
      "tutorial.level1.hint1.html",
      "tutorial.level1.hint2.html",
      "tutorial.level1.hint3.html",
    ],
    explanation: "tutorial.level1.explanation.html",
  },
  "tutorial-2": {
    title: "tutorial.level2.title",
    goal: "tutorial.level2.goal",
    hints: [
      "tutorial.level2.hint1.html",
      "tutorial.level2.hint2.html",
      "tutorial.level2.hint3.html",
    ],
    explanation: "tutorial.level2.explanation.html",
  },
  "tutorial-3": {
    title: "tutorial.level3.title",
    goal: "tutorial.level3.goal",
    hints: [
      "tutorial.level3.hint1.html",
      "tutorial.level3.hint2.html",
      "tutorial.level3.hint3.html",
    ],
    explanation: "tutorial.level3.explanation.html",
  },
  "tutorial-4": {
    title: "tutorial.level4.title",
    goal: "tutorial.level4.goal",
    hints: [
      "tutorial.level4.hint1.html",
      "tutorial.level4.hint2.html",
      "tutorial.level4.hint3.html",
    ],
    explanation: "tutorial.level4.explanation.html",
  },
  "tutorial-5": {
    title: "tutorial.level5.title",
    goal: "tutorial.level5.goal",
    hints: [
      "tutorial.level5.hint1.html",
      "tutorial.level5.hint2.html",
      "tutorial.level5.hint3.html",
    ],
    explanation: "tutorial.level5.explanation.html",
  },
  "tutorial-6": {
    title: "tutorial.level6.title",
    goal: "tutorial.level6.goal",
    hints: [
      "tutorial.level6.hint1.html",
      "tutorial.level6.hint2.html",
      "tutorial.level6.hint3.html",
    ],
    explanation: "tutorial.level6.explanation.html",
  },
  "tutorial-7": {
    title: "tutorial.level7.title",
    goal: "tutorial.level7.goal",
    hints: [
      "tutorial.level7.hint1.html",
      "tutorial.level7.hint2.html",
      "tutorial.level7.hint3.html",
    ],
    explanation: "tutorial.level7.explanation.html",
  },
  "tutorial-8": {
    title: "tutorial.level8.title",
    goal: "tutorial.level8.goal",
    hints: [
      "tutorial.level8.hint1.html",
      "tutorial.level8.hint2.html",
      "tutorial.level8.hint3.html",
    ],
    explanation: "tutorial.level8.explanation.html",
  },
} as const satisfies Readonly<Record<TutorialLevelId, TutorialLevelMessages>>;

/** Selector for the drawn panel. */
const PANEL_SELECTOR = ".tutorialpanel";

/** Records which level the panel was drawn for, since it keeps no other state between redraws. */
const LEVEL_INDEX_ATTRIBUTE = "data-level-index";

/** The four disclosures, in the order they are drawn: three hints, then why. */
const DISCLOSURE_SELECTOR = ".tutorialhint, .tutorialexplanation";

/** Every control a player might be focused on when the panel redraws. */
const CONTROL_SELECTOR = ".tutorialpanel summary, .tutorialpanel button";

/** The button that copies the level's answer to the clipboard. */
const COPY_CODE_SELECTOR = ".tutorialcopycode";

/** The line reporting whether that copy succeeded; drawn empty, filled in on click. */
const COPIED_SELECTOR = ".tutorialcopied";

/**
 * Copy-result token stored on the markup rather than kept in a variable, so it
 * survives a redraw and can be re-translated rather than left in the old language.
 */
const COPIED_STATE_ATTRIBUTE = "data-copied";

/** Sentences for each copy outcome. */
const COPIED_MESSAGES = {
  yes: "tutorial.solution.copied",
  no: "tutorial.solution.copyFailed",
} as const satisfies Readonly<Record<string, MessageKey>>;

/** The answers {@link COPIED_MESSAGES} has a sentence for. */
type CopiedState = keyof typeof COPIED_MESSAGES;

/** Parses a drawn panel's copy-line state, if it recorded one. */
function copiedStateOf(value: string | null): CopiedState | undefined {
  return value === "yes" || value === "no" ? value : undefined;
}

/**
 * Copies the level's answer to the clipboard and reports whether it worked.
 *
 * `navigator.clipboard` can be missing (insecure context, jsdom) or reject the
 * write; both funnel through one catch.
 */
async function copySolution(parent: HTMLElement): Promise<void> {
  const code = requireElement(".tutorialsolution code", parent).textContent;
  let copied: boolean;
  try {
    await navigator.clipboard.writeText(code);
    copied = true;
  } catch {
    copied = false;
  }
  const state: CopiedState = copied ? "yes" : "no";
  const line = requireElement(COPIED_SELECTOR, parent);
  line.setAttribute(COPIED_STATE_ATTRIBUTE, state);
  line.textContent = t(COPIED_MESSAGES[state]);
}

/** What the panel needs in order to draw itself. */
export interface TutorialPanelData {
  /** Zero-based index into `tutorialLevels`. */
  readonly levelIndex: number;
}

/** Whether `value` is a level id the catalog has prose for. */
function isLevelId(value: string): value is TutorialLevelId {
  return Object.hasOwn(TUTORIAL_LEVEL_MESSAGES, value);
}

/** Everything the learning track's panel needs in order to render itself. */
export interface TutorialTemplateData {
  /** One-based level number; written into the markup so a redraw can tell the level apart. */
  readonly levelNumber: number;
  /** The level's name. Text, written escaped. */
  readonly title: string;
  /** What the level asks the player for. Text, written escaped. */
  readonly goal: string;
  /**
   * Three hints in order; trusted HTML from the catalog. Must stay a triple
   * since the answer prints beneath the last one.
   */
  readonly hints: readonly [string, string, string];
  /** Never printed; diffed against {@link TutorialTemplateData.solutionCode} to mark changed lines. */
  readonly startingCode: string;
  /**
   * The program that clears the level. Highlighted rather than escaped by
   * {@link markup}, since `highlightJavaScript` escapes each token itself.
   */
  readonly solutionCode: string;
  /** Why the level behaves as it does; trusted HTML, shown after the answer. */
  readonly explanation: string;
}

/** The two programs {@link tutorialAnswerTemplate} needs: what changed, and against what. */
interface TutorialAnswerData {
  /** The program the level starts the player with; see {@link changedLines}. */
  readonly startingCode: string;
  /** The program that clears the level, which is what gets shown and copied. */
  readonly solutionCode: string;
}

/**
 * The answer block: the solution, highlighted with its changed lines marked,
 * plus a copy button. Uses `raw()` since `highlightJavaScript` already escapes
 * each token itself.
 */
function tutorialAnswerTemplate(answer: TutorialAnswerData): string {
  const highlighted = highlightJavaScript(
    answer.solutionCode,
    changedLines(answer.startingCode, answer.solutionCode),
  );
  return markup`<div class="tutorialanswer"><div class="tutorialanswertools"><button type="button" class="tutorialcopycode">${t("tutorial.solution.copy")}</button><p class="tutorialcopied" aria-live="polite"></p></div><pre class="tutorialsolution"><code>${raw(highlighted)}</code></pre></div>`;
}

/**
 * A prose message as the paragraphs it is written in, split on the blank
 * lines it separates them with. A message with none is one paragraph.
 */
function tutorialProseTemplate(prose: string): string {
  return prose
    .split("\n\n")
    .map((paragraph) => markup`<p class="tutorialprose">${raw(paragraph)}</p>`)
    .join("");
}

/**
 * One hint as a native `<details>` disclosure, closed by default so the
 * answer under the last hint isn't shown before the player reads the goal.
 */
function tutorialHintTemplate(
  number: number,
  hint: string,
  answer: TutorialAnswerData | null,
): string {
  const drawnAnswer = answer === null ? "" : tutorialAnswerTemplate(answer);
  return markup`<details class="tutorialhint"><summary>${t("tutorial.panel.hintSummary", { number })}</summary>${raw(tutorialProseTemplate(hint))}${raw(drawnAnswer)}</details>`;
}

/**
 * The tutorial panel: title, goal, hints and the explanation, as one named
 * `<section>` landmark (WCAG 1.3.1) labeled by the level's own title.
 */
export function tutorialTemplate(data: TutorialTemplateData): string {
  const hints = data.hints
    .map((hint, index) =>
      tutorialHintTemplate(
        index + 1,
        hint,
        index === data.hints.length - 1
          ? { startingCode: data.startingCode, solutionCode: data.solutionCode }
          : null,
      ),
    )
    .join("");
  // Level index is the one piece of state the panel remembers about itself,
  // read back by presentTutorial from the old markup before it is replaced.
  return markup`<section class="tutorialpanel" data-level-index="${data.levelNumber - 1}" aria-label="${data.title}"><h2 class="tutorialtitle">${data.title}</h2><p class="tutorialgoal">${data.goal}</p>${raw(hints)}<details class="tutorialexplanation"><summary>${t("tutorial.panel.explanationSummary")}</summary>${raw(tutorialProseTemplate(data.explanation))}</details></section>`;
}

/**
 * Draws the tutorial panel and wires up its copy button, replacing any panel
 * already there while preserving which hints were open and where focus was —
 * both only across a redraw of the *same* level (WCAG 2.4.3).
 *
 * @throws {RangeError} The track has no level at `data.levelIndex`.
 * @throws {Error} The level exists but the catalog has no prose for it.
 */
export function presentTutorial(parent: HTMLElement, data: TutorialPanelData): void {
  const level = tutorialLevels[data.levelIndex];
  const levelNumber = data.levelIndex + 1;
  if (level === undefined) {
    // Worded like `App.startTutorial`'s own RangeError for the same failure.
    throw new RangeError(`No tutorial level with index ${String(data.levelIndex)}`);
  }
  if (!isLevelId(level.id)) {
    throw new Error(`No panel prose for tutorial level ${level.id}`);
  }
  const messages = TUTORIAL_LEVEL_MESSAGES[level.id];
  const [hint1, hint2, hint3] = messages.hints;

  const drawn = query(PANEL_SELECTOR, parent);
  const sameLevel = drawn?.getAttribute(LEVEL_INDEX_ATTRIBUTE) === String(data.levelIndex);
  const wasOpen = sameLevel
    ? queryAll(DISCLOSURE_SELECTOR, parent).map(
        (disclosure) => disclosure instanceof HTMLDetailsElement && disclosure.open,
      )
    : [];
  const focusedControl = queryAll(CONTROL_SELECTOR, parent).findIndex(
    (control) => control === document.activeElement,
  );
  // Dropped on a level change, since a different answer is on the button by then.
  const copiedState = sameLevel
    ? copiedStateOf(query(COPIED_SELECTOR, parent)?.getAttribute(COPIED_STATE_ATTRIBUTE) ?? null)
    : undefined;

  const panel = renderElement(
    tutorialTemplate({
      levelNumber,
      title: t(messages.title),
      goal: t(messages.goal),
      hints: [t(hint1), t(hint2), t(hint3)],
      // From the level table, not the catalog: this is the exact code
      // `tutorial-solutions.test.ts` proves clears the level.
      startingCode: level.startingCode,
      solutionCode: level.solutionCode,
      explanation: t(messages.explanation),
    }),
  );

  if (copiedState !== undefined) {
    // Set while still detached, so it's a restoration, not a fresh announcement
    // from a live region that's already in the document.
    const line = requireElement(COPIED_SELECTOR, panel);
    line.setAttribute(COPIED_STATE_ATTRIBUTE, copiedState);
    line.textContent = t(COPIED_MESSAGES[copiedState]);
  }
  parent.replaceChildren(panel);

  queryAll(DISCLOSURE_SELECTOR, parent).forEach((disclosure, index) => {
    if (wasOpen[index] === true && disclosure instanceof HTMLDetailsElement) {
      disclosure.open = true;
    }
  });

  requireElement(COPY_CODE_SELECTOR, parent).addEventListener("click", () => {
    void copySolution(parent);
  });

  // -1 (focus was elsewhere) indexes to undefined, so focus moves only if the
  // panel itself had it.
  queryAll(CONTROL_SELECTOR, parent)[focusedControl]?.focus();
}
