import { describe, expect, it } from "vitest";
import { perturbWeights, rankOrder, runSensitivity } from "./sensitivity";
import { groupPillars, reportPillarIndex } from "./pillars";

describe("perturbWeights", () => {
  it("soma o delta ao pilar e reduz os demais proporcionalmente, mantendo soma 1", () => {
    const w = perturbWeights([0.4, 0.3, 0.2, 0.1], 0, 10);
    expect(w[0]).toBeCloseTo(0.5);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(w[1] / w[2]).toBeCloseTo(0.3 / 0.2);
  });
  it("não passa de 100%", () => {
    expect(perturbWeights([0.9, 0.1, 0, 0], 0, 20)[0]).toBe(1);
  });
});

describe("runSensitivity", () => {
  const grouped = groupPillars(
    [
      { id: "a", name: "Financeiro" },
      { id: "b", name: "Engenharia" },
      { id: "c", name: "Conexão" },
      { id: "d", name: "Implantação / Operação" },
    ],
    { a: 0.4, b: 0.3, c: 0.2, d: 0.1 }
  );

  it("ranking que não depende do peso fica igual nos cenários", () => {
    const alts = [
      { name: "A", performance: [0.9, 0.9, 0.9, 0.9] },
      { name: "B", performance: [0.5, 0.5, 0.5, 0.5] },
    ];
    const r = runSensitivity(grouped, alts);
    expect(r.neutral).toEqual(["A", "B"]);
    expect([...r.conservative, ...r.execution].every((c) => !c.changed)).toBe(true);
  });

  it("detecta inversão quando o pilar reforçado favorece outro projeto", () => {
    const alts = [
      { name: "A", performance: [0.4, 0.9, 0.9, 0.9] },
      { name: "B", performance: [0.9, 0.5, 0.5, 0.5] },
    ];
    expect(rankOrder(alts, grouped.map((g) => g.weight))).toEqual(["A", "B"]);
    const r = runSensitivity(grouped, alts);
    expect(r.conservative[1].order[0]).toBe("B");
    expect(r.conservative[1].changed).toBe(true);
  });
});

describe("agrupamento de pilares", () => {
  it("Sócio Ambiental e Implantação entram no 4º pilar do relatório e os pesos somam", () => {
    expect(reportPillarIndex("Sócio Ambiental")).toBe(3);
    expect(reportPillarIndex("Implantação / Operação")).toBe(3);
    expect(reportPillarIndex("Financeiro")).toBe(0);
    expect(reportPillarIndex("Conexão")).toBe(2);
    const g = groupPillars(
      [
        { id: "a", name: "Financeiro" },
        { id: "d", name: "Implantação / Operação" },
        { id: "e", name: "Sócio Ambiental" },
      ],
      { a: 0.5, d: 0.3, e: 0.2 }
    );
    expect(g[3].pillarIds).toEqual(["d", "e"]);
    expect(g[3].weight).toBeCloseTo(0.5);
  });
});
