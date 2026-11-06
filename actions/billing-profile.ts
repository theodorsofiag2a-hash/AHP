"use server";

import { revalidatePath } from "next/cache";
import { billingProfileSchema, type BillingProfileInput } from "@/lib/billing/billing-profile";
import { isBillingEnabledFor } from "@/lib/billing/config";
import { requireOrgContext } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";

export type SaveBillingProfileResult = { ok: true } | { ok: false; error: string };

/**
 * Salva os dados de cobrança da organização (usados no Checkout e na nota fiscal). Só proprietário e
 * administrador. A tabela não tem policy de escrita: a gravação é feita aqui, com service role, depois
 * de conferir o papel do usuário.
 */
export async function saveBillingProfile(input: BillingProfileInput): Promise<SaveBillingProfileResult> {
  const org = await requireOrgContext();
  if (!isBillingEnabledFor(org.organizationSlug)) return { ok: false, error: "Cobrança indisponível no momento." };
  if (org.role !== "owner" && org.role !== "admin") {
    return { ok: false, error: "Apenas proprietários e administradores podem editar os dados de cobrança." };
  }

  const parsed = billingProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const p = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.from("billing_profiles").upsert(
    {
      organization_id: org.organizationId,
      legal_name: p.legalName,
      cpf_cnpj: p.cpfCnpj,
      email: p.email,
      phone: p.phone,
      postal_code: p.postalCode,
      address: p.address,
      address_number: p.addressNumber,
      complement: p.complement ?? null,
      province: p.province,
    },
    { onConflict: "organization_id" }
  );

  if (error) {
    console.error("[billing] falha ao salvar dados de cobrança", org.organizationId, error.message);
    return { ok: false, error: "Não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/billing");
  revalidatePath("/settings/organization");
  return { ok: true };
}
