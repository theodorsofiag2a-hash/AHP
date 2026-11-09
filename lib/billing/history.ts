/**
 * Histórico da tela de créditos e planos: movimentações de crédito e contratações de plano (pedidos pagos)
 * numa lista só, da mais recente para a mais antiga.
 */

export type CreditHistoryInput = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
};

export type PaidOrderInput = {
  id: string;
  planName: string;
  amountCents: number;
  paymentMethod: "PIX" | "CREDIT_CARD";
  installmentCount: number;
  paidAt: string;
};

export type HistoryRow =
  | { kind: "credit"; id: string; date: string; type: string; description: string | null; amount: number; balanceAfter: number }
  | { kind: "plan"; id: string; date: string; description: string; valueLabel: string };

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function describePlanOrder(order: Pick<PaidOrderInput, "planName" | "paymentMethod" | "installmentCount">): string {
  const how =
    order.paymentMethod === "PIX" ? "Pix" : order.installmentCount > 1 ? `cartão em até ${order.installmentCount}x` : "cartão à vista";
  return `Plano ${order.planName} · ${how}`;
}

export function buildHistoryRows(credits: CreditHistoryInput[], orders: PaidOrderInput[]): HistoryRow[] {
  const rows: HistoryRow[] = [
    ...credits.map((c): HistoryRow => ({
      kind: "credit",
      id: `c-${c.id}`,
      date: c.createdAt,
      type: c.type,
      description: c.description,
      amount: c.amount,
      balanceAfter: c.balanceAfter,
    })),
    ...orders.map((o): HistoryRow => ({
      kind: "plan",
      id: `p-${o.id}`,
      date: o.paidAt,
      description: describePlanOrder(o),
      valueLabel: brl.format(o.amountCents / 100),
    })),
  ];
  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
