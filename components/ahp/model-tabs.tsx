"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ModelTabs({ modelId, canManage = false }: { modelId: string; canManage?: boolean }) {
  const pathname = usePathname();
  const tabs = [
    ...(canManage ? [{ href: `/models/${modelId}/edit`, label: "Estrutura" }] : []),
    { href: `/models/${modelId}/alternatives`, label: "Fichas de Avaliação" },
    { href: `/models/${modelId}/run`, label: "Matriz & Execução" },
  ];

  return (
    <div className="flex items-center gap-1 border-b border-border-subtle">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "border-gold-500 text-gold-300"
                : "border-transparent text-text-muted hover:text-text-primary"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
