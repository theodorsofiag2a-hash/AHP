"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, Settings, BookOpenText, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/billing", label: "Créditos", icon: Wallet },
  { href: "/methodology", label: "Metodologia", icon: BookOpenText },
  { href: "/settings/organization", label: "Configurações", icon: Settings },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 -translate-x-full flex-col gap-1 border-r border-border-subtle bg-bg-surface px-3 py-6 transition-transform duration-200 md:static md:translate-x-0",
          open && "translate-x-0"
        )}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={onClose}>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-gold-400 to-gold-700 text-sm font-bold text-[#141414]">
              G2
            </div>
            <span className="text-sm font-semibold tracking-wide">
              G2A <span className="gold-gradient-text">AHP</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="text-text-faint transition-colors hover:text-text-primary md:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
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
    </>
  );
}
