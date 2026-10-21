import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/org";
import { isPlatformAdmin } from "@/lib/admin-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GrantCreditsForm } from "@/components/billing/grant-credits-form";

export default async function AdminCreditsPage() {
  const org = await requireOrgContext();
  if (!isPlatformAdmin(org.userEmail)) notFound();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <h1 className="text-page-title">Conceder créditos</h1>
        <p className="text-sm text-text-muted">
          Uso interno G2A — libera créditos para qualquer organização enquanto não há checkout automatizado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova concessão</CardTitle>
          <CardDescription>O slug da organização aparece na URL/configurações do cliente.</CardDescription>
        </CardHeader>
        <CardContent>
          <GrantCreditsForm />
        </CardContent>
      </Card>
    </div>
  );
}
