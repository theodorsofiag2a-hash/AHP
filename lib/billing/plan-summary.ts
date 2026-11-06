import { getPlanAccess, graceDaysLeft, remainingAlternatives, remainingRuns, type PlanAccess, type PlanBlockReason, type PlanStatus } from "./entitlements";

/** Resumo do plano contratado da organização, pronto para a interface. */
export type PlanSummary = {
  mode: "plan";
  planName: string;
  planCode: string;
  status: PlanStatus;
  access: PlanAccess;
  validUntil: string;
  periodStartedAt: string;
  autoRenew: boolean;
  maxAlternatives: number;
  alternativesUsed: number;
  alternativesRemaining: number;
  runsLimit: number | null;
  runsUsed: number;
  /** null = ilimitadas */
  runsRemaining: number | null;
  graceDaysLeft: number | null;
};

/** Organização sem plano: segue o regime antigo de créditos. */
export type LegacySummary = { mode: "legacy"; creditBalance: number };

export type OrgBillingSummary = LegacySummary | PlanSummary;

export type ContractInput = {
  status: PlanStatus;
  valid_until: string;
  period_started_at: string;
  past_due_since: string | null;
  max_alternatives: number;
  runs_limit: number | null;
  auto_renew: boolean;
};

export function buildPlanSummary(
  contract: ContractInput,
  plan: { name: string; code: string },
  usage: { alternativesUsed: number; runsUsed: number },
  now: Date = new Date()
): PlanSummary {
  const planContract = {
    status: contract.status,
    validUntil: contract.valid_until,
    pastDueSince: contract.past_due_since,
    periodStartedAt: contract.period_started_at,
    maxAlternatives: contract.max_alternatives,
    runsLimit: contract.runs_limit,
  };
  return {
    mode: "plan",
    planName: plan.name,
    planCode: plan.code,
    status: contract.status,
    access: getPlanAccess(planContract, now),
    validUntil: contract.valid_until,
    periodStartedAt: contract.period_started_at,
    autoRenew: contract.auto_renew,
    maxAlternatives: contract.max_alternatives,
    alternativesUsed: usage.alternativesUsed,
    alternativesRemaining: remainingAlternatives(planContract, usage.alternativesUsed),
    runsLimit: contract.runs_limit,
    runsUsed: usage.runsUsed,
    runsRemaining: remainingRuns(planContract, usage.runsUsed),
    graceDaysLeft: graceDaysLeft(planContract, now),
  };
}

export function formatDatePt(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function pluralSimulations(count: number): string {
  return `${count} ${count === 1 ? "simulação" : "simulações"}`;
}

const BLOCK_MESSAGES: Record<PlanBlockReason, string> = {
  expired: "Seu plano venceu. Renove para voltar a criar alternativas e rodar simulações.",
  suspended: "Seu plano está suspenso. Fale com a G2A para regularizar.",
  canceled: "Seu plano foi cancelado. Contrate um novo plano para continuar.",
  grace_over: "O pagamento do plano está em atraso e a carência terminou. Regularize o pagamento para voltar a usar.",
};

export function planBlockMessage(reason: PlanBlockReason): string {
  return BLOCK_MESSAGES[reason];
}

const BLOCK_LABELS: Record<PlanBlockReason, string> = {
  expired: "vencido",
  suspended: "suspenso",
  canceled: "cancelado",
  grace_over: "pagamento em atraso",
};

/** Texto e tom do selo do topo da tela. */
export function planBadge(summary: PlanSummary): { label: string; tone: "gold" | "danger" } {
  if (!summary.access.usable) {
    return { label: `Plano ${summary.planName} · ${BLOCK_LABELS[summary.access.reason]}`, tone: "danger" };
  }
  if (summary.status === "past_due") {
    return { label: `Plano ${summary.planName} · pagamento em atraso`, tone: "danger" };
  }
  if (summary.runsRemaining === null) {
    return { label: `Plano ${summary.planName}`, tone: "gold" };
  }
  return { label: `Plano ${summary.planName} · ${pluralSimulations(summary.runsRemaining)}`, tone: "gold" };
}
