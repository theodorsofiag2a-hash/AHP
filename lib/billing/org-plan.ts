import "server-only";
import { cache } from "react";
import { getCreditBalance } from "@/lib/credits";
import { createClient } from "@/lib/supabase/server";
import { buildPlanSummary, type ContractInput, type OrgBillingSummary } from "./plan-summary";

/**
 * Situação de cobrança da organização: plano contratado (com limites e uso) ou, sem nenhuma contratação,
 * o regime antigo de créditos. Espelha current_org_plan() do banco: vale a contratação mais recente que não
 * está pendente. `cache` evita repetir as consultas entre o layout e a página na mesma requisição.
 */
export const getOrgBillingSummary = cache(async (organizationId: string): Promise<OrgBillingSummary> => {
  const supabase = await createClient();

  const { data: contract } = await supabase
    .from("organization_plans")
    .select("status, valid_until, period_started_at, past_due_since, max_alternatives, runs_limit, auto_renew, plans(name, code)")
    .eq("organization_id", organizationId)
    .neq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!contract) {
    return { mode: "legacy", creditBalance: await getCreditBalance(organizationId) };
  }

  const [{ count: alternativesUsed }, { count: runsUsed }] = await Promise.all([
    supabase
      .from("ahp_alternatives")
      .select("id, ahp_models!inner(organization_id)", { count: "exact", head: true })
      .eq("ahp_models.organization_id", organizationId),
    supabase
      .from("ahp_runs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", contract.period_started_at),
  ]);

  const plan = Array.isArray(contract.plans) ? contract.plans[0] : contract.plans;

  return buildPlanSummary(
    contract as unknown as ContractInput,
    { name: plan?.name ?? "", code: plan?.code ?? "" },
    { alternativesUsed: alternativesUsed ?? 0, runsUsed: runsUsed ?? 0 }
  );
});
