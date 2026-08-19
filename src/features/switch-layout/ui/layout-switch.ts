/**
 * The four-way layout switch: `design/ui-mockup.html`'s `.seg.seg-fill`
 * group of `left`/`right`/`code`/`game` buttons (§A).
 *
 * Nothing here is reachable yet. `presentLayoutSwitch` is built and tested
 * ahead of the widget that will compose it — `widgets/app-bar`'s settings
 * menu, a later step of this same phase — the same "build inert first" staged
 * migration `features/switch-theme` follows.
 *
 * `widgets/workspace-layout`'s own `LayoutMode` is the type this switch would
 * naturally choose from, but `features/**` may not import from `widgets/**`
 * (see `eslint.config.js`'s FSD boundary rules), so this module declares its
 * own {@link LayoutModeId} instead — the same four string literals, typed
 * independently. That is not a design choice this module gets to make about
 * what a layout mode *is*; it is a consequence of which layer is allowed to
 * depend on which. The two types are structurally identical, so a caller at
 * cutover time — `widgets/app-bar`'s settings menu, composing both this and
 * `workspace-layout`'s `setLayoutMode` — can pass one where the other is
 * expected without a cast: TypeScript's structural typing makes the
 * dependency inversion free at the call site, even though the two names never
 * import from each other.
 *
 * `features/**` may import from `#shared/**` freely (the FSD hierarchy runs
 * shared < entities < features < widgets < pages < app, and each layer may
 * import from itself and everything below), so unlike the boundary above,
 * there is no layering reason to keep `#shared/ui/icon.ts` out of this file —
 * `features/adjust-speed` and `features/run-simulation` already import it
 * directly, and this module follows that precedent.
 */

import { createSpriteIcon } from "#shared/ui/icon.ts";

/**
 * Which pane arrangement a button chooses. Structurally identical to
 * `widgets/workspace-layout/model/layout-mode.ts`'s own `LayoutMode` — see
 * the module comment for why this is a second, independent type rather than
 * an import of that one.
 */
export type LayoutModeId = "left" | "right" | "code" | "game";

/** Every {@link LayoutModeId}, in the mockup's own button order. */
const LAYOUT_MODE_IDS: readonly LayoutModeId[] = ["left", "right", "code", "game"];

/** The text read out for each part of the switch; supplied by the caller so this module stays free of any one locale. */
export interface LayoutSwitchLabels {
  /** `aria-label` of the `[role=group]` wrapping the four buttons. */
  readonly group: string;
  /** Each button's `title`/`aria-label`, keyed by the mode it chooses — the mockup gives every button both, identically. */
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

/** Which sprite icon draws each button, in the mockup's own `#i-split-left`/`#i-split-right`/`#i-only-code`/`#i-only-game` assignment. */
const BUTTON_ICON: Readonly<
  Record<LayoutModeId, "split-left" | "split-right" | "only-code" | "only-game">
> = {
  left: "split-left",
  right: "split-right",
  code: "only-code",
  game: "only-game",
};

/**
 * Builds the layout switch's DOM skeleton, detached from any document.
 *
 * Unlike {@link import("../../switch-theme/ui/theme-switch.ts").buildThemeSwitchSkeleton},
 * each button carries an icon rather than text — the mockup's own
 * `.seg-fill` buttons hold only an `<svg>` — drawn with `#shared/ui/icon.ts`'s
 * `createSpriteIcon`, per the module comment on why this module is free to
 * import it directly.
 *
 * @param document - The document to create the elements in, so a caller can
 * build into a document other than the global one.
 * @param labels - The localised text for the group and its four buttons.
 * @returns The group and its four buttons, ready for {@link presentLayoutSwitch}.
 */
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
  /**
   * Marks a mode as the pressed one, without calling {@link LayoutSwitchOptions.onSelect}.
   *
   * For a caller whose own layout mode changed some other way — a later
   * phase's `widgets/app-bar` keeping this switch in step with
   * `workspace-layout`'s own state after, say, a keyboard shortcut moved it.
   *
   * @param mode - The mode to mark pressed.
   */
  setActiveMode(mode: LayoutModeId): void;
  /**
   * Re-applies {@link LayoutSwitchLabels} to the group and its four buttons,
   * for a caller redrawing after a language change — `buildLayoutSwitchSkeleton`
   * only writes them once, at construction, so nothing else keeps them
   * current. Touches only text; which mode is marked pressed is untouched.
   */
  relabel(labels: LayoutSwitchLabels): void;
}

/**
 * Wires the four layout buttons up, marking the caller's current mode
 * pressed.
 *
 * This module holds no state of its own beyond which button is marked
 * pressed: unlike `presentThemeSwitch`, there is no storage key here and no
 * "resolve against a system preference" step, because a layout mode is
 * always exactly the mode it says — the caller (eventually
 * `workspace-layout`, through `widgets/app-bar`) is the one that reads and
 * writes storage and decides what applying a mode does.
 *
 * @param options - The buttons to wire, the mode to open showing as pressed,
 * and the callback for a press.
 * @returns A controller for keeping the pressed button in step with state
 * that changed elsewhere.
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
