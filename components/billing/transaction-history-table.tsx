import { cn } from "@/lib/utils";
import type { CreditTransactionRow } from "@/lib/credits";

const TYPE_LABELS: Record<string, string> = {
  purchase: "Compra",
  consumption: "Execução AHP",
  refund: "Estorno",
  adjustment: "Ajuste",
  bonus: "Bônus",
  manual_grant: "Concessão manual",
};

export function TransactionHistoryTable({ transactions }: { transactions: CreditTransactionRow[] }) {
  if (transactions.length === 0) {
    return <p className="text-sm text-text-muted">Nenhuma movimentação de créditos ainda.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle bg-bg-surface-alt text-left text-xs uppercase tracking-wide text-text-muted">
            <th className="px-4 py-2.5 font-medium">Data</th>
            <th className="px-4 py-2.5 font-medium">Tipo</th>
            <th className="px-4 py-2.5 font-medium">Descrição</th>
            <th className="px-4 py-2.5 text-right font-medium">Valor</th>
            <th className="px-4 py-2.5 text-right font-medium">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} className="border-b border-border-subtle last:border-0">
              <td className="px-4 py-3 text-text-muted">
                {new Date(t.createdAt).toLocaleDateString("pt-BR")}
              </td>
              <td className="px-4 py-3 text-text-primary">{TYPE_LABELS[t.type] ?? t.type}</td>
              <td className="px-4 py-3 text-text-muted">{t.description ?? "—"}</td>
              <td
                className={cn(
                  "px-4 py-3 text-right tabular-nums font-medium",
                  t.amount >= 0 ? "text-success" : "text-danger"
                )}
              >
                {t.amount >= 0 ? "+" : ""}
                {t.amount}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-text-primary">{t.balanceAfter}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
