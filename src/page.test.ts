// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import pageSource from "../index.html?raw";

/** The page shell, parsed as the browser would parse it. */
const page = new DOMParser().parseFromString(pageSource, "text/html");

describe("index.html", () => {
  it("is a module entry, with no other scripts", () => {
    const scripts = [...page.querySelectorAll("script")];
    expect(scripts.map((script) => [script.type, script.getAttribute("src")])).toEqual([
      ["module", "/src/main.ts"],
    ]);
  });

  it.each([
    // Queried by src/main.ts.
    ".code",
    "#button_reset",
    "#button_resetundo",
    "#button_apply",
    "#button_save",
    "#save_message",
    "#fitness_message",
    // Drawn into by src/app/app.ts and src/ui/presenters.ts.
    ".challenge",
    ".innerworld",
    ".statscontainer",
    ".feedbackcontainer",
    ".codestatus",
    // Required by presentStats.
    ".statscontainer .transportedcounter",
    ".statscontainer .elapsedtime",
    ".statscontainer .transportedpersec",
    ".statscontainer .avgwaittime",
    ".statscontainer .maxwaittime",
    ".statscontainer .movecount",
    // The scrolling frame the world is drawn inside.
    ".world .worldtrack .innerworld",
  ])("provides %s", (selector) => {
    expect(page.querySelector(selector)).not.toBeNull();
  });

  it("has one landmark of each kind, and a single top-level heading", () => {
    expect(page.querySelectorAll("header, main, footer")).toHaveLength(3);
    expect(page.querySelectorAll("h1")).toHaveLength(1);
  });

  it("no longer loads anything from a third party", () => {
    const remote = [...page.querySelectorAll("link[href], script[src], img[src]")].filter((node) =>
      /^(https?:)?\/\//.test(node.getAttribute("href") ?? node.getAttribute("src") ?? ""),
    );
    expect(remote).toEqual([]);
    expect(page.documentElement.innerHTML).not.toContain("google-analytics");
  });
});
