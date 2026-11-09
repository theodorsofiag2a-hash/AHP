import { cn } from "@/lib/utils";
import type { HistoryRow } from "@/lib/billing/history";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const TYPE_LABELS: Record<string, string> = {
  purchase: "Compra",
  consumption: "Execução AHP",
  refund: "Estorno",
  adjustment: "Ajuste",
  bonus: "Bônus",
  manual_grant: "Concessão manual",
};

export function TransactionHistoryTable({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-text-muted">Nenhuma movimentação ainda.</p>;
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
        {rows.map((row) =>
          row.kind === "plan" ? (
            <TableRow key={row.id}>
              <TableCell className="text-text-muted">{new Date(row.date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</TableCell>
              <TableCell className="text-text-primary">Contratação de plano</TableCell>
              <TableCell className="text-text-muted">{row.description}</TableCell>
              <TableCell className="text-right tabular-nums font-medium text-text-primary">{row.valueLabel}</TableCell>
              <TableCell className="text-right text-text-faint">—</TableCell>
            </TableRow>
          ) : (
            <TableRow key={row.id}>
              <TableCell className="text-text-muted">{new Date(row.date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</TableCell>
              <TableCell className="text-text-primary">{TYPE_LABELS[row.type] ?? row.type}</TableCell>
              <TableCell className="text-text-muted">{row.description ?? "—"}</TableCell>
              <TableCell
                className={cn("text-right tabular-nums font-medium", row.amount >= 0 ? "text-success" : "text-danger")}
              >
                {row.amount >= 0 ? "+" : ""}
                {row.amount}
              </TableCell>
              <TableCell className="text-right tabular-nums text-text-primary">{row.balanceAfter}</TableCell>
            </TableRow>
          )
        )}
      </TableBody>
    </Table>
  );
}
