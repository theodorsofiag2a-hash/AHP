import { describe, expect, it } from "vitest";
import { buildHistoryRows, describePlanOrder } from "./history";

describe("histórico", () => {
  it("descreve a forma de pagamento da contratação", () => {
    expect(describePlanOrder({ planName: "Entrada", paymentMethod: "PIX", installmentCount: 1 })).toBe("Plano Entrada · Pix");
    expect(describePlanOrder({ planName: "Entrada", paymentMethod: "CREDIT_CARD", installmentCount: 3 })).toBe(
      "Plano Entrada · cartão em até 3x"
    );
    expect(describePlanOrder({ planName: "Entrada", paymentMethod: "CREDIT_CARD", installmentCount: 1 })).toBe(
      "Plano Entrada · cartão à vista"
    );
  });

  it("mistura créditos e contratações, da mais recente para a mais antiga", () => {
    const rows = buildHistoryRows(
      [{ id: "1", type: "consumption", amount: -1, balanceAfter: 0, description: "Execução", createdAt: "2026-11-06T10:00:00Z" }],
      [
        { id: "a", planName: "Entrada", amountCents: 500000, paymentMethod: "PIX", installmentCount: 1, paidAt: "2026-11-09T19:36:00Z" },
        { id: "b", planName: "Intermediário", amountCents: 1000000, paymentMethod: "PIX", installmentCount: 1, paidAt: "2026-11-09T19:46:00Z" },
      ]
    );
    expect(rows.map((r) => r.id)).toEqual(["p-b", "p-a", "c-1"]);
    expect(rows[0]).toMatchObject({ kind: "plan", description: "Plano Intermediário · Pix" });
    expect((rows[0] as { valueLabel: string }).valueLabel.replace(/\s/g, " ")).toBe("R$ 10.000,00");
  });
});
