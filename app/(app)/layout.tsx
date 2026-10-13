import { requireOrgContext } from "@/lib/org";
import { getCreditBalance } from "@/lib/credits";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const org = await requireOrgContext();
  const creditBalance = await getCreditBalance(org.organizationId);

  return (
    <AppShell organizationName={org.organizationName} creditBalance={creditBalance} userEmail={org.userEmail}>
      {children}
    </AppShell>
  );
}
