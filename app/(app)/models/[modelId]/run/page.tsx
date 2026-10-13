import { notFound } from "next/navigation";
import { canManageModels, requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { ModelTabs } from "@/components/ahp/model-tabs";
import { PairwiseSliders } from "@/components/ahp/pairwise-sliders";

export default async function ModelRunPage({
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

  const { count: alternativesCount } = await supabase
    .from("ahp_alternatives")
    .select("id", { count: "exact", head: true })
    .eq("model_id", modelId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{model.name}</h1>
        <p className="text-sm text-text-muted">
          Compare a importância relativa entre os pilares para calcular os pesos (AHP).
        </p>
      </div>

      <ModelTabs modelId={model.id} canManage={canManageModels(org.role)} />

      {!pillars || pillars.length < 2 ? (
        <p className="text-sm text-text-muted">
          Este modelo precisa de ao menos 2 pilares. Volte à aba Estrutura para configurar.
        </p>
      ) : !alternativesCount ? (
        <p className="text-sm text-text-muted">
          Cadastre e avalie ao menos uma alternativa na aba Fichas de Avaliação antes de rodar a matriz.
        </p>
      ) : (
        <>
          <p className="text-xs text-text-faint">Esta execução consumirá 1 crédito.</p>
          <PairwiseSliders modelId={model.id} pillars={pillars} />
        </>
      )}
    </div>
  );
}
