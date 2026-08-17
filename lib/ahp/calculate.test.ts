import { describe, expect, it } from "vitest";
import { calcularAHPGenerico } from "./calculate";
import type { AhpAlternativeInput, AhpPillarInput } from "./types";

/**
 * Caso de paridade: os valores esperados abaixo foram gerados rodando a transcrição fiel
 * da função `calcularAHPGenerico` do Apps Script legado (não uma reimplementação),
 * com os mesmos inputs, para garantir que o port em TypeScript produz resultados idênticos.
 */
describe("calcularAHPGenerico — paridade com o Apps Script legado", () => {
  const pillars: AhpPillarInput[] = [
    { id: "custo", subcriteria: [{ id: "preco", weightPct: 60 }, { id: "frete", weightPct: 40 }] },
    { id: "qualidade", subcriteria: [{ id: "certificacoes", weightPct: 100 }] },
    { id: "prazo", subcriteria: [{ id: "leadtime", weightPct: 100 }] },
  ];

  // Ordem dos sliders: (custo,qualidade), (custo,prazo), (qualidade,prazo) — i<j sobre `pillars`.
  const sliderValues = [-2, 1, -1];

  const alternatives: AhpAlternativeInput[] = [
    {
      id: "fornecedor-a",
      scores: { preco: 90, frete: 70, certificacoes: 60, leadtime: 80 },
    },
    {
      id: "fornecedor-b",
      scores: { preco: 50, frete: 100, certificacoes: 100, leadtime: 40 },
    },
  ];

  it("calcula pesos, lambdaMax e CR idênticos ao sistema legado", () => {
    const result = calcularAHPGenerico(pillars, sliderValues, alternatives);

    expect(result.pillarWeights[0]).toBeCloseTo(0.36984126984126986, 10);
    expect(result.pillarWeights[1]).toBeCloseTo(0.29788359788359786, 10);
    expect(result.pillarWeights[2]).toBeCloseTo(0.33227513227513233, 10);
    expect(result.lambdaMax).toBeCloseTo(3.7362433862433866, 10);
    expect(result.consistencyRatio).toBeCloseTo(0.6346925743477471, 10);
  });

  it("rankeia as alternativas com o score final idêntico ao sistema legado", () => {
    const result = calcularAHPGenerico(pillars, sliderValues, alternatives);
    const [first, second] = result.ranking;

    expect(first.alternativeId).toBe("fornecedor-a");
    expect(first.finalScore).toBeCloseTo(747.8201058201059, 8);
    expect(first.pillarScores[0]).toBeCloseTo(303.2698412698413, 8);
    expect(first.pillarScores[1]).toBeCloseTo(178.7301587301587, 8);
    expect(first.pillarScores[2]).toBeCloseTo(265.8201058201059, 8);
    expect(first.pillarScoresRadar[0]).toBeCloseTo(8.2, 8);
    expect(first.pillarScoresRadar[1]).toBeCloseTo(6, 8);
    expect(first.pillarScoresRadar[2]).toBeCloseTo(8, 8);
    expect(first.rank).toBe(1);

    expect(second.alternativeId).toBe("fornecedor-b");
    expect(second.finalScore).toBeCloseTo(689.6825396825398, 8);
    expect(second.rank).toBe(2);
  });

  it("retorna CR=0 para modelos com até 2 pilares (matriz sempre consistente)", () => {
    const twoPillars: AhpPillarInput[] = [
      { id: "a", subcriteria: [{ id: "sa", weightPct: 100 }] },
      { id: "b", subcriteria: [{ id: "sb", weightPct: 100 }] },
    ];
    const result = calcularAHPGenerico(twoPillars, [3], [{ id: "alt", scores: { sa: 50, sb: 50 } }]);
    expect(result.consistencyRatio).toBe(0);
  });

  it("mapeia o slider 0 para importância igual (Saaty = 1)", () => {
    const twoPillars: AhpPillarInput[] = [
      { id: "a", subcriteria: [{ id: "sa", weightPct: 100 }] },
      { id: "b", subcriteria: [{ id: "sb", weightPct: 100 }] },
    ];
    const result = calcularAHPGenerico(twoPillars, [0], [{ id: "alt", scores: { sa: 100, sb: 0 } }]);
    expect(result.pillarWeights[0]).toBeCloseTo(0.5, 10);
    expect(result.pillarWeights[1]).toBeCloseTo(0.5, 10);
  });
});
