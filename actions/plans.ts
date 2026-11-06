"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AsaasApiError, getAsaasClient, getAsaasEnv } from "@/lib/asaas/client";
import { profileFromRow } from "@/lib/billing/billing-profile";
import { CHECKOUT_ITEM_IMAGE_BASE64 } from "@/lib/billing/checkout-image";
import { isBillingEnabledFor } from "@/lib/billing/config";
import {
  CHECKOUT_MINUTES_TO_EXPIRE,
  MODALITIES,
  PURCHASE_MODALITIES,
  buildCheckoutPayload,
  isAsaasCheckoutLink,
} from "@/lib/billing/purchase";
import { requireOrgContext } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";

const purchaseSchema = z.object({
  planCode: z.string().trim().regex(/^[A-Z][0-9]{1,2}$/, "Plano inválido."),
  modality: z.enum(PURCHASE_MODALITIES),
  acceptedRenewal: z.boolean(),
});

export type StartPlanPurchaseResult = { ok: true; url: string } | { ok: false; error: string };

const GENERIC_ERROR = "Não foi possível iniciar o pagamento agora. Tente novamente em instantes.";
const CREATING_STALE_MINUTES = 5;
// Checkout vale 60 min; margem para o evento de expiração chegar antes de tratarmos o pedido como esquecido.
const AWAITING_STALE_MINUTES = CHECKOUT_MINUTES_TO_EXPIRE + 30;

/**
 * Inicia a compra de um plano: cria o pedido, cria o Checkout no Asaas e devolve o link de pagamento.
 * NUNCA ativa o plano: a ativação só acontece pelo webhook do pagamento confirmado.
 */
export async function startPlanPurchase(input: {
  planCode: string;
  modality: string;
  acceptedRenewal: boolean;
}): Promise<StartPlanPurchaseResult> {
  const org = await requireOrgContext();
  if (!isBillingEnabledFor(org.organizationSlug)) {
    return { ok: false, error: "A contratação online ainda não está disponível." };
  }
  if (org.role !== "owner" && org.role !== "admin") {
    return { ok: false, error: "Apenas proprietários e administradores podem contratar um plano." };
  }

  const parsed = purchaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { planCode, modality, acceptedRenewal } = parsed.data;
  const info = MODALITIES[modality];

  if (info.autoRenew && !acceptedRenewal) {
    return { ok: false, error: "Aceite a renovação automática para pagar no cartão." };
  }

  const admin = createAdminClient();

  // O preço vem do banco, nunca do navegador.
  const { data: plan } = await admin
    .from("plans")
    .select("id, code, name, price_cents, max_installments, validity_months, active")
    .eq("code", planCode)
    .maybeSingle();
  if (!plan || !plan.active) return { ok: false, error: "Plano não encontrado." };

  const { data: profileRow } = await admin
    .from("billing_profiles")
    .select("*")
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  const profile = profileFromRow(profileRow);
  if (!profile) {
    return { ok: false, error: "Preencha os dados de cobrança da organização antes de contratar." };
  }

  // Esta etapa cobre a primeira contratação. Quem já tem plano em andamento renova por outro fluxo.
  const { data: openContract } = await admin
    .from("organization_plans")
    .select("id")
    .eq("organization_id", org.organizationId)
    .in("status", ["active", "past_due", "suspended"])
    .gt("valid_until", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (openContract) {
    return { ok: false, error: "Sua organização já possui um plano. Para renovar ou trocar, fale com a G2A." };
  }

  // Libera pedidos esquecidos (falha no meio do caminho ou evento de expiração que não chegou).
  const now = Date.now();
  await admin
    .from("plan_orders")
    .update({ status: "failed" })
    .eq("organization_id", org.organizationId)
    .eq("status", "creating")
    .lt("created_at", new Date(now - CREATING_STALE_MINUTES * 60_000).toISOString());
  await admin
    .from("plan_orders")
    .update({ status: "expired" })
    .eq("organization_id", org.organizationId)
    .eq("status", "awaiting_payment")
    .lt("created_at", new Date(now - AWAITING_STALE_MINUTES * 60_000).toISOString());

  let environment: ReturnType<typeof getAsaasEnv>;
  let asaas: ReturnType<typeof getAsaasClient>;
  try {
    environment = getAsaasEnv();
    asaas = getAsaasClient();
  } catch (err) {
    console.error("[billing] configuração do Asaas inválida", err instanceof Error ? err.message : err);
    return { ok: false, error: GENERIC_ERROR };
  }

  const { data: order, error: orderError } = await admin
    .from("plan_orders")
    .insert({
      organization_id: org.organizationId,
      plan_id: plan.id,
      kind: "initial",
      payment_method: info.paymentMethod,
      installment_count: info.maxInstallments(plan.max_installments),
      amount_cents: plan.price_cents,
      auto_renew: info.autoRenew,
      status: "creating",
      environment,
      created_by: org.userId,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    // 23505 = índice único de pedido em aberto: já existe uma compra em andamento (ou clique duplo).
    if (orderError?.code === "23505") {
      return { ok: false, error: "Você já tem um pagamento em andamento. Conclua-o ou aguarde ele expirar." };
    }
    console.error("[billing] falha ao criar pedido", orderError?.message);
    return { ok: false, error: GENERIC_ERROR };
  }

  const failOrder = async () => {
    await admin.from("plan_orders").update({ status: "failed" }).eq("id", order.id);
  };

  let checkout: { id?: unknown; link?: unknown };
  try {
    const payload = buildCheckoutPayload({
      orderId: order.id,
      plan: {
        code: plan.code,
        name: plan.name,
        priceCents: plan.price_cents,
        maxInstallments: plan.max_installments,
        validityMonths: plan.validity_months,
      },
      modality,
      profile,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
      imageBase64: CHECKOUT_ITEM_IMAGE_BASE64,
    });
    // POST nunca é repetido sozinho. Se falhar, o pedido vira "failed" e o usuário tenta de novo.
    checkout = await asaas.post<{ id?: unknown; link?: unknown }>("/checkouts", payload);
  } catch (err) {
    await failOrder();
    if (err instanceof AsaasApiError) {
      // Códigos e descrições do Asaas não trazem dado pessoal; ajudam a diagnosticar.
      const details = err.errors.map((e) => e.description).filter(Boolean).join(" ");
      console.error("[billing] Asaas recusou o checkout", err.status, err.errors.map((e) => `${e.code}: ${e.description}`).join("; "));
      // 400 = dado recusado (ex.: nome, CEP): o usuário consegue corrigir em Configurações.
      if (err.status === 400 && details) {
        return { ok: false, error: `O Asaas recusou os dados de cobrança: ${details.slice(0, 200)} Revise-os em Configurações da organização.` };
      }
    } else {
      console.error("[billing] falha ao criar checkout", err instanceof Error ? err.message : err);
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  if (typeof checkout.id !== "string" || !isAsaasCheckoutLink(checkout.link)) {
    await failOrder();
    console.error("[billing] resposta do checkout sem id/link válido");
    return { ok: false, error: GENERIC_ERROR };
  }

  const { error: updateError } = await admin
    .from("plan_orders")
    .update({ asaas_checkout_id: checkout.id, checkout_url: checkout.link, status: "awaiting_payment" })
    .eq("id", order.id);
  if (updateError) {
    // Sem o id do checkout no pedido, o pagamento não seria ligado a ele. Não entrega o link.
    await failOrder();
    console.error("[billing] falha ao gravar o checkout no pedido", updateError.message);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/billing");
  return { ok: true, url: checkout.link };
}
