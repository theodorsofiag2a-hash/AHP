"use server";

import { revalidatePath } from "next/cache";
import { requireUserContext } from "@/lib/user-context";
import { getBillingSummary } from "@/lib/billing/user-plan";
import { isTrialBilling } from "@/lib/billing/trial";
import { isScoring } from "@/lib/ahp/scoring";
import { MODEL_LOCKED_MESSAGE, isModelLocked } from "@/lib/ahp/model-access";
import { planErrorMessage } from "@/lib/billing/entitlements";
import { createClient } from "@/lib/supabase/server";
import { calcularAHPGenerico } from "@/lib/ahp/calculate";
import { pillarPairIndexes, sliderToSaaty } from "@/lib/ahp/matrix";
import { MIN_ALTERNATIVES_TO_RUN, alternativeProgress, incompleteAlternatives } from "@/lib/ahp/readiness";
import { buildAlternativeScores } from "@/lib/ahp/relative";
import { findEliminated } from "@/lib/ahp/eliminate";
import type { AhpAlternativeInput, AhpPillarInput } from "@/lib/ahp/types";

export type ExecuteAhpRunResult = { ok: true; runId: string } | { ok: false; error: string };

export async function executeAhpRun(modelId: string, sliderValues: number[]): Promise<ExecuteAhpRunResult> {
  const user = await requireUserContext();
  const supabase = await createClient();
  const trial = isTrialBilling(await getBillingSummary(user.userId));

  const { data: model } = await supabase.from("ahp_models").select("trial_available").eq("id", modelId).maybeSingle();
  if (!model) return { ok: false, error: "Modelo não encontrado." };
  if (isModelLocked(model, trial)) return { ok: false, error: MODEL_LOCKED_MESSAGE };

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
    .select("id, pillar_id, name, weight_pct, score_mode, trial")
    .in("pillar_id", pillarIds);
  // Triagem não pontua; no trial, só os parâmetros liberados contam (os demais ficam de fora do cálculo).
  const subcriteria = (subcriteriaRaw ?? []).filter((s) => isScoring(s, trial));
  if (subcriteria.length === 0) {
    return {
      ok: false,
      error: trial
        ? "Este modelo não está disponível na versão gratuita. Fale com a G2A."
        : "O modelo não tem parâmetros configurados.",
    };
  }

  const { data: alternativesRaw } = await supabase
    .from("ahp_alternatives")
    .select("id, name")
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

  // Subcritérios "relativos" (EUST, ICMS) guardam um valor por projeto; a nota sai agora, comparando a carteira.
  const { data: valuesRaw } = subcriterionIds.length
    ? await supabase
        .from("ahp_alternative_values")
        .select("alternative_id, subcriterion_id, raw_value")
        .in("subcriterion_id", subcriterionIds)
    : { data: [] };
  const values = valuesRaw ?? [];

  const incomplete = incompleteAlternatives(
    alternativeProgress(subcriterionIds, alternatives, [...scores, ...values])
  );
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

  // Faixas marcadas como eliminatórias (ex.: restrição tipo B): quem escolheu uma sai do ranking.
  const { data: eliminatingScales } = subcriterionIds.length
    ? await supabase
        .from("ahp_scales")
        .select("id")
        .in("subcriterion_id", subcriterionIds)
        .eq("eliminates", true)
    : { data: [] };
  const eliminated = findEliminated(
    scores,
    new Set((eliminatingScales ?? []).map((s) => s.id)),
    new Map(subcriteria.map((s) => [s.id, s.name as string]))
  );
  const competing = alternatives.filter((alt) => !eliminated.has(alt.id));
  if (competing.length === 0) {
    return {
      ok: false,
      error: "Todos os projetos foram eliminados por critério eliminatório. Revise as fichas antes de rodar.",
    };
  }

  // A nota relativa (EUST, ICMS) compara só os projetos que seguem na disputa.
  const scoresByAlternative = buildAlternativeScores(
    competing.map((alt) => alt.id),
    scores,
    values
  );
  const calcAlternatives: AhpAlternativeInput[] = competing.map((alt) => ({
    id: alt.id,
    scores: scoresByAlternative[alt.id] ?? {},
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

  const eliminatedResults = alternatives
    .filter((alt) => eliminated.has(alt.id))
    .map((alt) => ({
      alternative_id: alt.id,
      final_score: 0,
      rank: null,
      eliminated: true,
      eliminated_reason: (eliminated.get(alt.id) ?? []).join("; "),
      pillar_scores: [],
      pillar_scores_radar: [],
    }));

  const { data: runId, error } = await supabase.rpc("create_ahp_run", {
    p_model_id: modelId,
    p_consistency_ratio: result.consistencyRatio,
    p_lambda_max: result.lambdaMax,
    p_pillar_comparisons: pillarComparisons,
    p_pillar_weights: pillarWeights,
    p_results: [...runResults, ...eliminatedResults],
  });

  if (error) {
    if (error.message.includes("insufficient_credits")) {
      return { ok: false, error: "Saldo de créditos insuficiente para rodar esta execução." };
    }
    const planMessage = planErrorMessage(error.message);
    if (planMessage) return { ok: false, error: planMessage };
    return { ok: false, error: error.message };
  }

  // O saldo aparece no topbar e no dashboard (layout persistente); sem isso ele fica desatualizado.
  revalidatePath("/", "layout");

  return { ok: true, runId: runId as string };
}
