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
    "bg-gradient-to-br from-gold-400 to-gold-700 text-[#141414] font-semibold hover:brightness-110 active:brightness-95 shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset,0_4px_20px_-4px_rgba(201,147,47,0.45)] hover:shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset,0_6px_28px_-4px_rgba(201,147,47,0.6)]",
  secondary:
    "bg-bg-surface-alt text-text-primary border border-border-subtle hover:border-border-strong hover:bg-bg-surface",
  ghost: "bg-transparent text-text-muted hover:text-text-primary hover:bg-bg-surface-alt",
  danger: "bg-danger-soft text-danger border border-danger/30 hover:bg-danger/10",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm rounded-md gap-1.5",
  md: "h-10 px-4 text-sm rounded-lg gap-2",
  lg: "h-12 px-6 text-base rounded-lg gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none",
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
