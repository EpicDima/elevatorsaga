// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_LOCALE, getLocale, LOCALE_STORAGE_KEY, setLocale, t } from "../i18n/index.ts";
import { presentLanguagePicker } from "./language-picker.ts";
import { createElement, MemoryStorage } from "./test-helpers.ts";

/** The control, the storage behind it and the redraw it is wired to. */
interface Harness {
  select: HTMLSelectElement;
  storage: MemoryStorage;
  redraw: ReturnType<typeof vi.fn>;
}

/**
 * A language picker, filled and wired, over an empty `<select>`.
 *
 * @param storage - Where the choice is remembered; a fresh map by default.
 * @returns The control and what it was given.
 */
function setUp(storage: MemoryStorage = new MemoryStorage()): Harness {
  const select = createElement("select", { className: "languagepicker" });
  document.body.replaceChildren(select);
  const redraw = vi.fn();
  presentLanguagePicker({ select, storage, redraw });
  return { select, storage, redraw };
}

/**
 * Chooses a language the way a reader does.
 *
 * The browser sets `value` and raises `change`; nothing else about a real
 * choice reaches this module.
 *
 * @param select - The control.
 * @param locale - What was chosen.
 */
function choose(select: HTMLSelectElement, locale: string): void {
  select.value = locale;
  select.dispatchEvent(new Event("change"));
}

/**
 * Lets everything the choice started finish.
 *
 * A task rather than a microtask or two: the handler awaits `loadLocale`, and
 * how many ticks that takes is the loader's business rather than this test's.
 *
 * @returns A promise that settles once the queue has drained.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  // On the hook rather than in the tests, so a failing assertion cannot leave
  // the rest of the file running in Russian.
  setLocale(DEFAULT_LOCALE);
});

describe("presentLanguagePicker", () => {
  it("fills an empty control with every language the game speaks", () => {
    // The shell ships the `<select>` with nothing in it, so this list and the
    // one `src/i18n/locale.ts` keeps cannot disagree.
    const { select } = setUp();

    expect([...select.options].map((option) => option.value)).toEqual(["en", "ru"]);
  });

  it("names each language in that language, not in the reader's current one", () => {
    // A picker shows every option at once, and the reader who most needs this
    // control is the one who cannot read the language the page is in. "Русский"
    // is the word they will recognise; "Russian" is not.
    setLocale("ru");
    const { select } = setUp();

    expect([...select.options].map((option) => option.textContent)).toEqual(["English", "Русский"]);
  });

  it("shows the language the page is already being read in", () => {
    setLocale("ru");
    const { select } = setUp();

    expect(select.value).toBe("ru");
  });

  it("writes nothing to storage until a reader chooses something", () => {
    // Start-up deliberately remembers nothing -- see the header of
    // `preferred-locale.ts` -- and drawing the control is still start-up.
    const { storage } = setUp();

    expect(storage.length).toBe(0);
  });

  it("changes the language, remembers it, and redraws the page in it", async () => {
    const { select, storage, redraw } = setUp();

    choose(select, "ru");
    await settle();

    expect(getLocale()).toBe("ru");
    expect(storage.getItem(LOCALE_STORAGE_KEY)).toBe("ru");
    expect(redraw).toHaveBeenCalledTimes(1);
  });

  it("waits for the catalogue, so the page is redrawn once and in the new language", async () => {
    // Redrawing before the catalogue is in memory would rewrite everything in
    // English -- `t` falls back until it lands -- and nothing would redraw it
    // afterwards, because nobody is watching the fetch.
    const { select, redraw } = setUp();
    let languageAtRedraw = "";
    redraw.mockImplementation(() => {
      languageAtRedraw = t("game.feedback.success.title");
    });

    choose(select, "ru");
    expect(redraw).not.toHaveBeenCalled();
    await settle();

    expect(languageAtRedraw).toBe("Получилось!");
  });

  it("changes the language even when the browser refuses to remember it", async () => {
    // Safari in private mode is the one everybody meets. A refused write is a
    // reason for the choice not to survive the tab, not a reason for the game to
    // stay in a language the reader has just said they cannot read -- the same
    // trade the time scale makes in `app.ts`.
    const storage = new MemoryStorage();
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    const { select, redraw } = setUp(storage);

    choose(select, "ru");
    await settle();

    expect(getLocale()).toBe("ru");
    expect(redraw).toHaveBeenCalledTimes(1);
  });

  it("lets the reader change their mind while a catalogue is still in flight", async () => {
    // Two choices in a row leave two of these running at once, and the fetch
    // that started first can settle last. Only the newest choice may be written
    // down or drawn: the other one is a language nobody is looking at.
    const { select, storage, redraw } = setUp();
    const written = vi.spyOn(storage, "setItem");

    choose(select, "ru");
    choose(select, "en");
    await settle();

    expect(getLocale()).toBe("en");
    expect(written.mock.calls).toEqual([[LOCALE_STORAGE_KEY, "en"]]);
    expect(redraw).toHaveBeenCalledTimes(1);
  });
});
