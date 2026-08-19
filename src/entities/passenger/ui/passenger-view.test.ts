// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { createPassengerView, userTemplate } from "./passenger-view.ts";
import { User } from "#game/user.ts";
import type { StageScale } from "#shared/lib/stage-scale.ts";
import { renderFragment } from "#shared/ui/markup.ts";

describe("createPassengerView", () => {
  it("draws the passenger's icon for their display type", () => {
    const child = createPassengerView(
      Object.assign(new User(80), { displayType: "child" as const }),
      {
        scaleX: 1,
        scaleY: 1,
      },
    );
    const male = createPassengerView(new User(80), { scaleX: 1, scaleY: 1 });

    expect(child.element.classList.contains("user")).toBe(true);
    expect(child.element.classList.contains("leaving")).toBe(false);
    // displayType picks which icon glyph is drawn, not a CSS class — the
    // glyph's advance (viewBox width) is how the two icons differ visibly.
    expect(child.element.getAttribute("viewBox")).not.toBe(male.element.getAttribute("viewBox"));
  });

  it("scales worldX/worldY by the live StageScale on every new_display_state", () => {
    const user = new User(80);
    const scale: StageScale = { scaleX: 2, scaleY: 0.5 };
    const view = createPassengerView(user, scale);

    user.moveTo(50, 40);
    user.updateDisplayPosition();

    expect(view.element.style.transform).toBe("translate3d(100px, 20px, 0)");
  });

  it("marks a delivered passenger as leaving and the longest wait as waiting-longest", () => {
    const user = new User(80);
    const view = createPassengerView(user, { scaleX: 1, scaleY: 1 });

    user.done = true;
    user.setWaitingLongest(true);

    expect(view.element.classList.contains("leaving")).toBe(true);
    expect(view.element.classList.contains("waiting-longest")).toBe(true);
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
