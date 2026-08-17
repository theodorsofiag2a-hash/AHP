"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function createAlternative(modelId: string, name: string) {
  const supabase = await createClient();
  const parsed = z.string().trim().min(1).safeParse(name);
  if (!parsed.success) throw new Error("Nomeie a alternativa");

  const { data, error } = await supabase
    .from("ahp_alternatives")
    .insert({ model_id: modelId, name: parsed.data })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Falha ao criar alternativa");

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

  const scaleIds = Array.from(new Set(Object.values(data)));
  const { data: scales, error: scalesError } = await supabase
    .from("ahp_scales")
    .select("id, fulfillment_pct")
    .in("id", scaleIds);
  if (scalesError) throw new Error(scalesError.message);

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
