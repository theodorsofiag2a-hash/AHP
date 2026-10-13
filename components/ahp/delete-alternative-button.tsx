"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAlternative } from "@/actions/alternatives";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function DeleteAlternativeButton({
  modelId,
  alternativeId,
  alternativeName,
}: {
  modelId: string;
  alternativeId: string;
  alternativeName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      try {
        await deleteAlternative(modelId, alternativeId);
        setOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha ao excluir alternativa.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-11 w-11 shrink-0"
        onClick={() => setOpen(true)}
        aria-label="Excluir alternativa"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Excluir alternativa"
        description={`Isso remove "${alternativeName}" e toda a ficha de avaliação preenchida para ela. Essa ação não pode ser desfeita.`}
      >
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" onClick={handleConfirm} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Excluir
          </Button>
        </div>
      </Dialog>
    </>
  );
}
