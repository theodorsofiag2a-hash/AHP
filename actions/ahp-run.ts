"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { calcularAHPGenerico } from "@/lib/ahp/calculate";
import { pillarPairIndexes, sliderToSaaty } from "@/lib/ahp/matrix";
import { MIN_ALTERNATIVES_TO_RUN, alternativeProgress, incompleteAlternatives } from "@/lib/ahp/readiness";
import type { AhpAlternativeInput, AhpPillarInput } from "@/lib/ahp/types";
import { GRID_BUS_COLUMNS, toGridBus, type GridBusRow } from "@/lib/grid/types";
import { buildRunSnapshot } from "@/lib/report/snapshot";

export type ExecuteAhpRunResult = { ok: true; runId: string } | { ok: false; error: string };

export async function executeAhpRun(modelId: string, sliderValues: number[]): Promise<ExecuteAhpRunResult> {
  const org = await requireOrgContext();
  const supabase = await createClient();

  const { data: model } = await supabase
    .from("ahp_models")
    .select("id, name")
    .eq("id", modelId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!model) return { ok: false, error: "Modelo não encontrado." };

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
    .select("id, name, power_mw, bus_id")
    .eq("model_id", modelId);
  const alternatives = alternativesRaw ?? [];
  if (alternatives.length < MIN_ALTERNATIVES_TO_RUN) {
    return {
      ok: false,
      error: `Cadastre ao menos ${MIN_ALTERNATIVES_TO_RUN} alternativas para rodar a matriz.`,
    };
  }

  const subcriterionIds = subcriteria.map((s) => s.id);
  const { data: scoresRaw } = subcriterionIds.length
    ? await supabase
        .from("ahp_alternative_scores")
        .select("alternative_id, subcriterion_id, scale_id, score_value")
        .in("subcriterion_id", subcriterionIds)
    : { data: [] };
  const scores = scoresRaw ?? [];

  const incomplete = incompleteAlternatives(alternativeProgress(subcriterionIds, alternatives, scores));
  if (incomplete.length > 0) {
    return {
      ok: false,
      error: `Complete a ficha de avaliação de: ${incomplete.map((a) => a.name).join(", ")}.`,
    };
  }

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

  // "Foto" da rodada, usada só pelo relatório (não muda nada na AHP).
  const scaleIds = Array.from(new Set(scores.map((sc) => sc.scale_id)));
  const { data: scalesRaw } = scaleIds.length
    ? await supabase.from("ahp_scales").select("id, description").in("id", scaleIds)
    : { data: [] };
  const { data: subcriteriaNamed } = await supabase
    .from("ahp_subcriteria")
    .select("id, pillar_id, name, weight_pct")
    .in("pillar_id", pillarIds);
  const busIds = Array.from(new Set(alternatives.map((a) => a.bus_id).filter((id): id is string => !!id)));
  const { data: busRows } = busIds.length
    ? await supabase.from("grid_buses").select(GRID_BUS_COLUMNS).in("id", busIds)
    : { data: [] };

  const snapshot = buildRunSnapshot({
    model: { id: model.id, name: model.name },
    pillars: pillars.map((p) => ({ id: p.id, name: p.name })),
    subcriteria: subcriteriaNamed ?? [],
    scales: scalesRaw ?? [],
    alternatives: alternatives.map((a) => ({
      id: a.id,
      name: a.name,
      powerMw: a.power_mw != null ? Number(a.power_mw) : null,
      busId: a.bus_id,
    })),
    scores: scores as { alternative_id: string; subcriterion_id: string; scale_id: string; score_value: number }[],
    buses: ((busRows ?? []) as GridBusRow[]).map(toGridBus),
  });

  const { data: runId, error } = await supabase.rpc("create_ahp_run", {
    p_organization_id: org.organizationId,
    p_model_id: modelId,
    p_consistency_ratio: result.consistencyRatio,
    p_lambda_max: result.lambdaMax,
    p_pillar_comparisons: pillarComparisons,
    p_pillar_weights: pillarWeights,
    p_results: runResults,
    p_inputs_snapshot: snapshot,
  });

  if (error) {
    if (error.message.includes("insufficient_credits")) {
      return { ok: false, error: "Saldo de créditos insuficiente para rodar esta execução." };
    }
    return { ok: false, error: error.message };
  }

  // O saldo aparece no topbar e no dashboard (layout persistente); sem isso ele fica desatualizado.
  revalidatePath("/", "layout");

  return { ok: true, runId: runId as string };
}
