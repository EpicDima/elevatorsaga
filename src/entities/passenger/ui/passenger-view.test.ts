// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { createPassengerView, userTemplate } from "./passenger-view.ts";
import { User } from "#game/user.ts";
import type { StageScale } from "#shared/lib/stage-scale.ts";
import { renderFragment } from "#shared/ui/markup.ts";

describe("createPassengerView", () => {
  it("draws the silhouette its display type asks for", () => {
    const child = createPassengerView(
      Object.assign(new User(80), { displayType: "child" as const }),
      {
        scaleX: 1,
        scaleY: 1,
      },
    );
    const male = createPassengerView(new User(80), { scaleX: 1, scaleY: 1 });

    expect(child.element.classList.contains("person")).toBe(true);
    expect(child.element.classList.contains("is-leaving")).toBe(false);
    // Every silhouette shares the 11x20 box -- that is what lets one CSS height
    // size all three and still stand them on the same line -- so the viewBox is
    // no longer what tells them apart. The outline is.
    expect(child.element.getAttribute("viewBox")).toBe(male.element.getAttribute("viewBox"));
    expect(child.element.innerHTML).not.toBe(male.element.innerHTML);
  });

  it("scales worldX/worldY by the live StageScale on every new_display_state", () => {
    const user = new User(80);
    const scale: StageScale = { scaleX: 2, scaleY: 0.5 };
    const view = createPassengerView(user, scale);

    user.moveTo(50, 40);
    user.updateDisplayPosition();

    expect(view.element.style.transform).toBe("translate3d(100px, 20px, 0)");
  });

  it("marks a delivered passenger as leaving and the longest wait as waiting long", () => {
    const user = new User(80);
    const view = createPassengerView(user, { scaleX: 1, scaleY: 1 });

    user.done = true;
    user.setWaitingLongest(true);

    expect(view.element.classList.contains("is-leaving")).toBe(true);
    expect(view.element.classList.contains("is-waiting-long")).toBe(true);
  });

  it("marks a passenger who has boarded as a rider, and unmarks them when they step out", () => {
    // The class the car's own colors hang off: --ds-person is tuned against
    // the shaft and is unreadable on a car, so a passenger has to say in the
    // DOM which of the two surfaces they are standing on.
    const user = new User(80);
    const view = createPassengerView(user, { scaleX: 1, scaleY: 1 });
    const car = new User(80);

    user.setParent(car);
    user.updateDisplayPosition(true);
    expect(view.element.classList.contains("is-rider")).toBe(true);

    user.setParent(null);
    user.updateDisplayPosition(true);
    expect(view.element.classList.contains("is-rider")).toBe(false);
  });

  it("removes the element once the passenger finishes walking off", () => {
    const user = new User(80);
    const view = createPassengerView(user, { scaleX: 1, scaleY: 1 });
    document.body.append(view.element);

    user.trigger("removed");

    expect(view.element.isConnected).toBe(false);
  });
});

describe("userTemplate", () => {
  it("draws each person type as its own glyph in the sprite icon family", () => {
    const drawn = new Set<string>();
    for (const type of ["male", "female", "child"] as const) {
      const person = renderFragment(userTemplate(type, false)).firstElementChild;
      expect(person?.getAttribute("class"), type).toBe("ds-icon person");
      expect(person?.getAttribute("viewBox"), type).toBe("0 0 11 20");
      drawn.add(person?.innerHTML ?? "");
    }
    expect(drawn.size, "two display types are drawing the same figure").toBe(3);
  });

  it("marks a delivered passenger as leaving", () => {
    const person = renderFragment(userTemplate("male", true)).firstElementChild;
    expect(person?.getAttribute("class")).toBe("ds-icon person is-leaving");
  });
});
