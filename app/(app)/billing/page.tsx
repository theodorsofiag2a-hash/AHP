import { Coins, ExternalLink, Handshake } from "lucide-react";
import { requireUserContext } from "@/lib/user-context";
import { createClient } from "@/lib/supabase/server";
import { getBillingSummary } from "@/lib/billing/user-plan";
import { CurrentPlanCard } from "@/components/billing/current-plan-card";
import { isBillingEnabledFor } from "@/lib/billing/config";
import { isAsaasCheckoutLink } from "@/lib/billing/purchase";
import { CheckoutReturnBanner, type CheckoutReturn } from "@/components/billing/checkout-return-banner";
import { type PurchaseBlock } from "@/components/billing/purchase-dialog";
import { buttonClasses } from "@/components/ui/button";
import { getCreditBalance, getCreditTransactions } from "@/lib/credits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactG2a } from "@/components/layout/contact-g2a";
import { TransactionHistoryTable } from "@/components/billing/transaction-history-table";
import type { PaidOrderInput } from "@/lib/billing/history";
import { PlanOrdersTable } from "@/components/billing/plan-orders-table";

const RETURN_STATUSES: readonly CheckoutReturn[] = ["sucesso", "cancelado", "expirado"];
// Pedido aguardando pagamento por mais que isto é tratado como esquecido (checkout vale 60 min).
const OPEN_ORDER_MAX_AGE_MS = 90 * 60_000;

function openOrderCutoffIso(): string {
  return new Date(Date.now() - OPEN_ORDER_MAX_AGE_MS).toISOString();
}

// Contratações pagas do próprio usuário (RLS).
async function getPaidOrders(userId: string): Promise<PaidOrderInput[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plan_orders")
    .select("id, amount_cents, payment_method, installment_count, updated_at, plans(name)")
    .eq("user_id", userId)
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
  const user = await requireUserContext();
  const [balance, transactions] = await Promise.all([
    getCreditBalance(user.userId),
    getCreditTransactions(user.userId),
  ]);

  const summary = await getBillingSummary(user.userId);
  const paidOrders = await getPaidOrders(user.userId);
  const billingEnabled = isBillingEnabledFor(user.userEmail ?? "");
  const { checkout } = await searchParams;
  const returnStatus = RETURN_STATUSES.find((value) => value === checkout) ?? null;

  let block: PurchaseBlock = null;
  const planActive = summary.mode === "plan" && summary.access.usable;
  let openOrder: { url: string; planName: string } | null = null;

  if (billingEnabled) {
    const supabase = await createClient();
    const [{ data: order }, { data: profile }] = await Promise.all([
      supabase
        .from("plan_orders")
        .select("checkout_url, created_at, plans(name)")
        .eq("user_id", user.userId)
        .eq("status", "awaiting_payment")
        .gt("created_at", openOrderCutoffIso())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("billing_profiles").select("user_id").eq("user_id", user.userId).maybeSingle(),
    ]);


    const orderPlan = Array.isArray(order?.plans) ? order?.plans[0] : order?.plans;
    if (order && isAsaasCheckoutLink(order.checkout_url)) {
      openOrder = { url: order.checkout_url, planName: orderPlan?.name ?? "" };
    }

    if (openOrder) block = "open_order";
    else if (!profile) block = "no_profile";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title">Créditos e contratação</h1>
        <p className="text-sm text-text-muted">Acompanhe seu saldo e o histórico de uso.</p>
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
          <CurrentPlanCard summary={summary} billingEnabled={billingEnabled} canManage purchaseBlock={block} />
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
              <p className="font-medium text-text-primary">Contratação sob consulta</p>
              <p className="text-sm text-text-muted">
                A versão completa é contratada sob consulta. Fale com a G2A para montar a proposta da sua empresa.
              </p>
              <div className="mt-3">
                <ContactG2a size="sm" label="Falar com a G2A" subject="Contratação AHP (sob consulta)" userEmail={user.userEmail ?? undefined} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>Movimentações de crédito e contratações de plano da sua conta.</CardDescription>
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
