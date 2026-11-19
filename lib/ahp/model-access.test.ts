import { describe, expect, it } from "vitest";
import { isModelLocked } from "./model-access";

describe("isModelLocked", () => {
  it("no trial, só o modelo liberado abre", () => {
    expect(isModelLocked({ trial_available: true }, true)).toBe(false);
    expect(isModelLocked({ trial_available: false }, true)).toBe(true);
    expect(isModelLocked({}, true)).toBe(true);
  });

  it("fora do trial, tudo abre", () => {
    expect(isModelLocked({ trial_available: false }, false)).toBe(false);
  });
});
