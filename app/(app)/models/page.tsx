import Link from "next/link";
import { Layers, ArrowLeft } from "lucide-react";
import { requireUserContext } from "@/lib/user-context";
import { getBillingSummary } from "@/lib/billing/user-plan";
import { isModelLocked } from "@/lib/ahp/model-access";
import { isTrialBilling } from "@/lib/billing/trial";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { ContactG2a } from "@/components/layout/contact-g2a";
import { ModelCard } from "@/components/ahp/model-card";
import { MODEL_CATEGORIES, groupHref, groupModels } from "@/lib/ahp/model-groups";

export default async function ModelsPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const { categoria } = await searchParams;
  const user = await requireUserContext();
  const supabase = await createClient();
  const trial = isTrialBilling(await getBillingSummary(user.userId));

  const { data: models } = await supabase
    .from("ahp_models")
    .select("id, name, updated_at, category, variant_label, trial_available")
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  // Nome dos modelos liberados na versão gratuita, vindo do banco (ex.: "o modelo Projeto → Investidor").
  const freeModels = (models ?? []).filter((m) => m.trial_available);
  const freeModelsLabel = freeModels.length
    ? `${freeModels.length === 1 ? "o modelo" : "os modelos"} ${freeModels
        .map((m) => {
          const categoryTitle = MODEL_CATEGORIES.find((c) => c.key === m.category)?.title;
          return categoryTitle && m.variant_label ? `${categoryTitle} → ${m.variant_label}` : m.name;
        })
        .join(", ")}`
    : "";

  // ?categoria=projeto: mostra as visões daquela categoria (ex.: Investidor e Fabricante).
  const category = MODEL_CATEGORIES.find((c) => c.key === categoria);
  const groups = groupModels(models ?? []);
  const selected = category ? groups.find((g) => g.category === category.key) : undefined;

  return (
    <div className="flex flex-col gap-6">
      {selected ? (
        <div>
          <Link
            href="/models"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-text-muted transition-colors hover:text-gold-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar para os modelos
          </Link>
          <h1 className="text-page-title">{selected.title}</h1>
        </div>
      ) : (
        <h1 className="text-page-title">Modelos</h1>
      )}

      {trial && (
        <p className="rounded-md border border-gold-500/30 bg-gold-soft px-3 py-2 text-sm text-gold-700">
          Versão gratuita: você usa {freeModelsLabel || "os modelos liberados"}. Os demais aparecem bloqueados e
          ficam disponíveis na versão completa (contratação sob consulta com a G2A).
        </p>
      )}

      {selected ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {selected.models.map((model) => (
            <ModelCard
              key={model.id}
              href={`/models/${model.id}/alternatives`}
              locked={isModelLocked(model, trial)}
              title={model.variant_label ?? model.name}
              subtitle={`Atualizado em ${new Date(model.updated_at).toLocaleDateString("pt-BR")}`}
            />
          ))}
        </div>
      ) : !models || models.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="icon-badge-gold h-12 w-12">
              <Layers className="h-6 w-6" />
            </div>
            <CardTitle>Nenhum modelo ainda</CardTitle>
            <CardDescription className="max-w-md">
              A G2A configura o modelo de decisão (pilares e critérios). Fale com a G2A para começar.
            </CardDescription>
            <ContactG2a subject="Configurar modelo de decisão (AHP)" userEmail={user.userEmail ?? undefined} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <ModelCard
              key={group.key}
              href={groupHref(group)}
              locked={group.models.every((m) => isModelLocked(m, trial))}
              title={group.title}
              subtitle={`Atualizado em ${new Date(group.updatedAt).toLocaleDateString("pt-BR")}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
