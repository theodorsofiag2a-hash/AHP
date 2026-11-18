import "server-only";
import { cache } from "react";
import { getCreditBalance } from "@/lib/credits";
import { createClient } from "@/lib/supabase/server";
import { buildPlanSummary, type ContractInput, type BillingSummary } from "./plan-summary";

/**
 * Situação de cobrança da conta: plano contratado (com limites e uso) ou, sem nenhuma contratação,
 * o regime antigo de créditos. Espelha current_org_plan() do banco: vale a contratação mais recente que não
 * está pendente. `cache` evita repetir as consultas entre o layout e a página na mesma requisição.
 */
export const getBillingSummary = cache(async (userId: string): Promise<BillingSummary> => {
  const supabase = await createClient();

  const { data: contract } = await supabase
    .from("user_plans")
    .select("status, valid_until, period_started_at, past_due_since, max_alternatives, runs_limit, auto_renew, plans(name, code)")
    .eq("user_id", userId)
    .neq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!contract) {
    return { mode: "legacy", creditBalance: await getCreditBalance(userId) };
  }

  const [{ count: alternativesUsed }, { count: runsUsed }] = await Promise.all([
    supabase
      .from("ahp_alternatives")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("ahp_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", contract.period_started_at),
  ]);

  const plan = Array.isArray(contract.plans) ? contract.plans[0] : contract.plans;

  return buildPlanSummary(
    contract as unknown as ContractInput,
    { name: plan?.name ?? "", code: plan?.code ?? "" },
    { alternativesUsed: alternativesUsed ?? 0, runsUsed: runsUsed ?? 0 }
  );
});
