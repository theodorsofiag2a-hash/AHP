"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserContext } from "@/lib/user-context";
import { isPlatformAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const grantSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
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
  email: string;
  amount: number;
  description: string;
}): Promise<GrantCreditsResult> {
  const user = await requireUserContext();
  if (!isPlatformAdmin(user.userEmail)) {
    return { ok: false, error: "Sem permissão para conceder créditos." };
  }

  const parsed = grantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const admin = createAdminClient();

  // Poucas contas: percorre as páginas de usuários até achar o e-mail.
  let targetUserId: string | null = null;
  for (let page = 1; !targetUserId; page++) {
    const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (listError) return { ok: false, error: listError.message };
    targetUserId = data.users.find((u) => u.email?.toLowerCase() === parsed.data.email)?.id ?? null;
    if (data.users.length < 200) break;
  }
  if (!targetUserId) {
    return { ok: false, error: "Nenhuma conta encontrada com este e-mail." };
  }

  const { error } = await admin.from("credit_transactions").insert({
    user_id: targetUserId,
    type: "manual_grant",
    amount: parsed.data.amount,
    description: parsed.data.description,
    created_by: user.userId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/billing");
  return { ok: true };
}
