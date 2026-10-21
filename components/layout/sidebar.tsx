"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, LayoutDashboard, Wallet, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/layout/brand-mark";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/models", label: "Modelos", icon: Boxes },
  { href: "/billing", label: "Créditos", icon: Wallet },
  { href: "/settings/organization", label: "Configurações", icon: Settings },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-ink/60 backdrop-blur-sm md:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 -translate-x-full flex-col gap-1 border-r border-white/10 bg-ink px-3 py-6 shadow-sidebar transition-transform duration-200 md:static md:translate-x-0",
          open && "translate-x-0"
        )}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={onClose}>
            <BrandMark />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted transition-colors hover:text-white md:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Principal" className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded px-3 py-2 font-ui text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white/5 text-gold-300 shadow-[inset_2px_0_0_var(--gold-500)]"
                    : "text-ink-muted hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
