import { requireOrgContext } from "@/lib/org";
import { isBillingEnabledFor } from "@/lib/billing/config";
import { BillingProfileForm, EMPTY_BILLING_PROFILE } from "@/components/billing/billing-profile-form";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
};

export default async function OrganizationSettingsPage() {
  const org = await requireOrgContext();
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("organization_members")
    .select("role, joined_at, user_id")
    .eq("organization_id", org.organizationId);

  const canEditBilling = isBillingEnabledFor(org.organizationSlug) && (org.role === "owner" || org.role === "admin");
  const { data: billing } = canEditBilling
    ? await supabase.from("billing_profiles").select("*").eq("organization_id", org.organizationId).maybeSingle()
    : { data: null };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-page-title">Configurações da organização</h1>
        <p className="text-sm text-text-muted">Dados da sua empresa e membros com acesso.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{org.organizationName}</CardTitle>
          <CardDescription>Identificador: {org.organizationSlug}</CardDescription>
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
                  : { ...EMPTY_BILLING_PROFILE, legalName: org.organizationName }
              }
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Membros</CardTitle>
          <CardDescription>Pessoas com acesso a esta organização.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(members ?? []).map((m) => (
            <div key={m.user_id} className="flex items-center justify-between text-sm">
              <span className="text-text-muted">
                {m.user_id === org.userId ? org.userEmail : m.user_id}
              </span>
              <Badge variant={m.role === "owner" ? "gold" : "neutral"}>{ROLE_LABELS[m.role] ?? m.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
