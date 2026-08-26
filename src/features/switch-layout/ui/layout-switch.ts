/**
 * The four-way layout switch: a group of `left`/`right`/`code`/`game` buttons,
 * composed into `widgets/app-bar`'s settings menu.
 *
 * {@link LayoutModeId} duplicates `widgets/workspace-layout`'s `LayoutMode`
 * rather than importing it, since `features/**` may not depend on
 * `widgets/**`; the two types are structurally identical, so callers can pass
 * one where the other is expected without a cast.
 */

import { createSpriteIcon } from "#shared/ui/icon.ts";

/** Which pane arrangement a button chooses. */
export type LayoutModeId = "left" | "right" | "code" | "game";

/** Every {@link LayoutModeId}, in the order the buttons are drawn. */
const LAYOUT_MODE_IDS: readonly LayoutModeId[] = ["left", "right", "code", "game"];

/** The text read out for each part of the switch; supplied by the caller so this module stays free of any one locale. */
export interface LayoutSwitchLabels {
  /** `aria-label` of the `[role=group]` wrapping the four buttons. */
  readonly group: string;
  /** Each button's `title` and `aria-label`, keyed by the mode it chooses; both carry the same text. */
  readonly buttons: Readonly<Record<LayoutModeId, string>>;
}

/** The elements {@link buildLayoutSwitchSkeleton} builds. */
export interface LayoutSwitchElements {
  /** The `[role=group]` wrapping the four buttons. */
  readonly group: HTMLElement;
  /** `data-layout-btn="left"`. */
  readonly left: HTMLElement;
  /** `data-layout-btn="right"`. */
  readonly right: HTMLElement;
  /** `data-layout-btn="code"`. */
  readonly code: HTMLElement;
  /** `data-layout-btn="game"`. */
  readonly game: HTMLElement;
}

/** Which sprite icon draws each button. */
const BUTTON_ICON: Readonly<
  Record<LayoutModeId, "split-left" | "split-right" | "only-code" | "only-game">
> = {
  left: "split-left",
  right: "split-right",
  code: "only-code",
  game: "only-game",
};

/** Builds the layout switch's DOM skeleton, detached from any document; each button carries an icon rather than text. */
export function buildLayoutSwitchSkeleton(
  document: Document,
  labels: LayoutSwitchLabels,
): LayoutSwitchElements {
  const group = document.createElement("div");
  group.className = "seg seg-fill";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", labels.group);

  const buildButton = (mode: LayoutModeId): HTMLButtonElement => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset["layoutBtn"] = mode;
    button.setAttribute("aria-pressed", "false");
    button.title = labels.buttons[mode];
    button.setAttribute("aria-label", labels.buttons[mode]);
    button.append(createSpriteIcon(BUTTON_ICON[mode]));
    return button;
  };

  const left = buildButton("left");
  const right = buildButton("right");
  const code = buildButton("code");
  const game = buildButton("game");
  group.append(left, right, code, game);

  return { group, left, right, code, game };
}

/** What {@link presentLayoutSwitch} needs to drive the switch. */
export interface LayoutSwitchOptions {
  /** The buttons to wire, from {@link buildLayoutSwitchSkeleton} or a caller's own markup. */
  readonly elements: LayoutSwitchElements;
  /** The mode the switch opens showing as pressed — the caller's own current layout mode. */
  readonly initialMode: LayoutModeId;
  /** Called when a button is pressed, with the mode it chooses. */
  readonly onSelect: (mode: LayoutModeId) => void;
}

/** What a mounted layout switch hands back. */
export interface LayoutSwitchController {
  /** Marks a mode as the pressed one, without calling {@link LayoutSwitchOptions.onSelect}. */
  setActiveMode(mode: LayoutModeId): void;
  /** Re-applies {@link LayoutSwitchLabels} after a language change; touches only text, not which mode is pressed. */
  relabel(labels: LayoutSwitchLabels): void;
}

/**
 * Wires the four layout buttons up, marking the caller's current mode pressed.
 *
 * Holds no state beyond which button is pressed; the caller owns storage and
 * decides what applying a mode does.
 */
export function presentLayoutSwitch(options: LayoutSwitchOptions): LayoutSwitchController {
  const { elements, onSelect } = options;
  const buttons: Readonly<Record<LayoutModeId, HTMLElement>> = {
    left: elements.left,
    right: elements.right,
    code: elements.code,
    game: elements.game,
  };

  const mark = (mode: LayoutModeId): void => {
    for (const candidate of LAYOUT_MODE_IDS) {
      buttons[candidate].setAttribute("aria-pressed", String(candidate === mode));
    }
  };

  mark(options.initialMode);

  for (const candidate of LAYOUT_MODE_IDS) {
    buttons[candidate].addEventListener("click", () => {
      mark(candidate);
      onSelect(candidate);
    });
  }

  return {
    setActiveMode(mode: LayoutModeId): void {
      mark(mode);
    },
    relabel(labels: LayoutSwitchLabels): void {
      elements.group.setAttribute("aria-label", labels.group);
      for (const candidate of LAYOUT_MODE_IDS) {
        buttons[candidate].title = labels.buttons[candidate];
        buttons[candidate].setAttribute("aria-label", labels.buttons[candidate]);
      }
    },
  };
}
