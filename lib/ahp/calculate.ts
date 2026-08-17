import { buildReciprocalMatrix, sliderToSaaty } from "./matrix";
import { computeConsistencyRatio, computeLambdaMax, computePillarWeights } from "./consistency";
import type { AhpAlternativeInput, AhpCalculationOutput, AhpPillarInput, AhpRunResult } from "./types";

/**
 * Port fiel de `calcularAHPGenerico` (Apps Script legado): matriz de Saaty entre pilares,
 * pesos por soma normalizada de colunas, CR, e score final por alternativa (base ~1000).
 *
 * `sliderValues` deve estar na mesma ordem gerada por `pillarPairIndexes(pillars.length)`
 * (loop i<j sobre `pillars`), com os valores brutos do slider (-8..8) — a conversão para
 * escala de Saaty acontece aqui dentro.
 */
export function calcularAHPGenerico(
  pillars: AhpPillarInput[],
  sliderValues: number[],
  alternatives: AhpAlternativeInput[]
): AhpCalculationOutput {
  const n = pillars.length;
  const saatyValues = sliderValues.map(sliderToSaaty);
  const matrix = buildReciprocalMatrix(n, saatyValues);

  const { weights: pillarWeights, columnSums } = computePillarWeights(matrix);
  const lambdaMax = computeLambdaMax(pillarWeights, columnSums);
  const consistencyRatio = computeConsistencyRatio(lambdaMax, n);

  const ranking: AhpRunResult[] = alternatives.map((alternative) => {
    let finalScore = 0;
    const pillarScores: number[] = [];
    const pillarScoresRadar: number[] = [];

    pillars.forEach((pillar, i) => {
      const totalSubWeight = pillar.subcriteria.reduce((sum, s) => sum + s.weightPct, 0) || 1;

      let pillarPerformance = 0;
      for (const sub of pillar.subcriteria) {
        const relativeWeight = sub.weightPct / totalSubWeight;
        const score = alternative.scores[sub.id] ?? 0;
        pillarPerformance += (score / 100) * relativeWeight;
      }

      const weightedScore = pillarPerformance * pillarWeights[i] * 1000;
      finalScore += weightedScore;
      pillarScores.push(weightedScore);
      pillarScoresRadar.push(pillarPerformance * 10);
    });

    return {
      alternativeId: alternative.id,
      finalScore,
      rank: 0,
      pillarScores,
      pillarScoresRadar,
    };
  });

  ranking.sort((a, b) => b.finalScore - a.finalScore);
  ranking.forEach((result, index) => {
    result.rank = index + 1;
  });

  return { consistencyRatio, lambdaMax, pillarWeights, ranking };
}
