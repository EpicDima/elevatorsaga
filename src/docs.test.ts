// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { renderDocsPage } from "./docs-page/render.ts";
import { queryAll } from "#shared/lib/dom.ts";

/** A Mac user agent, whose modifier key is spelled differently from the one in the markup. */
const MAC_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

/** A Windows user agent, whose modifier key is spelled as the markup already has it. */
const WINDOWS_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

/** Puts the built reference page up, minus its script, and runs the entry point over it by hand. */
async function boot(userAgent: string): Promise<void> {
  const parsed = new DOMParser().parseFromString(renderDocsPage("en"), "text/html");
  for (const script of parsed.querySelectorAll("script")) {
    script.remove();
  }
  document.documentElement.replaceWith(document.importNode(parsed.documentElement, true));
  Object.defineProperty(navigator, "userAgent", { value: userAgent, configurable: true });
  // A fresh module graph, so the entry point's module-scope work runs again.
  vi.resetModules();
  await import("./docs.ts");
}

/** How every modifier key on the page is spelled right now. */
function modifierKeys(): (string | null)[] {
  return queryAll("kbd[data-mod-key]").map((key) => key.textContent);
}

describe("the reference page's entry point", () => {
  it("respells the modifier keys for a Mac, and only those", async () => {
    await boot(MAC_USER_AGENT);

    expect(modifierKeys()).toEqual(["⌘", "⌘"]);
    // The keys next to them name themselves on every platform.
    expect(queryAll("kbd:not([data-mod-key])").map((key) => key.textContent)).toEqual([
      "Enter",
      "S",
      "Tab",
      "Esc",
    ]);
  });

  it("asks the platform rather than assuming one", async () => {
    await boot(WINDOWS_USER_AGENT);

    expect(modifierKeys()).toEqual(["Ctrl", "Ctrl"]);
  });
});
