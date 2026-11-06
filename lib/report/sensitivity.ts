import type { GroupedPillar } from "./pillars";

export interface SensitivityAlternative {
  name: string;
  /** Desempenho (0–1) em cada um dos 4 pilares do relatório. */
  performance: number[];
}

export interface SensitivityCase {
  label: string;
  order: string[];
  changed: boolean;
}

/** Soma delta (em pontos percentuais) ao pilar `target` e reduz os demais na mesma proporção, mantendo soma 1. */
export function perturbWeights(weights: number[], target: number, deltaPp: number): number[] {
  const current = weights[target];
  const wanted = Math.min(1, Math.max(0, current + deltaPp / 100));
  const others = 1 - current;
  return weights.map((w, i) => {
    if (i === target) return wanted;
    return others > 0 ? (w * (1 - wanted)) / others : (1 - wanted) / (weights.length - 1);
  });
}

export function rankOrder(alternatives: SensitivityAlternative[], weights: number[]): string[] {
  return alternatives
    .map((alt) => ({ name: alt.name, score: alt.performance.reduce((sum, p, i) => sum + p * weights[i], 0) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((r) => r.name);
}

export interface SensitivityResult {
  neutral: string[];
  conservative: SensitivityCase[];
  execution: SensitivityCase[];
}

/** Cenários da seção 12: neutro; conservador (+10/+20 p.p. no Pilar 1); execução (+10/+20 p.p. no Pilar 4). */
export function runSensitivity(grouped: GroupedPillar[], alternatives: SensitivityAlternative[]): SensitivityResult {
  const weights = grouped.map((g) => g.weight);
  const neutral = rankOrder(alternatives, weights);
  const run = (target: number, deltas: number[]): SensitivityCase[] =>
    deltas.map((delta) => {
      const order = rankOrder(alternatives, perturbWeights(weights, target, delta));
      return { label: `+${delta} p.p.`, order, changed: order.join("|") !== neutral.join("|") };
    });
  return { neutral, conservative: run(0, [10, 20]), execution: run(3, [10, 20]) };
}
