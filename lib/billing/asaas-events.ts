import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AsaasApiError, type AsaasClient } from "../asaas/client";
import { toCents, type AsaasEnv, type AsaasPayment, type AsaasWebhookEnvelope } from "../asaas/types";

/**
 * Processamento dos webhooks do Asaas.
 *
 * Regras:
 *  - O corpo do evento NÃO é confiável (o token do webhook é estático e não há assinatura HMAC): a verdade
 *    de uma cobrança vem sempre de GET /payments/{id}. O evento só diz "olhe a cobrança X".
 *  - Entrega "at least once": o mesmo evento chega repetido e fora de ordem. Tudo aqui é idempotente
 *    (upsert por id) e a ordem não importa, porque cada processamento relê o estado atual no Asaas.
 *  - Esta etapa espelha as cobranças em asaas_payments e fecha pedidos cancelados/expirados. A ativação
 *    do plano (organization_plans) entra na Etapa 7, em cima desse espelho.
 */

export type EventKind = "payment" | "checkout" | "subscription" | "other";

const MAX_ERROR_LENGTH = 500;

/** Valida o mínimo do envelope: id do evento e tipo. Qualquer outra coisa é rejeitada. */
export function parseEnvelope(raw: unknown): AsaasWebhookEnvelope | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.id !== "string" || candidate.id.length === 0 || candidate.id.length > 200) return null;
  if (typeof candidate.event !== "string" || candidate.event.length === 0 || candidate.event.length > 100) return null;
  return candidate as AsaasWebhookEnvelope;
}

export function classifyEvent(eventType: string): EventKind {
  if (eventType.startsWith("PAYMENT_")) return "payment";
  if (eventType.startsWith("CHECKOUT_")) return "checkout";
  if (eventType.startsWith("SUBSCRIPTION_")) return "subscription";
  return "other";
}

function readId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function getPaymentId(envelope: AsaasWebhookEnvelope): string | null {
  return readId(envelope.payment);
}

export function getCheckoutId(envelope: AsaasWebhookEnvelope): string | null {
  return readId(envelope.checkout);
}

type OrderLink = { orderId: string; organizationId: string; organizationPlanId: string | null };

/**
 * Linha de asaas_payments a partir da cobrança lida no Asaas. Campos de ligação (pedido/organização) só
 * entram quando conhecidos, para um novo processamento nunca apagar um vínculo já gravado. `applied_at`
 * nunca entra aqui: é a marca de idempotência de quem aplica o efeito.
 */
export function buildPaymentRow(payment: AsaasPayment, environment: AsaasEnv, link: OrderLink | null) {
  return {
    asaas_payment_id: payment.id,
    status: payment.deleted ? "DELETED" : payment.status,
    billing_type: payment.billingType ?? null,
    value_cents: typeof payment.value === "number" ? toCents(payment.value) : null,
    due_date: payment.dueDate ?? null,
    confirmed_at: payment.confirmedDate ?? payment.paymentDate ?? null,
    credit_date: payment.creditDate ?? null,
    installment_number: payment.installmentNumber ?? null,
    asaas_checkout_id: payment.checkoutSession ?? null,
    asaas_installment_id: payment.installment ?? null,
    asaas_subscription_id: payment.subscription ?? null,
    environment,
    ...(link
      ? {
          order_id: link.orderId,
          organization_id: link.organizationId,
          ...(link.organizationPlanId ? { organization_plan_id: link.organizationPlanId } : {}),
        }
      : {}),
  };
}

type Admin = SupabaseClient;

/** Grava o evento na caixa de entrada. Retorna o registro e se ele já existia (reentrega). */
export async function storeEvent(
  admin: Admin,
  envelope: AsaasWebhookEnvelope,
  environment: AsaasEnv
): Promise<{ rowId: string; status: string; duplicate: boolean }> {
  const inserted = await admin
    .from("asaas_events")
    .upsert(
      { asaas_event_id: envelope.id, event_type: envelope.event, payload: envelope, environment },
      { onConflict: "asaas_event_id", ignoreDuplicates: true }
    )
    .select("id, status");
  if (inserted.error) throw inserted.error;

  if (inserted.data && inserted.data.length > 0) {
    return { rowId: inserted.data[0].id, status: inserted.data[0].status, duplicate: false };
  }

  // Já existia (ignoreDuplicates não devolve a linha): lê o registro atual.
  const existing = await admin
    .from("asaas_events")
    .select("id, status")
    .eq("asaas_event_id", envelope.id)
    .single();
  if (existing.error) throw existing.error;
  return { rowId: existing.data.id, status: existing.data.status, duplicate: true };
}

/**
 * Processa um evento já gravado. Idempotente: evento DONE é ignorado; falha vira FAILED com o erro e
 * pode ser reprocessada (reentrega do Asaas ou varredura). Nunca lança.
 */
export async function processEvent(admin: Admin, asaas: AsaasClient, rowId: string): Promise<void> {
  const { data: row, error } = await admin
    .from("asaas_events")
    .select("id, status, attempts, payload")
    .eq("id", rowId)
    .single();
  if (error || !row) {
    console.error("[asaas] evento não encontrado para processar", rowId, error?.message);
    return;
  }
  if (row.status === "DONE") return;

  await admin.from("asaas_events").update({ attempts: row.attempts + 1 }).eq("id", rowId);

  try {
    const envelope = parseEnvelope(row.payload);
    if (!envelope) throw new Error("payload inválido");
    await handleEvent(admin, asaas, envelope);
    await admin
      .from("asaas_events")
      .update({ status: "DONE", processed_at: new Date().toISOString(), last_error: null })
      .eq("id", rowId);
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, MAX_ERROR_LENGTH);
    console.error("[asaas] falha ao processar evento", rowId, message);
    await admin.from("asaas_events").update({ status: "FAILED", last_error: message }).eq("id", rowId);
  }
}

async function handleEvent(admin: Admin, asaas: AsaasClient, envelope: AsaasWebhookEnvelope): Promise<void> {
  switch (classifyEvent(envelope.event)) {
    case "payment":
      return handlePaymentEvent(admin, asaas, envelope);
    case "checkout":
      return handleCheckoutEvent(admin, envelope);
    default:
      // Assinaturas e demais eventos: só ficam registrados por enquanto (Etapas 7 e 8).
      return;
  }
}

async function handlePaymentEvent(admin: Admin, asaas: AsaasClient, envelope: AsaasWebhookEnvelope): Promise<void> {
  const paymentId = getPaymentId(envelope);
  if (!paymentId) throw new Error(`evento ${envelope.event} sem payment.id`);

  let payment: AsaasPayment;
  try {
    payment = await asaas.get<AsaasPayment>(`/payments/${encodeURIComponent(paymentId)}`);
  } catch (err) {
    // 404 só é "cobrança apagada" quando o próprio evento diz isso. Em qualquer outro evento, 404 indica
    // configuração errada (ex.: chave de outra conta Asaas) e precisa aparecer como FAILED, não passar em silêncio.
    if (err instanceof AsaasApiError && err.status === 404 && envelope.event === "PAYMENT_DELETED") {
      await admin.from("asaas_payments").update({ status: "DELETED" }).eq("asaas_payment_id", paymentId);
      return;
    }
    throw err;
  }

  const link = payment.checkoutSession ? await findOrderByCheckout(admin, payment.checkoutSession) : null;
  const row = buildPaymentRow(payment, asaas.env, link);

  // Sem ignoreDuplicates: reprocessar atualiza o espelho. `applied_at` fica fora do upsert, então é preservado.
  const { error } = await admin.from("asaas_payments").upsert(row, { onConflict: "asaas_payment_id" });
  if (error) throw error;

  // Aplica o efeito sobre o plano (ativa, marca em atraso, suspende). Idempotente no banco; qualquer erro
  // real vira exceção e deixa o evento FAILED para reprocessar.
  const { data: applied, error: applyError } = await admin.rpc("apply_asaas_payment", { p_asaas_payment_id: payment.id });
  if (applyError) throw new Error(`apply_asaas_payment: ${applyError.message}`);
  if (applied === "activated") {
    console.info("[asaas] plano ativado pelo pagamento", payment.id);
  } else if (applied === "merged") {
    console.info("[asaas] plano somado ao plano atual pelo pagamento", payment.id);
  } else if (applied === "suspended") {
    // Estorno/chargeback: a G2A precisa saber (a tela admin de eventos, na Etapa 10, lista estes casos).
    console.error("[asaas][ALERTA] plano suspenso por estorno/chargeback", payment.id, payment.status);
  }
}

async function findOrderByCheckout(admin: Admin, checkoutId: string): Promise<OrderLink | null> {
  const { data, error } = await admin
    .from("plan_orders")
    .select("id, organization_id, organization_plan_id")
    .eq("asaas_checkout_id", checkoutId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { orderId: data.id, organizationId: data.organization_id, organizationPlanId: data.organization_plan_id };
}

/**
 * Checkout cancelado/expirado libera o pedido em aberto (que barra nova compra). Só mexe em pedido ainda
 * aguardando pagamento, então um evento fora de ordem nunca desfaz um pedido já pago.
 */
async function handleCheckoutEvent(admin: Admin, envelope: AsaasWebhookEnvelope): Promise<void> {
  const target = envelope.event === "CHECKOUT_CANCELED" ? "canceled" : envelope.event === "CHECKOUT_EXPIRED" ? "expired" : null;
  if (!target) return; // CHECKOUT_PAID e outros: a ativação vem do pagamento confirmado (Etapa 7)

  const checkoutId = getCheckoutId(envelope);
  if (!checkoutId) throw new Error(`evento ${envelope.event} sem checkout.id`);

  const { error } = await admin
    .from("plan_orders")
    .update({ status: target })
    .eq("asaas_checkout_id", checkoutId)
    .eq("status", "awaiting_payment");
  if (error) throw error;
}
