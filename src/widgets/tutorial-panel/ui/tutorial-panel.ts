/**
 * Renders the learning track's panel from a level index, looking prose up
 * from the catalog at draw time so a language change redraws it correctly.
 */

import { tutorialLevels } from "#game/tutorial.ts";
import { t, type MessageKey } from "#i18n/index.ts";
import { query, queryAll, requireElement } from "#shared/lib/dom.ts";
import { createSpriteIcon, spriteIconMarkup, type SpriteIconName } from "#shared/ui/icon.ts";
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

/** The icon button that copies the level's answer, drawn on the code block itself. */
const COPY_CODE_SELECTOR = ".tutorialcopycode";

/** The answer as it is printed, which is exactly what the button copies. */
const SOLUTION_CODE_SELECTOR = ".tutorialsolution code";

/** Where the outcome is announced; visually hidden, since the button's own mark shows it. */
const COPIED_SELECTOR = ".tutorialcopied";

/** Which mark the button is wearing, and the hook the tint and the pop hang off. */
const COPIED_STATE_ATTRIBUTE = "data-copied";

/** How long that mark stays before the button is a copy button again. */
const COPIED_FLASH_MS = 2000;

/** Per outcome: the mark drawn on the button, and the sentence announced behind it. */
const COPY_OUTCOMES = {
  yes: { icon: "check", message: "tutorial.solution.copied" },
  no: { icon: "x", message: "tutorial.solution.copyFailed" },
} as const satisfies Readonly<Record<string, { icon: SpriteIconName; message: MessageKey }>>;

/** The outcomes {@link COPY_OUTCOMES} has a mark for. */
type CopiedState = keyof typeof COPY_OUTCOMES;

/**
 * Copies the answer, saying which way it went rather than throwing.
 *
 * `navigator.clipboard` can be missing (insecure context, jsdom) or reject the
 * write; both funnel through one catch.
 */
async function copyToClipboard(code: string): Promise<CopiedState> {
  try {
    await navigator.clipboard.writeText(code);
    return "yes";
  } catch {
    return "no";
  }
}

/** Puts the mark, the name and the announcement on the button together, since all three say the same thing. */
function markCopyButton(button: HTMLElement, announcement: HTMLElement, state: CopiedState): void {
  const { icon, message } = COPY_OUTCOMES[state];
  button.setAttribute(COPIED_STATE_ATTRIBUTE, state);
  button.firstElementChild?.replaceWith(createSpriteIcon(icon));
  button.title = t(message);
  button.setAttribute("aria-label", t(message));
  announcement.textContent = t(message);
}

/** Takes all three back off, leaving a plain copy button. */
function unmarkCopyButton(button: HTMLElement, announcement: HTMLElement): void {
  const name = t("tutorial.solution.copy");
  button.removeAttribute(COPIED_STATE_ATTRIBUTE);
  button.firstElementChild?.replaceWith(createSpriteIcon("copy"));
  button.title = name;
  button.setAttribute("aria-label", name);
  announcement.textContent = "";
}

/**
 * Wires the copy button: it wears the outcome for {@link COPIED_FLASH_MS} and
 * then goes back to being a copy button. The mark is the whole visible report,
 * so nothing is left standing beside the answer once it has been read.
 */
function wireCopyButton(parent: HTMLElement): void {
  const button = requireElement(COPY_CODE_SELECTOR, parent);
  const announcement = requireElement(COPIED_SELECTOR, parent);
  let flash: ReturnType<typeof setTimeout> | undefined;

  /** Copies, marks the button with what happened, and unmarks it a moment later. */
  async function copyAndReport(): Promise<void> {
    clearTimeout(flash);
    // Cleared before the write, not only restored after the mark: a live region
    // announces a change, so the same sentence twice running would be silent.
    unmarkCopyButton(button, announcement);
    markCopyButton(
      button,
      announcement,
      await copyToClipboard(requireElement(SOLUTION_CODE_SELECTOR, parent).textContent),
    );
    flash = setTimeout(() => {
      unmarkCopyButton(button, announcement);
    }, COPIED_FLASH_MS);
  }

  button.addEventListener("click", () => {
    void copyAndReport();
  });
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
 * with the copy button in the block's own corner. Uses `raw()` since
 * `highlightJavaScript` already escapes each token itself, and
 * `spriteIconMarkup` builds its `<svg>` from constants alone.
 */
function tutorialAnswerTemplate(answer: TutorialAnswerData): string {
  const highlighted = highlightJavaScript(
    answer.solutionCode,
    changedLines(answer.startingCode, answer.solutionCode),
  );
  const name = t("tutorial.solution.copy");
  // The button sits inside the `<pre>` so it anchors to the code block's own
  // corner, and before the `<code>` so `textContent` there is still the program.
  // The announcement is a live region and must stay in the document even while
  // empty, or a screen reader misses the sentence when it arrives.
  return markup`<div class="tutorialanswer"><pre class="tutorialsolution"><button type="button" class="tutorialcopycode" title="${name}" aria-label="${name}">${raw(spriteIconMarkup("copy"))}</button><code>${raw(highlighted)}</code></pre><p class="tutorialcopied visually-hidden" aria-live="polite"></p></div>`;
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

  parent.replaceChildren(panel);

  queryAll(DISCLOSURE_SELECTOR, parent).forEach((disclosure, index) => {
    if (wasOpen[index] === true && disclosure instanceof HTMLDetailsElement) {
      disclosure.open = true;
    }
  });

  wireCopyButton(parent);

  // -1 (focus was elsewhere) indexes to undefined, so focus moves only if the
  // panel itself had it.
  queryAll(CONTROL_SELECTOR, parent)[focusedControl]?.focus();
}
