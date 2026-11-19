import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardList, Plus } from "lucide-react";
import { requireUserContext } from "@/lib/user-context";
import { requireModelAccess } from "@/lib/ahp/model-access-server";
import { getBillingSummary } from "@/lib/billing/user-plan";
import { planBlockMessage } from "@/lib/billing/plan-summary";
import { ContactG2a } from "@/components/layout/contact-g2a";
import { createClient } from "@/lib/supabase/server";
import { ModelTabs } from "@/components/ahp/model-tabs";
import { DeleteAlternativeButton } from "@/components/ahp/delete-alternative-button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { CreateAlternativeForm } from "@/components/ahp/create-alternative-form";
import { Badge } from "@/components/ui/badge";
import { GRID_BUS_COLUMNS, toGridBus, type GridBusRow } from "@/lib/grid/types";
import { assessViability } from "@/lib/grid/viability";
import { buttonClasses } from "@/components/ui/button";
import { isTrialBilling } from "@/lib/billing/trial";
import { isScoring } from "@/lib/ahp/scoring";
import { MIN_ALTERNATIVES_TO_RUN, alternativeProgress } from "@/lib/ahp/readiness";

const VIABILITY_BADGE = {
  ok: { label: "Conexão viável", variant: "success" },
  attention: { label: "Conexão com atenção", variant: "gold" },
  inviable: { label: "Inviável", variant: "danger" },
} as const;

export default async function AlternativesPage({
  params,
  searchParams,
}: {
  params: Promise<{ modelId: string }>;
  searchParams: Promise<{ salva?: string }>;
}) {
  const { modelId } = await params;
  const { salva } = await searchParams;
  const user = await requireUserContext();
  const supabase = await createClient();

  const { data: model } = await supabase
    .from("ahp_models")
    .select("id, name, trial_available")
    .eq("id", modelId)
    .maybeSingle();
  if (!model) notFound();
  await requireModelAccess(model, user.userId);

  const billing = await getBillingSummary(user.userId);
  const planBlocked = billing.mode === "plan" && !billing.access.usable;
  const planFull = billing.mode === "plan" && billing.access.usable && billing.alternativesRemaining === 0;

  const { data: alternatives } = await supabase
    .from("ahp_alternatives")
    .select(`id, name, updated_at, power_mw, bus:grid_buses(${GRID_BUS_COLUMNS})`)
    .eq("model_id", modelId)
    .order("updated_at", { ascending: false });

  // Progresso de cada ficha (mesma regra da execução: triagem não conta; no trial, só os liberados).
  const trial = isTrialBilling(billing);
  const { data: pillarRows } = await supabase.from("ahp_pillars").select("id").eq("model_id", modelId);
  const pillarIds = (pillarRows ?? []).map((p) => p.id);
  const { data: subRows } = pillarIds.length
    ? await supabase.from("ahp_subcriteria").select("id, score_mode, trial").in("pillar_id", pillarIds)
    : { data: [] as { id: string; score_mode: string; trial: boolean }[] };
  const subcriterionIds = (subRows ?? []).filter((s) => isScoring(s, trial)).map((s) => s.id);
  const altIds = (alternatives ?? []).map((a) => a.id);
  const [{ data: scoreRows }, { data: valueRows }] = altIds.length && subcriterionIds.length
    ? await Promise.all([
        supabase.from("ahp_alternative_scores").select("alternative_id, subcriterion_id").in("alternative_id", altIds),
        supabase.from("ahp_alternative_values").select("alternative_id, subcriterion_id").in("alternative_id", altIds),
      ])
    : [{ data: [] }, { data: [] }];
  const progress = new Map(
    alternativeProgress(subcriterionIds, alternatives ?? [], [...(scoreRows ?? []), ...(valueRows ?? [])]).map((p) => [p.id, p])
  );
  const completeCount = [...progress.values()].filter((p) => p.total > 0 && p.answered >= p.total).length;
  const readyToRun = completeCount >= MIN_ALTERNATIVES_TO_RUN;
  const saved = salva ? (alternatives ?? []).find((a) => a.id === salva) : undefined;
  const canCreate = !planBlocked && !planFull;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title">{model.name}</h1>
        <p className="text-sm text-text-muted">Cadastre as alternativas avaliadas neste modelo.</p>
      </div>

      <ModelTabs modelId={model.id} />

      {(saved || readyToRun) && (
        <Card className={saved ? "border-success/40" : undefined}>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              <div>
                {saved && <p className="font-medium text-text-primary">Ficha de “{saved.name}” concluída.</p>}
                <p className="text-sm text-text-muted">
                  {readyToRun
                    ? `${completeCount} fichas completas. Você já pode gerar o resultado, ou cadastrar mais alternativas.`
                    : `Cadastre mais ${MIN_ALTERNATIVES_TO_RUN - completeCount === 1 ? "1 alternativa" : `${MIN_ALTERNATIVES_TO_RUN - completeCount} alternativas`} para gerar o resultado.`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canCreate && (
                <a href="#nova-alternativa" className={buttonClasses(readyToRun ? "secondary" : "primary", "sm")}>
                  <Plus className="h-4 w-4" />
                  Cadastrar outra
                </a>
              )}
              {readyToRun && (
                <Link href={`/models/${model.id}/run`} className={buttonClasses("primary", "sm")}>
                  Gerar resultado
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {billing.mode === "plan" && billing.access.usable && (
        <p className="text-sm text-text-muted">
          Plano {billing.planName}: <strong className="text-text-primary">{billing.alternativesUsed} de {billing.maxAlternatives}</strong>{" "}
          alternativas cadastradas na sua conta.
        </p>
      )}

      {planBlocked && billing.mode === "plan" && !billing.access.usable ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-2 py-5">
            <p className="font-medium text-text-primary">Seu plano não está ativo</p>
            <p className="text-sm text-text-muted">{planBlockMessage(billing.access.reason)}</p>
            <Link href="/billing" className="text-sm font-medium text-gold-700 underline-offset-4 hover:underline">
              Ver meu plano
            </Link>
          </CardContent>
        </Card>
      ) : planFull && billing.mode === "plan" ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-2 py-5">
            <p className="font-medium text-text-primary">Limite de alternativas do plano atingido</p>
            <p className="text-sm text-text-muted">
              O plano {billing.planName} permite até {billing.maxAlternatives} alternativas. Para cadastrar mais, fale com a G2A sobre um plano maior.
            </p>
            <ContactG2a label="Falar com a G2A" subject="Upgrade de plano — mais alternativas (AHP)" userEmail={user.userEmail ?? undefined} />
          </CardContent>
        </Card>
      ) : (
        <CreateAlternativeForm modelId={modelId} autoFocus={Boolean(saved) && !readyToRun} />
      )}

      {!alternatives || alternatives.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="icon-badge-gold h-12 w-12">
              <ClipboardList className="h-6 w-6" />
            </div>
            <CardTitle>Nenhuma alternativa ainda</CardTitle>
            <CardDescription>Adicione a primeira alternativa acima para começar a avaliar.</CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {alternatives.map((alt) => {
            // Many-to-one: o PostgREST devolve um objeto (ou null); o cast cobre a tipagem genérica.
            const busRow = alt.bus as unknown as GridBusRow | null;
            const bus = busRow ? toGridBus(busRow) : null;
            const viability = bus ? assessViability(bus, alt.power_mw != null ? Number(alt.power_mw) : null) : null;
            return (
              <Card key={alt.id}>
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <Link
                    href={`/models/${modelId}/alternatives/${alt.id}`}
                    className="flex flex-1 flex-col font-medium text-text-primary hover:text-gold-700"
                  >
                    {alt.name}
                    {bus && (
                      <span className="text-xs font-normal text-text-muted">
                        {bus.name} · {bus.uf} · {bus.kv} kV
                      </span>
                    )}
                  </Link>
                  {(() => {
                    const p = progress.get(alt.id);
                    if (!p || p.total === 0) return null;
                    return p.answered >= p.total ? (
                      <Badge variant="success">Ficha completa</Badge>
                    ) : (
                      <Badge variant="neutral">
                        {p.answered} de {p.total}
                      </Badge>
                    );
                  })()}
                  {viability && (
                    <Badge variant={VIABILITY_BADGE[viability.status].variant}>{VIABILITY_BADGE[viability.status].label}</Badge>
                  )}
                  <DeleteAlternativeButton modelId={modelId} alternativeId={alt.id} alternativeName={alt.name} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
