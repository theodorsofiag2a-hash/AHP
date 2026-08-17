"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

const scaleSchema = z.object({
  id: z.string().uuid(),
  description: z.string().trim().min(1, "Descreva a escala"),
  fulfillmentPct: z.number().min(0).max(100),
});

const subcriterionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Nomeie o subcritério"),
  weightPct: z.number().min(0).max(100),
  scales: z.array(scaleSchema).min(1, "Cada subcritério precisa de ao menos 1 escala"),
});

const pillarSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Nomeie o pilar"),
  subcriteria: z.array(subcriterionSchema).min(1, "Cada pilar precisa de ao menos 1 subcritério"),
});

const modelSchema = z.object({
  name: z.string().trim().min(1, "Nomeie o modelo"),
  pillars: z.array(pillarSchema).min(2, "O modelo precisa de ao menos 2 pilares"),
});

export type ModelFormInput = z.infer<typeof modelSchema>;

async function generateUniqueModelSlug(organizationId: string, name: string, excludeModelId?: string) {
  const supabase = await createClient();
  const base = slugify(name) || "modelo";
  let candidate = base;
  let attempt = 0;

  while (true) {
    let query = supabase
      .from("ahp_models")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("slug", candidate);
    if (excludeModelId) query = query.neq("id", excludeModelId);

    const { data } = await query.maybeSingle();
    if (!data) return candidate;

    attempt += 1;
    candidate = `${base}-${attempt + 1}`;
  }
}

export async function createModel(name: string) {
  const org = await requireOrgContext();
  const supabase = await createClient();

  const parsed = z.string().trim().min(1).safeParse(name);
  if (!parsed.success) throw new Error("Nomeie o modelo");

  const slug = await generateUniqueModelSlug(org.organizationId, parsed.data);

  const { data, error } = await supabase
    .from("ahp_models")
    .insert({ organization_id: org.organizationId, name: parsed.data, slug, created_by: org.userId })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Falha ao criar modelo");

  redirect(`/models/${data.id}/edit`);
}

export async function deleteModel(modelId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ahp_models").delete().eq("id", modelId);
  if (error) throw new Error(error.message);
  revalidatePath("/models");
  redirect("/models");
}

/**
 * Substitui a estrutura completa do modelo (pilares/subcritérios/escalas) — mesma
 * semântica de "salvar tudo de novo" do sistema legado, mas normalizado em tabelas
 * com upsert + remoção do que não veio mais no payload.
 */
export async function saveModelStructure(modelId: string, input: ModelFormInput) {
  const org = await requireOrgContext();
  const supabase = await createClient();
  const data = modelSchema.parse(input);

  let slug: string | undefined;
  const { data: current } = await supabase.from("ahp_models").select("name").eq("id", modelId).maybeSingle();
  if (current && current.name !== data.name) {
    slug = await generateUniqueModelSlug(org.organizationId, data.name, modelId);
  }

  const { error: modelError } = await supabase
    .from("ahp_models")
    .update({ name: data.name, ...(slug ? { slug } : {}) })
    .eq("id", modelId);
  if (modelError) throw new Error(modelError.message);

  const { data: existingPillars } = await supabase.from("ahp_pillars").select("id").eq("model_id", modelId);
  const incomingPillarIds = new Set(data.pillars.map((p) => p.id));
  const pillarsToDelete = (existingPillars ?? []).filter((p) => !incomingPillarIds.has(p.id)).map((p) => p.id);
  if (pillarsToDelete.length > 0) {
    await supabase.from("ahp_pillars").delete().in("id", pillarsToDelete);
  }

  const pillarRows = data.pillars.map((pillar, index) => ({
    id: pillar.id,
    model_id: modelId,
    name: pillar.name,
    sort_order: index,
  }));
  const { error: pillarsError } = await supabase.from("ahp_pillars").upsert(pillarRows, { onConflict: "id" });
  if (pillarsError) throw new Error(pillarsError.message);

  const allSubcriteriaIds = data.pillars.flatMap((p) => p.subcriteria.map((s) => s.id));
  const { data: existingSubcriteria } = await supabase
    .from("ahp_subcriteria")
    .select("id")
    .in("pillar_id", data.pillars.map((p) => p.id));
  const incomingSubcriteriaIds = new Set(allSubcriteriaIds);
  const subcriteriaToDelete = (existingSubcriteria ?? [])
    .filter((s) => !incomingSubcriteriaIds.has(s.id))
    .map((s) => s.id);
  if (subcriteriaToDelete.length > 0) {
    await supabase.from("ahp_subcriteria").delete().in("id", subcriteriaToDelete);
  }

  const subcriterionRows = data.pillars.flatMap((pillar) =>
    pillar.subcriteria.map((sub, index) => ({
      id: sub.id,
      pillar_id: pillar.id,
      name: sub.name,
      weight_pct: sub.weightPct,
      sort_order: index,
    }))
  );
  if (subcriterionRows.length > 0) {
    const { error: subError } = await supabase.from("ahp_subcriteria").upsert(subcriterionRows, { onConflict: "id" });
    if (subError) throw new Error(subError.message);
  }

  const allScaleIds = data.pillars.flatMap((p) => p.subcriteria.flatMap((s) => s.scales.map((sc) => sc.id)));
  const { data: existingScales } = await supabase
    .from("ahp_scales")
    .select("id")
    .in("subcriterion_id", allSubcriteriaIds);
  const incomingScaleIds = new Set(allScaleIds);
  const scalesToDelete = (existingScales ?? []).filter((s) => !incomingScaleIds.has(s.id)).map((s) => s.id);
  if (scalesToDelete.length > 0) {
    await supabase.from("ahp_scales").delete().in("id", scalesToDelete);
  }

  const scaleRows = data.pillars.flatMap((pillar) =>
    pillar.subcriteria.flatMap((sub) =>
      sub.scales.map((scale, index) => ({
        id: scale.id,
        subcriterion_id: sub.id,
        description: scale.description,
        fulfillment_pct: scale.fulfillmentPct,
        sort_order: index,
      }))
    )
  );
  if (scaleRows.length > 0) {
    const { error: scaleError } = await supabase.from("ahp_scales").upsert(scaleRows, { onConflict: "id" });
    if (scaleError) throw new Error(scaleError.message);
  }

  revalidatePath(`/models/${modelId}/edit`);
  revalidatePath("/models");
}
