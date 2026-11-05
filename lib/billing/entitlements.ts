/**
 * Regras de uso do plano, em funções puras. ESPELHAM o banco (migration 20261105000000_billing_plans_asaas):
 * plan_grace_days() e plan_is_usable(). O banco é quem barra de verdade; isto serve para a interface
 * mostrar o estado e as mensagens certas. Mudou lá, mude aqui (e vice-versa).
 */

/** Dias de carência após o vencimento de uma parcela, antes de suspender o acesso. = plan_grace_days(). */
export const PLAN_GRACE_DAYS = 10;

export type PlanStatus = "pending" | "active" | "past_due" | "suspended" | "expired" | "canceled";

export type PlanContract = {
  status: PlanStatus;
  validUntil: Date | string | null;
  pastDueSince: Date | string | null;
  periodStartedAt: Date | string | null;
  maxAlternatives: number;
  /** null = simulações ilimitadas */
  runsLimit: number | null;
};

export type PlanBlockReason = "expired" | "suspended" | "canceled" | "grace_over";

export type PlanAccess = { usable: true } | { usable: false; reason: PlanBlockReason };

const DAY_MS = 24 * 60 * 60 * 1000;

function toTime(value: Date | string | null): number | null {
  if (value === null) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Contratação "vigente" da organização: a mais recente que não está pendente. Sem nenhuma -> null
 * (regime legado de créditos). Espelha current_org_plan(). `contracts` precisa vir ordenada do mais
 * novo para o mais antigo.
 */
export function pickCurrentContract<T extends { status: PlanStatus }>(contracts: readonly T[]): T | null {
  return contracts.find((c) => c.status !== "pending") ?? null;
}

/** Espelha plan_is_usable(), devolvendo também o motivo do bloqueio. */
export function getPlanAccess(plan: PlanContract, now: Date = new Date()): PlanAccess {
  if (plan.status === "suspended") return { usable: false, reason: "suspended" };
  if (plan.status === "canceled") return { usable: false, reason: "canceled" };
  if (plan.status === "expired" || plan.status === "pending") return { usable: false, reason: "expired" };

  // active / past_due
  const validUntil = toTime(plan.validUntil);
  if (validUntil === null || validUntil <= now.getTime()) return { usable: false, reason: "expired" };

  if (plan.status === "past_due") {
    const since = toTime(plan.pastDueSince);
    if (since !== null && since + PLAN_GRACE_DAYS * DAY_MS <= now.getTime()) {
      return { usable: false, reason: "grace_over" };
    }
  }
  return { usable: true };
}

export function isPlanUsable(plan: PlanContract, now: Date = new Date()): boolean {
  return getPlanAccess(plan, now).usable;
}

/** Simulações restantes no período. null = ilimitadas. Nunca negativo. */
export function remainingRuns(plan: Pick<PlanContract, "runsLimit">, usedRuns: number): number | null {
  if (plan.runsLimit === null) return null;
  return Math.max(0, plan.runsLimit - usedRuns);
}

/** Vagas de alternativas restantes (todas as alternativas da organização contam). Nunca negativo. */
export function remainingAlternatives(plan: Pick<PlanContract, "maxAlternatives">, usedAlternatives: number): number {
  return Math.max(0, plan.maxAlternatives - usedAlternatives);
}

/** Dias inteiros até o fim da carência (0 se acabou); null se não está em atraso. */
export function graceDaysLeft(plan: Pick<PlanContract, "status" | "pastDueSince">, now: Date = new Date()): number | null {
  if (plan.status !== "past_due") return null;
  const since = toTime(plan.pastDueSince);
  if (since === null) return PLAN_GRACE_DAYS;
  const left = Math.ceil((since + PLAN_GRACE_DAYS * DAY_MS - now.getTime()) / DAY_MS);
  return Math.max(0, left);
}

/** Mensagens para os erros levantados pelas triggers do banco (RAISE EXCEPTION). */
export const PLAN_ERROR_MESSAGES: Record<string, string> = {
  plan_not_active: "O plano da organização não está ativo. Regularize o pagamento ou contrate um plano.",
  plan_alternatives_limit: "Você atingiu o limite de alternativas do seu plano.",
  plan_runs_exhausted: "Você usou todas as simulações do seu plano neste período.",
};

/** Procura um código de erro de plano numa mensagem do Postgres/PostgREST. */
export function planErrorMessage(rawMessage: string | null | undefined): string | null {
  if (!rawMessage) return null;
  for (const [code, message] of Object.entries(PLAN_ERROR_MESSAGES)) {
    if (rawMessage.includes(code)) return message;
  }
  return null;
}
