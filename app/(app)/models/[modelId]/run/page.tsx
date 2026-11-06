import Link from "next/link";
import { Coins } from "lucide-react";
import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/org";
import { getCreditBalance } from "@/lib/credits";
import { RUN_COST_CREDITS } from "@/lib/credit-cost";
import { MIN_ALTERNATIVES_TO_RUN, alternativeProgress, incompleteAlternatives } from "@/lib/ahp/readiness";
import { createClient } from "@/lib/supabase/server";
import { ModelTabs } from "@/components/ahp/model-tabs";
import { PairwiseSliders } from "@/components/ahp/pairwise-sliders";
import { ContactG2a } from "@/components/layout/contact-g2a";
import { Card, CardContent } from "@/components/ui/card";

function Blocked({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 py-6">
        <p className="font-medium text-text-primary">{title}</p>
        {children}
      </CardContent>
    </Card>
  );
}

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

  const pillarIds = (pillars ?? []).map((p) => p.id);

  const [{ data: subcriteria }, { data: alternatives }, creditBalance] = await Promise.all([
    pillarIds.length
      ? supabase.from("ahp_subcriteria").select("id").in("pillar_id", pillarIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
    supabase.from("ahp_alternatives").select("id, name").eq("model_id", modelId).order("name"),
    getCreditBalance(org.organizationId),
  ]);

  const subcriterionIds = (subcriteria ?? []).map((s) => s.id);
  const { data: scores } = subcriterionIds.length
    ? await supabase
        .from("ahp_alternative_scores")
        .select("alternative_id, subcriterion_id")
        .in("subcriterion_id", subcriterionIds)
    : { data: [] as { alternative_id: string; subcriterion_id: string }[] };

  const alternativesList = alternatives ?? [];
  const incomplete = incompleteAlternatives(alternativeProgress(subcriterionIds, alternativesList, scores ?? []));
  const creditsLabel = creditBalance === 1 ? "crédito" : "créditos";

  let content: React.ReactNode;
  if (!pillars || pillars.length < 2) {
    content = (
      <Blocked title="Este modelo ainda não está pronto">
        <p className="text-sm text-text-muted">
          O modelo precisa de ao menos 2 pilares, e a estrutura é definida pela G2A.
        </p>
        <ContactG2a subject={`Configurar estrutura do modelo ${model.name}`} organizationSlug={org.organizationSlug} />
      </Blocked>
    );
  } else if (alternativesList.length < MIN_ALTERNATIVES_TO_RUN) {
    content = (
      <Blocked title={`Cadastre ao menos ${MIN_ALTERNATIVES_TO_RUN} alternativas`}>
        <p className="text-sm text-text-muted">
          O ranking compara alternativas entre si. Você tem {alternativesList.length} cadastrada
          {alternativesList.length === 1 ? "" : "s"}.
        </p>
        <Link
          href={`/models/${model.id}/alternatives`}
          className="text-sm font-medium text-gold-700 underline-offset-4 hover:text-gold-600 hover:underline"
        >
          Ir para as fichas de avaliação
        </Link>
      </Blocked>
    );
  } else if (incomplete.length > 0) {
    content = (
      <Blocked title="Complete as fichas de avaliação antes de gerar o resultado">
        <p className="text-sm text-text-muted">
          Alternativas sem ficha completa entrariam no ranking com nota zero, e a execução consome crédito.
        </p>
        <ul className="flex w-full flex-col divide-y divide-border-subtle text-sm">
          {incomplete.map((alt) => (
            <li key={alt.id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-text-primary">{alt.name}</span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-text-faint">
                  {alt.answered} de {alt.total} avaliados
                </span>
                <Link
                  href={`/models/${model.id}/alternatives/${alt.id}`}
                  className="font-medium text-gold-700 underline-offset-4 hover:text-gold-600 hover:underline"
                >
                  Completar
                </Link>
              </span>
            </li>
          ))}
        </ul>
      </Blocked>
    );
  } else if (creditBalance < RUN_COST_CREDITS) {
    content = (
      <Blocked title="Você não tem créditos para gerar o resultado">
        <p className="text-sm text-text-muted">
          Cada execução usa {RUN_COST_CREDITS} crédito. Os créditos são liberados pela G2A.
        </p>
        <ContactG2a label="Solicitar créditos" subject="Solicitação de créditos (AHP)" organizationSlug={org.organizationSlug} />
      </Blocked>
    );
  } else {
    content = (
      <>
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <Coins className="h-4 w-4 text-gold-600" />
          Saldo: <strong className="text-text-primary">{creditBalance} {creditsLabel}</strong> · esta execução usa{" "}
          {RUN_COST_CREDITS}.
        </p>
        <PairwiseSliders modelId={model.id} pillars={pillars} creditBalance={creditBalance} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title">{model.name}</h1>
        <p className="text-sm text-text-muted">
          Compare a importância relativa entre os pilares para calcular os pesos (AHP).
        </p>
      </div>

      <ModelTabs modelId={model.id} />

      {content}
    </div>
  );
}
