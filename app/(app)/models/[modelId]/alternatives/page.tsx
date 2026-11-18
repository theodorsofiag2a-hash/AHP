import { notFound } from "next/navigation";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireUserContext } from "@/lib/user-context";
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

const VIABILITY_BADGE = {
  ok: { label: "Conexão viável", variant: "success" },
  attention: { label: "Conexão com atenção", variant: "gold" },
  inviable: { label: "Inviável", variant: "danger" },
} as const;

export default async function AlternativesPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const { modelId } = await params;
  const user = await requireUserContext();
  const supabase = await createClient();

  const { data: model } = await supabase
    .from("ahp_models")
    .select("id, name")
    .eq("id", modelId)
    .maybeSingle();
  if (!model) notFound();

  const billing = await getBillingSummary(user.userId);
  const planBlocked = billing.mode === "plan" && !billing.access.usable;
  const planFull = billing.mode === "plan" && billing.access.usable && billing.alternativesRemaining === 0;

  const { data: alternatives } = await supabase
    .from("ahp_alternatives")
    .select(`id, name, updated_at, power_mw, bus:grid_buses(${GRID_BUS_COLUMNS})`)
    .eq("model_id", modelId)
    .order("updated_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title">{model.name}</h1>
        <p className="text-sm text-text-muted">Cadastre as alternativas avaliadas neste modelo.</p>
      </div>

      <ModelTabs modelId={model.id} />

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
        <CreateAlternativeForm modelId={modelId} />
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
