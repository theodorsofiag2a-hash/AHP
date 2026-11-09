import { describe, expect, it } from "vitest";
import { buildPlanSummary, formatDatePt, planBadge, planBlockMessage, pluralSimulations, type ContractInput } from "./plan-summary";

const NOW = new Date("2026-11-10T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const iso = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString();

function contract(overrides: Partial<ContractInput> = {}): ContractInput {
  return {
    status: "active",
    valid_until: iso(100),
    period_started_at: iso(-80),
    past_due_since: null,
    max_alternatives: 10,
    runs_limit: 10,
    auto_renew: false,
    ...overrides,
  };
}

const plan = { name: "Entrada", code: "P1" };

describe("resumo do plano", () => {
  it("calcula o que resta de simulações e de alternativas", () => {
    const s = buildPlanSummary(contract(), plan, { alternativesUsed: 4, runsUsed: 3 }, NOW);
    expect(s).toMatchObject({
      mode: "plan",
      planName: "Entrada",
      alternativesRemaining: 6,
      runsRemaining: 7,
      access: { usable: true },
      graceDaysLeft: null,
    });
  });

  it("plano sem limite de simulações: restantes = null (ilimitadas)", () => {
    const s = buildPlanSummary(contract({ runs_limit: null }), plan, { alternativesUsed: 0, runsUsed: 500 }, NOW);
    expect(s.runsRemaining).toBeNull();
  });

  it("limites esgotados nunca ficam negativos", () => {
    const s = buildPlanSummary(contract(), plan, { alternativesUsed: 12, runsUsed: 15 }, NOW);
    expect(s.alternativesRemaining).toBe(0);
    expect(s.runsRemaining).toBe(0);
  });

  it("em atraso mostra os dias de carência que restam", () => {
    const s = buildPlanSummary(contract({ status: "past_due", past_due_since: iso(-4) }), plan, { alternativesUsed: 0, runsUsed: 0 }, NOW);
    expect(s.access).toEqual({ usable: true });
    expect(s.graceDaysLeft).toBe(6);
  });

  it("vencido por data bloqueia com motivo", () => {
    const s = buildPlanSummary(contract({ valid_until: iso(-1) }), plan, { alternativesUsed: 0, runsUsed: 0 }, NOW);
    expect(s.access).toEqual({ usable: false, reason: "expired" });
  });
});

describe("selo do topo", () => {
  const usage = { alternativesUsed: 0, runsUsed: 3 };

  it("plano com simulações limitadas mostra quantas restam (singular e plural)", () => {
    expect(planBadge(buildPlanSummary(contract(), plan, usage, NOW))).toEqual({ label: "Plano Entrada · 7 simulações", tone: "gold" });
    expect(planBadge(buildPlanSummary(contract(), plan, { ...usage, runsUsed: 9 }, NOW)).label).toBe("Plano Entrada · 1 simulação");
  });

  it("plano ilimitado mostra só o nome", () => {
    expect(planBadge(buildPlanSummary(contract({ runs_limit: null }), { name: "Avançado", code: "P3" }, usage, NOW))).toEqual({
      label: "Plano Avançado",
      tone: "gold",
    });
  });

  it("em atraso (ainda na carência) e bloqueado aparecem em vermelho", () => {
    expect(planBadge(buildPlanSummary(contract({ status: "past_due", past_due_since: iso(-2) }), plan, usage, NOW))).toEqual({
      label: "Plano Entrada · pagamento em atraso",
      tone: "danger",
    });
    expect(planBadge(buildPlanSummary(contract({ status: "suspended" }), plan, usage, NOW))).toEqual({
      label: "Plano Entrada · suspenso",
      tone: "danger",
    });
    expect(planBadge(buildPlanSummary(contract({ valid_until: iso(-1) }), plan, usage, NOW)).label).toBe("Plano Entrada · vencido");
  });
});

describe("textos", () => {
  it("mensagem para cada motivo de bloqueio", () => {
    expect(planBlockMessage("expired")).toMatch(/venceu/);
    expect(planBlockMessage("suspended")).toMatch(/suspenso/);
    expect(planBlockMessage("canceled")).toMatch(/cancelado/);
    expect(planBlockMessage("grace_over")).toMatch(/carência/);
  });

  it("plural de simulações e data em português", () => {
    expect(pluralSimulations(1)).toBe("1 simulação");
    expect(pluralSimulations(0)).toBe("0 simulações");
    expect(formatDatePt("2027-05-06T15:00:00Z")).toBe("06/05/2027");
  });
});
