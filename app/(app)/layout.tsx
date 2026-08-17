import { requireOrgContext } from "@/lib/org";
import { getCreditBalance } from "@/lib/credits";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const org = await requireOrgContext();
  const creditBalance = await getCreditBalance(org.organizationId);

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar organizationName={org.organizationName} creditBalance={creditBalance} userEmail={org.userEmail} />
        <main className="flex-1 overflow-y-auto bg-bg-base px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
