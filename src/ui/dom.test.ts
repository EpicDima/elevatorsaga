// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearChildren,
  createElement,
  listen,
  query,
  queryAll,
  requireElement,
  setClass,
  setTransformPos,
} from "./dom.ts";

beforeEach(() => {
  document.body.replaceChildren();
});

describe("createElement", () => {
  it("creates a bare element when given no options", () => {
    const element = createElement("div");
    expect(element.tagName).toBe("DIV");
    expect(element.outerHTML).toBe("<div></div>");
  });

  it("applies class, text, attributes and inline styles", () => {
    const element = createElement("span", {
      className: "key emphasis-color",
      text: "Transported",
      attrs: { title: "How many people arrived" },
      style: { top: "20px" },
    });
    expect(element.className).toBe("key emphasis-color");
    expect(element.textContent).toBe("Transported");
    expect(element.getAttribute("title")).toBe("How many people arrived");
    expect(element.style.top).toBe("20px");
  });

  it("sets text without parsing it as markup", () => {
    const element = createElement("div", { text: "<script>boom()</script>" });
    expect(element.children).toHaveLength(0);
    expect(element.textContent).toBe("<script>boom()</script>");
  });

  it("appends element and string children in order", () => {
    const element = createElement("div", {
      children: [createElement("b", { text: "a" }), "b"],
    });
    expect(element.innerHTML).toBe("<b>a</b>b");
  });
});

describe("query / requireElement / queryAll", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div class="world"><i class="movable"></i><i class="movable"></i></div>`;
  });

  it("finds an element and returns null when there is none", () => {
    expect(query(".world")?.className).toBe("world");
    expect(query(".nope")).toBeNull();
  });

  it("scopes the search to the given root", () => {
    const world = requireElement(".world");
    expect(queryAll(".movable", world)).toHaveLength(2);
    expect(query(".world", world)).toBeNull();
  });

  it("throws a named error when a required element is missing", () => {
    expect(() => requireElement(".statscontainer")).toThrow(
      "Missing required element: .statscontainer",
    );
  });
});

describe("clearChildren", () => {
  it("empties an element", () => {
    const element = createElement("div", { children: [createElement("span"), "text"] });
    clearChildren(element);
    expect(element.innerHTML).toBe("");
  });
});

describe("setClass", () => {
  it("adds and removes a class without touching the others", () => {
    const element = createElement("i", { className: "fa up" });
    setClass(element, "activated", true);
    expect(element.className).toBe("fa up activated");
    setClass(element, "activated", false);
    expect(element.className).toBe("fa up");
  });
});

describe("setTransformPos", () => {
  it("positions with an unprefixed composited translate3d", () => {
    const element = createElement("div");
    setTransformPos(element, 105, 20.5);
    expect(element.style.transform).toBe("translate3d(105px, 20.5px, 0)");
  });

  it("writes no vendor-prefixed transform properties", () => {
    const element = createElement("div");
    setTransformPos(element, 1, 2);
    const style = element.getAttribute("style") ?? "";
    expect(style).not.toMatch(/-webkit-|-moz-|-ms-|-khtml-/);
  });
});

describe("listen", () => {
  it("returns an unsubscribe function", () => {
    const button = createElement("button");
    const handler = vi.fn();
    const unsubscribe = listen(button, "click", handler);

    button.dispatchEvent(new Event("click"));
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    button.dispatchEvent(new Event("click"));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
