"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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

/**
 * `selections`: subcriterionId -> scaleId escolhida no dropdown. O `score_value` é
 * congelado com o `fulfillment_pct` da escala no momento do salvamento (não recalcula
 * retroativamente se a escala for editada depois).
 */
export async function saveEvaluation(
  modelId: string,
  alternativeId: string,
  selections: Record<string, string>
) {
  const supabase = await createClient();
  const data = evaluationSchema.parse(selections);

  const subcriterionIds = Object.keys(data);
  const scaleIds = Array.from(new Set(Object.values(data)));

  const { data: scales, error: scalesError } = await supabase
    .from("ahp_scales")
    .select("id, subcriterion_id, fulfillment_pct")
    .in("id", scaleIds);
  if (scalesError) throw new Error(scalesError.message);

  // A RLS só confere se a *alternativa* pertence à organização; não confere se a escala
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
    .select("id, pillar_id")
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

  const rows = Object.entries(data).map(([subcriterionId, scaleId]) => ({
    alternative_id: alternativeId,
    subcriterion_id: subcriterionId,
    scale_id: scaleId,
    score_value: fulfillmentByScaleId.get(scaleId) ?? 0,
  }));

  const { error } = await supabase
    .from("ahp_alternative_scores")
    .upsert(rows, { onConflict: "alternative_id,subcriterion_id" });
  if (error) throw new Error(error.message);

  revalidatePath(`/models/${modelId}/alternatives/${alternativeId}`);
  revalidatePath(`/models/${modelId}/alternatives`);
}

const connectionSchema = z.object({
  busId: z.string().uuid().nullable(),
  powerMw: z.number().positive().max(5000).nullable(),
});

/**
 * Vincula a alternativa a um barramento da NT-ONS (`grid_buses`) e registra a potência
 * pretendida. A tabela de barramentos é só leitura para o usuário; aqui só se grava o vínculo.
 * O preenchimento da ficha a partir do barramento acontece no cliente e passa por
 * `saveEvaluation`, que mantém as validações de escala/subcritério.
 */
export async function saveConnection(
  modelId: string,
  alternativeId: string,
  input: { busId: string | null; powerMw: number | null }
) {
  const supabase = await createClient();
  const data = connectionSchema.parse(input);

  const { data: updated, error } = await supabase
    .from("ahp_alternatives")
    .update({ bus_id: data.busId, power_mw: data.powerMw })
    .eq("id", alternativeId)
    .eq("model_id", modelId)
    .select("id");

  if (error?.code === "23503") throw new Error("Barramento não encontrado.");
  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) throw new Error("Alternativa não encontrada.");

  revalidatePath(`/models/${modelId}/alternatives/${alternativeId}`);
  revalidatePath(`/models/${modelId}/alternatives`);
}
