import Link from "next/link";
import { Layers, ArrowRight, Boxes, Coins, Activity } from "lucide-react";
import { requireOrgContext } from "@/lib/org";
import { getCreditBalance } from "@/lib/credits";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const org = await requireOrgContext();
  const supabase = await createClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [{ data: models }, { count: modelsCount }, creditBalance, { count: runsThisMonth }] = await Promise.all([
    supabase
      .from("ahp_models")
      .select("id, name, slug, updated_at")
      .eq("organization_id", org.organizationId)
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("ahp_models")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.organizationId),
    getCreditBalance(org.organizationId),
    supabase
      .from("ahp_runs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.organizationId)
      .gte("created_at", startOfMonth.toISOString()),
  ]);

  const kpis = [
    { label: "Modelos ativos", value: modelsCount ?? 0, icon: Boxes },
    { label: "Créditos restantes", value: creditBalance, icon: Coins },
    { label: "Execuções este mês", value: runsThisMonth ?? 0, icon: Activity },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-text-muted">Bem-vindo de volta, {org.organizationName}.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex items-center gap-3">
              <div className="icon-badge-gold h-10 w-10 shrink-0">
                <kpi.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-text-muted">{kpi.label}</p>
                <p className="text-xl font-semibold text-text-primary">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Modelos recentes</h2>
          {!!models?.length && (
            <Link
              href="/models"
              className="flex items-center gap-1 text-xs font-medium text-gold-300 hover:text-gold-400"
            >
              Ver todos os modelos
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

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
                <Card className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_16px_40px_-8px_rgba(0,0,0,0.65)]">
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
    </div>
  );
}
