import { describe, expect, it } from "vitest";

import { changedLines } from "./line-diff.ts";

describe("changedLines", () => {
  it("marks nothing between two identical programs", () => {
    const program = 'elevator.on("idle", function() {\n    elevator.goToFloor(0);\n});';
    expect(changedLines(program, program)).toEqual(new Set());
  });

  it("marks a line appended to the end", () => {
    const before = ["elevator.goToFloor(0);"].join("\n");
    const after = ["elevator.goToFloor(0);", "elevator.goToFloor(1);"].join("\n");
    expect(changedLines(before, after)).toEqual(new Set([1]));
  });

  it("marks one line rewritten in the middle, and nothing either side of it", () => {
    const before = ["const a = 1;", "elevator.goingDownIndicator(false);", "const b = 2;"].join(
      "\n",
    );
    const after = ["const a = 1;", "elevator.goingDownIndicator(true);", "const b = 2;"].join("\n");
    expect(changedLines(before, after)).toEqual(new Set([1]));
  });

  it("marks two separate lines that changed, not the untouched line between them", () => {
    const before = ["one", "two", "three", "four", "five"].join("\n");
    const after = ["ONE", "two", "three", "FOUR", "five"].join("\n");
    expect(changedLines(before, after)).toEqual(new Set([0, 3]));
  });

  it("marks nothing when the only change is a line removed", () => {
    const before = ["one", "two", "three"].join("\n");
    const after = ["one", "three"].join("\n");
    expect(changedLines(before, after)).toEqual(new Set());
  });

  it("does not mark lines that only moved together, keeping their own text", () => {
    // The docs on `changedLines` are explicit about this: the longest common
    // subsequence is not a fixed position, so lines kept verbatim but
    // reordered are "kept" rather than "changed" -- as long as reordering
    // them doesn't break the relative order of the longest run the two
    // programs still share. Here "A", "B", "C" all shift down one line but
    // keep their order relative to each other, so none of them is marked;
    // only "D", which jumps from the end to the front and so breaks that
    // order, is.
    const before = ["A", "B", "C", "D"].join("\n");
    const after = ["D", "A", "B", "C"].join("\n");
    expect(changedLines(before, after)).toEqual(new Set([0]));
  });

  it("marks every line of a program with nothing in common with its start", () => {
    const before = "elevator.goToFloor(0);";
    const after = ['floor.on("up_button_pressed", function() {', "});"].join("\n");
    expect(changedLines(before, after)).toEqual(new Set([0, 1]));
  });

  it("marks the only line there is when the starting program is empty", () => {
    expect(changedLines("", "elevator.goToFloor(1);")).toEqual(new Set([0]));
  });

  it("finds the one line task 1 actually adds", () => {
    // The real shape this exists for: two drafts of the same program, differing
    // by exactly the line the third hint tells a player to add.
    const before = [
      "{",
      "    init: function(elevators, floors) {",
      "        const elevator = elevators[0];",
      "",
      '        elevator.on("idle", function() {',
      "            elevator.goToFloor(0);",
      "        });",
      "    },",
      "    update: function(dt, elevators, floors) {",
      "    }",
      "}",
    ].join("\n");
    const after = [
      "{",
      "    init: function(elevators, floors) {",
      "        const elevator = elevators[0];",
      "",
      '        elevator.on("idle", function() {',
      "            elevator.goToFloor(0);",
      "            elevator.goToFloor(1);",
      "        });",
      "    },",
      "    update: function(dt, elevators, floors) {",
      "    }",
      "}",
    ].join("\n");
    expect(changedLines(before, after)).toEqual(new Set([6]));
  });
});
