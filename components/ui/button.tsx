import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gold-500 text-ink font-semibold shadow-gold hover:bg-gold-400",
  secondary:
    "bg-transparent text-text-primary border border-ink/15 hover:border-ink/40 hover:bg-bg-surface-alt",
  ghost: "bg-transparent text-text-muted hover:text-text-primary hover:bg-bg-surface-alt",
  danger: "bg-danger-soft text-danger border border-danger/30 hover:bg-danger/10",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[11px] rounded gap-1.5",
  md: "h-10 px-5 text-xs rounded gap-2",
  lg: "h-12 px-8 text-xs rounded gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap font-ui font-semibold uppercase tracking-[0.15em] transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
