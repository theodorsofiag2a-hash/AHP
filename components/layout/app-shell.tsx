"use client";

import { ReactNode, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { BillingSummary } from "@/lib/billing/plan-summary";

export function AppShell({
  userName,
  billing,
  userEmail,
  children,
}: {
  userName: string;
  billing: BillingSummary;
  userEmail: string | null;
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col">
        <Topbar
          userName={userName}
          billing={billing}
          userEmail={userEmail}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="bg-ambient-subtle flex-1 overflow-y-auto bg-bg-base px-4 py-8 md:px-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
