"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Layers, Wallet, Settings, BookOpenText } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/models", label: "Modelos", icon: Layers },
  { href: "/billing", label: "Créditos", icon: Wallet },
  { href: "/methodology", label: "Metodologia", icon: BookOpenText },
  { href: "/settings/organization", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1 border-r border-border-subtle bg-bg-surface px-3 py-6">
      <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-gold-400 to-gold-700 text-sm font-bold text-[#141414]">
          G2
        </div>
        <span className="text-sm font-semibold tracking-wide">
          G2A <span className="gold-gradient-text">AHP</span>
        </span>
      </Link>

      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-gold-soft text-gold-300"
                : "text-text-muted hover:bg-bg-surface-alt hover:text-text-primary"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </aside>
  );
}
