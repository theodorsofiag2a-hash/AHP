"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cancelRenewal } from "@/actions/plans";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function CancelRenewalButton({ validUntilLabel }: { validUntilLabel: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await cancelRenewal();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Renovação automática cancelada.");
      setOpen(false);
    });
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Cancelar renovação
      </Button>
      <Dialog
        open={open}
        onClose={() => !isPending && setOpen(false)}
        title="Cancelar a renovação automática?"
        description="O plano continua valendo até o vencimento."
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            O cartão não será mais cobrado a cada 6 meses. Seu plano segue ativo até {validUntilLabel}; depois disso, é
            preciso contratar de novo.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Manter renovação
            </Button>
            <Button onClick={handleConfirm} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Cancelar renovação
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
