import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Switch = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <label className={cn("relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center", className)}>
        <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
        <span className="absolute inset-0 rounded-full bg-bg-surface-alt border border-border-subtle transition-colors peer-checked:border-gold-600/50 peer-checked:bg-gold-soft peer-focus-visible:ring-2 peer-focus-visible:ring-gold-600 peer-disabled:opacity-40" />
        <span className="relative h-4 w-4 translate-x-1 rounded-full bg-text-faint transition-transform peer-checked:translate-x-6 peer-checked:bg-gold-500" />
      </label>
    );
  }
);
Switch.displayName = "Switch";
