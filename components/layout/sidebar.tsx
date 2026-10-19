"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/billing", label: "Créditos", icon: Wallet },
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
          "fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 -translate-x-full flex-col gap-1 border-r border-border-subtle bg-bg-surface px-3 py-6 shadow-[4px_0_24px_-8px_rgba(0,0,0,0.5)] transition-transform duration-200 md:static md:translate-x-0",
          open && "translate-x-0"
        )}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={onClose}>
            <Image src="/logo-g2a.png" alt="G2A Consultores" width={48} height={48} className="h-12 w-12 object-contain" priority />
            <span className="h-8 w-px bg-border-subtle" aria-hidden="true" />
<span className="gold-gradient-text translate-y-2 text-xl font-bold tracking-widest">AHP</span>
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
