import { describe, expect, it } from "vitest";
import { matchesAuto, pickScale } from "./auto-match";

describe("matchesAuto", () => {
  it("compara com os limites, respeitando aberto e fechado", () => {
    expect(matchesAuto(8, { lte: 8 })).toBe(true);
    expect(matchesAuto(8.01, { lte: 8 })).toBe(false);
    expect(matchesAuto(8, { gt: 8, lte: 16 })).toBe(false);
    expect(matchesAuto(16, { gt: 8, lte: 16 })).toBe(true);
    expect(matchesAuto(16, { gt: 16 })).toBe(false);
    expect(matchesAuto(18, { gt: 16 })).toBe(true);
    expect(matchesAuto(5, { eq: 5 })).toBe(true);
    expect(matchesAuto(5, { gte: 5, lt: 6 })).toBe(true);
  });

  it("condição vazia, inválida ou ausente nunca casa", () => {
    expect(matchesAuto(1, {})).toBe(false);
    expect(matchesAuto(1, null)).toBe(false);
    expect(matchesAuto(1, [])).toBe(false);
    expect(matchesAuto(1, { lte: "8" })).toBe(false);
    expect(matchesAuto(1, { foo: 1 })).toBe(false);
  });
});

describe("pickScale", () => {
  const scales = [
    { id: "a", auto_match: { lte: 8 } },
    { id: "b", auto_match: { gt: 8, lte: 16 } },
    { id: "c", auto_match: { gt: 16 } },
    { id: "d", auto_match: null },
  ];

  it("escolhe a faixa que cobre o valor", () => {
    expect(pickScale(4, scales)?.id).toBe("a");
    expect(pickScale(12, scales)?.id).toBe("b");
    expect(pickScale(30, scales)?.id).toBe("c");
  });

  it("sem faixa que cubra, devolve null", () => {
    expect(pickScale(5, [{ auto_match: { gt: 10 } }])).toBeNull();
  });
});
