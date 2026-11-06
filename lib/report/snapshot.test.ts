import { describe, expect, it } from "vitest";
import { EMPTY_GATES } from "../gates";
import { buildRunSnapshot } from "./snapshot";

describe("buildRunSnapshot", () => {
  const base = {
    model: { id: "m", name: "Projeto" },
    pillars: [{ id: "p1", name: "Financeiro" }],
    subcriteria: [{ id: "s1", pillar_id: "p1", name: "TUSD/TUST", weight_pct: "60.00" }],
    scales: [{ id: "sc1", description: "Tarifa baixa" }],
    scores: [{ alternative_id: "a1", subcriterion_id: "s1", scale_id: "sc1", score_value: "80.00" }],
    buses: [],
  };

  it("congela estrutura, escala escolhida e nota (numérica)", () => {
    const snap = buildRunSnapshot({
      ...base,
      alternatives: [{ id: "a1", name: "BESS 1", eliminated: false, powerMw: 100, gates: EMPTY_GATES, busId: null }],
    });
    expect(snap.version).toBe(1);
    expect(snap.pillars[0].subcriteria[0]).toEqual({ id: "s1", name: "TUSD/TUST", weightPct: 60 });
    expect(snap.alternatives[0].selections.s1).toEqual({ scaleId: "sc1", scaleDescription: "Tarifa baixa", score: 80 });
    expect(snap.alternatives[0].bus).toBeNull();
  });

  it("eliminado entra na foto, mas sem notas", () => {
    const snap = buildRunSnapshot({
      ...base,
      alternatives: [{ id: "a1", name: "BESS 1", eliminated: true, powerMw: null, gates: { ...EMPTY_GATES, rte: false }, busId: null }],
    });
    expect(snap.alternatives[0].eliminated).toBe(true);
    expect(snap.alternatives[0].selections).toEqual({});
    expect(snap.alternatives[0].gates.rte).toBe(false);
  });
});
