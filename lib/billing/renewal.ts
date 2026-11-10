import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AsaasApiError, type AsaasClient } from "../asaas/client";
import type { AsaasPayment, AsaasSubscription } from "../asaas/types";

/**
 * Renovação automática (cartão) pelo Asaas.
 *
 * Regras (ver migration 20261110000000_renovacao):
 *  - A assinatura renova o plano que a criou (plan_subscriptions.plan_id), reiniciando-o: 6 meses a partir do
 *    vencimento, simulações do zero. Quem aplica a cobrança de renovação é apply_asaas_payment.
 *  - Só uma assinatura ativa por organização: a mais recente vale e as anteriores são canceladas no Asaas.
 *  - Invariante: a cobrança da assinatura vence no dia do vencimento do contrato. Se um plano maior é somado e
 *    o vencimento anda, a data da cobrança pendente (e da próxima) é ajustada.
 *  - O token do cartão só é usado na hora de criar a assinatura; nunca é gravado.
 */

type Admin = SupabaseClient;

const PAID = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);
const DRIFT_TOLERANCE_DAYS = 2;

/** Data (AAAA-MM-DD) no fuso de São Paulo: o Asaas interpreta datas de vencimento como data local. */
export function toSaoPauloDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Soma meses a uma data AAAA-MM-DD (dia limitado ao último dia do mês de destino). */
export function addMonthsToDate(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = total % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${targetYear}-${pad(targetMonth + 1)}-${pad(Math.min(day, lastDay))}`;
}

function dateToUtc(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Diferença em dias entre duas datas AAAA-MM-DD (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((dateToUtc(b) - dateToUtc(a)) / 86_400_000);
}

export function dueDateDrifted(current: string | null | undefined, expected: string): boolean {
  if (!current) return true;
  return Math.abs(daysBetween(current.slice(0, 10), expected)) > DRIFT_TOLERANCE_DAYS;
}

type OrderRow = {
  id: string;
  organization_id: string;
  plan_id: string;
  kind: string;
  payment_method: string;
  auto_renew: boolean;
  amount_cents: number;
  organization_plan_id: string | null;
};

/**
 * Depois que uma cobrança foi aplicada: garante a assinatura de renovação (pedido com renovação automática no
 * cartão), mantém uma só ativa e alinha a data da cobrança com o vencimento do contrato. Idempotente: roda de
 * novo a cada evento e só age quando falta algo. Erros viram exceção (evento FAILED, reprocessável).
 */
export async function syncRenewal(admin: Admin, asaas: AsaasClient, payment: AsaasPayment): Promise<void> {
  if (!PAID.has(payment.status)) return;

  const { data: row, error } = await admin
    .from("asaas_payments")
    .select("order_id, organization_id, organization_plan_id, applied_at")
    .eq("asaas_payment_id", payment.id)
    .maybeSingle();
  if (error) throw error;
  if (!row || !row.applied_at || !row.organization_plan_id || !row.organization_id) return;

  const organizationId: string = row.organization_id;
  const contractId: string = row.organization_plan_id;

  let order: OrderRow | null = null;
  if (row.order_id) {
    const { data, error: orderError } = await admin
      .from("plan_orders")
      .select("id, organization_id, plan_id, kind, payment_method, auto_renew, amount_cents, organization_plan_id")
      .eq("id", row.order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    order = data;
  }

  // 1) Pedido com renovação automática no cartão: garante a assinatura.
  let newSubscriptionId: string | null = null;
  if (order && order.auto_renew && order.payment_method === "CREDIT_CARD") {
    newSubscriptionId = await ensureSubscriptionForOrder(admin, asaas, order, payment, contractId, organizationId);
  }

  // 2) Só uma assinatura ativa: a mais recente vale (as anteriores são canceladas no Asaas).
  if (newSubscriptionId) {
    await cancelOtherSubscriptions(admin, asaas, organizationId, newSubscriptionId);
  }

  // 3) Alinha a cobrança da assinatura do contrato com o vencimento atual.
  const { data: contract, error: contractError } = await admin
    .from("organization_plans")
    .select("valid_until, asaas_subscription_id, auto_renew")
    .eq("id", contractId)
    .maybeSingle();
  if (contractError) throw contractError;
  if (contract?.auto_renew && contract.asaas_subscription_id) {
    await alignSubscriptionDueDate(asaas, contract.asaas_subscription_id, contract.valid_until);
  }
}

/** Devolve o id da assinatura que renova este pedido, criando-a (pagamento parcelado) quando preciso. */
async function ensureSubscriptionForOrder(
  admin: Admin,
  asaas: AsaasClient,
  order: OrderRow,
  payment: AsaasPayment,
  contractId: string,
  organizationId: string
): Promise<string | null> {
  const { data: existing, error } = await admin
    .from("plan_subscriptions")
    .select("asaas_subscription_id, status")
    .eq("origin_order_id", order.id)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing.status === "active" ? existing.asaas_subscription_id : null;

  // Cartão à vista com renovação (RECURRENT): o checkout já criou a assinatura e apply_asaas_payment a registrou.
  if (payment.subscription) return null;

  // Parcelado: cria a assinatura com o token do cartão. Antes de criar, procura por externalReference, porque
  // POST nunca é repetido sozinho e um timeout pode ter deixado a assinatura criada sem registro aqui.
  const found = await asaas.get<{ data?: AsaasSubscription[] }>("/subscriptions", { externalReference: order.id });
  let subscription = (found.data ?? []).find((s) => !s.deleted && s.status === "ACTIVE") ?? null;

  if (!subscription) {
    const token = payment.creditCard?.creditCardToken;
    if (!token) throw new Error("pagamento sem token do cartão: não é possível criar a renovação automática");

    const { data: contract, error: contractError } = await admin
      .from("organization_plans")
      .select("valid_until")
      .eq("id", contractId)
      .single();
    if (contractError) throw contractError;

    subscription = await asaas.post<AsaasSubscription>("/subscriptions", {
      customer: payment.customer,
      billingType: "CREDIT_CARD",
      creditCardToken: token,
      value: order.amount_cents / 100,
      cycle: "SEMIANNUALLY",
      nextDueDate: toSaoPauloDate(contract.valid_until),
      externalReference: order.id,
      description: "Renovação automática do plano AHP (a cada 6 meses)",
    });
  }

  const { error: insertError } = await admin.from("plan_subscriptions").upsert(
    {
      organization_id: organizationId,
      plan_id: order.plan_id,
      origin_order_id: order.id,
      asaas_subscription_id: subscription.id,
      status: "active",
      environment: asaas.env,
    },
    { onConflict: "asaas_subscription_id", ignoreDuplicates: true }
  );
  if (insertError) throw insertError;

  const { error: contractUpdateError } = await admin
    .from("organization_plans")
    .update({ auto_renew: true, asaas_subscription_id: subscription.id })
    .eq("id", contractId);
  if (contractUpdateError) throw contractUpdateError;

  return subscription.id;
}

/** Cancela no Asaas (e marca aqui) toda assinatura ativa da organização que não seja a indicada. */
async function cancelOtherSubscriptions(admin: Admin, asaas: AsaasClient, organizationId: string, keepId: string): Promise<void> {
  const { data, error } = await admin
    .from("plan_subscriptions")
    .select("asaas_subscription_id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .neq("asaas_subscription_id", keepId);
  if (error) throw error;
  for (const sub of data ?? []) {
    await deleteAsaasSubscription(asaas, sub.asaas_subscription_id);
    const { error: updateError } = await admin
      .from("plan_subscriptions")
      .update({ status: "canceled" })
      .eq("asaas_subscription_id", sub.asaas_subscription_id);
    if (updateError) throw updateError;
  }
}

async function deleteAsaasSubscription(asaas: AsaasClient, subscriptionId: string): Promise<void> {
  try {
    await asaas.delete(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
  } catch (err) {
    // Já removida no Asaas: o objetivo (não cobrar mais) está cumprido.
    if (err instanceof AsaasApiError && err.status === 404) return;
    throw err;
  }
}

/**
 * Faz a cobrança da assinatura cair no dia do vencimento do contrato. A cobrança pendente e a data da
 * próxima (6 meses depois) são ajustadas só quando fogem do esperado.
 */
export async function alignSubscriptionDueDate(asaas: AsaasClient, subscriptionId: string, validUntil: string): Promise<void> {
  const target = toSaoPauloDate(validUntil);
  const id = encodeURIComponent(subscriptionId);

  const pending = await asaas.get<{ data?: Pick<AsaasPayment, "id" | "dueDate">[] }>("/payments", {
    subscription: subscriptionId,
    status: "PENDING",
  });
  const next = (pending.data ?? []).slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  if (next && dueDateDrifted(next.dueDate, target)) {
    await asaas.put(`/payments/${encodeURIComponent(next.id)}`, { dueDate: target });
  }

  const subscription = await asaas.get<AsaasSubscription>(`/subscriptions/${id}`);
  const expectedNext = next ? addMonthsToDate(target, 6) : target;
  if (dueDateDrifted(subscription.nextDueDate, expectedNext)) {
    await asaas.put(`/subscriptions/${id}`, { nextDueDate: expectedNext });
  }
}

/** Cancela a renovação automática da organização (todas as assinaturas ativas). Devolve quantas cancelou. */
export async function cancelOrganizationRenewal(admin: Admin, asaas: AsaasClient, organizationId: string): Promise<number> {
  const { data, error } = await admin
    .from("plan_subscriptions")
    .select("asaas_subscription_id")
    .eq("organization_id", organizationId)
    .eq("status", "active");
  if (error) throw error;

  for (const sub of data ?? []) {
    await deleteAsaasSubscription(asaas, sub.asaas_subscription_id);
    const { error: updateError } = await admin
      .from("plan_subscriptions")
      .update({ status: "canceled" })
      .eq("asaas_subscription_id", sub.asaas_subscription_id);
    if (updateError) throw updateError;
  }

  const { error: contractError } = await admin
    .from("organization_plans")
    .update({ auto_renew: false, asaas_subscription_id: null })
    .eq("organization_id", organizationId)
    .eq("auto_renew", true);
  if (contractError) throw contractError;

  return (data ?? []).length;
}

/** Evento SUBSCRIPTION_DELETED/INACTIVATED: marca a assinatura e desliga a renovação do contrato que a usava. */
export async function markSubscriptionCanceled(admin: Admin, subscriptionId: string): Promise<void> {
  const { error } = await admin.from("plan_subscriptions").update({ status: "canceled" }).eq("asaas_subscription_id", subscriptionId);
  if (error) throw error;
  const { error: contractError } = await admin
    .from("organization_plans")
    .update({ auto_renew: false, asaas_subscription_id: null })
    .eq("asaas_subscription_id", subscriptionId);
  if (contractError) throw contractError;
}
