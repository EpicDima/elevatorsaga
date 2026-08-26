// @vitest-environment jsdom

import { EditorView } from "@codemirror/view";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import pageSource from "../index.html?raw";
import type { FitnessSuiteResult } from "./game/fitness.ts";
import { translateIn } from "./i18n/index.ts";
import { TIME_SCALE_STORAGE_KEY } from "./pages/game/index.ts";
import { MemoryStorage } from "./ui/test-helpers.ts";
import { DEFAULT_TIME_SCALE } from "#features/adjust-speed/model/time-scale.ts";
import { queryAll, requireElement } from "#shared/lib/dom.ts";
import { polyfillDialogElement } from "#shared/ui/test-helpers.ts";

/** The benchmark, mocked: it would otherwise reach for a worker jsdom has not got and then run the real suite instead. */
const fitness = vi.hoisted(() => ({
  runFitnessSuite: vi.fn<(code: string) => Promise<FitnessSuiteResult>>(),
  describeFitnessResults: vi.fn<(results: FitnessSuiteResult) => string>(),
}));
vi.mock("./app/fitness.ts", () => fitness);

/** A Mac user agent, so relabeling a `Mod-` key is visible at all: the shipped markup already says "Ctrl". */
const MAC_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

/** A program to find in storage, unlike any starter program the game writes. */
const MY_CODE = "{\n    init: function() {},\n    update: function() {}\n}";

/** Another one, to tell one code slot from the next. */
const OTHER_CODE = "{\n    init: function() { var mine = 2; },\n    update: function() {}\n}";

/** A program whose second line throws while it is being compiled. */
const BROKEN_CODE = "{\n    init: nope(),\n    update: function() {}\n}";

/** Where the first level's first code slot is stored. */
const SLOT_ONE_KEY = "develevateChallengeCode_0_1";

/** Where the first level's second code slot is stored. */
const SLOT_TWO_KEY = "develevateChallengeCode_0_2";

/** What the mocked benchmark answers with; compared by identity, so the figures stand for nothing. */
const SUITE_RESULT: FitnessSuiteResult = [
  { options: { description: "A small building" }, result: { avgWaitTime: 12.5 } },
];

/** What the mocked benchmark formats {@link SUITE_RESULT} as. */
const SUITE_SUMMARY = "A small building: 12.5s";

/** A `MemoryStorage` whose writes can be made to fail, as a full quota does. */
class RefusableStorage extends MemoryStorage {
  /** Whether every write from here on throws. */
  refusing = false;

  override setItem(key: string, value: string): void {
    if (this.refusing) {
      throw new Error("QuotaExceededError");
    }
    super.setItem(key, value);
  }
}

/** The `(prefers-color-scheme: dark)` query, whose answer a test can change as the system's own does. */
class SystemColorScheme extends EventTarget {
  /** Whether the system asks for dark right now. */
  matches = false;

  /** Answers `dark` from here on, and tells whoever is listening. */
  prefer(dark: boolean): void {
    this.matches = dark;
    this.dispatchEvent(new Event("change"));
  }
}

let storage: RefusableStorage;
let systemColorScheme: SystemColorScheme;
let consoleInfo: MockInstance<Console["info"]>;

/** Installs the shipped page, minus its scripts: jsdom would run the inline one, and the module one is what {@link boot} imports by hand. */
function installShell(): void {
  const parsed = new DOMParser().parseFromString(pageSource, "text/html");
  for (const script of parsed.querySelectorAll("script")) {
    script.remove();
  }
  document.documentElement.replaceWith(document.importNode(parsed.documentElement, true));
}

/** Lets whatever the last step started finish; a task rather than a microtask, since how many ticks the entry point takes is not this test's business. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Puts the page shell up and runs the entry point over it, as a browser load does. */
async function boot(): Promise<void> {
  installShell();
  // A fresh module graph per boot, so `main()` runs again and no state survives from the last one.
  vi.resetModules();
  await import("./main.ts");
  await settle();
}

/** The live editor mounted in the pane. */
function editorView(): EditorView {
  const view = EditorView.findFromDOM(requireElement(".code"));
  if (view === null) {
    throw new Error("The editor did not mount");
  }
  return view;
}

/** The program on screen. */
function code(): string {
  return editorView().state.doc.toString();
}

/** Saves from inside the editor, in both spellings of Mod: only one is bound on any given platform, and jsdom isn't the platform the player is on. */
function saveFromEditor(): void {
  const { contentDOM } = editorView();
  for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
    contentDOM.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", keyCode: 83, bubbles: true, ...modifier }),
    );
  }
}

/** Presses a key on the page itself, where the global shortcuts listen. */
function pressGlobally(key: string, options: KeyboardEventInit = {}): void {
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...options }));
}

/** One of the three code slot buttons, found afresh: the row is rebuilt on every update. */
function slotButton(slot: number): HTMLElement {
  return requireElement(`.slots > .codeslot:nth-child(${String(slot)})`);
}

/** The settings popover's language picker. */
function languagePicker(): HTMLSelectElement {
  const select = requireElement(".langpick");
  if (!(select instanceof HTMLSelectElement)) {
    throw new TypeError("Expected .langpick to be a <select>");
  }
  return select;
}

/** The settings popover's seed field, found afresh: the block is rebuilt whenever the seed changes. */
function seedField(): HTMLInputElement {
  const field = requireElement(".seedvalue");
  if (!(field instanceof HTMLInputElement)) {
    throw new TypeError("Expected .seedvalue to be an <input>");
  }
  return field;
}

beforeAll(() => {
  // jsdom has no layout, so CodeMirror's measure cycle throws without a stub for this.
  Range.prototype.getClientRects = function getClientRects(): DOMRectList {
    return Object.assign([], { item: () => null });
  };
  polyfillDialogElement();
  Object.defineProperty(navigator, "userAgent", { value: MAC_USER_AGENT, configurable: true });
});

beforeEach(() => {
  storage = new RefusableStorage();
  systemColorScheme = new SystemColorScheme();
  // A store of its own per boot: the app and the editor both capture whatever
  // this answers with at construction, so an earlier boot's autosave timer
  // writes into a store nothing reads again.
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("matchMedia", () => systemColorScheme);
  // Back to the bare address, without the navigation an assignment to the hash would fire.
  history.replaceState(null, "", "/");
  // Cleared, not just silenced: a spy outlives its spec, so uncleared calls leak in.
  consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
  consoleInfo.mockClear();
  vi.spyOn(console, "log")
    .mockImplementation(() => undefined)
    .mockClear();
  vi.spyOn(console, "warn")
    .mockImplementation(() => undefined)
    .mockClear();
  fitness.runFitnessSuite.mockReset().mockResolvedValue(SUITE_RESULT);
  fitness.describeFitnessResults.mockReset().mockReturnValue(SUITE_SUMMARY);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the page the entry point builds", () => {
  it("replaces the shipped header with the app bar, in the order the bar is assembled", async () => {
    await boot();

    const appBar = requireElement("header");
    expect(document.querySelectorAll("header")).toHaveLength(1);
    expect(appBar.className).toBe("appbar");
    expect(requireElement("h1", appBar).textContent).toBe(translateIn("en", "page.brand"));
    // The switcher and the run controls are moved into the bar, not rebuilt there.
    expect([...appBar.children].map((child) => child.className)).toEqual([
      "brand",
      "levelswitcher",
      "controls",
      "barspace",
      "ghost docsopen",
      "setwrap",
    ]);
  });

  it("moves the game and the editor into the two panes without tearing the editor down", async () => {
    await boot();

    expect([...requireElement(".pane-game").children].map((child) => child.className)).toEqual([
      "level",
      "stagearea",
      "statscontainer",
    ]);
    expect([...requireElement(".stagearea").children].map((child) => child.className)).toEqual([
      "tutorial",
      "world",
    ]);
    expect(requireElement(".code").parentElement).toBe(requireElement(".pane-code"));
    // The move is an append, so the editor that mounted before it is still the live one.
    expect(EditorView.findFromDOM(requireElement(".code"))).not.toBeNull();
    expect(document.documentElement.dataset["layout"]).toBe("right");
  });

  it("puts the caret in the editor when the skip link is followed, instead of navigating", async () => {
    await boot();
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });

    requireElement(".skip-link").dispatchEvent(click);

    // Following the link would drop `level=` from the hash and restart the player on level one.
    expect(click.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(editorView().contentDOM);
  });
});

describe("the storage warning", () => {
  it("announces a refused write, and takes the announcement back once one gets through", async () => {
    await boot();
    const status = requireElement("#storage_status");

    storage.refusing = true;
    saveFromEditor();

    expect(status.textContent).toBe(translateIn("en", "editor.storageRefused"));

    storage.refusing = false;
    saveFromEditor();

    expect(status.textContent).toBe("");
  });
});

describe("the editor pane's tools", () => {
  it("backs the program up and puts the starter program in its place", async () => {
    storage.setItem(SLOT_ONE_KEY, MY_CODE);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await boot();
    expect(requireElement(".undoreset").hidden).toBe(true);

    requireElement(".resetcode").click();

    expect(confirm).toHaveBeenCalledWith(translateIn("en", "editor.confirmReset"));
    expect(code()).toBe(translateIn("en", "editor.defaultCode.code"));
    expect(requireElement(".undoreset").hidden).toBe(false);
  });

  it("leaves the program alone when the reset is not confirmed", async () => {
    storage.setItem(SLOT_ONE_KEY, MY_CODE);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await boot();

    requireElement(".resetcode").click();

    expect(code()).toBe(MY_CODE);
    expect(requireElement(".undoreset").hidden).toBe(true);
  });

  it("brings the program back when the undo is confirmed", async () => {
    storage.setItem(SLOT_ONE_KEY, MY_CODE);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await boot();
    requireElement(".resetcode").click();

    requireElement(".undoreset").click();

    expect(confirm).toHaveBeenLastCalledWith(translateIn("en", "editor.confirmUndoReset"));
    expect(code()).toBe(MY_CODE);
    // Nothing left to take back: what is on screen is the player's own program again.
    expect(requireElement(".undoreset").hidden).toBe(true);
  });

  it("keeps the starter program when the undo is not confirmed", async () => {
    storage.setItem(SLOT_ONE_KEY, MY_CODE);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await boot();
    requireElement(".resetcode").click();
    confirm.mockReturnValue(false);

    requireElement(".undoreset").click();

    expect(code()).toBe(translateIn("en", "editor.defaultCode.code"));
    expect(requireElement(".undoreset").hidden).toBe(false);
  });

  it("underlines the line the error banner names when its button is pressed", async () => {
    storage.setItem(SLOT_ONE_KEY, BROKEN_CODE);
    await boot();
    const pane = requireElement(".code");
    expect(requireElement(".errorline").hidden).toBe(false);
    expect(requireElement(".goto").textContent).toBe(
      translateIn("en", "game.editorPane.gotoLine", { line: 2 }),
    );
    expect(pane.querySelector(".cm-errorMark")).toBeNull();

    requireElement(".goto").click();

    expect(
      queryAll(".cm-errorMark", pane)
        .map((mark) => mark.textContent)
        .join(""),
    ).toBe("    init: nope(),");
  });

  it("shows another code slot's program when its button is pressed", async () => {
    storage.setItem(SLOT_ONE_KEY, MY_CODE);
    storage.setItem(SLOT_TWO_KEY, OTHER_CODE);
    await boot();
    expect(code()).toBe(MY_CODE);

    slotButton(2).click();

    expect(code()).toBe(OTHER_CODE);
    expect(queryAll(".codeslot").map((button) => button.getAttribute("aria-pressed"))).toEqual([
      "false",
      "true",
      "false",
    ]);
  });
});

describe("the dialogs", () => {
  it("opens the reference from the app bar and from F1", async () => {
    await boot();
    const docs = requireElement(".docs");
    expect(docs.hasAttribute("open")).toBe(false);

    requireElement(".docsopen").click();

    expect(docs.hasAttribute("open")).toBe(true);
    expect(requireElement("h2", docs).textContent).toBe(translateIn("en", "game.docs.title"));

    requireElement(".docsclose").click();
    pressGlobally("F1");

    expect(docs.hasAttribute("open")).toBe(true);
  });

  it("opens the shortcut list from the settings popover, spelled for this platform", async () => {
    await boot();
    const keys = requireElement(".keys");

    requireElement(".setopen").click();
    requireElement(".keysopen").click();

    expect(keys.hasAttribute("open")).toBe(true);
    // The popover stays open underneath, so closing the dialog lands back in settings.
    expect(requireElement(".setmenu").hidden).toBe(false);
    expect(requireElement("h2", keys).textContent).toBe(translateIn("en", "game.hotkeys.title"));
    const modKeys = queryAll("kbd[data-mod-key]", keys).map((key) => key.textContent);
    expect(modKeys.length).toBeGreaterThan(0);
    expect([...new Set(modKeys)]).toEqual(["⌘"]);
  });
});

describe("the workspace layout", () => {
  it("carries on from whichever mode the settings popover chose", async () => {
    await boot();

    requireElement('[data-layout-btn="code"]').click();
    expect(document.documentElement.dataset["layout"]).toBe("code");

    pressGlobally("b", { ctrlKey: true });

    expect(document.documentElement.dataset["layout"]).toBe("game");
    // The popover has to follow the keyboard, or its pressed button would lie.
    expect(requireElement('[data-layout-btn="game"]').getAttribute("aria-pressed")).toBe("true");
  });

  it("cycles the whole ring back to where it started", async () => {
    await boot();
    const modes: (string | undefined)[] = [];

    for (let press = 0; press < 4; press += 1) {
      pressGlobally("b", { ctrlKey: true });
      modes.push(document.documentElement.dataset["layout"]);
    }

    expect(modes).toEqual(["left", "code", "game", "right"]);
  });
});

describe("the theme", () => {
  it("follows the system's color scheme changing under it", async () => {
    await boot();
    expect(document.documentElement.dataset["theme"]).toBe("light");

    systemColorScheme.prefer(true);

    expect(document.documentElement.dataset["theme"]).toBe("dark");
  });
});

describe("the language", () => {
  it("redraws the shell, the game and both dialogs in the language just chosen", async () => {
    await boot();
    const picker = languagePicker();

    picker.value = "ru";
    picker.dispatchEvent(new Event("change"));

    // The catalog is fetched, so nothing is in Russian until it lands.
    await vi.waitFor(() => {
      expect(document.documentElement.lang).toBe("ru");
    });
    expect(requireElement(".skip-link").textContent).toBe(translateIn("ru", "page.skipLink"));
    expect(requireElement(".startstop .lbl").textContent).toBe(
      translateIn("ru", "game.button.start"),
    );
    expect(requireElement(".setopen").title).toBe(translateIn("ru", "game.appBar.settingsLabel"));
    expect(requireElement(".docs h2").textContent).toBe(translateIn("ru", "game.docs.title"));
    expect(requireElement(".keys h2").textContent).toBe(translateIn("ru", "game.hotkeys.title"));
    // Per platform, not per language: the relabel has to survive the redraw.
    const modKeys = queryAll("kbd[data-mod-key]").map((key) => key.textContent);
    expect(modKeys.length).toBeGreaterThan(0);
    expect([...new Set(modKeys)]).toEqual(["⌘"]);
  });
});

describe("the seed", () => {
  it("plays the seed the player typed, and says so in the address bar", async () => {
    await boot();
    const field = seedField();

    field.value = "chosen-seed";
    field.dispatchEvent(new Event("change", { bubbles: true }));

    // A navigation, not a restart in place, so the address names the run.
    expect(window.location.hash).toBe("#level=1,seed=chosen-seed");
    await vi.waitFor(() => {
      expect(seedField().value).toBe("chosen-seed");
    });
  });
});

describe("the console benchmark", () => {
  it("measures the program on screen when it is called with nothing", async () => {
    storage.setItem(SLOT_ONE_KEY, MY_CODE);
    await boot();

    await expect(window.runFitnessSuite()).resolves.toBe(SUITE_RESULT);

    expect(fitness.runFitnessSuite).toHaveBeenCalledWith(MY_CODE);
  });

  it("measures the program it is handed, and prints the summary", async () => {
    await boot();

    await window.runFitnessSuite("// mine");

    expect(fitness.runFitnessSuite).toHaveBeenCalledWith("// mine");
    expect(fitness.describeFitnessResults).toHaveBeenCalledWith(SUITE_RESULT);
    // The benchmark takes seconds, so it says so before it starts rather than after.
    expect(consoleInfo).toHaveBeenNthCalledWith(1, translateIn("en", "fitness.measuring"));
    expect(consoleInfo).toHaveBeenNthCalledWith(2, SUITE_SUMMARY);
  });
});

describe("the simulation speed", () => {
  it("starts at the speed the player left behind", async () => {
    storage.setItem(TIME_SCALE_STORAGE_KEY, "8");
    await boot();

    expect(requireElement(".speed-val").textContent).toBe(
      translateIn("en", "game.timeScale.value", { value: 8 }),
    );
  });

  it("starts at the default speed when none was remembered", async () => {
    await boot();

    expect(requireElement(".speed-val").textContent).toBe(
      translateIn("en", "game.timeScale.value", { value: DEFAULT_TIME_SCALE }),
    );
  });
});
