import { describe, expect, it } from "vitest";
import { isLocked, isScoring } from "./scoring";

describe("isScoring", () => {
  it("triagem nunca pontua", () => {
    expect(isScoring({ score_mode: "screening", trial: true }, false)).toBe(false);
    expect(isScoring({ score_mode: "screening", trial: true }, true)).toBe(false);
  });

  it("fora do trial, todos os demais pontuam", () => {
    expect(isScoring({ score_mode: "scale", trial: false }, false)).toBe(true);
    expect(isScoring({ score_mode: "relative_lower" }, false)).toBe(true);
  });

  it("no trial, só os marcados como trial", () => {
    expect(isScoring({ score_mode: "scale", trial: true }, true)).toBe(true);
    expect(isScoring({ score_mode: "scale", trial: false }, true)).toBe(false);
    expect(isScoring({ score_mode: "scale" }, true)).toBe(false);
  });
});

describe("isLocked", () => {
  it("só trava no trial, parâmetro não liberado e que não é triagem", () => {
    expect(isLocked({ score_mode: "scale", trial: false }, true)).toBe(true);
    expect(isLocked({ score_mode: "scale", trial: true }, true)).toBe(false);
    expect(isLocked({ score_mode: "scale", trial: false }, false)).toBe(false);
    expect(isLocked({ score_mode: "screening", trial: true }, true)).toBe(false);
  });
});
