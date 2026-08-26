// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { createElement, MemoryStorage } from "../../../ui/test-helpers.ts";
import { presentLanguagePicker } from "./language-picker.ts";
import { DEFAULT_LOCALE, getLocale, LOCALE_STORAGE_KEY, setLocale, t } from "#i18n/index.ts";

/** The control, the storage behind it and the redraw it is wired to. */
interface Harness {
  select: HTMLSelectElement;
  storage: MemoryStorage;
  redraw: ReturnType<typeof vi.fn>;
}

/** A language picker, filled and wired, over an empty `<select>`. */
function setUp(storage: MemoryStorage = new MemoryStorage()): Harness {
  const select = createElement("select", { className: "langpick" });
  document.body.replaceChildren(select);
  const redraw = vi.fn();
  presentLanguagePicker({ select, storage, redraw });
  return { select, storage, redraw };
}

/** Chooses a language the way a reader does: the browser sets `value` and raises `change`. */
function choose(select: HTMLSelectElement, locale: string): void {
  select.value = locale;
  select.dispatchEvent(new Event("change"));
}

/** Lets everything the choice started finish; a task rather than a microtask, since `loadLocale`'s own tick count isn't this test's business. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  // On the hook rather than in the tests, so a failing assertion cannot leave the rest of the file running in Russian.
  setLocale(DEFAULT_LOCALE);
});

describe("presentLanguagePicker", () => {
  it("fills an empty control with every language the game speaks", () => {
    const { select } = setUp();

    expect([...select.options].map((option) => option.value)).toEqual(["en", "ru"]);
  });

  it("names each language in that language, not in the reader's current one", () => {
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
    // Drawing the control is still start-up, which deliberately remembers nothing.
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

  it("waits for the catalog, so the page is redrawn once and in the new language", async () => {
    // Redrawing before the catalog lands would rewrite everything in English, with nothing watching the fetch to redraw it again.
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
    // A refused write shouldn't keep the game in a language the reader just said they can't read.
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

  it("lets the reader change their mind while a catalog is still in flight", async () => {
    // The first fetch can settle after the second; only the newest choice may be written down or drawn.
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
