import { Coins, ExternalLink, Handshake } from "lucide-react";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { getOrgBillingSummary } from "@/lib/billing/org-plan";
import { CurrentPlanCard } from "@/components/billing/current-plan-card";
import { isBillingEnabledFor } from "@/lib/billing/config";
import { isAsaasCheckoutLink } from "@/lib/billing/purchase";
import { CheckoutReturnBanner, type CheckoutReturn } from "@/components/billing/checkout-return-banner";
import { PurchaseButton, type PurchaseBlock } from "@/components/billing/purchase-dialog";
import { buttonClasses } from "@/components/ui/button";
import { getCreditBalance, getCreditTransactions } from "@/lib/credits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactG2a } from "@/components/layout/contact-g2a";
import { TransactionHistoryTable } from "@/components/billing/transaction-history-table";
import { PlanCard } from "@/components/billing/plan-card";
import { PLANS } from "@/lib/plans";
import type { PaidOrderInput } from "@/lib/billing/history";
import { PlanOrdersTable } from "@/components/billing/plan-orders-table";

const RETURN_STATUSES: readonly CheckoutReturn[] = ["sucesso", "cancelado", "expirado"];
// Pedido aguardando pagamento por mais que isto é tratado como esquecido (checkout vale 60 min).
const OPEN_ORDER_MAX_AGE_MS = 90 * 60_000;

function openOrderCutoffIso(): string {
  return new Date(Date.now() - OPEN_ORDER_MAX_AGE_MS).toISOString();
}

// Contratações pagas. A leitura é restrita a proprietários e administradores (RLS); para os demais volta vazio.
async function getPaidOrders(organizationId: string): Promise<PaidOrderInput[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plan_orders")
    .select("id, amount_cents, payment_method, installment_count, updated_at, plans(name)")
    .eq("organization_id", organizationId)
    .eq("status", "paid")
    .order("updated_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((order) => {
    const plan = Array.isArray(order.plans) ? order.plans[0] : order.plans;
    return {
      id: order.id,
      planName: plan?.name ?? "",
      amountCents: order.amount_cents,
      paymentMethod: order.payment_method as PaidOrderInput["paymentMethod"],
      installmentCount: order.installment_count,
      paidAt: order.updated_at,
    };
  });
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string | string[] }> }) {
  const org = await requireOrgContext();
  const [balance, transactions] = await Promise.all([
    getCreditBalance(org.organizationId),
    getCreditTransactions(org.organizationId),
  ]);

  const summary = await getOrgBillingSummary(org.organizationId);
  const paidOrders = await getPaidOrders(org.organizationId);
  const billingEnabled = isBillingEnabledFor(org.organizationSlug);
  const { checkout } = await searchParams;
  const returnStatus = RETURN_STATUSES.find((value) => value === checkout) ?? null;

  let block: PurchaseBlock = null;
  const planActive = summary.mode === "plan" && summary.access.usable;
  let openOrder: { url: string; planName: string } | null = null;

  if (billingEnabled) {
    const supabase = await createClient();
    const isAdmin = org.role === "owner" || org.role === "admin";

    const [{ data: order }, { data: profile }] = await Promise.all([
      isAdmin
        ? supabase
            .from("plan_orders")
            .select("checkout_url, created_at, plans(name)")
            .eq("organization_id", org.organizationId)
            .eq("status", "awaiting_payment")
            .gt("created_at", openOrderCutoffIso())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      isAdmin
        ? supabase.from("billing_profiles").select("organization_id").eq("organization_id", org.organizationId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);


    const orderPlan = Array.isArray(order?.plans) ? order?.plans[0] : order?.plans;
    if (order && isAsaasCheckoutLink(order.checkout_url)) {
      openOrder = { url: order.checkout_url, planName: orderPlan?.name ?? "" };
    }

    if (!isAdmin) block = "not_admin";
    else if (openOrder) block = "open_order";
    else if (!profile) block = "no_profile";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title">Créditos e planos</h1>
        <p className="text-sm text-text-muted">Acompanhe seu saldo, conheça os planos e veja o histórico de uso.</p>
      </div>

      {returnStatus && <CheckoutReturnBanner status={returnStatus} planActive={planActive} />}

      {openOrder && returnStatus !== "sucesso" && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-medium text-text-primary">Pagamento em andamento{openOrder.planName ? ` — plano ${openOrder.planName}` : ""}</p>
              <p className="text-sm text-text-muted">Você começou uma contratação. O link vale por até 1 hora.</p>
            </div>
            <a href={openOrder.url} className={buttonClasses("primary", "sm")}>
              <ExternalLink className="h-4 w-4" />
              Continuar pagamento
            </a>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {summary.mode === "plan" ? (
          <CurrentPlanCard summary={summary} billingEnabled={billingEnabled} canManage={org.role === "owner" || org.role === "admin"} purchaseBlock={block} />
        ) : (
          <Card>
            <CardContent className="flex items-center gap-4 py-6">
              <div className="icon-badge-gold h-12 w-12">
                <Coins className="h-6 w-6" />
              </div>
              <div>
                <p className="text-3xl font-semibold tabular-nums">{balance}</p>
                <p className="text-sm text-text-muted">{balance === 1 ? "crédito disponível" : "créditos disponíveis"}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="icon-badge-gold h-12 w-12 shrink-0">
              <Handshake className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-text-primary">Como contratar</p>
              <p className="text-sm text-text-muted">
                Escolha um plano abaixo. Após a confirmação, os créditos são liberados automaticamente na sua conta.
              </p>
              <div className="mt-3">
                <ContactG2a size="sm" label="Solicitar créditos" subject="Solicitação de créditos (AHP)" organizationSlug={org.organizationSlug} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="planos-titulo" className="flex flex-col gap-4">
        <div>
          <h2 id="planos-titulo" className="text-section-label">
            Planos
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Cada plano é definido pelo número de projetos que você precisa avaliar. Todos valem por 6 meses a partir da
            contratação, e o pagamento pode ser parcelado em até 3x.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.code}
              plan={plan}
              organizationSlug={org.organizationSlug}
              action={billingEnabled ? <PurchaseButton plan={plan} block={block} currentPlanName={planActive && summary.mode === "plan" ? summary.planName : null} /> : undefined}
            />
          ))}
        </div>
        <p className="text-xs text-text-faint">
          Valores em reais. Condições comerciais sujeitas à confirmação da G2A no momento da contratação.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>Movimentações de crédito e contratações de plano da sua organização.</CardDescription>
        </CardHeader>
        <CardContent>
          {paidOrders.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2 text-sm font-medium text-text-primary">Contratações de plano</h3>
              <PlanOrdersTable orders={paidOrders} />
            </div>
          )}
          {(paidOrders.length === 0 || transactions.length > 0) && (
            <>
              {paidOrders.length > 0 && <h3 className="mb-2 text-sm font-medium text-text-primary">Movimentações de crédito</h3>}
              <TransactionHistoryTable transactions={transactions} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
