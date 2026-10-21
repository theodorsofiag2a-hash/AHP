import { InputHTMLAttributes, LabelHTMLAttributes, forwardRef, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded border border-ink/15 bg-[#fbf8f1] px-3 text-sm text-text-primary placeholder:text-text-faint outline-none transition focus:border-gold-600 focus:ring-[3px] focus:ring-gold-500/20 disabled:opacity-40",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded border border-ink/15 bg-[#fbf8f1] px-3 py-2 text-sm text-text-primary placeholder:text-text-faint outline-none transition focus:border-gold-600 focus:ring-[3px] focus:ring-gold-500/20 disabled:opacity-40",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("font-ui text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted", className)}
      {...props}
    />
  );
}
