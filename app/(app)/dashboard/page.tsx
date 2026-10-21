import Link from "next/link";
import { Layers, ArrowRight, Boxes, Coins, Activity } from "lucide-react";
import { requireOrgContext } from "@/lib/org";
import { getCreditBalance } from "@/lib/credits";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { ContactG2a } from "@/components/layout/contact-g2a";

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
    { label: "Modelos ativos", value: modelsCount ?? 0, icon: Boxes, href: "/models" },
    { label: "Créditos restantes", value: creditBalance, icon: Coins, href: "/billing" },
    { label: "Execuções este mês", value: runsThisMonth ?? 0, icon: Activity, href: null },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-page-title">Dashboard</h1>
        <p className="text-sm text-text-muted">Bem-vindo, {org.organizationName}.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => {
          const card = (
            <Card className={kpi.href ? "h-full transition-all duration-200 hover:-translate-y-1 hover:border-gold-500/40 hover:shadow-card-hover" : "h-full"}>
              <CardContent className="flex items-center gap-3">
                <div className="icon-badge-gold h-10 w-10 shrink-0">
                  <kpi.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-text-muted">{kpi.label}</p>
                  <p className="font-display text-2xl font-semibold text-text-primary">{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          );
          return kpi.href ? (
            <Link key={kpi.label} href={kpi.href}>
              {card}
            </Link>
          ) : (
            <div key={kpi.label}>{card}</div>
          );
        })}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-eyebrow-gold font-ui">Modelos recentes</h2>
          {!!models?.length && (
            <Link
              href="/models"
              className="flex items-center gap-1 text-xs font-medium text-gold-700 hover:text-gold-600"
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
              <CardDescription className="max-w-md">
                A G2A configura o modelo de decisão (pilares e critérios) da sua organização. Fale com a G2A para começar.
              </CardDescription>
              <ContactG2a subject="Configurar modelo de decisão (AHP)" organizationSlug={org.organizationSlug} />
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
    </div>
  );
}
