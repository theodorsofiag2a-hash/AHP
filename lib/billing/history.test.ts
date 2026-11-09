import { describe, expect, it } from "vitest";
import { describePaymentMethod, formatCentsBrl } from "./history";

describe("histórico de contratações", () => {
  it("descreve a forma de pagamento", () => {
    expect(describePaymentMethod({ paymentMethod: "PIX", installmentCount: 1 })).toBe("Pix");
    expect(describePaymentMethod({ paymentMethod: "CREDIT_CARD", installmentCount: 3 })).toBe("Cartão em até 3x");
    expect(describePaymentMethod({ paymentMethod: "CREDIT_CARD", installmentCount: 1 })).toBe("Cartão à vista");
  });

  it("formata o valor em reais", () => {
    expect(formatCentsBrl(1000000).replace(/\s/g, " ")).toBe("R$ 10.000,00");
  });
});
