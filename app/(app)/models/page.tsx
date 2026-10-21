import Link from "next/link";
import { Layers, ArrowRight } from "lucide-react";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

export default async function ModelsPage() {
  const org = await requireOrgContext();
  const supabase = await createClient();

  const { data: models } = await supabase
    .from("ahp_models")
    .select("id, name, updated_at")
    .eq("organization_id", org.organizationId)
    .order("updated_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-page-title">Modelos</h1>

      {!models || models.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="icon-badge-gold h-12 w-12">
              <Layers className="h-6 w-6" />
            </div>
            <CardTitle>Nenhum modelo ainda</CardTitle>
            <CardDescription>Ainda não há modelos disponíveis para sua organização.</CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => (
            <Link key={model.id} href={`/models/${model.id}/alternatives`}>
              <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:border-gold-500/40 hover:shadow-card-hover">
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
