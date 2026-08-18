// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { buildAppBarSkeleton } from "./app-bar.ts";

/** The brand text a test builds the skeleton with. */
const LABELS = { brandName: "Elevator Saga" };

describe("buildAppBarSkeleton", () => {
  it("builds the bar with the brand as its only child", () => {
    const { appBar, brand } = buildAppBarSkeleton(document, LABELS);

    expect(appBar.className).toBe("appbar");
    expect([...appBar.children]).toEqual([brand]);
  });

  it("builds the brand with the mark before the name", () => {
    const { brand } = buildAppBarSkeleton(document, LABELS);

    expect(brand.className).toBe("brand");
    expect(brand.children).toHaveLength(2);

    const [mark, name] = brand.children;
    expect(mark?.tagName).toBe("svg");
    expect(mark?.classList.contains("brand-mark")).toBe(true);
    expect(name?.tagName).toBe("SPAN");
    expect(name?.className).toBe("brand-name");
    expect(name?.textContent).toBe(LABELS.brandName);
  });

  it("hides the mark from assistive technology, since the name carries it", () => {
    const { brand } = buildAppBarSkeleton(document, LABELS);
    const mark = brand.querySelector(".brand-mark");

    expect(mark?.getAttribute("aria-hidden")).toBe("true");
  });

  it("draws the mark as a building: a frame and two shafts", () => {
    const { brand } = buildAppBarSkeleton(document, LABELS);
    const rects = brand.querySelectorAll(".brand-mark rect");

    expect(rects).toHaveLength(3);
  });

  it("names the brand with whatever the caller passes", () => {
    const { brand } = buildAppBarSkeleton(document, { brandName: "Лифтёр" });

    expect(brand.querySelector(".brand-name")?.textContent).toBe("Лифтёр");
  });
});
