import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { AsaasPayment } from "../asaas/types";
import { isValidWebhookToken } from "../asaas/webhook-auth";
import { buildPaymentRow, classifyEvent, getCheckoutId, getPaymentId, parseEnvelope } from "./asaas-events";

const TOKEN = "a".repeat(40);

describe("token do webhook", () => {
  it("aceita o token correto", () => {
    expect(isValidWebhookToken(TOKEN, TOKEN)).toBe(true);
  });

  it("recusa token errado, ausente ou de tamanho diferente", () => {
    expect(isValidWebhookToken("b".repeat(40), TOKEN)).toBe(false);
    expect(isValidWebhookToken(TOKEN.slice(0, 39), TOKEN)).toBe(false);
    expect(isValidWebhookToken(null, TOKEN)).toBe(false);
    expect(isValidWebhookToken("", TOKEN)).toBe(false);
  });

  it("falha fechada: sem token configurado, ou curto demais, nada passa", () => {
    expect(isValidWebhookToken("qualquer", undefined)).toBe(false);
    expect(isValidWebhookToken("", "")).toBe(false);
    expect(isValidWebhookToken("curto", "curto")).toBe(false);
  });
});

describe("envelope do evento", () => {
  it("aceita id e event em texto", () => {
    expect(parseEnvelope({ id: "evt_1", event: "PAYMENT_CONFIRMED", payment: { id: "pay_1" } })).not.toBeNull();
  });

  it.each([
    ["nulo", null],
    ["lista", []],
    ["texto", "x"],
    ["sem id", { event: "PAYMENT_CONFIRMED" }],
    ["id vazio", { id: "", event: "PAYMENT_CONFIRMED" }],
    ["id numérico", { id: 1, event: "PAYMENT_CONFIRMED" }],
    ["sem event", { id: "evt_1" }],
    ["id gigante", { id: "x".repeat(201), event: "A" }],
  ])("recusa %s", (_label, value) => {
    expect(parseEnvelope(value)).toBeNull();
  });

  it("classifica os tipos de evento", () => {
    expect(classifyEvent("PAYMENT_RECEIVED")).toBe("payment");
    expect(classifyEvent("CHECKOUT_PAID")).toBe("checkout");
    expect(classifyEvent("SUBSCRIPTION_CREATED")).toBe("subscription");
    expect(classifyEvent("ACCESS_TOKEN_EXPIRING_SOON")).toBe("other");
  });

  it("lê os ids de pagamento e checkout, ignorando formato inesperado", () => {
    const env = parseEnvelope({ id: "e", event: "X", payment: { id: "pay_1" }, checkout: { id: "chk_1" } })!;
    expect(getPaymentId(env)).toBe("pay_1");
    expect(getCheckoutId(env)).toBe("chk_1");

    const odd = parseEnvelope({ id: "e", event: "X", payment: "pay_1", checkout: { id: 5 } })!;
    expect(getPaymentId(odd)).toBeNull();
    expect(getCheckoutId(odd)).toBeNull();
  });
});

describe("espelho da cobrança (asaas_payments)", () => {
  const payment: AsaasPayment = {
    id: "pay_1",
    customer: "cus_1",
    value: 1666.67,
    billingType: "CREDIT_CARD",
    status: "CONFIRMED",
    dueDate: "2026-11-05",
    confirmedDate: "2026-11-05",
    creditDate: "2026-12-08",
    installment: "ins_1",
    installmentNumber: 1,
    checkoutSession: "chk_1",
  };

  it("converte para centavos sem erro de ponto flutuante", () => {
    expect(buildPaymentRow(payment, "sandbox", null).value_cents).toBe(166667);
    expect(buildPaymentRow({ ...payment, value: 0.1 + 0.2 }, "sandbox", null).value_cents).toBe(30);
    expect(buildPaymentRow({ ...payment, value: 5000 }, "sandbox", null).value_cents).toBe(500000);
  });

  it("copia os ids de ligação e o ambiente", () => {
    const row = buildPaymentRow(payment, "sandbox", null);
    expect(row).toMatchObject({
      asaas_payment_id: "pay_1",
      status: "CONFIRMED",
      asaas_checkout_id: "chk_1",
      asaas_installment_id: "ins_1",
      installment_number: 1,
      environment: "sandbox",
      credit_date: "2026-12-08",
    });
  });

  it("nunca inclui applied_at (marca de idempotência de quem aplica o efeito)", () => {
    expect(buildPaymentRow(payment, "sandbox", null)).not.toHaveProperty("applied_at");
  });

  it("sem pedido conhecido, não inclui campos de vínculo (não apaga vínculo já gravado)", () => {
    const row = buildPaymentRow(payment, "sandbox", null);
    expect(row).not.toHaveProperty("order_id");
    expect(row).not.toHaveProperty("organization_id");
    expect(row).not.toHaveProperty("organization_plan_id");
  });

  it("com pedido conhecido, inclui o vínculo", () => {
    const row = buildPaymentRow(payment, "production", {
      orderId: "o1",
      organizationId: "org1",
      organizationPlanId: "op1",
    });
    expect(row).toMatchObject({ order_id: "o1", organization_id: "org1", organization_plan_id: "op1", environment: "production" });
  });

  it("cobrança de renovação (sem pedido): liga só à organização, sem order_id", () => {
    const row = buildPaymentRow({ ...payment, subscription: "sub_1" }, "sandbox", {
      orderId: null,
      organizationId: "org-1",
      organizationPlanId: null,
    });
    expect(row).toMatchObject({ organization_id: "org-1", asaas_subscription_id: "sub_1" });
    expect(row).not.toHaveProperty("order_id");
    expect(row).not.toHaveProperty("organization_plan_id");
  });

  it("cobrança apagada vira status DELETED", () => {
    expect(buildPaymentRow({ ...payment, deleted: true }, "sandbox", null).status).toBe("DELETED");
  });

  it("usa paymentDate quando não há confirmedDate (Pix)", () => {
    const row = buildPaymentRow({ ...payment, confirmedDate: null, paymentDate: "2026-11-06" }, "sandbox", null);
    expect(row.confirmed_at).toBe("2026-11-06");
  });
});
