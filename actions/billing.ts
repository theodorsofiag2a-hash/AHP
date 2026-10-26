"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrgContext } from "@/lib/org";
import { isPlatformAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const grantSchema = z.object({
  organizationSlug: z.string().trim().min(1).max(80),
  // Teto defensivo contra erro de digitação (ex. casa decimal a mais): nenhum pacote real
  // chega perto disso. Ajustar aqui se um dia existir concessão legítima maior.
  amount: z.number().int().positive().max(100_000, "Quantidade acima do limite permitido (100.000)."),
  description: z.string().trim().min(1).max(500, "Descrição muito longa (máx. 500 caracteres)."),
});

export type GrantCreditsResult = { ok: true } | { ok: false; error: string };

/**
 * Concessão manual de créditos — fluxo provisório enquanto não há gateway de pagamento
 * integrado (cliente paga "por fora", G2A libera os créditos). Restrito à equipe interna
 * via PLATFORM_ADMIN_EMAILS; usa o client com service role para bypassar RLS.
 */
export async function grantCredits(input: {
  organizationSlug: string;
  amount: number;
  description: string;
}): Promise<GrantCreditsResult> {
  const org = await requireOrgContext();
  if (!isPlatformAdmin(org.userEmail)) {
    return { ok: false, error: "Sem permissão para conceder créditos." };
  }

  const parsed = grantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const admin = createAdminClient();

  const { data: targetOrg, error: orgError } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", parsed.data.organizationSlug)
    .maybeSingle();

  if (orgError || !targetOrg) {
    return { ok: false, error: "Organização não encontrada para o slug informado." };
  }

  const { error } = await admin.from("credit_transactions").insert({
    organization_id: targetOrg.id,
    type: "manual_grant",
    amount: parsed.data.amount,
    description: parsed.data.description,
    created_by: org.userId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/billing");
  return { ok: true };
}
