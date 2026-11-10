import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { addMonthsToDate, daysBetween, dueDateDrifted, toSaoPauloDate } from "./renewal";
import { RENEWAL_WINDOW_DAYS, daysUntil, isRenewalWindowOpen } from "./renewal-window";

describe("datas da renovação", () => {
  it("usa o dia de São Paulo (e não o UTC) para a data de vencimento", () => {
    expect(toSaoPauloDate("2027-05-10T01:30:00Z")).toBe("2027-05-09");
    expect(toSaoPauloDate("2027-05-09T19:46:15Z")).toBe("2027-05-09");
  });

  it("soma meses limitando ao último dia do mês", () => {
    expect(addMonthsToDate("2026-11-09", 6)).toBe("2027-05-09");
    expect(addMonthsToDate("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonthsToDate("2026-09-15", 6)).toBe("2027-03-15");
    expect(addMonthsToDate("2026-12-10", 12)).toBe("2027-12-10");
  });

  it("diferença em dias entre datas", () => {
    expect(daysBetween("2027-05-09", "2027-05-12")).toBe(3);
    expect(daysBetween("2027-05-12", "2027-05-09")).toBe(-3);
    expect(daysBetween("2027-02-28", "2027-03-01")).toBe(1);
  });

  it("só considera fora do esperado acima de 2 dias de diferença", () => {
    expect(dueDateDrifted("2027-05-09", "2027-05-09")).toBe(false);
    expect(dueDateDrifted("2027-05-10", "2027-05-09")).toBe(false);
    expect(dueDateDrifted("2027-05-12", "2027-05-09")).toBe(true);
    expect(dueDateDrifted(null, "2027-05-09")).toBe(true);
    expect(dueDateDrifted("2027-05-09T00:00:00", "2027-05-09")).toBe(false);
  });
});

describe("janela de renovação", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const inDays = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  it("abre nos últimos 30 dias e continua aberta depois do vencimento", () => {
    expect(RENEWAL_WINDOW_DAYS).toBe(30);
    expect(isRenewalWindowOpen(inDays(100), now)).toBe(false);
    expect(isRenewalWindowOpen(inDays(31), now)).toBe(false);
    expect(isRenewalWindowOpen(inDays(30), now)).toBe(true);
    expect(isRenewalWindowOpen(inDays(5), now)).toBe(true);
    expect(isRenewalWindowOpen(inDays(-3), now)).toBe(true);
  });

  it("data inválida não abre a janela", () => {
    expect(isRenewalWindowOpen("não é data", now)).toBe(false);
  });

  it("dias até o vencimento", () => {
    expect(daysUntil(inDays(10), now)).toBe(10);
    expect(daysUntil(inDays(-2), now)).toBe(-2);
  });
});
