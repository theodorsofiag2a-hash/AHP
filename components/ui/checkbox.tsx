import { InputHTMLAttributes, forwardRef } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <label className={cn("relative inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center", className)}>
        <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
        <span className="absolute inset-0 rounded-md border border-border-subtle bg-bg-surface-alt transition-colors peer-checked:border-gold-700/40 peer-checked:bg-gold-soft peer-focus-visible:ring-2 peer-focus-visible:ring-gold-500 peer-disabled:opacity-40" />
        <Check className="relative h-3.5 w-3.5 text-gold-300 opacity-0 transition-opacity peer-checked:opacity-100" />
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";
