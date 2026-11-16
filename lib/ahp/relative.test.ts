import { describe, expect, it } from "vitest";
import { buildAlternativeScores, formatDecimal, parseDecimal, relativeLowerScores } from "./relative";

describe("relativeLowerScores", () => {
  it("menor valor = 100, maior = 0, o resto em linha reta", () => {
    const s = relativeLowerScores({ a: 10, b: 30, c: 20 });
    expect(s.a).toBe(100);
    expect(s.b).toBe(0);
    expect(s.c).toBe(50);
  });

  it("valores todos iguais, ou um só projeto, recebem 100", () => {
    expect(relativeLowerScores({ a: 5, b: 5 })).toEqual({ a: 100, b: 100 });
    expect(relativeLowerScores({ a: 7 })).toEqual({ a: 100 });
    expect(relativeLowerScores({})).toEqual({});
  });

  it("a nota de um projeto muda quando a carteira muda", () => {
    expect(relativeLowerScores({ a: 20, b: 10 }).a).toBe(0);
    expect(relativeLowerScores({ a: 20, b: 10, c: 30 }).a).toBe(50);
  });
});

describe("buildAlternativeScores", () => {
  it("mistura nota de faixa com nota relativa por subcritério", () => {
    const out = buildAlternativeScores(
      ["a", "b"],
      [
        { alternative_id: "a", subcriterion_id: "faixa", score_value: "80.00" },
        { alternative_id: "b", subcriterion_id: "faixa", score_value: 30 },
      ],
      [
        { alternative_id: "a", subcriterion_id: "eust", raw_value: "1000" },
        { alternative_id: "b", subcriterion_id: "eust", raw_value: 3000 },
      ]
    );
    expect(out.a).toEqual({ faixa: 80, eust: 100 });
    expect(out.b).toEqual({ faixa: 30, eust: 0 });
  });

  it("ignora linhas de alternativas que não estão na carteira", () => {
    const out = buildAlternativeScores(
      ["a", "b"],
      [],
      [
        { alternative_id: "a", subcriterion_id: "icms", raw_value: 18 },
        { alternative_id: "b", subcriterion_id: "icms", raw_value: 12 },
        { alternative_id: "fora", subcriterion_id: "icms", raw_value: 1 },
      ]
    );
    expect(out.b.icms).toBe(100);
    expect(out.a.icms).toBe(0);
    expect(out.fora).toBeUndefined();
  });
});

describe("parseDecimal / formatDecimal", () => {
  it("aceita formato brasileiro e simples", () => {
    expect(parseDecimal("17,5")).toBe(17.5);
    expect(parseDecimal("1.234,56")).toBe(1234.56);
    expect(parseDecimal("17.5")).toBe(17.5);
    expect(parseDecimal(" 120 ")).toBe(120);
  });

  it("recusa vazio, texto e negativo", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("-3")).toBeNull();
    expect(parseDecimal("1,2,3")).toBeNull();
  });

  it("formata com vírgula", () => {
    expect(formatDecimal(17.5)).toBe("17,5");
    expect(formatDecimal(120)).toBe("120");
  });
});
