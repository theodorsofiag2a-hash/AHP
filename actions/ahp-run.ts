"use server";

import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { calcularAHPGenerico } from "@/lib/ahp/calculate";
import { pillarPairIndexes, sliderToSaaty } from "@/lib/ahp/matrix";
import type { AhpAlternativeInput, AhpPillarInput } from "@/lib/ahp/types";

export type ExecuteAhpRunResult = { ok: true; runId: string } | { ok: false; error: string };

export async function executeAhpRun(modelId: string, sliderValues: number[]): Promise<ExecuteAhpRunResult> {
  const org = await requireOrgContext();
  const supabase = await createClient();

  const { data: pillarsRaw } = await supabase
    .from("ahp_pillars")
    .select("id, name, sort_order")
    .eq("model_id", modelId)
    .order("sort_order", { ascending: true });

  const pillars = pillarsRaw ?? [];
  if (pillars.length < 2) {
    return { ok: false, error: "O modelo precisa de ao menos 2 pilares para rodar a matriz." };
  }

  const pillarIds = pillars.map((p) => p.id);
  const { data: subcriteriaRaw } = await supabase
    .from("ahp_subcriteria")
    .select("id, pillar_id, weight_pct")
    .in("pillar_id", pillarIds);
  const subcriteria = subcriteriaRaw ?? [];

  const { data: alternativesRaw } = await supabase
    .from("ahp_alternatives")
    .select("id, name")
    .eq("model_id", modelId);
  const alternatives = alternativesRaw ?? [];
  if (alternatives.length === 0) {
    return { ok: false, error: "Cadastre ao menos uma alternativa avaliada antes de rodar a matriz." };
  }

  const subcriterionIds = subcriteria.map((s) => s.id);
  const { data: scoresRaw } = subcriterionIds.length
    ? await supabase
        .from("ahp_alternative_scores")
        .select("alternative_id, subcriterion_id, score_value")
        .in("subcriterion_id", subcriterionIds)
    : { data: [] };
  const scores = scoresRaw ?? [];

  const calcPillars: AhpPillarInput[] = pillars.map((pillar) => ({
    id: pillar.id,
    subcriteria: subcriteria
      .filter((s) => s.pillar_id === pillar.id)
      .map((s) => ({ id: s.id, weightPct: Number(s.weight_pct) })),
  }));

  const calcAlternatives: AhpAlternativeInput[] = alternatives.map((alt) => ({
    id: alt.id,
    scores: Object.fromEntries(
      scores.filter((sc) => sc.alternative_id === alt.id).map((sc) => [sc.subcriterion_id, Number(sc.score_value)])
    ),
  }));

  const result = calcularAHPGenerico(calcPillars, sliderValues, calcAlternatives);

  const pairIndexes = pillarPairIndexes(pillars.length);
  const pillarComparisons = pairIndexes.map(([i, j], k) => ({
    pillarAId: pillars[i].id,
    pillarBId: pillars[j].id,
    sliderValue: sliderValues[k],
    saatyValue: sliderToSaaty(sliderValues[k]),
  }));

  const pillarWeights = pillars.map((pillar, i) => ({ pillarId: pillar.id, weight: result.pillarWeights[i] }));

  const runResults = result.ranking.map((r) => ({
    alternative_id: r.alternativeId,
    final_score: r.finalScore,
    rank: r.rank,
    pillar_scores: pillars.map((pillar, i) => ({ pillarId: pillar.id, points: r.pillarScores[i] })),
    pillar_scores_radar: pillars.map((pillar, i) => ({ pillarId: pillar.id, value: r.pillarScoresRadar[i] })),
  }));

  const { data: runId, error } = await supabase.rpc("create_ahp_run", {
    p_organization_id: org.organizationId,
    p_model_id: modelId,
    p_consistency_ratio: result.consistencyRatio,
    p_lambda_max: result.lambdaMax,
    p_pillar_comparisons: pillarComparisons,
    p_pillar_weights: pillarWeights,
    p_results: runResults,
  });

  if (error) {
    if (error.message.includes("insufficient_credits")) {
      return { ok: false, error: "Saldo de créditos insuficiente para rodar esta execução." };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, runId: runId as string };
}
