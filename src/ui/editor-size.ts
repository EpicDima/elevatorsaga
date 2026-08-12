/**
 * The grip under the code editor, which drags it taller, and remembers it.
 *
 * Upstream PR #104 asked for this in 2016 and was never merged: "the coding
 * area is too small for editing after a few levels". At the shipped height the
 * editor shows about fifteen lines, which is right for the starter program and
 * wrong for the program somebody is writing by challenge 12 — and the editor is
 * the one part of this page a player spends the whole game inside.
 *
 * ## A grip, not a two-state button
 *
 * This was an Expand button with `aria-pressed`, offering one other height. Two
 * heights are one height more than none and still not the player's: the program
 * that needs eighteen lines gets seventy per cent of the window, and the next
 * challenge gets the same seventy per cent whether it wants it or not. The
 * control is now the editor's own bottom edge, which is where a reader of any
 * other resizable box on the web already reaches for it, and every height
 * between {@link MIN_EDITOR_HEIGHT} and {@link MAX_EDITOR_HEIGHT_RATIO} of the
 * window is reachable.
 *
 * Native `resize: vertical` on `.cm-editor` would drag as well as this does and
 * was rejected on two counts: the grabber is a corner triangle no stylesheet
 * can move to the middle of the edge where the affordance is being claimed, and
 * a resize handle the user agent draws cannot be reached from the keyboard at
 * all. What is here instead is the `separator` role — the window-splitter
 * pattern — which is focusable, carries its size in `aria-valuenow`, and moves
 * on the arrow keys, so the whole range is available without a pointer (WCAG
 * 2.1.1). Pointer input goes through Pointer Events with capture, so a drag
 * that leaves the grip, the page or the window still ends where the player let
 * go, and one code path serves mouse, pen and touch.
 *
 * ## A property on `<html>`, and a `clamp()` in the stylesheet
 *
 * The obvious implementation writes a height into the editor's own
 * `style.height`, and it is wrong in a way that only shows up on a phone: the
 * stylesheet's `max-width: 760px` media query sets a shorter editor, and an
 * inline height outranks it, so a height chosen on a desktop would follow the
 * player onto a screen it does not fit. {@link EDITOR_HEIGHT_PROPERTY} is
 * written instead — the *chosen* height, a token distinct from the shipped one
 * — and `src/styles/style.css` decides what to do with it:
 * `clamp(min, chosen-or-shipped, max)`. So a window that shrinks after the
 * choice was made shrinks the editor with it, the media query goes on having an
 * opinion about the height nobody chose, and the one number this module owns is
 * the one the player dragged.
 *
 * The property goes on `<html>` rather than on the editor because that is the
 * element the shell ships before any module has run: a player who left the
 * editor tall should not watch it start short and jump.
 * {@link applyStoredEditorHeight} is called from `src/main.ts` before CodeMirror
 * mounts, so there is one layout instead of two, and {@link presentEditorResize}
 * wires the grip afterwards, once there is a box for it to measure.
 *
 * ## Nothing tells CodeMirror
 *
 * It notices by itself: `@codemirror/view` puts a `ResizeObserver` on its own
 * scroller and remeasures when the box changes, so a height that arrives
 * through the cascade is the same to it as one that arrives from the window
 * being dragged. `e2e/editor.spec.ts` is what checks that this is still true.
 */

/**
 * Where the height is remembered, in whole pixels.
 *
 * `develevate…` like the other keys this fork invented, rather than
 * `elevator…`, which is reserved for the two keys the legacy game wrote and
 * this one still reads.
 */
export const EDITOR_HEIGHT_STORAGE_KEY = "develevateEditorHeight";

/**
 * The key the Expand button wrote, read once and then removed.
 *
 * It held the word `tall` and nothing else, so there is exactly one height to
 * migrate it to: the one that word used to select. Kept as a read path rather
 * than dropped because the alternative is a player who expanded the editor last
 * week finding it short again, with nothing on screen to explain why.
 */
export const LEGACY_EDITOR_SIZE_STORAGE_KEY = "develevateEditorSize";

/** The one value the legacy key was ever set to. */
const LEGACY_TALL_EDITOR = "tall";

/**
 * What the legacy `tall` meant: `max(var(--editor-height), 70vh)`.
 *
 * Resolved here against the window the migration runs in, because a pixel
 * figure is what the new key holds. The 320px is the shipped `--editor-height`
 * and is a duplicate of a number in the stylesheet, which is why this constant
 * exists only on the migration path: nothing else in this module needs to know
 * the shipped height, since everything else measures the box.
 */
const LEGACY_TALL_RATIO = 0.7;

/** The shipped `--editor-height`, needed only to migrate the legacy key. */
const LEGACY_SHIPPED_HEIGHT = 320;

/** The custom property the chosen height is written to. */
export const EDITOR_HEIGHT_PROPERTY = "--editor-height-chosen";

/**
 * The shortest the editor may be dragged, in pixels.
 *
 * Six lines at the editor's `14px/1.4`, plus its padding: enough to see a
 * function and the line under it. Repeated in the stylesheet's `clamp()`, which
 * is the authority when the window changes without anybody dragging anything;
 * `src/styles/style.css` and `src/ui/editor-size.test.ts` both name the number.
 */
export const MIN_EDITOR_HEIGHT = 120;

/**
 * The tallest the editor may be dragged, as a share of the window.
 *
 * Not the whole of it: the row of buttons under the editor has to stay on
 * screen, or the control that applies the program goes out of reach at exactly
 * the moment the player has finished writing it.
 */
export const MAX_EDITOR_HEIGHT_RATIO = 0.85;

/** How far one arrow key moves the edge: one line of the editor, rounded. */
export const EDITOR_HEIGHT_STEP = 20;

/** How far `PageUp` and `PageDown` move it: five lines. */
export const EDITOR_HEIGHT_PAGE_STEP = 100;

/** What the grip needs in order to drive and describe itself. */
export interface EditorResizeOptions {
  /** The grip in the shell, immediately under the editor. */
  readonly handle: HTMLElement;
  /**
   * The box being resized — `.cm-editor`, once CodeMirror has mounted.
   *
   * Measured rather than assumed, so a drag that starts from the height nobody
   * chose starts from whatever the stylesheet is currently making that.
   */
  readonly editor: HTMLElement;
  /**
   * The element the property goes on — `document.documentElement` in the page.
   *
   * Injected for the same reason the storage is: it makes the whole of this
   * testable against a document that is not the one the test runner is in.
   */
  readonly root: HTMLElement;
  /** Where the height is remembered between visits. */
  readonly storage: Storage;
}

/**
 * The tallest the editor may be in a given window.
 *
 * @param view - The window the page is in, or `null` when there is none.
 * @returns The maximum height in pixels, never below {@link MIN_EDITOR_HEIGHT}.
 */
function maxEditorHeight(view: Window | null): number {
  const available = (view?.innerHeight ?? 0) * MAX_EDITOR_HEIGHT_RATIO;
  return Math.max(MIN_EDITOR_HEIGHT, Math.round(available));
}

/**
 * Holds a height inside the range the window allows.
 *
 * @param height - The height asked for, in pixels.
 * @param view - The window the page is in.
 * @returns The height that will actually be applied.
 */
function clampHeight(height: number, view: Window | null): number {
  return Math.min(Math.max(Math.round(height), MIN_EDITOR_HEIGHT), maxEditorHeight(view));
}

/**
 * The height left over from a previous visit, migrating the legacy key on the
 * way past.
 *
 * A refused or unreadable storage answers `null`, which is the shipped default
 * and the only answer that cannot surprise anybody.
 *
 * @param storage - Where the height was remembered.
 * @param view - The window, for resolving what the legacy `tall` came to.
 * @returns The remembered height in pixels, or `null` when there is none.
 */
function readStoredHeight(storage: Storage, view: Window | null): number | null {
  let stored: string | null;
  let legacy: string | null;
  try {
    stored = storage.getItem(EDITOR_HEIGHT_STORAGE_KEY);
    legacy = storage.getItem(LEGACY_EDITOR_SIZE_STORAGE_KEY);
  } catch {
    return null;
  }
  if (stored !== null) {
    const height = Number.parseInt(stored, 10);
    // `Number.isFinite` rather than a bare `NaN` test: a key edited by hand to
    // `Infinity` parses to it, and a stored height of `Infinity` would make
    // every later comparison meaningless rather than merely wrong.
    return Number.isFinite(height) && height > 0 ? clampHeight(height, view) : null;
  }
  if (legacy === LEGACY_TALL_EDITOR) {
    const tall = Math.max(LEGACY_SHIPPED_HEIGHT, (view?.innerHeight ?? 0) * LEGACY_TALL_RATIO);
    return clampHeight(tall, view);
  }
  return null;
}

/**
 * Remembers the height, or does not.
 *
 * Deliberately unchecked, the same trade as `#storeTimeScale` in
 * `src/app/app.ts`: a browser that refuses storage — Safari in private mode is
 * the one everybody meets — is a reason for the height not to survive the tab,
 * not a reason for it not to change now. The legacy key is dropped whenever a
 * height is written, so the migration above happens once per browser.
 *
 * @param storage - Where to remember it.
 * @param height - The height in pixels.
 */
function storeHeight(storage: Storage, height: number): void {
  try {
    storage.setItem(EDITOR_HEIGHT_STORAGE_KEY, String(height));
    storage.removeItem(LEGACY_EDITOR_SIZE_STORAGE_KEY);
  } catch {
    // Nothing to do about it, and nothing worth stopping for.
  }
}

/**
 * Writes a height into the page, or takes the choice back out.
 *
 * @param root - The element the property lives on.
 * @param height - The height in pixels, or `null` to fall back to the shipped
 * one.
 */
function applyHeight(root: HTMLElement, height: number | null): void {
  if (height === null) {
    // Removed rather than set to the shipped figure, so that a size nobody
    // chose leaves no trace and the media query is the only thing deciding it.
    root.style.removeProperty(EDITOR_HEIGHT_PROPERTY);
  } else {
    root.style.setProperty(EDITOR_HEIGHT_PROPERTY, `${String(height)}px`);
  }
}

/**
 * Restores the height the player last left the editor at.
 *
 * Called before CodeMirror mounts, so the editor is drawn once at the right
 * size rather than growing into it in front of the player.
 *
 * @param root - The element the property goes on, `document.documentElement` in
 * the page.
 * @param storage - Where the height was remembered.
 * @returns The height applied, or `null` when none was remembered.
 */
export function applyStoredEditorHeight(root: HTMLElement, storage: Storage): number | null {
  const height = readStoredHeight(storage, root.ownerDocument.defaultView);
  applyHeight(root, height);
  return height;
}

/**
 * Wires the grip that drags the editor's bottom edge.
 *
 * @param options - The grip, the box it resizes, the element to write the
 * property on, and where to remember the result.
 */
export function presentEditorResize(options: EditorResizeOptions): void {
  const { handle, editor, root, storage } = options;
  const view = root.ownerDocument.defaultView;

  /** The height the grip currently reports, measured when nobody has chosen. */
  const currentHeight = (): number => Math.round(editor.getBoundingClientRect().height);

  /** Tells assistive technology where the edge is now, and where it may go. */
  const describe = (height: number): void => {
    handle.setAttribute("aria-valuenow", String(height));
    handle.setAttribute("aria-valuemin", String(MIN_EDITOR_HEIGHT));
    handle.setAttribute("aria-valuemax", String(maxEditorHeight(view)));
  };

  /**
   * Moves the edge and says so, in that order: `aria-valuenow` reports the
   * height that was applied rather than the one that was asked for, so a drag
   * past either end of the range announces the end it stopped at.
   */
  const resizeTo = (height: number): number => {
    const applied = clampHeight(height, view);
    applyHeight(root, applied);
    describe(applied);
    return applied;
  };

  describe(currentHeight());

  /** Where the pointer went down, and how tall the editor was at that moment. */
  let dragFrom: { readonly pointerY: number; readonly height: number } | null = null;

  handle.addEventListener("pointerdown", (event: PointerEvent) => {
    // Only the primary button: a right-click on the grip belongs to the browser,
    // and a drag started by one would never see its `pointerup`.
    if (!event.isPrimary || event.button !== 0) {
      return;
    }
    dragFrom = { pointerY: event.clientY, height: currentHeight() };
    handle.setPointerCapture(event.pointerId);
    // Stops the drag selecting the text on either side of the grip, which is
    // what a pointer moving across a page ordinarily does.
    event.preventDefault();
  });

  handle.addEventListener("pointermove", (event: PointerEvent) => {
    if (dragFrom === null) {
      return;
    }
    resizeTo(dragFrom.height + (event.clientY - dragFrom.pointerY));
  });

  /**
   * Ends the drag, whichever way it ended.
   *
   * `pointercancel` matters as much as `pointerup` here: a touch that the
   * browser takes over for a scroll or a system gesture fires only the former,
   * and a drag left open would go on resizing the next time a finger crossed
   * the grip.
   */
  const endDrag = (event: PointerEvent): void => {
    if (dragFrom === null) {
      return;
    }
    dragFrom = null;
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
    storeHeight(storage, currentHeight());
  };

  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);

  handle.addEventListener("keydown", (event: KeyboardEvent) => {
    // A modified arrow key belongs to the browser or the operating system --
    // Alt-Left is Back, and a hijacked one is a shortcut the player lost.
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const height = currentHeight();
    // Down grows the editor and up shrinks it, which is the direction the same
    // key moves the same edge with a pointer. The editor is the region above
    // the separator, so this is also what the window-splitter pattern asks for.
    const moved = ((): number | null => {
      switch (event.key) {
        case "ArrowDown":
          return height + EDITOR_HEIGHT_STEP;
        case "ArrowUp":
          return height - EDITOR_HEIGHT_STEP;
        case "PageDown":
          return height + EDITOR_HEIGHT_PAGE_STEP;
        case "PageUp":
          return height - EDITOR_HEIGHT_PAGE_STEP;
        case "Home":
          return MIN_EDITOR_HEIGHT;
        case "End":
          return maxEditorHeight(view);
        default:
          return null;
      }
    })();
    if (moved === null) {
      return;
    }
    // Only once the key is one this handles: `preventDefault` on every key
    // would swallow Tab and trap the focus on the grip.
    event.preventDefault();
    storeHeight(storage, resizeTo(moved));
  });

  // A double-click gives the shipped height back. It is the one gesture that
  // returns a resizable box to where it started everywhere else on the web, and
  // it is the only way back to "nobody chose", which is not a height the grip
  // can be dragged to: the shipped value is a media query away from being a
  // different number on the next screen.
  handle.addEventListener("dblclick", () => {
    applyHeight(root, null);
    try {
      storage.removeItem(EDITOR_HEIGHT_STORAGE_KEY);
      storage.removeItem(LEGACY_EDITOR_SIZE_STORAGE_KEY);
    } catch {
      // As above: not worth stopping for.
    }
    describe(currentHeight());
  });
}
