import { CalendarClock, FolderKanban, Infinity as InfinityIcon, Repeat, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CancelRenewalButton } from "@/components/billing/cancel-renewal-button";
import { PurchaseButton, type PurchaseBlock } from "@/components/billing/purchase-dialog";
import { PLAN_GRACE_DAYS } from "@/lib/billing/entitlements";
import { daysUntil, isRenewalWindowOpen } from "@/lib/billing/renewal-window";
import { PLANS } from "@/lib/plans";
import { formatDatePt, planBlockMessage, pluralSimulations, type PlanSummary } from "@/lib/billing/plan-summary";

/** Cartão "Seu plano" da página de cobrança: situação, validade, uso e renovação. */
export function CurrentPlanCard({
  summary,
  billingEnabled = false,
  canManage = false,
  purchaseBlock = null,
}: {
  summary: PlanSummary;
  /** Compra online liberada para esta organização (interruptor de cobrança). */
  billingEnabled?: boolean;
  /** Proprietário/administrador: pode renovar e cancelar a renovação. */
  canManage?: boolean;
  purchaseBlock?: PurchaseBlock;
}) {
  const usable = summary.access.usable;
  const pastDue = summary.status === "past_due";
  const renewalPlan = PLANS.find((plan) => plan.code === summary.planCode) ?? null;
  const renewalOpen = isRenewalWindowOpen(summary.validUntil);
  const daysLeft = daysUntil(summary.validUntil);
  const waitingRenewalCharge = summary.autoRenew && usable && daysLeft < 0;

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
              {waitingRenewalCharge
                ? "Aguardando a cobrança da renovação no cartão"
                : summary.autoRenew
                  ? `Renovação automática no cartão em ${formatDatePt(summary.validUntil)}`
                  : `Sem renovação automática: renove antes de ${formatDatePt(summary.validUntil)}`}
            </span>
          </li>
        </ul>

        {billingEnabled && canManage && (
          <div className="flex flex-wrap items-start justify-between gap-3 border-t border-border-subtle pt-4">
            {summary.autoRenew ? (
              <>
                <p className="text-sm text-text-muted">O cartão é cobrado automaticamente a cada 6 meses.</p>
                <CancelRenewalButton validUntilLabel={formatDatePt(summary.validUntil)} />
              </>
            ) : renewalPlan && renewalOpen ? (
              <>
                <p className="text-sm text-text-muted">
                  {daysLeft >= 0
                    ? `Seu plano vence em ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}. Renove para continuar.`
                    : "Seu plano venceu. Renove para voltar a usar."}
                </p>
                <PurchaseButton plan={renewalPlan} block={purchaseBlock} renewal />
              </>
            ) : (
              <p className="text-sm text-text-muted">A renovação abre 30 dias antes do vencimento.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
