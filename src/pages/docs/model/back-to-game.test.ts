// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { type BackToGameHost, bindBackToGame, browserHost, returnToGame } from "./back-to-game.ts";

const DOCS = "https://example.com/saga/documentation.html";
const GAME = "https://example.com/saga/";

/** A history entry the Navigation API would list, at `index`. */
function entry(url: string | null, index: number): NavigationHistoryEntry {
  return { url, index, key: `key-${String(index)}` } as NavigationHistoryEntry;
}

/** A Navigation API whose tab holds `urls`, the one at `current` (by default the last) current. */
function navigationOver(
  urls: (string | null)[],
  current = urls.length - 1,
): NonNullable<BackToGameHost["navigation"]> {
  const entries = urls.map((url, index) => entry(url, index));
  return {
    currentEntry: entries[current] ?? null,
    entries: () => entries,
    traverseTo: vi.fn(),
  };
}

/** A browser that came to the reference page with no history and no Navigation API, but for `overrides`. */
function host(overrides: Partial<BackToGameHost> = {}): BackToGameHost {
  return {
    href: DOCS,
    referrer: "",
    hash: "",
    historyLength: 1,
    navigation: undefined,
    back: vi.fn(),
    close: vi.fn(() => true),
    ...overrides,
  };
}

describe("returnToGame with the Navigation API", () => {
  it("goes back to the latest game entry, past in-page links and language switches", () => {
    const navigation = navigationOver([
      `${GAME}#level=2`,
      `${GAME}index.html#level=5`,
      DOCS,
      `${DOCS}#events`,
      "https://example.com/saga/documentation.ru.html",
    ]);

    expect(returnToGame(host({ navigation, historyLength: 5 }))).toBe(true);
    expect(navigation.traverseTo).toHaveBeenCalledWith("key-1");
  });

  it("looks only behind the current entry", () => {
    const navigation = navigationOver([DOCS, GAME], 0);

    expect(returnToGame(host({ navigation, historyLength: 2 }))).toBe(false);
    expect(navigation.traverseTo).not.toHaveBeenCalled();
  });

  it.each([
    ["another site", "https://elsewhere.example/saga/"],
    ["another page of this site", "https://example.com/saga/documentation.ru.html"],
    ["another directory", "https://example.com/"],
    ["an entry with no address", null],
  ])("does not mistake %s for the game", (_, url) => {
    const navigation = navigationOver([url, DOCS]);

    expect(returnToGame(host({ navigation, historyLength: 2 }))).toBe(false);
    expect(navigation.traverseTo).not.toHaveBeenCalled();
  });

  it("closes a tab of its own that the game opened", () => {
    const close = vi.fn(() => true);

    expect(returnToGame(host({ navigation: navigationOver([DOCS]), referrer: GAME, close }))).toBe(
      true,
    );
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("returnToGame without the Navigation API", () => {
  it("steps back to the game it came from", () => {
    const back = vi.fn();

    expect(returnToGame(host({ referrer: GAME, historyLength: 3, back }))).toBe(true);
    expect(back).toHaveBeenCalledOnce();
  });

  it("follows the link once an in-page link has added history to step over", () => {
    const back = vi.fn();

    expect(returnToGame(host({ referrer: GAME, hash: "#events", historyLength: 3, back }))).toBe(
      false,
    );
    expect(back).not.toHaveBeenCalled();
  });

  it("follows the link when the reader came from somewhere else", () => {
    const back = vi.fn();
    const close = vi.fn(() => true);

    expect(
      returnToGame(host({ referrer: "https://www.google.com/", historyLength: 3, back, close })),
    ).toBe(false);
    expect(returnToGame(host({ referrer: "", close }))).toBe(false);
    expect(back).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("closes a tab of its own that the game opened", () => {
    const close = vi.fn(() => true);

    expect(returnToGame(host({ referrer: `${GAME}index.html`, close }))).toBe(true);
    expect(close).toHaveBeenCalledOnce();
  });

  it("follows the link when the browser will not close the tab", () => {
    expect(returnToGame(host({ referrer: GAME, close: () => false }))).toBe(false);
  });
});

describe("bindBackToGame", () => {
  /** A bound link whose host would return to the game on any click it lets through. */
  function boundLink(): { link: HTMLAnchorElement; back: ReturnType<typeof vi.fn> } {
    const link = document.createElement("a");
    link.href = "./";
    document.body.append(link);
    const back = vi.fn();
    bindBackToGame(link, host({ referrer: GAME, historyLength: 2, back }));
    return { link, back };
  }

  it("returns to the game on a plain click, in place of following the link", () => {
    const { link, back } = boundLink();
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });

    link.dispatchEvent(click);

    expect(back).toHaveBeenCalledOnce();
    expect(click.defaultPrevented).toBe(true);
  });

  it("follows the link on a plain click when there is no game to return to", () => {
    const link = document.createElement("a");
    document.body.append(link);
    bindBackToGame(link, host({ referrer: "https://www.google.com/" }));
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    let followed = false;
    link.addEventListener("click", (event) => {
      followed = !event.defaultPrevented;
      // Stops jsdom from attempting the navigation, which it cannot do.
      event.preventDefault();
    });

    link.dispatchEvent(click);

    expect(followed).toBe(true);
  });

  it.each(["ctrlKey", "metaKey", "shiftKey", "altKey"] as const)(
    "leaves a click with %s to the browser",
    (modifier) => {
      const { link, back } = boundLink();
      const click = new MouseEvent("click", { bubbles: true, cancelable: true, [modifier]: true });
      // Stops jsdom from attempting the navigation, which it cannot do.
      link.addEventListener("click", (event) => {
        event.preventDefault();
      });

      link.dispatchEvent(click);

      expect(back).not.toHaveBeenCalled();
    },
  );

  it("leaves a middle click to the browser", () => {
    const { link, back } = boundLink();
    link.addEventListener("click", (event) => {
      event.preventDefault();
    });

    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 1 }));

    expect(back).not.toHaveBeenCalled();
  });

  it("leaves a click something else has already handled", () => {
    const { link, back } = boundLink();
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    document.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
      },
      {
        capture: true,
        once: true,
      },
    );

    link.dispatchEvent(click);

    expect(back).not.toHaveBeenCalled();
  });
});

describe("browserHost", () => {
  it("reads the live browser each time it is asked", () => {
    const window = {
      location: { href: DOCS, hash: "" },
      document: { referrer: GAME },
      history: { length: 1, back: vi.fn() },
      navigation: undefined,
      closed: false,
      close: vi.fn(),
    };
    const live = browserHost(window as unknown as Window);
    window.location.hash = "#events";
    window.history.length = 4;

    expect([live.href, live.referrer, live.hash, live.historyLength, live.navigation]).toEqual([
      DOCS,
      GAME,
      "#events",
      4,
      undefined,
    ]);
    live.back();
    expect(window.history.back).toHaveBeenCalledOnce();
  });

  it("reports whether the browser agreed to close the tab", () => {
    const window = { closed: false, close: vi.fn() };
    const live = browserHost(window as unknown as Window);

    expect(live.close()).toBe(false);
    window.close.mockImplementation(() => {
      window.closed = true;
    });
    expect(live.close()).toBe(true);
  });
});
