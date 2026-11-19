"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createAlternative, type CreateAlternativeState } from "@/actions/alternatives";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import type { AlternativeNoun } from "@/lib/ahp/alternative-noun";

export function CreateAlternativeForm({
  modelId,
  autoFocus = false,
  noun,
}: {
  modelId: string;
  autoFocus?: boolean;
  noun: AlternativeNoun;
}) {
  const [state, formAction] = useActionState<CreateAlternativeState, FormData>(
    createAlternative.bind(null, modelId),
    {}
  );

  return (
    <form id="nova-alternativa" action={formAction} className="flex max-w-md scroll-mt-20 flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          name="name"
          placeholder={`Nome d${noun.article} ${noun.singular} (ex: ${noun.example})`}
          required
          autoFocus={autoFocus}
          maxLength={120}
          aria-label={`Nome d${noun.article} ${noun.singular}`}
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
