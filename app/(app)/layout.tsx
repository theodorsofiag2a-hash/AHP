import { requireOrgContext } from "@/lib/org";
import { getOrgBillingSummary } from "@/lib/billing/org-plan";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const org = await requireOrgContext();
  const billing = await getOrgBillingSummary(org.organizationId);

  return (
    <AppShell organizationName={org.organizationName} billing={billing} userEmail={org.userEmail}>
      {children}
    </AppShell>
  );
}
