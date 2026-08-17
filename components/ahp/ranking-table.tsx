import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface RankingRow {
  rank: number;
  name: string;
  finalScore: number;
}

export function RankingTable({ rows }: { rows: RankingRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle bg-bg-surface-alt text-left text-xs uppercase tracking-wide text-text-muted">
            <th className="px-4 py-2.5 font-medium">#</th>
            <th className="px-4 py-2.5 font-medium">Alternativa</th>
            <th className="px-4 py-2.5 text-right font-medium">Nota final</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rank} className="border-b border-border-subtle last:border-0">
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    row.rank === 1 ? "bg-gold-soft text-gold-300" : "bg-bg-surface-alt text-text-muted"
                  )}
                >
                  {row.rank === 1 ? <Trophy className="h-3.5 w-3.5" /> : row.rank}
                </span>
              </td>
              <td className="px-4 py-3 font-medium text-text-primary">{row.name}</td>
              <td className="px-4 py-3 text-right tabular-nums text-text-primary">
                {row.finalScore.toFixed(0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
