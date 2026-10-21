import { notFound } from "next/navigation";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { ModelTabs } from "@/components/ahp/model-tabs";
import { DeleteAlternativeButton } from "@/components/ahp/delete-alternative-button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { CreateAlternativeForm } from "@/components/ahp/create-alternative-form";

export default async function AlternativesPage({
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

  const { data: alternatives } = await supabase
    .from("ahp_alternatives")
    .select("id, name, updated_at")
    .eq("model_id", modelId)
    .order("updated_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title">{model.name}</h1>
        <p className="text-sm text-text-muted">Cadastre as alternativas avaliadas neste modelo.</p>
      </div>

      <ModelTabs modelId={model.id} />

      <CreateAlternativeForm modelId={modelId} />

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
          {alternatives.map((alt) => (
            <Card key={alt.id}>
              <CardContent className="flex items-center justify-between py-3">
                <Link
                  href={`/models/${modelId}/alternatives/${alt.id}`}
                  className="flex-1 font-medium text-text-primary hover:text-gold-700"
                >
                  {alt.name}
                </Link>
                <DeleteAlternativeButton modelId={modelId} alternativeId={alt.id} alternativeName={alt.name} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
