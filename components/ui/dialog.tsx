"use client";

import { ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "w-full max-w-md rounded-xl border border-border-subtle bg-bg-surface p-0 text-text-primary backdrop:bg-black/60",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border-subtle p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          {description && <p className="text-sm text-text-muted">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-text-faint transition-colors hover:text-text-primary"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
