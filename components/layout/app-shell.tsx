"use client";

import { ReactNode, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({
  organizationName,
  creditBalance,
  userEmail,
  children,
}: {
  organizationName: string;
  creditBalance: number;
  userEmail: string | null;
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col">
        <Topbar
          organizationName={organizationName}
          creditBalance={creditBalance}
          userEmail={userEmail}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto bg-bg-base px-4 py-8 md:px-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
