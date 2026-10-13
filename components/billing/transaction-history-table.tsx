import { cn } from "@/lib/utils";
import type { CreditTransactionRow } from "@/lib/credits";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

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
    <Table>
      <TableHeader>
        <TableHead>Data</TableHead>
        <TableHead>Tipo</TableHead>
        <TableHead>Descrição</TableHead>
        <TableHead className="text-right">Valor</TableHead>
        <TableHead className="text-right">Saldo</TableHead>
      </TableHeader>
      <TableBody>
        {transactions.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="text-text-muted">{new Date(t.createdAt).toLocaleDateString("pt-BR")}</TableCell>
            <TableCell className="text-text-primary">{TYPE_LABELS[t.type] ?? t.type}</TableCell>
            <TableCell className="text-text-muted">{t.description ?? "—"}</TableCell>
            <TableCell
              className={cn("text-right tabular-nums font-medium", t.amount >= 0 ? "text-success" : "text-danger")}
            >
              {t.amount >= 0 ? "+" : ""}
              {t.amount}
            </TableCell>
            <TableCell className="text-right tabular-nums text-text-primary">{t.balanceAfter}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
