import { requireUserContext } from "@/lib/user-context";
import { isBillingEnabledFor } from "@/lib/billing/config";
import { BillingProfileForm, EMPTY_BILLING_PROFILE } from "@/components/billing/billing-profile-form";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const { voltar } = await searchParams;
  // Só um destino conhecido: a página de planos (de onde a contratação manda preencher os dados).
  const returnTo = voltar === "planos" ? "/billing" : undefined;
  const user = await requireUserContext();
  const supabase = await createClient();

  const canEditBilling = isBillingEnabledFor(user.userEmail);
  const { data: billing } = canEditBilling
    ? await supabase.from("billing_profiles").select("*").eq("user_id", user.userId).maybeSingle()
    : { data: null };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-page-title">Configurações</h1>
        <p className="text-sm text-text-muted">Dados da sua conta.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conta</CardTitle>
          <CardDescription>{user.userEmail}</CardDescription>
        </CardHeader>
      </Card>

      {canEditBilling && (
        <Card>
          <CardHeader>
            <CardTitle>Dados de cobrança</CardTitle>
            <CardDescription>Usados no pagamento do plano e na nota fiscal.</CardDescription>
          </CardHeader>
          <CardContent>
            <BillingProfileForm
              returnTo={returnTo}
              initial={
                billing
                  ? {
                      legalName: billing.legal_name ?? "",
                      cpfCnpj: billing.cpf_cnpj ?? "",
                      email: billing.email ?? "",
                      phone: billing.phone ?? "",
                      postalCode: billing.postal_code ?? "",
                      address: billing.address ?? "",
                      addressNumber: billing.address_number ?? "",
                      complement: billing.complement ?? "",
                      province: billing.province ?? "",
                    }
                  : { ...EMPTY_BILLING_PROFILE, legalName: user.userName }
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
