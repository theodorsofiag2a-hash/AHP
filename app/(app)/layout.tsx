import { requireUserContext } from "@/lib/user-context";
import { getBillingSummary } from "@/lib/billing/user-plan";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserContext();
  const billing = await getBillingSummary(user.userId);

  return (
    <AppShell userName={user.userName} billing={billing} userEmail={user.userEmail}>
      {children}
    </AppShell>
  );
}
