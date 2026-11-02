import { Coins, Handshake } from "lucide-react";
import { requireOrgContext } from "@/lib/org";
import { getCreditBalance, getCreditTransactions } from "@/lib/credits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactG2a } from "@/components/layout/contact-g2a";
import { TransactionHistoryTable } from "@/components/billing/transaction-history-table";
import { PlanCard } from "@/components/billing/plan-card";
import { PLANS } from "@/lib/plans";

export default async function BillingPage() {
  const org = await requireOrgContext();
  const [balance, transactions] = await Promise.all([
    getCreditBalance(org.organizationId),
    getCreditTransactions(org.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title">Créditos e planos</h1>
        <p className="text-sm text-text-muted">Acompanhe seu saldo, conheça os planos e veja o histórico de uso.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="icon-badge-gold h-12 w-12">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <p className="text-3xl font-semibold tabular-nums">{balance}</p>
              <p className="text-sm text-text-muted">{balance === 1 ? "crédito disponível" : "créditos disponíveis"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="icon-badge-gold h-12 w-12 shrink-0">
              <Handshake className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-text-primary">Como contratar</p>
              <p className="text-sm text-text-muted">
                Escolha um plano abaixo e fale com a G2A. Após a confirmação, os créditos são liberados na sua conta.
              </p>
              <div className="mt-3">
                <ContactG2a size="sm" label="Solicitar créditos" subject="Solicitação de créditos (AHP)" organizationSlug={org.organizationSlug} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="planos-titulo" className="flex flex-col gap-4">
        <div>
          <h2 id="planos-titulo" className="text-section-label">
            Planos
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Cada plano é definido pelo número de projetos que você precisa avaliar. Todos valem por 6 meses a partir da
            contratação, e o pagamento pode ser parcelado em até 3x.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <PlanCard key={plan.code} plan={plan} organizationSlug={org.organizationSlug} />
          ))}
        </div>
        <p className="text-xs text-text-faint">
          Valores em reais. Condições comerciais sujeitas à confirmação da G2A no momento da contratação.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>Todas as movimentações de crédito da sua organização.</CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionHistoryTable transactions={transactions} />
        </CardContent>
      </Card>
    </div>
  );
}
