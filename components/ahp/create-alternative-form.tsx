"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createAlternative, type CreateAlternativeState } from "@/actions/alternatives";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";

export function CreateAlternativeForm({ modelId }: { modelId: string }) {
  const [state, formAction] = useActionState<CreateAlternativeState, FormData>(
    createAlternative.bind(null, modelId),
    {}
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          name="name"
          placeholder="Nome da alternativa (ex: Fornecedor A)"
          required
          maxLength={120}
          aria-label="Nome da alternativa"
          aria-invalid={state.error ? true : undefined}
        />
        <SubmitButton size="md">
          <Plus className="h-4 w-4" />
          Adicionar
        </SubmitButton>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
