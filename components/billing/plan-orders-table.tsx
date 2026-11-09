import { describePaymentMethod, formatCentsBrl, type PaidOrderInput } from "@/lib/billing/history";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export function PlanOrdersTable({ orders }: { orders: PaidOrderInput[] }) {
  return (
    <Table>
      <TableHeader>
        <TableHead>Data</TableHead>
        <TableHead>Plano</TableHead>
        <TableHead>Pagamento</TableHead>
        <TableHead className="text-right">Valor</TableHead>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="text-text-muted">
              {new Date(order.paidAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </TableCell>
            <TableCell className="text-text-primary">{order.planName}</TableCell>
            <TableCell className="text-text-muted">{describePaymentMethod(order)}</TableCell>
            <TableCell className="text-right tabular-nums font-medium text-text-primary">{formatCentsBrl(order.amountCents)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
