"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { grantCredits } from "@/actions/billing";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function GrantCreditsForm() {
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [amount, setAmount] = useState(10);
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await grantCredits({ organizationSlug, amount, description });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${amount} créditos concedidos a "${organizationSlug}".`);
      setOrganizationSlug("");
      setDescription("");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="org-slug">Slug da organização</Label>
        <Input
          id="org-slug"
          value={organizationSlug}
          onChange={(e) => setOrganizationSlug(e.target.value)}
          placeholder="ex: fornecedores-bess-ltda"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount">Quantidade de créditos</Label>
        <Input
          id="amount"
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Descrição (aparece no histórico do cliente)</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="ex: Pacote Starter — contrato #123"
        />
      </div>
      <Button onClick={handleSubmit} disabled={isPending || !organizationSlug || !description}>
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Conceder créditos
      </Button>
    </div>
  );
}
