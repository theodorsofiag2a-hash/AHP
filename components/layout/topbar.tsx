"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Coins, LogOut, Menu, Settings, ChevronDown } from "lucide-react";
import { signOut } from "@/actions/auth";
import { Badge } from "@/components/ui/badge";

export function Topbar({
  organizationName,
  creditBalance,
  userEmail,
  onMenuClick,
}: {
  organizationName: string;
  creditBalance: number;
  userEmail: string | null;
  onMenuClick: () => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnOutsideOrEscape(e: MouseEvent | KeyboardEvent) {
      const details = detailsRef.current;
      if (!details || !details.open) return;
      if (e.type === "keydown" && (e as KeyboardEvent).key === "Escape") {
        details.open = false;
        return;
      }
      if (e.type === "mousedown" && !details.contains(e.target as Node)) {
        details.open = false;
      }
    }
    document.addEventListener("mousedown", closeOnOutsideOrEscape);
    document.addEventListener("keydown", closeOnOutsideOrEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideOrEscape);
      document.removeEventListener("keydown", closeOnOutsideOrEscape);
    };
  }, []);

  return (
    <header className="flex h-16 items-center justify-between border-b border-border-subtle px-4 md:px-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          className="text-text-muted transition-colors hover:text-text-primary md:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <details ref={detailsRef} className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1 py-1 text-sm font-semibold text-text-primary outline-none [&::-webkit-details-marker]:hidden">
            {organizationName}
            <ChevronDown className="h-3.5 w-3.5 text-text-faint transition-transform group-open:rotate-180" />
          </summary>
          <div className="absolute left-0 top-full z-20 mt-2 w-56 rounded-lg border border-border-subtle bg-bg-surface-alt p-2 shadow-lg">
            {userEmail && <p className="truncate px-2 py-1.5 text-xs text-text-faint">{userEmail}</p>}
            <Link
              href="/settings/organization"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-muted transition-colors hover:bg-bg-surface hover:text-text-primary"
            >
              <Settings className="h-4 w-4" />
              Configurações
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-text-muted transition-colors hover:bg-bg-surface hover:text-text-primary"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </form>
          </div>
        </details>
      </div>

      <Link href="/billing">
        <Badge variant="gold" className="cursor-pointer">
          <Coins className="h-3 w-3" />
          {creditBalance} {creditBalance === 1 ? "crédito" : "créditos"}
        </Badge>
      </Link>
    </header>
  );
}
