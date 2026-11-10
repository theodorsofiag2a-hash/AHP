import { describe, expect, it } from "vitest";
import {
  PLAN_GRACE_DAYS,
  getPlanAccess,
  graceDaysLeft,
  isPlanUsable,
  pickCurrentContract,
  planErrorMessage,
  remainingAlternatives,
  remainingRuns,
  type PlanContract,
} from "./entitlements";

const NOW = new Date("2026-11-10T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const days = (n: number) => new Date(NOW.getTime() + n * DAY);

function plan(overrides: Partial<PlanContract> = {}): PlanContract {
  return {
    status: "active",
    validUntil: days(100),
    pastDueSince: null,
    periodStartedAt: days(-80),
    maxAlternatives: 10,
    runsLimit: 10,
    ...overrides,
  };
}

describe("plano utilizável (espelha plan_is_usable)", () => {
  it("ativo e dentro da validade", () => {
    expect(getPlanAccess(plan(), NOW)).toEqual({ usable: true });
  });

  it("ativo mas vencido -> expired (sem cron, derivado na leitura)", () => {
    expect(getPlanAccess(plan({ validUntil: days(-1) }), NOW)).toEqual({ usable: false, reason: "expired" });
  });

  it("vence exatamente agora -> bloqueado (valid_until > now é estrito)", () => {
    expect(isPlanUsable(plan({ validUntil: NOW }), NOW)).toBe(false);
  });

  it("aceita datas em texto ISO (como vêm do Supabase)", () => {
    expect(isPlanUsable(plan({ validUntil: days(5).toISOString() }), NOW)).toBe(true);
  });

  it("validade ausente ou inválida bloqueia", () => {
    expect(isPlanUsable(plan({ validUntil: null }), NOW)).toBe(false);
    expect(isPlanUsable(plan({ validUntil: "lixo" }), NOW)).toBe(false);
  });

  it("suspenso, cancelado, expirado e pendente não usam", () => {
    expect(getPlanAccess(plan({ status: "suspended" }), NOW)).toEqual({ usable: false, reason: "suspended" });
    expect(getPlanAccess(plan({ status: "canceled" }), NOW)).toEqual({ usable: false, reason: "canceled" });
    expect(getPlanAccess(plan({ status: "expired" }), NOW)).toEqual({ usable: false, reason: "expired" });
    expect(isPlanUsable(plan({ status: "pending" }), NOW)).toBe(false);
  });
});

describe("renovação automática: carência depois do vencimento (espelha plan_is_usable)", () => {
  it("com renovação automática, vencido há 3 dias ainda usa (cobrança da renovação pendente)", () => {
    expect(getPlanAccess(plan({ validUntil: days(-3), autoRenew: true }), NOW)).toEqual({ usable: true });
  });

  it("com renovação automática, vencido há 10 dias ou mais bloqueia", () => {
    expect(getPlanAccess(plan({ validUntil: days(-10), autoRenew: true }), NOW)).toEqual({ usable: false, reason: "expired" });
    expect(getPlanAccess(plan({ validUntil: days(-11), autoRenew: true }), NOW)).toEqual({ usable: false, reason: "expired" });
  });

  it("sem renovação automática, vence na data", () => {
    expect(getPlanAccess(plan({ validUntil: days(-3), autoRenew: false }), NOW)).toEqual({ usable: false, reason: "expired" });
    expect(getPlanAccess(plan({ validUntil: days(-3) }), NOW)).toEqual({ usable: false, reason: "expired" });
  });

  it("renovação recusada: em atraso e vencido, a carência de atraso também vale", () => {
    const base = { status: "past_due" as const, validUntil: days(-2), autoRenew: true };
    expect(getPlanAccess(plan({ ...base, pastDueSince: days(-1) }), NOW)).toEqual({ usable: true });
    expect(getPlanAccess(plan({ ...base, pastDueSince: days(-10) }), NOW)).toEqual({ usable: false, reason: "grace_over" });
  });
});

describe("carência de inadimplência", () => {
  it("a carência é de 10 dias, igual ao banco", () => {
    expect(PLAN_GRACE_DAYS).toBe(10);
  });

  it("em atraso dentro da carência continua usando", () => {
    expect(isPlanUsable(plan({ status: "past_due", pastDueSince: days(-9) }), NOW)).toBe(true);
  });

  it("em atraso há 10 dias exatos já bloqueia (since + 10d > now é estrito)", () => {
    expect(getPlanAccess(plan({ status: "past_due", pastDueSince: days(-10) }), NOW)).toEqual({
      usable: false,
      reason: "grace_over",
    });
  });

  it("em atraso sem data de início da carência usa (como o banco)", () => {
    expect(isPlanUsable(plan({ status: "past_due", pastDueSince: null }), NOW)).toBe(true);
  });

  it("em atraso mas vencido por validade -> expired", () => {
    expect(getPlanAccess(plan({ status: "past_due", pastDueSince: days(-1), validUntil: days(-1) }), NOW)).toEqual({
      usable: false,
      reason: "expired",
    });
  });

  it("dias restantes de carência", () => {
    expect(graceDaysLeft(plan({ status: "past_due", pastDueSince: days(-4) }), NOW)).toBe(6);
    expect(graceDaysLeft(plan({ status: "past_due", pastDueSince: days(-30) }), NOW)).toBe(0);
    expect(graceDaysLeft(plan({ status: "past_due", pastDueSince: null }), NOW)).toBe(10);
    expect(graceDaysLeft(plan(), NOW)).toBeNull();
  });
});

describe("contratação vigente (espelha current_org_plan)", () => {
  it("ignora pendentes e pega a mais recente que não é pendente", () => {
    const list = [
      { id: "c", status: "pending" as const },
      { id: "b", status: "active" as const },
      { id: "a", status: "expired" as const },
    ];
    expect(pickCurrentContract(list)?.id).toBe("b");
  });

  it("sem nenhuma contratação (ou só pendentes) -> null = regime legado de créditos", () => {
    expect(pickCurrentContract([])).toBeNull();
    expect(pickCurrentContract([{ status: "pending" as const }])).toBeNull();
  });
});

describe("saldos do plano", () => {
  it("simulações restantes; null = ilimitadas; nunca negativo", () => {
    expect(remainingRuns({ runsLimit: 10 }, 3)).toBe(7);
    expect(remainingRuns({ runsLimit: 10 }, 10)).toBe(0);
    expect(remainingRuns({ runsLimit: 10 }, 12)).toBe(0);
    expect(remainingRuns({ runsLimit: null }, 999)).toBeNull();
  });

  it("vagas de alternativas restantes", () => {
    expect(remainingAlternatives({ maxAlternatives: 10 }, 4)).toBe(6);
    expect(remainingAlternatives({ maxAlternatives: 10 }, 11)).toBe(0);
  });
});

describe("mensagens dos erros do banco", () => {
  it("reconhece os códigos de plano dentro da mensagem do Postgres", () => {
    expect(planErrorMessage("plan_alternatives_limit")).toMatch(/limite de alternativas/);
    expect(planErrorMessage("ERROR: plan_runs_exhausted (P0001)")).toMatch(/simulações/);
    expect(planErrorMessage("plan_not_active")).toMatch(/não está ativo/);
  });

  it("devolve null para outros erros", () => {
    expect(planErrorMessage("insufficient_credits")).toBeNull();
    expect(planErrorMessage(null)).toBeNull();
  });
});
