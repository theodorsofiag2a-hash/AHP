import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "gold" | "success" | "danger" | "neutral";

const variantClasses: Record<BadgeVariant, string> = {
  gold: "bg-gold-soft text-gold-700 border border-gold-600/35",
  success: "bg-success-soft text-success border border-success/30",
  danger: "bg-danger-soft text-danger border border-danger/30",
  neutral: "bg-bg-surface-alt text-text-muted border border-border-subtle",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-ui text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
