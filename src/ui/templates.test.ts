// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  challengeTemplate,
  codeStatusTemplate,
  elevatorButtonTemplate,
  elevatorTemplate,
  escapeHtml,
  feedbackTemplate,
  floorTemplate,
  markup,
  raw,
  renderElement,
  renderFragment,
  userTemplate,
} from "./templates.ts";

describe("escapeHtml", () => {
  it("escapes every character that could break out of markup", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeHtml("Challenge #3")).toBe("Challenge #3");
  });
});

describe("markup", () => {
  it("escapes interpolated values", () => {
    const evil = `"><img src=x onerror=alert(1)>`;
    expect(markup`<a href="${evil}"></a>`).toBe(
      `<a href="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"></a>`,
    );
  });

  it("inserts raw values verbatim", () => {
    expect(markup`<p>${raw("<b>hi</b>")}</p>`).toBe("<p><b>hi</b></p>");
  });

  it("stringifies numbers", () => {
    expect(markup`<div style="top: ${150}px"></div>`).toBe(`<div style="top: 150px"></div>`);
  });

  it("handles a template with no interpolations", () => {
    expect(markup`<hr>`).toBe("<hr>");
  });
});

describe("renderFragment / renderElement", () => {
  it("parses markup without running or loading anything", () => {
    const fragment = renderFragment(`<img src="/nope.png"><span>ok</span>`);
    expect(fragment.children).toHaveLength(2);
  });

  it("returns the single element of a one-element template", () => {
    expect(renderElement("<div class='floor'></div>").className).toBe("floor");
  });

  it("rejects markup that is not exactly one element", () => {
    expect(() => renderElement("<div></div><div></div>")).toThrow("exactly one element");
    expect(() => renderElement("just text")).toThrow("exactly one element");
  });
});

describe("floorTemplate", () => {
  it("positions the floor and shows its number", () => {
    const floor = renderElement(floorTemplate(2, 150));
    expect(floor.className).toBe("floor");
    expect(floor.style.top).toBe("150px");
    expect(floor.querySelector(".floornumber")?.textContent).toBe("2");
  });

  it("makes the call buttons real, labelled buttons", () => {
    const floor = renderElement(floorTemplate(2, 150));
    const up = floor.querySelector("button.up");
    const down = floor.querySelector("button.down");
    expect(up?.getAttribute("aria-label")).toBe("Call an elevator going up from floor 2");
    expect(down?.getAttribute("aria-label")).toBe("Call an elevator going down from floor 2");
    expect(up?.getAttribute("aria-pressed")).toBe("false");
    expect(down?.getAttribute("aria-pressed")).toBe("false");
    expect(up?.getAttribute("type")).toBe("button");
  });

  it("keeps exactly one space between the two call buttons", () => {
    const floor = renderElement(floorTemplate(0, 0));
    const indicator = floor.querySelector(".buttonindicator");
    expect(indicator?.childNodes[1]?.textContent).toBe(" ");
  });
});

describe("elevatorTemplate", () => {
  it("sets the car width and keeps the movable class", () => {
    const elevator = renderElement(elevatorTemplate(40, 0));
    expect(elevator.className).toBe("elevator movable");
    expect(elevator.style.width).toBe("40px");
  });

  it("renders both direction indicators and the empty indicator slots", () => {
    const elevator = renderElement(elevatorTemplate(40, 1));
    expect(elevator.querySelector(".directionindicatorup .up.activated")).not.toBeNull();
    expect(elevator.querySelector(".directionindicatordown .down.activated")).not.toBeNull();
    expect(elevator.querySelector(".floorindicator > span")?.textContent).toBe("");
    expect(elevator.querySelector(".buttonindicator")?.children).toHaveLength(0);
    expect(elevator.getAttribute("aria-label")).toBe("Elevator 2");
  });
});

describe("elevatorButtonTemplate", () => {
  it("renders a labelled button holding just the floor number", () => {
    const button = renderElement(elevatorButtonTemplate(7));
    expect(button.tagName).toBe("BUTTON");
    expect(button.className).toBe("buttonpress");
    expect(button.textContent).toBe("7");
    expect(button.getAttribute("aria-label")).toBe("Go to floor 7");
  });

  it("introduces no whitespace, so the buttons stay flush against each other", () => {
    const source = elevatorButtonTemplate(0) + elevatorButtonTemplate(1);
    const fragment = renderFragment(source);
    expect(fragment.childNodes).toHaveLength(2);
    expect(fragment.textContent).toBe("01");
  });
});

describe("userTemplate", () => {
  it("draws each person type as a movable user", () => {
    for (const type of ["male", "female", "child"] as const) {
      const user = renderFragment(userTemplate(type, false)).firstElementChild;
      expect(user?.getAttribute("class"), type).toBe(`icon movable user`);
    }
  });

  it("marks a delivered passenger as leaving", () => {
    const user = renderFragment(userTemplate("male", true)).firstElementChild;
    expect(user?.getAttribute("class")).toBe("icon movable user leaving");
  });
});

describe("challengeTemplate", () => {
  it("inserts the challenge description as markup", () => {
    const fragment = renderFragment(
      challengeTemplate({ num: 3, description: "Transport <span class='x'>15</span> people" }),
    );
    const title = fragment.querySelector(".challengetitle");
    expect(title?.textContent).toBe("Challenge #3: Transport 15 people");
    expect(title?.querySelector(".x")?.textContent).toBe("15");
  });

  it("makes the time-scale controls real, labelled buttons", () => {
    const fragment = renderFragment(challengeTemplate({ num: 1, description: "x" }));
    expect(fragment.querySelector("button.timescale_decrease")?.getAttribute("aria-label")).toBe(
      "Decrease simulation speed",
    );
    expect(fragment.querySelector("button.timescale_increase")?.getAttribute("aria-label")).toBe(
      "Increase simulation speed",
    );
    expect(fragment.querySelector("button.startstop")).not.toBeNull();
  });
});

describe("feedbackTemplate", () => {
  it("renders the next-challenge link when there is a url", () => {
    const feedback = renderElement(
      feedbackTemplate({ title: "Success!", message: "Well done", url: "#challenge=4" }),
    );
    expect(feedback.querySelector("h2")?.textContent).toBe("Success!");
    expect(feedback.querySelector("p")?.textContent).toBe("Well done");
    expect(feedback.querySelector("a")?.getAttribute("href")).toBe("#challenge=4");
  });

  it("omits the link entirely when there is no url", () => {
    const feedback = renderElement(
      feedbackTemplate({ title: "Challenge failed", message: "Try again", url: "" }),
    );
    expect(feedback.querySelector("a")).toBeNull();
  });

  it("escapes a url rebuilt from the location hash", () => {
    const feedback = renderElement(
      feedbackTemplate({ title: "t", message: "m", url: `#a="><script>x</script>` }),
    );
    expect(feedback.querySelector("script")).toBeNull();
    expect(feedback.querySelector("a")?.getAttribute("href")).toBe(`#a="><script>x</script>`);
  });

  it("leaves the live region to the container it is inserted into", () => {
    // The overlay is created already populated and then inserted, and a
    // role="status" that a screen reader first meets in that state is normally
    // not announced. The live region is the .feedbackcontainer in index.html,
    // which is in the document from the start; see the page test.
    const feedback = renderElement(
      feedbackTemplate({ title: "Success!", message: "Well done", url: "" }),
    );
    expect(feedback.getAttribute("role")).toBeNull();
    expect(feedback.querySelector("[role], [aria-live]")).toBeNull();
  });
});

describe("codeStatusTemplate", () => {
  it("renders a warning banner with an empty message slot", () => {
    const banner = renderElement(codeStatusTemplate());
    expect(banner.className).toBe("error");
    expect(banner.querySelector(".error-color")).not.toBeNull();
    expect(banner.querySelector(".errormessage")?.textContent).toBe("");
  });
});
