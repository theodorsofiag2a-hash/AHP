import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface RankingRow {
  rank: number;
  name: string;
  finalScore: number;
}

export function RankingTable({ rows }: { rows: RankingRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableHead>#</TableHead>
        <TableHead>Alternativa</TableHead>
        <TableHead className="text-right">Nota final</TableHead>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.rank}>
            <TableCell>
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  row.rank === 1
                    ? "bg-gold-soft text-gold-700 shadow-glow-gold"
                    : "bg-bg-surface-alt text-text-muted"
                )}
              >
                {row.rank === 1 ? <Trophy className="h-3.5 w-3.5" /> : row.rank}
              </span>
            </TableCell>
            <TableCell className="font-medium text-text-primary">{row.name}</TableCell>
            <TableCell className="text-right tabular-nums text-text-primary">
              {row.finalScore.toFixed(0)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
