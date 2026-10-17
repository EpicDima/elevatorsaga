/** Makes the reference page's link back to the game return to the game the reader left, not a fresh copy of it. */

/** The parts of the browser the link consults, so a test can stand them in. */
export interface BackToGameHost {
  /** `location.href`: the reference page, which sits in the game's own directory. */
  readonly href: string;
  /** `document.referrer`: the game's address when the reader came from it. */
  readonly referrer: string;
  /** `location.hash`: set once the reader has followed an in-page link, which adds history to step over. */
  readonly hash: string;
  /** `history.length`: one when this tab was opened for the page. */
  readonly historyLength: number;
  /** The Navigation API, which can see past in-page links and language switches; absent in older browsers. */
  readonly navigation?: Pick<Navigation, "currentEntry" | "entries" | "traverseTo"> | undefined;
  /** Steps one entry back in the tab's history. */
  back(): void;
  /** Asks to close the tab and says whether the browser agreed. */
  close(): boolean;
}

/** Whether `address` is the game that `game` names: the same page, with or without its `index.html`. */
function isGame(address: string | null, game: URL): boolean {
  if (address === null || address === "") return false;
  const url = new URL(address, game);
  return (
    url.origin === game.origin &&
    (url.pathname === game.pathname || url.pathname === `${game.pathname}index.html`)
  );
}

/** Whether a click on the link asks for the link itself, in this tab: a plain primary click. */
function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

/**
 * Takes the reader back to the game they left, if they left one.
 *
 * @returns Whether it did; when not, the link should be followed as usual.
 */
export function returnToGame(host: BackToGameHost): boolean {
  const game = new URL("./", host.href);
  const { navigation } = host;
  if (navigation?.currentEntry) {
    const here = navigation.currentEntry.index;
    const left = navigation
      .entries()
      .filter((entry) => entry.index < here && isGame(entry.url, game))
      .at(-1);
    if (left) {
      navigation.traverseTo(left.key);
      return true;
    }
  } else if (isGame(host.referrer, game) && host.hash === "" && host.historyLength > 1) {
    host.back();
    return true;
  }
  // A tab of its own, opened from the game: closing it shows the game again.
  return isGame(host.referrer, game) && host.historyLength === 1 && host.close();
}

/** Wires `link` so a plain click on it returns to the game the reader left, and follows the link otherwise. */
export function bindBackToGame(link: HTMLElement, host: BackToGameHost): void {
  link.addEventListener("click", (event) => {
    if (event.defaultPrevented || !isPlainClick(event)) return;
    if (returnToGame(host)) event.preventDefault();
  });
}

/** The live browser, as the link sees it. */
export function browserHost(window: Window): BackToGameHost {
  return {
    get href() {
      return window.location.href;
    },
    get referrer() {
      return window.document.referrer;
    },
    get hash() {
      return window.location.hash;
    },
    get historyLength() {
      return window.history.length;
    },
    // Older browsers lack it; the typings say otherwise.
    navigation: (window as { navigation?: Navigation }).navigation,
    back() {
      window.history.back();
    },
    close() {
      window.close();
      return window.closed;
    },
  };
}
