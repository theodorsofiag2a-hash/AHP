"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { planErrorMessage } from "@/lib/billing/entitlements";
import { RELATIVE_LOWER } from "@/lib/ahp/relative";

export type CreateAlternativeState = { error?: string };

/** Compatível com useActionState: erros voltam como estado (exibidos no formulário) em vez de derrubar a página. */
export async function createAlternative(
  modelId: string,
  _prevState: CreateAlternativeState,
  formData: FormData
): Promise<CreateAlternativeState> {
  const supabase = await createClient();
  const parsed = z.string().trim().min(1).max(120).safeParse(String(formData.get("name") ?? ""));
  if (!parsed.success) return { error: "Informe um nome para a alternativa (até 120 caracteres)." };

  const { data, error } = await supabase
    .from("ahp_alternatives")
    .insert({ model_id: modelId, name: parsed.data })
    .select("id")
    .single();

  if (error?.code === "23505") return { error: "Já existe uma alternativa com esse nome neste modelo." };
  const planMessage = planErrorMessage(error?.message);
  if (planMessage) return { error: planMessage };
  if (error || !data) return { error: "Não foi possível criar a alternativa. Tente novamente." };

  redirect(`/models/${modelId}/alternatives/${data.id}`);
}

export async function deleteAlternative(modelId: string, alternativeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ahp_alternatives").delete().eq("id", alternativeId);
  if (error) throw new Error(error.message);
  revalidatePath(`/models/${modelId}/alternatives`);
}

const evaluationSchema = z.record(z.string().uuid(), z.string().uuid());
/** Valor informado nos subcritérios relativos (null = apagar o valor). */
const valuesSchema = z.record(z.string().uuid(), z.number().finite().min(0).max(1e12).nullable());

/**
 * `selections`: subcriterionId -> scaleId escolhida no dropdown. O `score_value` é
 * congelado com o `fulfillment_pct` da escala no momento do salvamento (não recalcula
 * retroativamente se a escala for editada depois).
 */
export async function saveEvaluation(
  modelId: string,
  alternativeId: string,
  selections: Record<string, string>,
  relativeValues: Record<string, number | null> = {}
) {
  const supabase = await createClient();
  const data = evaluationSchema.parse(selections);
  const valuesData = valuesSchema.parse(relativeValues);

  const subcriterionIds = Object.keys(data);
  const scaleIds = Array.from(new Set(Object.values(data)));

  const { data: scales, error: scalesError } = await supabase
    .from("ahp_scales")
    .select("id, subcriterion_id, fulfillment_pct")
    .in("id", scaleIds);
  if (scalesError) throw new Error(scalesError.message);

  // A RLS só confere se a *alternativa* pertence ao usuário; não confere se a escala
  // escolhida pertence ao subcritério indicado para ela, nem se o subcritério pertence ao
  // mesmo modelo da alternativa. Sem isso, dava para gravar a nota de uma escala de outro
  // subcritério (ou de outro modelo) como se fosse a resposta certa (ver
  // docs/SECURITY_AUDIT.md, achado S6).
  const scaleById = new Map((scales ?? []).map((s) => [s.id, s]));
  for (const [subcriterionId, scaleId] of Object.entries(data)) {
    const scale = scaleById.get(scaleId);
    if (!scale || scale.subcriterion_id !== subcriterionId) {
      throw new Error("Seleção inválida: a escala não pertence a este subcritério.");
    }
  }

  const { data: alternative, error: alternativeError } = await supabase
    .from("ahp_alternatives")
    .select("model_id")
    .eq("id", alternativeId)
    .maybeSingle();
  if (alternativeError) throw new Error(alternativeError.message);
  if (!alternative) throw new Error("Alternativa não encontrada.");

  const { data: subcriteria, error: subError } = await supabase
    .from("ahp_subcriteria")
    .select("id, pillar_id, auto_source")
    .in("id", subcriterionIds);
  if (subError) throw new Error(subError.message);

  const pillarIds = Array.from(new Set((subcriteria ?? []).map((s) => s.pillar_id)));
  const { data: pillars, error: pillarError } = pillarIds.length
    ? await supabase.from("ahp_pillars").select("id, model_id").in("id", pillarIds)
    : { data: [], error: null };
  if (pillarError) throw new Error(pillarError.message);

  const modelIdByPillarId = new Map((pillars ?? []).map((p) => [p.id, p.model_id]));
  const subcriterionById = new Map((subcriteria ?? []).map((s) => [s.id, s]));
  for (const subcriterionId of subcriterionIds) {
    const subcriterion = subcriterionById.get(subcriterionId);
    const subcriterionModelId = subcriterion ? modelIdByPillarId.get(subcriterion.pillar_id) : undefined;
    if (!subcriterion || subcriterionModelId !== alternative.model_id) {
      throw new Error("Seleção inválida: subcritério não pertence a este modelo.");
    }
  }

  const fulfillmentByScaleId = new Map((scales ?? []).map((s) => [s.id, Number(s.fulfillment_pct)]));

  // O rito de licenciamento só muda pelo município (automático) ou pelo ajuste manual com justificativa.
  const licensingIds = new Set(
    (subcriteria ?? []).filter((s) => s.auto_source === "licensing").map((s) => s.id)
  );

  const rows = Object.entries(data)
    .filter(([subcriterionId]) => !licensingIds.has(subcriterionId))
    .map(([subcriterionId, scaleId]) => ({
    alternative_id: alternativeId,
    subcriterion_id: subcriterionId,
    scale_id: scaleId,
    score_value: fulfillmentByScaleId.get(scaleId) ?? 0,
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("ahp_alternative_scores")
      .upsert(rows, { onConflict: "alternative_id,subcriterion_id" });
    if (error) throw new Error(error.message);
  }

  await saveRelativeValues(supabase, alternativeId, alternative.model_id, valuesData);

  revalidatePath(`/models/${modelId}/alternatives/${alternativeId}`);
  revalidatePath(`/models/${modelId}/alternatives`);
}

/**
 * Valores dos subcritérios relativos (EUST, ICMS): um número por projeto. A nota não é gravada aqui,
 * porque depende dos outros projetos; ela é calculada ao rodar a análise.
 */
async function saveRelativeValues(
  supabase: Awaited<ReturnType<typeof createClient>>,
  alternativeId: string,
  alternativeModelId: string,
  values: Record<string, number | null>
) {
  const ids = Object.keys(values);
  if (ids.length === 0) return;

  const { data: subs, error: subError } = await supabase
    .from("ahp_subcriteria")
    .select("id, pillar_id, score_mode")
    .in("id", ids);
  if (subError) throw new Error(subError.message);

  const pillarIds = Array.from(new Set((subs ?? []).map((s) => s.pillar_id)));
  const { data: pillars, error: pillarError } = pillarIds.length
    ? await supabase.from("ahp_pillars").select("id, model_id").in("id", pillarIds)
    : { data: [], error: null };
  if (pillarError) throw new Error(pillarError.message);
  const modelByPillar = new Map((pillars ?? []).map((p) => [p.id, p.model_id]));
  const subById = new Map((subs ?? []).map((s) => [s.id, s]));

  for (const id of ids) {
    const sub = subById.get(id);
    if (!sub || modelByPillar.get(sub.pillar_id) !== alternativeModelId || sub.score_mode !== RELATIVE_LOWER) {
      throw new Error("Seleção inválida: este subcritério não recebe valor numérico.");
    }
  }

  const toSave = ids.filter((id) => values[id] !== null);
  const toClear = ids.filter((id) => values[id] === null);

  if (toSave.length > 0) {
    const { error } = await supabase.from("ahp_alternative_values").upsert(
      toSave.map((id) => ({
        alternative_id: alternativeId,
        subcriterion_id: id,
        raw_value: values[id] as number,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "alternative_id,subcriterion_id" }
    );
    if (error) throw new Error(error.message);
  }
  if (toClear.length > 0) {
    const { error } = await supabase
      .from("ahp_alternative_values")
      .delete()
      .eq("alternative_id", alternativeId)
      .in("subcriterion_id", toClear);
    if (error) throw new Error(error.message);
  }
}

const connectionSchema = z.object({
  busId: z.string().uuid().nullable(),
  powerMw: z.number().positive().max(5000).nullable(),
  mustMw: z.number().positive().max(5000).nullable(),
});

/**
 * Vincula a alternativa a um barramento da NT-ONS (`grid_buses`) e registra a potência pretendida
 * e o MUST. A tabela de barramentos é só leitura para o usuário; aqui só se grava o vínculo.
 * O preenchimento da ficha a partir do barramento acontece no cliente e passa por
 * `saveEvaluation`, que mantém as validações de escala/subcritério.
 */
export async function saveConnection(
  modelId: string,
  alternativeId: string,
  input: { busId: string | null; powerMw: number | null; mustMw: number | null }
) {
  const supabase = await createClient();
  const data = connectionSchema.parse(input);

  const { data: updated, error } = await supabase
    .from("ahp_alternatives")
    .update({ bus_id: data.busId, power_mw: data.powerMw, must_mw: data.mustMw })
    .eq("id", alternativeId)
    .eq("model_id", modelId)
    .select("id");

  if (error?.code === "23503") throw new Error("Barramento não encontrado.");
  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) throw new Error("Alternativa não encontrada.");

  revalidatePath(`/models/${modelId}/alternatives/${alternativeId}`);
  revalidatePath(`/models/${modelId}/alternatives`);
}

const overrideSchema = z.object({
  subcriterionId: z.string().uuid(),
  scaleId: z.string().uuid(),
  reason: z.string().trim().min(5, "Explique o motivo do ajuste (mínimo 5 caracteres).").max(1000),
});

/**
 * Ajuste manual do rito de licenciamento (preenchido pela UF). Exige justificativa e registra
 * quem ajustou e quando.
 */
export async function saveLicensingOverride(
  modelId: string,
  alternativeId: string,
  input: { subcriterionId: string; scaleId: string; reason: string }
) {
  const supabase = await createClient();
  const data = overrideSchema.parse(input);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");

  const { data: alternative } = await supabase
    .from("ahp_alternatives")
    .select("id")
    .eq("id", alternativeId)
    .eq("model_id", modelId)
    .maybeSingle();
  if (!alternative) throw new Error("Alternativa não encontrada.");

  const { data: scale } = await supabase
    .from("ahp_scales")
    .select("id, fulfillment_pct, subcriterion_id, ahp_subcriteria!inner(auto_source, score_mode, pillar_id, ahp_pillars!inner(model_id))")
    .eq("id", data.scaleId)
    .maybeSingle();
  const sub = scale ? (Array.isArray(scale.ahp_subcriteria) ? scale.ahp_subcriteria[0] : scale.ahp_subcriteria) : null;
  const pillar = sub ? (Array.isArray(sub.ahp_pillars) ? sub.ahp_pillars[0] : sub.ahp_pillars) : null;
  if (
    !scale ||
    scale.subcriterion_id !== data.subcriterionId ||
    sub?.auto_source !== "licensing" ||
    sub?.score_mode === "screening" ||
    pillar?.model_id !== modelId
  ) {
    throw new Error("Seleção inválida: esta escala não é do rito de licenciamento deste modelo.");
  }

  const { error } = await supabase.from("ahp_alternative_scores").upsert(
    {
      alternative_id: alternativeId,
      subcriterion_id: data.subcriterionId,
      scale_id: data.scaleId,
      score_value: Number(scale.fulfillment_pct),
      override_reason: data.reason,
      overridden_by: user.id,
      overridden_by_email: user.email ?? null,
      overridden_at: new Date().toISOString(),
    },
    { onConflict: "alternative_id,subcriterion_id" }
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/models/${modelId}/alternatives/${alternativeId}`);
  revalidatePath(`/models/${modelId}/alternatives`);
}
