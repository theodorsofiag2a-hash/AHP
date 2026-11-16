import Link from "next/link";
import { Layers, ArrowLeft } from "lucide-react";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { ContactG2a } from "@/components/layout/contact-g2a";
import { ModelCard } from "@/components/ahp/model-card";
import { MODEL_CATEGORIES, groupHref, groupModels } from "@/lib/ahp/model-groups";

export default async function ModelsPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const { categoria } = await searchParams;
  const org = await requireOrgContext();
  const supabase = await createClient();

  const { data: models } = await supabase
    .from("ahp_models")
    .select("id, name, updated_at, category, variant_label")
    .eq("organization_id", org.organizationId)
    .eq("status", "active")
    .order("updated_at", { ascending: false });

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

      {selected ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {selected.models.map((model) => (
            <ModelCard
              key={model.id}
              href={`/models/${model.id}/alternatives`}
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
              A G2A configura o modelo de decisão (pilares e critérios) da sua organização. Fale com a G2A para começar.
            </CardDescription>
            <ContactG2a subject="Configurar modelo de decisão (AHP)" organizationSlug={org.organizationSlug} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <ModelCard
              key={group.key}
              href={groupHref(group)}
              title={group.title}
              subtitle={`Atualizado em ${new Date(group.updatedAt).toLocaleDateString("pt-BR")}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
