"use server";

import { revalidatePath } from "next/cache";
import { billingProfileSchema, type BillingProfileInput } from "@/lib/billing/billing-profile";
import { isBillingEnabledFor } from "@/lib/billing/config";
import { requireUserContext } from "@/lib/user-context";
import { createAdminClient } from "@/lib/supabase/admin";

export type SaveBillingProfileResult = { ok: true } | { ok: false; error: string };

/**
 * Salva os dados de cobrança do usuário (usados no Checkout e na nota fiscal). A tabela não tem policy de
 * escrita: a gravação é feita aqui, com service role, para o usuário autenticado.
 */
export async function saveBillingProfile(input: BillingProfileInput): Promise<SaveBillingProfileResult> {
  const user = await requireUserContext();
  if (!isBillingEnabledFor(user.userEmail ?? "")) return { ok: false, error: "Cobrança indisponível no momento." };

  const parsed = billingProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const p = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.from("billing_profiles").upsert(
    {
      user_id: user.userId,
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
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("[billing] falha ao salvar dados de cobrança", user.userId, error.message);
    return { ok: false, error: "Não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/billing");
  revalidatePath("/settings");
  return { ok: true };
}
