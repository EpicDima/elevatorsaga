import { describe, expect, it } from "vitest";

import { createParamsUrl, parseQuery } from "./route-query.ts";

describe("parseQuery", () => {
  it("parses the legacy comma-separated form", () => {
    expect([...parseQuery("#level=3,timescale=8")]).toEqual([
      ["level", "3"],
      ["timescale", "8"],
    ]);
  });

  it("works with or without the leading hash, and on an empty hash", () => {
    expect([...parseQuery("level=3")]).toEqual([["level", "3"]]);
    expect([...parseQuery("#")]).toEqual([]);
    expect([...parseQuery("")]).toEqual([]);
  });

  it("accepts bare flags, which the legacy regexp silently dropped", () => {
    expect([...parseQuery("#fullscreen")]).toEqual([["fullscreen", ""]]);
  });

  it("keeps values the legacy regexp could not match", () => {
    // \w+$ never matched a decimal point, so #timescale=1.5 did nothing at all.
    expect(parseQuery("#timescale=1.5").get("timescale")).toBe("1.5");
  });

  it("keeps unknown parameters, so they survive into the next-level link", () => {
    expect(parseQuery("#level=2,mystery=x").get("mystery")).toBe("x");
  });

  it("reads a key however it is capitalized, and leaves the value as written", () => {
    // Keys are case-folded, since capitalization is accidental; values stay
    // as written, since two differently spelled seeds are different streams.
    expect(parseQuery("#SEED=Abc").get("seed")).toBe("Abc");
    expect(parseQuery("#Level=3").get("level")).toBe("3");
    expect(parseQuery("#FULLSCREEN").get("fullscreen")).toBe("");
  });

  it("ignores whitespace around a key and around a value", () => {
    // A browser never produces whitespace here -- it percent-encodes a space
    // in a fragment -- so this leniency is only for hashes assembled by code
    // or written by hand.
    expect([...parseQuery("#level=4, seed = abc ")]).toEqual([
      ["level", "4"],
      ["seed", "abc"],
    ]);
  });

  it("holds one entry per key, whatever mixture of capitals wrote them", () => {
    // Two spellings of the same key collapse to one entry, not two.
    expect([...parseQuery("#SEED=abc,seed=xyz")]).toEqual([["seed", "xyz"]]);
  });
});

describe("createParamsUrl", () => {
  it("merges overrides over the current parameters", () => {
    const query = parseQuery("#level=2,timescale=8");
    expect(createParamsUrl(query, { level: 3 })).toBe("#level=3,timescale=8");
  });

  it("appends parameters that were not in the url", () => {
    expect(createParamsUrl(parseQuery("#level=2"), { fullscreen: "true" })).toBe(
      "#level=2,fullscreen=true",
    );
  });

  it("does not modify the parameters it was given", () => {
    const query = parseQuery("#level=2");
    createParamsUrl(query, { level: 9 });
    expect(query.get("level")).toBe("2");
  });

  it("drops a parameter overridden with null, and keeps the rest", () => {
    // The seed belongs to the building being left, not the next one.
    const query = parseQuery("#level=2,timescale=8,seed=issue-61");
    expect(createParamsUrl(query, { level: 3, seed: null })).toBe("#level=3,timescale=8");
  });

  it("says nothing about a parameter that was not there to drop", () => {
    expect(createParamsUrl(parseQuery("#level=2"), { seed: null })).toBe("#level=2");
  });

  it("round-trips a level address unchanged", () => {
    // So the link in the bar and a link pasted into chat match exactly.
    const hash = "#level=tutorial-3,timescale=8,fullscreen=true";
    expect(createParamsUrl(parseQuery(hash))).toBe(hash);
  });

  it("cannot build a url that names one parameter twice", () => {
    // The reason case folding exists: an override replaces, never joins.
    expect(createParamsUrl(parseQuery("#SEED=abc"), { seed: "xyz" })).toBe("#seed=xyz");
    expect(createParamsUrl(parseQuery("#seed=abc"), { SEED: "xyz" })).toBe("#seed=xyz");
    expect(createParamsUrl(parseQuery("#SEED=abc"), { seed: null })).toBe("#");
  });
});
