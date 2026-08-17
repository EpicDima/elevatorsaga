import { describe, expect, it } from "vitest";

import {
  buildGoodDispatcherCode,
  GOOD_CODE_BALANCED,
  GOOD_CODE_MOVE_CONSCIOUS,
} from "./challenge-reference-code.ts";
import { getCodeObjFromCode } from "./user-code.ts";

/**
 * Confirms the two presets are real, loadable programs.
 *
 * Not a simulated run — that is what a later calibration commit does, against
 * an actual {@link "./world.ts"!World}. What belongs here is the same check
 * `user-code.test.ts` runs on every program this codebase hands to
 * {@link "./user-code.ts"!getCodeObjFromCode}: the source parses, and the
 * result has callable `init` and `update` functions, so a syntax mistake in
 * the generated source is caught the moment this file changes rather than the
 * moment a later commit's calibration run tries to execute it.
 */
describe.each([
  ["GOOD_CODE_BALANCED", GOOD_CODE_BALANCED],
  ["GOOD_CODE_MOVE_CONSCIOUS", GOOD_CODE_MOVE_CONSCIOUS],
])("%s", (_name, code) => {
  it("is non-empty source", () => {
    expect(code.trim().length).toBeGreaterThan(0);
  });

  it("parses into an object with callable init and update", () => {
    const codeObj = getCodeObjFromCode(code);
    expect(typeof codeObj.init).toBe("function");
    expect(typeof codeObj.update).toBe("function");
  });

  it("runs init and update against an empty building without throwing", () => {
    const codeObj = getCodeObjFromCode(code);
    expect(() => {
      codeObj.init([], []);
    }).not.toThrow();
    expect(() => {
      codeObj.update(0.1, [], []);
    }).not.toThrow();
  });
});

describe("buildGoodDispatcherCode", () => {
  it("bakes the given load cutoff into the source", () => {
    const code = buildGoodDispatcherCode(0.42);
    expect(code).toContain("0.42");
  });

  it("produces a fresh, independently valid program for each cutoff", () => {
    const strict = getCodeObjFromCode(buildGoodDispatcherCode(0.1));
    const lenient = getCodeObjFromCode(buildGoodDispatcherCode(1));
    expect(typeof strict.init).toBe("function");
    expect(typeof lenient.init).toBe("function");
  });
});
