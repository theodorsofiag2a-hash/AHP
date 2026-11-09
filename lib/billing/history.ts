/** Contratações de plano pagas, para o histórico da tela de créditos e planos. */

export type PaidOrderInput = {
  id: string;
  planName: string;
  amountCents: number;
  paymentMethod: "PIX" | "CREDIT_CARD";
  installmentCount: number;
  paidAt: string;
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCentsBrl(cents: number): string {
  return brl.format(cents / 100);
}

export function describePaymentMethod(order: Pick<PaidOrderInput, "paymentMethod" | "installmentCount">): string {
  if (order.paymentMethod === "PIX") return "Pix";
  return order.installmentCount > 1 ? `Cartão em até ${order.installmentCount}x` : "Cartão à vista";
}
