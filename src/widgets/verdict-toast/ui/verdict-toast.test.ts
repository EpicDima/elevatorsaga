// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { presentVerdictToast, verdictToastTemplate } from "./verdict-toast.ts";
import type { VerdictToastData } from "./verdict-toast.ts";

/** Parses {@link verdictToastTemplate}'s output into a live element a test can query. */
function parse(html: string): HTMLElement {
  const parent = document.createElement("div");
  parent.innerHTML = html;
  const element = parent.firstElementChild;
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected an element");
  }
  return element;
}

/** A base {@link VerdictToastData} with no tier earned, for tests to override. */
function baseData(overrides: Partial<VerdictToastData> = {}): VerdictToastData {
  return {
    title: "Success!",
    message: "Well done",
    url: "",
    tier: undefined,
    ...overrides,
  };
}

describe("presentVerdictToast", () => {
  it("replaces any previous feedback", () => {
    const parent = document.createElement("div");
    parent.className = "feedbackcontainer";
    presentVerdictToast(parent, {
      title: "Level failed",
      message: "Try again",
      url: "",
      tier: undefined,
    });
    presentVerdictToast(parent, {
      title: "Success!",
      message: "Well done",
      url: "#challenge=4",
      tier: undefined,
    });

    expect(parent.children).toHaveLength(1);
    expect(parent.querySelector("h2")?.textContent).toBe("Success!");
    expect(parent.querySelector("a")?.getAttribute("href")).toBe("#challenge=4");
  });

  it("omits the next-challenge link when there is nowhere to go", () => {
    const parent = document.createElement("div");
    parent.className = "feedbackcontainer";
    presentVerdictToast(parent, {
      title: "Level failed",
      message: "Try again",
      url: "",
      tier: undefined,
    });
    expect(parent.querySelector("a")).toBeNull();
  });
});

describe("verdictToastTemplate", () => {
  it("draws markup identical to feedbackTemplate's when there is no tier", () => {
    const element = parse(verdictToastTemplate(baseData()));

    expect(element.className).toBe("feedback");
    expect(element.querySelector("h2")?.textContent).toBe("Success!");
    expect(element.querySelector("p")?.textContent).toBe("Well done");
    expect(element.querySelector(".stars")).toBeNull();
  });

  it("draws a tier badge beside the title when a tier is given", () => {
    const element = parse(verdictToastTemplate(baseData({ tier: "gold" })));

    const stars = element.querySelector(".stars");
    expect(stars).not.toBeNull();
    expect(stars?.getAttribute("data-tier")).toBe("gold");
    expect(element.querySelector("h2")?.contains(stars)).toBe(true);
    const lit = [...(stars?.querySelectorAll(".ds-icon") ?? [])].map((star) =>
      star.classList.contains("is-on"),
    );
    expect(lit).toEqual([true, true, true]);
  });

  it("draws no badge at all when there is no tier", () => {
    const html = verdictToastTemplate(baseData());
    expect(html).not.toContain("stars");
  });
});
