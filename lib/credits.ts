import { createClient } from "@/lib/supabase/server";

export async function getCreditBalance(organizationId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_credit_balance")
    .select("balance")
    .eq("organization_id", organizationId)
    .maybeSingle();

  return data?.balance ?? 0;
}

export interface CreditTransactionRow {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

export async function getCreditTransactions(organizationId: string, limit = 50): Promise<CreditTransactionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("credit_transactions")
    .select("id, type, amount, balance_after, description, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    balanceAfter: t.balance_after,
    description: t.description,
    createdAt: t.created_at,
  }));
}
