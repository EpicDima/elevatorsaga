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

  it("keeps unknown parameters, so they survive into the next-challenge link", () => {
    expect(parseQuery("#level=2,mystery=x").get("mystery")).toBe("x");
  });

  it("reads a key however it is capitalised, and leaves the value as written", () => {
    // Which shift key was held while typing `level` is not a decision
    // anybody makes on purpose. The value is data, and stays as written: two
    // seeds spelled differently are two different passenger streams.
    expect(parseQuery("#SEED=Abc").get("seed")).toBe("Abc");
    expect(parseQuery("#Level=3").get("level")).toBe("3");
    expect(parseQuery("#FULLSCREEN").get("fullscreen")).toBe("");
  });

  it("ignores whitespace around a key and around a value", () => {
    // The format's whitespace rule, in one place, so no resolver needs a trim of
    // its own. A browser cannot produce any of this -- it percent-encodes a
    // space in a fragment -- so the leniency is for hashes assembled in code,
    // decoded before they arrive, or written by hand.
    expect([...parseQuery("#level=4, seed = abc ")]).toEqual([
      ["level", "4"],
      ["seed", "abc"],
    ]);
  });

  it("holds one entry per key, whatever mixture of capitals wrote them", () => {
    // #SEED=abc was neither read as a seed nor dropped, so it rode along into
    // every URL built afterwards -- next to the seed that was read.
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
    // How the navigation row says "everything the player is carrying except the
    // seed", which belongs to the building being left rather than the next one.
    const query = parseQuery("#level=2,timescale=8,seed=issue-61");
    expect(createParamsUrl(query, { level: 3, seed: null })).toBe("#level=3,timescale=8");
  });

  it("says nothing about a parameter that was not there to drop", () => {
    expect(createParamsUrl(parseQuery("#level=2"), { seed: null })).toBe("#level=2");
  });

  it("round-trips a task address unchanged", () => {
    // The track is written into the same key as everything else, so the link in
    // the bar and the link in a chat message are the hash the player arrived on.
    const hash = "#level=tutorial-3,timescale=8,fullscreen=true";
    expect(createParamsUrl(parseQuery(hash))).toBe(hash);
  });

  it("cannot build a url that names one parameter twice", () => {
    // The property the whole of the case folding exists for: whatever the
    // player wrote, an override replaces the parameter rather than joining it.
    expect(createParamsUrl(parseQuery("#SEED=abc"), { seed: "xyz" })).toBe("#seed=xyz");
    expect(createParamsUrl(parseQuery("#seed=abc"), { SEED: "xyz" })).toBe("#seed=xyz");
    expect(createParamsUrl(parseQuery("#SEED=abc"), { seed: null })).toBe("#");
  });
});
