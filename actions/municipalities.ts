"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pickScale } from "@/lib/ahp/auto-match";
import { isRite, pickScaleByKey } from "@/lib/licensing";

export interface MunicipalityOption {
  ibge_code: number;
  name: string;
  ng: number | null;
}

const ufSchema = z.string().regex(/^[A-Z]{2}$/);

export async function listMunicipalities(uf: string): Promise<MunicipalityOption[]> {
  const parsed = ufSchema.parse(uf);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("municipalities")
    .select("ibge_code, name, ng")
    .eq("uf", parsed)
    .order("name", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({ ibge_code: m.ibge_code, name: m.name, ng: m.ng === null ? null : Number(m.ng) }));
}

/**
 * Grava o município do projeto. Se o município já tem Ng, o parâmetro de descargas atmosféricas
 * (subcritério com auto_source = 'ng') é preenchido sozinho com a faixa que cobre esse valor.
 */
export async function setAlternativeMunicipality(
  modelId: string,
  alternativeId: string,
  ibgeCode: number | null
): Promise<{ ng: number | null; applied: boolean; licensingApplied: boolean }> {
  const supabase = await createClient();
  const code = z.number().int().positive().nullable().parse(ibgeCode);

  const { error } = await supabase
    .from("ahp_alternatives")
    .update({ municipality_ibge: code })
    .eq("id", alternativeId)
    .eq("model_id", modelId);
  if (error) throw new Error(error.message);

  revalidatePath(`/models/${modelId}/alternatives/${alternativeId}`);
  if (code === null) return { ng: null, applied: false, licensingApplied: false };

  const { data: municipality, error: munError } = await supabase
    .from("municipalities")
    .select("ng, uf")
    .eq("ibge_code", code)
    .maybeSingle();
  if (munError) throw new Error(munError.message);
  if (!municipality) throw new Error("Município não encontrado.");

  const { data: pillars } = await supabase.from("ahp_pillars").select("id").eq("model_id", modelId);
  const pillarIds = (pillars ?? []).map((p) => p.id);

  const licensingApplied = await applyLicensing(supabase, alternativeId, pillarIds, municipality.uf);
  if (licensingApplied) revalidatePath(`/models/${modelId}/alternatives`);

  if (municipality.ng === null) return { ng: null, applied: false, licensingApplied };
  const ng = Number(municipality.ng);

  const { data: subs } = pillarIds.length
    ? await supabase.from("ahp_subcriteria").select("id").in("pillar_id", pillarIds).eq("auto_source", "ng")
    : { data: [] as { id: string }[] };

  let applied = false;
  for (const sub of subs ?? []) {
    const { data: scales } = await supabase
      .from("ahp_scales")
      .select("id, fulfillment_pct, auto_match")
      .eq("subcriterion_id", sub.id);
    const scale = pickScale(ng, scales ?? []);
    if (!scale) continue;
    const { error: upsertError } = await supabase.from("ahp_alternative_scores").upsert(
      {
        alternative_id: alternativeId,
        subcriterion_id: sub.id,
        scale_id: scale.id,
        score_value: Number(scale.fulfillment_pct),
      },
      { onConflict: "alternative_id,subcriterion_id" }
    );
    if (upsertError) throw new Error(upsertError.message);
    applied = true;
  }
  if (applied) revalidatePath(`/models/${modelId}/alternatives`);
  return { ng, applied, licensingApplied };
}

/**
 * Preenche a complexidade do rito de licenciamento com o rito da UF do município (tabela
 * `licensing_rules`). Trocar o município refaz o preenchimento e apaga um ajuste manual anterior.
 */
async function applyLicensing(
  supabase: Awaited<ReturnType<typeof createClient>>,
  alternativeId: string,
  pillarIds: string[],
  uf: string
): Promise<boolean> {
  if (pillarIds.length === 0) return false;
  const { data: subs } = await supabase
    .from("ahp_subcriteria")
    .select("id")
    .in("pillar_id", pillarIds)
    .eq("auto_source", "licensing")
    .neq("score_mode", "screening");
  if (!subs || subs.length === 0) return false;

  const { data: rule } = await supabase.from("licensing_rules").select("rite").eq("uf", uf).maybeSingle();
  const rite = rule && isRite(rule.rite) ? rule.rite : "nao_informado";

  let applied = false;
  for (const sub of subs) {
    const { data: scales } = await supabase
      .from("ahp_scales")
      .select("id, fulfillment_pct, auto_key")
      .eq("subcriterion_id", sub.id);
    const scale = pickScaleByKey(rite, scales ?? []);
    if (!scale) continue;
    const { error } = await supabase.from("ahp_alternative_scores").upsert(
      {
        alternative_id: alternativeId,
        subcriterion_id: sub.id,
        scale_id: scale.id,
        score_value: Number(scale.fulfillment_pct),
        override_reason: null,
        overridden_by: null,
        overridden_by_email: null,
        overridden_at: null,
      },
      { onConflict: "alternative_id,subcriterion_id" }
    );
    if (error) throw new Error(error.message);
    applied = true;
  }
  return applied;
}
