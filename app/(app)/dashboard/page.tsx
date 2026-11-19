import Link from "next/link";
import { Layers, ArrowRight, Boxes, Coins, Activity } from "lucide-react";
import { requireUserContext } from "@/lib/user-context";
import { isModelLocked } from "@/lib/ahp/model-access";
import { getBillingSummary } from "@/lib/billing/user-plan";
import { isTrialBilling } from "@/lib/billing/trial";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { ContactG2a } from "@/components/layout/contact-g2a";
import { ModelCard } from "@/components/ahp/model-card";
import { groupHref, groupModels } from "@/lib/ahp/model-groups";

export default async function DashboardPage() {
  const user = await requireUserContext();
  const supabase = await createClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [{ data: models }, { count: modelsCount }, billing, { count: runsThisMonth }] = await Promise.all([
    supabase
      .from("ahp_models")
      .select("id, name, updated_at, category, variant_label, trial_available")
      .eq("status", "active")
      .order("updated_at", { ascending: false }),
    supabase
      .from("ahp_models")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    getBillingSummary(user.userId),
    supabase
      .from("ahp_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.userId)
      .gte("created_at", startOfMonth.toISOString()),
  ]);

  const trial = isTrialBilling(billing);

  const kpis = [
    { label: "Modelos ativos", value: modelsCount ?? 0, icon: Boxes, href: "/models" },
    billing.mode === "plan"
      ? {
          label: "Simulações restantes",
          value: billing.access.usable ? (billing.runsRemaining ?? "Ilimitadas") : "Plano inativo",
          icon: Coins,
          href: "/billing",
        }
      : isTrialBilling(billing)
        ? { label: "Versão gratuita · simulações", value: "Ilimitadas", icon: Coins, href: "/billing" }
        : { label: "Créditos restantes", value: billing.creditBalance, icon: Coins, href: "/billing" },
    { label: "Execuções este mês", value: runsThisMonth ?? 0, icon: Activity, href: null },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-page-title">Dashboard</h1>
        <p className="text-sm text-text-muted">Bem-vindo, {user.userName}.</p>
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
          <h2 className="text-eyebrow-gold font-ui">Modelos</h2>
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
                A G2A configura o modelo de decisão (pilares e critérios). Fale com a G2A para começar.
              </CardDescription>
              <ContactG2a subject="Configurar modelo de decisão (AHP)" userEmail={user.userEmail ?? undefined} />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groupModels(models).map((group) => (
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
    </div>
  );
}
