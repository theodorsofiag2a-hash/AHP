import { CheckCircle2, AlertTriangle } from "lucide-react";
import { CONSISTENCY_THRESHOLD } from "@/lib/ahp/consistency";
import { cn } from "@/lib/utils";

export function CrMeter({ consistencyRatio }: { consistencyRatio: number }) {
  const pct = consistencyRatio * 100;
  const ok = consistencyRatio <= CONSISTENCY_THRESHOLD;
  const clampedPct = Math.min(pct, 100);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-5",
        ok ? "border-success/30 bg-success-soft" : "border-danger/30 bg-danger-soft"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {ok ? (
            <CheckCircle2 className="h-5 w-5 text-success" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-danger" />
          )}
          <span className={cn("text-sm font-semibold", ok ? "text-success" : "text-danger")}>
            {ok ? "Matriz consistente" : "Matriz inconsistente"}
          </span>
        </div>
        <span className={cn("text-xl font-bold tabular-nums", ok ? "text-success" : "text-danger")}>
          {pct.toFixed(2)}%
        </span>
      </div>

      <div className="relative h-2 w-full overflow-hidden rounded-full bg-bg-surface-alt">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", ok ? "bg-success" : "bg-danger")}
          style={{ width: `${clampedPct}%` }}
        />
        <div className="absolute inset-y-0 border-l border-dashed border-text-faint" style={{ left: "10%" }} />
      </div>

      <p className="text-xs text-text-muted">
        Limite de aceitação: CR ≤ 10%. {!ok && "Reveja a matriz de comparação para reduzir inconsistências."}
      </p>
    </div>
  );
}
