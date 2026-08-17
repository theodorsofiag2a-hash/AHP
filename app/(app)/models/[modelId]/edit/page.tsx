import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { ModelTabs } from "@/components/ahp/model-tabs";
import { ModelTreeBuilder } from "@/components/ahp/model-tree-builder";

export default async function ModelEditPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const { modelId } = await params;
  const org = await requireOrgContext();
  const supabase = await createClient();

  const { data: model } = await supabase
    .from("ahp_models")
    .select("id, name")
    .eq("id", modelId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();

  if (!model) notFound();

  const { data: pillars } = await supabase
    .from("ahp_pillars")
    .select("id, name, sort_order")
    .eq("model_id", modelId)
    .order("sort_order", { ascending: true });

  const pillarIds = (pillars ?? []).map((p) => p.id);

  const { data: subcriteria } = pillarIds.length
    ? await supabase
        .from("ahp_subcriteria")
        .select("id, pillar_id, name, weight_pct, sort_order")
        .in("pillar_id", pillarIds)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const subcriterionIds = (subcriteria ?? []).map((s) => s.id);

  const { data: scales } = subcriterionIds.length
    ? await supabase
        .from("ahp_scales")
        .select("id, subcriterion_id, description, fulfillment_pct, sort_order")
        .in("subcriterion_id", subcriterionIds)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const assembledPillars = (pillars ?? []).map((pillar) => ({
    id: pillar.id,
    name: pillar.name,
    subcriteria: (subcriteria ?? [])
      .filter((s) => s.pillar_id === pillar.id)
      .map((sub) => ({
        id: sub.id,
        name: sub.name,
        weightPct: Number(sub.weight_pct),
        scales: (scales ?? [])
          .filter((sc) => sc.subcriterion_id === sub.id)
          .map((sc) => ({
            id: sc.id,
            description: sc.description,
            fulfillmentPct: Number(sc.fulfillment_pct),
          })),
      })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{model.name}</h1>
        <p className="text-sm text-text-muted">Estruture pilares, subcritérios e escalas de desempenho.</p>
      </div>

      <ModelTabs modelId={model.id} />

      <ModelTreeBuilder modelId={model.id} initialName={model.name} initialPillars={assembledPillars} />
    </div>
  );
}
