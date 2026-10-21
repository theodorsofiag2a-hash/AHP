import { Clock, Coins } from "lucide-react";
import { requireOrgContext } from "@/lib/org";
import { getCreditBalance, getCreditTransactions } from "@/lib/credits";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactG2a } from "@/components/layout/contact-g2a";
import { TransactionHistoryTable } from "@/components/billing/transaction-history-table";

export default async function BillingPage() {
  const org = await requireOrgContext();
  const [balance, transactions] = await Promise.all([
    getCreditBalance(org.organizationId),
    getCreditTransactions(org.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title">Créditos</h1>
        <p className="text-sm text-text-muted">Acompanhe seu saldo e o histórico de uso.</p>
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

        <Card className="border-dashed">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-surface-alt text-text-muted">
              <Clock className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-text-primary">Compra de pacotes</p>
                <Badge variant="neutral">Em breve</Badge>
              </div>
              <p className="text-sm text-text-muted">
                Por enquanto, créditos são liberados diretamente pela G2A.
              </p>
              <div className="mt-3">
                <ContactG2a size="sm" label="Solicitar créditos" subject="Solicitação de créditos (AHP)" organizationSlug={org.organizationSlug} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
