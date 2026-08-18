import { describe, expect, it } from "vitest";

import { API_REFERENCE } from "./reference.ts";

describe("API_REFERENCE", () => {
  it("has an elevator group of sixteen entries and a floor group of three", () => {
    expect(API_REFERENCE.map((group) => group.entries.length)).toEqual([16, 3]);
  });

  it("gives every group a label key named after none of its own entries", () => {
    expect(API_REFERENCE.map((group) => group.labelKey)).toEqual([
      "game.apiRef.elevator.groupLabel",
      "game.apiRef.floor.groupLabel",
    ]);
  });

  it("gives every entry an id unique within its own group", () => {
    for (const group of API_REFERENCE) {
      const ids = group.entries.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("gives every entry a non-empty signature", () => {
    for (const group of API_REFERENCE) {
      for (const entry of group.entries) {
        expect(entry.sig.length).toBeGreaterThan(0);
      }
    }
  });

  it("names every entry's three keys after its own group and id", () => {
    for (const group of API_REFERENCE) {
      const groupName = group.labelKey.replace(/^game\.apiRef\.([^.]+)\.groupLabel$/, "$1");
      for (const entry of group.entries) {
        const prefix = `game.apiRef.${groupName}.${entry.id}.`;
        expect(entry.shortKey).toBe(`${prefix}short`);
        expect(entry.moreKey).toBe(`${prefix}more`);
        expect(entry.codeKey).toBe(`${prefix}code`);
      }
    }
  });

  it("keeps every entry's three keys distinct", () => {
    for (const group of API_REFERENCE) {
      for (const entry of group.entries) {
        expect(new Set([entry.shortKey, entry.moreKey, entry.codeKey]).size).toBe(3);
      }
    }
  });
});
