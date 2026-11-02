import { CalendarClock, FolderKanban, Infinity as InfinityIcon, Repeat } from "lucide-react";
import { ContactG2a } from "@/components/layout/contact-g2a";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatBrl,
  formatProjectRange,
  formatSimulations,
  formatValidity,
  installmentValue,
  type Plan,
} from "@/lib/plans";

export function PlanCard({ plan, organizationSlug }: { plan: Plan; organizationSlug: string }) {
  const installment = installmentValue(plan.priceBrl, plan.maxInstallments);
  const unlimited = plan.simulationLimit === null;

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-text-primary">{plan.name}</h3>
          <Badge variant="neutral">{plan.code}</Badge>
        </div>

        <div>
          <p className="text-3xl font-semibold tabular-nums text-text-primary">{formatBrl(plan.priceBrl)}</p>
          <p className="mt-1 text-sm text-text-muted">
            ou até {plan.maxInstallments}x de <span className="tabular-nums">{formatBrl(installment)}</span>
          </p>
        </div>

        <ul className="flex flex-col gap-3 border-t border-border-subtle pt-4 text-sm">
          <li className="flex items-center gap-3">
            <FolderKanban className="h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
            <span className="text-text-primary">{formatProjectRange(plan)}</span>
          </li>
          <li className="flex items-center gap-3">
            {unlimited ? (
              <InfinityIcon className="h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
            ) : (
              <Repeat className="h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
            )}
            <span className="text-text-primary">{formatSimulations(plan)}</span>
          </li>
          <li className="flex items-center gap-3">
            <CalendarClock className="h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
            <span className="text-text-primary">Validade de {formatValidity(plan)}</span>
          </li>
        </ul>

        <div className="mt-auto pt-1">
          <ContactG2a
            size="sm"
            label="Contratar"
            subject={`Contratar plano ${plan.name} (${plan.code}) — AHP`}
            organizationSlug={organizationSlug}
          />
        </div>
      </CardContent>
    </Card>
  );
}
