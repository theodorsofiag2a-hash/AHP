import { CalendarClock, FolderKanban, Infinity as InfinityIcon, Repeat, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PLAN_GRACE_DAYS } from "@/lib/billing/entitlements";
import { formatDatePt, planBlockMessage, pluralSimulations, type PlanSummary } from "@/lib/billing/plan-summary";

/** Cartão "Seu plano" da página de cobrança: situação, validade, uso e renovação. */
export function CurrentPlanCard({ summary }: { summary: PlanSummary }) {
  const usable = summary.access.usable;
  const pastDue = summary.status === "past_due";

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="icon-badge-gold h-12 w-12 shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-text-primary">Plano {summary.planName}</p>
              <p className="text-sm text-text-muted">
                {usable ? `Válido até ${formatDatePt(summary.validUntil)}` : `Venceu ou foi interrompido (validade: ${formatDatePt(summary.validUntil)})`}
              </p>
            </div>
          </div>
          <Badge variant={usable && !pastDue ? "success" : "danger"}>
            {!usable ? "Inativo" : pastDue ? "Pagamento em atraso" : "Ativo"}
          </Badge>
        </div>

        {!usable && <p className="text-sm text-danger">{planBlockMessage(summary.access.reason)}</p>}
        {usable && pastDue && (
          <p className="text-sm text-danger">
            Há um pagamento em atraso. Você pode continuar usando por mais {summary.graceDaysLeft ?? PLAN_GRACE_DAYS}{" "}
            {summary.graceDaysLeft === 1 ? "dia" : "dias"}; regularize para não perder o acesso.
          </p>
        )}

        <ul className="flex flex-col gap-3 border-t border-border-subtle pt-4 text-sm">
          <li className="flex items-center gap-3">
            {summary.runsLimit === null ? (
              <InfinityIcon className="h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
            ) : (
              <Repeat className="h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
            )}
            <span className="text-text-primary">
              {summary.runsLimit === null
                ? `Simulações ilimitadas · ${summary.runsUsed} feitas neste período`
                : `${pluralSimulations(summary.runsUsed)} usadas de ${summary.runsLimit}`}
            </span>
          </li>
          <li className="flex items-center gap-3">
            <FolderKanban className="h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
            <span className="text-text-primary">
              {summary.alternativesUsed} de {summary.maxAlternatives} alternativas cadastradas
            </span>
          </li>
          <li className="flex items-center gap-3">
            <CalendarClock className="h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
            <span className="text-text-primary">
              {summary.autoRenew
                ? `Renovação automática no cartão em ${formatDatePt(summary.validUntil)}`
                : `Sem renovação automática: renove antes de ${formatDatePt(summary.validUntil)}`}
            </span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
