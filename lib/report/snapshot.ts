import type { GridBus } from "@/lib/grid/types";

/**
 * "Foto" dos dados usados numa execução. Fica gravada em ahp_runs.inputs_snapshot para o relatório
 * reproduzir a rodada mesmo que fichas, escalas ou filtros sejam editados depois.
 */
export interface RunSnapshot {
  version: 1;
  model: { id: string; name: string };
  pillars: {
    id: string;
    name: string;
    subcriteria: { id: string; name: string; weightPct: number }[];
  }[];
  alternatives: {
    id: string;
    name: string;
    powerMw: number | null;
    bus: GridBus | null;
    /** subcriterionId -> escolha feita na ficha. */
    selections: Record<string, { scaleId: string; scaleDescription: string; score: number }>;
  }[];
}

interface SnapshotInput {
  model: { id: string; name: string };
  pillars: { id: string; name: string }[];
  subcriteria: { id: string; pillar_id: string; name: string; weight_pct: number | string }[];
  scales: { id: string; description: string }[];
  alternatives: {
    id: string;
    name: string;
    powerMw: number | null;
    busId: string | null;
  }[];
  scores: { alternative_id: string; subcriterion_id: string; scale_id: string; score_value: number | string }[];
  buses: GridBus[];
}

export function buildRunSnapshot(input: SnapshotInput): RunSnapshot {
  const scaleById = new Map(input.scales.map((s) => [s.id, s.description]));
  const busById = new Map(input.buses.map((b) => [b.id, b]));

  return {
    version: 1,
    model: input.model,
    pillars: input.pillars.map((pillar) => ({
      id: pillar.id,
      name: pillar.name,
      subcriteria: input.subcriteria
        .filter((s) => s.pillar_id === pillar.id)
        .map((s) => ({ id: s.id, name: s.name, weightPct: Number(s.weight_pct) })),
    })),
    alternatives: input.alternatives.map((alt) => ({
      id: alt.id,
      name: alt.name,
      powerMw: alt.powerMw,
      bus: alt.busId ? (busById.get(alt.busId) ?? null) : null,
      selections: Object.fromEntries(
        input.scores
          .filter((sc) => sc.alternative_id === alt.id)
          .map((sc) => [
            sc.subcriterion_id,
            {
              scaleId: sc.scale_id,
              scaleDescription: scaleById.get(sc.scale_id) ?? "",
              score: Number(sc.score_value),
            },
          ])
      ),
    })),
  };
}
