import Link from "next/link";
import { Plus, Layers, ArrowRight } from "lucide-react";
import { canManageModels, requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

export default async function ModelsPage() {
  const org = await requireOrgContext();
  const canManage = canManageModels(org.role);
  const supabase = await createClient();

  const { data: models } = await supabase
    .from("ahp_models")
    .select("id, name, updated_at")
    .eq("organization_id", org.organizationId)
    .order("updated_at", { ascending: false });

  const modelHref = (modelId: string) => (canManage ? `/models/${modelId}/edit` : `/models/${modelId}/alternatives`);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Modelos</h1>
        {canManage && (
          <Link href="/models/new">
            <Button>
              <Plus className="h-4 w-4" />
              Novo modelo
            </Button>
          </Link>
        )}
      </div>

      {!models || models.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-soft text-gold-400">
              <Layers className="h-6 w-6" />
            </div>
            <CardTitle>Nenhum modelo ainda</CardTitle>
            <CardDescription>
              {canManage
                ? "Crie seu primeiro modelo de decisão AHP para começar."
                : "Ainda não há modelos disponíveis para sua organização."}
            </CardDescription>
            {canManage && (
              <Link href="/models/new">
                <Button className="mt-2">
                  <Plus className="h-4 w-4" />
                  Criar modelo
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => (
            <Link key={model.id} href={modelHref(model.id)}>
              <Card className="h-full transition-colors hover:border-border-strong">
                <CardContent className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text-primary">{model.name}</p>
                    <p className="text-xs text-text-faint">
                      Atualizado em {new Date(model.updated_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-text-faint" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
