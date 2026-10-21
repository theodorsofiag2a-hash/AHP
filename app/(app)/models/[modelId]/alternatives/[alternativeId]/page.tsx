import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { EvaluationForm } from "@/components/ahp/evaluation-form";

export default async function AlternativeEvaluationPage({
  params,
}: {
  params: Promise<{ modelId: string; alternativeId: string }>;
}) {
  const { modelId, alternativeId } = await params;
  const org = await requireOrgContext();
  const supabase = await createClient();

  const { data: model } = await supabase
    .from("ahp_models")
    .select("id, name")
    .eq("id", modelId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!model) notFound();

  const { data: alternative } = await supabase
    .from("ahp_alternatives")
    .select("id, name")
    .eq("id", alternativeId)
    .eq("model_id", modelId)
    .maybeSingle();
  if (!alternative) notFound();

  const { data: pillars } = await supabase
    .from("ahp_pillars")
    .select("id, name, sort_order")
    .eq("model_id", modelId)
    .order("sort_order", { ascending: true });

  const pillarIds = (pillars ?? []).map((p) => p.id);

  const { data: subcriteria } = pillarIds.length
    ? await supabase
        .from("ahp_subcriteria")
        .select("id, pillar_id, name, sort_order")
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

  const { data: existingScores } = await supabase
    .from("ahp_alternative_scores")
    .select("subcriterion_id, scale_id")
    .eq("alternative_id", alternativeId);

  const assembledPillars = (pillars ?? []).map((pillar) => ({
    id: pillar.id,
    name: pillar.name,
    subcriteria: (subcriteria ?? [])
      .filter((s) => s.pillar_id === pillar.id)
      .map((sub) => ({
        id: sub.id,
        name: sub.name,
        scales: (scales ?? [])
          .filter((sc) => sc.subcriterion_id === sub.id)
          .map((sc) => ({
            id: sc.id,
            description: sc.description,
            fulfillmentPct: Number(sc.fulfillment_pct),
          })),
      })),
  }));

  const initialSelections = Object.fromEntries(
    (existingScores ?? []).map((s) => [s.subcriterion_id, s.scale_id])
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title">{alternative.name}</h1>
        <p className="text-sm text-text-muted">Ficha de avaliação — {model.name}</p>
      </div>

      {assembledPillars.length === 0 ? (
        <p className="text-sm text-text-muted">
          Este modelo ainda não tem pilares/subcritérios configurados. Contate a G2A para configurar a estrutura deste modelo.
        </p>
      ) : (
        <EvaluationForm
          modelId={modelId}
          alternativeId={alternativeId}
          pillars={assembledPillars}
          initialSelections={initialSelections}
        />
      )}
    </div>
  );
}
